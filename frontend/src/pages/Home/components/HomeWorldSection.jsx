import React from 'react';

import { MapPin, PiggyBank, Users } from 'lucide-react';

import HomeSectionHeading from '@/pages/Home/components/HomeSectionHeading';

import './HomeWorldSection.scss';

const WORLD_ICON_MAP = {
  'map-pin': MapPin,
  'piggy-bank': PiggyBank,
  users: Users,
};

function HomeWorldSection({ t, worldStats, worldMarkers }) {
  return (
    <section className="home-section home-section--muted home-section--centered">
      <div className="home-section__container home-section__container--centered">
        <HomeSectionHeading
          t={t}
          titleKey="home.world.title1"
          highlightText="LendFlow"
          descriptionKey="home.world.description"
          inlineHighlight
          titleClassName="home-world__title"
          highlightClassName="home-world__title-accent"
          descriptionClassName="home-world__description"
        />

        <div className="home-world__map">
          <div className="home-world__map-canvas">
            {worldMarkers.map(({ key, icon, className, size }) => {
              const Icon = WORLD_ICON_MAP[icon] ?? Users;

              return (
                <div key={key} className={className}>
                  <Icon size={size} />
                </div>
              );
            })}
          </div>
        </div>

        <div className="stats-row">
          {worldStats.map(({ key, icon, value, labelKey, tone }) => {
            const Icon = WORLD_ICON_MAP[icon] ?? MapPin;

            return (
            <div key={key} className="home-stat">
              <span className={`home-stat__icon home-stat__icon--${tone}`}>
                <Icon size={40} />
              </span>
              <div className="home-stat__value">{value}</div>
              <div className="home-stat__label">{t(labelKey)}</div>
            </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default HomeWorldSection;
