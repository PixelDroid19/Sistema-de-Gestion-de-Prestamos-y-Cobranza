import { useDeferredValue, useMemo } from 'react';
import { CreditCard } from 'lucide-react';
import { formatCurrency as formatCurrencyValue } from '../../../i18n/format';
import { tTerm } from '../../../i18n/terminology';
import { useLoans } from '../../../services/loanService';
import { SearchableSelect, type SearchableSelectOption } from './SearchableSelect';

type LoanSearchSelectProps = {
  id?: string;
  selectedLoanId: string;
  searchValue: string;
  onSearchValueChange: (value: string) => void;
  onSelectedLoanIdChange: (value: string) => void;
  placeholder?: string;
  listboxLabel?: string;
  pageSize?: number;
  includeOutstanding?: boolean;
  fallbackOptions?: SearchableSelectOption[];
  required?: boolean;
  enabled?: boolean;
  invalid?: boolean;
};

const getLoanCustomerName = (loan: any) => String(
  loan?.Customer?.name
  || loan?.customer?.name
  || loan?.customerName
  || '',
).trim() || tTerm('loanSearch.unknownCustomer');

const getLoanAmount = (loan: any) => Number(loan?.amount ?? loan?.loanAmount ?? 0);

const getLoanOutstandingAmount = (loan: any) => {
  const explicitBalance = Number(loan?.financialSnapshot?.outstandingBalance ?? loan?.outstandingBalance ?? loan?.remainingBalance);
  if (Number.isFinite(explicitBalance)) {
    return Math.max(0, explicitBalance);
  }

  const principal = Number(loan?.principalOutstanding ?? loan?.outstandingPrincipal ?? 0);
  const interest = Number(loan?.interestOutstanding ?? 0);
  return Math.max(0, (Number.isFinite(principal) ? principal : 0) + (Number.isFinite(interest) ? interest : 0));
};

const getLoanStatusLabel = (loan: any) => {
  const normalizedStatus = String(loan?.status || '').toLowerCase();
  const statusLabels: Record<string, string> = {
    pending: tTerm('schedule.status.pending'),
    approved: tTerm('credits.status.approved'),
    active: tTerm('common.status.active'),
    overdue: tTerm('schedule.status.overdue'),
    defaulted: tTerm('credits.status.defaulted'),
    paid: tTerm('schedule.status.paid'),
    closed: tTerm('common.status.closed'),
    cancelled: tTerm('credits.status.cancelled'),
    rejected: tTerm('credits.status.rejected'),
  };

  return statusLabels[normalizedStatus] || tTerm('common.notSpecified');
};

const getLoanLabel = (loan: any, includeOutstanding: boolean) => {
  const amount = getLoanAmount(loan);
  const amountText = amount > 0 ? formatCurrencyValue(amount) : tTerm('common.notAvailable');

  if (!includeOutstanding) {
    return tTerm('loanSearch.optionLabel', {
      customer: getLoanCustomerName(loan),
      amount: amountText,
    });
  }

  const outstanding = getLoanOutstandingAmount(loan);
  const outstandingText = outstanding > 0 ? formatCurrencyValue(outstanding) : tTerm('loanSearch.noOutstanding');
  return tTerm('loanSearch.optionLabelWithOutstanding', {
    customer: getLoanCustomerName(loan),
    amount: amountText,
    outstanding: outstandingText,
  });
};

const normalizeLoans = (response: any) => (
  Array.isArray(response?.data?.loans)
    ? response.data.loans
    : Array.isArray(response?.data)
      ? response.data
      : []
);

const matchesLoanSearch = (loan: any, rawQuery: string) => {
  const query = rawQuery.trim().toLowerCase();
  if (!query) {
    return true;
  }

  const searchableValues = [
    getLoanCustomerName(loan),
    String(loan?.id ?? ''),
    String(loan?.status ?? ''),
    String(loan?.Customer?.documentNumber ?? loan?.customer?.documentNumber ?? ''),
  ];

  return searchableValues.some((value) => value.toLowerCase().includes(query));
};

export default function LoanSearchSelect({
  id,
  selectedLoanId,
  searchValue,
  onSearchValueChange,
  onSelectedLoanIdChange,
  placeholder = tTerm('loanSearch.placeholder'),
  listboxLabel = tTerm('loanSearch.results'),
  pageSize = 100,
  includeOutstanding = false,
  fallbackOptions = [],
  required = false,
  enabled = true,
  invalid = false,
}: LoanSearchSelectProps) {
  const deferredSearch = useDeferredValue(searchValue).trim();
  const fallbackPageSize = Math.max(pageSize, 250);
  const baseLoansQuery = useLoans({
    page: 1,
    pageSize: fallbackPageSize,
  }, { enabled });
  const searchLoansQuery = useLoans({
    page: 1,
    pageSize,
    ...(deferredSearch ? { search: deferredSearch } : {}),
  }, {
    enabled: enabled && deferredSearch.length > 0,
  });

  const useFallbackResults = deferredSearch.length > 0 && searchLoansQuery.isError;
  const activeQueryData = deferredSearch.length > 0 && !useFallbackResults
    ? searchLoansQuery.data
    : baseLoansQuery.data;
  const filteredFallbackOptions = useMemo(() => {
    if (deferredSearch.length === 0) {
      return fallbackOptions;
    }

    const normalizedQuery = deferredSearch.toLowerCase();
    return fallbackOptions.filter((option) => (
      option.label.toLowerCase().includes(normalizedQuery)
      || option.meta?.toLowerCase().includes(normalizedQuery)
    ));
  }, [deferredSearch, fallbackOptions]);
  const loans = useMemo(() => {
    const normalizedLoans = normalizeLoans(activeQueryData);
    return useFallbackResults
      ? normalizedLoans.filter((loan: any) => matchesLoanSearch(loan, deferredSearch))
      : normalizedLoans;
  }, [activeQueryData, deferredSearch, useFallbackResults]);
  const hasRenderableFallbackOptions = filteredFallbackOptions.length > 0;
  const isLoading = deferredSearch.length > 0
    ? searchLoansQuery.isLoading || (useFallbackResults && baseLoansQuery.isLoading)
    : baseLoansQuery.isLoading;
  const isError = deferredSearch.length > 0
    ? searchLoansQuery.isError && baseLoansQuery.isError && !hasRenderableFallbackOptions
    : baseLoansQuery.isError && !hasRenderableFallbackOptions;

  const options: SearchableSelectOption[] = loans.length > 0
    ? loans.map((loan: any) => ({
      value: String(loan.id),
      label: getLoanLabel(loan, includeOutstanding),
      meta: tTerm('loanSearch.optionMeta', {
        number: String(loan?.id ?? ''),
        status: getLoanStatusLabel(loan),
      }),
    }))
    : filteredFallbackOptions;

  return (
    <SearchableSelect
      id={id}
      value={selectedLoanId}
      options={options}
      onChange={onSelectedLoanIdChange}
      searchValue={searchValue}
      onSearchValueChange={onSearchValueChange}
      icon={<CreditCard size={18} />}
      placeholder={placeholder}
      listboxLabel={listboxLabel}
      loadingText={tTerm('loanSearch.loading')}
      emptyText={tTerm('loanSearch.empty')}
      errorText={tTerm('loanSearch.error')}
      isLoading={isLoading}
      isError={isError}
      invalid={invalid}
      disabled={!enabled}
      required={required}
    />
  );
}
