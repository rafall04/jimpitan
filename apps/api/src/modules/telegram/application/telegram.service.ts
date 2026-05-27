/**
 * Purpose: Application service for Telegram webhook ingestion, command routing, state handling, and delivery outbox processing.
 * Caller: TelegramController, notification outbox workers, and unit tests.
 * Deps: Telegram repository/sender ports, ConfigService, Jimpitan, Finance, Cash Account, Category, and Approval services.
 * MainFuncs: Verifies webhook secrets, stores updates idempotently, enforces binding/RBAC/tenant context, runs per-house and bulk-total bot flows, and dispatches Telegram outbox messages.
 * SideEffects: Writes Telegram accounts, updates, sessions, bindings, audit/outbox status, finance drafts, jimpitan items/bulk totals, and approval decisions through injected services.
 */
import { BadRequestException, ForbiddenException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import type { PermissionKey } from '../../rbac/domain/permission.constants';
import type { AuthPrincipal } from '../../auth/domain/auth.types';
import { ApprovalsService } from '../../approvals/application/approvals.service';
import { CashAccountsService } from '../../finance/application/cash-accounts.service';
import { FinanceTransactionsService } from '../../finance/application/finance-transactions.service';
import { TransactionCategoriesService } from '../../finance/application/transaction-categories.service';
import { JimpitanService } from '../../jimpitan/application/jimpitan.service';
import { TELEGRAM_REPOSITORY, TELEGRAM_SENDER } from '../telegram.tokens';
import type { CreateTelegramBindCodeCommand, ProcessTelegramOutboxCommand, TelegramRequestMeta } from './telegram.commands';
import type {
  TelegramAccountRecord,
  TelegramBotReply,
  TelegramContextRecord,
  TelegramInboundUpdate,
  TelegramOutboxProcessingResult,
  TelegramResolvedContext,
  TelegramSessionRecord,
  TelegramWebhookResult,
} from '../domain/telegram.types';
import type { TelegramRepositoryPort } from '../infrastructure/telegram.repository.port';
import type { TelegramSenderPort } from '../infrastructure/telegram-sender.port';

type CommandParts = {
  command: string | null;
  args: string[];
  text: string;
};

type RouteResult = {
  replies: TelegramBotReply[];
  rtId?: string;
};

const MONEY_PATTERN = /^(0|[1-9]\d{0,11})$/;
const COLLECTION_ITEM_STATUSES = new Set(['PAID', 'UNPAID', 'HOUSE_EMPTY', 'TITIP_TETANGGA', 'MENUNGGAK', 'DISPENSATION']);
const TELEGRAM_SESSION_TTL_MINUTES = 120;

@Injectable()
export class TelegramService {
  constructor(
    @Inject(TELEGRAM_REPOSITORY) private readonly repository: TelegramRepositoryPort,
    @Inject(TELEGRAM_SENDER) private readonly sender: TelegramSenderPort,
    private readonly configService: ConfigService,
    private readonly jimpitanService: JimpitanService,
    private readonly cashAccountsService: CashAccountsService,
    private readonly categoryService: TransactionCategoriesService,
    private readonly transactionService: FinanceTransactionsService,
    private readonly approvalsService: ApprovalsService,
  ) {}

  async handleWebhook(payload: unknown, meta: TelegramRequestMeta): Promise<TelegramWebhookResult> {
    this.assertWebhookSecret(meta.webhookSecret);
    const update = this.parseUpdate(payload);
    const account = update.profile ? await this.repository.upsertAccount(update.profile) : null;
    const stored = await this.repository.recordIncomingUpdate(update, account?.id ?? null);
    if (stored.isDuplicate) {
      return { ok: true, duplicate: true, replies: [] };
    }

    try {
      const routed = await this.routeUpdate(update, account, meta);
      for (const reply of routed.replies) {
        await this.sender.sendMessage(reply);
      }
      await this.repository.markUpdateProcessed(update.updateId, { rtId: routed.rtId, telegramAccountId: account?.id ?? null });
      return { ok: true, duplicate: false, replies: routed.replies };
    } catch (error) {
      const message = this.errorMessage(error);
      if (update.chatId) {
        await this.sender.sendMessage({ chatId: update.chatId, text: message });
      }
      await this.repository.markUpdateFailed(update.updateId, message, { telegramAccountId: account?.id ?? null });
      return { ok: false, duplicate: false, replies: update.chatId ? [{ chatId: update.chatId, text: message }] : [] };
    }
  }

  async createBindingCode(actor: AuthPrincipal, command: CreateTelegramBindCodeCommand, meta: TelegramRequestMeta) {
    this.assertCanCreateBindingCode(actor, command);
    const code = randomBytes(12).toString('base64url').toUpperCase();
    const expiresAt = new Date(Date.now() + Math.max(5, command.expiresInMinutes ?? 30) * 60_000);
    await this.repository.createBindingCode(
      actor.rtId,
      {
        codeHash: this.hashCode(code),
        expiresAt,
        targetUserId: command.userId ?? actor.userId,
        targetMembershipId: command.membershipId ?? actor.membershipId,
        targetResidentId: command.residentId,
      },
      actor,
      meta,
    );
    return { code, expiresAt };
  }

  async processTelegramOutbox(command: ProcessTelegramOutboxCommand): Promise<TelegramOutboxProcessingResult> {
    const limit = Math.min(Math.max(command.limit ?? 20, 1), 50);
    await this.repository.recoverStaleTelegramOutbox(command.staleBefore ?? new Date(Date.now() - 900_000));
    const events = await this.repository.claimPendingTelegramOutbox(limit);
    let sent = 0;
    let failed = 0;
    for (const event of events) {
      const chatId = await this.repository.findChatForTelegramAccount(event.rtId, event.telegramAccountId);
      if (!chatId) {
        failed += 1;
        await this.repository.failTelegramOutbox(event.id, event.notificationId, 'Verified Telegram chat was not found.');
        continue;
      }
      const result = await this.safeSendMessage({ chatId, text: this.formatNotification(event.title, event.body) });
      if (result.ok) {
        sent += 1;
        await this.repository.completeTelegramOutbox(event.id, event.notificationId);
      } else {
        failed += 1;
        await this.repository.failTelegramOutbox(event.id, event.notificationId, result.errorMessage ?? 'Telegram send failed.');
      }
    }
    return { processed: events.length, sent, failed };
  }

  private async routeUpdate(update: TelegramInboundUpdate, account: TelegramAccountRecord | null, meta: TelegramRequestMeta): Promise<RouteResult> {
    const chatId = update.chatId;
    if (!chatId) {
      return { replies: [] };
    }
    const text = update.callbackData ?? update.text ?? '';
    const parsed = this.parseCommand(text);

    if (parsed.command === '/start') {
      return { replies: [{ chatId, text: 'Kirim /bind <kode> untuk menghubungkan akun Telegram ke RT.' }] };
    }
    if (parsed.command === '/help') {
      return { replies: [{ chatId, text: this.helpText() }] };
    }
    if (!account) {
      return { replies: [{ chatId, text: 'Akun Telegram belum dapat dikenali. Kirim /start lalu /bind <kode>.' }] };
    }
    if (parsed.command === '/bind') {
      return this.bindAccount(chatId, account, parsed.args, meta);
    }

    const contexts = await this.repository.getVerifiedContexts(account.id);
    if (contexts.length === 0) {
      return { replies: [{ chatId, text: 'Akun Telegram belum terikat. Kirim /bind <kode>.' }] };
    }
    if (parsed.command === '/menu') {
      return this.menu(chatId, account, contexts, parsed.args);
    }
    const resolved = await this.resolveContext(chatId, account, contexts, parsed.args);
    if (!resolved.context) {
      return { replies: [resolved.reply] };
    }
    if (parsed.command === '/cancel') {
      await this.repository.clearSession(resolved.context.rtId, account.id, resolved.context.userId);
      return { rtId: resolved.context.rtId, replies: [{ chatId, text: 'Sesi bot dibatalkan.' }] };
    }

    const session = await this.getSession(account.id, contexts, resolved.context.rtId);
    if (!parsed.command && session?.session.state && session.session.state !== 'IDLE') {
      const replies = await this.continueSession(chatId, account, resolved.context, session.session, parsed.text, meta);
      return { rtId: resolved.context.rtId, replies };
    }

    switch (parsed.command) {
      case '/saldo':
        return { rtId: resolved.context.rtId, replies: [await this.balanceReply(chatId, resolved.context)] };
      case '/jadwal':
        return { rtId: resolved.context.rtId, replies: [await this.scheduleReply(chatId, resolved.context)] };
      case '/input_jimpitan':
        return { rtId: resolved.context.rtId, replies: [await this.startJimpitanFlow(chatId, account, resolved.context)] };
      case '/rekap_jimpitan':
        return { rtId: resolved.context.rtId, replies: [await this.jimpitanSummaryReply(chatId, resolved.context)] };
      case '/input_pemasukan':
        return { rtId: resolved.context.rtId, replies: [await this.startFinanceFlow(chatId, account, resolved.context, 'INCOME')] };
      case '/input_pengeluaran':
        return { rtId: resolved.context.rtId, replies: [await this.startFinanceFlow(chatId, account, resolved.context, 'EXPENSE')] };
      case '/approval':
        return { rtId: resolved.context.rtId, replies: [await this.startApprovalFlow(chatId, account, resolved.context)] };
      default:
        return { rtId: resolved.context.rtId, replies: [{ chatId, text: 'Perintah tidak dikenal. Kirim /help.' }] };
    }
  }

  private async bindAccount(chatId: string, account: TelegramAccountRecord, args: string[], meta: TelegramRequestMeta): Promise<RouteResult> {
    const code = args[0];
    if (!code) {
      return { replies: [{ chatId, text: 'Format: /bind <kode>.' }] };
    }
    const result = await this.repository.verifyBindingCode(this.hashCode(code), account, meta);
    if (!result || result.contexts.length === 0) {
      return { replies: [{ chatId, text: 'Kode bind tidak valid atau sudah kedaluwarsa.' }] };
    }
    const context = result.contexts[0];
    await this.repository.saveSession(context.rtId, account.id, context.userId, { state: 'IDLE', data: {}, updatedAt: new Date().toISOString() });
    return { rtId: context.rtId, replies: [{ chatId, text: `Bind berhasil untuk ${context.rtName}. Kirim /menu.` }] };
  }

  private async menu(chatId: string, account: TelegramAccountRecord, contexts: TelegramContextRecord[], args: string[]): Promise<RouteResult> {
    const selected = args[0] ? this.findContextByCode(contexts, args[0]) : contexts.length === 1 ? contexts[0] : null;
    if (!selected) {
      return { replies: [{ chatId, text: this.contextSelectionText(contexts) }] };
    }
    await this.repository.saveSession(selected.rtId, account.id, selected.userId, { state: 'IDLE', data: {}, updatedAt: new Date().toISOString() });
    return { rtId: selected.rtId, replies: [{ chatId, text: this.menuText(this.toResolvedContext(selected)) }] };
  }

  private async resolveContext(chatId: string, account: TelegramAccountRecord, contexts: TelegramContextRecord[], args: string[]) {
    if (args[0]) {
      const byArg = this.findContextByCode(contexts, args[0]);
      if (byArg) {
        return { context: this.toResolvedContext(byArg) };
      }
    }
    if (contexts.length === 1) {
      return { context: this.toResolvedContext(contexts[0]) };
    }
    const latest = await this.repository.getLatestSession(account.id, contexts.map((context) => context.rtId));
    if (latest) {
      const match = contexts.find((context) => context.rtId === latest.rtId);
      if (match) {
        return { context: this.toResolvedContext(match) };
      }
    }
    return { context: null, reply: { chatId, text: this.contextSelectionText(contexts) } };
  }

  private async getSession(telegramAccountId: string, contexts: TelegramContextRecord[], rtId: string) {
    const session = await this.repository.getLatestSession(telegramAccountId, contexts.map((context) => context.rtId));
    if (!session || session.rtId !== rtId || this.isSessionExpired(session.session)) {
      return null;
    }
    return session;
  }

  private async continueSession(
    chatId: string,
    account: TelegramAccountRecord,
    context: TelegramResolvedContext,
    session: TelegramSessionRecord,
    text: string,
    meta: TelegramRequestMeta,
  ): Promise<TelegramBotReply[]> {
    switch (session.state) {
      case 'JIMPITAN_SELECT_SESSION':
        this.assertAnyPermission(context.principal, ['collections.update_own', 'collections.submit_own', 'collections.validate']);
        return [await this.selectJimpitanSession(chatId, account, context, session, text)];
      case 'JIMPITAN_SELECT_HOUSE':
        this.assertAnyPermission(context.principal, ['collections.update_own', 'collections.submit_own', 'collections.validate']);
        return [await this.selectJimpitanHouse(chatId, account, context, session, text)];
      case 'JIMPITAN_INPUT_AMOUNT_STATUS':
        this.assertAnyPermission(context.principal, ['collections.update_own', 'collections.submit_own', 'collections.validate']);
        return [await this.captureJimpitanAmount(chatId, account, context, session, text)];
      case 'JIMPITAN_BULK_TOTAL_AMOUNT':
        this.assertAnyPermission(context.principal, ['collections.update_own', 'collections.submit_own', 'collections.validate']);
        return [await this.captureBulkJimpitanTotal(chatId, account, context, session, text)];
      case 'JIMPITAN_BULK_TOTAL_NOTE':
        this.assertAnyPermission(context.principal, ['collections.update_own', 'collections.submit_own', 'collections.validate']);
        return [await this.saveBulkJimpitanTotal(chatId, account, context, session, text, meta)];
      case 'JIMPITAN_NOTE':
        this.assertAnyPermission(context.principal, ['collections.update_own', 'collections.submit_own', 'collections.validate']);
        return [await this.saveJimpitanItem(chatId, account, context, session, text, meta)];
      case 'FINANCE_SELECT_CATEGORY':
        this.assertAnyPermission(context.principal, ['transactions.create']);
        return [await this.selectFinanceCategory(chatId, account, context, session, text)];
      case 'FINANCE_AMOUNT':
        this.assertAnyPermission(context.principal, ['transactions.create']);
        return [await this.captureFinanceAmount(chatId, account, context, session, text)];
      case 'FINANCE_DESCRIPTION':
        this.assertAnyPermission(context.principal, ['transactions.create']);
        return [await this.saveFinanceDraft(chatId, account, context, session, text, meta)];
      case 'APPROVAL_ACTION':
        return [await this.decideApproval(chatId, context, session, text, meta)];
      default:
        return [{ chatId, text: 'Sesi tidak dikenal. Kirim /cancel lalu mulai lagi.' }];
    }
  }

  private async balanceReply(chatId: string, context: TelegramResolvedContext): Promise<TelegramBotReply> {
    this.assertAnyPermission(context.principal, ['transactions.read']);
    const account = await this.cashAccountsService.getDefaultCashAccount(context.principal);
    const balance = await this.cashAccountsService.getCashAccountBalance(context.principal, account.id);
    return { chatId, text: `Saldo ${account.name}: Rp ${this.formatAmount(balance.balance)}\nLedger terakhir: ${balance.ledgerSequence}` };
  }

  private async scheduleReply(chatId: string, context: TelegramResolvedContext): Promise<TelegramBotReply> {
    this.assertAnyPermission(context.principal, ['collections.read', 'collections.update_own', 'collections.submit_own']);
    const result = await this.jimpitanService.listMyMobileCollections(context.principal, { page: 1, limit: 5, sortBy: 'collectionDate', sortDirection: 'desc' });
    if (result.items.length === 0) {
      return { chatId, text: 'Tidak ada jadwal jimpitan aktif untuk akun ini.' };
    }
    return { chatId, text: `Jadwal jimpitan:\n${result.items.map((item, index) => `${index + 1}. ${this.dateOnly(item.collectionDate)} ${item.route.areaName ?? '-'} ${item.status} ${item.collectionMode}`).join('\n')}` };
  }

  private async startJimpitanFlow(chatId: string, account: TelegramAccountRecord, context: TelegramResolvedContext): Promise<TelegramBotReply> {
    this.assertAnyPermission(context.principal, ['collections.update_own', 'collections.submit_own', 'collections.validate']);
    const result = await this.jimpitanService.listMyMobileCollections(context.principal, { page: 1, limit: 10, sortBy: 'collectionDate', sortDirection: 'desc' });
    if (result.items.length === 0) {
      return { chatId, text: 'Tidak ada sesi jimpitan yang bisa diinput.' };
    }
    await this.repository.saveSession(context.rtId, account.id, context.userId, {
      state: 'JIMPITAN_SELECT_SESSION',
      data: { collectionIds: result.items.map((item) => item.id) },
      updatedAt: new Date().toISOString(),
    });
    return { chatId, text: `Pilih sesi jimpitan:\n${result.items.map((item, index) => `${index + 1}. ${this.dateOnly(item.collectionDate)} ${item.route.areaName ?? '-'} ${item.status} ${item.collectionMode}`).join('\n')}` };
  }

  private async selectJimpitanSession(
    chatId: string,
    account: TelegramAccountRecord,
    context: TelegramResolvedContext,
    session: TelegramSessionRecord,
    text: string,
  ): Promise<TelegramBotReply> {
    const collectionId = this.pickByIndex(this.stringArray(session.data.collectionIds), text);
    const collection = await this.jimpitanService.getCollection(context.principal, collectionId);
    if (collection.collectionMode === 'BULK_TOTAL') {
      await this.repository.saveSession(context.rtId, account.id, context.userId, {
        state: 'JIMPITAN_BULK_TOTAL_AMOUNT',
        data: { collectionId },
        updatedAt: new Date().toISOString(),
      });
      return { chatId, text: 'Masukkan total terkumpul untuk sesi BULK_TOTAL. Contoh: 75000.' };
    }
    const checklist = await this.jimpitanService.getChecklist(context.principal, collectionId);
    const houseIds = checklist.houses.map((house) => house.houseId);
    await this.repository.saveSession(context.rtId, account.id, context.userId, {
      state: 'JIMPITAN_SELECT_HOUSE',
      data: { collectionId, houseIds },
      updatedAt: new Date().toISOString(),
    });
    return { chatId, text: this.houseSelectionText(checklist.houses) };
  }

  private async selectJimpitanHouse(
    chatId: string,
    account: TelegramAccountRecord,
    context: TelegramResolvedContext,
    session: TelegramSessionRecord,
    text: string,
  ): Promise<TelegramBotReply> {
    const collectionId = this.requiredString(session.data.collectionId, 'Sesi jimpitan tidak valid.');
    const houseId = this.pickByIndex(this.stringArray(session.data.houseIds), text);
    const checklist = await this.jimpitanService.getChecklist(context.principal, collectionId);
    const house = checklist.houses.find((candidate) => candidate.houseId === houseId);
    if (!house) {
      throw new BadRequestException('Rumah tidak ditemukan dalam checklist.');
    }
    if (house.item) {
      return { chatId, text: 'Rumah ini sudah tercatat untuk sesi ini. Pilih rumah lain.' };
    }
    await this.repository.saveSession(context.rtId, account.id, context.userId, {
      state: 'JIMPITAN_INPUT_AMOUNT_STATUS',
      data: { collectionId, houseId, residentId: house.primaryResident?.id ?? null },
      updatedAt: new Date().toISOString(),
    });
    return { chatId, text: `Input ${house.houseNumber}. Format: <nominal> <status>. Contoh: 2000 PAID. Status: PAID, UNPAID, HOUSE_EMPTY, TITIP_TETANGGA, MENUNGGAK, DISPENSATION.` };
  }

  private async captureJimpitanAmount(
    chatId: string,
    account: TelegramAccountRecord,
    context: TelegramResolvedContext,
    session: TelegramSessionRecord,
    text: string,
  ): Promise<TelegramBotReply> {
    const [amount, rawStatus] = text.trim().split(/\s+/);
    const status = rawStatus?.toUpperCase();
    this.assertIntegerMoney(amount);
    if (!status || !COLLECTION_ITEM_STATUSES.has(status)) {
      throw new BadRequestException('Status jimpitan tidak valid.');
    }
    if (status === 'PAID' && amount === '0') {
      throw new BadRequestException('Status PAID membutuhkan nominal lebih dari 0.');
    }
    if (status !== 'PAID' && amount !== '0') {
      throw new BadRequestException('Status selain PAID harus memakai nominal 0.');
    }
    await this.repository.saveSession(context.rtId, account.id, context.userId, {
      state: 'JIMPITAN_NOTE',
      data: { ...session.data, amount, status },
      updatedAt: new Date().toISOString(),
    });
    return { chatId, text: 'Catatan opsional? Kirim - jika kosong.' };
  }

  private async captureBulkJimpitanTotal(
    chatId: string,
    account: TelegramAccountRecord,
    context: TelegramResolvedContext,
    session: TelegramSessionRecord,
    text: string,
  ): Promise<TelegramBotReply> {
    const totalAmount = text.trim();
    this.assertPositiveIntegerMoney(totalAmount);
    await this.repository.saveSession(context.rtId, account.id, context.userId, {
      state: 'JIMPITAN_BULK_TOTAL_NOTE',
      data: { ...session.data, totalAmount },
      updatedAt: new Date().toISOString(),
    });
    return { chatId, text: 'Catatan total opsional? Kirim - jika kosong.' };
  }

  private async saveBulkJimpitanTotal(
    chatId: string,
    account: TelegramAccountRecord,
    context: TelegramResolvedContext,
    session: TelegramSessionRecord,
    text: string,
    meta: TelegramRequestMeta,
  ): Promise<TelegramBotReply> {
    const collectionId = this.requiredString(session.data.collectionId, 'Sesi jimpitan tidak valid.');
    const totalAmount = this.requiredString(session.data.totalAmount, 'Total jimpitan tidak valid.');
    await this.jimpitanService.setBulkCollectionTotal(
      context.principal,
      collectionId,
      {
        totalAmount,
        note: text.trim() === '-' ? null : text.trim(),
      },
      meta,
    );
    await this.repository.clearSession(context.rtId, account.id, context.userId);
    return { chatId, text: `Total jimpitan tersimpan: Rp ${this.formatAmount(totalAmount)}.` };
  }

  private async saveJimpitanItem(
    chatId: string,
    account: TelegramAccountRecord,
    context: TelegramResolvedContext,
    session: TelegramSessionRecord,
    text: string,
    meta: TelegramRequestMeta,
  ): Promise<TelegramBotReply> {
    const collectionId = this.requiredString(session.data.collectionId, 'Sesi jimpitan tidak valid.');
    const houseId = this.requiredString(session.data.houseId, 'Rumah tidak valid.');
    const beforeSaveChecklist = await this.jimpitanService.getChecklist(context.principal, collectionId);
    if (beforeSaveChecklist.houses.some((house) => house.houseId === houseId && house.item)) {
      return { chatId, text: 'Rumah ini sudah tercatat untuk sesi ini. Pilih rumah lain.' };
    }
    await this.jimpitanService.upsertCollectionItems(
      context.principal,
      collectionId,
      {
        items: [
          {
            houseId,
            residentId: typeof session.data.residentId === 'string' ? session.data.residentId : null,
            amount: this.requiredString(session.data.amount, 'Nominal tidak valid.'),
            status: this.requiredString(session.data.status, 'Status tidak valid.') as never,
            note: text.trim() === '-' ? null : text.trim(),
          },
        ],
      },
      meta,
    );
    const checklist = await this.jimpitanService.getChecklist(context.principal, collectionId);
    const remaining = checklist.houses.filter((house) => !house.item).map((house) => house.houseId);
    if (remaining.length === 0) {
      await this.repository.clearSession(context.rtId, account.id, context.userId);
      return { chatId, text: 'Input jimpitan tersimpan. Semua rumah sudah tercatat.' };
    }
    await this.repository.saveSession(context.rtId, account.id, context.userId, {
      state: 'JIMPITAN_SELECT_HOUSE',
      data: { collectionId, houseIds: remaining },
      updatedAt: new Date().toISOString(),
    });
    return { chatId, text: `Input jimpitan tersimpan.\n${this.houseSelectionText(checklist.houses.filter((house) => !house.item))}` };
  }

  private async jimpitanSummaryReply(chatId: string, context: TelegramResolvedContext): Promise<TelegramBotReply> {
    this.assertAnyPermission(context.principal, ['collections.read', 'collections.update_own', 'collections.submit_own']);
    const result = await this.jimpitanService.listMyMobileCollections(context.principal, { page: 1, limit: 1, sortBy: 'collectionDate', sortDirection: 'desc' });
    if (result.items.length === 0) {
      return { chatId, text: 'Belum ada sesi jimpitan untuk direkap.' };
    }
    const summary = await this.jimpitanService.getSummary(context.principal, result.items[0].id);
    if (summary.collectionMode === 'BULK_TOTAL') {
      return { chatId, text: `Rekap jimpitan BULK_TOTAL: Rp ${this.formatAmount(summary.totalCollected)}\nTidak memakai daftar rumah per sesi.` };
    }
    return { chatId, text: `Rekap jimpitan: Rp ${this.formatAmount(summary.totalCollected)}\nRumah selesai: ${summary.completedHouses}/${summary.totalHouses}\nOutstanding: ${summary.outstandingHouses}` };
  }

  private async startFinanceFlow(chatId: string, account: TelegramAccountRecord, context: TelegramResolvedContext, type: 'INCOME' | 'EXPENSE'): Promise<TelegramBotReply> {
    this.assertAnyPermission(context.principal, ['transactions.create']);
    const [cashAccount, categories] = await Promise.all([
      this.cashAccountsService.getDefaultCashAccount(context.principal),
      this.categoryService.listCategories(context.principal, { page: 1, limit: 10, type }),
    ]);
    if (categories.items.length === 0) {
      return { chatId, text: `Kategori ${type} aktif belum tersedia.` };
    }
    await this.repository.saveSession(context.rtId, account.id, context.userId, {
      state: 'FINANCE_SELECT_CATEGORY',
      data: { type, cashAccountId: cashAccount.id, categoryIds: categories.items.map((item) => item.id), flowId: this.flowId(account.id) },
      updatedAt: new Date().toISOString(),
    });
    return { chatId, text: `Pilih kategori:\n${categories.items.map((item, index) => `${index + 1}. ${item.name}`).join('\n')}` };
  }

  private async selectFinanceCategory(
    chatId: string,
    account: TelegramAccountRecord,
    context: TelegramResolvedContext,
    session: TelegramSessionRecord,
    text: string,
  ): Promise<TelegramBotReply> {
    const categoryId = this.pickByIndex(this.stringArray(session.data.categoryIds), text);
    await this.repository.saveSession(context.rtId, account.id, context.userId, {
      state: 'FINANCE_AMOUNT',
      data: { ...session.data, categoryId },
      updatedAt: new Date().toISOString(),
    });
    return { chatId, text: 'Masukkan nominal sebagai bilangan bulat rupiah.' };
  }

  private async captureFinanceAmount(
    chatId: string,
    account: TelegramAccountRecord,
    context: TelegramResolvedContext,
    session: TelegramSessionRecord,
    text: string,
  ): Promise<TelegramBotReply> {
    this.assertIntegerMoney(text.trim());
    if (text.trim() === '0') {
      throw new BadRequestException('Nominal harus lebih dari 0.');
    }
    await this.repository.saveSession(context.rtId, account.id, context.userId, {
      state: 'FINANCE_DESCRIPTION',
      data: { ...session.data, amount: text.trim() },
      updatedAt: new Date().toISOString(),
    });
    return { chatId, text: 'Masukkan deskripsi transaksi.' };
  }

  private async saveFinanceDraft(
    chatId: string,
    account: TelegramAccountRecord,
    context: TelegramResolvedContext,
    session: TelegramSessionRecord,
    text: string,
    meta: TelegramRequestMeta,
  ): Promise<TelegramBotReply> {
    const type = this.requiredString(session.data.type, 'Jenis transaksi tidak valid.') as 'INCOME' | 'EXPENSE';
    const command = {
      cashAccountId: this.requiredString(session.data.cashAccountId, 'Kas tidak valid.'),
      categoryId: this.requiredString(session.data.categoryId, 'Kategori tidak valid.'),
      amount: this.requiredString(session.data.amount, 'Nominal tidak valid.'),
      description: text.trim(),
      transactionDate: new Date().toISOString().slice(0, 10),
      idempotencyKey: `telegram:${account.id}:${this.requiredString(session.data.flowId, 'Flow tidak valid.')}:finance`,
    };
    const transaction =
      type === 'INCOME'
        ? await this.transactionService.createIncomeDraft(context.principal, command, meta)
        : await this.transactionService.createExpenseDraft(context.principal, command, meta);
    await this.repository.clearSession(context.rtId, account.id, context.userId);
    return { chatId, text: `Draft ${type === 'INCOME' ? 'pemasukan' : 'pengeluaran'} tersimpan: Rp ${this.formatAmount(transaction.amount)}.` };
  }

  private async startApprovalFlow(chatId: string, account: TelegramAccountRecord, context: TelegramResolvedContext): Promise<TelegramBotReply> {
    this.assertAnyPermission(context.principal, ['approvals.decide']);
    const queue = await this.approvalsService.listApprovalQueue(context.principal, { page: 1, limit: 10, status: 'PENDING' as never });
    if (queue.items.length === 0) {
      return { chatId, text: 'Tidak ada approval pending.' };
    }
    await this.repository.saveSession(context.rtId, account.id, context.userId, {
      state: 'APPROVAL_ACTION',
      data: { approvalIds: queue.items.map((item) => item.id) },
      updatedAt: new Date().toISOString(),
    });
    return {
      chatId,
      text: `Approval pending:\n${queue.items.map((item, index) => `${index + 1}. ${item.transactionId} Rp ${this.formatAmount(item.transaction.amount)}`).join('\n')}\nBalas: approve <nomor> atau reject <nomor> <alasan>.`,
    };
  }

  private async decideApproval(chatId: string, context: TelegramResolvedContext, session: TelegramSessionRecord, text: string, meta: TelegramRequestMeta): Promise<TelegramBotReply> {
    this.assertAnyPermission(context.principal, ['approvals.decide']);
    const [action, indexText, ...reasonParts] = text.trim().split(/\s+/);
    const approvalId = this.pickByIndex(this.stringArray(session.data.approvalIds), indexText);
    try {
      if (action?.toLowerCase() === 'approve') {
        await this.approvalsService.approve(context.principal, approvalId, { decisionNote: reasonParts.join(' ') || undefined }, meta);
        return { chatId, text: 'Approval disetujui.' };
      }
      if (action?.toLowerCase() === 'reject') {
        await this.approvalsService.reject(context.principal, approvalId, { decisionNote: reasonParts.join(' ') || 'Ditolak via Telegram' }, meta);
        return { chatId, text: 'Approval ditolak.' };
      }
      throw new BadRequestException('Format approval tidak valid.');
    } catch (error) {
      if (this.errorMessage(error).toLowerCase().includes('finalized')) {
        return { chatId, text: 'Approval sudah diproses sebelumnya.' };
      }
      throw error;
    }
  }

  private assertWebhookSecret(actualSecret?: string): void {
    const expectedSecret = this.configService.get<string>('telegram.webhookSecret');
    if (!expectedSecret) {
      return;
    }
    const actualHash = createHash('sha256').update(actualSecret ?? '').digest();
    const expectedHash = createHash('sha256').update(expectedSecret).digest();
    if (!timingSafeEqual(actualHash, expectedHash)) {
      throw new UnauthorizedException('Invalid Telegram webhook secret.');
    }
  }

  private assertCanCreateBindingCode(actor: AuthPrincipal, command: CreateTelegramBindCodeCommand): void {
    if (this.can(actor, 'telegram.manage')) {
      return;
    }
    if (!this.can(actor, 'telegram.bind')) {
      throw new ForbiddenException('Akses ditolak untuk membuat kode bind Telegram.');
    }
    const targetsAnotherUser = command.userId !== undefined && command.userId !== actor.userId;
    const targetsAnotherMembership = command.membershipId !== undefined && command.membershipId !== actor.membershipId;
    if (targetsAnotherUser || targetsAnotherMembership || command.residentId) {
      throw new ForbiddenException('Kode bind pribadi hanya boleh dibuat untuk akun sendiri.');
    }
  }

  private parseUpdate(payload: unknown): TelegramInboundUpdate {
    const raw = payload as Record<string, any>;
    if (!raw || raw.update_id === undefined || !/^\d+$/.test(String(raw.update_id))) {
      throw new BadRequestException('Telegram update_id is required.');
    }
    const message = raw.message ?? raw.edited_message ?? raw.callback_query?.message ?? null;
    const from = raw.message?.from ?? raw.edited_message?.from ?? raw.callback_query?.from ?? null;
    const chat = message?.chat ?? null;
    const text = raw.message?.text ?? raw.edited_message?.text ?? null;
    const callbackData = raw.callback_query?.data ?? null;
    const updateType = raw.callback_query ? 'callback_query' : raw.edited_message ? 'edited_message' : raw.message ? 'message' : 'unknown';
    return {
      updateId: String(raw.update_id),
      updateType,
      chatId: chat?.id !== undefined ? String(chat.id) : null,
      text: typeof text === 'string' ? text : null,
      callbackData: typeof callbackData === 'string' ? callbackData : null,
      profile: from?.id !== undefined ? { telegramUserId: String(from.id), username: from.username ?? null, displayName: [from.first_name, from.last_name].filter(Boolean).join(' ') || null } : null,
      raw: this.sanitizeRawPayload(payload),
    };
  }

  private sanitizeRawPayload(payload: unknown): unknown {
    const clone = JSON.parse(JSON.stringify(payload)) as Record<string, any>;
    for (const key of ['message', 'edited_message']) {
      if (typeof clone?.[key]?.text === 'string' && this.isSensitiveCommand(clone[key].text)) {
        clone[key].text = '/bind [REDACTED]';
      }
    }
    if (typeof clone?.callback_query?.data === 'string' && this.isSensitiveCommand(clone.callback_query.data)) {
      clone.callback_query.data = '/bind [REDACTED]';
    }
    return clone;
  }

  private isSensitiveCommand(text: string): boolean {
    return /^\/bind(?:@\w+)?(?:\s|$)/i.test(text.trim());
  }

  private parseCommand(text: string): CommandParts {
    const normalized = text.trim();
    if (!normalized.startsWith('/')) {
      return { command: null, args: [], text: normalized };
    }
    const [rawCommand, ...args] = normalized.split(/\s+/);
    return { command: rawCommand.split('@')[0].toLowerCase(), args, text: normalized };
  }

  private toResolvedContext(context: TelegramContextRecord): TelegramResolvedContext {
    return {
      ...context,
      principal: {
        userId: context.userId,
        membershipId: context.membershipId,
        rtId: context.rtId,
        roles: context.roles,
        permissions: context.permissions,
      },
    };
  }

  private assertAnyPermission(principal: AuthPrincipal, permissions: PermissionKey[]): void {
    if (principal.roles.includes('SUPER_ADMIN') || permissions.some((permission) => principal.permissions.includes(permission))) {
      return;
    }
    throw new ForbiddenException('Akses ditolak untuk perintah ini.');
  }

  private findContextByCode(contexts: TelegramContextRecord[], rtCode: string): TelegramContextRecord | null {
    return contexts.find((context) => context.rtCode.toLowerCase() === rtCode.toLowerCase() || context.rtId === rtCode) ?? null;
  }

  private contextSelectionText(contexts: TelegramContextRecord[]): string {
    return `Pilih RT dengan perintah:\n${contexts.map((context) => `/menu ${context.rtCode} - ${context.rtName}`).join('\n')}`;
  }

  private menuText(context: TelegramResolvedContext): string {
    const commands = ['/menu', '/help', '/cancel'];
    if (this.can(context.principal, 'collections.read')) commands.push('/jadwal', '/rekap_jimpitan');
    if (this.can(context.principal, 'collections.update_own') || this.can(context.principal, 'collections.submit_own')) commands.push('/input_jimpitan');
    if (this.can(context.principal, 'transactions.read')) commands.push('/saldo');
    if (this.can(context.principal, 'transactions.create')) commands.push('/input_pemasukan', '/input_pengeluaran');
    if (this.can(context.principal, 'approvals.decide')) commands.push('/approval');
    return `Menu ${context.rtName}:\n${commands.join('\n')}`;
  }

  private helpText(): string {
    return 'Perintah: /start, /bind <kode>, /menu, /saldo, /jadwal, /input_jimpitan, /rekap_jimpitan, /input_pemasukan, /input_pengeluaran, /approval, /cancel.';
  }

  private can(principal: AuthPrincipal, permission: PermissionKey): boolean {
    return principal.roles.includes('SUPER_ADMIN') || principal.permissions.includes(permission);
  }

  private houseSelectionText(houses: Array<{ houseId: string; houseNumber: string; primaryResident: { fullName: string; defaultJimpitanAmount: string } | null }>): string {
    return `Pilih rumah:\n${houses.map((house, index) => `${index + 1}. ${house.houseNumber} ${house.primaryResident?.fullName ?? '-'} default ${house.primaryResident?.defaultJimpitanAmount ?? '0'}`).join('\n')}`;
  }

  private pickByIndex(values: string[], text: string): string {
    const index = Number(text.trim());
    if (!Number.isInteger(index) || index < 1 || index > values.length) {
      throw new BadRequestException('Pilihan tidak valid.');
    }
    return values[index - 1];
  }

  private stringArray(value: unknown): string[] {
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
  }

  private requiredString(value: unknown, message: string): string {
    if (typeof value !== 'string' || value.length === 0) {
      throw new BadRequestException(message);
    }
    return value;
  }

  private assertIntegerMoney(value: string): void {
    if (!MONEY_PATTERN.test(value)) {
      throw new BadRequestException('Nominal harus bilangan bulat rupiah.');
    }
  }

  private assertPositiveIntegerMoney(value: string): void {
    this.assertIntegerMoney(value);
    if (value === '0') {
      throw new BadRequestException('Total jimpitan harus lebih dari 0.');
    }
  }

  private isSessionExpired(session: TelegramSessionRecord): boolean {
    if (!session.updatedAt) {
      return false;
    }
    return Date.now() - new Date(session.updatedAt).getTime() > TELEGRAM_SESSION_TTL_MINUTES * 60_000;
  }

  private hashCode(code: string): string {
    return createHash('sha256').update(code.trim()).digest('hex');
  }

  private flowId(accountId: string): string {
    return createHash('sha256').update(`${accountId}:${Date.now()}:${randomBytes(6).toString('hex')}`).digest('hex').slice(0, 24);
  }

  private formatAmount(value: string): string {
    return Number(value).toLocaleString('id-ID', { maximumFractionDigits: 0 });
  }

  private dateOnly(value: Date): string {
    return value.toISOString().slice(0, 10);
  }

  private formatNotification(title: string, body: string): string {
    return `${title}\n${body}`;
  }

  private async safeSendMessage(message: TelegramBotReply) {
    try {
      return await this.sender.sendMessage(message);
    } catch (error) {
      return { ok: false, errorMessage: this.errorMessage(error) };
    }
  }

  private errorMessage(error: unknown): string {
    if (error instanceof ForbiddenException || error instanceof BadRequestException || error instanceof UnauthorizedException) {
      const response = error.getResponse();
      return typeof response === 'object' && response && 'message' in response ? String((response as { message: unknown }).message) : error.message;
    }
    return error instanceof Error ? error.message : 'Terjadi kesalahan saat memproses perintah.';
  }
}
