import { useState } from 'react';
import { AlertTriangle, CreditCard, Percent, ShieldCheck } from 'lucide-react';
import { useConfig } from '../services/configService';
import { tTerm } from '../i18n/terminology';
import { PageHeader, PageShell, ViewTabs } from './shared/Surfaces';
import type { SettingsTab } from './settings/settingsHelpers';
import EmployeesTab from './settings/EmployeesTab';
import PaymentMethodsTab from './settings/PaymentMethodsTab';
import RatePoliciesTab from './settings/RatePoliciesTab';
import LateFeePoliciesTab from './settings/LateFeePoliciesTab';

export default function Settings() {
  const {
    paymentMethods: rawPaymentMethods,
    ratePolicies: rawRatePolicies,
    lateFeePolicies: rawLateFeePolicies,
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
      </section>
    </PageShell>
  );
}
