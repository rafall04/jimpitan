/**
 * Purpose: Resident response/domain types for tenant-scoped resident management.
 * Caller: ResidentsService, ResidentsController, and repository contracts.
 * Deps: Prisma enum types.
 * MainFuncs: Defines safe resident shapes with private notes limited to detail/mutation responses.
 * SideEffects: None.
 */
import type { HouseStatus, ResidentStatus } from '@prisma/client';

export type ResidentHouseSummary = {
  id: string;
  houseNumber: string;
  status: HouseStatus;
  area: {
    id: string;
    code: string;
    name: string;
  };
};

export type ResidentListRow = {
  id: string;
  rtId: string;
  houseId: string;
  fullName: string;
  phone: string | null;
  status: ResidentStatus;
  defaultJimpitanAmount: string;
  telegramAccountId: string | null;
  house: ResidentHouseSummary;
  createdAt: Date;
  updatedAt: Date;
};

export type ResidentRecord = ResidentListRow & {
  notes: string | null;
};

export type AssignableHouseRecord = {
  id: string;
  rtId: string;
  status: HouseStatus;
  deletedAt: Date | null;
};

export type TelegramAccountRecord = {
  id: string;
  revokedAt: Date | null;
};

export type TelegramBindingConflict = {
  id: string;
  residentId: string | null;
  userId: string | null;
  membershipId: string | null;
};
