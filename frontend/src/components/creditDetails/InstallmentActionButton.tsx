import React, { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type InstallmentActionButtonProps = {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  className: string;
  children: React.ReactNode;
};

export function InstallmentActionButton({
  label,
  disabled = false,
  onClick,
  className,
  children,
}: InstallmentActionButtonProps) {
  const anchorRef = useRef<HTMLSpanElement | null>(null);
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number; placement: 'top' | 'bottom' } | null>(null);

  useLayoutEffect(() => {
    if (!visible || !anchorRef.current) {
      setPosition(null);
      return undefined;
    }

    const updatePosition = () => {
      const rect = anchorRef.current?.getBoundingClientRect();
      if (!rect) return;

      const tooltipWidth = 224;
      const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
      const left = Math.min(
        Math.max(12, viewportWidth - tooltipWidth - 12),
        Math.max(12, rect.left + rect.width / 2 - tooltipWidth / 2),
      );
      const showBelow = rect.top < 48 && viewportHeight - rect.bottom > 88;

      setPosition({
        top: showBelow ? rect.bottom + 8 : rect.top - 8,
        left,
        placement: showBelow ? 'bottom' : 'top',
      });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [visible]);

  return (
    <span
      ref={anchorRef}
      className="inline-flex"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={className}
        title={label}
        aria-label={label}
      >
        {children}
      </button>
      {visible && position && typeof document !== 'undefined' && createPortal(
        <span
          role="tooltip"
          className="pointer-events-none fixed z-[1000] w-56 rounded-lg border border-border-subtle bg-bg-surface px-3 py-2 text-left text-xs font-medium leading-5 text-text-primary shadow-lg"
          style={{
            left: position.left,
            top: position.top,
            transform: position.placement === 'top' ? 'translateY(-100%)' : undefined,
          }}
        >
          {label}
        </span>,
        document.body,
      )}
    </span>
  );
}
