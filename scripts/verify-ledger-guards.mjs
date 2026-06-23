/**
 * Purpose: Runtime verification that the ledger-integrity migration's database guards actually reject bad operations.
 * Caller: `node scripts/verify-ledger-guards.mjs` (or `npm run verify:ledger`) against a disposable Postgres that has migrations applied.
 * Deps: Generated Prisma client and a Postgres reachable via DATABASE_URL after `prisma migrate deploy`.
 * MainFuncs: Seeds a minimal RT/user/account/category/transaction chain, then asserts the append-only trigger and CHECK constraints from migration 20260622120000_ledger_integrity_guards.
 * SideEffects: Writes seed rows (including one ledger row the append-only trigger then refuses to delete) — run ONLY against a throwaway database.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const tag = `LEDGER-VERIFY-${Date.now()}`;
const results = [];

function record(label, pass, note) {
  results.push({ label, pass, note });
}

async function expectOk(label, fn) {
  try {
    await fn();
    record(label, true, 'accepted');
  } catch (error) {
    record(label, false, `UNEXPECTED rejection: ${String(error?.message ?? error).slice(0, 160)}`);
  }
}

async function expectReject(label, pattern, fn) {
  try {
    await fn();
    record(label, false, 'NOT REJECTED — guard did not fire!');
  } catch (error) {
    const msg = String(error?.message ?? error);
    const ok = pattern.test(msg);
    record(label, ok, ok ? 'rejected' : `rejected, but message did not match /${pattern.source}/: ${msg.slice(0, 160)}`);
  }
}

async function main() {
  // --- seed a minimal FK chain (Prisma fills id/timestamps/defaults) ---
  const rt = await prisma.rt.create({ data: { name: 'Ledger Verify RT', code: tag } });
  const user = await prisma.user.create({ data: { fullName: 'Ledger Verify User' } });
  const account = await prisma.cashAccount.create({ data: { rtId: rt.id, name: 'Verify Kas', currentBalance: '0' } });
  const category = await prisma.transactionCategory.create({ data: { type: 'INCOME', key: `${tag}-cat`, name: 'Verify Income' } });

  const makeTxn = (n) =>
    prisma.transaction.create({
      data: {
        rtId: rt.id,
        cashAccountId: account.id,
        categoryId: category.id,
        type: 'INCOME',
        amount: '10000',
        description: `verify-${n}`,
        transactionDate: new Date('2030-01-01'),
        createdById: user.id,
      },
    });
  const [t0, t1, t2, t3] = await Promise.all([makeTxn(0), makeTxn(1), makeTxn(2), makeTxn(3)]);

  // --- A. a correct ledger row must be accepted ---
  let ledgerId;
  await expectOk('valid ledger insert', async () => {
    const row = await prisma.cashLedger.create({
      data: {
        rtId: rt.id, cashAccountId: account.id, transactionId: t0.id,
        ledgerSequence: 1, entryType: 'INCREASE',
        amount: '10000', balanceBefore: '0', balanceAfter: '10000', ledgerDate: new Date(),
      },
    });
    ledgerId = row.id;
  });

  // --- B/C. append-only trigger blocks UPDATE and DELETE ---
  await expectReject('append-only blocks UPDATE', /append-only|not permitted/i, () =>
    prisma.cashLedger.update({ where: { id: ledgerId }, data: { amount: '20000' } }),
  );
  await expectReject('append-only blocks DELETE', /append-only|not permitted/i, () =>
    prisma.cashLedger.delete({ where: { id: ledgerId } }),
  );

  // --- D. CHECK amount > 0 (isolated: math holds, balance stays >= 0) ---
  await expectReject('CHECK amount > 0', /amount_positive|check/i, () =>
    prisma.cashLedger.create({
      data: {
        rtId: rt.id, cashAccountId: account.id, transactionId: t1.id,
        ledgerSequence: 2, entryType: 'INCREASE',
        amount: '-1', balanceBefore: '5', balanceAfter: '4', ledgerDate: new Date(),
      },
    }),
  );

  // --- E. CHECK balance arithmetic self-consistency (0 + 100 != 999) ---
  await expectReject('CHECK balance math', /balance_math|check/i, () =>
    prisma.cashLedger.create({
      data: {
        rtId: rt.id, cashAccountId: account.id, transactionId: t2.id,
        ledgerSequence: 3, entryType: 'INCREASE',
        amount: '100', balanceBefore: '0', balanceAfter: '999', ledgerDate: new Date(),
      },
    }),
  );

  // --- F. CHECK balance_after >= 0 (isolated: math holds, amount > 0) ---
  await expectReject('CHECK balance_after >= 0', /balance_after_non_negative|check/i, () =>
    prisma.cashLedger.create({
      data: {
        rtId: rt.id, cashAccountId: account.id, transactionId: t3.id,
        ledgerSequence: 4, entryType: 'DECREASE',
        amount: '100', balanceBefore: '50', balanceAfter: '-50', ledgerDate: new Date(),
      },
    }),
  );

  // --- G. CHECK cash_accounts.current_balance >= 0 ---
  await expectReject('CHECK current_balance >= 0', /current_balance_non_negative|check/i, () =>
    prisma.cashAccount.update({ where: { id: account.id }, data: { currentBalance: '-1' } }),
  );
}

main()
  .catch((error) => {
    record('script execution', false, `fatal: ${String(error?.message ?? error).slice(0, 200)}`);
  })
  .finally(async () => {
    await prisma.$disconnect();
    const failed = results.filter((r) => !r.pass).length;
    console.log('\nLedger-integrity guard verification (migration 20260622120000)');
    console.log('='.repeat(64));
    for (const r of results) {
      console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.label.padEnd(30)} ${r.note}`);
    }
    console.log('='.repeat(64));
    console.log(`${results.length - failed}/${results.length} checks passed`);
    console.log('\nNote: seed rows (incl. the test ledger entry) are intentionally left behind —');
    console.log('the append-only trigger refuses to delete the ledger row by design. Use a disposable DB.');
    process.exit(failed > 0 ? 1 : 0);
  });
