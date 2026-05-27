/**
 * Purpose: Application facade boundary for finance module health and future aggregate use cases.
 * Caller: FinanceController and module wiring.
 * Deps: None.
 * MainFuncs: Reserves finance aggregate ownership while focused services own accounts, categories, and transactions.
 * SideEffects: None.
 */
import { Injectable } from '@nestjs/common';

@Injectable()
export class FinanceService {}
