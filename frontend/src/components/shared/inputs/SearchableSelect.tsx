import React from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { tTerm } from '../../../i18n/terminology';
import './SearchableSelect.css';

export type SearchableSelectOption = {
  value: string;
  label: string;
  meta?: string;
};

type SearchableSelectProps = {
  id?: string;
  value: string;
  options: SearchableSelectOption[];
  onChange: (value: string) => void;
  searchValue: string;
  onSearchValueChange: (value: string) => void;
  icon?: React.ReactNode;
  placeholder?: string;
  listboxLabel?: string;
  loadingText?: string;
  emptyText?: string;
  errorText?: string;
  isLoading?: boolean;
  isError?: boolean;
  invalid?: boolean;
  disabled?: boolean;
  required?: boolean;
};

/**
 * Single, unified search + select control (ARIA combobox pattern): one field where
 * the operator types to filter server-side and picks from the popover list. Replaces
 * the old "stacked input + native <select>" anti-pattern.
 */
export function SearchableSelect({
  id,
  value,
  options,
  onChange,
  searchValue,
  onSearchValueChange,
  icon,
  placeholder = '',
  listboxLabel,
  loadingText = tTerm('customerSearch.loading'),
  emptyText = tTerm('customerSearch.empty'),
  errorText = tTerm('customerSearch.error'),
  isLoading = false,
  isError = false,
  invalid = false,
  disabled = false,
  required = false,
  clearLabel = tTerm('common.clear'),
}: SearchableSelectProps & { clearLabel?: string }) {
  const [open, setOpen] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLUListElement>(null);
  // Remember labels seen so the selected value keeps its label even after the
  // search query changes and the option leaves the current server page.
  const labelCacheRef = React.useRef<Record<string, string>>({});

  React.useEffect(() => {
    options.forEach((option) => {
      if (option.value) {
        labelCacheRef.current[option.value] = option.label;
      }
    });
  }, [options]);

  const selectedLabel = value ? (labelCacheRef.current[value] || '') : '';

  React.useEffect(() => {
    if (!open) {
      return undefined;
    }
    const handlePointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [open]);

  React.useEffect(() => {
    if (open) {
      setActiveIndex(0);
    }
  }, [open, options]);

  const listboxId = id ? `${id}-listbox` : undefined;

  const openMenu = () => {
    if (disabled) {
      return;
    }
    setOpen(true);
  };

  const commitSelection = (option: SearchableSelectOption) => {
    if (!option || !option.value) {
      return;
    }
    labelCacheRef.current[option.value] = option.label;
    onChange(option.value);
    onSearchValueChange('');
    setOpen(false);
    inputRef.current?.blur();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!open) {
        openMenu();
        return;
      }
      setActiveIndex((index) => Math.min(index + 1, options.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter') {
      if (open && options[activeIndex]) {
        event.preventDefault();
        commitSelection(options[activeIndex]);
      }
    } else if (event.key === 'Escape') {
      if (open) {
        event.preventDefault();
        setOpen(false);
      }
    }
  };

  React.useEffect(() => {
    if (!open || !listRef.current) {
      return;
    }
    const activeEl = listRef.current.querySelector<HTMLElement>('[data-active="true"]');
    activeEl?.scrollIntoView?.({ block: 'nearest' });
  }, [activeIndex, open]);

  // When closed and an item is selected, show its label; otherwise show the live query.
  const inputValue = open ? searchValue : (selectedLabel || searchValue);

  return (
    <div
      ref={rootRef}
      className={[
        'searchable-select',
        'operational-control',
        invalid ? 'operational-control--invalid' : '',
        disabled ? 'searchable-select--disabled' : '',
      ].filter(Boolean).join(' ')}
    >
      {icon ? <span className="operational-control-icon" aria-hidden="true">{icon}</span> : (
        <span className="operational-control-icon" aria-hidden="true"><Search size={16} /></span>
      )}
      <input
        ref={inputRef}
        id={id}
        type="text"
        className="operational-control-input searchable-select__input"
        role="combobox"
        autoComplete="off"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-haspopup="listbox"
        aria-label={listboxLabel}
        aria-invalid={invalid || undefined}
        required={required && !value}
        disabled={disabled}
        placeholder={placeholder}
        value={inputValue}
        onChange={(event) => {
          onSearchValueChange(event.target.value);
          if (!open) {
            setOpen(true);
          }
        }}
        onFocus={openMenu}
        onClick={openMenu}
        onKeyDown={handleKeyDown}
      />
      {value && !disabled ? (
        <button
          type="button"
          className="searchable-select__clear"
          aria-label={clearLabel}
          onMouseDown={(event) => {
            event.preventDefault();
            onChange('');
            onSearchValueChange('');
            setOpen(false);
          }}
        >
          <X size={16} />
        </button>
      ) : null}
      <button
        type="button"
        className="searchable-select__toggle"
        tabIndex={-1}
        aria-hidden="true"
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : (inputRef.current?.focus(), openMenu()))}
      >
        <ChevronDown size={18} />
      </button>
      {open ? (
        <ul
          ref={listRef}
          id={listboxId}
          role="listbox"
          aria-label={listboxLabel}
          className="searchable-select__listbox"
        >
          {isLoading ? (
            <li className="searchable-select__status" role="presentation">{loadingText}</li>
          ) : isError ? (
            <li className="searchable-select__status searchable-select__status--error" role="presentation">{errorText}</li>
          ) : options.length === 0 ? (
            <li className="searchable-select__status" role="presentation">{emptyText}</li>
          ) : (
            options.map((option, index) => {
              const isSelected = option.value === value;
              const isActive = index === activeIndex;
              return (
                <li
                  key={option.value}
                  role="option"
                  aria-selected={isSelected}
                  data-active={isActive}
                  className={[
                    'searchable-select__option',
                    isActive ? 'searchable-select__option--active' : '',
                    isSelected ? 'searchable-select__option--selected' : '',
                  ].filter(Boolean).join(' ')}
                  onMouseEnter={() => setActiveIndex(index)}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    commitSelection(option);
                  }}
                >
                  <span className="searchable-select__option-body">
                    <span className="searchable-select__option-label">{option.label}</span>
                    {option.meta ? (
                      <span className="searchable-select__option-meta">{option.meta}</span>
                    ) : null}
                  </span>
                  {isSelected ? <Check size={16} className="searchable-select__option-check" /> : null}
                </li>
              );
            })
          )}
        </ul>
      ) : null}
    </div>
  );
}

export default SearchableSelect;
