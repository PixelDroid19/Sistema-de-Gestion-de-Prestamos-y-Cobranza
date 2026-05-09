import { driver, type DriveStep } from 'driver.js';

export type GuideRole = 'admin' | 'customer' | 'socio';
export type GuideViewKey =
  | 'dashboard'
  | 'customers'
  | 'customer-details'
  | 'new-customer'
  | 'credits'
  | 'new-credit'
  | 'credit-details'
  | 'payment-schedule'
  | 'associates'
  | 'associate-details'
  | 'new-associate'
  | 'payouts'
  | 'notifications'
  | 'reports'
  | 'settings'
  | 'profile'
  | 'audit-log'
  | 'credit-calculator';

export type GuideStep = {
  selector: string;
  title: string;
  description: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
};

export type TooltipDefinition = {
  label: string;
  description: string;
};

export type GuideContext = {
  role?: GuideRole;
  loanId?: number | string;
  entityId?: number | string;
};

type GuideProducer = GuideStep[] | ((context: GuideContext) => GuideStep[]);
type ViewGuideDefinition = {
  default?: GuideProducer;
  admin?: GuideProducer;
  customer?: GuideProducer;
  socio?: GuideProducer;
};

const isBrowserAvailable = () => typeof document !== 'undefined';

const hasElement = (selector: string): boolean => {
  if (!isBrowserAvailable()) {
    return false;
  }

  try {
    return Boolean(document.querySelector(selector));
  } catch {
    return false;
  }
};

const resolveProducer = (producer: GuideProducer | undefined, context: GuideContext): GuideStep[] => {
  if (!producer) return [];
  return typeof producer === 'function' ? producer(context) : producer;
};

const resolveGuideSteps = (definition: ViewGuideDefinition | undefined, context: GuideContext): GuideStep[] => {
  if (!definition) return [];
  const roleSteps = context.role ? resolveProducer(definition[context.role], context) : [];
  return [...resolveProducer(definition.default, context), ...roleSteps];
};

const resolveTourStep = (raw: GuideStep): DriveStep | null => {
  return hasElement(raw.selector)
    ? {
        element: raw.selector,
        popover: {
          title: raw.title,
          description: raw.description,
          side: raw.side || 'bottom',
        },
      }
    : null;
};

const GUIDE_REGISTRY: Record<GuideViewKey, ViewGuideDefinition> = {
  dashboard: {
    default: [
      { selector: '[data-tour="dashboard-page"]', title: 'Dashboard', description: 'Resume cartera, mora y actividad reciente para iniciar la operación diaria.' },
      { selector: '[data-tour="dashboard-header"]', title: 'Encabezado del panel', description: 'Desde aquí gestionas widgets y reordenas el tablero según tu operación.' },
      { selector: '[data-tour="dashboard-toolbar"]', title: 'Personalización', description: 'Muestra u oculta widgets. Úsalo para adaptar el panel a tu flujo.' },
      { selector: '[data-tour="dashboard-grid"]', title: 'Widgets', description: 'Cada tarjeta o gráfico muestra un indicador de negocio o una tendencia reciente.' },
    ],
  },
  customers: {
    default: [
      { selector: '[data-tour="customers-page"]', title: 'Clientes', description: 'Aquí administras la base de prestatarios y entras a su historial.' },
      { selector: '[data-tour="customers-header"]', title: 'Acciones del módulo', description: 'Puedes crear un cliente nuevo y revisar el estado general del listado.' },
      { selector: '[data-tour="customers-search"]', title: 'Búsqueda', description: 'Busca por nombre, correo o documento antes de editar o crear un crédito.' },
      { selector: '[data-tour="customers-filters"]', title: 'Filtros', description: 'Acota la lista por estado o fecha de registro.' },
      { selector: '[data-tour="customers-table"]', title: 'Tabla de clientes', description: 'Abre detalle, edita, desactiva o reactiva cada cliente desde su fila.' },
    ],
  },
  'customer-details': {
    default: [
      { selector: '[data-tour="customer-details-page"]', title: 'Detalle del cliente', description: 'Reúne perfil, documentos, créditos e historial del cliente.' },
      { selector: '[data-tour="customer-details-header"]', title: 'Resumen del cliente', description: 'Muestra identidad, documento y estado actual del perfil.' },
      { selector: '[data-tour="customer-details-tabs"]', title: 'Pestañas', description: 'Separa información personal, documentos, préstamos e historial.' },
      { selector: '[data-tour="customer-details-content"]', title: 'Contenido operativo', description: 'Aquí se ejecutan cargas de documentos y navegación hacia créditos relacionados.' },
    ],
  },
  'new-customer': {
    default: [
      { selector: '[data-tour="new-customer-page"]', title: 'Alta de cliente', description: 'Registra o edita un cliente que luego podrá recibir créditos.' },
      { selector: '[data-tour="new-customer-header"]', title: 'Guardar o cancelar', description: 'Estas acciones afectan el perfil del cliente, no crean todavía un crédito.' },
      { selector: '[data-tour="new-customer-personal"]', title: 'Datos personales', description: 'Captura identidad y estado del cliente. El documento debe quedar correcto antes de operar.' },
      { selector: '[data-tour="new-customer-contact"]', title: 'Contacto y dirección', description: 'Estos datos sirven para seguimiento, notificaciones y trazabilidad.' },
    ],
  },
  credits: {
    default: [
      { selector: '[data-tour="credits-page"]', title: 'Módulo de créditos', description: 'Aquí gestionas todos los créditos vivos y en mora de la cartera.' },
      { selector: '[data-tour="credits-page-title"]', title: 'Encabezado', description: 'Desde aquí navegas acciones del módulo y mides su estado.' },
      { selector: '[data-tour="credits-export"]', title: 'Exportar cartera', description: 'Descarga el estado actual en Excel para reconciliación y respaldo.' },
      { selector: '[data-tour="credits-preview"]', title: 'Previsualizar crédito', description: 'Simula escenarios antes de crear un crédito real.' },
      { selector: '[data-tour="credits-new"]', title: 'Crear crédito', description: 'Abre el flujo de origen para registrar un crédito con el perfil de cálculo activo.' },
      { selector: '[data-tour="credits-tabs"]', title: 'Vista principal', description: 'Alterna entre créditos vigentes y calendario para operación diaria.' },
      { selector: '[data-tour="credits-search"]', title: 'Búsqueda y filtros', description: 'Filtra por cliente, estado y fechas para encontrar el préstamo correcto.' },
      { selector: '[data-tour="credits-filters"]', title: 'Filtros avanzados', description: 'Ajusta montos y fechas antes de buscar.' },
      { selector: '[data-tour="credits-list-table"]', title: 'Lista de créditos', description: 'Revisa estados, saldo y acciones disponibles de cada préstamo.' },
      { selector: '[data-tour="credits-row-actions"]', title: 'Acciones de crédito', description: 'Ver detalle, pagar cuota o registrar promesas desde la fila.' },
    ],
  },
  'new-credit': {
    default: [
      { selector: '[data-tour="new-credit-page"]', title: 'Nuevo crédito', description: 'Este flujo registra un crédito real y congela la fórmula usada en ese momento.' },
      { selector: '[data-tour="new-credit-header"]', title: 'Qué estás registrando', description: 'La validación aquí usa el perfil de cálculo activo. Registrar crea un crédito real en cartera.' },
      { selector: '[data-tour="new-credit-customer-select"]', title: 'Cliente del crédito', description: 'Debes seleccionar al titular antes de validar y registrar.' },
      { selector: '[data-tour="new-credit-associate"]', title: 'Socio asignado', description: 'Es opcional y sirve para relación interna o participación. No cambia cuota, tasa ni mora.' },
      { selector: '[data-tour="new-credit-policy-summary"]', title: 'Políticas sugeridas', description: 'Muestra tasa y mora resueltas desde configuración antes de ajustar parámetros.' },
      { selector: '[data-tour="new-credit-late-fee-mode"]', title: 'Modo de mora', description: 'Define cómo reaccionará el crédito si una cuota se vence.' },
      { selector: '[data-tour="new-credit-simulation"]', title: 'Simulación y cronograma', description: 'Revisa cuota, intereses, total a pagar y tabla de amortización antes de registrar.' },
      { selector: '[data-tour="new-credit-action-dock"]', title: 'Acciones de registro', description: 'Restablece, valida o registra desde el cierre del formulario sin tapar la información revisada.' },
    ],
  },
  'credit-details': {
    default: (context) => {
      const loanLabel = context.loanId ? ` del crédito #${String(context.loanId)}` : '';
      return [
        { selector: '[data-tour="credit-detail-page"]', title: 'Detalle del crédito', description: `Aquí operas pagos, seguimiento y cronograma${loanLabel}.` },
        { selector: '[data-tour="credit-detail-header"]', title: 'Encabezado del crédito', description: 'Muestra cliente, fórmula congelada y estado operativo actual.' },
        { selector: '[data-tour="credit-detail-primary-actions"]', title: 'Acciones críticas', description: 'Desde aquí registras pagos o gestionas acciones operativas disponibles.' },
        { selector: '[data-tour="credit-detail-metrics"]', title: 'Indicadores', description: 'Resume capital vivo, interés, cuotas y mora para decidir la acción siguiente.' },
        { selector: '[data-tour="credit-detail-tabs"]', title: 'Pestañas', description: 'Separan calendario, alertas, compromisos, historial de pagos y payoff.' },
        { selector: '[data-tour="credit-detail-calendar"]', title: 'Calendario operativo', description: 'Aquí confirmas la próxima cuota operable y el estado de cada cuota.' },
        { selector: '[data-tour="credit-detail-history"]', title: 'Historial', description: 'Muestra trazabilidad de acciones y pagos aplicados.' },
      ];
    },
  },
  'payment-schedule': {
    default: [
      { selector: '[data-tour="payment-schedule-page"]', title: 'Plan de pagos', description: 'Desglosa el cronograma completo de amortización del crédito.' },
      { selector: '[data-tour="payment-schedule-header"]', title: 'Resumen superior', description: 'Muestra cliente, exportación y acceso de regreso al detalle del crédito.' },
      { selector: '[data-tour="payment-schedule-summary"]', title: 'Resumen financiero', description: 'Resume capital, interés, plazo y estado general del cronograma.' },
      { selector: '[data-tour="payment-schedule-table"]', title: 'Tabla de amortización', description: 'Cada fila representa una cuota con capital, interés, pagado y saldo restante.' },
    ],
  },
  associates: {
    default: [
      { selector: '[data-tour="associates-page"]', title: 'Socios', description: 'Administra socios relacionados con cartera, aportes o seguimiento interno.' },
      { selector: '[data-tour="associates-header"]', title: 'Acciones del módulo', description: 'Desde aquí creas socios o exportas la relación actual.' },
      { selector: '[data-tour="associates-search"]', title: 'Búsqueda y filtros', description: 'Encuentra socios por nombre y acota la lista por estado.' },
      { selector: '[data-tour="associates-table"]', title: 'Tabla de socios', description: 'Consulta participación, préstamos relacionados y acciones disponibles.' },
    ],
  },
  'associate-details': {
    default: [
      { selector: '[data-tour="associate-details-page"]', title: 'Portal del socio', description: 'Muestra aportes, distribuciones, cuotas y calendario asociado al socio.' },
      { selector: '[data-tour="associate-details-header"]', title: 'Resumen del socio', description: 'Desde aquí accedes a historiales y, si eres admin, registras movimientos.' },
      { selector: '[data-tour="associate-details-tabs"]', title: 'Pestañas del portal', description: 'Separa resumen, cuotas y calendario para lectura clara.' },
      { selector: '[data-tour="associate-details-content"]', title: 'Contenido principal', description: 'Aquí revisas saldos, eventos y actividad del socio.' },
    ],
  },
  'new-associate': {
    default: [
      { selector: '[data-tour="new-associate-page"]', title: 'Alta de socio', description: 'Registra o edita un socio operativo dentro de la plataforma.' },
      { selector: '[data-tour="new-associate-header"]', title: 'Guardar o cancelar', description: 'Estos controles crean o actualizan el socio, no afectan todavía créditos.' },
      { selector: '[data-tour="new-associate-form"]', title: 'Formulario del socio', description: 'Captura nombre, contacto, estado y participación sobre utilidades.' },
    ],
  },
  payouts: {
    default: [
      { selector: '[data-tour="payouts-page"]', title: 'Pagos y cobranza', description: 'Reúne recibos, aplicación de pagos y consulta global por préstamo.' },
      { selector: '[data-tour="payouts-header"]', title: 'Registrar pago', description: 'Abre el flujo de pago permitido según rol y estado operativo.' },
      { selector: '[data-tour="payouts-search"]', title: 'Búsqueda', description: 'Localiza pagos por cliente o préstamo.' },
      { selector: '[data-tour="payouts-table"]', title: 'Tabla de pagos', description: 'Revisa método, estado, comprobante y acciones por recibo.' },
    ],
  },
  notifications: {
    default: [
      { selector: '[data-tour="notifications-page"]', title: 'Notificaciones', description: 'Reúne alertas, novedades y enlaces al origen de cada evento.' },
      { selector: '[data-tour="notifications-header"]', title: 'Resumen del buzón', description: 'Muestra cantidad no leída y controles principales.' },
      { selector: '[data-tour="notifications-actions"]', title: 'Acciones rápidas', description: 'Permite marcar leídas o limpiar el buzón actual.' },
      { selector: '[data-tour="notifications-list"]', title: 'Lista de notificaciones', description: 'Cada tarjeta muestra mensaje, fecha y acceso a su origen cuando aplica.' },
    ],
  },
  reports: {
    default: [
      { selector: '[data-tour="reports-page"]', title: 'Reportes', description: 'Consulta indicadores, mora, rentabilidad y exportes operativos.' },
      { selector: '[data-tour="reports-header"]', title: 'Exportes', description: 'Descarga reportes generales o contextuales según filtros aplicados.' },
      { selector: '[data-tour="reports-tabs"]', title: 'Vistas del módulo', description: 'Alterna entre dashboard, mora, rentabilidad, pagos y calendario.' },
      { selector: '[data-tour="reports-content"]', title: 'Contenido del reporte', description: 'Cada pestaña cambia el conjunto de gráficos, métricas o tablas visibles.' },
    ],
  },
  settings: {
    default: [
      { selector: '[data-tour="settings-page"]', title: 'Configuración', description: 'Centraliza políticas de tasa, mora, métodos de pago y permisos.' },
      { selector: '[data-tour="settings-header"]', title: 'Resumen del módulo', description: 'Aquí ajustas catálogos y reglas que alimentan el flujo real de créditos.' },
      { selector: '[data-tour="settings-tabs"]', title: 'Pestañas de configuración', description: 'Cada pestaña administra un conjunto distinto de políticas operativas.' },
      { selector: '[data-tour="settings-content"]', title: 'Formulario o tabla activa', description: 'Edita o crea la configuración seleccionada desde este panel.' },
    ],
  },
  profile: {
    default: [
      { selector: '[data-tour="profile-page"]', title: 'Perfil', description: 'Administra tus datos personales y la seguridad de tu cuenta.' },
      { selector: '[data-tour="profile-header"]', title: 'Identidad de cuenta', description: 'Muestra tu rol actual y el alcance general del perfil.' },
      { selector: '[data-tour="profile-tabs"]', title: 'Información y seguridad', description: 'Separa datos de perfil y cambio de contraseña.' },
      { selector: '[data-tour="profile-content"]', title: 'Formulario activo', description: 'Guarda cambios en tus datos o actualiza la contraseña según la pestaña.' },
    ],
  },
  'audit-log': {
    default: [
      { selector: '[data-tour="audit-log-page"]', title: 'Auditoría operativa', description: 'Permite investigar quién hizo una acción, desde qué IP y sobre qué módulo.' },
      { selector: '[data-tour="audit-log-header"]', title: 'Encabezado de auditoría', description: 'Resume el propósito del módulo y su uso para diagnóstico.' },
      { selector: '[data-tour="audit-log-stats"]', title: 'Indicadores técnicos', description: 'Muestran volumen, IPs visibles, servicio más activo y patrón de acciones.' },
      { selector: '[data-tour="audit-log-filters"]', title: 'Filtros', description: 'Acota por usuario, módulo, acción, IP o rango de fechas.' },
      { selector: '[data-tour="audit-log-table"]', title: 'Tabla de eventos', description: 'Abre el detalle técnico y filtra toda la actividad vinculada a una IP.' },
    ],
  },
  'credit-calculator': {
    default: [
      { selector: '[data-tour="credit-calculator-page"]', title: 'Previsualizar crédito', description: 'Simula el crédito con el perfil de cálculo activo antes de crear uno real.' },
      { selector: '[data-tour="credit-calculator-header"]', title: 'Controles del simulador', description: 'Vuelve a créditos o pasa el escenario validado a originación.' },
      { selector: '[data-tour="credit-calculator-simulation"]', title: 'Simulación', description: 'Aquí ajustas monto, tasa, plazo, mora y revisas el cronograma.' },
      { selector: '[data-tour="credit-calculator-next"]', title: 'Continuar a registro', description: 'Cuando el escenario sirve, lo envías a Nuevo crédito sin rearmarlo.' },
    ],
  },
};

export const hasGuideDefinition = (viewKey: GuideViewKey, role?: GuideRole) => {
  const definition = GUIDE_REGISTRY[viewKey];
  if (!definition) return false;
  if (resolveProducer(definition.default, { role }).length > 0) return true;
  if (role && resolveProducer(definition[role], { role }).length > 0) return true;
  return false;
};

export const startViewGuide = (viewKey: GuideViewKey, context: GuideContext = {}) => {
  if (!isBrowserAvailable()) {
    return null;
  }

  const rawSteps = resolveGuideSteps(GUIDE_REGISTRY[viewKey], context);
  if (rawSteps.length === 0) {
    return null;
  }

  const steps = rawSteps
    .map(resolveTourStep)
    .filter((step): step is DriveStep => step !== null);

  if (steps.length === 0) {
    return null;
  }

  const instance = driver({
    overlayColor: 'var(--color-bg-overlay, #0f172a)',
    overlayOpacity: 0.28,
    showButtons: ['next', 'previous', 'close'],
    animate: true,
    showProgress: true,
    smoothScroll: true,
    stagePadding: 6,
    popoverOffset: 12,
    nextBtnText: 'Siguiente',
    prevBtnText: 'Anterior',
    doneBtnText: 'Terminar',
    steps,
  });

  instance.drive();
  return instance;
};
