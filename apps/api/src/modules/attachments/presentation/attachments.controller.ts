/**
 * Purpose: HTTP controller serving public content images from storage.
 * Caller: NestJS router (public, unauthenticated image reads).
 * Deps: AttachmentsService, public-route decorator, Express Response.
 * MainFuncs: Streams a public-servable image with caching + nosniff headers.
 * SideEffects: Reads object bytes through AttachmentsService and writes the HTTP response.
 */
import { Controller, Get, Param, ParseUUIDPipe, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { PublicRoute } from '../../../common/decorators/public-route.decorator';
import { AttachmentsService } from '../application/attachments.service';

@ApiTags('attachments')
@Controller({ path: 'attachments', version: '1' })
export class AttachmentsController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  @PublicRoute()
  @ApiOperation({ summary: 'Serve a public content image' })
  @Get('public/:attachmentId')
  async servePublicImage(@Param('attachmentId', ParseUUIDPipe) attachmentId: string, @Res() res: Response): Promise<void> {
    const image = await this.attachmentsService.getPublicImage(attachmentId);
    res.setHeader('Content-Type', image.mimeType);
    res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
    res.setHeader('Content-Length', image.data.length.toString());
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.end(image.data);
  }
}
