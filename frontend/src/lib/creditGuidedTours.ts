import { driver, type DriveStep } from 'driver.js';

type TourContext = {
  loanId?: number | string;
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

const resolveTourStep = (raw: { selector: string; title: string; description: string }): DriveStep | null => {
  return hasElement(raw.selector)
    ? {
      element: raw.selector,
      popover: {
        title: raw.title,
        description: raw.description,
        side: 'bottom',
      },
    }
    : null;
};

const runTour = (rawSteps: Array<{ selector: string; title: string; description: string }>) => {
  if (!isBrowserAvailable() || rawSteps.length === 0) {
    return;
  }

  const steps = rawSteps
    .map(resolveTourStep)
    .filter((step): step is DriveStep => step !== null);

  if (steps.length === 0) {
    return;
  }

  const instance = driver({
    overlayColor: 'var(--color-bg-overlay, #0f172a)',
    overlayOpacity: 0.35,
    showButtons: ['next', 'previous', 'close'],
    animate: true,
    showProgress: true,
    smoothScroll: true,
    stagePadding: 5,
    popoverOffset: 12,
    steps,
  });

  instance.drive();

  return instance;
};

export const startCreditsTour = () => {
  return runTour([
    {
      selector: '[data-tour="credits-page"]',
      title: 'Módulo de créditos',
      description: 'Aquí gestionas todos los créditos vivos y en mora de la cartera.',
    },
    {
      selector: '[data-tour="credits-page-title"]',
      title: 'Encabezado',
      description: 'Desde aquí navegas acciones del módulo y mides su estado.',
    },
    {
      selector: '[data-tour="credits-export"]',
      title: 'Exportar cartera',
      description: 'Descarga el estado actual en Excel para reconciliación y respaldo.',
    },
    {
      selector: '[data-tour="credits-preview"]',
      title: 'Previsualizar crédito',
      description: 'Simula escenarios antes de crear un crédito real.',
    },
    {
      selector: '[data-tour="credits-new"]',
      title: 'Crear crédito',
      description: 'Abre el flujo de origen para registrar un crédito con la fórmula activa.',
    },
    {
      selector: '[data-tour="credits-tabs"]',
      title: 'Vista principal',
      description: 'Alterna entre créditos vigentes y calendario para operación diaria.',
    },
    {
      selector: '[data-tour="credits-search"]',
      title: 'Búsqueda y filtros',
      description: 'Filtra por cliente, estado y fechas para encontrar el préstamo correcto.',
    },
    {
      selector: '[data-tour="credits-filters"]',
      title: 'Filtros avanzados',
      description: 'Ajusta montos y fechas antes de buscar.',
    },
    {
      selector: '[data-tour="credits-list-table"]',
      title: 'Lista de créditos',
      description: 'Revisa estados, saldo y acciones disponibles de cada préstamo.',
    },
    {
      selector: '[data-tour="credits-row-actions"]',
      title: 'Acciones de crédito',
      description: 'Ver detalle, pagar cuota o registrar promesas desde la fila.',
    },
  ]);
};

export const startNewCreditTour = () => {
  return runTour([
    {
      selector: '[data-tour="new-credit-page"]',
      title: 'Nuevo crédito',
      description: 'Este flujo crea un crédito real con la fórmula activa del sistema.',
    },
    {
      selector: '[data-tour="new-credit-header"]',
      title: 'Información inicial',
      description: 'Confirma cliente y responsable antes de validar la simulación.',
    },
    {
      selector: '[data-tour="new-credit-customer"]',
      title: 'Seleccionar cliente',
      description: 'Asigna el crédito al cliente y opcionalmente a un socio.',
    },
    {
      selector: '[data-tour="new-credit-associate"]',
      title: 'Socio responsable',
      description: 'Define quién participa en el crédito si aplica.',
    },
    {
      selector: '[data-tour="new-credit-policy-summary"]',
      title: 'Resumen de política',
      description: 'Estas tasas y mora salen de configuración y sirven para validar resultados.',
    },
    {
      selector: '[data-tour="new-credit-simulation"]',
      title: 'Simulación y cronograma',
      description: 'Ajusta capital, tasa y plazo para revisar cuota, mora y total.',
    },
    {
      selector: '[data-tour="new-credit-validate"]',
      title: 'Validar crédito',
      description: 'La validación confirma el cálculo con la fórmula activa.',
    },
    {
      selector: '[data-tour="new-credit-submit"]',
      title: 'Registrar',
      description: 'Al registrar, se guarda el crédito con la fórmula y versión activa.',
    },
  ]);
};

export const startCreditDetailsTour = (context?: TourContext) => {
  const loan = context?.loanId ? `#${String(context.loanId)}` : '';
  const loanScope = loan ? ` (crédito ${loan})` : '';

  return runTour([
    {
      selector: '[data-tour="credit-detail-page"]',
      title: 'Detalle de crédito',
      description: `Revisa y opera los datos principales del crédito${loanScope}.`,
    },
    {
      selector: '[data-tour="credit-detail-header"]',
      title: 'Estado y fórmula aplicada',
      description: 'No edita la fórmula; solo muestra qué versión quedó congelada al crear el préstamo.',
    },
    {
      selector: '[data-tour="credit-detail-primary-actions"]',
      title: 'Acciones críticas',
      description: 'Aquí puedes registrar pago, abono a capital y administrar mora o estado.',
    },
    {
      selector: '[data-tour="credit-detail-metrics"]',
      title: 'Indicadores operativos',
      description: 'Valores base para tomar decisiones de cobranza.',
    },
    {
      selector: '[data-tour="credit-detail-tabs"]',
      title: 'Pestañas operativas',
      description: 'Calendario, alertas, promesas, pagos, payoff y historial.',
    },
    {
      selector: '[data-tour="credit-detail-calendar"]',
      title: 'Cronograma',
      description: 'Confirma la siguiente cuota operable y revisa bloqueos.',
    },
    {
      selector: '[data-tour="credit-detail-installment-row"]',
      title: 'Fila de cuota',
      description: 'Cada cuota muestra estado, intereses y capital vivo; usa acciones de pago/compromiso en orden.',
    },
    {
      selector: '[data-tour="credit-detail-history"]',
      title: 'Historial operativo',
      description: 'Registra quién hizo cada acción y facilita auditoría y seguimiento.',
    },
  ]);
};
