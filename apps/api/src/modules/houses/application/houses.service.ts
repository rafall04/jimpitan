/**
 * Purpose: Application service for tenant-scoped RT house management.
 * Caller: HousesController and unit tests.
 * Deps: Houses repository port, AuthPrincipal, Prisma house status enum, and command contracts.
 * MainFuncs: Enforces tenant scoping, area assignment safety, occupancy lifecycle rules, and archive validation.
 * SideEffects: Writes house data and audit logs through the repository port.
 */
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { HouseStatus } from '@prisma/client';
import type { PaginatedResult } from '../../../common/types/paginated-result.type';
import type { AuthPrincipal } from '../../auth/domain/auth.types';
import { HOUSES_REPOSITORY } from '../houses.tokens';
import type { HouseRecord } from '../domain/houses.types';
import type { CreateHouseCommand, HouseListQuery, StructureRequestMeta, UpdateHouseCommand } from './houses.commands';
import type { HousesRepositoryPort } from '../infrastructure/houses.repository.port';

@Injectable()
export class HousesService {
  constructor(@Inject(HOUSES_REPOSITORY) private readonly housesRepository: HousesRepositoryPort) {}

  async listHouses(actor: AuthPrincipal, query: HouseListQuery): Promise<PaginatedResult<HouseRecord>> {
    return this.housesRepository.listHouses(actor.rtId, query);
  }

  async getHouse(actor: AuthPrincipal, houseId: string): Promise<HouseRecord> {
    const house = await this.housesRepository.findHouseById(actor.rtId, houseId);
    if (!house) {
      throw new NotFoundException('House was not found.');
    }
    return house;
  }

  async createHouse(actor: AuthPrincipal, command: CreateHouseCommand, meta: StructureRequestMeta): Promise<HouseRecord> {
    await this.assertAreaAssignable(actor.rtId, command.areaId);
    this.assertCreateStatusAllowed(command.status);
    return this.housesRepository.createHouse(actor.rtId, command, actor, meta);
  }

  async updateHouse(actor: AuthPrincipal, houseId: string, command: UpdateHouseCommand, meta: StructureRequestMeta): Promise<HouseRecord> {
    await this.assertHouseExists(actor.rtId, houseId);
    if (command.areaId) {
      await this.assertAreaAssignable(actor.rtId, command.areaId);
    }
    this.assertManualStatusAllowed(command.status);
    if (command.status === HouseStatus.EMPTY) {
      await this.assertHouseHasNoActiveResidents(actor.rtId, houseId, 'House cannot be marked empty while active residents are assigned.');
    }
    if (command.status === HouseStatus.OCCUPIED) {
      await this.assertHouseHasActiveResidents(actor.rtId, houseId, 'House cannot be marked occupied without active residents.');
    }

    const house = await this.housesRepository.updateHouse(actor.rtId, houseId, command, actor, meta);
    if (!house) {
      throw new NotFoundException('House was not found.');
    }
    return house;
  }

  async archiveHouse(actor: AuthPrincipal, houseId: string, meta: StructureRequestMeta): Promise<HouseRecord> {
    await this.assertHouseExists(actor.rtId, houseId);
    await this.assertHouseHasNoActiveResidents(actor.rtId, houseId, 'House cannot be archived while active residents are assigned.');

    const house = await this.housesRepository.archiveHouse(actor.rtId, houseId, actor, meta);
    if (!house) {
      throw new NotFoundException('House was not found.');
    }
    return house;
  }

  private async assertAreaAssignable(rtId: string, areaId: string): Promise<void> {
    const area = await this.housesRepository.findAreaById(rtId, areaId);
    if (!area) {
      throw new NotFoundException('Area was not found.');
    }
    if (!area.isActive) {
      throw new BadRequestException('Archived areas cannot receive house assignments.');
    }
  }

  private async assertHouseExists(rtId: string, houseId: string): Promise<void> {
    const house = await this.housesRepository.findHouseById(rtId, houseId);
    if (!house) {
      throw new NotFoundException('House was not found.');
    }
  }

  private async assertHouseHasNoActiveResidents(rtId: string, houseId: string, message: string): Promise<void> {
    const activeResidentCount = await this.housesRepository.countActiveResidentsInHouse(rtId, houseId);
    if (activeResidentCount > 0) {
      throw new BadRequestException(message);
    }
  }

  private async assertHouseHasActiveResidents(rtId: string, houseId: string, message: string): Promise<void> {
    const activeResidentCount = await this.housesRepository.countActiveResidentsInHouse(rtId, houseId);
    if (activeResidentCount === 0) {
      throw new BadRequestException(message);
    }
  }

  private assertCreateStatusAllowed(status?: HouseStatus): void {
    if (status === HouseStatus.OCCUPIED) {
      throw new BadRequestException('House occupancy is derived from active resident assignments.');
    }
    this.assertManualStatusAllowed(status);
  }

  private assertManualStatusAllowed(status?: HouseStatus): void {
    if (status === HouseStatus.INACTIVE) {
      throw new BadRequestException('Use the archive endpoint to mark a house inactive.');
    }
  }
}
