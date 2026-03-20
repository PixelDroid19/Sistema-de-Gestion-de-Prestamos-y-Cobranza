export const homeContentMock = {
  featureCards: [
    {
      key: 'portfolio',
      icon: 'shield-check',
      tone: 'sky',
      titleKey: 'home.features.card1',
      titleBreakKey: 'home.features.card1Break',
    },
    {
      key: 'collections',
      icon: 'piggy-bank',
      tone: 'amber',
      titleKey: 'home.features.card2',
      titleBreakKey: 'home.features.card2Break',
    },
    {
      key: 'goals',
      icon: 'trending-up',
      tone: 'orange',
      titleKey: 'home.features.card3',
      titleBreakKey: 'home.features.card3Break',
    },
  ],
  controlItems: ['home.control.item1', 'home.control.item2', 'home.control.item3'],
  bentoStats: [
    {
      key: 'loansManaged',
      value: '150+',
      labelKey: 'home.bento.loansManaged',
    },
    {
      key: 'activeAgents',
      value: '60+',
      labelKey: 'home.bento.activeAgents',
    },
  ],
  storeButtons: {
    hero: [
      {
        key: 'hero-app-store',
        platform: 'apple',
        theme: 'dark',
        eyebrowKey: 'home.hero.downloadApple',
        label: 'App Store',
      },
      {
        key: 'hero-google-play',
        platform: 'play',
        theme: 'dark',
        eyebrowKey: 'home.hero.availablePlay',
        label: 'Google Play',
        iconFill: 'white',
      },
    ],
    footer: [
      {
        key: 'footer-app-store',
        platform: 'apple',
        theme: 'light',
        eyebrowKey: 'home.hero.downloadApple',
        label: 'App Store',
      },
      {
        key: 'footer-google-play',
        platform: 'play',
        theme: 'mint',
        eyebrowKey: 'home.hero.availablePlay',
        label: 'Google Play',
        iconFill: '#111827',
      },
    ],
  },
  worldMarkers: [
    {
      key: 'north-america',
      icon: 'users',
      className: 'home-world__marker home-world__marker--one',
      size: 28,
    },
    {
      key: 'europe',
      icon: 'users',
      className: 'home-world__marker home-world__marker--two',
      size: 24,
    },
    {
      key: 'south-america',
      icon: 'users',
      className: 'home-world__marker home-world__marker--three',
      size: 32,
    },
    {
      key: 'hq',
      icon: 'map-pin',
      className: 'home-world__marker home-world__marker--center',
      size: 40,
    },
  ],
  worldStats: [
    {
      key: 'locations',
      icon: 'map-pin',
      value: '60+',
      labelKey: 'home.world.locations',
      tone: 'primary',
    },
    {
      key: 'operations',
      icon: 'users',
      value: '20L+',
      labelKey: 'home.world.operations',
      tone: 'sky',
    },
    {
      key: 'portfolio',
      icon: 'piggy-bank',
      value: '$900k',
      labelKey: 'home.world.portfolio',
      tone: 'emerald',
    },
  ],
}
