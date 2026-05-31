import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ReportMetricsSection } from '../ReportMetricsSection';

const primaryItems = [
  {
    id: 'primary-1',
    label: 'Entradas',
    value: '$ 100',
    helper: 'Helper primario',
    accent: 'emerald' as const,
  },
  {
    id: 'primary-2',
    label: 'Salidas',
    value: '$ 200',
    helper: 'Helper salidas',
    accent: 'blue' as const,
  },
];

const secondaryItems = [
  {
    id: 'secondary-1',
    label: 'Ganancia',
    value: '$ 50',
    helper: 'Helper secundario',
    accent: 'amber' as const,
  },
];

describe('ReportMetricsSection', () => {
  it('opens additional indicators in a modal instead of expanding inline', () => {
    render(
      <ReportMetricsSection
        primaryAriaLabel="Resumen principal"
        secondaryAriaLabel="Detalle adicional"
        primaryItems={primaryItems}
        secondaryItems={secondaryItems}
      />,
    );

    expect(screen.getByText('Entradas')).toBeInTheDocument();
    expect(screen.queryByText('Ganancia')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Más indicadores (1)' }));

    expect(screen.getByRole('heading', { name: 'Indicadores adicionales' })).toBeInTheDocument();
    expect(screen.getByText('Ganancia')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));

    expect(screen.queryByText('Ganancia')).not.toBeInTheDocument();
  });

  it('renders only primary metrics when secondary items are omitted', () => {
    render(
      <ReportMetricsSection
        primaryAriaLabel="Resumen principal"
        primaryItems={primaryItems}
      />,
    );

    expect(screen.getByText('Entradas')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Más indicadores/ })).not.toBeInTheDocument();
  });

  it('places the more-indicators control in the metrics panel footer', () => {
    const { container } = render(
      <ReportMetricsSection
        primaryAriaLabel="Resumen principal"
        primaryItems={primaryItems}
        secondaryItems={secondaryItems}
      />,
    );

    const panel = container.querySelector('.report-metrics-section__panel');
    const footer = container.querySelector('.report-metrics-section__footer');

    expect(panel).toBeTruthy();
    expect(footer).toBeTruthy();
    expect(panel?.contains(footer)).toBe(true);
    expect(footer?.querySelector('.report-metrics-section__more-btn')).toBeTruthy();
  });
});
