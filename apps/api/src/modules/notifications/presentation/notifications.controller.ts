/**
 * Purpose: HTTP controller for tenant-scoped notification inbox and delivery administration endpoints.
 * Caller: NestJS router.
 * Deps: NotificationsService, Auth/RBAC guards, notification DTOs, and request context type.
 * MainFuncs: Exposes list, unread count, mark-read, mark-all-read, create, delivery status, cancel, retry, and delivery result routes with RBAC metadata.
 * SideEffects: Writes notification, read-state, delivery-state, outbox, and audit changes through NotificationsService on mutating routes.
 */
import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { isIP } from 'net';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { RequireAnyPermission } from '../../../common/decorators/permissions.decorator';import type { RequestWithContext } from '../../../common/types/request-context.type';
import type { AuthPrincipal } from '../../auth/domain/auth.types';
import { NotificationsService } from '../application/notifications.service';
import { CancelNotificationDto, CreateNotificationDto, MarkDeliveryResultDto, NotificationDeliveryQueryDto, NotificationListQueryDto } from './dto/notification.dto';

@ApiTags('notifications')
@ApiBearerAuth()@Controller({ path: 'notifications', version: '1' })
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @ApiOperation({ summary: 'List current user notifications' })
  @RequireAnyPermission('notifications.read')
  @Get()
  async list(@CurrentUser() principal: AuthPrincipal, @Query() query: NotificationListQueryDto) {
    return this.notificationsService.listMyNotifications(principal, query);
  }

  @ApiOperation({ summary: 'Create tenant-scoped notification and outbox delivery records' })
  @RequireAnyPermission('notifications.manage')
  @Post()
  async create(@CurrentUser() principal: AuthPrincipal, @Body() dto: CreateNotificationDto, @Req() request: RequestWithContext) {
    return this.notificationsService.createNotifications(principal, dto, this.requestMeta(request));
  }

  @ApiOperation({ summary: 'Get current user unread notification count' })
  @RequireAnyPermission('notifications.read')
  @Get('unread-count')
  async unreadCount(@CurrentUser() principal: AuthPrincipal) {
    return { unreadCount: await this.notificationsService.getUnreadCount(principal) };
  }

  @ApiOperation({ summary: 'List notification delivery status for administrators' })
  @RequireAnyPermission('notifications.manage')
  @Get('admin/delivery')
  async deliveryStatus(@CurrentUser() principal: AuthPrincipal, @Query() query: NotificationDeliveryQueryDto) {
    return this.notificationsService.listDeliveryStatus(principal, query);
  }

  @ApiOperation({ summary: 'Mark all current user notifications as read' })
  @RequireAnyPermission('notifications.read')
  @Patch('read-all')
  async markAllRead(@CurrentUser() principal: AuthPrincipal, @Req() request: RequestWithContext) {
    return this.notificationsService.markAllAsRead(principal, this.requestMeta(request));
  }

  @ApiOperation({ summary: 'Cancel pending or failed notification delivery' })
  @RequireAnyPermission('notifications.manage')
  @Patch('admin/:notificationId/cancel')
  async cancel(
    @CurrentUser() principal: AuthPrincipal,
    @Param('notificationId', ParseUUIDPipe) notificationId: string,
    @Body() dto: CancelNotificationDto,
    @Req() request: RequestWithContext,
  ) {
    return this.notificationsService.cancelNotification(principal, notificationId, dto, this.requestMeta(request));
  }

  @ApiOperation({ summary: 'Retry failed notification delivery through outbox' })
  @RequireAnyPermission('notifications.manage')
  @Patch('admin/:notificationId/retry')
  async retry(@CurrentUser() principal: AuthPrincipal, @Param('notificationId', ParseUUIDPipe) notificationId: string, @Req() request: RequestWithContext) {
    return this.notificationsService.retryNotificationDelivery(principal, notificationId, this.requestMeta(request));
  }

  @ApiOperation({ summary: 'Mark notification delivery result from a queue worker' })
  @RequireAnyPermission('notifications.manage')
  @Patch('admin/:notificationId/delivery')
  async markDelivery(
    @CurrentUser() principal: AuthPrincipal,
    @Param('notificationId', ParseUUIDPipe) notificationId: string,
    @Body() dto: MarkDeliveryResultDto,
    @Req() request: RequestWithContext,
  ) {
    return this.notificationsService.markDeliveryResult(principal, notificationId, dto, this.requestMeta(request));
  }

  @ApiOperation({ summary: 'Mark one current user notification as read' })
  @RequireAnyPermission('notifications.read')
  @Patch(':notificationId/read')
  async markRead(@CurrentUser() principal: AuthPrincipal, @Param('notificationId', ParseUUIDPipe) notificationId: string, @Req() request: RequestWithContext) {
    return this.notificationsService.markAsRead(principal, notificationId, this.requestMeta(request));
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
