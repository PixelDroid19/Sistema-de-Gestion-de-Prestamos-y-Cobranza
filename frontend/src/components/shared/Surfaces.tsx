import React from 'react';
import type { GuideContext, GuideViewKey } from '../../lib/guidedTours';
import { tTerm } from '../../i18n/terminology';
import { HelpTooltip, QuickGuideButton } from './HelpSupport';

export { FormField } from './inputs/FormField';
export type { FormFieldProps } from './inputs/FormField';
export { CurrencyInput } from './inputs/CurrencyInput';
export type { CurrencyInputProps } from './inputs/CurrencyInput';
export { AppInput } from './inputs/AppInput';
export type { AppInputProps, AppInputVariant, AppInputChangeDetail } from './inputs/AppInput';
export { OperationalSelect } from './inputs/OperationalSelect';
export type { OperationalSelectProps } from './inputs/OperationalSelect';
export { default as CustomerSearchSelect } from './inputs/CustomerSearchSelect';
export { default as LoanSearchSelect } from './inputs/LoanSearchSelect';
export { default as UserSearchSelect } from './inputs/UserSearchSelect';


type PageShellProps = React.HTMLAttributes<HTMLDivElement> & {
  children: React.ReactNode;
  className?: string;
};

type PageHeaderProps = {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  eyebrow?: React.ReactNode;
  actions?: React.ReactNode;
  guideKey?: GuideViewKey;
  guideContext?: Omit<GuideContext, 'role'>;
  guideButtonClassName?: string;
  tourId?: string;
  className?: string;
};

type ToolbarSurfaceProps = React.HTMLAttributes<HTMLElement> & {
  children: React.ReactNode;
  className?: string;
  as?: 'section' | 'form';
};

type MetricCardProps = {
  label: React.ReactNode;
  value: React.ReactNode;
  helper?: React.ReactNode;
  tooltip?: string;
  icon?: React.ReactNode;
  accent?: 'teal' | 'emerald' | 'blue' | 'amber' | 'rose' | 'slate';
  className?: string;
};

type InsightStripItem = {
  id: string;
  label: React.ReactNode;
  value: React.ReactNode;
  helper?: React.ReactNode;
  icon?: React.ReactNode;
  accent?: 'teal' | 'emerald' | 'blue' | 'amber' | 'rose' | 'slate';
};

type InsightStripProps = React.HTMLAttributes<HTMLElement> & {
  items: InsightStripItem[];
  className?: string;
};

type StatusChipProps = React.HTMLAttributes<HTMLSpanElement> & {
  children: React.ReactNode;
  icon?: React.ReactNode;
  tone?: 'neutral' | 'success' | 'info' | 'warning' | 'danger' | 'dark';
  size?: 'sm' | 'md';
};

type DataTableSurfaceProps = React.HTMLAttributes<HTMLElement> & {
  children: React.ReactNode;
  className?: string;
};

type SectionSurfaceProps = Omit<React.HTMLAttributes<HTMLElement>, 'title'> & {
  children: React.ReactNode;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  as?: 'section' | 'form';
  noValidate?: boolean;
};

type ActionButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  children: React.ReactNode;
  icon?: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  fullWidth?: boolean;
  isLoading?: boolean;
  loadingLabel?: React.ReactNode;
  disabledReason?: string;
};

type ClickableSurfaceProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  children: React.ReactNode;
  variant?: 'card' | 'list';
};

type IconActionButtonProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  label: string;
  icon: React.ReactNode;
  variant?: 'ghost' | 'secondary' | 'danger';
};

type IconActionLinkProps = Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'children'> & {
  label: string;
  icon: React.ReactNode;
  variant?: 'ghost' | 'secondary' | 'danger';
};

type EmptyStateProps = React.HTMLAttributes<HTMLDivElement> & {
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  compact?: boolean;
};

type ViewTabItem = {
  id: string;
  label: React.ReactNode;
  title?: string;
  count?: React.ReactNode;
  icon?: React.ElementType;
};

type ViewTabsProps = Omit<React.HTMLAttributes<HTMLElement>, 'onChange'> & {
  tabs: ViewTabItem[];
  activeTab: string;
  onChange: (tabId: string) => void;
  ariaLabel?: string;
};

type ModalShellProps = Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> & {
  children: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  footer?: React.ReactNode;
  maxWidthClassName?: string;
  onClose?: () => void;
};

const modalFocusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

const getFocusableModalElements = (panel: HTMLElement) => (
  Array.from(panel.querySelectorAll<HTMLElement>(modalFocusableSelector))
    .filter((element) => element.tabIndex >= 0 && element.getAttribute('aria-hidden') !== 'true')
);

const accentClassNames: Record<NonNullable<MetricCardProps['accent']>, string> = {
  teal: 'metric-card--teal',
  emerald: 'metric-card--emerald',
  blue: 'metric-card--blue',
  amber: 'metric-card--amber',
  rose: 'metric-card--rose',
  slate: 'metric-card--slate',
};

const statusChipClassNames: Record<NonNullable<StatusChipProps['tone']>, string> = {
  neutral: 'status-chip--neutral',
  success: 'status-chip--success',
  info: 'status-chip--info',
  warning: 'status-chip--warning',
  danger: 'status-chip--danger',
  dark: 'status-chip--dark',
};

export function PageShell({ children, className = '', ...rest }: PageShellProps) {
  return (
    <div className={`app-page-shell ${className}`} {...rest}>
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  eyebrow,
  actions,
  guideKey,
  guideContext,
  guideButtonClassName = '',
  tourId,
  className = '',
}: PageHeaderProps) {
  return (
    <section className={`app-page-header ${className}`} {...(tourId ? { 'data-tour': tourId } : {})}>
      <div className="app-page-header-copy">
        {eyebrow && (
          <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.22em] text-brand-primary">
            {eyebrow}
          </p>
        )}
        <h2 className="text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-1 max-w-3xl text-sm leading-6 text-text-secondary">
            {subtitle}
          </p>
        )}
      </div>
      {(actions || guideKey) && (
        <div className="app-page-actions">
          {guideKey ? (
            <QuickGuideButton
              guideKey={guideKey}
              guideContext={guideContext}
              className={guideButtonClassName}
            />
          ) : null}
          {actions}
        </div>
      )}
    </section>
  );
}

export function ToolbarSurface({ children, className = '', as: Component = 'section', ...rest }: ToolbarSurfaceProps) {
  return (
    <Component className={`toolbar-surface ${className}`} {...rest}>
      {children}
    </Component>
  );
}

export function MetricCard({
  label,
  value,
  helper,
  tooltip,
  icon,
  accent = 'teal',
  className = '',
}: MetricCardProps) {
  return (
    <article className={`metric-card ${accentClassNames[accent]} ${className}`}>
      <div className="flex min-w-0 items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-1.5">
            <p className="min-w-0 text-[10px] font-bold uppercase leading-4 tracking-[0.12em] text-text-primary/60 dark:text-text-secondary">
              {label}
            </p>
            {tooltip ? <HelpTooltip text={tooltip} align="right" iconSize={11} /> : null}
          </div>
          <div className="mt-2 overflow-hidden text-ellipsis whitespace-nowrap text-[clamp(1.25rem,1.7vw,1.5rem)] font-bold leading-8 tracking-tight text-text-primary">
            {value}
          </div>
        </div>
        {icon && (
          <div className="metric-card-icon" aria-hidden="true">
            {icon}
          </div>
        )}
      </div>
      {helper && (
        <p className="mt-1 text-xs leading-4 text-text-secondary" title={typeof helper === 'string' ? helper : undefined}>
          {helper}
        </p>
      )}
    </article>
  );
}

export function InsightStrip({
  items,
  className = '',
  ...rest
}: InsightStripProps) {
  const countClassName = `insight-strip--count-${Math.min(items.length, 6)}`;

  return (
    <section className={`insight-strip ${countClassName} ${className}`} {...rest}>
      {items.map((item) => (
        <article key={item.id} className={`insight-strip-item insight-strip-item--${item.accent ?? 'slate'}`}>
          {item.icon ? (
            <div className="insight-strip-icon" aria-hidden="true">
              {item.icon}
            </div>
          ) : null}
          <div className="min-w-0">
            <p className="insight-strip-label">{item.label}</p>
            <p className="insight-strip-value">{item.value}</p>
            {item.helper ? <p className="insight-strip-helper">{item.helper}</p> : null}
          </div>
        </article>
      ))}
    </section>
  );
}

export function StatusChip({
  children,
  icon,
  tone = 'neutral',
  size = 'md',
  className = '',
  ...rest
}: StatusChipProps) {
  return (
    <span
      className={`status-chip ${statusChipClassNames[tone]} ${size === 'sm' ? 'status-chip--sm' : ''} ${className}`}
      {...rest}
    >
      {icon ? <span className="status-chip-icon" aria-hidden="true">{icon}</span> : null}
      <span className="min-w-0 truncate">{children}</span>
    </span>
  );
}

export function DataTableSurface({ children, className = '', ...rest }: DataTableSurfaceProps) {
  return (
    <section className={`data-table-surface ${className}`.trim()} {...rest}>
      {children}
    </section>
  );
}

export function SectionSurface({
  children,
  title,
  subtitle,
  actions,
  className = '',
  bodyClassName = '',
  as: Component = 'section',
  ...rest
}: SectionSurfaceProps) {
  return (
    <Component className={`section-surface ${className}`} {...rest}>
      {(title || subtitle || actions) && (
        <div className="section-surface-header">
          <div className="min-w-0">
            {title && <h3 className="section-surface-title">{title}</h3>}
            {subtitle && <p className="section-surface-subtitle">{subtitle}</p>}
          </div>
          {actions && <div className="section-surface-actions">{actions}</div>}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </Component>
  );
}

const actionButtonClassNames: Record<NonNullable<ActionButtonProps['variant']>, string> = {
  primary: 'action-button--primary',
  secondary: 'action-button--secondary',
  ghost: 'action-button--ghost',
  danger: 'action-button--danger',
};

export function ActionButton({
  children,
  icon,
  variant = 'secondary',
  fullWidth = false,
  isLoading = false,
  loadingLabel = tTerm('common.cta.processing'),
  disabledReason,
  className = '',
  disabled,
  ...rest
}: ActionButtonProps) {
  const isDisabled = Boolean(disabled || isLoading);
  const [showDisabledReason, setShowDisabledReason] = React.useState(false);
  const button = (
    <button
      className={`action-button ${actionButtonClassNames[variant]} ${fullWidth ? 'w-full' : ''} ${className}`}
      disabled={isDisabled}
      type="button"
      {...rest}
      title={isDisabled && disabledReason ? disabledReason : rest.title}
    >
      {icon && <span className="action-button-icon" aria-hidden="true">{icon}</span>}
      <span>{isLoading ? loadingLabel : children}</span>
    </button>
  );

  if (!isDisabled || !disabledReason) {
    return button;
  }

  return (
    <span
      className={`relative inline-flex min-w-0 ${fullWidth ? 'w-full' : ''}`}
      tabIndex={0}
      aria-label={disabledReason}
      onMouseEnter={() => setShowDisabledReason(true)}
      onMouseLeave={() => setShowDisabledReason(false)}
      onFocus={() => setShowDisabledReason(true)}
      onBlur={() => setShowDisabledReason(false)}
    >
      {button}
      {showDisabledReason && (
        <span
          role="tooltip"
          className="absolute right-0 top-full z-50 mt-2 w-72 rounded-lg border border-border-subtle bg-bg-surface px-3 py-2 text-left text-xs font-normal leading-5 text-text-primary shadow-lg"
        >
          {disabledReason}
        </span>
      )}
    </span>
  );
}

export const ClickableSurface = React.forwardRef<HTMLButtonElement, ClickableSurfaceProps>(function ClickableSurface({
  children,
  variant = 'card',
  className = '',
  ...rest
}, ref) {
  const variantClassName = variant === 'card'
    ? 'block w-full rounded-xl border border-border-subtle bg-bg-surface p-4 hover:bg-hover-bg'
    : '';

  return (
    <button
      ref={ref}
      type="button"
      className={`text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/35 ${variantClassName} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
});

export function IconActionButton({
  label,
  icon,
  variant = 'ghost',
  className = '',
  title,
  ...rest
}: IconActionButtonProps) {
  return (
    <button
      aria-label={label}
      className={`action-button ${actionButtonClassNames[variant]} h-9 w-9 !min-h-0 !p-0 ${className}`}
      title={title ?? label}
      type="button"
      {...rest}
    >
      <span className="action-button-icon" aria-hidden="true">{icon}</span>
    </button>
  );
}

export function IconActionLink({
  label,
  icon,
  variant = 'ghost',
  className = '',
  title,
  ...rest
}: IconActionLinkProps) {
  return (
    <a
      aria-label={label}
      className={`action-button ${actionButtonClassNames[variant]} h-9 w-9 !min-h-0 !p-0 ${className}`}
      title={title ?? label}
      {...rest}
    >
      <span className="action-button-icon" aria-hidden="true">{icon}</span>
    </a>
  );
}

export function CheckboxInput({ className = '', ...rest }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input type="checkbox" className={`form-checkbox ${className}`} {...rest} />;
}

export function EmptyState({
  title,
  description,
  icon,
  action,
  compact = false,
  className = '',
  ...rest
}: EmptyStateProps) {
  return (
    <div className={`empty-state ${compact ? 'empty-state--compact' : ''} ${className}`} {...rest}>
      {icon && <div className="empty-state-icon" aria-hidden="true">{icon}</div>}
      <div className="min-w-0">
        <h2 className="empty-state-title">{title}</h2>
        {description && <p className="empty-state-description">{description}</p>}
      </div>
      {action && <div className="empty-state-action">{action}</div>}
    </div>
  );
}

export function ViewTabs({
  tabs,
  activeTab,
  onChange,
  ariaLabel,
  className = '',
  ...rest
}: ViewTabsProps) {
  const tabButtonRefs = React.useRef(new Map<string, HTMLButtonElement>());

  const registerTabButton = (tabId: string) => (node: HTMLButtonElement | null) => {
    if (node) {
      tabButtonRefs.current.set(tabId, node);
      return;
    }
    tabButtonRefs.current.delete(tabId);
  };

  const moveToTab = (tabId: string) => {
    onChange(tabId);
    tabButtonRefs.current.get(tabId)?.focus({ preventScroll: true });
  };

  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    const lastIndex = tabs.length - 1;
    let nextIndex: number | null = null;

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIndex = currentIndex === lastIndex ? 0 : currentIndex + 1;
    }

    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIndex = currentIndex === 0 ? lastIndex : currentIndex - 1;
    }

    if (event.key === 'Home') {
      nextIndex = 0;
    }

    if (event.key === 'End') {
      nextIndex = lastIndex;
    }

    if (nextIndex === null) {
      return;
    }

    event.preventDefault();
    moveToTab(tabs[nextIndex].id);
  };

  return (
    <div className={`view-tabs ${className}`} role="tablist" aria-label={ariaLabel} {...rest}>
      {tabs.map((tab, index) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        const tabAriaLabel = (
          (typeof tab.label === 'string' || typeof tab.label === 'number')
          && (typeof tab.count === 'string' || typeof tab.count === 'number')
        )
          ? `${tab.label} ${tab.count}`
          : undefined;

        return (
          <button
            key={tab.id}
            ref={registerTabButton(tab.id)}
            type="button"
            onClick={() => onChange(tab.id)}
            onKeyDown={(event) => handleTabKeyDown(event, index)}
            className={`view-tab ${isActive ? 'view-tab--active' : ''}`}
            title={tab.title}
            role="tab"
            aria-selected={isActive}
            aria-label={tabAriaLabel}
            tabIndex={isActive ? 0 : -1}
          >
            {Icon ? <Icon size={16} aria-hidden="true" /> : null}
            <span>{tab.label}</span>
            {tab.count !== undefined ? (
              <span className="rounded-full bg-bg-base px-2 py-0.5 text-xs font-semibold text-text-secondary ring-1 ring-border-subtle">
                {tab.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function ModalShell({
  children,
  title,
  subtitle,
  footer,
  maxWidthClassName = 'max-w-md',
  className = '',
  ...rest
}: ModalShellProps) {
  const titleId = React.useId();
  const subtitleId = React.useId();
  const panelRef = React.useRef<HTMLDivElement | null>(null);
  const {
    role = 'dialog',
    'aria-modal': ariaModal = true,
    'aria-labelledby': ariaLabelledBy = titleId,
    'aria-describedby': ariaDescribedBy = subtitle ? subtitleId : undefined,
    tabIndex = -1,
    onKeyDown,
    onClose,
    ...panelProps
  } = rest;

  React.useEffect(() => {
    const panel = panelRef.current;
    if (!panel || panel.contains(document.activeElement)) {
      return;
    }

    panel.focus({ preventScroll: true });
  }, []);

  const handleModalKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented) {
      return;
    }

    if (event.key === 'Escape' && onClose) {
      event.preventDefault();
      onClose();
      return;
    }

    if (event.key !== 'Tab') {
      return;
    }

    const panel = panelRef.current;
    if (!panel) {
      return;
    }

    const focusableElements = getFocusableModalElements(panel);
    if (focusableElements.length === 0) {
      event.preventDefault();
      panel.focus({ preventScroll: true });
      return;
    }

    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];
    const activeElement = document.activeElement;

    if (event.shiftKey) {
      if (activeElement === firstFocusable || activeElement === panel || !panel.contains(activeElement)) {
        event.preventDefault();
        lastFocusable.focus({ preventScroll: true });
      }
      return;
    }

    if (activeElement === lastFocusable || activeElement === panel || !panel.contains(activeElement)) {
      event.preventDefault();
      firstFocusable.focus({ preventScroll: true });
    }
  };

  const handleOverlayClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onClose?.();
    }
  };

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div
        ref={panelRef}
        className={`modal-panel ${maxWidthClassName} ${className}`}
        role={role}
        aria-modal={ariaModal}
        aria-labelledby={ariaLabelledBy}
        aria-describedby={ariaDescribedBy}
        tabIndex={tabIndex}
        onKeyDown={handleModalKeyDown}
        {...panelProps}
      >
        <div className="modal-header">
          <h3 id={titleId} className="modal-title">{title}</h3>
          {subtitle && <p id={subtitleId} className="modal-subtitle">{subtitle}</p>}
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}
