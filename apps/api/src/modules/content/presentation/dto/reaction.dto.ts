/**
 * Purpose: Request DTO for submitting a public reaction to a content post.
 * Caller: PublicContentController reaction route via the global ValidationPipe.
 * Deps: class-validator, Prisma ReactionType enum.
 * MainFuncs: Validates the chosen reaction type.
 * SideEffects: None.
 */
import { ReactionType } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class ReactionDto {
  @IsEnum(ReactionType)
  reactionType!: ReactionType;
}
