/**
 * Purpose: Jimpitan collection domain and response types.
 * Caller: Jimpitan service, controller, repository contracts, and hook interfaces.
 * Deps: Prisma enum types.
 * MainFuncs: Defines safe mobile-friendly collection, mode, checklist, summary, and hook payload shapes.
 * SideEffects: None.
 */
import type { CollectionItemStatus, CollectionStatus, MembershipStatus } from '@prisma/client';
import type { CollectionMode } from './collection-mode.types';

export type CollectionRouteSummary = {
  areaId: string | null;
  areaCode: string | null;
  areaName: string | null;
};

export type CollectionOfficerSummary = {
  membershipId: string;
  userId: string;
  fullName: string;
};

export type CollectionSessionRecord = {
  id: string;
  rtId: string;
  scheduleId: string | null;
  officerMembershipId: string;
  collectionDate: Date;
  collectionMode: CollectionMode;
  status: CollectionStatus;
  note: string | null;
  totalAmount: string;
  submittedAt: Date | null;
  validatedAt: Date | null;
  rejectedAt: Date | null;
  cancelledAt: Date | null;
  validationNote: string | null;
  rejectionReason: string | null;
  cancellationReason: string | null;
  updatedAt: Date;
  officer: CollectionOfficerSummary;
  route: CollectionRouteSummary;
  itemCount: number;
};

export type OfficerMembershipRecord = {
  id: string;
  rtId: string;
  status: MembershipStatus;
};

export type CollectionAreaRecord = {
  id: string;
  rtId: string;
  isActive: boolean;
};

export type CollectionItemInputStatus = Extract<CollectionItemStatus, 'PAID' | 'UNPAID' | 'HOUSE_EMPTY' | 'TITIP_TETANGGA' | 'MENUNGGAK' | 'DISPENSATION'>;

export type CollectionItemRecord = {
  id: string;
  houseId: string;
  residentId: string | null;
  amount: string;
  status: CollectionItemStatus;
  note: string | null;
  updatedAt: Date;
};

export type CollectionChecklistHouse = {
  houseId: string;
  houseNumber: string;
  area: {
    id: string;
    code: string;
    name: string;
  };
  primaryResident: {
    id: string;
    fullName: string;
    defaultJimpitanAmount: string;
  } | null;
  item: CollectionItemRecord | null;
};

export type CollectionChecklist = {
  collection: CollectionSessionRecord;
  houses: CollectionChecklistHouse[];
};

export type CollectionAreaProgress = {
  areaId: string;
  areaCode: string;
  areaName: string;
  totalHouses: number;
  completedHouses: number;
  paidHouses: number;
  outstandingHouses: number;
  totalCollected: string;
};

export type CollectionSummary = {
  collectionId: string;
  collectionMode: CollectionMode;
  totalCollected: string;
  totalHouses: number;
  completedHouses: number;
  paidHouses: number;
  outstandingHouses: number;
  perArea: CollectionAreaProgress[];
};

export type OutstandingHouseRecord = CollectionChecklistHouse & {
  outstandingStatus: 'NO_INPUT' | CollectionItemStatus;
};

export type CollectionWorkflowEvent = {
  rtId: string;
  collectionId: string;
  collectionMode: CollectionMode;
  status: CollectionStatus;
  officerMembershipId?: string;
  actorUserId: string;
  correlationId?: string;
};
