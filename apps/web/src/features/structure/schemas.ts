/**
 * Purpose: Zod schemas and payload mappers for Residents/Houses/Areas UI forms and filters.
 * Caller: Structure forms, API tests, and query serializers.
 * Deps: Zod and structure contract types.
 * MainFuncs: Validates UI input, converts empty optional fields, and builds safe query strings.
 * SideEffects: None.
 */
import { z } from 'zod';
import type {
  AreaListParams,
  CreateAreaPayload,
  CreateHousePayload,
  CreateResidentPayload,
  HouseListParams,
  ResidentListParams,
  UpdateAreaPayload,
  UpdateHousePayload,
  UpdateResidentPayload,
} from './types';

const optionalPhonePattern = /^[0-9+()\-\s]{6,32}$/;
const optionalMoneyPattern = /^\d+(\.\d{1,2})?$/;
const uuidV4Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const uuidSchema = z.string().regex(uuidV4Pattern, 'Use a valid UUID v4.');

export const areaFormSchema = z.object({
  code: z.string().trim().min(1, 'Area code is required.').max(40, 'Area code is too long.'),
  name: z.string().trim().min(2, 'Area name is required.').max(120, 'Area name is too long.'),
  sortOrder: z.string().trim().regex(/^\d*$/, 'Sort order must be a whole number.'),
});

export const houseFormSchema = z.object({
  areaId: uuidSchema,
  houseNumber: z.string().trim().min(1, 'House number is required.').max(40, 'House number is too long.'),
  addressNote: z.string().trim().max(500, 'Address note is too long.'),
  status: z.enum(['EMPTY', 'OCCUPIED']),
});

export const residentFormSchema = z.object({
  houseId: uuidSchema,
  fullName: z.string().trim().min(2, 'Resident name is required.').max(160, 'Resident name is too long.'),
  phone: z.string().trim().refine((value) => value.length === 0 || optionalPhonePattern.test(value), 'Use a valid phone number.'),
  defaultJimpitanAmount: z.string().trim().refine((value) => value.length === 0 || optionalMoneyPattern.test(value), 'Use a valid amount with up to two decimals.'),
  notes: z.string().trim().max(1000, 'Notes are too long.'),
});

export type AreaFormValues = z.infer<typeof areaFormSchema>;
export type HouseFormValues = z.infer<typeof houseFormSchema>;
export type ResidentFormValues = z.infer<typeof residentFormSchema>;

export function toCreateAreaPayload(values: AreaFormValues): CreateAreaPayload {
  return {
    code: values.code.trim(),
    name: values.name.trim(),
    sortOrder: toOptionalNumber(values.sortOrder),
  };
}

export function toUpdateAreaPayload(values: AreaFormValues): UpdateAreaPayload {
  return toCreateAreaPayload(values);
}

export function toCreateHousePayload(values: HouseFormValues): CreateHousePayload {
  return {
    areaId: values.areaId,
    houseNumber: values.houseNumber.trim(),
    addressNote: emptyToUndefined(values.addressNote),
    status: values.status,
  };
}

export function toUpdateHousePayload(values: HouseFormValues): UpdateHousePayload {
  return {
    areaId: values.areaId,
    houseNumber: values.houseNumber.trim(),
    addressNote: emptyToNull(values.addressNote),
    status: values.status,
  };
}

export function toCreateResidentPayload(values: ResidentFormValues): CreateResidentPayload {
  return {
    houseId: values.houseId,
    fullName: values.fullName.trim(),
    phone: emptyToUndefined(values.phone),
    defaultJimpitanAmount: emptyToUndefined(values.defaultJimpitanAmount),
    notes: emptyToUndefined(values.notes),
  };
}

export function toUpdateResidentPayload(values: ResidentFormValues): UpdateResidentPayload {
  return {
    fullName: values.fullName.trim(),
    phone: emptyToNull(values.phone),
    defaultJimpitanAmount: emptyToUndefined(values.defaultJimpitanAmount),
    notes: emptyToNull(values.notes),
  };
}

export function buildStructureQuery(params: AreaListParams | HouseListParams | ResidentListParams): string {
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

function toOptionalNumber(value: string): number | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? Number(trimmed) : undefined;
}

function emptyToUndefined(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
