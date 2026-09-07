/**
 * 4ang Pagination Utility
 *
 * Standardized pagination parsing and limits.
 */

export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export function parsePagination(query: {
  page?: string | number;
  limit?: string | number;
}): PaginationParams {
  let page = typeof query.page === "string" ? parseInt(query.page, 10) : (query.page || DEFAULT_PAGE);
  let limit = typeof query.limit === "string" ? parseInt(query.limit, 10) : (query.limit || DEFAULT_LIMIT);

  if (isNaN(page) || page < 1) page = DEFAULT_PAGE;
  if (isNaN(limit) || limit < 1) limit = DEFAULT_LIMIT;
  if (limit > MAX_LIMIT) limit = MAX_LIMIT;

  const offset = (page - 1) * limit;

  return { page, limit, offset };
}
