import React from 'react';
import { CircleHelp } from 'lucide-react';
import { startViewGuide, type GuideContext, type GuideViewKey, hasGuideDefinition } from '../../lib/guidedTours';
import { useSessionStore } from '../../store/sessionStore';

type HelpTooltipProps = {
  text: string;
  align?: 'left' | 'right';
  className?: string;
  iconSize?: number;
  buttonClassName?: string;
};

type HelpLabelProps = {
  label: React.ReactNode;
  text: string;
  align?: 'left' | 'right';
  className?: string;
};

type ExplainedChipProps = {
  label: React.ReactNode;
  description: string;
  className: string;
  align?: 'left' | 'right';
};

type QuickGuideButtonProps = {
  guideKey: GuideViewKey;
  guideContext?: Omit<GuideContext, 'role'>;
  className?: string;
};

export function HelpTooltip({
  text,
  align = 'left',
  className = '',
  iconSize = 12,
  buttonClassName = '',
}: HelpTooltipProps) {
  return (
    <span className={`field-hint relative inline-flex ${className}`}>
      <button
        type="button"
        aria-label={text}
        className={`inline-flex h-5 w-5 items-center justify-center rounded-full border border-border-subtle bg-bg-surface text-text-secondary transition hover:border-brand-primary hover:text-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/30 ${buttonClassName}`}
      >
        <CircleHelp size={iconSize} aria-hidden="true" />
      </button>
      <span
        role="tooltip"
        className={`field-hint-tooltip pointer-events-none absolute top-full z-40 mt-2 hidden w-72 rounded-lg border border-border-subtle bg-bg-surface px-3 py-2 text-left text-xs font-normal leading-5 text-text-secondary shadow-lg ${
          align === 'right' ? 'right-0' : 'left-0'
        }`}
      >
        {text}
      </span>
    </span>
  );
}

export function HelpLabel({ label, text, align = 'left', className = '' }: HelpLabelProps) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <span>{label}</span>
      <HelpTooltip text={text} align={align} iconSize={11} />
    </span>
  );
}

export function ExplainedChip({ label, description, className, align = 'left' }: ExplainedChipProps) {
  return (
    <span className="field-hint relative inline-flex">
      <span
        tabIndex={0}
        aria-label={`${label}. ${description}`}
        className={className}
      >
        {label}
      </span>
      <span
        role="tooltip"
        className={`field-hint-tooltip pointer-events-none absolute top-full z-40 mt-2 hidden w-72 rounded-lg border border-border-subtle bg-bg-surface px-3 py-2 text-left text-xs font-normal leading-5 text-text-secondary shadow-lg ${
          align === 'right' ? 'right-0' : 'left-0'
        }`}
      >
        {description}
      </span>
    </span>
  );
}

export function QuickGuideButton({ guideKey, guideContext, className = '' }: QuickGuideButtonProps) {
  const { user } = useSessionStore();

  if (!hasGuideDefinition(guideKey, user?.role)) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={() => startViewGuide(guideKey, { role: user?.role, ...guideContext })}
      className={`inline-flex items-center justify-center gap-2 rounded-xl border border-border-subtle bg-bg-surface px-4 py-2.5 text-sm font-medium text-text-primary transition hover:bg-hover-bg active:scale-[0.98] ${className}`}
    >
      <CircleHelp size={16} />
      Guía rápida
    </button>
  );
}
