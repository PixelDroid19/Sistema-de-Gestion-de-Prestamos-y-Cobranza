import React from 'react';
import type { GuideContext, GuideViewKey } from '../../lib/guidedTours';
import {
  formatDigitGroups,
  formatWholeMoneyInput,
  normalizeDecimalInput,
  normalizeIntegerInput,
  normalizePercentInput,
  normalizeTextInput,
  normalizeWholeMoneyInput,
} from '../../lib/moneyInput';
import { HelpTooltip, QuickGuideButton } from './HelpSupport';

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

type MoneyInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'inputMode' | 'value' | 'onChange'> & {
  value: string;
  onValueChange: (value: string, event: React.ChangeEvent<HTMLInputElement>) => void;
};

type NormalizedInputVariant = 'text' | 'money' | 'integer' | 'decimal' | 'percent';

export type NormalizedInputChangeDetail = {
  value: string;
  displayValue: string;
  variant: NormalizedInputVariant;
  numericValue: number | null;
};

type NormalizedInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> & {
  value: string;
  variant?: NormalizedInputVariant;
  allowZero?: boolean;
  minValue?: number;
  maxValue?: number;
  maxDigits?: number;
  maxDecimals?: number;
  trimText?: boolean;
  onValueChange: (value: string, event: React.ChangeEvent<HTMLInputElement>) => void;
  onNormalizedChange?: (detail: NormalizedInputChangeDetail, event: React.ChangeEvent<HTMLInputElement>) => void;
};

type FormFieldProps = Omit<React.LabelHTMLAttributes<HTMLLabelElement>, 'children'> & {
  label: React.ReactNode;
  tooltip?: string;
  helper?: React.ReactNode;
  error?: React.ReactNode;
  children: React.ReactNode;
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
    <section className={`data-table-surface ${className}`} {...rest}>
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
  loadingLabel = 'Procesando...',
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

export function FormField({
  label,
  tooltip,
  helper,
  error,
  children,
  className = '',
  ...rest
}: FormFieldProps) {
  return (
    <label className={`form-field ${className}`} {...rest}>
      <span className="form-field-label">
        <span>{label}</span>
        {tooltip ? <HelpTooltip text={tooltip} align="right" iconSize={12} /> : null}
      </span>
      {children}
      {error ? (
        <span className="form-field-error">{error}</span>
      ) : helper ? (
        <span className="form-field-helper">{helper}</span>
      ) : null}
    </label>
  );
}

export function TextInput({ className = '', ...rest }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`form-control ${className}`} {...rest} />;
}

const getNormalizedInputMode = (variant: NormalizedInputVariant) => {
  if (variant === 'money' || variant === 'integer') return 'numeric';
  if (variant === 'decimal' || variant === 'percent') return 'decimal';
  return undefined;
};

const getNormalizedDisplayValue = (variant: NormalizedInputVariant, value: string) => {
  if (variant === 'money') return formatWholeMoneyInput(value);
  if (variant === 'integer' && /^\d+$/.test(value)) return formatDigitGroups(value);
  return value;
};

const normalizeByVariant = (
  variant: NormalizedInputVariant,
  value: string,
  options: Pick<NormalizedInputProps, 'allowZero' | 'minValue' | 'maxValue' | 'maxDigits' | 'maxDecimals' | 'trimText' | 'maxLength'>,
) => {
  if (variant === 'money') return normalizeWholeMoneyInput(value);
  if (variant === 'integer') {
    return normalizeIntegerInput(value, {
      allowZero: options.allowZero,
      min: options.minValue,
      max: options.maxValue,
      maxDigits: options.maxDigits,
    });
  }
  if (variant === 'decimal') {
    return normalizeDecimalInput(value, {
      allowZero: options.allowZero,
      min: options.minValue,
      max: options.maxValue,
      maxDigits: options.maxDigits,
      maxDecimals: options.maxDecimals,
    });
  }
  if (variant === 'percent') {
    return normalizePercentInput(value, {
      allowZero: options.allowZero,
      min: options.minValue,
      max: options.maxValue,
      maxDigits: options.maxDigits,
      maxDecimals: options.maxDecimals,
    });
  }
  return normalizeTextInput(value, {
    trim: options.trimText,
    maxLength: typeof options.maxLength === 'number' ? options.maxLength : undefined,
  });
};

const getNormalizedNumericValue = (variant: NormalizedInputVariant, value: string): number | null => {
  if (!value || variant === 'text') return null;

  const numericValue = Number(value);
  return Number.isSafeInteger(numericValue) || (variant !== 'money' && Number.isFinite(numericValue))
    ? numericValue
    : null;
};

const buildNormalizedChangeDetail = (
  variant: NormalizedInputVariant,
  value: string,
): NormalizedInputChangeDetail => ({
  value,
  displayValue: getNormalizedDisplayValue(variant, value),
  variant,
  numericValue: getNormalizedNumericValue(variant, value),
});

export function NormalizedInput({
  className = '',
  value,
  variant = 'text',
  onValueChange,
  allowZero,
  minValue,
  maxValue,
  maxDigits,
  maxDecimals,
  trimText,
  onNormalizedChange,
  maxLength,
  inputMode,
  ...rest
}: NormalizedInputProps) {
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const normalizedValue = normalizeByVariant(variant, event.target.value, {
      allowZero,
      minValue,
      maxValue,
      maxDigits,
      maxDecimals,
      trimText,
      maxLength,
    });
    if (normalizedValue === null) {
      return;
    }

    onValueChange(normalizedValue, event);
    onNormalizedChange?.(buildNormalizedChangeDetail(variant, normalizedValue), event);
  };

  return (
    <input
      className={`form-control ${className}`}
      type="text"
      inputMode={inputMode ?? getNormalizedInputMode(variant)}
      value={getNormalizedDisplayValue(variant, value)}
      onChange={handleChange}
      maxLength={maxLength}
      {...rest}
    />
  );
}

export function MoneyInput({
  placeholder = '0',
  ...rest
}: MoneyInputProps) {
  return <NormalizedInput variant="money" placeholder={placeholder} {...rest} />;
}

export function CheckboxInput({ className = '', ...rest }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input type="checkbox" className={`form-checkbox ${className}`} {...rest} />;
}

export function TextAreaInput({ className = '', ...rest }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`form-control min-h-24 resize-none ${className}`} {...rest} />;
}

export function SelectInput({ className = '', children, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`form-control ${className}`} {...rest}>
      {children}
    </select>
  );
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
  return (
    <nav className={`view-tabs ${className}`} aria-label={ariaLabel} {...rest}>
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`view-tab ${isActive ? 'view-tab--active' : ''}`}
            title={tab.title}
            aria-current={isActive ? 'page' : undefined}
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
    </nav>
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
  return (
    <div className="modal-overlay">
      <div className={`modal-panel ${maxWidthClassName} ${className}`} {...rest}>
        <div className="modal-header">
          <h3 className="modal-title">{title}</h3>
          {subtitle && <p className="modal-subtitle">{subtitle}</p>}
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}
