/**
 * Purpose: Request DTO for setting public finance (kas) visibility.
 * Caller: SettingsController.
 * Deps: class-validator.
 * MainFuncs: Validates the visibility mode.
 * SideEffects: None.
 */
import { IsIn } from 'class-validator';
import type { FinanceVisibilityMode } from '../../domain/settings.types';

export class FinanceVisibilityDto {
  @IsIn(['PUBLIC', 'TOKEN'])
  mode!: FinanceVisibilityMode;
}
