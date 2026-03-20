import React from 'react';
import { MapPin, Users } from 'lucide-react';

function HomeWorldSection({ t, worldStats }) {
  return (
    <section className="home-section home-section--muted home-section--centered">
      <div className="home-section__container home-section__container--centered">
        <h2 className="home-world__title">
          {t('home.world.title1')} <span className="home-world__title-accent">LendFlow</span>
        </h2>
        <p className="home-world__description">{t('home.world.description')}</p>

        <div className="home-world__map">
          <div className="home-world__map-canvas">
            <div className="home-world__marker home-world__marker--one">
              <Users size={28} />
            </div>
            <div className="home-world__marker home-world__marker--two">
              <Users size={24} />
            </div>
            <div className="home-world__marker home-world__marker--three">
              <Users size={32} />
            </div>
            <div className="home-world__marker home-world__marker--center">
              <MapPin size={40} />
            </div>
          </div>
        </div>

        <div className="stats-row">
          {worldStats.map(({ key, Icon, value, labelKey, iconClassName }) => (
            <div key={key} className="home-stat">
              <span className={iconClassName}>
                <Icon size={40} />
              </span>
              <div className="home-stat__value">{value}</div>
              <div className="home-stat__label">{t(labelKey)}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default HomeWorldSection;
