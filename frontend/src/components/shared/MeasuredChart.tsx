import React from 'react';

type MeasuredChartProps = {
  className?: string;
  minHeight: number;
  children: (size: { width: number; height: number }) => React.ReactNode;
};

export default function MeasuredChart({ className = '', minHeight, children }: MeasuredChartProps) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [size, setSize] = React.useState({ width: 0, height: 0 });

  React.useEffect(() => {
    const node = containerRef.current;

    if (!node) {
      return undefined;
    }

    const updateSize = () => {
      const fallbackWidth = minHeight;
      const nextWidth = Math.max(0, node.clientWidth || fallbackWidth);
      const nextHeight = Math.max(minHeight, node.clientHeight || minHeight);

      setSize((current) => {
        if (current.width === nextWidth && current.height === nextHeight) {
          return current;
        }

        return { width: nextWidth, height: nextHeight };
      });
    };

    updateSize();

    if (typeof ResizeObserver === 'undefined') {
      return undefined;
    }

    const observer = new ResizeObserver(() => {
      updateSize();
    });

    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, [minHeight]);

  return (
    <div ref={containerRef} className={className} style={{ minHeight }}>
      {size.width > 0 && size.height > 0 ? children(size) : null}
    </div>
  );
}
