const { ValidationError } = require('@/utils/errorHandler');

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

const isBlank = (value) => value === undefined || value === null || String(value).trim() === '';

const parsePositiveInteger = (value) => {
  const normalized = String(value).trim();
  if (!/^\d+$/.test(normalized)) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const buildPaginationValidationError = (errors) => {
  const error = new ValidationError('Validation failed');
  error.errors = errors;
  return error;
};

const parsePaginationQuery = (
  source = {},
  {
    defaultPage = DEFAULT_PAGE,
    defaultPageSize = DEFAULT_PAGE_SIZE,
    maxPageSize = MAX_PAGE_SIZE,
  } = {},
) => {
  const errors = [];
  let page = defaultPage;
  let pageSize = defaultPageSize;

  if (!isBlank(source.page)) {
    const parsedPage = parsePositiveInteger(source.page);
    if (!parsedPage) {
      errors.push({ field: 'page', message: 'page must be a positive integer' });
    } else {
      page = parsedPage;
    }
  }

  const rawPageSize = !isBlank(source.pageSize) ? source.pageSize : source.limit;

  if (!isBlank(rawPageSize)) {
    const parsedPageSize = parsePositiveInteger(rawPageSize);
    if (!parsedPageSize) {
      errors.push({ field: 'pageSize', message: 'pageSize must be a positive integer' });
    } else if (parsedPageSize > maxPageSize) {
      errors.push({ field: 'pageSize', message: `pageSize must be less than or equal to ${maxPageSize}` });
    } else {
      pageSize = parsedPageSize;
    }
  }

  if (errors.length > 0) {
    throw buildPaginationValidationError(errors);
  }

  return {
    page,
    pageSize,
    limit: pageSize,
    offset: (page - 1) * pageSize,
  };
};

const buildPaginationMeta = ({ page, pageSize, totalItems }) => ({
  page,
  pageSize,
  totalItems,
  totalPages: totalItems > 0 ? Math.ceil(totalItems / pageSize) : 0,
});

const buildPaginatedResult = ({ items, page, pageSize, totalItems }) => ({
  items,
  pagination: buildPaginationMeta({ page, pageSize, totalItems }),
});

const paginateArray = ({ items = [], pagination }) => {
  if (!pagination) {
    return { items, pagination: null };
  }

  const offset = pagination.offset || 0;
  const pageSize = pagination.pageSize;

  return buildPaginatedResult({
    items: items.slice(offset, offset + pageSize),
    page: pagination.page,
    pageSize,
    totalItems: items.length,
  });
};

const paginateModel = async ({
  model,
  page,
  pageSize,
  where,
  include,
  order,
  attributes,
  distinct = true,
  countOptions = {},
  findOptions = {},
}) => {
  const primaryKeyField = countOptions.col || model.primaryKeyAttribute || 'id';
  const totalItems = await model.count({
    where,
    include,
    distinct,
    col: primaryKeyField,
    ...countOptions,
  });

  const items = await model.findAll({
    where,
    include,
    order,
    attributes,
    limit: pageSize,
    offset: (page - 1) * pageSize,
    subQuery: false,
    ...findOptions,
  });

  return buildPaginatedResult({ items, page, pageSize, totalItems });
};

module.exports = {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  parsePaginationQuery,
  buildPaginationMeta,
  buildPaginatedResult,
  paginateArray,
  paginateModel,
};
