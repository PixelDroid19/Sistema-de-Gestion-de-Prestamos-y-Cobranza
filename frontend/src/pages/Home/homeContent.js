import { MapPin, PiggyBank, ShieldCheck, TrendingUp, Users } from 'lucide-react';

export const featureCards = [
  {
    key: 'portfolio',
    Icon: ShieldCheck,
    cardClassName: 'feature-card feature-card--sky',
    iconClassName: 'feature-card__icon-shell feature-card__icon-shell--sky',
    titleClassName: 'feature-card__title feature-card__title--sky',
    iconColor: '#0284C7',
    titleKey: 'home.features.card1',
    titleBreakKey: 'home.features.card1Break',
  },
  {
    key: 'collections',
    Icon: PiggyBank,
    cardClassName: 'feature-card feature-card--amber',
    iconClassName: 'feature-card__icon-shell feature-card__icon-shell--amber',
    titleClassName: 'feature-card__title feature-card__title--amber',
    iconColor: '#D97706',
    titleKey: 'home.features.card2',
    titleBreakKey: 'home.features.card2Break',
  },
  {
    key: 'goals',
    Icon: TrendingUp,
    cardClassName: 'feature-card feature-card--orange',
    iconClassName: 'feature-card__icon-shell feature-card__icon-shell--orange',
    titleClassName: 'feature-card__title feature-card__title--orange',
    iconColor: '#EA580C',
    titleKey: 'home.features.card3',
    titleBreakKey: 'home.features.card3Break',
  },
];

export const controlItemKeys = ['home.control.item1', 'home.control.item2', 'home.control.item3'];

export const worldStats = [
  {
    key: 'locations',
    Icon: MapPin,
    value: '60+',
    labelKey: 'home.world.locations',
    iconClassName: 'home-stat__icon home-stat__icon--primary',
  },
  {
    key: 'operations',
    Icon: Users,
    value: '20L+',
    labelKey: 'home.world.operations',
    iconClassName: 'home-stat__icon home-stat__icon--sky',
  },
  {
    key: 'portfolio',
    Icon: PiggyBank,
    value: '$900k',
    labelKey: 'home.world.portfolio',
    iconClassName: 'home-stat__icon home-stat__icon--emerald',
  },
];
