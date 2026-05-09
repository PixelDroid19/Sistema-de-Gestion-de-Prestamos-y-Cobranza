import React from 'react';
import type { GuideContext, GuideViewKey } from '../../lib/guidedTours';
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

type DataTableSurfaceProps = React.HTMLAttributes<HTMLElement> & {
  children: React.ReactNode;
  className?: string;
};

const accentClassNames: Record<NonNullable<MetricCardProps['accent']>, string> = {
  teal: 'metric-card--teal',
  emerald: 'metric-card--emerald',
  blue: 'metric-card--blue',
  amber: 'metric-card--amber',
  rose: 'metric-card--rose',
  slate: 'metric-card--slate',
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
            <p className="min-w-0 text-[10px] font-bold uppercase leading-4 tracking-[0.12em] text-text-secondary">
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

export function DataTableSurface({ children, className = '', ...rest }: DataTableSurfaceProps) {
  return (
    <section className={`data-table-surface ${className}`} {...rest}>
      {children}
    </section>
  );
}
