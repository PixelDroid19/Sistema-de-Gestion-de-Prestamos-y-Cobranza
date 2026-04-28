import { driver, type DriveStep } from 'driver.js';

type TourContext = {
  loanId?: number | string;
};

type RawTourStep = {
  selector: string;
  title: string;
  description: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
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

const resolveTourStep = (raw: RawTourStep): DriveStep | null => {
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

const runTour = (rawSteps: RawTourStep[]) => {
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
    nextBtnText: 'Siguiente',
    prevBtnText: 'Anterior',
    doneBtnText: 'Terminar',
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
      description: 'Este flujo registra un crédito real. Primero eliges cliente, luego validas el cálculo y al final guardas el crédito con la versión de fórmula vigente.',
    },
    {
      selector: '[data-tour="new-credit-header"]',
      title: 'Qué estás creando',
      description: 'Esta pantalla no es un simulador aislado: lo que registres aquí entra a la cartera real y conserva la fórmula usada al momento de crear el crédito.',
    },
    {
      selector: '[data-tour="new-credit-customer-select"]',
      title: 'Cliente del crédito',
      description: 'Selecciona la persona que recibirá el préstamo. Sin cliente no se puede registrar porque el plan de pagos debe quedar asociado a un titular.',
      side: 'bottom',
    },
    {
      selector: '[data-tour="new-credit-associate"]',
      title: 'Socio asignado',
      description: 'Es opcional. Úsalo si un socio participa o debe quedar relacionado para seguimiento interno. No cambia la cuota, la tasa, la mora ni el cronograma.',
    },
    {
      selector: '[data-tour="new-credit-policy-summary"]',
      title: 'Políticas aplicadas',
      description: 'Aquí ves la tasa sugerida y la política de mora tomada de Configuración. Puedes ajustar parámetros, pero la validación mostrará el impacto antes de registrar.',
    },
    {
      selector: '[data-tour="new-credit-late-fee-mode"]',
      title: 'Modo de mora',
      description: 'Define qué pasa si una cuota se vence: sin mora, interés simple, compuesto, cargo fijo o tramos. Lee cada opción y usa solo la política aprobada para el producto.',
    },
    {
      selector: '[data-tour="new-credit-simulation"]',
      title: 'Parámetros y cronograma',
      description: 'Ajusta monto, tasa, plazo y fecha. Después de validar, revisa cuota, total a pagar, intereses y tabla de amortización antes de registrar.',
    },
    {
      selector: '[data-tour="new-credit-action-dock"]',
      title: 'Acciones siempre visibles',
      description: 'Esta barra evita subir y bajar en la pantalla. Desde aquí puedes restablecer datos, validar de nuevo o registrar cuando el sistema indique que está listo.',
      side: 'top',
    },
    {
      selector: '[data-tour="new-credit-validate"]',
      title: 'Validar antes de guardar',
      description: 'Validar no crea el crédito. Solo ejecuta el cálculo real para que confirmes cuota, intereses y cronograma con la fórmula activa.',
      side: 'top',
    },
    {
      selector: '[data-tour="new-credit-submit"]',
      title: 'Registrar crédito',
      description: 'Este botón se habilita cuando hay cliente y cálculo validado. Al registrar, el crédito queda en cartera y conserva la versión exacta de fórmula usada.',
      side: 'top',
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
