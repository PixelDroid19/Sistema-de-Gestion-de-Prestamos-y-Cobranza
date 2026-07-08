import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowDownToLine,
  CheckCircle,
  CircleDollarSign,
  Clock,
  Download,
  History,
  MoreHorizontal,
  RefreshCw,
  Wallet,
} from 'lucide-react';
import { tTerm } from '../../i18n/terminology';
import { ActionButton, ToolbarSurface } from '../shared/Surfaces';

type AssociateMoneyActionType = 'distribution' | 'capitalReturn' | 'reinvestment';

type OverflowMenuItem = {
  id: AssociateMoneyActionType;
  label: string;
  icon: ReactNode;
  onClick: () => void;
};

type AssociateDetailToolbarProps = {
  canManageMovements: boolean;
  onOpenContributionHistory: () => void;
  onOpenInterestSchedule: () => void;
  onExportFinancialSummary: () => void;
  isExportingFinancialSummary?: boolean;
  onOpenCapitalContribution: () => void;
  onOpenInterestPayments: () => void;
  onOpenMoneyAction: (action: AssociateMoneyActionType) => void;
};

const detailSupportButtonClass = 'min-h-[2.75rem] justify-start px-3 py-2.5 text-left whitespace-normal leading-5';
const detailPrimaryButtonClass = 'min-h-[2.75rem] justify-center px-3 py-2.5 whitespace-normal leading-5';

function MovementOverflowMenu({ items }: { items: OverflowMenuItem[] }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuStyle, setMenuStyle] = useState<CSSProperties | null>(null);
  const menuId = useId();
  const menuLabel = tTerm('associateDetails.toolbar.moreMovements');

  const updateMenuPosition = () => {
    if (typeof window === 'undefined' || !triggerRef.current) {
      return;
    }

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const menuWidth = 18 * 16;
    const viewportPadding = 12;
    const left = Math.min(
      Math.max(viewportPadding, triggerRect.right - menuWidth),
      window.innerWidth - menuWidth - viewportPadding,
    );
    const top = triggerRect.bottom + 8;
    setMenuStyle({ position: 'fixed', top, left, width: menuWidth, zIndex: 60 });
  };

  useLayoutEffect(() => {
    if (!open) {
      return;
    }
    updateMenuPosition();
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const closeMenu = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        rootRef.current
        && !rootRef.current.contains(target)
        && !(menuRef.current && menuRef.current.contains(target))
      ) {
        setOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', closeMenu);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);

    return () => {
      document.removeEventListener('mousedown', closeMenu);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
    };
  }, [open]);

  if (items.length === 0) {
    return null;
  }

  return (
    <div ref={rootRef} className="relative shrink-0">
      <div ref={triggerRef}>
        <ActionButton
          onClick={() => setOpen((current) => !current)}
          icon={<MoreHorizontal size={16} />}
          variant="secondary"
          className={`min-h-[2.75rem] w-full justify-center px-3 py-2.5 whitespace-normal leading-5 sm:h-[2.75rem] sm:w-[2.75rem] sm:!min-h-0 sm:!p-0 ${open ? 'bg-hover-bg' : ''}`}
          aria-expanded={open}
          aria-controls={menuId}
          aria-haspopup="menu"
          aria-label={menuLabel}
          title={menuLabel}
        >
          <span className="sm:hidden">{menuLabel}</span>
        </ActionButton>
      </div>
      {open && typeof document !== 'undefined' && document.body && createPortal(
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={menuLabel}
          style={menuStyle ?? undefined}
          className="overflow-hidden rounded-lg border border-border-subtle bg-bg-surface py-1 text-left shadow-xl"
        >
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-3 px-3 py-2.5 text-sm font-medium text-text-primary hover:bg-hover-bg"
              onClick={() => {
                item.onClick();
                setOpen(false);
              }}
              title={item.label}
            >
              <span className="shrink-0 text-text-secondary" aria-hidden="true">
                {item.icon}
              </span>
              <span className="min-w-0 text-left leading-snug">{item.label}</span>
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
}

export function AssociateDetailToolbar({
  canManageMovements,
  onOpenContributionHistory,
  onOpenInterestSchedule,
  onExportFinancialSummary,
  isExportingFinancialSummary = false,
  onOpenCapitalContribution,
  onOpenInterestPayments,
  onOpenMoneyAction,
}: AssociateDetailToolbarProps) {
  const overflowItems: OverflowMenuItem[] = [
    {
      id: 'capitalReturn',
      label: tTerm('associateDetails.cta.registerCapitalReturn'),
      icon: <ArrowDownToLine size={16} />,
      onClick: () => onOpenMoneyAction('capitalReturn'),
    },
    {
      id: 'distribution',
      label: tTerm('associateDetails.cta.registerInterestWithdrawal'),
      icon: <CircleDollarSign size={16} />,
      onClick: () => onOpenMoneyAction('distribution'),
    },
    {
      id: 'reinvestment',
      label: tTerm('associateDetails.cta.registerInterestReinvestment'),
      icon: <RefreshCw size={16} />,
      onClick: () => onOpenMoneyAction('reinvestment'),
    },
  ];

  return (
    <ToolbarSurface className="associate-detail-action-panel" data-tour="associate-details-actions">
      <div className="associate-detail-actions-grid">
        <div className="associate-detail-action-cluster associate-detail-action-cluster--support">
          <ActionButton
            onClick={onOpenContributionHistory}
            icon={<History size={16} />}
            className={detailSupportButtonClass}
            fullWidth
          >
            {tTerm('associateDetails.cta.viewInterestHistory')}
          </ActionButton>
          <ActionButton
            onClick={onOpenInterestSchedule}
            icon={<Clock size={16} />}
            className={detailSupportButtonClass}
            fullWidth
          >
            {tTerm('associateDetails.cta.viewInterestSchedule')}
          </ActionButton>
          <ActionButton
            onClick={onExportFinancialSummary}
            icon={<Download size={16} />}
            className={detailSupportButtonClass}
            fullWidth
            disabled={isExportingFinancialSummary}
            isLoading={isExportingFinancialSummary}
            loadingLabel={tTerm('associateDetails.cta.exportFinancialSummary.loading')}
          >
            {tTerm('associateDetails.cta.exportFinancialSummary')}
          </ActionButton>
        </div>

        {canManageMovements ? (
          <div className="associate-detail-action-cluster associate-detail-action-cluster--primary">
            <ActionButton
              onClick={onOpenCapitalContribution}
              icon={<Wallet size={16} />}
              variant="primary"
              className={detailPrimaryButtonClass}
              fullWidth
            >
              {tTerm('associateDetails.cta.registerCapitalContribution')}
            </ActionButton>
            <ActionButton
              onClick={onOpenInterestPayments}
              icon={<CheckCircle size={16} />}
              variant="secondary"
              className={detailPrimaryButtonClass}
              fullWidth
            >
              {tTerm('associateDetails.cta.registerInterestPayment')}
            </ActionButton>
            <MovementOverflowMenu items={overflowItems} />
          </div>
        ) : (
          <p className="associate-detail-action-note">
            {tTerm('associateDetails.toolbar.readOnlySummary')}
          </p>
        )}
      </div>
    </ToolbarSurface>
  );
}

export type { AssociateMoneyActionType };
