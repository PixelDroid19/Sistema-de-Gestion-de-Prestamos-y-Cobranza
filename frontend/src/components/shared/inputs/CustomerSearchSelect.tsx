import { useDeferredValue } from 'react';
import { User } from 'lucide-react';
import { tTerm } from '../../../i18n/terminology';
import { useCustomers } from '../../../services/customerService';
import { SearchableSelect, type SearchableSelectOption } from './SearchableSelect';

type CustomerSearchSelectProps = {
  id?: string;
  selectedCustomerId: string;
  searchValue: string;
  onSearchValueChange: (value: string) => void;
  onSelectedCustomerIdChange: (value: string) => void;
  placeholder?: string;
  listboxLabel?: string;
  pageSize?: number;
  invalid?: boolean;
};

const getCustomerName = (customer: any) => String(customer?.name || '').trim() || tTerm('customerSearch.unknownCustomer');
const getCustomerDocument = (customer: any) => String(customer?.documentNumber || customer?.phone || customer?.email || '').trim();
const getCustomerStatusLabel = (customer: any) => {
  const normalizedStatus = String(customer?.status || '').toLowerCase();
  const statusLabels: Record<string, string> = {
    active: tTerm('common.status.active'),
    inactive: tTerm('common.status.inactive'),
    blacklisted: tTerm('common.status.blacklisted'),
  };

  return statusLabels[normalizedStatus] || tTerm('common.notSpecified');
};

export default function CustomerSearchSelect({
  id,
  selectedCustomerId,
  searchValue,
  onSearchValueChange,
  onSelectedCustomerIdChange,
  placeholder = tTerm('customerSearch.placeholder'),
  listboxLabel = tTerm('customerSearch.results'),
  pageSize = 100,
  invalid = false,
}: CustomerSearchSelectProps) {
  const deferredSearch = useDeferredValue(searchValue).trim();
  const { data, isLoading, isError } = useCustomers({
    page: 1,
    pageSize,
    ...(deferredSearch ? { search: deferredSearch } : {}),
  });
  const customers = Array.isArray(data?.data?.customers)
    ? data.data.customers
    : Array.isArray(data?.data)
      ? data.data
      : [];

  const options: SearchableSelectOption[] = customers.map((customer: any) => ({
    value: String(customer.id),
    label: tTerm('customerSearch.optionLabel', {
      customer: getCustomerName(customer),
      document: getCustomerDocument(customer) || tTerm('common.notAvailable'),
    }),
    meta: tTerm('customerSearch.optionMeta', {
      number: String(customer?.id ?? ''),
      status: getCustomerStatusLabel(customer),
    }),
  }));

  return (
    <SearchableSelect
      id={id}
      value={selectedCustomerId}
      options={options}
      onChange={onSelectedCustomerIdChange}
      searchValue={searchValue}
      onSearchValueChange={onSearchValueChange}
      icon={<User size={18} />}
      placeholder={placeholder}
      listboxLabel={listboxLabel}
      loadingText={tTerm('customerSearch.loading')}
      emptyText={tTerm('customerSearch.empty')}
      errorText={tTerm('customerSearch.error')}
      isLoading={isLoading}
      isError={isError}
      invalid={invalid}
    />
  );
}
