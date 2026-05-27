/**
 * Purpose: House and area response/domain types for physical RT structure management.
 * Caller: Houses and areas services, controllers, and repository contracts.
 * Deps: Prisma enum types.
 * MainFuncs: Defines safe tenant-scoped area and house shapes without audit internals.
 * SideEffects: None.
 */
import type { HouseStatus } from '@prisma/client';

export type AreaRecord = {
  id: string;
  rtId: string;
  code: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type AreaSummary = {
  id: string;
  code: string;
  name: string;
  sortOrder: number;
};

export type HouseRecord = {
  id: string;
  rtId: string;
  areaId: string;
  houseNumber: string;
  addressNote: string | null;
  status: HouseStatus;
  area: AreaSummary;
  activeResidentCount: number;
  createdAt: Date;
  updatedAt: Date;
};
