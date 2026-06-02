import React, { useState } from 'react';
import { CheckCircle2, CircleOff, Plus, Save, Trash2 } from 'lucide-react';
import { tTerm } from '../../i18n/terminology';
import { toast } from '../../lib/toast';
import { confirmDanger } from '../../lib/confirmModal';
import { reportClientError } from '../../lib/clientDiagnostics';
import {
  ActionButton,
  AppInput,
  FormField,
  ModalShell,
  OperationalSelect,
  SectionSurface,
} from '../shared/Surfaces';
import {
  AppTable,
  RowActionsWithOverflow,
  type RowActionOverflowItem,
  TableActionsCell,
  TableActionsHeader,
} from '../shared/tables';
import { StatusBadge } from './StatusBadge';
import {
  type LateFeePolicyDraft,
  buildLateFeePayload,
  getLateFeeModeLabel,
  validateLateFeePolicyDraft,
} from './settingsHelpers';

type Props = {
  lateFeePolicies: any[];
  createLateFeePolicy: { mutateAsync: (data: any) => Promise<any>; isPending: boolean };
  updateLateFeePolicy: { mutateAsync: (data: any) => Promise<any>; isPending: boolean };
  deleteLateFeePolicy: { mutateAsync: (id: any) => Promise<any>; isPending: boolean };
};

export default function LateFeePoliciesTab({
  lateFeePolicies,
  createLateFeePolicy,
  updateLateFeePolicy,
  deleteLateFeePolicy,
}: Props) {
  const [newLateFeePolicy, setNewLateFeePolicy] = useState<LateFeePolicyDraft>({
    label: '',
    annualEffectiveRate: '',
    lateFeeMode: 'SIMPLE',
    priority: 'medium',
    description: '',
  });
  const [isLateFeeModalOpen, setIsLateFeeModalOpen] = useState(false);

  const resetLateFeeDraft = () => {
    setNewLateFeePolicy({ label: '', annualEffectiveRate: '', lateFeeMode: 'SIMPLE', priority: 'medium', description: '' });
    setIsLateFeeModalOpen(false);
  };

  const handleCreateLateFeePolicy = async (event: React.FormEvent) => {
    event.preventDefault();
    const validationError = validateLateFeePolicyDraft(newLateFeePolicy, lateFeePolicies);
    if (validationError) {
      toast.error({ title: tTerm('settings.lateFee.toast.review'), description: validationError });
      return;
    }

    try {
      await createLateFeePolicy.mutateAsync(buildLateFeePayload(newLateFeePolicy));
      resetLateFeeDraft();
      toast.success({ description: tTerm('settings.lateFee.toast.created') });
    } catch (error) {
      reportClientError('settings.lateFee.create', error);
      toast.apiErrorSafe(error, { domain: 'config', action: 'config.update' });
    }
  };

  const handleDelete = async (policy: any) => {
    const confirmed = await confirmDanger({
      title: tTerm('settings.lateFee.delete.title'),
      message: tTerm('settings.lateFee.delete.message', { name: policy.label }),
      confirmLabel: tTerm('settings.validation.deleteConfirm'),
    });
    if (!confirmed) return;

    try {
      await deleteLateFeePolicy.mutateAsync(policy.id);
      toast.success({ description: tTerm('settings.lateFee.toast.deleted') });
    } catch (error) {
      reportClientError('settings.lateFee.delete', error);
      toast.apiErrorSafe(error, { domain: 'config', action: 'config.update' });
    }
  };

  const lateFeePolicyForm = (
    <form id="late-fee-policy-form" onSubmit={handleCreateLateFeePolicy} aria-label={tTerm('settings.lateFee.section.aria')} className="space-y-4">
      <div className="grid min-w-0 gap-3 md:grid-cols-2">
        <FormField
          label={tTerm('settings.lateFee.field.name')}
          tooltip={tTerm('settings.lateFee.field.nameTooltip')}
        >
          <AppInput
            aria-label={tTerm('settings.lateFee.field.name')}
            variant="text"
            required
            value={newLateFeePolicy.label}
            onValueChange={(v, _detail, e) => setNewLateFeePolicy((prev) => ({ ...prev, label: v }))}
            placeholder={tTerm('settings.lateFee.field.namePlaceholder')}
          />
        </FormField>
        <FormField
          label={tTerm('settings.lateFee.field.rate')}
          tooltip={tTerm('settings.lateFee.field.rateTooltip')}
        >
          <AppInput
            aria-label={tTerm('settings.lateFee.field.rate')}
            required
            variant="percent"
            value={newLateFeePolicy.annualEffectiveRate}
            onValueChange={(value) => setNewLateFeePolicy((prev) => ({ ...prev, annualEffectiveRate: value }))}
            placeholder={tTerm('settings.lateFee.field.ratePlaceholder')}
            maxDecimals={2}
          />
        </FormField>
        <FormField
          label={tTerm('settings.lateFee.field.mode')}
          tooltip={tTerm('settings.lateFee.field.modeTooltip')}
        >
          <OperationalSelect
            aria-label={tTerm('settings.lateFee.field.mode')}
            value={newLateFeePolicy.lateFeeMode}
            onChange={(event) => setNewLateFeePolicy((prev) => ({ ...prev, lateFeeMode: event.target.value as LateFeePolicyDraft['lateFeeMode'] }))}
          >
            <option value="SIMPLE">{tTerm('settings.lateFee.type.simple')}</option>
            <option value="COMPOUND">{tTerm('settings.lateFee.type.compound')}</option>
            <option value="NONE">{tTerm('settings.lateFee.type.none')}</option>
          </OperationalSelect>
        </FormField>
      </div>
    </form>
  );

  return (
    <>
      <SectionSurface
        title={tTerm('settings.lateFee.section.title')}
        subtitle={tTerm('settings.lateFee.section.subtitle')}
        actions={(
          <ActionButton
            type="button"
            variant="primary"
            icon={<Plus size={16} />}
            onClick={() => setIsLateFeeModalOpen(true)}
          >
            {tTerm('settings.lateFee.cta.openCreate')}
          </ActionButton>
        )}
      >
        <p className="text-sm leading-6 text-text-secondary">{tTerm('settings.lateFee.note')}</p>
      </SectionSurface>

      <AppTable variant="operational" shell="off" minWidthClassName="min-w-[760px]" aria-label={tTerm('settings.lateFee.table.aria')}>
            <thead>
              <tr>
                <th>{tTerm('settings.lateFee.table.policy')}</th>
                <th>{tTerm('settings.lateFee.table.rate')}</th>
                <th>{tTerm('settings.lateFee.table.calculation')}</th>
                <th>{tTerm('settings.lateFee.table.state')}</th>
                <TableActionsHeader>{tTerm('settings.lateFee.table.actions')}</TableActionsHeader>
              </tr>
            </thead>
            <tbody>
              {lateFeePolicies.map((policy: any) => (
                <tr key={policy.id}>
                  <td className="font-semibold">{policy.label}</td>
                  <td className="font-semibold">{policy.annualEffectiveRate}%</td>
                  <td className="text-text-secondary">{getLateFeeModeLabel(policy.lateFeeMode)}</td>
                  <td><StatusBadge active={policy.isActive !== false} /></td>
                  <TableActionsCell>
                    <RowActionsWithOverflow
                      variant="icon"
                      align="center"
                      ariaLabel={tTerm('settings.lateFee.table.actions')}
                      items={[
                        {
                          id: 'toggle',
                          label: policy.isActive === false
                            ? tTerm('settings.lateFee.table.activate')
                            : tTerm('settings.lateFee.table.deactivate'),
                          icon: policy.isActive === false ? <CheckCircle2 size={16} /> : <CircleOff size={16} />,
                          onClick: async () => {
                            try {
                              await updateLateFeePolicy.mutateAsync({ id: policy.id, isActive: policy.isActive === false });
                              toast.success({
                                description: policy.isActive === false
                                  ? tTerm('settings.lateFee.toast.activated')
                                  : tTerm('settings.lateFee.toast.deactivated'),
                              });
                            } catch (error) {
                              reportClientError('settings.lateFee.update', error);
                              toast.apiErrorSafe(error, { domain: 'config', action: 'config.update' });
                            }
                          },
                          disabled: updateLateFeePolicy.isPending,
                        },
                        {
                          id: 'delete',
                          label: tTerm('settings.lateFee.table.delete'),
                          icon: <Trash2 size={16} />,
                          onClick: () => handleDelete(policy),
                          disabled: deleteLateFeePolicy.isPending,
                          iconVariant: 'danger',
                          menuTone: 'danger',
                        },
                      ] as RowActionOverflowItem[]}
                    />
                  </TableActionsCell>
                </tr>
              ))}
              {lateFeePolicies.length === 0 && (
                <tr>
                  <td colSpan={5} className="table-empty-state">{tTerm('settings.lateFee.table.empty')}</td>
                </tr>
              )}
            </tbody>
      </AppTable>
      {isLateFeeModalOpen && (
        <ModalShell
          title={tTerm('settings.lateFee.modal.title')}
          subtitle={tTerm('settings.lateFee.modal.subtitle')}
          maxWidthClassName="max-w-3xl"
          onClose={resetLateFeeDraft}
          footer={(
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-end">
              <ActionButton type="button" onClick={resetLateFeeDraft} disabled={createLateFeePolicy.isPending}>
                {tTerm('common.cta.cancel')}
              </ActionButton>
              <ActionButton
                type="submit"
                form="late-fee-policy-form"
                disabled={createLateFeePolicy.isPending}
                variant="primary"
                icon={<Save size={16} />}
              >
                {tTerm('settings.lateFee.cta.create')}
              </ActionButton>
            </div>
          )}
        >
          {lateFeePolicyForm}
        </ModalShell>
      )}
    </>
  );
}
