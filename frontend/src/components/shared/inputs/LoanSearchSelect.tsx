import { useDeferredValue } from 'react';
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
  required = false,
  enabled = true,
  invalid = false,
}: LoanSearchSelectProps) {
  const deferredSearch = useDeferredValue(searchValue).trim();
  const { data, isLoading, isError } = useLoans({
    page: 1,
    pageSize,
    ...(deferredSearch ? { search: deferredSearch } : {}),
  }, { enabled });
  const loans = Array.isArray(data?.data?.loans)
    ? data.data.loans
    : Array.isArray(data?.data)
      ? data.data
      : [];

  const options: SearchableSelectOption[] = loans.map((loan: any) => ({
    value: String(loan.id),
    label: getLoanLabel(loan, includeOutstanding),
    meta: tTerm('loanSearch.optionMeta', {
      number: String(loan?.id ?? ''),
      status: getLoanStatusLabel(loan),
    }),
  }));

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
