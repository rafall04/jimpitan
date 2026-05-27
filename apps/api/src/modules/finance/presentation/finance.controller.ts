/**
 * Purpose: HTTP controller boundary for finance aggregate endpoints.
 * Caller: NestJS router.
 * Deps: FinanceService.
 * MainFuncs: Reserves aggregate finance route ownership while focused controllers expose accounts, categories, and transactions.
 * SideEffects: None.
 */
import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('finance')
@Controller({ path: 'finance', version: '1' })
export class FinanceController {}
