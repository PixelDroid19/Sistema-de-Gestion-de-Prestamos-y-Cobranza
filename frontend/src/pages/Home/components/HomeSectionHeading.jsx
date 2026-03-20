import React from 'react'

function HomeSectionHeading({
  t,
  titleKey,
  highlightKey,
  highlightText,
  descriptionKey,
  inlineHighlight = false,
  className = '',
  titleClassName = 'home-section__title home-section__title--accent',
  highlightClassName = 'home-section__title-dark',
  descriptionClassName = 'home-section__description',
}) {
  const resolvedHighlight = highlightText ?? (highlightKey ? t(highlightKey) : '')

  return (
    <div className={className}>
      <h2 className={titleClassName}>
        {t(titleKey)}
        {resolvedHighlight ? (
          inlineHighlight ? (
            <>
              {' '}
              <span className={highlightClassName}>{resolvedHighlight}</span>
            </>
          ) : (
            <>
              <br />
              <span className={highlightClassName}>{resolvedHighlight}</span>
            </>
          )
        ) : null}
      </h2>

      {descriptionKey ? <p className={descriptionClassName}>{t(descriptionKey)}</p> : null}
    </div>
  )
}

export default HomeSectionHeading
