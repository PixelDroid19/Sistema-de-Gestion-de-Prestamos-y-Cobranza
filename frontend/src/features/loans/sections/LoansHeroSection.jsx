import React from 'react';
import { useTranslation } from 'react-i18next';

import StatCard from '@/components/ui/workspace/StatCard';
import WorkspaceCard from '@/components/ui/workspace/WorkspaceCard';

function LoansHeroSection({ role, summaryCards }) {
  const { t } = useTranslation()

  return (
    <WorkspaceCard
      className="surface-card surface-card--hero"
      eyebrow={t('loans.hero.eyebrow')}
      title={
        role === 'agent'
          ? t('loans.hero.agentTitle')
          : role === 'admin'
            ? t('loans.hero.adminTitle')
            : t('loans.hero.customerTitle')
      }
      subtitle={t('loans.hero.subtitle')}
    >
      <div className="metric-grid">
        {summaryCards.map((card) => (
          <StatCard
            key={card.label}
            label={card.label}
            value={card.value}
            caption={card.caption}
            tone={card.tone}
          />
        ))}
      </div>
    </WorkspaceCard>
  );
}

export default LoansHeroSection;
