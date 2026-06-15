import type React from 'react';
import { useDeferredValue } from 'react';
import { Search, User } from 'lucide-react';
import { tTerm } from '../../../i18n/terminology';
import { useUsers } from '../../../services/userService';
import { AppInput } from './AppInput';
import { OperationalSelect } from './OperationalSelect';

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

  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    onSelectedUserIdChange(event.target.value);
  };

  return (
    <div className="flex flex-col gap-2">
      <AppInput
        variant="text"
        value={searchValue}
        onValueChange={(value) => onSearchValueChange(value)}
        icon={<Search size={16} />}
        placeholder={placeholder}
        aria-label={placeholder}
        disabled={disabled}
      />
      <OperationalSelect
        id={id}
        value={selectedUserId}
        onChange={handleChange}
        icon={<User size={18} />}
        invalid={invalid}
        aria-label={listboxLabel}
        disabled={disabled}
      >
        <option value="">{isLoading ? tTerm('userSearch.loading') : placeholder}</option>
        {isError ? <option value="" disabled>{tTerm('userSearch.error')}</option> : null}
        {!isLoading && !isError && visibleUsers.length === 0 ? (
          <option value="" disabled>{tTerm('userSearch.empty')}</option>
        ) : null}
        {visibleUsers.map((user: any) => (
          <option key={user.id} value={user.id}>
            {tTerm('userSearch.optionLabel', {
              name: getUserName(user),
              email: getUserEmail(user),
            })}
          </option>
        ))}
      </OperationalSelect>
    </div>
  );
}
