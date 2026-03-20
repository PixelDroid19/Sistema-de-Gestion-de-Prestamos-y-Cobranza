import {
  BellRing,
  FileText,
  PiggyBank,
  ShieldCheck,
  TrendingUp,
  Wallet,
} from 'lucide-react'

export function buildHomeLandingContent(t) {
  return {
    metrics: [
      {
        value: t('home.metrics.portfolio.value'),
        label: t('home.metrics.portfolio.label'),
      },
      {
        value: t('home.metrics.agents.value'),
        label: t('home.metrics.agents.label'),
      },
      {
        value: t('home.metrics.recoveries.value'),
        label: t('home.metrics.recoveries.label'),
      },
    ],
    proofPoints: [
      t('home.proofPoints.operations'),
      t('home.proofPoints.signals'),
      t('home.proofPoints.roles'),
    ],
    floatingBadges: [
      { label: t('home.floatingBadges.recovery'), variant: 'success' },
      { label: t('home.floatingBadges.alerts'), variant: 'accent' },
      { label: t('home.floatingBadges.approvals'), variant: 'gold' },
    ],
    phonePanels: [
      {
        kicker: t('home.phones.primary.kicker'),
        title: t('home.phones.primary.title'),
        value: t('home.phones.primary.value'),
        caption: t('home.phones.primary.caption'),
        icon: ShieldCheck,
        items: [
          t('home.phones.primary.items.queue'),
          t('home.phones.primary.items.promises'),
          t('home.phones.primary.items.followUp'),
        ],
      },
      {
        kicker: t('home.phones.secondary.kicker'),
        title: t('home.phones.secondary.title'),
        value: t('home.phones.secondary.value'),
        caption: t('home.phones.secondary.caption'),
        icon: Wallet,
        items: [
          t('home.phones.secondary.items.payments'),
          t('home.phones.secondary.items.associates'),
          t('home.phones.secondary.items.export'),
        ],
      },
    ],
    featureCards: [
      {
        icon: ShieldCheck,
        title: `${t('home.features.card1')} ${t('home.features.card1Break')}`,
        description: t('home.split.points.decisions.description'),
      },
      {
        icon: PiggyBank,
        title: `${t('home.features.card2')} ${t('home.features.card2Break')}`,
        description: t('home.split.points.recovery.description'),
      },
      {
        icon: TrendingUp,
        title: `${t('home.features.card3')} ${t('home.features.card3Break')}`,
        description: t('home.split.points.intake.description'),
      },
    ],
    splitPoints: [
      {
        title: t('home.split.points.intake.title'),
        description: t('home.split.points.intake.description'),
      },
      {
        title: t('home.split.points.decisions.title'),
        description: t('home.split.points.decisions.description'),
      },
      {
        title: t('home.split.points.recovery.title'),
        description: t('home.split.points.recovery.description'),
      },
    ],
    workflowCards: [
      {
        icon: BellRing,
        label: t('home.process.origination'),
        value: t('home.process.values.origination'),
        description: t('home.process.captions.origination'),
      },
      {
        icon: Wallet,
        label: t('home.process.servicing'),
        value: t('home.process.values.servicing'),
        description: t('home.process.captions.servicing'),
      },
      {
        icon: FileText,
        label: t('home.process.reporting'),
        value: t('home.process.values.reporting'),
        description: t('home.process.captions.reporting'),
      },
    ],
    experienceCards: [
      {
        tone: 'dark',
        value: t('home.experience.cards.command.value'),
        title: t('home.experience.cards.command.title'),
        description: t('home.experience.cards.command.description'),
      },
      {
        tone: 'light',
        value: t('home.experience.cards.routing.value'),
        title: t('home.experience.cards.routing.title'),
        description: t('home.experience.cards.routing.description'),
      },
      {
        tone: 'accent',
        value: t('home.experience.cards.transparency.value'),
        title: t('home.experience.cards.transparency.title'),
        description: t('home.experience.cards.transparency.description'),
      },
      {
        tone: 'soft',
        value: t('home.experience.cards.exports.value'),
        title: t('home.experience.cards.exports.title'),
        description: t('home.experience.cards.exports.description'),
      },
    ],
    worldStats: [
      { label: t('home.world.locations'), value: '60+' },
      { label: t('home.world.operations'), value: '20L+' },
      { label: t('home.world.portfolio'), value: '$900k' },
    ],
    worldRegions: [
      { city: t('home.world.regions.bogota.city'), detail: t('home.world.regions.bogota.detail') },
      { city: t('home.world.regions.medellin.city'), detail: t('home.world.regions.medellin.detail') },
      { city: t('home.world.regions.miami.city'), detail: t('home.world.regions.miami.detail') },
    ],
    processSteps: [
      {
        title: t('home.process.origination'),
        description: t('home.process.captions.origination'),
      },
      {
        title: t('home.process.servicing'),
        description: t('home.process.captions.servicing'),
      },
      {
        title: t('home.process.reporting'),
        description: t('home.process.captions.reporting'),
      },
    ],
    ctaActions: {
      primary: t('home.cta.primary'),
      secondary: t('home.cta.secondary'),
    },
  }
}
