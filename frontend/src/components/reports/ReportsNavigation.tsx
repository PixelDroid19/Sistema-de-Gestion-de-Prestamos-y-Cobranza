import { useMemo } from 'react';
import { ViewTabs } from '../shared/Surfaces';

export type ReportLeaf = {
  id: string;
  label: string;
  title?: string;
};

export type ReportGroup = {
  id: string;
  label: string;
  title?: string;
  leaves: ReportLeaf[];
};

type ReportsNavigationProps = {
  groups: ReportGroup[];
  activeTab: string;
  onChange: (leafId: string) => void;
  primaryAriaLabel: string;
  secondaryAriaLabel: string;
  'data-tour'?: string;
};

/**
 * Two-level reports navigation: a primary group bar plus a contextual secondary
 * selector. Single-view groups render only the primary tab so the layout stays
 * uncluttered; multi-view groups expose their views in a compact sub-nav.
 */
export default function ReportsNavigation({
  groups,
  activeTab,
  onChange,
  primaryAriaLabel,
  secondaryAriaLabel,
  'data-tour': dataTour,
}: ReportsNavigationProps) {
  const activeGroup = useMemo(
    () => groups.find((group) => group.leaves.some((leaf) => leaf.id === activeTab)) || groups[0],
    [groups, activeTab],
  );

  const primaryTabs = useMemo(
    () => groups.map((group) => ({ id: group.id, label: group.label, title: group.title })),
    [groups],
  );

  const secondaryTabs = useMemo(
    () => (activeGroup?.leaves.length || 0) > 1
      ? activeGroup!.leaves.map((leaf) => ({ id: leaf.id, label: leaf.label, title: leaf.title }))
      : [],
    [activeGroup],
  );

  const handlePrimaryChange = (groupId: string) => {
    if (groupId === activeGroup?.id) {
      return;
    }
    const nextGroup = groups.find((group) => group.id === groupId);
    const firstLeaf = nextGroup?.leaves[0];
    if (firstLeaf) {
      onChange(firstLeaf.id);
    }
  };

  return (
    <div className="reports-navigation">
      <ViewTabs
        data-tour={dataTour}
        activeTab={activeGroup?.id || ''}
        onChange={handlePrimaryChange}
        tabs={primaryTabs}
        className="reports-page-tabs"
        ariaLabel={primaryAriaLabel}
      />

      {secondaryTabs.length > 0 && (
        <ViewTabs
          activeTab={activeTab}
          onChange={onChange}
          tabs={secondaryTabs}
          className="reports-subnav"
          ariaLabel={secondaryAriaLabel}
        />
      )}
    </div>
  );
}
