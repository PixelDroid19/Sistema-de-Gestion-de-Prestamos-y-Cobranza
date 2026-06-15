import { useState } from 'react';
import { AlertTriangle, Coins, CreditCard, Percent, ShieldCheck } from 'lucide-react';
import { useConfig } from '../services/configService';
import { tTerm } from '../i18n/terminology';
import { BASE_CURRENCY_CODE, getBaseCurrencyLabel } from '../i18n/format';
import { PageHeader, PageShell, SectionSurface, StatusChip, ViewTabs } from './shared/Surfaces';
import type { SettingsTab } from './settings/settingsHelpers';
import EmployeesTab from './settings/EmployeesTab';
import PaymentMethodsTab from './settings/PaymentMethodsTab';
import RatePoliciesTab from './settings/RatePoliciesTab';
import LateFeePoliciesTab from './settings/LateFeePoliciesTab';

function BaseCurrencyTab({ businessSettings }: { businessSettings: Record<string, string> }) {
  const currentCurrency = businessSettings.base_currency || businessSettings['base-currency'] || BASE_CURRENCY_CODE;

  return (
    <SectionSurface
      title={tTerm('settings.currency.title')}
      subtitle={tTerm('settings.currency.subtitle')}
      actions={<StatusChip tone="info" icon={<Coins size={16} />}>{tTerm('settings.currency.locked')}</StatusChip>}
      bodyClassName="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end"
    >
      <div className="space-y-3">
        <p className="text-3xl font-semibold text-text-primary">{getBaseCurrencyLabel()}</p>
        <p className="max-w-3xl text-base leading-relaxed text-text-secondary">
          {tTerm('settings.currency.description')}
        </p>
        <p className="max-w-3xl text-sm leading-relaxed text-text-muted">
          {tTerm('settings.currency.multiCurrencyNote')}
        </p>
      </div>
      <div className="text-left md:min-w-56 md:border-l md:border-border-soft md:pl-6">
        <p className="text-xs font-semibold uppercase text-text-muted">
          {tTerm('settings.currency.currentLabel')}
        </p>
        <p className="mt-2 text-2xl font-semibold text-text-primary">{currentCurrency}</p>
      </div>
    </SectionSurface>
  );
}

export default function Settings() {
  const {
    paymentMethods: rawPaymentMethods,
    ratePolicies: rawRatePolicies,
    lateFeePolicies: rawLateFeePolicies,
    businessSettings,
    isLoading,
    createPaymentMethod,
    updatePaymentMethod,
    deletePaymentMethod,
    createRatePolicy,
    updateRatePolicy,
    deleteRatePolicy,
    createLateFeePolicy,
    updateLateFeePolicy,
    deleteLateFeePolicy,
  } = useConfig();
  const paymentMethods = rawPaymentMethods as any[];
  const ratePolicies = rawRatePolicies as any[];
  const lateFeePolicies = rawLateFeePolicies as any[];
  const [activeTab, setActiveTab] = useState<SettingsTab>('employees');

  if (isLoading) {
    return (
      <PageShell data-tour="settings-page">
        <PageHeader
          title={tTerm('settings.module.title')}
          subtitle={tTerm('settings.module.loadingSubtitle')}
          guideKey="settings"
          tourId="settings-header"
        />
        <div className="table-empty-state">{tTerm('settings.state.loading')}</div>
      </PageShell>
    );
  }

  return (
    <PageShell data-tour="settings-page" className="settings-page">
      <PageHeader
        title={tTerm('settings.module.title')}
        subtitle={tTerm('settings.module.subtitle')}
        guideKey="settings"
        tourId="settings-header"
      />

      <ViewTabs
        data-tour="settings-tabs"
        ariaLabel={tTerm('settings.tabs.aria')}
        activeTab={activeTab}
        onChange={(tabId) => setActiveTab(tabId as SettingsTab)}
        tabs={[
          { id: 'payment-methods', label: tTerm('settings.tabs.paymentMethods'), count: paymentMethods.length, icon: CreditCard },
          { id: 'rate-policies', label: tTerm('settings.tabs.ratePolicies'), count: ratePolicies.length, icon: Percent },
          { id: 'late-fee-policies', label: tTerm('settings.tabs.lateFeePolicies'), count: lateFeePolicies.length, icon: AlertTriangle },
          { id: 'base-currency', label: tTerm('settings.tabs.baseCurrency'), icon: Coins },
          { id: 'employees', label: tTerm('settings.tabs.employees'), icon: ShieldCheck },
        ]}
      />

      <section className="settings-content" data-tour="settings-content">
        {activeTab === 'employees' && <EmployeesTab />}

        {activeTab === 'payment-methods' && (
          <PaymentMethodsTab
            paymentMethods={paymentMethods}
            createPaymentMethod={createPaymentMethod}
            updatePaymentMethod={updatePaymentMethod}
            deletePaymentMethod={deletePaymentMethod}
          />
        )}

        {activeTab === 'rate-policies' && (
          <RatePoliciesTab
            ratePolicies={ratePolicies}
            createRatePolicy={createRatePolicy}
            updateRatePolicy={updateRatePolicy}
            deleteRatePolicy={deleteRatePolicy}
          />
        )}

        {activeTab === 'late-fee-policies' && (
          <LateFeePoliciesTab
            lateFeePolicies={lateFeePolicies}
            createLateFeePolicy={createLateFeePolicy}
            updateLateFeePolicy={updateLateFeePolicy}
            deleteLateFeePolicy={deleteLateFeePolicy}
          />
        )}

        {activeTab === 'base-currency' && (
          <BaseCurrencyTab businessSettings={businessSettings as Record<string, string>} />
        )}
      </section>
    </PageShell>
  );
}
