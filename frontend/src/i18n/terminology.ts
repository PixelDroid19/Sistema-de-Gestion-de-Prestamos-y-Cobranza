const TERMINOLOGY = {
  // Sidebar
  'sidebar.dashboard': 'Dashboard',
  'sidebar.customers': 'Clientes',
  'sidebar.customers.directory': 'Lista de clientes',
  'sidebar.customers.new': 'Nuevo cliente',
  'sidebar.credits': 'Créditos',
  'sidebar.credits.portfolio': 'Créditos vigentes',
  'sidebar.credits.origination': 'Nuevo crédito',
  'sidebar.credits.reports': 'Reportes',
  'sidebar.associates': 'Socios',
  'sidebar.associates.management': 'Gestión de socios',
  'sidebar.payouts': 'Pagos y cobranza',
  'sidebar.audit': 'Auditoría',
  'sidebar.settings': 'Configuración',
  'sidebar.logout': 'Cerrar sesión',

  // Credits
  'credits.module.title': 'Operación de créditos',
  'credits.module.subtitle': 'Registro, seguimiento y cobro de créditos.',
  'credits.cta.exportExcel': 'Exportar Excel',
  'credits.cta.simulate': 'Simular',
  'credits.cta.new': 'Nuevo crédito',
  'credits.toast.export.success': 'Créditos exportados correctamente',
  'credits.toast.export.error': 'No se pudo exportar la cartera de créditos',

  // Credit details
  'creditDetails.cta.recordPayment': 'Registrar Pago',
  'creditDetails.cta.capitalContribution': 'Abono a capital',
  'creditDetails.cta.lateFeeRate': 'Tasa de mora',
  'creditDetails.tab.calendar': 'Calendario',
  'creditDetails.tab.alerts': 'Alertas',
  'creditDetails.tab.promises': 'Compromisos de pago',
  'creditDetails.tab.payoff': 'Pago total',
  'creditDetails.tab.history': 'Historial',

  // Payouts
  'payouts.module.title': 'Pagos y cobranza',
  'payouts.module.subtitle': 'Consulta global de pagos y aplicación de cuotas.',
  'payouts.cta.recordPayment': 'Registrar pago',
  'payouts.toast.voucher.success': 'Comprobante descargado',
  'payouts.toast.edit.success': 'Pago actualizado correctamente',
  'payouts.toast.register.success': 'Pago registrado exitosamente',

  // Customers
  'customers.module.title': 'Clientes',
  'customers.module.subtitle': 'Administrar lista y perfiles de clientes.',
  'customers.cta.new': 'Nuevo cliente',
  'customers.cta.restore': 'Reactivar',
  'customers.toast.restore.success': 'Cliente reactivado correctamente',

  // Associates
  'associates.module.title': 'Socios',
  'associates.module.subtitle': 'Administrar socios y su relación con los préstamos.',
  'associates.cta.new': 'Nuevo socio',
  'associates.cta.exportExcel': 'Exportar Excel',
  'associates.toast.export.success': 'Socios exportados correctamente',
  'associates.toast.export.error': 'No se pudo exportar el listado de socios',

  // Reports
  'reports.module.title': 'Reportes y analítica',
  'reports.module.subtitle': 'Métricas clave y rendimiento de la cartera de créditos.',
  'reports.cta.export': 'Exportar',
  'reports.toast.export.success': 'Reporte exportado correctamente',
  'reports.toast.export.error': 'No se pudo exportar el reporte seleccionado',
  'reports.kpi.scope.lifetime': 'Totales acumulados históricos de la cartera.',
  'reports.kpi.scope.label': 'Alcance KPI',
  'reports.chart.disbursementRecovery.title': 'Evolución de desembolsos y recuperaciones',
  'reports.chart.disbursementRecovery.help': 'Comparación mensual entre montos desembolsados y montos recuperados en pagos.',
  'reports.chart.scope.selectedRange': 'El gráfico refleja únicamente el rango seleccionado.',
  'reports.chart.scope.label': 'Alcance gráfico',
  'reports.chart.scope.currentRangePrefix': 'Rango actual del gráfico:',
  'reports.chart.disbursementRecovery.legend.disbursed': 'Desembolsado',
  'reports.chart.disbursementRecovery.legend.recovered': 'Recuperado',
  'reports.chart.disbursementRecovery.range.last6': 'Últimos 6 meses',
  'reports.chart.disbursementRecovery.range.year': 'Últimos 12 meses',
  'reports.chart.disbursementRecovery.range.historical': 'Histórico',
  'reports.chart.disbursementRecovery.monthFallbackPrefix': 'Mes',
  'reports.chart.disbursementRecovery.empty': 'No hay desembolsos ni recuperaciones para el rango seleccionado.',
  'reports.chart.disbursementRecovery.emptyHint': 'Pruebe otro rango de fechas para visualizar actividad.',
  'reports.chart.disbursementRecovery.emptyWithKpi': 'No hay actividad en el rango seleccionado, aunque existen totales históricos.',
  'reports.chart.disbursementRecovery.emptyWithKpiHint': 'Cambie el rango del gráfico para comparar periodos con actividad reciente.',

  // Payment types
  'payment.type.installment': 'Cuota',
  'payment.type.partial': 'Pago parcial',
  'payment.type.capital': 'Abono a capital',
  'payment.type.payoff': 'Pago total',
  'payment.type.unknown': 'Sin tipo',

  // Confirmations
  'confirm.customer.restore.title': 'Reactivar cliente',
  'confirm.customer.restore.message': '¿Está seguro de que desea restaurar este cliente?',
  'confirm.customer.restore.confirm': 'Reactivar',
  'confirm.document.delete.title': 'Eliminar documento',
  'confirm.document.delete.message': '¿Seguro que desea eliminar este documento?',
  'confirm.document.delete.confirm': 'Eliminar',
  'confirm.paymentMethod.delete.title': 'Eliminar método de pago',
  'confirm.paymentMethod.delete.message': '¿Eliminar método de pago?',
  'confirm.paymentMethod.delete.confirm': 'Eliminar',
  'confirm.tnaRate.delete.title': 'Eliminar tasa TNA',
  'confirm.tnaRate.delete.message': '¿Eliminar esta tasa TNA?',
  'confirm.tnaRate.delete.confirm': 'Eliminar',
  'confirm.lateFeePolicy.delete.title': 'Eliminar política de mora',
  'confirm.lateFeePolicy.delete.message': '¿Eliminar esta política de mora?',
  'confirm.lateFeePolicy.delete.confirm': 'Eliminar',
  'confirm.interestNode.delete.title': 'Eliminar nodo',
  'confirm.interestNode.delete.message': '¿Eliminar este nodo?',
  'confirm.interestNode.delete.confirm': 'Eliminar',
  'confirm.payoff.title': 'Confirmar pago total',
  'confirm.payoff.message': '¿Confirmar pago total por {amount}?',
  'confirm.payoff.confirm': 'Confirmar',
  'confirm.installment.title': 'Confirmar pago de cuota',
  'confirm.installment.message': '¿Confirmar pago de cuota #{number} por {amount}?',
  'confirm.installment.confirm': 'Confirmar',

  // Prompt
  'prompt.payment.reference.title': 'Referencia de conciliación',
  'prompt.payment.reference.message': 'Actualice la referencia para el pago seleccionado.',
  'prompt.payment.reference.label': 'Referencia de conciliación (opcional)',
  'prompt.payment.reference.placeholder': 'Referencia de conciliación (opcional):',
  'prompt.payment.reference.confirm': 'Aceptar',
  'prompt.payment.reference.cancel': 'Cancelar',

  // Shared
  'common.cta.confirm': 'Confirmar',
  'common.cta.cancel': 'Cancelar',
  'common.confirm.action.title': 'Confirmar acción',

  // Customer details
  'customerDetails.toast.document.upload.success': 'Documento subido exitosamente',
  'customerDetails.toast.document.upload.error': 'Error al subir documento',
  'customerDetails.toast.document.delete.error': 'Error al eliminar',

  // Payouts
  'payouts.toast.loanNotFound': 'No se encontró el crédito asociado al pago.',

  // Dashboard
  'dashboard.module.title': 'Dashboard',
  'dashboard.module.subtitle': 'Resumen general de tu cuenta.',
  'dashboard.loading': 'Cargando dashboard...',
  'dashboard.cta.widgets': 'Widgets',
  'dashboard.cta.editLayout': 'Editar diseño',
  'dashboard.cta.saveLayout': 'Guardar diseño',
  'dashboard.widgetManager.title': 'Administrar widgets',
  'dashboard.kpi.scope.label': 'Alcance KPI',
  'dashboard.kpi.scope.lifetime': 'Totales acumulados históricos de la cartera.',
  'dashboard.chart.scope.label': 'Alcance gráfico',
  'dashboard.chart.scope.recent': 'El gráfico refleja únicamente actividad reciente.',
  'dashboard.chart.scope.currentRangePrefix': 'Rango actual del gráfico:',
  'dashboard.chart.range.last6': 'Últimos 6 periodos',
  'dashboard.chart.customerFallbackPrefix': 'Crédito',
  'dashboard.chart.disbursementRecovery.legend.disbursed': 'Desembolsado',
  'dashboard.chart.disbursementRecovery.legend.recovered': 'Recuperado',
  'dashboard.chart.disbursementRecovery.empty': 'No hay desembolsos ni recuperaciones para los periodos recientes.',
  'dashboard.chart.disbursementRecovery.emptyHint': 'Pruebe en Reportes para revisar periodos históricos.',
  'dashboard.chart.disbursementRecovery.emptyWithKpi': 'No hay actividad reciente, aunque existen totales históricos.',
  'dashboard.chart.disbursementRecovery.emptyWithKpiHint': 'Consulte Reportes para comparar rangos históricos completos.',
  'dashboard.error.title': 'No se pudo cargar el dashboard',
  'dashboard.error.retry': 'Reintentar',
  'dashboard.widget.balanceTotal.title': 'Balance total',
  'dashboard.widget.balanceTotal.subtitle': 'créditos en cartera',
  'dashboard.widget.activeLoans.title': 'Préstamos activos',
  'dashboard.widget.activeLoans.subtitle': 'en mora',
  'dashboard.widget.delinquencyRate.title': 'Tasa de mora',
  'dashboard.widget.delinquencyRate.subtitle': 'alertas activas',
  'dashboard.widget.totalRecovered.title': 'Total recuperado',
  'dashboard.widget.totalRecovered.subtitle': 'promesas pendientes',
  'dashboard.widget.disbursementEvolution.kicker': 'Actividad',
  'dashboard.widget.disbursementEvolution.title': 'Evolución de desembolsos',
  'dashboard.widget.disbursementEvolution.recordsRecent': 'registros recientes',
  'dashboard.widget.recoveryPerformance.kicker': 'Recuperación',
  'dashboard.widget.recoveryPerformance.title': 'Rendimiento de mora',
  'dashboard.widget.recoveryPerformance.subtitle': 'Recuperado vs desembolsado',
} as const;

export type TermKey = keyof typeof TERMINOLOGY;

const LEGACY_ALIASES: Partial<Record<TermKey, readonly string[]>> = {
  'sidebar.customers.directory': ['Directorio', 'Directorio de clientes'],
  'sidebar.customers.new': ['Nuevo Cliente', 'Alta clientes', 'Alta de cliente'],
  'sidebar.credits.portfolio': ['Cartera Activa', 'Cartera activa', 'Préstamos Activos', 'Carteras activas'],
  'sidebar.credits.origination': ['Originación'],
  'sidebar.payouts': ['Historial de Pagos'],
  'credits.module.title': ['Gestión de Créditos'],
  'credits.cta.new': ['Nuevo Crédito'],
  'payouts.module.title': ['Pagos y Cobranza'],
  'customers.cta.restore': ['Restaurar'],
  'reports.module.title': ['Reportes y Analíticas'],
};

type TermOptions = {
  legacy?: boolean;
};

export const tTerm = (key: TermKey, options?: TermOptions): string => {
  if (options?.legacy) {
    return LEGACY_ALIASES[key]?.[0] ?? TERMINOLOGY[key];
  }

  return TERMINOLOGY[key];
};

export const getTermAliases = (key: TermKey): readonly string[] => LEGACY_ALIASES[key] ?? [];
