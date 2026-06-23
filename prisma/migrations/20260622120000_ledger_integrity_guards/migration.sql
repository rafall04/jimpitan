-- Ledger integrity guards (defense-in-depth for the non-negotiable "ledger integrity" invariant).
--
-- These rules previously lived ONLY in application code (PrismaFinanceRepository):
-- append-only cash_ledgers, positive amounts, non-negative balances, and self-consistent
-- balance arithmetic. This migration gives them database-level teeth so a bug, a raw query,
-- or a future maintainer cannot violate them without deliberately disabling the guards.
--
-- NOTE: CHECK constraints and triggers cannot be expressed in schema.prisma, so they live only
-- in this migration. `prisma migrate dev` will NOT drop them (Prisma only manages schema objects),
-- but the E2E flow uses `prisma db push` (schema-only) and therefore will not have them.
-- See docs/database/prisma-schema-notes.md.
--
-- Emergency operator override for the append-only trigger (deliberate, audit-worthy; prefer a
-- compensating ledger entry instead):  ALTER TABLE "cash_ledgers" DISABLE TRIGGER USER;

-- 1) Positive amounts. Income and expense both store a positive magnitude; the sign is carried by
--    entry_type, so a non-positive amount is always a bug. (App: assertPositiveAmount.)
ALTER TABLE "transactions"
  ADD CONSTRAINT "transactions_amount_positive" CHECK ("amount" > 0);

ALTER TABLE "cash_ledgers"
  ADD CONSTRAINT "cash_ledgers_amount_positive" CHECK ("amount" > 0);

-- 2) Balances never go negative. The app raises "insufficient funds" before writing; mirror it.
ALTER TABLE "cash_ledgers"
  ADD CONSTRAINT "cash_ledgers_balance_after_non_negative" CHECK ("balance_after" >= 0);

ALTER TABLE "cash_accounts"
  ADD CONSTRAINT "cash_accounts_current_balance_non_negative" CHECK ("current_balance" >= 0);

-- 3) Ledger arithmetic must be self-consistent:
--    balance_after = balance_before + amount  (entry_type = INCREASE)
--    balance_after = balance_before - amount  (entry_type = DECREASE)
--    DECIMAL(14,2) is exact, so equality is safe. (App: appendLedgerForTransaction.)
ALTER TABLE "cash_ledgers"
  ADD CONSTRAINT "cash_ledgers_balance_math" CHECK (
    "balance_after" = "balance_before" + (CASE "entry_type" WHEN 'INCREASE' THEN "amount" ELSE -"amount" END)
  );

-- 4) Append-only: cash_ledgers rows may be INSERTed but never UPDATEd or DELETEd.
CREATE OR REPLACE FUNCTION "jimpitan_cash_ledgers_append_only"()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'cash_ledgers is append-only; % is not permitted', TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "cash_ledgers_block_update"
  BEFORE UPDATE ON "cash_ledgers"
  FOR EACH ROW EXECUTE FUNCTION "jimpitan_cash_ledgers_append_only"();

CREATE TRIGGER "cash_ledgers_block_delete"
  BEFORE DELETE ON "cash_ledgers"
  FOR EACH ROW EXECUTE FUNCTION "jimpitan_cash_ledgers_append_only"();
