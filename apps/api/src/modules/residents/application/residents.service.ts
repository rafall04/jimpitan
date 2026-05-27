/**
 * Purpose: Application service for tenant-scoped resident management.
 * Caller: ResidentsController and unit tests.
 * Deps: Resident repository port, AuthPrincipal, Prisma house status enum, and resident command contracts.
 * MainFuncs: Enforces tenant scoping, house assignment safety, Telegram binding validation, and resident lifecycle rules.
 * SideEffects: Writes resident data and audit logs through the repository port.
 */
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { HouseStatus, ResidentStatus } from '@prisma/client';
import type { PaginatedResult } from '../../../common/types/paginated-result.type';
import type { AuthPrincipal } from '../../auth/domain/auth.types';
import { RESIDENTS_REPOSITORY } from '../residents.tokens';
import type { ResidentListRow, ResidentRecord } from '../domain/residents.types';
import type { CreateResidentCommand, MoveResidentCommand, ResidentListQuery, ResidentRequestMeta, UpdateResidentCommand } from './residents.commands';
import type { ResidentsRepositoryPort } from '../infrastructure/residents.repository.port';

@Injectable()
export class ResidentsService {
  constructor(@Inject(RESIDENTS_REPOSITORY) private readonly residentsRepository: ResidentsRepositoryPort) {}

  async listResidents(actor: AuthPrincipal, query: ResidentListQuery): Promise<PaginatedResult<ResidentListRow>> {
    return this.residentsRepository.listResidents(actor.rtId, query);
  }

  async getResident(actor: AuthPrincipal, residentId: string): Promise<ResidentRecord> {
    const resident = await this.residentsRepository.findResidentById(actor.rtId, residentId);
    if (!resident) {
      throw new NotFoundException('Resident was not found.');
    }
    return resident;
  }

  async createResident(actor: AuthPrincipal, command: CreateResidentCommand, meta: ResidentRequestMeta): Promise<ResidentRecord> {
    await this.assertHouseAssignable(actor.rtId, command.houseId);
    await this.assertTelegramAccountBindable(actor.rtId, command.telegramAccountId);
    return this.residentsRepository.createResident(actor.rtId, command, actor, meta);
  }

  async updateResident(actor: AuthPrincipal, residentId: string, command: UpdateResidentCommand, meta: ResidentRequestMeta): Promise<ResidentRecord> {
    await this.assertResidentExists(actor.rtId, residentId);
    if (command.telegramAccountId !== undefined) {
      await this.assertTelegramAccountBindable(actor.rtId, command.telegramAccountId, residentId);
    }
    const resident = await this.residentsRepository.updateResident(actor.rtId, residentId, command, actor, meta);
    if (!resident) {
      throw new NotFoundException('Resident was not found.');
    }
    return resident;
  }

  async archiveResident(actor: AuthPrincipal, residentId: string, meta: ResidentRequestMeta): Promise<ResidentRecord> {
    await this.assertResidentExists(actor.rtId, residentId);
    const resident = await this.residentsRepository.archiveResident(actor.rtId, residentId, actor, meta);
    if (!resident) {
      throw new NotFoundException('Resident was not found.');
    }
    return resident;
  }

  async reactivateResident(actor: AuthPrincipal, residentId: string, meta: ResidentRequestMeta): Promise<ResidentRecord> {
    const resident = await this.residentsRepository.findResidentById(actor.rtId, residentId, { includeArchived: true });
    if (!resident) {
      throw new NotFoundException('Resident was not found.');
    }
    if (resident.status === ResidentStatus.ACTIVE) {
      throw new BadRequestException('Resident is already active.');
    }
    await this.assertHouseAssignable(actor.rtId, resident.houseId);
    const reactivated = await this.residentsRepository.reactivateResident(actor.rtId, residentId, actor, meta);
    if (!reactivated) {
      throw new NotFoundException('Resident was not found.');
    }
    return reactivated;
  }

  async moveResident(actor: AuthPrincipal, residentId: string, command: MoveResidentCommand, meta: ResidentRequestMeta): Promise<ResidentRecord> {
    await this.assertResidentActive(actor.rtId, residentId);
    await this.assertHouseAssignable(actor.rtId, command.houseId);
    const resident = await this.residentsRepository.moveResident(actor.rtId, residentId, command, actor, meta);
    if (!resident) {
      throw new NotFoundException('Resident was not found.');
    }
    return resident;
  }

  private async assertResidentActive(rtId: string, residentId: string): Promise<void> {
    const resident = await this.residentsRepository.findResidentById(rtId, residentId);
    if (!resident) {
      throw new NotFoundException('Resident was not found.');
    }
    if (resident.status !== ResidentStatus.ACTIVE) {
      throw new BadRequestException('Only active residents can be moved.');
    }
  }

  private async assertResidentExists(rtId: string, residentId: string): Promise<void> {
    const resident = await this.residentsRepository.findResidentById(rtId, residentId);
    if (!resident) {
      throw new NotFoundException('Resident was not found.');
    }
  }

  private async assertHouseAssignable(rtId: string, houseId: string): Promise<void> {
    const house = await this.residentsRepository.findAssignableHouse(rtId, houseId);
    if (!house) {
      throw new NotFoundException('House was not found.');
    }
    if (house.deletedAt || house.status === HouseStatus.INACTIVE) {
      throw new BadRequestException('Archived or inactive houses cannot receive resident assignments.');
    }
  }

  private async assertTelegramAccountBindable(rtId: string, telegramAccountId?: string | null, residentId?: string): Promise<void> {
    if (!telegramAccountId) {
      return;
    }

    const account = await this.residentsRepository.findTelegramAccount(telegramAccountId);
    if (!account) {
      throw new NotFoundException('Telegram account was not found.');
    }
    if (account.revokedAt) {
      throw new BadRequestException('Revoked Telegram accounts cannot be bound to residents.');
    }

    const conflict = await this.residentsRepository.findConflictingTelegramBinding(rtId, telegramAccountId, { exceptResidentId: residentId });
    if (conflict) {
      throw new BadRequestException('Telegram account is already bound in this tenant.');
    }
  }
}
