/**
 * Purpose: Zod schemas and payload mappers for Jimpitan operational forms.
 * Caller: Jimpitan pages, mobile collection flow, API tests, and mutation handlers.
 * Deps: Zod and Jimpitan contract types.
 * MainFuncs: Validates session creation, collection mode contract fields, item input, lifecycle notes, and query serialization.
 * SideEffects: None.
 */
import { z } from 'zod';
import { collectionModes } from './types';
import type { CollectionItemPayload, CollectionListParams, CreateCollectionPayload, SetBulkCollectionTotalPayload } from './types';

const uuidV4Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const uuidV4 = z.string().regex(uuidV4Pattern, 'Use a valid UUID v4.');
const amountPattern = /^\d+(\.\d{1,2})?$/;
const integerCurrencyPattern = /^[1-9]\d{0,11}$/;

export const collectionItemStatuses = ['PAID', 'UNPAID', 'HOUSE_EMPTY', 'TITIP_TETANGGA', 'MENUNGGAK', 'DISPENSATION'] as const;

export const createCollectionSchema = z
  .object({
    officerMembershipId: uuidV4,
    collectionDate: z.string().min(1, 'Collection date is required.'),
    collectionMode: z.enum(collectionModes).optional(),
    totalAmount: z.string().trim().optional(),
    areaId: z.string().trim(),
    note: z.string().trim().max(1000, 'Note is too long.'),
  })
  .superRefine((values, context) => {
    if (values.collectionMode === 'HYBRID') {
      context.addIssue({ code: 'custom', path: ['collectionMode'], message: 'Hybrid mode is not available yet.' });
    }
    if (values.totalAmount && !integerCurrencyPattern.test(values.totalAmount)) {
      context.addIssue({ code: 'custom', path: ['totalAmount'], message: 'Use a positive whole-rupiah amount.' });
    }
    if ((values.collectionMode ?? 'PER_HOUSE') === 'PER_HOUSE' && values.totalAmount) {
      context.addIssue({ code: 'custom', path: ['totalAmount'], message: 'Per-house totals are calculated from house items.' });
    }
  });

export const collectionItemFormSchema = z
  .object({
    houseId: uuidV4,
    residentId: z.string().trim(),
    amount: z.string().trim(),
    status: z.enum(collectionItemStatuses),
    note: z.string().trim().max(1000, 'Note is too long.'),
  })
  .superRefine((value, context) => {
    const hasAmount = value.amount.length > 0;
    if (hasAmount && !amountPattern.test(value.amount)) {
      context.addIssue({ code: 'custom', path: ['amount'], message: 'Use a valid amount with up to two decimals.' });
      return;
    }
    const numberValue = hasAmount ? Number(value.amount) : 0;
    if (value.status === 'PAID' && numberValue <= 0) {
      context.addIssue({ code: 'custom', path: ['amount'], message: 'Paid collection requires an amount greater than zero.' });
    }
    if (value.status !== 'PAID' && numberValue > 0) {
      context.addIssue({ code: 'custom', path: ['amount'], message: 'Only paid items can carry an amount.' });
    }
    if (value.residentId.length > 0 && !uuidV4.safeParse(value.residentId).success) {
      context.addIssue({ code: 'custom', path: ['residentId'], message: 'Resident must be a valid UUID v4.' });
    }
  });

export const noteSchema = z.string().trim().max(1000, 'Note is too long.');
export const requiredReasonSchema = z.string().trim().min(2, 'Reason is required.').max(1000, 'Reason is too long.');
export const bulkTotalSchema = z.object({
  totalAmount: z.string().trim().regex(integerCurrencyPattern, 'Use a positive whole-rupiah amount.'),
  note: z.string().trim().max(1000, 'Note is too long.'),
});

export type CreateCollectionValues = z.infer<typeof createCollectionSchema>;
export type CollectionItemFormValues = z.infer<typeof collectionItemFormSchema>;
export type BulkTotalValues = z.infer<typeof bulkTotalSchema>;

export function toCreateCollectionPayload(values: CreateCollectionValues): CreateCollectionPayload {
  return {
    officerMembershipId: values.officerMembershipId,
    collectionDate: values.collectionDate,
    collectionMode: values.collectionMode ?? 'PER_HOUSE',
    totalAmount: emptyToUndefined(values.totalAmount ?? ''),
    areaId: emptyToUndefined(values.areaId),
    note: emptyToUndefined(values.note),
  };
}

export function toBulkTotalPayload(values: BulkTotalValues): SetBulkCollectionTotalPayload {
  return {
    totalAmount: values.totalAmount.trim(),
    note: emptyToNull(values.note),
  };
}

export function toCollectionItemPayload(values: CollectionItemFormValues): CollectionItemPayload {
  const status = values.status;
  return {
    houseId: values.houseId,
    residentId: emptyToNull(values.residentId),
    amount: status === 'PAID' ? values.amount.trim() : '0',
    status,
    note: emptyToUndefined(values.note),
  };
}

export function buildJimpitanQuery(params: CollectionListParams | Record<string, unknown>): string {
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

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
