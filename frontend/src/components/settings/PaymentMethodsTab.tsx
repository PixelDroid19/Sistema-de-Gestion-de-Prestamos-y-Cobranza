import React, { useState } from 'react';
import { CheckCircle2, CircleOff, Plus, Save, Trash2 } from 'lucide-react';
import { tTerm } from '../../i18n/terminology';
import { toast } from '../../lib/toast';
import { confirmDanger } from '../../lib/confirmModal';
import { reportClientError } from '../../lib/clientDiagnostics';
import {
  ActionButton,
  FormField,
  AppInput,
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
  type PaymentMethodDraft,
  getMethodName,
  getMethodTypeLabel,
  validatePaymentMethodDraft,
} from './settingsHelpers';

type Props = {
  paymentMethods: any[];
  createPaymentMethod: { mutateAsync: (data: any) => Promise<any>; isPending: boolean };
  updatePaymentMethod: { mutateAsync: (data: any) => Promise<any>; isPending: boolean };
  deletePaymentMethod: { mutateAsync: (id: any) => Promise<any>; isPending: boolean };
};

export default function PaymentMethodsTab({
  paymentMethods,
  createPaymentMethod,
  updatePaymentMethod,
  deletePaymentMethod,
}: Props) {
  const [newPaymentMethod, setNewPaymentMethod] = useState<PaymentMethodDraft>({
    name: '',
    description: '',
    type: 'bank_transfer',
  });
  const [isPaymentMethodModalOpen, setIsPaymentMethodModalOpen] = useState(false);

  const resetPaymentMethodDraft = () => {
    setNewPaymentMethod({ name: '', description: '', type: 'bank_transfer' });
    setIsPaymentMethodModalOpen(false);
  };

  const handleCreatePaymentMethod = async (event: React.FormEvent) => {
    event.preventDefault();
    const validationError = validatePaymentMethodDraft(newPaymentMethod, paymentMethods);
    if (validationError) {
      toast.error({ title: tTerm('settings.validation.reviewConfig'), description: validationError });
      return;
    }

    try {
      await createPaymentMethod.mutateAsync({
        ...newPaymentMethod,
        isActive: true,
      });
      resetPaymentMethodDraft();
      toast.success({ description: tTerm('settings.paymentMethods.toast.created') });
    } catch (error) {
      reportClientError('settings.paymentMethod.create', error);
      toast.apiErrorSafe(error, { domain: 'config', action: 'config.update' });
    }
  };

  const handleDelete = async (method: any) => {
    const confirmed = await confirmDanger({
      title: tTerm('settings.paymentMethods.delete.title'),
      message: tTerm('settings.paymentMethods.delete.message', { name: getMethodName(method) }),
      confirmLabel: tTerm('settings.validation.deleteConfirm'),
    });
    if (!confirmed) return;

    try {
      await deletePaymentMethod.mutateAsync(method.id);
      toast.success({ description: tTerm('settings.paymentMethods.toast.deleted') });
    } catch (error) {
      reportClientError('settings.paymentMethod.delete', error);
      toast.apiErrorSafe(error, { domain: 'config', action: 'config.update' });
    }
  };

  const paymentMethodForm = (
    <form id="payment-method-form" onSubmit={handleCreatePaymentMethod} aria-label={tTerm('settings.paymentMethods.section.aria')} className="space-y-4">
      <div className="grid min-w-0 gap-3 md:grid-cols-[minmax(220px,1fr)_180px]">
        <FormField
          label={tTerm('settings.paymentMethods.field.name')}
          tooltip={tTerm('settings.paymentMethods.field.nameTooltip')}
        >
          <AppInput
            aria-label={tTerm('settings.paymentMethods.field.name')}
            variant="text"
            required
            value={newPaymentMethod.name}
            onValueChange={(v, _detail, e) => setNewPaymentMethod((prev) => ({ ...prev, name: v }))}
            placeholder={tTerm('settings.paymentMethods.field.namePlaceholder')}
          />
        </FormField>

        <FormField
          label={tTerm('settings.paymentMethods.field.type')}
          tooltip={tTerm('settings.paymentMethods.field.typeTooltip')}
        >
          <OperationalSelect
            aria-label={tTerm('settings.paymentMethods.field.type')}
            value={newPaymentMethod.type}
            onChange={(event) => setNewPaymentMethod((prev) => ({ ...prev, type: event.target.value as PaymentMethodDraft['type'] }))}
          >
            <option value="bank_transfer">{tTerm('settings.paymentMethods.type.bankTransfer')}</option>
            <option value="cash">{tTerm('settings.paymentMethods.type.cash')}</option>
            <option value="card">{tTerm('settings.paymentMethods.type.card')}</option>
            <option value="other">{tTerm('settings.paymentMethods.type.other')}</option>
          </OperationalSelect>
        </FormField>
      </div>
      <FormField label={tTerm('settings.paymentMethods.field.description')}>
        <AppInput
          aria-label={tTerm('settings.paymentMethods.field.description')}
          variant="text"
          value={newPaymentMethod.description}
          onValueChange={(v, _detail, e) => setNewPaymentMethod((prev) => ({ ...prev, description: v }))}
          placeholder={tTerm('settings.paymentMethods.field.descriptionPlaceholder')}
        />
      </FormField>
    </form>
  );

  return (
    <>
      <SectionSurface
        title={tTerm('settings.paymentMethods.section.title')}
        subtitle={tTerm('settings.paymentMethods.section.subtitle')}
        actions={(
          <ActionButton
            type="button"
            variant="primary"
            icon={<Plus size={16} />}
            onClick={() => setIsPaymentMethodModalOpen(true)}
          >
            {tTerm('settings.paymentMethods.cta.openCreate')}
          </ActionButton>
        )}
      >
        <p className="text-sm leading-6 text-text-secondary">{tTerm('settings.paymentMethods.note')}</p>
      </SectionSurface>

      <AppTable variant="operational" shell="off" minWidthClassName="min-w-[760px]" aria-label={tTerm('settings.paymentMethods.table.aria')}>
            <thead>
              <tr>
                <th>{tTerm('settings.paymentMethods.table.method')}</th>
                <th>{tTerm('settings.paymentMethods.table.type')}</th>
                <th>{tTerm('settings.paymentMethods.table.reference')}</th>
                <th>{tTerm('settings.paymentMethods.table.state')}</th>
                <TableActionsHeader>{tTerm('settings.paymentMethods.table.actions')}</TableActionsHeader>
              </tr>
            </thead>
            <tbody>
              {paymentMethods.map((method: any) => (
                <tr key={method.id}>
                  <td>
                    <p className="font-semibold text-text-primary">{getMethodName(method)}</p>
                    {method.description ? <p className="mt-1 text-xs text-text-secondary">{method.description}</p> : null}
                  </td>
                  <td className="text-text-secondary">{getMethodTypeLabel(method.type)}</td>
                  <td className="text-text-secondary">{method.requiresReference ? tTerm('settings.paymentMethods.table.referenceRequired') : tTerm('settings.paymentMethods.table.referenceOptional')}</td>
                  <td><StatusBadge active={method.isActive !== false} /></td>
                  <TableActionsCell>
                    <RowActionsWithOverflow
                      variant="icon"
                      align="center"
                      ariaLabel={tTerm('settings.paymentMethods.table.actions')}
                      items={[
                        {
                          id: 'toggle',
                          label: method.isActive === false
                            ? tTerm('settings.paymentMethods.cta.activate')
                            : tTerm('settings.paymentMethods.cta.deactivate'),
                          icon: method.isActive === false ? <CheckCircle2 size={16} /> : <CircleOff size={16} />,
                          onClick: async () => {
                            try {
                              await updatePaymentMethod.mutateAsync({
                                id: method.id,
                                isActive: method.isActive === false,
                                type: method.type,
                              });
                              toast.success({
                                description: method.isActive === false
                                  ? tTerm('settings.paymentMethods.toast.activated')
                                  : tTerm('settings.paymentMethods.toast.deactivated'),
                              });
                            } catch (error) {
                              reportClientError('settings.paymentMethod.update', error);
                              toast.apiErrorSafe(error, { domain: 'config', action: 'config.update' });
                            }
                          },
                          disabled: updatePaymentMethod.isPending,
                        },
                        {
                          id: 'delete',
                          label: tTerm('settings.paymentMethods.cta.delete'),
                          icon: <Trash2 size={16} />,
                          onClick: () => handleDelete(method),
                          disabled: deletePaymentMethod.isPending,
                          iconVariant: 'danger',
                          menuTone: 'danger',
                        },
                      ] as RowActionOverflowItem[]}
                    />
                  </TableActionsCell>
                </tr>
              ))}
              {paymentMethods.length === 0 && (
                <tr>
                  <td colSpan={5} className="table-empty-state">{tTerm('settings.paymentMethods.table.empty')}</td>
                </tr>
              )}
            </tbody>
      </AppTable>

      {isPaymentMethodModalOpen && (
        <ModalShell
          title={tTerm('settings.paymentMethods.modal.title')}
          subtitle={tTerm('settings.paymentMethods.modal.subtitle')}
          maxWidthClassName="max-w-2xl"
          onClose={resetPaymentMethodDraft}
          footer={(
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-end">
              <ActionButton type="button" onClick={resetPaymentMethodDraft} disabled={createPaymentMethod.isPending}>
                {tTerm('common.cta.cancel')}
              </ActionButton>
              <ActionButton
                type="submit"
                form="payment-method-form"
                disabled={createPaymentMethod.isPending}
                variant="primary"
                icon={<Save size={16} />}
              >
                {tTerm('settings.paymentMethods.cta.create')}
              </ActionButton>
            </div>
          )}
        >
          {paymentMethodForm}
        </ModalShell>
      )}
    </>
  );
}
