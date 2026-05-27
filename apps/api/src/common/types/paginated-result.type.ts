/**
 * Purpose: Shared paginated response type for list endpoints.
 * Caller: Application services, repository ports, and controllers.
 * Deps: None.
 * MainFuncs: Defines stable pagination metadata shape.
 * SideEffects: None.
 */
export type PaginationInput = {
  page: number;
  limit: number;
};

export type PaginatedResult<T> = {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};
