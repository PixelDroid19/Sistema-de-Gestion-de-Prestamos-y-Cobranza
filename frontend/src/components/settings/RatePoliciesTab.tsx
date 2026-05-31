import React, { useMemo, useState } from 'react';
import { Calculator, CheckCircle2, CircleOff, PencilLine, Plus, Save, Trash2 } from 'lucide-react';
import { useTranslation } from '../../i18n';
import { tTerm } from '../../i18n/terminology';
import { toast } from '../../lib/toast';
import { confirmDanger } from '../../lib/confirmModal';
import { reportClientError } from '../../lib/clientDiagnostics';
import {
  ActionButton,
  DataTableSurface,
  FormField,
  ModalShell,
  NormalizedInput,
  SectionSurface,
  StatusChip,
  TextInput,
} from '../shared/Surfaces';
import { HelpLabel } from '../shared/HelpSupport';
import { OperationalInput } from '../shared/FormControls';
import { StatusBadge } from './StatusBadge';
import {
  type RatePolicyDraft,
  DEFAULT_HIGH_AMOUNT_START,
  DEFAULT_LOW_AMOUNT_LIMIT,
  DEFAULT_MID_AMOUNT_LIMIT,
  DEFAULT_TOP_AMOUNT_START,
  EMPTY_RATE_POLICY,
  buildRateCoverageCheck,
  buildRatePayload,
  findRatePolicyMatchesForAmount,
  formatCurrency,
  formatRange,
  formatRate,
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
  const { locale } = useTranslation();
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
  const rateCoverageChecks = useMemo(() => [
    buildRateCoverageCheck(
      tTerm('settings.coverage.bucket.low', { amount: formatCurrency(DEFAULT_LOW_AMOUNT_LIMIT) }),
      0,
      DEFAULT_LOW_AMOUNT_LIMIT,
      activeRatePolicies,
    ),
    buildRateCoverageCheck(
      tTerm('settings.coverage.bucket.middle', { from: formatCurrency(DEFAULT_HIGH_AMOUNT_START), to: formatCurrency(DEFAULT_MID_AMOUNT_LIMIT) }),
      DEFAULT_HIGH_AMOUNT_START,
      DEFAULT_MID_AMOUNT_LIMIT,
      activeRatePolicies,
    ),
    buildRateCoverageCheck(
      tTerm('settings.coverage.bucket.high', { amount: formatCurrency(DEFAULT_TOP_AMOUNT_START) }),
      DEFAULT_TOP_AMOUNT_START,
      Number.POSITIVE_INFINITY,
      activeRatePolicies,
    ),
  ], [activeRatePolicies, locale]);
  const hasMissingStandardRateCoverage = hasRatePolicyCoverageGaps || rateCoverageChecks.some((check) => !check.isCovered);
  const previewAmountNumber = Number(ratePreviewAmount);
  const hasValidPreviewAmount = Number.isFinite(previewAmountNumber) && previewAmountNumber >= 0;
  const isEditingRatePolicy = Boolean(editingRatePolicyId);

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

  const handleMoneyDraftChange = (field: 'minAmount' | 'maxAmount') => (event: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = event.target.value.replace(/\D/g, '');
    setNewRatePolicy((prev) => ({ ...prev, [field]: rawValue }));
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
          <TextInput
            aria-label={tTerm('settings.rate.field.name')}
            required
            value={newRatePolicy.label}
            onChange={(event) => setNewRatePolicy((prev) => ({ ...prev, label: event.target.value }))}
            placeholder={tTerm('settings.rate.field.namePlaceholderDefault')}
          />
        </FormField>
        <FormField
          label={tTerm('settings.rate.field.min')}
          tooltip={tTerm('settings.rate.field.minTooltip')}
        >
          <OperationalInput
            aria-label={tTerm('settings.rate.field.min')}
            variant="money"
            value={newRatePolicy.minAmount}
            onChange={handleMoneyDraftChange('minAmount')}
            placeholder="0"
          />
        </FormField>
        <FormField
          label={tTerm('settings.rate.field.max')}
          tooltip={tTerm('settings.rate.field.maxTooltip')}
        >
          <OperationalInput
            aria-label={tTerm('settings.rate.field.max')}
            variant="money"
            value={newRatePolicy.maxAmount}
            onChange={handleMoneyDraftChange('maxAmount')}
            placeholder={tTerm('settings.range.noCap')}
          />
        </FormField>
        <FormField
          label={tTerm('settings.rate.field.annualRate')}
          tooltip={tTerm('settings.rate.field.annualRateTooltip')}
        >
          <NormalizedInput
            aria-label={tTerm('settings.rate.field.annualRate')}
            required
            variant="percent"
            value={newRatePolicy.annualEffectiveRate}
            onValueChange={(value) => setNewRatePolicy((prev) => ({ ...prev, annualEffectiveRate: value }))}
            placeholder="60"
            maxDecimals={2}
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

        <DataTableSurface>
          <div className="overflow-x-auto">
            <table className="min-w-[860px]" aria-label={tTerm('settings.rate.table.aria')}>
              <thead>
                <tr>
                  <th><HelpLabel label={tTerm('settings.rate.table.rule')} text={tTerm('settings.rate.table.ruleTooltip')} /></th>
                  <th><HelpLabel label={tTerm('settings.rate.table.range')} text={tTerm('settings.rate.table.rangeTooltip')} /></th>
                  <th><HelpLabel label={tTerm('settings.rate.table.annualRate')} text={tTerm('settings.rate.table.annualRateTooltip')} /></th>
                  <th>{tTerm('settings.rate.table.state')}</th>
                  <th className="text-right">{tTerm('settings.rate.table.actions')}</th>
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
                    <td><StatusBadge active={policy.isActive !== false} /></td>
                    <td>
                      <div className="flex justify-end gap-2">
                        <ActionButton
                          type="button"
                          onClick={() => startEditingRatePolicy(policy)}
                          disabled={createRatePolicy.isPending || updateRatePolicy.isPending}
                          variant="ghost"
                          icon={<PencilLine size={14} />}
                          className="min-h-8 px-3 py-1.5 text-xs"
                          title={tTerm('settings.rate.table.editTitle')}
                        >
                          {tTerm('settings.rate.table.edit')}
                        </ActionButton>
                        <ActionButton
                          type="button"
                          onClick={async () => {
                            try {
                              await updateRatePolicy.mutateAsync({ id: policy.id, isActive: policy.isActive === false });
                              toast.success({ description: policy.isActive === false ? tTerm('settings.rate.toast.activated') : tTerm('settings.rate.toast.deactivated') });
                            } catch (error) {
                              reportClientError('settings.ratePolicy.update', error);
                              toast.apiErrorSafe(error, { domain: 'config', action: 'config.update' });
                            }
                          }}
                          disabled={updateRatePolicy.isPending}
                          variant="ghost"
                          icon={policy.isActive === false ? <CheckCircle2 size={14} /> : <CircleOff size={14} />}
                          className="min-h-8 px-3 py-1.5 text-xs"
                        >
                          {policy.isActive === false ? tTerm('settings.rate.table.activate') : tTerm('settings.rate.table.deactivate')}
                        </ActionButton>
                        <ActionButton
                          type="button"
                          onClick={() => handleDelete(policy)}
                          disabled={deleteRatePolicy.isPending}
                          variant="danger"
                          icon={<Trash2 size={14} />}
                          className="min-h-8 px-3 py-1.5 text-xs"
                        >
                          {tTerm('settings.rate.table.delete')}
                        </ActionButton>
                      </div>
                    </td>
                  </tr>
                ))}
                {visibleRatePolicies.length === 0 && (
                  <tr>
                    <td colSpan={5} className="table-empty-state">{tTerm('settings.rate.table.empty')}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </DataTableSurface>
      </div>

      <SectionSurface
        title={tTerm('settings.coverage.title')}
        subtitle={tTerm('settings.coverage.subtitle')}
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
        <div className="grid gap-2">
          {rateCoverageChecks.map((check) => (
            <div key={check.label} className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-border-subtle px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-text-primary">{check.label}</p>
                <p className="truncate text-xs text-text-secondary">
                  {check.hasConflict
                    ? tTerm('settings.coverage.check.conflict', { labels: check.conflicts.map((policy) => policy.label).join(' y ') })
                    : check.isCovered
                      ? check.policy
                        ? tTerm('settings.coverage.check.covered', { label: check.policy.label })
                        : tTerm('settings.coverage.check.coveredMultiple')
                      : tTerm('settings.coverage.check.missing')}
                </p>
              </div>
              <StatusChip tone={check.hasConflict ? 'danger' : check.isCovered ? 'success' : 'warning'} size="sm">
                {check.status}
              </StatusChip>
            </div>
          ))}
          {hasMissingStandardRateCoverage && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {tTerm('settings.coverage.missingNote')}
            </p>
          )}
        </div>
        <FormField label={tTerm('settings.coverage.field.amount')}>
          <OperationalInput
            aria-label={tTerm('settings.coverage.field.amount')}
            variant="money"
            value={ratePreviewAmount}
            onChange={(event) => setRatePreviewAmount(event.target.value.replace(/\D/g, ''))}
            placeholder="2000000"
          />
        </FormField>
        <div className="rounded-xl border border-border-subtle bg-bg-base p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-secondary">{tTerm('settings.coverage.resultEyebrow')}</p>
              <p className="mt-1 truncate text-lg font-bold text-text-primary">
                {previewRatePolicy ? formatRate(previewRatePolicy.annualEffectiveRate) : tTerm('settings.coverage.result.noApplicableRate')}
              </p>
              <p className="mt-1 truncate text-sm font-medium text-text-secondary">
                {previewRatePolicy ? previewRatePolicy.label : tTerm('settings.coverage.result.noActiveRule')}
              </p>
            </div>
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
          <p className="mt-2 text-sm leading-5 text-text-secondary">
            {previewRateConflicts.length > 1
              ? tTerm('settings.coverage.preview.conflict', { labels: previewRateConflicts.map((policy) => policy.label).join(' y ') })
              : previewRatePolicy
              ? tTerm('settings.coverage.preview.covered', { label: previewRatePolicy.label, range: formatRange(previewRatePolicy.minAmount, previewRatePolicy.maxAmount) })
              : hasValidPreviewAmount
                ? tTerm('settings.coverage.preview.createRule')
                : tTerm('settings.coverage.preview.invalidAmount')}
          </p>
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
