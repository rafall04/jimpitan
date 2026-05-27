/**
 * Purpose: Application service for tenant-scoped RT area management.
 * Caller: AreasController and unit tests.
 * Deps: Houses repository port, AuthPrincipal, and area command contracts.
 * MainFuncs: Enforces tenant scoping, archive safety, and area lifecycle validation.
 * SideEffects: Writes area data and audit logs through the repository port.
 */
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { PaginatedResult } from '../../../common/types/paginated-result.type';
import type { AuthPrincipal } from '../../auth/domain/auth.types';
import { HOUSES_REPOSITORY } from '../houses.tokens';
import type { AreaRecord } from '../domain/houses.types';
import type { AreaListQuery, CreateAreaCommand, StructureRequestMeta, UpdateAreaCommand } from './houses.commands';
import type { HousesRepositoryPort } from '../infrastructure/houses.repository.port';

@Injectable()
export class AreasService {
  constructor(@Inject(HOUSES_REPOSITORY) private readonly housesRepository: HousesRepositoryPort) {}

  async listAreas(actor: AuthPrincipal, query: AreaListQuery): Promise<PaginatedResult<AreaRecord>> {
    return this.housesRepository.listAreas(actor.rtId, query);
  }

  async getArea(actor: AuthPrincipal, areaId: string): Promise<AreaRecord> {
    const area = await this.housesRepository.findAreaById(actor.rtId, areaId);
    if (!area) {
      throw new NotFoundException('Area was not found.');
    }
    return area;
  }

  async createArea(actor: AuthPrincipal, command: CreateAreaCommand, meta: StructureRequestMeta): Promise<AreaRecord> {
    return this.housesRepository.createArea(actor.rtId, command, actor, meta);
  }

  async updateArea(actor: AuthPrincipal, areaId: string, command: UpdateAreaCommand, meta: StructureRequestMeta): Promise<AreaRecord> {
    await this.assertAreaExists(actor.rtId, areaId);
    const area = await this.housesRepository.updateArea(actor.rtId, areaId, command, actor, meta);
    if (!area) {
      throw new NotFoundException('Area was not found.');
    }
    return area;
  }

  async archiveArea(actor: AuthPrincipal, areaId: string, meta: StructureRequestMeta): Promise<AreaRecord> {
    await this.assertAreaExists(actor.rtId, areaId);
    const activeHouseCount = await this.housesRepository.countActiveHousesInArea(actor.rtId, areaId);
    if (activeHouseCount > 0) {
      throw new BadRequestException('Area cannot be archived while active houses still reference it.');
    }

    const area = await this.housesRepository.archiveArea(actor.rtId, areaId, actor, meta);
    if (!area) {
      throw new NotFoundException('Area was not found.');
    }
    return area;
  }

  private async assertAreaExists(rtId: string, areaId: string): Promise<AreaRecord> {
    const area = await this.housesRepository.findAreaById(rtId, areaId);
    if (!area) {
      throw new NotFoundException('Area was not found.');
    }
    return area;
  }
}
