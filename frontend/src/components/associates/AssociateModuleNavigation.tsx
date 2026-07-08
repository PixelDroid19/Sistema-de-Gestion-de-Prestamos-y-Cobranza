import { TrendingUp, Users } from 'lucide-react';
import { tTerm } from '../../i18n/terminology';
import { ViewTabs } from '../shared/Surfaces';

type AssociateModuleSection = 'registry' | 'tracking';

type AssociateModuleNavigationProps = {
  activeSection: AssociateModuleSection;
  setCurrentView: (view: string) => void;
  className?: string;
};

export default function AssociateModuleNavigation({
  activeSection,
  setCurrentView,
  className = '',
}: AssociateModuleNavigationProps) {
  return (
    <ViewTabs
      className={`associate-module-nav ${className}`.trim()}
      ariaLabel={tTerm('associates.sectionNav.aria')}
      activeTab={activeSection}
      onChange={(tabId) => {
        if (tabId === 'tracking') {
          setCurrentView('associates-tracking');
          return;
        }

        setCurrentView('associates');
      }}
      tabs={[
        {
          id: 'registry',
          label: tTerm('associates.sectionNav.registry'),
          icon: Users,
        },
        {
          id: 'tracking',
          label: tTerm('associates.sectionNav.tracking'),
          icon: TrendingUp,
        },
      ]}
    />
  );
}
