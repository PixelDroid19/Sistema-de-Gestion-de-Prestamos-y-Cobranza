import React, { useMemo } from 'react';
import type { NodeKind } from '../../types/dag';
import { tTerm } from '../../i18n/terminology';

type DagNodeContentProps = {
  kind: NodeKind;
  label?: string;
  description?: string;
  formula?: string;
};

const summarizeFormula = (formula?: string): string => {
  if (!formula) return '';

  if (/buildAmortizationSchedule/i.test(formula)) return tTerm('dag.node.summary.scheduleBuilder');
  if (/summarizeSchedule/i.test(formula)) return tTerm('dag.node.summary.scheduleSummary');
  if (/allocatePayment/i.test(formula)) return tTerm('dag.node.summary.paymentAllocation');
  if (/assertSupportedLateFeeMode/i.test(formula)) return tTerm('dag.node.summary.lateFeeModeValidation');
  if (/calculateLateFee/i.test(formula)) return tTerm('dag.node.summary.lateFeeCalculation');

  if (/\*/.test(formula) && /(rate|inter[eé]s|interest)/i.test(formula)) {
    return tTerm('dag.node.summary.interestMultiplication');
  }

  return tTerm('dag.node.summary.genericFormula');
};

const summarizeByKind = (kind: NodeKind): string => {
  if (kind === 'constant') return tTerm('dag.node.summary.constant');
  if (kind === 'output') return tTerm('dag.node.summary.output');
  if (kind === 'conditional') return tTerm('dag.node.summary.conditional');
  if (kind === 'lookup') return tTerm('dag.node.summary.lookup');
  return tTerm('dag.node.summary.genericFormula');
};

export const DagNodeContent: React.FC<DagNodeContentProps> = ({
  kind,
  description,
  formula,
}) => {
  const businessMeaning = useMemo(() => {
    if (description?.trim()) return description.trim();
    if (kind === 'formula' && formula?.trim()) return summarizeFormula(formula);
    return summarizeByKind(kind);
  }, [description, kind, formula]);

  return (
    <div className="px-3 py-2 space-y-1.5">
      <p className="text-[10px] text-text-secondary whitespace-nowrap overflow-hidden text-ellipsis" title={businessMeaning}>
        {businessMeaning}
      </p>

      {kind === 'formula' && (
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-bg-base border border-border-subtle text-text-secondary">
            {formula?.trim()
              ? tTerm('dag.node.formulaIndicator.available')
              : tTerm('dag.node.formulaIndicator.missing')}
          </span>
        </div>
      )}
    </div>
  );
};

export default DagNodeContent;
