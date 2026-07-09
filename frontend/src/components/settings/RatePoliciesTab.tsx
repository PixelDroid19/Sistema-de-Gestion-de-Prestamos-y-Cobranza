import React, { useMemo, useState } from 'react';
import { Calculator, CheckCircle2, CircleOff, PencilLine, Plus, Save, Trash2 } from 'lucide-react';
import { tTerm } from '../../i18n/terminology';
import { toast } from '../../lib/toast';
import { confirmDanger } from '../../lib/confirmModal';
import { reportClientError } from '../../lib/clientDiagnostics';
import {
  ActionButton,
  FormField,
  ModalShell,
  AppInput,
  CurrencyInput,
  SectionSurface,
  StatusChip,
} from '../shared/Surfaces';
import {
  AppTable,
  RowActionsWithOverflow,
  type RowActionOverflowItem,
  TableActionsCell,
  TableActionsHeader,
} from '../shared/tables';
import { HelpLabel } from '../shared/HelpSupport';
import { StatusBadge } from './StatusBadge';
import {
  type RatePolicyDraft,
  EMPTY_RATE_POLICY,
  buildRatePayload,
  findRatePolicyMatchesForAmount,
  formatCurrency,
  formatMonthlyRate,
  formatMonthlyRateFormula,
  formatRange,
  formatRate,
  isFullRangeRatePolicy,
  isArchivedSeededCatchAllRatePolicy,
  getRatePolicyCoverageGaps,
  getRatePolicyConflictPairs,
  getRatePolicyConflictsForAmount,
  normalizePolicyPriority,
  sortRatePoliciesForApplication,
  validateRatePolicyDraft,
} from './settingsHelpers';

type Props = {
  ratePolicies: any[];
  createRatePolicy: { mutateAsync: (data: any) => Promise<any>; isPending: boolean };
  updateRatePolicy: { mutateAsync: (data: any) => Promise<any>; isPending: boolean };
  deleteRatePolicy: { mutateAsync: (id: any) => Promise<any>; isPending: boolean };
};

export default function RatePoliciesTab({
  ratePolicies,
  createRatePolicy,
  updateRatePolicy,
  deleteRatePolicy,
}: Props) {
  const [editingRatePolicyId, setEditingRatePolicyId] = useState<string | null>(null);
  const [newRatePolicy, setNewRatePolicy] = useState<RatePolicyDraft>(EMPTY_RATE_POLICY);
  const [ratePreviewAmount, setRatePreviewAmount] = useState('2000000');
  const [isRatePolicyModalOpen, setIsRatePolicyModalOpen] = useState(false);

  const orderedRatePolicies = useMemo(() => sortRatePoliciesForApplication(ratePolicies), [ratePolicies]);
  const visibleRatePolicies = useMemo(
    () => orderedRatePolicies.filter((policy) => !isArchivedSeededCatchAllRatePolicy(policy)),
    [orderedRatePolicies],
  );
  const activeRatePolicies = useMemo(
    () => orderedRatePolicies.filter((policy) => policy?.isActive !== false),
    [orderedRatePolicies],
  );
  const ratePolicyConflictPairs = useMemo(
    () => getRatePolicyConflictPairs(activeRatePolicies),
    [activeRatePolicies],
  );
  const conflictedRatePolicyIds = useMemo(() => new Set(
    ratePolicyConflictPairs.flatMap(([left, right]) => [String(left?.id), String(right?.id)]),
  ), [ratePolicyConflictPairs]);
  const hasRatePolicyConflicts = ratePolicyConflictPairs.length > 0;
  const ratePolicyCoverageGaps = useMemo(
    () => getRatePolicyCoverageGaps(activeRatePolicies),
    [activeRatePolicies],
  );
  const hasRatePolicyCoverageGaps = ratePolicyCoverageGaps.length > 0;
  const previewRateMatches = useMemo(
    () => findRatePolicyMatchesForAmount(activeRatePolicies, ratePreviewAmount),
    [activeRatePolicies, ratePreviewAmount],
  );
  const previewRateConflicts = useMemo(
    () => getRatePolicyConflictsForAmount(previewRateMatches),
    [previewRateMatches],
  );
  const previewRatePolicy = useMemo(
    () => (previewRateConflicts.length > 1 ? null : sortRatePoliciesForApplication(previewRateMatches)[0] || null),
    [previewRateConflicts, previewRateMatches],
  );
  const previewRateFormula = previewRatePolicy ? formatMonthlyRateFormula(previewRatePolicy.annualEffectiveRate) : '';
  const previewAmountNumber = Number(ratePreviewAmount);
  const hasValidPreviewAmount = Number.isFinite(previewAmountNumber) && previewAmountNumber >= 0;
  const isEditingRatePolicy = Boolean(editingRatePolicyId);
  const hasSingleCatchAllActiveRate = activeRatePolicies.length === 1 && isFullRangeRatePolicy(activeRatePolicies[0]);

  const resetRatePolicyDraft = () => {
    setEditingRatePolicyId(null);
    setNewRatePolicy(EMPTY_RATE_POLICY);
    setIsRatePolicyModalOpen(false);
  };

  const openCreateRatePolicyModal = () => {
    setEditingRatePolicyId(null);
    setNewRatePolicy(EMPTY_RATE_POLICY);
    setIsRatePolicyModalOpen(true);
  };

  const startEditingRatePolicy = (policy: any) => {
    setEditingRatePolicyId(String(policy.id));
    setNewRatePolicy({
      label: String(policy.label || ''),
      minAmount: policy.minAmount == null ? '' : String(policy.minAmount),
      maxAmount: policy.maxAmount == null ? '' : String(policy.maxAmount),
      annualEffectiveRate: policy.annualEffectiveRate == null ? '' : String(policy.annualEffectiveRate),
      priority: normalizePolicyPriority(policy.priority),
      description: String(policy.description || ''),
    });
    setIsRatePolicyModalOpen(true);
  };

  const handleCreateRatePolicy = async (event: React.FormEvent) => {
    event.preventDefault();
    const validationError = validateRatePolicyDraft(newRatePolicy, ratePolicies, editingRatePolicyId);
    if (validationError) {
      toast.error({ title: tTerm('settings.rate.toast.review'), description: validationError });
      return;
    }

    try {
      if (editingRatePolicyId) {
        await updateRatePolicy.mutateAsync({ id: editingRatePolicyId, ...buildRatePayload(newRatePolicy) });
        toast.success({ description: tTerm('settings.rate.toast.updated') });
      } else {
        await createRatePolicy.mutateAsync(buildRatePayload(newRatePolicy));
        toast.success({ description: tTerm('settings.rate.toast.created') });
      }
      resetRatePolicyDraft();
    } catch (error) {
      reportClientError('settings.ratePolicy.save', error);
      toast.apiErrorSafe(error, { domain: 'config', action: 'config.update' });
    }
  };

  const handleDelete = async (policy: any) => {
    const confirmed = await confirmDanger({
      title: tTerm('settings.rate.delete.title'),
      message: tTerm('settings.rate.delete.message', { name: policy.label }),
      confirmLabel: tTerm('settings.validation.deleteConfirm'),
    });
    if (!confirmed) return;

    try {
      await deleteRatePolicy.mutateAsync(policy.id);
      toast.success({ description: tTerm('settings.rate.toast.deleted') });
    } catch (error) {
      reportClientError('settings.ratePolicy.delete', error);
      toast.apiErrorSafe(error, { domain: 'config', action: 'config.update' });
    }
  };

  const ratePolicyForm = (
    <form onSubmit={handleCreateRatePolicy} aria-label={tTerm('settings.rate.section.aria')} className="space-y-4">
      <div className="grid min-w-0 gap-3 md:grid-cols-2">
        <FormField label={tTerm('settings.rate.field.name')}>
          <AppInput
            aria-label={tTerm('settings.rate.field.name')}
            variant="text"
            required
            value={newRatePolicy.label}
            onValueChange={(v, _detail, e) => setNewRatePolicy((prev) => ({ ...prev, label: v }))}
            placeholder={tTerm('settings.rate.field.namePlaceholderDefault')}
          />
        </FormField>
        <FormField
          label={tTerm('settings.rate.field.min')}
          tooltip={tTerm('settings.rate.field.minTooltip')}
        >
          <CurrencyInput
            aria-label={tTerm('settings.rate.field.min')}
            value={newRatePolicy.minAmount}
            onValueChange={(value) => setNewRatePolicy((prev) => ({ ...prev, minAmount: value }))}
            placeholder="0"
          />
        </FormField>
        <FormField
          label={tTerm('settings.rate.field.max')}
          tooltip={tTerm('settings.rate.field.maxTooltip')}
        >
          <CurrencyInput
            aria-label={tTerm('settings.rate.field.max')}
            value={newRatePolicy.maxAmount}
            onValueChange={(value) => setNewRatePolicy((prev) => ({ ...prev, maxAmount: value }))}
            placeholder={tTerm('settings.range.noCap')}
          />
        </FormField>
        <FormField
          label={tTerm('settings.rate.field.annualRate')}
          tooltip={tTerm('settings.rate.field.annualRateTooltip')}
        >
          <AppInput
            aria-label={tTerm('settings.rate.field.annualRate')}
            required
            variant="percent"
            value={newRatePolicy.annualEffectiveRate}
            onValueChange={(value) => setNewRatePolicy((prev) => ({ ...prev, annualEffectiveRate: value }))}
            placeholder="60"
            maxDecimals={2}
            suffix="%"
          />
        </FormField>
      </div>
      <p className="settings-inline-helper">
        {tTerm('settings.rate.note')}
      </p>
    </form>
  );

  return (
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="space-y-4">
        <SectionSurface
          title={tTerm('settings.rate.section.titleCreate')}
          subtitle={tTerm('settings.rate.section.subtitleCreate')}
          actions={(
            <ActionButton
              type="button"
              variant="primary"
              icon={<Plus size={16} />}
              onClick={openCreateRatePolicyModal}
            >
              {tTerm('settings.rate.cta.openCreate')}
            </ActionButton>
          )}
          bodyClassName="space-y-3"
        >
          <p className="text-sm leading-6 text-text-secondary">
            {tTerm('settings.rate.section.inlineHelp')}
          </p>
        </SectionSurface>

        <AppTable variant="operational" shell="off"
          minWidthClassName="min-w-[980px]"
          data-tour="settings-rate-policies-table"
          aria-label={tTerm('settings.rate.table.aria')}
        >
              <thead>
                <tr>
                  <th><HelpLabel label={tTerm('settings.rate.table.rule')} text={tTerm('settings.rate.table.ruleTooltip')} /></th>
                  <th><HelpLabel label={tTerm('settings.rate.table.range')} text={tTerm('settings.rate.table.rangeTooltip')} /></th>
                  <th><HelpLabel label={tTerm('settings.rate.table.annualRate')} text={tTerm('settings.rate.table.annualRateTooltip')} /></th>
                  <th><HelpLabel label={tTerm('settings.rate.table.monthlyRate')} text={tTerm('settings.rate.table.monthlyRateTooltip')} /></th>
                  <th>{tTerm('settings.rate.table.state')}</th>
                  <TableActionsHeader>{tTerm('settings.rate.table.actions')}</TableActionsHeader>
                </tr>
              </thead>
              <tbody>
                {visibleRatePolicies.map((policy: any) => (
                  <tr key={policy.id}>
                    <td>
                      <div className="min-w-0">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <p className="truncate font-semibold">{policy.label}</p>
                          {conflictedRatePolicyIds.has(String(policy.id)) && (
                            <StatusChip tone="danger" size="sm" title={tTerm('settings.rate.table.conflictTitle')}>
                              {tTerm('settings.rate.table.conflict')}
                            </StatusChip>
                          )}
                        </div>
                        {policy.description && (
                          <p className="mt-1 max-w-[18rem] truncate text-xs text-text-secondary">{policy.description}</p>
                        )}
                        {conflictedRatePolicyIds.has(String(policy.id)) && (
                          <p className="mt-1 max-w-[24rem] text-xs text-rose-700 dark:text-rose-200">
                            {tTerm('settings.rate.table.conflictHelp')}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="text-text-secondary">{formatRange(policy.minAmount, policy.maxAmount)}</td>
                    <td className="font-semibold">{formatRate(policy.annualEffectiveRate)}</td>
                    <td className="font-semibold text-text-secondary">{formatMonthlyRate(policy.annualEffectiveRate)}</td>
                    <td><StatusBadge active={policy.isActive !== false} /></td>
                    <TableActionsCell>
                      <RowActionsWithOverflow
                        variant="icon"
                        align="center"
                        ariaLabel={tTerm('settings.rate.table.actions')}
                        items={[
                          {
                            id: 'edit',
                            label: tTerm('settings.rate.table.editTitle'),
                            icon: <PencilLine size={16} />,
                            onClick: () => startEditingRatePolicy(policy),
                            disabled: createRatePolicy.isPending || updateRatePolicy.isPending,
                          },
                          {
                            id: 'toggle',
                            label: policy.isActive === false
                              ? tTerm('settings.rate.table.activate')
                              : tTerm('settings.rate.table.deactivate'),
                            icon: policy.isActive === false ? <CheckCircle2 size={16} /> : <CircleOff size={16} />,
                            onClick: async () => {
                              try {
                                await updateRatePolicy.mutateAsync({ id: policy.id, isActive: policy.isActive === false });
                                toast.success({
                                  description: policy.isActive === false
                                    ? tTerm('settings.rate.toast.activated')
                                    : tTerm('settings.rate.toast.deactivated'),
                                });
                              } catch (error) {
                                reportClientError('settings.ratePolicy.update', error);
                                toast.apiErrorSafe(error, { domain: 'config', action: 'config.update' });
                              }
                            },
                            disabled: updateRatePolicy.isPending,
                          },
                          {
                            id: 'delete',
                            label: tTerm('settings.rate.table.delete'),
                            icon: <Trash2 size={16} />,
                            onClick: () => handleDelete(policy),
                            disabled: deleteRatePolicy.isPending,
                            iconVariant: 'danger',
                            menuTone: 'danger',
                          },
                        ] as RowActionOverflowItem[]}
                      />
                    </TableActionsCell>
                  </tr>
                ))}
                {visibleRatePolicies.length === 0 && (
                  <tr>
                    <td colSpan={6} className="table-empty-state">{tTerm('settings.rate.table.empty')}</td>
                  </tr>
                )}
              </tbody>
        </AppTable>
      </div>

      <SectionSurface
        title={tTerm('settings.coverage.title')}
        subtitle={hasSingleCatchAllActiveRate
          ? tTerm('settings.coverage.subtitleSingleRange')
          : tTerm('settings.coverage.subtitle')}
        bodyClassName="space-y-4"
      >
        {hasRatePolicyConflicts && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-100">
            <p className="font-semibold">{tTerm('settings.coverage.conflictTitle')}</p>
            <p className="mt-1">
              {tTerm('settings.coverage.conflictDescription')}
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {ratePolicyConflictPairs.slice(0, 3).map(([left, right]) => (
                <li key={`${left?.id}-${right?.id}`}>
                  {tTerm('settings.coverage.conflictPair', { left: left?.label, right: right?.label })}
                </li>
              ))}
            </ul>
          </div>
        )}
        {hasRatePolicyCoverageGaps && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
            <p className="font-semibold">{tTerm('settings.coverage.gapTitle')}</p>
            <p className="mt-1">{tTerm('settings.coverage.gapDescription')}</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {ratePolicyCoverageGaps.slice(0, 4).map((gap) => (
                <li key={`${gap.from}-${gap.to}`}>
                  {tTerm('settings.coverage.gapRange', {
                    range: gap.to === Number.POSITIVE_INFINITY
                      ? tTerm('settings.range.fromAmount', { amount: formatCurrency(gap.from) })
                      : formatRange(gap.from, gap.to),
                  })}
                </li>
              ))}
            </ul>
          </div>
        )}
        {hasSingleCatchAllActiveRate ? (
          <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-100">
            <p className="font-semibold">{tTerm('settings.coverage.singleRange.title')}</p>
            <p className="mt-1">{tTerm('settings.coverage.singleRange.description')}</p>
          </div>
        ) : (
          <FormField label={tTerm('settings.coverage.field.amount')}>
            <CurrencyInput
              aria-label={tTerm('settings.coverage.field.amount')}
              value={ratePreviewAmount}
              onValueChange={setRatePreviewAmount}
              placeholder="2000000"
            />
          </FormField>
        )}
        <div className="rounded-xl border border-border-subtle bg-bg-base p-4" aria-live="polite">
          <div className="flex flex-wrap items-start justify-end gap-3">
            <StatusChip
              tone={previewRateConflicts.length > 1 ? 'danger' : previewRatePolicy ? 'success' : 'warning'}
              size="sm"
              icon={<Calculator size={14} />}
              title={previewRateConflicts.length > 1
                ? tTerm('settings.coverage.statusTitle.conflict')
                : previewRatePolicy ? tTerm('settings.coverage.statusTitle.covered') : tTerm('settings.coverage.statusTitle.noRule')}
            >
              {previewRateConflicts.length > 1 ? tTerm('settings.coverage.status.conflict') : previewRatePolicy ? tTerm('settings.coverage.status.covered') : tTerm('settings.coverage.status.noRule')}
            </StatusChip>
          </div>

          {previewRateConflicts.length > 1 ? (
            <p className="mt-3 text-sm leading-5 text-rose-700 dark:text-rose-200">
              {tTerm('settings.coverage.preview.conflict', { labels: previewRateConflicts.map((policy) => policy.label).join(' y ') })}
            </p>
          ) : previewRatePolicy ? (
            <dl className="mt-4 grid gap-3">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-text-secondary">
                  {tTerm('settings.coverage.result.annualRate')}
                </dt>
                <dd className="mt-1 text-xl font-bold text-text-primary">
                  {formatRate(previewRatePolicy.annualEffectiveRate)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-text-secondary">
                  {tTerm('settings.coverage.result.monthlyLabel')}
                </dt>
                <dd className="mt-1 text-lg font-bold text-text-primary">
                  {formatMonthlyRate(previewRatePolicy.annualEffectiveRate)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-text-secondary">
                  {tTerm('settings.coverage.result.formula')}
                </dt>
                <dd className="mt-1 break-words text-sm font-semibold text-text-primary">
                  {previewRateFormula}
                </dd>
                <p className="mt-1 text-xs leading-5 text-text-secondary">
                  {tTerm('settings.coverage.result.formulaHelp')}
                </p>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-text-secondary">
                  {tTerm('settings.coverage.result.rule')}
                </dt>
                <dd className="mt-1 break-words text-sm font-semibold text-text-primary">
                  {previewRatePolicy.label}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-text-secondary">
                  {tTerm('settings.coverage.result.range')}
                </dt>
                <dd className="mt-1 text-sm leading-5 text-text-secondary">
                  {formatRange(previewRatePolicy.minAmount, previewRatePolicy.maxAmount)}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="mt-3 text-sm leading-5 text-text-secondary">
              {hasValidPreviewAmount
                ? tTerm('settings.coverage.preview.createRule')
                : tTerm('settings.coverage.preview.invalidAmount')}
            </p>
          )}
        </div>
      </SectionSurface>
      {isRatePolicyModalOpen && (
        <ModalShell
          title={isEditingRatePolicy ? tTerm('settings.rate.modal.titleEdit') : tTerm('settings.rate.modal.titleCreate')}
          subtitle={isEditingRatePolicy ? tTerm('settings.rate.modal.subtitleEdit') : tTerm('settings.rate.modal.subtitleCreate')}
          maxWidthClassName="max-w-3xl"
          onClose={resetRatePolicyDraft}
          footer={(
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-end">
              <ActionButton
                type="button"
                onClick={resetRatePolicyDraft}
                disabled={createRatePolicy.isPending || updateRatePolicy.isPending}
              >
                {tTerm('common.cta.cancel')}
              </ActionButton>
              <ActionButton
                type="submit"
                form="rate-policy-form"
                disabled={createRatePolicy.isPending || updateRatePolicy.isPending}
                variant="primary"
                icon={<Save size={16} />}
              >
                {isEditingRatePolicy ? tTerm('settings.rate.cta.saveChanges') : tTerm('settings.rate.cta.saveRule')}
              </ActionButton>
            </div>
          )}
        >
          {React.cloneElement(ratePolicyForm, { id: 'rate-policy-form' })}
        </ModalShell>
      )}
    </div>
  );
}
