import React from 'react';
import { createPortal } from 'react-dom';
import { CircleHelp } from 'lucide-react';
import { tTerm } from '../../i18n/terminology';
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

type TooltipPosition = {
  top: number;
  left: number;
  placement: 'top' | 'bottom';
};

const TOOLTIP_WIDTH = 288;
const VIEWPORT_PADDING = 12;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const getTooltipPosition = (element: HTMLElement, align: 'left' | 'right'): TooltipPosition => {
  const rect = element.getBoundingClientRect();
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
  const maxLeft = Math.max(VIEWPORT_PADDING, viewportWidth - TOOLTIP_WIDTH - VIEWPORT_PADDING);
  const preferredLeft = align === 'right' ? rect.right - TOOLTIP_WIDTH : rect.left;
  const bottomSpace = viewportHeight - rect.bottom;
  const showAbove = bottomSpace < 132 && rect.top > bottomSpace;

  return {
    top: showAbove ? rect.top - 8 : rect.bottom + 8,
    left: clamp(preferredLeft, VIEWPORT_PADDING, maxLeft),
    placement: showAbove ? 'top' : 'bottom',
  };
};

function PortalTooltip({
  anchor,
  text,
  align,
  visible,
}: {
  anchor: HTMLElement | null;
  text: string;
  align: 'left' | 'right';
  visible: boolean;
}) {
  const [position, setPosition] = React.useState<TooltipPosition | null>(null);

  React.useLayoutEffect(() => {
    if (!visible || !anchor) {
      setPosition(null);
      return undefined;
    }

    const updatePosition = () => {
      setPosition(getTooltipPosition(anchor, align));
    };

    updatePosition();
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);

    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [align, anchor, visible]);

  if (!visible || !position || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <span
      role="tooltip"
      className="pointer-events-none fixed z-[1000] w-72 rounded-lg border border-border-subtle bg-bg-surface px-3 py-2 text-left text-xs font-normal leading-5 text-text-primary shadow-lg"
      style={{
        left: position.left,
        top: position.top,
        transform: position.placement === 'top' ? 'translateY(-100%)' : undefined,
      }}
    >
      {text}
    </span>,
    document.body,
  );
}

export function HelpTooltip({
  text,
  align = 'left',
  className = '',
  iconSize = 12,
  buttonClassName = '',
}: HelpTooltipProps) {
  const buttonRef = React.useRef<HTMLButtonElement | null>(null);
  const [visible, setVisible] = React.useState(false);

  return (
    <span
      className={`inline-flex ${className}`}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-label={text}
        className={`inline-flex size-5 items-center justify-center rounded-full border border-border-subtle bg-bg-surface text-text-secondary transition hover:border-brand-primary hover:text-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/30 ${buttonClassName}`}
      >
        <CircleHelp size={iconSize} aria-hidden="true" />
      </button>
      <PortalTooltip anchor={buttonRef.current} text={text} align={align} visible={visible} />
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
  const chipRef = React.useRef<HTMLSpanElement | null>(null);
  const [visible, setVisible] = React.useState(false);

  return (
    <span
      className="inline-flex"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      <span
        ref={chipRef}
        tabIndex={0}
        aria-label={`${label}. ${description}`}
        className={className}
      >
        {label}
      </span>
      <PortalTooltip anchor={chipRef.current} text={description} align={align} visible={visible} />
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
      {tTerm('common.quickGuide')}
    </button>
  );
}
