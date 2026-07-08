import type { ReactNode } from 'react';
import { DollarSign } from 'lucide-react';
import { tTerm } from '../../i18n/terminology';
import { AppTable, TableActionsCell, TableActionsHeader, TableSectionIntro } from '../shared/tables';
import { TabEmptyState } from './CreditDetailsTabs';
import { PaymentStatusBadge, PaymentTypeBadge } from './paymentTablePresentation';
import { stableCreditKey } from './creditDetailsHelpers';

type PayoutsTabProps = {
  paymentHistoryEntries: any[];
  formatCurrency: (value: unknown) => string;
  formatDate: (value: unknown, withTime?: boolean) => string;
  formatPaymentMethod: (value: unknown) => string;
  renderPaymentRowActions: (entry: any, options?: { align?: 'start' | 'end' | 'center' }) => ReactNode;
};

const formatCapitalStrategy = (value: unknown) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'reduce_payment' || normalized === 'reduce_quota') {
    return tTerm('creditDetails.payouts.capitalEffect.reducePayment');
  }
  if (normalized === 'reduce_term' || normalized === 'reduce_time') {
    return tTerm('creditDetails.payouts.capitalEffect.reduceTerm');
  }
  return tTerm('common.notAvailable');
};

const getCapitalEffect = (entry: any) => {
  const metadata = entry?.paymentMetadata && typeof entry.paymentMetadata === 'object'
    ? entry.paymentMetadata
    : {};
  if (entry?.paymentType !== 'capital' && !metadata.capital_reduction) {
    return null;
  }

  const before = metadata.before && typeof metadata.before === 'object' ? metadata.before : {};
  const after = metadata.after && typeof metadata.after === 'object' ? metadata.after : {};
  const strategy = metadata.strategyApplied || metadata.strategy || metadata.strategyRequested;

  return {
    strategy: formatCapitalStrategy(strategy),
    beforePrincipal: before.outstandingPrincipal,
    afterPrincipal: after.outstandingPrincipal,
    beforeInstallments: before.remainingInstallments,
    afterInstallments: after.remainingInstallments,
    nextInstallment: after.installmentAmount,
  };
};

function CapitalEffectSummary({
  entry,
  formatCurrency,
}: {
  entry: any;
  formatCurrency: (value: unknown) => string;
}) {
  const effect = getCapitalEffect(entry);
  if (!effect) {
    return <span className="text-text-secondary">—</span>;
  }

  const hasPrincipalChange = effect.beforePrincipal !== undefined || effect.afterPrincipal !== undefined;
  const hasInstallmentsChange = effect.beforeInstallments !== undefined || effect.afterInstallments !== undefined;

  return (
    <div className="min-w-0 space-y-1 text-sm leading-5">
      <p className="font-semibold text-text-primary">{effect.strategy}</p>
      {hasPrincipalChange ? (
        <p className="text-text-secondary">
          {tTerm('creditDetails.payouts.capitalEffect.newPrincipal')}: <span className="font-medium text-text-primary">{formatCurrency(effect.afterPrincipal)}</span>
        </p>
      ) : null}
      {hasInstallmentsChange ? (
        <p className="text-text-secondary">
          {tTerm('creditDetails.payouts.capitalEffect.installments')}: <span className="font-medium text-text-primary">{effect.beforeInstallments ?? '—'} -&gt; {effect.afterInstallments ?? '—'}</span>
        </p>
      ) : null}
      {effect.nextInstallment !== undefined && effect.nextInstallment !== null ? (
        <p className="text-text-secondary">
          {tTerm('creditDetails.payouts.capitalEffect.nextInstallment')}: <span className="font-medium text-text-primary">{formatCurrency(effect.nextInstallment)}</span>
        </p>
      ) : null}
    </div>
  );
}

export function PayoutsTab({
  paymentHistoryEntries,
  formatCurrency,
  formatDate,
  formatPaymentMethod,
  renderPaymentRowActions,
}: PayoutsTabProps) {
  if (paymentHistoryEntries.length === 0) {
    return (
      <TabEmptyState
        icon={DollarSign}
        title={tTerm('creditDetails.payouts.empty.title')}
        description={tTerm('creditDetails.payouts.empty.description')}
      />
    );
  }

  return (
    <div className="space-y-4">
      <TableSectionIntro
        title={tTerm('creditDetails.payouts.title')}
        description={tTerm('creditDetails.payouts.description')}
      />

      <div className="grid gap-4 lg:hidden">
        {paymentHistoryEntries.map((entry: any) => (
          <article
            key={stableCreditKey('payment-card', entry.id, entry.date, entry.amount, entry.installmentNumber)}
            className="rounded-2xl border border-border-subtle bg-bg-surface p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <PaymentTypeBadge entry={entry} />
                  {entry.installmentNumber ? (
                    <span className="text-xs font-medium text-text-secondary">
                      {tTerm('creditDetails.payouts.table.installment')}: {entry.installmentNumber}
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 text-xl font-bold text-text-primary">{formatCurrency(entry.amount)}</p>
                <p className="mt-1 text-sm text-text-secondary">
                  {formatDate(entry.date || entry.paymentDate)}
                  {' · '}
                  {formatPaymentMethod(entry.paymentMethod)}
                </p>
              </div>
              <PaymentStatusBadge entry={entry} />
            </div>

            <dl className="mt-4 grid gap-3 sm:grid-cols-3">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
                  {tTerm('creditDetails.payouts.table.capital')}
                </dt>
                <dd className="mt-1 text-sm font-medium text-emerald-600 dark:text-emerald-300">
                  {entry.principalApplied ? formatCurrency(entry.principalApplied) : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
                  {tTerm('creditDetails.label.interest')}
                </dt>
                <dd className="mt-1 text-sm font-medium text-amber-600 dark:text-amber-300">
                  {entry.interestApplied ? formatCurrency(entry.interestApplied) : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
                  {tTerm('creditDetails.label.lateFee')}
                </dt>
                <dd className="mt-1 text-sm font-medium text-rose-600 dark:text-rose-300">
                  {entry.penaltyApplied ? formatCurrency(entry.penaltyApplied) : '—'}
                </dd>
              </div>
            </dl>

            <div className="mt-4 rounded-lg border border-border-subtle bg-bg-base px-3 py-2">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
                {tTerm('creditDetails.payouts.table.effect')}
              </p>
              <div className="mt-2">
                <CapitalEffectSummary entry={entry} formatCurrency={formatCurrency} />
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-2 border-t border-border-subtle pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-text-secondary">
                {tTerm('creditDetails.payouts.table.createdBy')}: {entry.createdBy?.name || tTerm('common.notAvailable')}
              </p>
              {renderPaymentRowActions(entry, { align: 'start' })}
            </div>
          </article>
        ))}
      </div>

      <AppTable
        variant="financial"
        visibleFrom="lg"
        horizontalScroll
        minWidthClassName="min-w-[1220px]"
        data-testid="credit-payouts-table"
      >
        <colgroup>
          <col style={{ width: '8%' }} />
          <col style={{ width: '5%' }} />
          <col style={{ width: '9%' }} />
          <col style={{ width: '8%' }} />
          <col style={{ width: '7%' }} />
          <col style={{ width: '6%' }} />
          <col style={{ width: '17%' }} />
          <col style={{ width: '8%' }} />
          <col style={{ width: '9%' }} />
          <col style={{ width: '8%' }} />
          <col style={{ width: '6%' }} />
          <col style={{ width: '9%' }} />
        </colgroup>
        <thead>
          <tr>
            <th>{tTerm('creditDetails.payouts.table.type')}</th>
            <th className="text-center">{tTerm('creditDetails.payouts.table.installment')}</th>
            <th className="text-right">{tTerm('creditDetails.payouts.table.amount')}</th>
            <th className="text-right">{tTerm('creditDetails.payouts.table.capital')}</th>
            <th className="text-right">{tTerm('creditDetails.label.interest')}</th>
            <th className="text-right">{tTerm('creditDetails.label.lateFee')}</th>
            <th>{tTerm('creditDetails.payouts.table.effect')}</th>
            <th>{tTerm('creditDetails.payouts.table.method')}</th>
            <th>{tTerm('creditDetails.payouts.table.createdBy')}</th>
            <th>{tTerm('creditDetails.payouts.table.paymentDate')}</th>
            <th className="text-center">{tTerm('creditDetails.payouts.table.status')}</th>
            <TableActionsHeader>{tTerm('creditDetails.payouts.table.actions')}</TableActionsHeader>
          </tr>
        </thead>
        <tbody>
          {paymentHistoryEntries.map((entry: any) => (
            <tr key={stableCreditKey('payment-row', entry.id, entry.date, entry.amount, entry.installmentNumber)} className="group">
              <td>
                <PaymentTypeBadge entry={entry} />
              </td>
              <td className="text-center font-medium text-text-secondary">{entry.installmentNumber || '—'}</td>
              <td className="text-right font-medium text-text-primary">{formatCurrency(entry.amount)}</td>
              <td className="text-right font-medium text-emerald-600 dark:text-emerald-400">
                {entry.principalApplied ? formatCurrency(entry.principalApplied) : '—'}
              </td>
              <td className="text-right text-text-secondary">
                {entry.interestApplied ? formatCurrency(entry.interestApplied) : '—'}
              </td>
              <td className="text-right text-red-600 dark:text-red-400">
                {entry.penaltyApplied ? formatCurrency(entry.penaltyApplied) : '—'}
              </td>
              <td>
                <CapitalEffectSummary entry={entry} formatCurrency={formatCurrency} />
              </td>
              <td className="text-text-secondary">{formatPaymentMethod(entry.paymentMethod)}</td>
              <td className="text-text-secondary">{entry.createdBy?.name || tTerm('common.notAvailable')}</td>
              <td className="text-text-secondary">{formatDate(entry.date || entry.paymentDate)}</td>
              <td className="text-center">
                <PaymentStatusBadge entry={entry} />
              </td>
              <TableActionsCell>
                {renderPaymentRowActions(entry)}
              </TableActionsCell>
            </tr>
          ))}
        </tbody>
      </AppTable>
    </div>
  );
}
