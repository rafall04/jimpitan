/**
 * Purpose: Telegram Bot API sender adapter for replies and notification outbox messages.
 * Caller: TelegramModule provider binding and TelegramService.
 * Deps: Nest ConfigService and global fetch.
 * MainFuncs: Sends Telegram sendMessage requests without command-handler state.
 * SideEffects: Performs outbound HTTPS requests to Telegram Bot API when invoked.
 */
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { TelegramSendMessage, TelegramSendResult, TelegramSenderPort } from './telegram-sender.port';

@Injectable()
export class FetchTelegramSender implements TelegramSenderPort {
  constructor(private readonly configService: ConfigService) {}

  async sendMessage(message: TelegramSendMessage): Promise<TelegramSendResult> {
    const token = this.configService.get<string>('telegram.botToken');
    if (!token) {
      return { ok: false, errorMessage: 'Telegram bot token is not configured.' };
    }

    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: message.chatId,
        text: message.text,
        disable_web_page_preview: true,
      }),
    });
    const payload = (await response.json().catch(() => ({}))) as { ok?: boolean; result?: { message_id?: number }; description?: string };
    if (!response.ok || !payload.ok) {
      return { ok: false, errorMessage: payload.description ?? `Telegram send failed with HTTP ${response.status}.` };
    }
    return { ok: true, providerMessageId: payload.result?.message_id ? String(payload.result.message_id) : undefined };
  }
}
