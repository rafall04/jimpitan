/**
 * Purpose: E2E DB-level assertion that the ledger-integrity migration (20260622120000) is actually active.
 * Caller: Playwright, against the migrated E2E database (migrate deploy, not db push).
 * Deps: Prisma client, the seeded E2E fixture state file, and the cash_ledgers trigger + CHECK constraints.
 * MainFuncs: Inserts a valid cash_ledger row, then asserts UPDATE/DELETE are blocked by the append-only trigger and a non-positive amount is blocked by the CHECK.
 * SideEffects: Writes one cash account + transaction + ledger row in the fixture RT (cleaned up by global teardown, which bypasses the trigger).
 */
import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'node:fs';
import { stateFilePath } from './support/env';

type E2EState = {
  fixture: { rtId: string; cashAccountId: string; incomeCategoryId: string; bendaharaUserId: string };
};

async function isRejected(operation: Promise<unknown>, pattern: RegExp): Promise<boolean> {
  try {
    await operation;
    return false;
  } catch (error) {
    return pattern.test(String((error as { message?: string })?.message ?? error));
  }
}

test.describe('ledger integrity guards (database-level)', () => {
  test('append-only trigger and amount CHECK reject bad ledger writes', async () => {
    const { fixture } = JSON.parse(readFileSync(stateFilePath(), 'utf8')) as E2EState;
    const prisma = new PrismaClient();

    try {
      // Dedicated account so the ledger sequence is independent of journey-created rows.
      const account = await prisma.cashAccount.create({
        data: { rtId: fixture.rtId, key: `guard-${Date.now()}`, name: 'Ledger Guard Kas', currency: 'IDR', createdById: fixture.bendaharaUserId },
      });
      const makeTxn = () =>
        prisma.transaction.create({
          data: {
            rtId: fixture.rtId,
            cashAccountId: account.id,
            categoryId: fixture.incomeCategoryId,
            type: 'INCOME',
            amount: '10000',
            description: 'ledger-guard-test',
            transactionDate: new Date('2030-01-01'),
            createdById: fixture.bendaharaUserId,
          },
        });
      const [txnA, txnB] = await Promise.all([makeTxn(), makeTxn()]);

      const ledger = await prisma.cashLedger.create({
        data: {
          rtId: fixture.rtId, cashAccountId: account.id, transactionId: txnA.id,
          ledgerSequence: 1, entryType: 'INCREASE',
          amount: '10000', balanceBefore: '0', balanceAfter: '10000', ledgerDate: new Date(),
        },
      });

      // Append-only trigger: UPDATE and DELETE must be rejected.
      expect(await isRejected(prisma.cashLedger.update({ where: { id: ledger.id }, data: { amount: '20000' } }), /append-only|not permitted/i)).toBe(true);
      expect(await isRejected(prisma.cashLedger.delete({ where: { id: ledger.id } }), /append-only|not permitted/i)).toBe(true);

      // CHECK: a non-positive amount must be rejected (math holds, balance stays >= 0 to isolate the amount check).
      expect(
        await isRejected(
          prisma.cashLedger.create({
            data: {
              rtId: fixture.rtId, cashAccountId: account.id, transactionId: txnB.id,
              ledgerSequence: 2, entryType: 'INCREASE',
              amount: '-1', balanceBefore: '5', balanceAfter: '4', ledgerDate: new Date(),
            },
          }),
          /amount_positive|check/i,
        ),
      ).toBe(true);
    } finally {
      await prisma.$disconnect();
    }
  });
});
