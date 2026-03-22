export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 25;

export const normalizePaginationState = (pagination = {}) => ({
  page: Number(pagination.page) > 0 ? Number(pagination.page) : DEFAULT_PAGE,
  pageSize: Number(pagination.pageSize) > 0 ? Number(pagination.pageSize) : DEFAULT_PAGE_SIZE,
});

export const buildPaginationSearchParams = (pagination = {}) => {
  const normalized = normalizePaginationState(pagination);
  const params = new URLSearchParams();
  params.set('page', String(normalized.page));
  params.set('pageSize', String(normalized.pageSize));
  return params;
};

export const withPaginationParams = (path, pagination, extraParams = {}) => {
  const params = buildPaginationSearchParams(pagination);

  Object.entries(extraParams).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      params.set(key, String(value));
    }
  });

  const query = params.toString();
  return query ? `${path}?${query}` : path;
};

export const buildPaginatedCollection = (response, collectionKey) => {
  const collection = Array.isArray(response?.data?.[collectionKey])
    ? response.data[collectionKey]
    : Array.isArray(response?.data)
      ? response.data
      : [];

  const pagination = response?.data?.pagination || null;
  const summary = response?.summary || response?.data?.summary || null;

  return {
    ...response,
    items: collection,
    pagination,
    summary,
    count: pagination?.totalItems ?? response?.count ?? collection.length,
    raw: response,
  };
};

export const getPaginationSummary = (pagination, fallbackCount = 0) => {
  if (!pagination) {
    return {
      page: DEFAULT_PAGE,
      pageSize: DEFAULT_PAGE_SIZE,
      totalItems: fallbackCount,
      totalPages: fallbackCount > 0 ? 1 : 0,
    };
  }

  return {
    page: Number(pagination.page) > 0 ? Number(pagination.page) : DEFAULT_PAGE,
    pageSize: Number(pagination.pageSize) > 0 ? Number(pagination.pageSize) : DEFAULT_PAGE_SIZE,
    totalItems: Number(pagination.totalItems) >= 0 ? Number(pagination.totalItems) : fallbackCount,
    totalPages: Number(pagination.totalPages) >= 0 ? Number(pagination.totalPages) : 0,
  };
};
