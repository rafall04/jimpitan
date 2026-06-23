/**
 * Purpose: HTTP controller for tenant-scoped jimpitan collection endpoints.
 * Caller: NestJS router.
 * Deps: JimpitanService, Auth/RBAC guards, collection DTOs, pagination DTO, and request context type.
 * MainFuncs: Exposes collection lifecycle, mode-aware bulk total input, checklist, item batch, validation, summary, outstanding, and mobile routes with RBAC metadata.
 * SideEffects: Writes collection data through JimpitanService on mutating routes.
 */
import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { isIP } from 'net';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { RequireAnyPermission } from '../../../common/decorators/permissions.decorator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';import type { RequestWithContext } from '../../../common/types/request-context.type';
import type { AuthPrincipal } from '../../auth/domain/auth.types';
import { JimpitanService } from '../application/jimpitan.service';
import { CancelCollectionDto } from './dto/cancel-collection.dto';
import { CollectionQueryDto } from './dto/collection-query.dto';
import { CreateCollectionDto } from './dto/create-collection.dto';
import { RejectCollectionDto } from './dto/reject-collection.dto';
import { SubmitCollectionDto } from './dto/submit-collection.dto';
import { SetBulkTotalDto } from './dto/set-bulk-total.dto';
import { UpdateCollectionDto } from './dto/update-collection.dto';
import { UpsertCollectionItemsDto } from './dto/collection-item.dto';
import { ValidateCollectionDto } from './dto/validate-collection.dto';

@ApiTags('jimpitan')
@ApiBearerAuth()@Controller({ path: 'jimpitan/collections', version: '1' })
export class JimpitanController {
  constructor(private readonly jimpitanService: JimpitanService) {}

  @ApiOperation({ summary: 'List jimpitan collection sessions' })
  @RequireAnyPermission('collections.read')
  @Get()
  async list(@CurrentUser() principal: AuthPrincipal, @Query() query: CollectionQueryDto) {
    return this.jimpitanService.listCollections(principal, query);
  }

  @ApiOperation({ summary: 'List current officer mobile collection sessions' })
  @RequireAnyPermission('collections.read', 'collections.update_own')
  @Get('mobile/my')
  async listMyMobile(@CurrentUser() principal: AuthPrincipal, @Query() query: CollectionQueryDto) {
    return this.jimpitanService.listMyMobileCollections(principal, query);
  }

  @ApiOperation({ summary: 'Create jimpitan collection session' })
  @RequireAnyPermission('collections.create')
  @Post()
  async create(@CurrentUser() principal: AuthPrincipal, @Body() dto: CreateCollectionDto, @Req() request: RequestWithContext) {
    return this.jimpitanService.createCollection(principal, dto, this.requestMeta(request));
  }

  @ApiOperation({ summary: 'Get jimpitan collection session detail' })
  @RequireAnyPermission('collections.read')
  @Get(':collectionId')
  async get(@CurrentUser() principal: AuthPrincipal, @Param('collectionId', ParseUUIDPipe) collectionId: string) {
    return this.jimpitanService.getCollection(principal, collectionId);
  }

  @ApiOperation({ summary: 'Update jimpitan collection session' })
  @RequireAnyPermission('collections.create', 'collections.validate')
  @Patch(':collectionId')
  async update(
    @CurrentUser() principal: AuthPrincipal,
    @Param('collectionId', ParseUUIDPipe) collectionId: string,
    @Body() dto: UpdateCollectionDto,
    @Req() request: RequestWithContext,
  ) {
    return this.jimpitanService.updateCollection(principal, collectionId, dto, this.requestMeta(request));
  }

  @ApiOperation({ summary: 'Start jimpitan collection session' })
  @RequireAnyPermission('collections.update_own', 'collections.validate')
  @Patch(':collectionId/start')
  async start(@CurrentUser() principal: AuthPrincipal, @Param('collectionId', ParseUUIDPipe) collectionId: string, @Req() request: RequestWithContext) {
    return this.jimpitanService.startCollection(principal, collectionId, this.requestMeta(request));
  }

  @ApiOperation({ summary: 'Cancel jimpitan collection session' })
  @RequireAnyPermission('collections.reject', 'collections.validate')
  @Patch(':collectionId/cancel')
  async cancel(
    @CurrentUser() principal: AuthPrincipal,
    @Param('collectionId', ParseUUIDPipe) collectionId: string,
    @Body() dto: CancelCollectionDto,
    @Req() request: RequestWithContext,
  ) {
    return this.jimpitanService.cancelCollection(principal, collectionId, dto, this.requestMeta(request));
  }

  @ApiOperation({ summary: 'Get mobile-friendly collection checklist' })
  @RequireAnyPermission('collections.read')
  @Get(':collectionId/checklist')
  async getChecklist(@CurrentUser() principal: AuthPrincipal, @Param('collectionId', ParseUUIDPipe) collectionId: string) {
    return this.jimpitanService.getChecklist(principal, collectionId);
  }

  @ApiOperation({ summary: 'Generate collection checklist and mark session in progress' })
  @RequireAnyPermission('collections.update_own', 'collections.validate')
  @Post(':collectionId/checklist/generate')
  async generateChecklist(@CurrentUser() principal: AuthPrincipal, @Param('collectionId', ParseUUIDPipe) collectionId: string, @Req() request: RequestWithContext) {
    return this.jimpitanService.generateChecklist(principal, collectionId, this.requestMeta(request));
  }

  @ApiOperation({ summary: 'Batch upsert mobile collection item input' })
  @RequireAnyPermission('collections.update_own', 'collections.validate')
  @Put(':collectionId/items/batch')
  async upsertItems(
    @CurrentUser() principal: AuthPrincipal,
    @Param('collectionId', ParseUUIDPipe) collectionId: string,
    @Body() dto: UpsertCollectionItemsDto,
    @Req() request: RequestWithContext,
  ) {
    return this.jimpitanService.upsertCollectionItems(principal, collectionId, dto, this.requestMeta(request));
  }

  @ApiOperation({ summary: 'Set total amount for BULK_TOTAL collection sessions' })
  @RequireAnyPermission('collections.update_own', 'collections.validate')
  @Put(':collectionId/bulk-total')
  async setBulkTotal(
    @CurrentUser() principal: AuthPrincipal,
    @Param('collectionId', ParseUUIDPipe) collectionId: string,
    @Body() dto: SetBulkTotalDto,
    @Req() request: RequestWithContext,
  ) {
    return this.jimpitanService.setBulkCollectionTotal(principal, collectionId, dto, this.requestMeta(request));
  }

  @ApiOperation({ summary: 'Submit collection session for treasurer validation' })
  @RequireAnyPermission('collections.submit_own', 'collections.validate')
  @Patch(':collectionId/submit')
  async submit(
    @CurrentUser() principal: AuthPrincipal,
    @Param('collectionId', ParseUUIDPipe) collectionId: string,
    @Body() dto: SubmitCollectionDto,
    @Req() request: RequestWithContext,
  ) {
    return this.jimpitanService.submitCollection(principal, collectionId, dto, this.requestMeta(request));
  }

  @ApiOperation({ summary: 'Validate submitted collection session without ledger posting' })
  @RequireAnyPermission('collections.validate')
  @Patch(':collectionId/validate')
  async validate(
    @CurrentUser() principal: AuthPrincipal,
    @Param('collectionId', ParseUUIDPipe) collectionId: string,
    @Body() dto: ValidateCollectionDto,
    @Req() request: RequestWithContext,
  ) {
    return this.jimpitanService.validateCollection(principal, collectionId, dto, this.requestMeta(request));
  }

  @ApiOperation({ summary: 'Reject submitted collection session' })
  @RequireAnyPermission('collections.reject')
  @Patch(':collectionId/reject')
  async reject(
    @CurrentUser() principal: AuthPrincipal,
    @Param('collectionId', ParseUUIDPipe) collectionId: string,
    @Body() dto: RejectCollectionDto,
    @Req() request: RequestWithContext,
  ) {
    return this.jimpitanService.rejectCollection(principal, collectionId, dto, this.requestMeta(request));
  }

  @ApiOperation({ summary: 'Get collection summary totals and progress' })
  @RequireAnyPermission('collections.read')
  @Get(':collectionId/summary')
  async summary(@CurrentUser() principal: AuthPrincipal, @Param('collectionId', ParseUUIDPipe) collectionId: string) {
    return this.jimpitanService.getSummary(principal, collectionId);
  }

  @ApiOperation({ summary: 'Get outstanding houses for collection session' })
  @RequireAnyPermission('collections.read')
  @Get(':collectionId/outstanding')
  async outstanding(@CurrentUser() principal: AuthPrincipal, @Param('collectionId', ParseUUIDPipe) collectionId: string, @Query() query: PaginationQueryDto) {
    return this.jimpitanService.getOutstandingHouses(principal, collectionId, query);
  }

  private requestMeta(request: RequestWithContext) {
    return {
      correlationId: request.correlationId,
      userAgent: this.headerValue(request.headers['user-agent']),
      ipAddress: request.ip && isIP(request.ip) ? request.ip : undefined,
    };
  }

  private headerValue(value: string | string[] | undefined): string | undefined {
    return Array.isArray(value) ? value[0] : value;
  }
}
