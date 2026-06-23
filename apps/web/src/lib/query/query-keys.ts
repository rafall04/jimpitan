/**
 * Purpose: Tenant-scoped TanStack Query key factory.
 * Caller: Feature hooks, API query functions, and tests.
 * Deps: None.
 * MainFuncs: Generates stable private/public query keys with RT and resource scope.
 * SideEffects: None.
 */
type QueryParams = Record<string, unknown>;

const rt = (rtId: string) => ['rt', rtId] as const;

export const queryKeys = {
  auth: {
    me: () => ['auth', 'me'] as const,
    session: () => ['auth', 'session'] as const,
  },
  residents: {
    scope: (rtId: string) => [...rt(rtId), 'residents'] as const,
    list: (rtId: string, params: QueryParams = {}) => [...rt(rtId), 'residents', 'list', params] as const,
    detail: (rtId: string, residentId: string) => [...rt(rtId), 'residents', 'detail', residentId] as const,
  },
  houses: {
    scope: (rtId: string) => [...rt(rtId), 'houses'] as const,
    list: (rtId: string, params: QueryParams = {}) => [...rt(rtId), 'houses', 'list', params] as const,
    detail: (rtId: string, houseId: string) => [...rt(rtId), 'houses', 'detail', houseId] as const,
  },
  areas: {
    scope: (rtId: string) => [...rt(rtId), 'areas'] as const,
    list: (rtId: string, params: QueryParams = {}) => [...rt(rtId), 'areas', 'list', params] as const,
    detail: (rtId: string, areaId: string) => [...rt(rtId), 'areas', 'detail', areaId] as const,
  },
  jimpitan: {
    scope: (rtId: string) => [...rt(rtId), 'jimpitan'] as const,
    collections: (rtId: string, params: QueryParams = {}) => [...rt(rtId), 'jimpitan', 'collections', params] as const,
    myCollections: (rtId: string, params: QueryParams = {}) => [...rt(rtId), 'jimpitan', 'collections', 'mine', params] as const,
    detail: (rtId: string, collectionId: string) => [...rt(rtId), 'jimpitan', 'collections', 'detail', collectionId] as const,
    checklist: (rtId: string, collectionId: string) => [...rt(rtId), 'jimpitan', 'collections', 'checklist', collectionId] as const,
    summary: (rtId: string, collectionId: string) => [...rt(rtId), 'jimpitan', 'collections', 'summary', collectionId] as const,
    outstanding: (rtId: string, collectionId: string, params: QueryParams = {}) => [...rt(rtId), 'jimpitan', 'collections', 'outstanding', collectionId, params] as const,
    memberships: (rtId: string) => [...rt(rtId), 'jimpitan', 'memberships'] as const,
  },
  finance: {
    scope: (rtId: string) => [...rt(rtId), 'finance'] as const,
    summary: (rtId: string) => [...rt(rtId), 'finance', 'summary'] as const,
    accounts: (rtId: string, params: QueryParams = {}) => [...rt(rtId), 'finance', 'accounts', params] as const,
    accountBalance: (rtId: string, accountId: string) => [...rt(rtId), 'finance', 'accounts', accountId, 'balance'] as const,
    categories: (rtId: string, params: QueryParams = {}) => [...rt(rtId), 'finance', 'categories', params] as const,
    transactions: (rtId: string, params: QueryParams = {}) => [...rt(rtId), 'finance', 'transactions', params] as const,
    transactionDetail: (rtId: string, transactionId: string) => [...rt(rtId), 'finance', 'transactions', transactionId] as const,
    ledger: (rtId: string, params: QueryParams = {}) => [...rt(rtId), 'finance', 'ledger', params] as const,
    reportSummary: (rtId: string, params: QueryParams = {}) => [...rt(rtId), 'finance', 'report-summary', params] as const,
  },
  approvals: {
    scope: (rtId: string) => [...rt(rtId), 'approvals'] as const,
    list: (rtId: string, params: QueryParams = {}) => [...rt(rtId), 'approvals', 'list', params] as const,
    queue: (rtId: string, params: QueryParams = {}) => [...rt(rtId), 'approvals', 'queue', params] as const,
    detail: (rtId: string, approvalId: string) => [...rt(rtId), 'approvals', approvalId] as const,
    transactionStatus: (rtId: string, transactionId: string) => [...rt(rtId), 'approvals', 'transactions', transactionId, 'status'] as const,
  },
  reports: {
    scope: (rtId: string) => [...rt(rtId), 'reports'] as const,
    privateSummary: (rtId: string, params: QueryParams = {}) => [...rt(rtId), 'reports', 'private-summary', params] as const,
    exports: (rtId: string, params: QueryParams = {}) => [...rt(rtId), 'reports', 'exports', params] as const,
  },
  notifications: {
    unread: (rtId: string) => [...rt(rtId), 'notifications', 'unread'] as const,
    list: (rtId: string, params: QueryParams = {}) => [...rt(rtId), 'notifications', 'list', params] as const,
  },
  content: {
    scope: (rtId: string) => [...rt(rtId), 'content'] as const,
    list: (rtId: string, params: QueryParams = {}) => [...rt(rtId), 'content', 'list', params] as const,
    detail: (rtId: string, postId: string) => [...rt(rtId), 'content', 'detail', postId] as const,
    images: (rtId: string, postId: string) => [...rt(rtId), 'content', 'images', postId] as const,
  },
  publicReports: {
    summary: (rtCode: string) => ['public', 'reports', rtCode, 'summary'] as const,
    monthly: (rtCode: string, month: string) => ['public', 'reports', rtCode, 'monthly', month] as const,
    metadata: (rtCode: string, params: QueryParams = {}) => ['public', 'reports', rtCode, 'metadata', params] as const,
    announcements: (rtCode: string, params: QueryParams = {}) => ['public', 'reports', rtCode, 'announcements', params] as const,
  },
  publicContent: {
    list: (rtCode: string, params: QueryParams = {}) => ['public', 'content', rtCode, 'list', params] as const,
    detail: (rtCode: string, typePath: string, slug: string) => ['public', 'content', rtCode, 'detail', typePath, slug] as const,
  },
};
