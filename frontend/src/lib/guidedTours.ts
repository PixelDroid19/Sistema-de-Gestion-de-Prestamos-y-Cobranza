import { driver, type DriveStep } from 'driver.js';
import { tTerm, type TermKey } from '../i18n/terminology';

export type GuideRole = 'admin' | 'employee';
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
  titleKey: TermKey;
  descriptionKey: TermKey;
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
  employee?: GuideProducer;
};

const GUIDE_STEP_COPY_KEYS = [
  'dashboardPage',
  'dashboardHeader',
  'dashboardToolbar',
  'dashboardGrid',
  'customersPage',
  'customersHeader',
  'customersSearch',
  'customersFilters',
  'customersTable',
  'customerDetailsPage',
  'customerDetailsHeader',
  'customerDetailsTabs',
  'customerDetailsContent',
  'newCustomerPage',
  'newCustomerHeader',
  'newCustomerPersonal',
  'newCustomerContact',
  'creditsPage',
  'creditsPageTitle',
  'creditsExport',
  'creditsPreview',
  'creditsNew',
  'creditsTabs',
  'creditsSearch',
  'creditsFilters',
  'creditsListTable',
  'creditsRowActions',
  'newCreditPage',
  'newCreditHeader',
  'newCreditCustomerSelect',
  'newCreditBorrower',
  'newCreditLateFeeMode',
  'newCreditSimulation',
  'newCreditActionDock',
  'creditDetailPage',
  'creditDetailHeader',
  'creditDetailPrimaryActions',
  'creditDetailMetrics',
  'creditDetailTabs',
  'creditDetailCalendar',
  'creditDetailHistory',
  'paymentSchedulePage',
  'paymentScheduleHeader',
  'paymentScheduleSummary',
  'paymentScheduleTable',
  'associatesPage',
  'associatesHeader',
  'associatesSearch',
  'associatesTable',
  'associateDetailsPage',
  'associateDetailsHeader',
  'associateDetailsTabs',
  'associateDetailsContent',
  'newAssociatePage',
  'newAssociateHeader',
  'newAssociateForm',
  'payoutsPage',
  'payoutsHeader',
  'payoutsSearch',
  'payoutsTable',
  'notificationsPage',
  'notificationsHeader',
  'notificationsActions',
  'notificationsList',
  'reportsPage',
  'reportsHeader',
  'reportsTabs',
  'reportsContent',
  'settingsPage',
  'settingsHeader',
  'settingsTabs',
  'settingsContent',
  'profilePage',
  'profileHeader',
  'profileTabs',
  'profileContent',
  'auditLogPage',
  'auditLogHeader',
  'auditLogStats',
  'auditLogFilters',
  'auditLogTable',
  'creditCalculatorPage',
  'creditCalculatorHeader',
  'creditCalculatorSimulation',
  'creditCalculatorNext',
] as const;

type GuideStepCopyKey = (typeof GUIDE_STEP_COPY_KEYS)[number];
type GuideStepTitleTermKey = `guidedTour.step.${GuideStepCopyKey}.title`;
type GuideStepDescriptionTermKey = `guidedTour.step.${GuideStepCopyKey}.description`;

const asTermKey = <T extends TermKey>(key: T): T => key;

const getGuideStepTitleKey = (copyKey: GuideStepCopyKey): TermKey => (
  asTermKey(`guidedTour.step.${copyKey}.title` as GuideStepTitleTermKey)
);

const getGuideStepDescriptionKey = (copyKey: GuideStepCopyKey): TermKey => (
  asTermKey(`guidedTour.step.${copyKey}.description` as GuideStepDescriptionTermKey)
);

const guideStep = (selector: string, copyKey: GuideStepCopyKey, side?: GuideStep['side']): GuideStep => ({
  selector,
  titleKey: getGuideStepTitleKey(copyKey),
  descriptionKey: getGuideStepDescriptionKey(copyKey),
  ...(side ? { side } : {}),
});


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
          title: tTerm(raw.titleKey),
          description: tTerm(raw.descriptionKey),
          side: raw.side || 'bottom',
        },
      }
    : null;
};

const GUIDE_REGISTRY: Record<GuideViewKey, ViewGuideDefinition> = {
  dashboard: {
    default: [
      guideStep('[data-tour="dashboard-page"]', 'dashboardPage'),
      guideStep('[data-tour="dashboard-header"]', 'dashboardHeader'),
      guideStep('[data-tour="dashboard-toolbar"]', 'dashboardToolbar'),
      guideStep('[data-tour="dashboard-grid"]', 'dashboardGrid'),
    ],
  },
  customers: {
    default: [
      guideStep('[data-tour="customers-page"]', 'customersPage'),
      guideStep('[data-tour="customers-header"]', 'customersHeader'),
      guideStep('[data-tour="customers-search"]', 'customersSearch'),
      guideStep('[data-tour="customers-filters"]', 'customersFilters'),
      guideStep('[data-tour="customers-table"]', 'customersTable'),
    ],
  },
  'customer-details': {
    default: [
      guideStep('[data-tour="customer-details-page"]', 'customerDetailsPage'),
      guideStep('[data-tour="customer-details-header"]', 'customerDetailsHeader'),
      guideStep('[data-tour="customer-details-tabs"]', 'customerDetailsTabs'),
      guideStep('[data-tour="customer-details-content"]', 'customerDetailsContent'),
    ],
  },
  'new-customer': {
    default: [
      guideStep('[data-tour="new-customer-page"]', 'newCustomerPage'),
      guideStep('[data-tour="new-customer-header"]', 'newCustomerHeader'),
      guideStep('[data-tour="new-customer-personal"]', 'newCustomerPersonal'),
      guideStep('[data-tour="new-customer-contact"]', 'newCustomerContact'),
    ],
  },
  credits: {
    default: [
      guideStep('[data-tour="credits-page"]', 'creditsPage'),
      guideStep('[data-tour="credits-page-title"]', 'creditsPageTitle'),
      guideStep('[data-tour="credits-export"]', 'creditsExport'),
      guideStep('[data-tour="credits-preview"]', 'creditsPreview'),
      guideStep('[data-tour="credits-new"]', 'creditsNew'),
      guideStep('[data-tour="credits-tabs"]', 'creditsTabs'),
      guideStep('[data-tour="credits-search"]', 'creditsSearch'),
      guideStep('[data-tour="credits-filters"]', 'creditsFilters'),
      guideStep('[data-tour="credits-list-table"]', 'creditsListTable'),
      guideStep('[data-tour="credits-row-actions"]', 'creditsRowActions'),
    ],
  },
  'new-credit': {
    default: [
      guideStep('[data-tour="new-credit-page"]', 'newCreditPage'),
      guideStep('[data-tour="new-credit-header"]', 'newCreditHeader'),
      guideStep('[data-tour="new-credit-customer-select"]', 'newCreditCustomerSelect'),
      guideStep('[data-tour="new-credit-borrower"]', 'newCreditBorrower'),
      guideStep('[data-tour="new-credit-late-fee-mode"]', 'newCreditLateFeeMode'),
      guideStep('[data-tour="new-credit-simulation"]', 'newCreditSimulation'),
      guideStep('[data-tour="new-credit-action-dock"]', 'newCreditActionDock'),
    ],
  },
  'credit-details': {
    default: [
      guideStep('[data-tour="credit-detail-page"]', 'creditDetailPage'),
      guideStep('[data-tour="credit-detail-header"]', 'creditDetailHeader'),
      guideStep('[data-tour="credit-detail-primary-actions"]', 'creditDetailPrimaryActions'),
      guideStep('[data-tour="credit-detail-metrics"]', 'creditDetailMetrics'),
      guideStep('[data-tour="credit-detail-tabs"]', 'creditDetailTabs'),
      guideStep('[data-tour="credit-detail-calendar"]', 'creditDetailCalendar'),
      guideStep('[data-tour="credit-detail-history"]', 'creditDetailHistory'),
    ],
  },
  'payment-schedule': {
    default: [
      guideStep('[data-tour="payment-schedule-page"]', 'paymentSchedulePage'),
      guideStep('[data-tour="payment-schedule-header"]', 'paymentScheduleHeader'),
      guideStep('[data-tour="payment-schedule-summary"]', 'paymentScheduleSummary'),
      guideStep('[data-tour="payment-schedule-table"]', 'paymentScheduleTable'),
    ],
  },
  associates: {
    default: [
      guideStep('[data-tour="associates-page"]', 'associatesPage'),
      guideStep('[data-tour="associates-header"]', 'associatesHeader'),
      guideStep('[data-tour="associates-search"]', 'associatesSearch'),
      guideStep('[data-tour="associates-table"]', 'associatesTable'),
    ],
  },
  'associate-details': {
    default: [
      guideStep('[data-tour="associate-details-page"]', 'associateDetailsPage'),
      guideStep('[data-tour="associate-details-header"]', 'associateDetailsHeader'),
      guideStep('[data-tour="associate-details-tabs"]', 'associateDetailsTabs'),
      guideStep('[data-tour="associate-details-content"]', 'associateDetailsContent'),
    ],
  },
  'new-associate': {
    default: [
      guideStep('[data-tour="new-associate-page"]', 'newAssociatePage'),
      guideStep('[data-tour="new-associate-header"]', 'newAssociateHeader'),
      guideStep('[data-tour="new-associate-form"]', 'newAssociateForm'),
    ],
  },
  payouts: {
    default: [
      guideStep('[data-tour="payouts-page"]', 'payoutsPage'),
      guideStep('[data-tour="payouts-header"]', 'payoutsHeader'),
      guideStep('[data-tour="payouts-search"]', 'payoutsSearch'),
      guideStep('[data-tour="payouts-table"]', 'payoutsTable'),
    ],
  },
  notifications: {
    default: [
      guideStep('[data-tour="notifications-page"]', 'notificationsPage'),
      guideStep('[data-tour="notifications-header"]', 'notificationsHeader'),
      guideStep('[data-tour="notifications-actions"]', 'notificationsActions'),
      guideStep('[data-tour="notifications-list"]', 'notificationsList'),
    ],
  },
  reports: {
    default: [
      guideStep('[data-tour="reports-page"]', 'reportsPage'),
      guideStep('[data-tour="reports-header"]', 'reportsHeader'),
      guideStep('[data-tour="reports-tabs"]', 'reportsTabs'),
      guideStep('[data-tour="reports-content"]', 'reportsContent'),
    ],
  },
  settings: {
    default: [
      guideStep('[data-tour="settings-page"]', 'settingsPage'),
      guideStep('[data-tour="settings-header"]', 'settingsHeader'),
      guideStep('[data-tour="settings-tabs"]', 'settingsTabs'),
      guideStep('[data-tour="settings-content"]', 'settingsContent'),
    ],
  },
  profile: {
    default: [
      guideStep('[data-tour="profile-page"]', 'profilePage'),
      guideStep('[data-tour="profile-header"]', 'profileHeader'),
      guideStep('[data-tour="profile-tabs"]', 'profileTabs'),
      guideStep('[data-tour="profile-content"]', 'profileContent'),
    ],
  },
  'audit-log': {
    default: [
      guideStep('[data-tour="audit-log-page"]', 'auditLogPage'),
      guideStep('[data-tour="audit-log-header"]', 'auditLogHeader'),
      guideStep('[data-tour="audit-log-stats"]', 'auditLogStats'),
      guideStep('[data-tour="audit-log-filters"]', 'auditLogFilters'),
      guideStep('[data-tour="audit-log-table"]', 'auditLogTable'),
    ],
  },
  'credit-calculator': {
    default: [
      guideStep('[data-tour="credit-calculator-page"]', 'creditCalculatorPage'),
      guideStep('[data-tour="credit-calculator-header"]', 'creditCalculatorHeader'),
      guideStep('[data-tour="credit-calculator-simulation"]', 'creditCalculatorSimulation'),
      guideStep('[data-tour="credit-calculator-next"]', 'creditCalculatorNext'),
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
    nextBtnText: tTerm('guidedTour.nav.next'),
    prevBtnText: tTerm('guidedTour.nav.previous'),
    doneBtnText: tTerm('guidedTour.nav.done'),
    steps,
  });

  instance.drive();
  return instance;
};
