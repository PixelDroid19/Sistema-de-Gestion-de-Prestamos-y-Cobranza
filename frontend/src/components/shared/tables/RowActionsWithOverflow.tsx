import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { MoreHorizontal } from 'lucide-react';
import { tTerm } from '../../../i18n/terminology';
import { IconActionButton } from '../Surfaces';
import { InstallmentActionButton } from './InstallmentActionButton';
import { RowActionToolbar } from './RowActionToolbar';
import { installmentActionClass, tableIconButtonBase } from './tableActionStyles';

/** Default visible icon actions before the overflow (⋯) menu. */
export const DEFAULT_MAX_INLINE_ACTIONS = 2;

export type RowActionOverflowItem = {
  id: string;
  label: string;
  icon: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  /** Installment toolbar: bordered icon button classes. */
  buttonClassName?: string;
  /** Icon toolbar: ghost/danger variant. */
  iconVariant?: 'ghost' | 'secondary' | 'danger';
  menuTone?: 'default' | 'danger';
};

type RowActionsWithOverflowProps = {
  items: RowActionOverflowItem[];
  maxInline?: number;
  variant: 'icon' | 'installment';
  ariaLabel: string;
  align?: 'start' | 'end' | 'center';
  menuAriaLabel?: string;
  className?: string;
};

export function RowActionsWithOverflow({
  items,
  maxInline = DEFAULT_MAX_INLINE_ACTIONS,
  variant,
  ariaLabel,
  align = 'end',
  menuAriaLabel,
  className = '',
}: RowActionsWithOverflowProps) {
  const visibleItems = items;
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuStyle, setMenuStyle] = useState<CSSProperties | null>(null);
  const menuId = useId();
  const moreLabel = menuAriaLabel ?? tTerm('common.tableActions.more');

  const inlineItems = visibleItems.length <= maxInline ? visibleItems : visibleItems.slice(0, maxInline);
  const overflowItems = visibleItems.length <= maxInline ? [] : visibleItems.slice(maxInline);
  const hasOverflowMenu = overflowItems.length > 0;

  const updateMenuPosition = () => {
    if (typeof window === 'undefined') {
      return;
    }

    const trigger = triggerRef.current;
    if (!trigger) {
      return;
    }

    const triggerRect = trigger.getBoundingClientRect();
    const menuWidth = menuRef.current?.offsetWidth ?? 200;
    const menuHeight = menuRef.current?.offsetHeight ?? 0;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const gap = 6;
    const edgePadding = 12;

    let left = triggerRect.right - menuWidth;
    if (left + menuWidth > viewportWidth - edgePadding) {
      left = viewportWidth - menuWidth - edgePadding;
    }
    left = Math.max(edgePadding, left);

    const spaceBelow = viewportHeight - triggerRect.bottom - edgePadding;
    const spaceAbove = triggerRect.top - edgePadding;
    const openUpwards = menuHeight > 0 && spaceBelow < menuHeight && spaceAbove > spaceBelow;
    const top = openUpwards
      ? Math.max(edgePadding, triggerRect.top - menuHeight - gap)
      : triggerRect.bottom + gap;
    const maxHeight = Math.max(160, openUpwards ? spaceAbove - gap : spaceBelow - gap);

    setMenuStyle({
      position: 'fixed',
      top,
      left,
      zIndex: 1200,
      minWidth: '12.5rem',
      maxWidth: `min(18rem, calc(100vw - ${edgePadding * 2}px))`,
      maxHeight,
      overflowY: 'auto',
      transformOrigin: openUpwards ? 'bottom right' : 'top right',
    });
  };

  useLayoutEffect(() => {
    if (!open) {
      return undefined;
    }

    updateMenuPosition();
    const rafId = window.requestAnimationFrame(() => {
      updateMenuPosition();
    });

    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const closeMenu = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        rootRef.current
        && !rootRef.current.contains(target)
        && !(menuRef.current && menuRef.current.contains(target))
      ) {
        setOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    const syncMenuPosition = () => {
      updateMenuPosition();
    };

    document.addEventListener('mousedown', closeMenu);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', syncMenuPosition);
    window.addEventListener('scroll', syncMenuPosition, true);

    return () => {
      document.removeEventListener('mousedown', closeMenu);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', syncMenuPosition);
      window.removeEventListener('scroll', syncMenuPosition, true);
    };
  }, [open]);

  if (visibleItems.length === 0) {
    return null;
  }

  const renderInlineItem = (item: RowActionOverflowItem) => {
    if (variant === 'installment') {
      return (
        <InstallmentActionButton
          key={item.id}
          onClick={item.onClick}
          disabled={item.disabled}
          className={item.buttonClassName ?? installmentActionClass('slate')}
          label={item.label}
        >
          {item.icon}
        </InstallmentActionButton>
      );
    }

    return (
      <IconActionButton
        key={item.id}
        onClick={item.onClick}
        disabled={item.disabled}
        label={item.label}
        icon={item.icon}
        variant={item.iconVariant ?? 'ghost'}
      />
    );
  };

  const renderOverflowTrigger = () => {
    if (variant === 'installment') {
      return (
        <InstallmentActionButton
          onClick={() => setOpen((current) => !current)}
          className={`${tableIconButtonBase} ${open ? 'border-brand-primary/40 bg-hover-bg' : ''}`}
          label={moreLabel}
          ariaExpanded={open}
          ariaControls={open ? menuId : undefined}
          ariaHaspopup="menu"
        >
          <MoreHorizontal size={16} />
        </InstallmentActionButton>
      );
    }

    return (
      <IconActionButton
        onClick={() => setOpen((current) => !current)}
        icon={<MoreHorizontal size={16} />}
        label={moreLabel}
        variant="ghost"
        className={open ? 'bg-hover-bg' : ''}
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-haspopup="menu"
      />
    );
  };

  return (
    <div ref={rootRef} className={`relative inline-flex max-w-full ${className}`.trim()}>
      <RowActionToolbar
        variant={variant}
        ariaLabel={ariaLabel}
        align={align}
        className={hasOverflowMenu ? 'gap-1.5' : undefined}
      >
        {inlineItems.map(renderInlineItem)}
        {hasOverflowMenu && (
          <div ref={triggerRef} className="relative shrink-0">
            {renderOverflowTrigger()}
          </div>
        )}
      </RowActionToolbar>
      {open && typeof document !== 'undefined' && document.body && createPortal(
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={moreLabel}
          style={menuStyle ?? undefined}
          className="overflow-hidden rounded-lg border border-border-subtle bg-bg-surface py-1 text-left shadow-xl"
        >
          {overflowItems.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              className={[
                'flex w-full items-center gap-3 px-3 py-2.5 text-sm font-medium hover:bg-hover-bg disabled:cursor-not-allowed disabled:opacity-50',
                item.menuTone === 'danger'
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-text-primary',
              ].join(' ')}
              onClick={() => {
                if (item.disabled) {
                  return;
                }
                item.onClick();
                setOpen(false);
              }}
              title={item.label}
            >
              <span className="shrink-0 text-text-secondary" aria-hidden="true">
                {item.icon}
              </span>
              <span className="min-w-0 text-left leading-snug">{item.label}</span>
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
}
