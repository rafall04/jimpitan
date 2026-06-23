/**
 * Purpose: Request DTO for creating a content post.
 * Caller: ContentController create route via the global ValidationPipe.
 * Deps: class-validator, Prisma ContentType + AnnouncementVisibility enums.
 * MainFuncs: Validates content type, title/body, optional excerpt/event/location, and an optional immediate-publish flag.
 * SideEffects: None.
 */
import { AnnouncementVisibility, ContentType } from '@prisma/client';
import { IsBoolean, IsEnum, IsISO8601, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateContentDto {
  @IsEnum(ContentType)
  type!: ContentType;

  @IsString()
  @MinLength(3)
  @MaxLength(180)
  title!: string;

  @IsString()
  @MinLength(1)
  body!: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  excerpt?: string;

  @IsOptional()
  @IsEnum(AnnouncementVisibility)
  visibility?: AnnouncementVisibility;

  @IsOptional()
  @IsISO8601()
  eventStartAt?: string;

  @IsOptional()
  @IsISO8601()
  eventEndAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string;

  @IsOptional()
  @IsBoolean()
  publish?: boolean;
}
