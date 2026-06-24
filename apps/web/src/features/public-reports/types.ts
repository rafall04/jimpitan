/**
 * Purpose: Public-safe frontend response contracts for transparency pages.
 * Caller: Public report API helpers, page routes, and presentational components.
 * Deps: Backend public report DTO shapes.
 * MainFuncs: Defines public summary, monthly finance, metadata, announcement, and pagination types.
 * SideEffects: None.
 */
export type PublicTransactionType = 'INCOME' | 'EXPENSE';
export type PublicLedgerDirection = 'INCREASE' | 'DECREASE';

export type PublicTransparencySummary = {
  rt: {
    code: string;
    name: string;
  };
  financeVisibility?: 'PUBLIC' | 'TOKEN';
  financeAccessible?: boolean;
  cashBalance: {
    totalBalance: string;
    currency: string;
    accountCount: number;
  };
  totals: {
    income: string;
    expense: string;
    netCashFlow: string;
  };
  currentMonth: string;
  lastUpdatedAt: string;
};

export type PublicMonthlyFinanceReport = {
  month: string;
  totals: {
    income: string;
    expense: string;
    netCashFlow: string;
  };
  categorySummaries: PublicCategorySummary[];
  generatedAt: string;
};

export type PublicCategorySummary = {
  categoryKey: string;
  categoryName: string;
  type: PublicTransactionType;
  total: string;
  direction: PublicLedgerDirection;
};

export type PublicReportMetadata = {
  id: string;
  title: string;
  publishedAt: string;
  type: 'ANNOUNCEMENT';
};

export type PublicAnnouncement = {
  id: string;
  title: string;
  body: string;
  publishedAt: string;
};

export type PublicFeedParams = {
  page?: number;
  limit?: number;
  search?: string;
};

export type PublicPaginatedResult<T> = {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};
