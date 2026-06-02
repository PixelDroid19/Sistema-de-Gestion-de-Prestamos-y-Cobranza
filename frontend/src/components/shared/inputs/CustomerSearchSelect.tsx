import type React from 'react';
import { User } from 'lucide-react';
import { tTerm } from '../../../i18n/terminology';
import { useCustomers } from '../../../services/customerService';
import { OperationalSelect } from './OperationalSelect';

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
  void searchValue;
  const { data, isLoading, isError } = useCustomers({
    page: 1,
    pageSize,
  });
  const customers = Array.isArray(data?.data?.customers)
    ? data.data.customers
    : Array.isArray(data?.data)
      ? data.data
      : [];

  const getCustomerLabel = (customer: any) => tTerm('customerSearch.optionLabel', {
    customer: getCustomerName(customer),
    document: getCustomerDocument(customer) || tTerm('common.notAvailable'),
  });

  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const nextCustomerId = event.target.value;
    onSelectedCustomerIdChange(nextCustomerId);
    const selectedCustomer = customers.find((customer: any) => String(customer?.id) === nextCustomerId);
    onSearchValueChange(selectedCustomer ? getCustomerLabel(selectedCustomer) : '');
  };

  return (
    <OperationalSelect
      id={id}
      value={selectedCustomerId}
      onChange={handleChange}
      icon={<User size={18} />}
      invalid={invalid}
      aria-label={listboxLabel}
    >
      <option value="">{isLoading ? tTerm('customerSearch.loading') : placeholder}</option>
      {isError ? <option value="" disabled>{tTerm('customerSearch.error')}</option> : null}
      {!isLoading && !isError && customers.length === 0 ? (
        <option value="" disabled>{tTerm('customerSearch.empty')}</option>
      ) : null}
      {customers.map((customer: any) => (
        <option key={customer.id} value={customer.id}>
          {getCustomerLabel(customer)} · {tTerm('customerSearch.optionMeta', {
            number: String(customer?.id ?? ''),
            status: getCustomerStatusLabel(customer),
          })}
        </option>
      ))}
    </OperationalSelect>
  );
}
