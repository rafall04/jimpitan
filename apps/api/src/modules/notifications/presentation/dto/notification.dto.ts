/**
 * Purpose: Request and query DTOs for notification inbox and delivery administration endpoints.
 * Caller: NotificationsController.
 * Deps: Swagger, class-validator, class-transformer, Prisma notification enums, notification type constants, and pagination DTO.
 * MainFuncs: Validates notification creation, recipient targets, list filters, delivery status filters, read markers, cancellations, retries, and delivery result payloads.
 * SideEffects: None.
 */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationChannel, NotificationStatus } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsBoolean, IsEnum, IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { PaginationQueryDto } from '../../../../common/dto/pagination-query.dto';
import type { NotificationSortDirection } from '../../application/notifications.commands';
import { NOTIFICATION_TYPES, type NotificationType } from '../../domain/notification.types';

export const NOTIFICATION_DELIVERY_STATUSES = [NotificationStatus.PENDING, NotificationStatus.SENT, NotificationStatus.FAILED, NotificationStatus.CANCELLED] as const;

export class NotificationListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: NOTIFICATION_TYPES })
  @IsOptional()
  @IsIn(NOTIFICATION_TYPES)
  type?: NotificationType;

  @ApiPropertyOptional({ enum: NotificationChannel })
  @IsOptional()
  @IsEnum(NotificationChannel)
  channel?: NotificationChannel;

  @ApiPropertyOptional({ enum: NOTIFICATION_DELIVERY_STATUSES })
  @IsOptional()
  @IsIn(NOTIFICATION_DELIVERY_STATUSES)
  status?: NotificationStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  read?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  search?: string;

  @ApiPropertyOptional({ enum: ['createdAt', 'updatedAt', 'type', 'status'] })
  @IsOptional()
  @IsIn(['createdAt', 'updatedAt', 'type', 'status'])
  sortBy?: 'createdAt' | 'updatedAt' | 'type' | 'status';

  @ApiPropertyOptional({ enum: ['asc', 'desc'] })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDirection?: NotificationSortDirection;
}

export class NotificationDeliveryQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: NOTIFICATION_TYPES })
  @IsOptional()
  @IsIn(NOTIFICATION_TYPES)
  type?: NotificationType;

  @ApiPropertyOptional({ enum: NotificationChannel })
  @IsOptional()
  @IsEnum(NotificationChannel)
  channel?: NotificationChannel;

  @ApiPropertyOptional({ enum: NOTIFICATION_DELIVERY_STATUSES })
  @IsOptional()
  @IsIn(NOTIFICATION_DELIVERY_STATUSES)
  status?: NotificationStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4')
  recipientUserId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4')
  recipientResidentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4')
  telegramAccountId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  search?: string;

  @ApiPropertyOptional({ enum: ['createdAt', 'updatedAt', 'status', 'sentAt', 'failedAt'] })
  @IsOptional()
  @IsIn(['createdAt', 'updatedAt', 'status', 'sentAt', 'failedAt'])
  sortBy?: 'createdAt' | 'updatedAt' | 'status' | 'sentAt' | 'failedAt';

  @ApiPropertyOptional({ enum: ['asc', 'desc'] })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDirection?: NotificationSortDirection;
}

export class NotificationRecipientDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4')
  userId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4')
  membershipId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4')
  residentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4')
  telegramBindingId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4')
  telegramAccountId?: string;
}

export class CreateNotificationDto {
  @ApiProperty({ enum: NOTIFICATION_TYPES })
  @IsIn(NOTIFICATION_TYPES)
  type!: NotificationType;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  title!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(4000)
  body!: string;

  @ApiProperty({ enum: NotificationChannel, isArray: true })
  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(NotificationChannel, { each: true })
  channels!: NotificationChannel[];

  @ApiProperty({ type: [NotificationRecipientDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => NotificationRecipientDto)
  recipients!: NotificationRecipientDto[];

  @ApiPropertyOptional()
  @IsOptional()
  payload?: unknown;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  idempotencyKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  dedupeKey?: string;
}

export class CancelNotificationDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(1000)
  reason!: string;
}

export class MarkDeliveryResultDto {
  @ApiProperty({ enum: NOTIFICATION_DELIVERY_STATUSES })
  @IsIn(NOTIFICATION_DELIVERY_STATUSES)
  status!: Extract<NotificationStatus, 'PENDING' | 'SENT' | 'FAILED' | 'CANCELLED'>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  failureReason?: string;
}
