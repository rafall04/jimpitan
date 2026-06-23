/**
 * Purpose: HTTP controller for tenant-scoped content authoring (posts + images + lifecycle).
 * Caller: NestJS router (authenticated dashboard routes).
 * Deps: ContentService, Auth/RBAC guards, FileInterceptor, content DTOs, request context type.
 * MainFuncs: Exposes content list/detail/create/update/publish/archive/delete and cover/gallery image routes with RBAC metadata.
 * SideEffects: Writes content + images through ContentService on mutating routes.
 */
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { isIP } from 'net';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { RequireAnyPermission } from '../../../common/decorators/permissions.decorator';
import type { RequestWithContext } from '../../../common/types/request-context.type';
import type { AuthPrincipal } from '../../auth/domain/auth.types';
import type { UploadedImageFile } from '../../attachments/domain/attachment.types';
import { ContentService } from '../application/content.service';
import { CreateContentDto } from './dto/create-content.dto';
import { ContentQueryDto } from './dto/content-query.dto';
import { UpdateContentDto } from './dto/update-content.dto';

interface MulterFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

const IMAGE_INTERCEPTOR_LIMIT = 12 * 1024 * 1024;

@ApiTags('content')
@ApiBearerAuth()
@Controller({ path: 'content', version: '1' })
export class ContentController {
  constructor(private readonly contentService: ContentService) {}

  @ApiOperation({ summary: 'List RT content posts' })
  @RequireAnyPermission('content.read')
  @Get()
  async list(@CurrentUser() principal: AuthPrincipal, @Query() query: ContentQueryDto) {
    return this.contentService.listPosts(principal, query);
  }

  @ApiOperation({ summary: 'Create RT content post' })
  @RequireAnyPermission('content.create')
  @Post()
  async create(@CurrentUser() principal: AuthPrincipal, @Body() dto: CreateContentDto, @Req() request: RequestWithContext) {
    return this.contentService.createPost(principal, dto, this.requestMeta(request));
  }

  @ApiOperation({ summary: 'Get RT content post detail' })
  @RequireAnyPermission('content.read')
  @Get(':postId')
  async get(@CurrentUser() principal: AuthPrincipal, @Param('postId', ParseUUIDPipe) postId: string) {
    return this.contentService.getPost(principal, postId);
  }

  @ApiOperation({ summary: 'Update RT content post' })
  @RequireAnyPermission('content.update')
  @Patch(':postId')
  async update(
    @CurrentUser() principal: AuthPrincipal,
    @Param('postId', ParseUUIDPipe) postId: string,
    @Body() dto: UpdateContentDto,
    @Req() request: RequestWithContext,
  ) {
    return this.contentService.updatePost(principal, postId, dto, this.requestMeta(request));
  }

  @ApiOperation({ summary: 'Publish RT content post' })
  @RequireAnyPermission('content.publish')
  @Post(':postId/publish')
  async publish(@CurrentUser() principal: AuthPrincipal, @Param('postId', ParseUUIDPipe) postId: string, @Req() request: RequestWithContext) {
    return this.contentService.publishPost(principal, postId, this.requestMeta(request));
  }

  @ApiOperation({ summary: 'Archive (unpublish) RT content post' })
  @RequireAnyPermission('content.publish')
  @Post(':postId/archive')
  async archive(@CurrentUser() principal: AuthPrincipal, @Param('postId', ParseUUIDPipe) postId: string, @Req() request: RequestWithContext) {
    return this.contentService.archivePost(principal, postId, this.requestMeta(request));
  }

  @ApiOperation({ summary: 'Delete RT content post' })
  @RequireAnyPermission('content.delete')
  @Delete(':postId')
  async remove(@CurrentUser() principal: AuthPrincipal, @Param('postId', ParseUUIDPipe) postId: string, @Req() request: RequestWithContext) {
    await this.contentService.deletePost(principal, postId, this.requestMeta(request));
    return { deleted: true };
  }

  @ApiOperation({ summary: 'List images for a content post' })
  @RequireAnyPermission('content.read')
  @Get(':postId/images')
  async listImages(@CurrentUser() principal: AuthPrincipal, @Param('postId', ParseUUIDPipe) postId: string) {
    return this.contentService.listImages(principal, postId);
  }

  @ApiOperation({ summary: 'Upload or replace the cover image of a content post' })
  @ApiConsumes('multipart/form-data')
  @RequireAnyPermission('content.update')
  @Post(':postId/cover')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: IMAGE_INTERCEPTOR_LIMIT } }))
  async uploadCover(@CurrentUser() principal: AuthPrincipal, @Param('postId', ParseUUIDPipe) postId: string, @UploadedFile() file: MulterFile) {
    return this.contentService.uploadCoverImage(principal, postId, this.toUploadedFile(file));
  }

  @ApiOperation({ summary: 'Add a gallery image to a content post' })
  @ApiConsumes('multipart/form-data')
  @RequireAnyPermission('content.update')
  @Post(':postId/images')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: IMAGE_INTERCEPTOR_LIMIT } }))
  async addImage(@CurrentUser() principal: AuthPrincipal, @Param('postId', ParseUUIDPipe) postId: string, @UploadedFile() file: MulterFile) {
    return this.contentService.addGalleryImage(principal, postId, this.toUploadedFile(file));
  }

  @ApiOperation({ summary: 'Remove an image from a content post' })
  @RequireAnyPermission('content.update')
  @Delete(':postId/images/:attachmentId')
  async removeImage(
    @CurrentUser() principal: AuthPrincipal,
    @Param('postId', ParseUUIDPipe) postId: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
  ) {
    await this.contentService.removeImage(principal, postId, attachmentId);
    return { deleted: true };
  }

  private toUploadedFile(file: MulterFile | undefined): UploadedImageFile {
    if (!file || !file.buffer) {
      throw new BadRequestException('Berkas gambar wajib diunggah.');
    }
    return { buffer: file.buffer, originalName: file.originalname, mimeType: file.mimetype, size: file.size };
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
