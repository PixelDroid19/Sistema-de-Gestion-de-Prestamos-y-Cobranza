import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const readSource = (relativePath: string) => readFileSync(new URL(relativePath, import.meta.url), 'utf8');

describe('CreditDetails i18n contracts', () => {
  it('keeps disabled action explanations in i18n dictionaries', () => {
    const headerSource = readSource('../creditDetails/CreditDetailHeader.tsx');
    const payoutsSource = readSource('../creditDetails/PayoutsTab.tsx');
    const metricsSource = readSource('../creditDetails/CreditSummaryMetrics.tsx');
    const alertsSource = readSource('../creditDetails/AlertsTab.tsx');
    const calendarSource = readSource('../creditDetails/CalendarTab.tsx');
    const modalsSource = readSource('../creditDetails/CreditDetailsModals.tsx');
    const tabsSource = readSource('../creditDetails/CreditDetailsTabs.tsx');
    const historySource = readSource('../creditDetails/HistoryTab.tsx');
    const detailSource = readSource('../CreditDetails.tsx');

    [
      'Volver a créditos',
      'Cliente',
      'Perfil',
      'Ajustar tasa de mora del crédito',
      'Tasa de mora',
      'Cambiar estado del crédito',
      'Descargar Excel operativo de este crédito con resumen, amortización e historial de pagos',
      'Ver plan de pagos completo',
      'Acciones de pago',
      'Recaudos y liquidación del crédito.',
      'Abono a capital no disponible.',
      'Pago total no disponible.',
      'Liquidar el saldo completo del crédito',
      'Pago total',
    ].forEach((text) => {
      expect(headerSource).not.toContain(text);
    });

    [
      'Tipo',
      'Monto',
      'Método',
      'Estado',
      'Acciones',
      'Pago total',
      'Este pago no tiene comprobante disponible.',
    ].forEach((text) => {
      expect(payoutsSource).not.toContain(text);
    });
    expect(payoutsSource).not.toMatch(/['"`]Capital['"`]/);

    [
      'Resumen operativo del crédito',
      'Capital vivo',
      'Principal pendiente',
      'Total cobrado',
      'Capital e intereses',
      'Mora pendiente',
      'EA configurado',
      'Sin tasa aplicada',
      'Cuotas a pagar',
      'Pendientes / pactadas',
    ].forEach((text) => {
      expect(metricsSource).not.toContain(text);
    });

    ['Vence', 'Creada:', 'Resuelta:'].forEach((text) => {
      expect(alertsSource).not.toContain(text);
    });

    expect(calendarSource).not.toContain('N°');
    expect(modalsSource).not.toContain('No se pudo calcular la cotización. Revisa la cuota y la fecha.');
    expect(tabsSource).not.toContain('Historial de pagos');
    expect(tabsSource).not.toContain('Secciones del detalle de crédito');
    expect(historySource).not.toContain('Método');
    expect(detailSource).not.toContain('¿Confirmar pago de cuota #');
    expect(detailSource).not.toContain('Resuelta manualmente desde detalle de crédito.');
    expect(detailSource).not.toContain('Reactivada manualmente desde detalle de crédito.');
  });
});
