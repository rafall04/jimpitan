/**
 * Purpose: Request DTO for updating a content post (partial; null clears nullable fields).
 * Caller: ContentController update route via the global ValidationPipe.
 * Deps: class-validator, Prisma AnnouncementVisibility enum.
 * MainFuncs: Validates optional title/body/excerpt/visibility/event/location edits.
 * SideEffects: None.
 */
import { AnnouncementVisibility } from '@prisma/client';
import { IsEnum, IsISO8601, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateContentDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(180)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  body?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  excerpt?: string | null;

  @IsOptional()
  @IsEnum(AnnouncementVisibility)
  visibility?: AnnouncementVisibility;

  @IsOptional()
  @IsISO8601()
  eventStartAt?: string | null;

  @IsOptional()
  @IsISO8601()
  eventEndAt?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string | null;
}
