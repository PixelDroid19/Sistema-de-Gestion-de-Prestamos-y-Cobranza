import { useDeferredValue } from 'react';
import { User } from 'lucide-react';
import { tTerm } from '../../../i18n/terminology';
import { useUsers } from '../../../services/userService';
import { SearchableSelect, type SearchableSelectOption } from './SearchableSelect';

type UserSearchSelectProps = {
  id?: string;
  selectedUserId: string;
  searchValue: string;
  onSearchValueChange: (value: string) => void;
  onSelectedUserIdChange: (value: string) => void;
  placeholder?: string;
  listboxLabel?: string;
  pageSize?: number;
  role?: string;
  activeOnly?: boolean;
  invalid?: boolean;
  disabled?: boolean;
};

const getUserName = (user: any) => String(user?.name || '').trim() || tTerm('userSearch.unknownUser');
const getUserEmail = (user: any) => String(user?.email || '').trim() || tTerm('common.notAvailable');

export default function UserSearchSelect({
  id,
  selectedUserId,
  searchValue,
  onSearchValueChange,
  onSelectedUserIdChange,
  placeholder = tTerm('userSearch.placeholder'),
  listboxLabel = tTerm('userSearch.results'),
  pageSize = 50,
  role = 'administrative',
  activeOnly = true,
  invalid = false,
  disabled = false,
}: UserSearchSelectProps) {
  const deferredSearch = useDeferredValue(searchValue).trim();
  const { data, isLoading, isError } = useUsers({
    page: 1,
    pageSize,
    ...(role ? { role } : {}),
    ...(deferredSearch ? { search: deferredSearch } : {}),
  }, { enabled: !disabled });
  const users = Array.isArray(data?.data?.users)
    ? data.data.users
    : Array.isArray(data?.data)
      ? data.data
      : [];

  const visibleUsers = users.filter((user: any) => (
    (!activeOnly || user?.isActive !== false)
    && ['admin', 'employee'].includes(String(user?.role || '').toLowerCase())
  ));

  const options: SearchableSelectOption[] = visibleUsers.map((user: any) => ({
    value: String(user.id),
    label: tTerm('userSearch.optionLabel', {
      name: getUserName(user),
      email: getUserEmail(user),
    }),
  }));

  return (
    <SearchableSelect
      id={id}
      value={selectedUserId}
      options={options}
      onChange={onSelectedUserIdChange}
      searchValue={searchValue}
      onSearchValueChange={onSearchValueChange}
      icon={<User size={18} />}
      placeholder={placeholder}
      listboxLabel={listboxLabel}
      loadingText={tTerm('userSearch.loading')}
      emptyText={tTerm('userSearch.empty')}
      errorText={tTerm('userSearch.error')}
      isLoading={isLoading}
      isError={isError}
      invalid={invalid}
      disabled={disabled}
    />
  );
}
