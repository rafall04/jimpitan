/**
 * Purpose: Zod schemas and payload mappers for finance, ledger, and approval forms.
 * Caller: Finance pages, approval pages, API tests, and mutation handlers.
 * Deps: Zod and finance contract types.
 * MainFuncs: Validates accounts, categories, transaction drafts, decision reasons, collection posting payloads, and query serialization.
 * SideEffects: None.
 */
import { z } from 'zod';
import type { AccountListParams, CategoryListParams, CreateCashAccountPayload, CreateCategoryPayload, CreateTransactionPayload, LedgerListParams, PostCollectionPayload, TransactionListParams } from './types';

const uuidV4Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const uuidV4 = z.string().regex(uuidV4Pattern, 'Use a valid UUID v4.');
const amountPattern = /^\d+(\.\d{1,2})?$/;
const keyPattern = /^[a-z0-9][a-z0-9_-]{1,78}[a-z0-9]$/;

export const accountSchema = z.object({
  key: z.string().trim().regex(keyPattern, 'Use lowercase letters, numbers, underscore, or dash.').optional().or(z.literal('')),
  name: z.string().trim().min(2, 'Name is required.').max(120, 'Name is too long.'),
  currency: z.string().trim().regex(/^[A-Z]{3}$/, 'Use a 3-letter currency code.').optional().or(z.literal('')),
});

export const categorySchema = z.object({
  type: z.enum(['INCOME', 'EXPENSE']),
  key: z.string().trim().regex(keyPattern, 'Use lowercase letters, numbers, underscore, or dash.'),
  name: z.string().trim().min(2, 'Name is required.').max(120, 'Name is too long.'),
});

export const transactionSchema = z
  .object({
    cashAccountId: uuidV4,
    categoryId: uuidV4,
    amount: z.string().trim(),
    description: z.string().trim().min(2, 'Description is required.').max(1000, 'Description is too long.'),
    transactionDate: z.string().min(1, 'Transaction date is required.'),
    referenceNumber: z.string().trim().max(80, 'Reference is too long.'),
  })
  .superRefine((value, context) => {
    if (!amountPattern.test(value.amount)) {
      context.addIssue({ code: 'custom', path: ['amount'], message: 'Use a valid amount with up to two decimals.' });
      return;
    }
    if (Number(value.amount) <= 0) {
      context.addIssue({ code: 'custom', path: ['amount'], message: 'Amount must be greater than zero.' });
    }
  });

export const optionalNoteSchema = z.string().trim().max(1000, 'Note is too long.');
export const decisionReasonSchema = z.string().trim().min(2, 'Reason is required.').max(1000, 'Reason is too long.');

export const collectionPostSchema = z.object({
  collectionId: uuidV4,
  cashAccountId: z.string().trim(),
  categoryId: z.string().trim(),
});

export type AccountValues = z.infer<typeof accountSchema>;
export type CategoryValues = z.infer<typeof categorySchema>;
export type TransactionValues = z.infer<typeof transactionSchema>;
export type CollectionPostValues = z.infer<typeof collectionPostSchema>;

export function toAccountPayload(values: AccountValues): CreateCashAccountPayload {
  return {
    key: emptyToUndefined(values.key ?? ''),
    name: values.name.trim(),
    currency: emptyToUndefined(values.currency ?? ''),
  };
}

export function toCategoryPayload(values: CategoryValues): CreateCategoryPayload {
  return {
    type: values.type,
    key: values.key.trim(),
    name: values.name.trim(),
  };
}

export function toTransactionPayload(values: TransactionValues, idempotencyKey = crypto.randomUUID()): CreateTransactionPayload {
  return {
    cashAccountId: values.cashAccountId,
    categoryId: values.categoryId,
    amount: values.amount.trim(),
    description: values.description.trim(),
    transactionDate: values.transactionDate,
    referenceNumber: emptyToUndefined(values.referenceNumber),
    idempotencyKey,
  };
}

export function toCollectionPostPayload(values: CollectionPostValues, idempotencyKey = crypto.randomUUID()): PostCollectionPayload {
  return {
    collectionId: values.collectionId,
    cashAccountId: emptyToUndefined(values.cashAccountId),
    categoryId: emptyToUndefined(values.categoryId),
    idempotencyKey,
  };
}

export function buildFinanceQuery(params: AccountListParams | CategoryListParams | TransactionListParams | LedgerListParams | Record<string, unknown>): string {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') {
      continue;
    }
    searchParams.set(key, String(value));
  }
  const query = searchParams.toString();
  return query ? `?${query}` : '';
}

function emptyToUndefined(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
