import type { ReactNode } from 'react';

export type TablePaginationConfig = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
};

export type TableShellMode = 'auto' | 'on' | 'off';

export type TableStatePresentation = 'shell' | 'inline';

export type TableShellStateConfig = {
  isLoading?: boolean;
  isError?: boolean;
  hasData?: boolean;
  loadingContent?: ReactNode;
  errorContent?: ReactNode;
  emptyContent?: ReactNode;
  recordsLabel?: string;
  pagination?: TablePaginationConfig;
};

export type TableSurfaceConfig = {
  className?: string;
  surfaceClassName?: string;
  tableClassName?: string;
  minWidthClassName?: string;
  'data-tour'?: string;
  'data-testid'?: string;
  'aria-label'?: string;
};

export type FinancialTableMode = TableSurfaceConfig & {
  visibleFrom?: 'lg' | 'md' | 'always';
  horizontalScroll?: boolean;
  embeddedInSurface?: boolean;
  /** `credit-calendar` añade clase de marcador; el aspecto visual es el mismo que `schedule`. */
  financialLayout?: 'schedule' | 'credit-calendar';
};

export type OperationalTableMode = TableSurfaceConfig & TableShellStateConfig & {
  shell?: TableShellMode;
  statePresentation?: TableStatePresentation;
  footer?: ReactNode;
};

export type AppTableVariant = 'financial' | 'operational';

export function resolveUseTableShell({
  shell = 'auto',
  statePresentation = 'inline',
  pagination,
  loadingContent,
  errorContent,
  emptyContent,
}: Pick<OperationalTableMode, 'shell' | 'statePresentation' | 'pagination' | 'loadingContent' | 'errorContent' | 'emptyContent'>): boolean {
  if (shell === 'off') {
    return false;
  }

  if (shell === 'on') {
    return true;
  }

  if (pagination) {
    return true;
  }

  if (statePresentation === 'shell') {
    return true;
  }

  if (loadingContent || errorContent || emptyContent) {
    return true;
  }

  return false;
}
