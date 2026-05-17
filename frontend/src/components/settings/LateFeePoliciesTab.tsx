import React, { useState } from 'react';
import { CheckCircle2, CircleOff, Save, Trash2 } from 'lucide-react';
import { tTerm } from '../../i18n/terminology';
import { toast } from '../../lib/toast';
import { confirmDanger } from '../../lib/confirmModal';
import {
  ActionButton,
  DataTableSurface,
  FormField,
  SectionSurface,
  SelectInput,
  TextInput,
} from '../shared/Surfaces';
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
    priority: '100',
    description: '',
  });

  const handleCreateLateFeePolicy = async (event: React.FormEvent) => {
    event.preventDefault();
    const validationError = validateLateFeePolicyDraft(newLateFeePolicy, lateFeePolicies);
    if (validationError) {
      toast.error({ title: tTerm('settings.lateFee.toast.review'), description: validationError });
      return;
    }

    try {
      await createLateFeePolicy.mutateAsync(buildLateFeePayload(newLateFeePolicy));
      setNewLateFeePolicy({ label: '', annualEffectiveRate: '', lateFeeMode: 'SIMPLE', priority: '100', description: '' });
      toast.success({ description: tTerm('settings.lateFee.toast.created') });
    } catch (error) {
      console.error('[settings] createLateFeePolicy failed', error);
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
      console.error('[settings] delete failed', error);
      toast.apiErrorSafe(error, { domain: 'config', action: 'config.update' });
    }
  };

  return (
    <>
      <SectionSurface
        as="form"
        onSubmit={handleCreateLateFeePolicy}
        aria-label={tTerm('settings.lateFee.section.aria')}
        title={tTerm('settings.lateFee.section.title')}
        subtitle={tTerm('settings.lateFee.section.subtitle')}
        bodyClassName="space-y-4"
      >
        <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(220px,1fr)_150px_190px_110px]">
          <FormField
            label={tTerm('settings.lateFee.field.name')}
            tooltip={tTerm('settings.lateFee.field.nameTooltip')}
          >
            <TextInput
              aria-label={tTerm('settings.lateFee.field.name')}
              required
              value={newLateFeePolicy.label}
              onChange={(event) => setNewLateFeePolicy((prev) => ({ ...prev, label: event.target.value }))}
              placeholder={tTerm('settings.lateFee.field.namePlaceholder')}
            />
          </FormField>
          <FormField
            label={tTerm('settings.lateFee.field.rate')}
            tooltip={tTerm('settings.lateFee.field.rateTooltip')}
          >
            <TextInput
              aria-label={tTerm('settings.lateFee.field.rate')}
              required
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={newLateFeePolicy.annualEffectiveRate}
              onChange={(event) => setNewLateFeePolicy((prev) => ({ ...prev, annualEffectiveRate: event.target.value }))}
              placeholder={tTerm('settings.lateFee.field.ratePlaceholder')}
            />
          </FormField>
          <FormField
            label={tTerm('settings.lateFee.field.mode')}
            tooltip={tTerm('settings.lateFee.field.modeTooltip')}
          >
            <SelectInput
              aria-label={tTerm('settings.lateFee.field.mode')}
              value={newLateFeePolicy.lateFeeMode}
              onChange={(event) => setNewLateFeePolicy((prev) => ({ ...prev, lateFeeMode: event.target.value as LateFeePolicyDraft['lateFeeMode'] }))}
            >
              <option value="SIMPLE">{tTerm('settings.lateFee.type.simple')}</option>
              <option value="COMPOUND">{tTerm('settings.lateFee.type.compound')}</option>
              <option value="NONE">{tTerm('settings.lateFee.type.none')}</option>
            </SelectInput>
          </FormField>
          <FormField
            label={tTerm('settings.lateFee.field.priority')}
            tooltip={tTerm('settings.lateFee.field.priorityTooltip')}
          >
            <TextInput
              aria-label={tTerm('settings.lateFee.field.priority')}
              type="number"
              min="0"
              value={newLateFeePolicy.priority}
              onChange={(event) => setNewLateFeePolicy((prev) => ({ ...prev, priority: event.target.value }))}
            />
          </FormField>
        </div>
        <div className="settings-form-actions">
          <ActionButton
            type="submit"
            disabled={createLateFeePolicy.isPending}
            variant="primary"
            icon={<Save size={16} />}
          >
            {tTerm('settings.lateFee.cta.create')}
          </ActionButton>
          <p className="settings-inline-helper">
            {tTerm('settings.lateFee.note')}
          </p>
        </div>
      </SectionSurface>

      <DataTableSurface>
        <div className="overflow-x-auto">
          <table className="min-w-[760px]" aria-label={tTerm('settings.lateFee.table.aria')}>
            <thead>
              <tr>
                <th>{tTerm('settings.lateFee.table.policy')}</th>
                <th>{tTerm('settings.lateFee.table.rate')}</th>
                <th>{tTerm('settings.lateFee.table.calculation')}</th>
                <th>{tTerm('settings.lateFee.table.priority')}</th>
                <th>{tTerm('settings.lateFee.table.state')}</th>
                <th className="text-right">{tTerm('settings.lateFee.table.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {lateFeePolicies.map((policy: any) => (
                <tr key={policy.id}>
                  <td className="font-semibold">{policy.label}</td>
                  <td className="font-semibold">{policy.annualEffectiveRate}%</td>
                  <td className="text-text-secondary">{getLateFeeModeLabel(policy.lateFeeMode)}</td>
                  <td className="text-text-secondary">{policy.priority}</td>
                  <td><StatusBadge active={policy.isActive !== false} /></td>
                  <td>
                    <div className="flex justify-end gap-2">
                      <ActionButton
                        type="button"
                        onClick={async () => {
                          try {
                            await updateLateFeePolicy.mutateAsync({ id: policy.id, isActive: policy.isActive === false });
                            toast.success({ description: policy.isActive === false ? tTerm('settings.lateFee.toast.activated') : tTerm('settings.lateFee.toast.deactivated') });
                          } catch (error) {
                            console.error('[settings] updateLateFeePolicy failed', error);
                            toast.apiErrorSafe(error, { domain: 'config', action: 'config.update' });
                          }
                        }}
                        disabled={updateLateFeePolicy.isPending}
                        variant="ghost"
                        icon={policy.isActive === false ? <CheckCircle2 size={14} /> : <CircleOff size={14} />}
                        className="min-h-8 px-3 py-1.5 text-xs"
                      >
                        {policy.isActive === false ? tTerm('settings.lateFee.table.activate') : tTerm('settings.lateFee.table.deactivate')}
                      </ActionButton>
                      <ActionButton
                        type="button"
                        onClick={() => handleDelete(policy)}
                        disabled={deleteLateFeePolicy.isPending}
                        variant="danger"
                        icon={<Trash2 size={14} />}
                        className="min-h-8 px-3 py-1.5 text-xs"
                      >
                        {tTerm('settings.lateFee.table.delete')}
                      </ActionButton>
                    </div>
                  </td>
                </tr>
              ))}
              {lateFeePolicies.length === 0 && (
                <tr>
                  <td colSpan={6} className="table-empty-state">{tTerm('settings.lateFee.table.empty')}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </DataTableSurface>
    </>
  );
}
