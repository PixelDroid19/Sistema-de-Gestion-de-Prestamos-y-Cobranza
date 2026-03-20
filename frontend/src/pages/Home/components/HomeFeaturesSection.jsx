import React from 'react';
function HomeFeaturesSection({ t, featureCards }) {
  return (
    <section className="home-section home-section--white">
      <div className="home-section__container">
        <h2 className="home-section__title home-section__title--accent">
          {t('home.features.title1')} <br />
          <span className="home-section__title-dark">{t('home.features.titleHighlight')}</span>
        </h2>
        <p className="home-section__description home-section__description--wide">{t('home.features.description')}</p>

        <div className="features-grid">
          {featureCards.map(({ key, Icon, cardClassName, iconClassName, titleClassName, iconColor, titleKey, titleBreakKey }) => (
            <article key={key} className={cardClassName}>
              <div className={iconClassName}>
                <Icon size={36} color={iconColor} />
              </div>
              <h3 className={titleClassName}>
                {t(titleKey)} <br />
                {t(titleBreakKey)}
              </h3>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export default HomeFeaturesSection;
