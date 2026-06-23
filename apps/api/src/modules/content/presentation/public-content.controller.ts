/**
 * Purpose: HTTP controller for the public content feed, detail pages, and anonymous reactions.
 * Caller: NestJS router (public, unauthenticated routes).
 * Deps: ContentService, public-route decorator, public content DTOs, node:crypto, request context type.
 * MainFuncs: Lists/reads published public posts by RT code and records deduped anonymous reactions.
 * SideEffects: Reads public content and writes reaction rows through ContentService.
 */
import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { createHash } from 'node:crypto';
import { isIP } from 'net';
import { PublicRoute } from '../../../common/decorators/public-route.decorator';
import type { RequestWithContext } from '../../../common/types/request-context.type';
import { ContentService } from '../application/content.service';
import { PublicContentQueryDto } from './dto/public-content-query.dto';
import { ReactionDto } from './dto/reaction.dto';

const REACTION_SALT = 'jimpitan-reaction-v1';

@ApiTags('content-public')
@Controller({ path: 'content', version: '1' })
export class PublicContentController {
  constructor(private readonly contentService: ContentService) {}

  @PublicRoute()
  @ApiOperation({ summary: 'List public content posts for an RT' })
  @Get('public/:rtCode/posts')
  async list(@Param('rtCode') rtCode: string, @Query() query: PublicContentQueryDto) {
    return this.contentService.listPublicPosts(rtCode, query);
  }

  @PublicRoute()
  @ApiOperation({ summary: 'Get a public content post by type + slug' })
  @Get('public/:rtCode/posts/:typePath/:slug')
  async detail(@Param('rtCode') rtCode: string, @Param('typePath') typePath: string, @Param('slug') slug: string) {
    return this.contentService.getPublicPost(rtCode, typePath, slug);
  }

  @PublicRoute()
  @ApiOperation({ summary: 'React to a public content post' })
  @Post('public/:rtCode/posts/:typePath/:slug/reactions')
  async react(
    @Param('rtCode') rtCode: string,
    @Param('typePath') typePath: string,
    @Param('slug') slug: string,
    @Body() dto: ReactionDto,
    @Req() request: RequestWithContext,
  ) {
    const { visitorHash, ipHash } = this.visitorFingerprint(request);
    return this.contentService.reactToPublicPost(rtCode, typePath, slug, { reactionType: dto.reactionType, visitorHash, ipHash });
  }

  // Derive a stable, non-reversible visitor fingerprint for one-reaction-per-visitor dedupe + light spam control.
  private visitorFingerprint(request: RequestWithContext): { visitorHash: string; ipHash: string } {
    const ip = request.ip && isIP(request.ip) ? request.ip : 'unknown';
    const userAgent = this.headerValue(request.headers['user-agent']) ?? 'unknown';
    const visitorHash = createHash('sha256').update(`${ip}|${userAgent}|${REACTION_SALT}`).digest('hex');
    const ipHash = createHash('sha256').update(`${ip}|${REACTION_SALT}`).digest('hex');
    return { visitorHash, ipHash };
  }

  private headerValue(value: string | string[] | undefined): string | undefined {
    return Array.isArray(value) ? value[0] : value;
  }
}
