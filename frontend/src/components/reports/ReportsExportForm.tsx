import { useMemo, useState, type FormEvent } from 'react';
import { getPaymentTypeLabel } from '../../constants/paymentTypes';
import { tTerm } from '../../i18n/terminology';
import { AppInput, CustomerSearchSelect, FormField, LoanSearchSelect, OperationalSelect, UserSearchSelect } from '../shared/Surfaces';
import type { ReportExportFormat, ReportExportType } from './reportsExportHelpers';

export type ReportsExportFormProps = {
  reportType: ReportExportType;
  onReportTypeChange: (type: ReportExportType) => void;
  reportRange: { fromDate: string; toDate: string };
  onReportRangeChange: (key: 'fromDate' | 'toDate', value: string) => void;
  reportStatusFilter: string;
  onReportStatusFilterChange: (value: string) => void;
  reportPaymentTypeFilter: string;
  onReportPaymentTypeFilterChange: (value: string) => void;
  reportEmployeeIdFilter: string;
  onReportEmployeeIdFilterChange: (value: string) => void;
  canFilterByEmployee?: boolean;
  reportCustomerIdFilter: string;
  onReportCustomerIdFilterChange: (value: string) => void;
  reportLoanIdFilter: string;
  onReportLoanIdFilterChange: (value: string) => void;
  reportFinancialProductIdFilter: string;
  onReportFinancialProductIdFilterChange: (value: string) => void;
  financialProductOptions?: Array<{ value: string; label: string }>;
  reportFormat: ReportExportFormat;
  onReportFormatChange: (value: ReportExportFormat) => void;
  hasInvalidRange: boolean;
  hasInvalidReportCustomerId: boolean;
  hasInvalidReportLoanId: boolean;
  layout?: 'panel' | 'modal';
  formId?: string;
  onSubmit?: (event: FormEvent) => void;
};

export default function ReportsExportForm({
  reportType,
  onReportTypeChange,
  reportRange,
  onReportRangeChange,
  reportStatusFilter,
  onReportStatusFilterChange,
  reportPaymentTypeFilter,
  onReportPaymentTypeFilterChange,
  reportEmployeeIdFilter,
  onReportEmployeeIdFilterChange,
  canFilterByEmployee = false,
  reportCustomerIdFilter,
  onReportCustomerIdFilterChange,
  reportLoanIdFilter,
  onReportLoanIdFilterChange,
  reportFinancialProductIdFilter,
  onReportFinancialProductIdFilterChange,
  financialProductOptions = [],
  reportFormat,
  onReportFormatChange,
  hasInvalidRange,
  hasInvalidReportCustomerId,
  hasInvalidReportLoanId,
  layout = 'panel',
  formId,
  onSubmit,
}: ReportsExportFormProps) {
  const [filtersExpanded, setFiltersExpanded] = useState(layout === 'modal');
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [loanSearchQuery, setLoanSearchQuery] = useState('');
  const [employeeSearchQuery, setEmployeeSearchQuery] = useState('');

  const showFormat = reportType === 'credits' || reportType === 'payouts' || reportType === 'profitability';
  const showStatus = reportType === 'credits' || reportType === 'payouts';
  const showCustomerLoan = reportType === 'credits' || reportType === 'payouts';
  const showFinancialProduct = reportType === 'credits';
  const showPaymentType = reportType === 'payouts';
  const showEmployee = reportType === 'payouts' && canFilterByEmployee;
  const hasAdvancedFilters = showStatus || showCustomerLoan || showFinancialProduct || showPaymentType || showEmployee;

  const activeAdvancedFilterCount = useMemo(() => {
    let count = 0;
    if (reportStatusFilter) count += 1;
    if (reportPaymentTypeFilter) count += 1;
    if (reportEmployeeIdFilter.trim()) count += 1;
    if (reportCustomerIdFilter.trim()) count += 1;
    if (reportLoanIdFilter.trim()) count += 1;
    if (reportFinancialProductIdFilter.trim()) count += 1;
    return count;
  }, [
    reportCustomerIdFilter,
    reportEmployeeIdFilter,
    reportFinancialProductIdFilter,
    reportLoanIdFilter,
    reportPaymentTypeFilter,
    reportStatusFilter,
  ]);

  const handleTypeChange = (value: string) => {
    const nextType = value as ReportExportType;
    onReportTypeChange(nextType);
    onReportStatusFilterChange('');
    onReportPaymentTypeFilterChange('');
    onReportEmployeeIdFilterChange('');
    onReportCustomerIdFilterChange('');
    onReportLoanIdFilterChange('');
    onReportFinancialProductIdFilterChange('');
    setCustomerSearchQuery('');
    setLoanSearchQuery('');
    setEmployeeSearchQuery('');
    setFiltersExpanded(layout === 'modal');
  };

  const advancedVisible = layout === 'modal' || filtersExpanded;

  return (
    <form
      id={formId}
      className={layout === 'modal' ? 'reports-export-form reports-export-form--modal' : 'reports-export-form'}
      onSubmit={onSubmit}
    >
      <div className="reports-export-form__core">
        <FormField label={tTerm('reports.export.type')}>
          <OperationalSelect
            id="report-type"
            value={reportType}
            onChange={(event) => handleTypeChange(event.target.value)}
          >
            <option value="credits">{tTerm('reports.export.type.credits')}</option>
            <option value="profitability">{tTerm('reports.export.type.profitability')}</option>
            <option value="payouts">{tTerm('reports.export.type.payouts')}</option>
          </OperationalSelect>
        </FormField>

        <FormField label={tTerm('reports.export.from')}>
          <AppInput
            id="report-from"
            variant="date"
            value={reportRange.fromDate}
            onValueChange={(v, _detail, e) => onReportRangeChange('fromDate', v)}
          />
        </FormField>

        <FormField label={tTerm('reports.export.to')}>
          <AppInput
            id="report-to"
            variant="date"
            value={reportRange.toDate}
            onValueChange={(v, _detail, e) => onReportRangeChange('toDate', v)}
          />
        </FormField>

        {showFormat && (
          <FormField label={tTerm('reports.export.format')}>
            <OperationalSelect
              id="report-format"
              value={reportFormat}
              onChange={(event) => onReportFormatChange(event.target.value as ReportExportFormat)}
            >
              <option value="xlsx">{tTerm('reports.export.format.xlsx')}</option>
              <option value="pdf">{tTerm('reports.export.format.pdf')}</option>
            </OperationalSelect>
          </FormField>
        )}
      </div>

      {hasAdvancedFilters && layout === 'panel' && (
        <div className="reports-export-form__toggle-wrap">
          <button
            type="button"
            className="reports-export-form__toggle"
            onClick={() => setFiltersExpanded((open) => !open)}
            aria-expanded={filtersExpanded}
            aria-controls="report-export-advanced"
          >
            {filtersExpanded
              ? tTerm('reports.export.toggle.hide')
              : activeAdvancedFilterCount > 0
                ? tTerm('reports.export.toggle.showWithCount', { count: activeAdvancedFilterCount })
                : tTerm('reports.export.toggle.show')}
          </button>
        </div>
      )}

      {hasAdvancedFilters && advancedVisible && (
        <div id="report-export-advanced" className="reports-export-form__advanced">
          {layout === 'panel' && (
            <p className="reports-export-form__advanced-title">{tTerm('reports.export.advancedTitle')}</p>
          )}
          <div className="reports-export-form__advanced-grid">
            {showStatus && reportType !== 'payouts' && (
              <FormField label={tTerm('reports.export.status')}>
                <OperationalSelect
                  id="report-status"
                  value={reportStatusFilter}
                  onChange={(event) => onReportStatusFilterChange(event.target.value)}
                >
                  <option value="">{tTerm('credits.filter.all')}</option>
                  <option value="approved">{tTerm('credits.status.approved')}</option>
                  <option value="active">{tTerm('common.status.active')}</option>
                  <option value="overdue">{tTerm('schedule.status.overdue')}</option>
                  <option value="defaulted">{tTerm('credits.status.defaulted')}</option>
                  <option value="closed">{tTerm('common.status.closed')}</option>
                  <option value="paid">{tTerm('schedule.status.paid')}</option>
                </OperationalSelect>
              </FormField>
            )}

            {showFinancialProduct && (
              <FormField label={tTerm('reports.export.financialProduct')}>
                <OperationalSelect
                  id="report-financial-product"
                  value={reportFinancialProductIdFilter}
                  onChange={(event) => onReportFinancialProductIdFilterChange(event.target.value)}
                >
                  <option value="">{tTerm('reports.creditHistory.financialProduct.all')}</option>
                  {financialProductOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </OperationalSelect>
              </FormField>
            )}

            {showCustomerLoan && (
              <>
                <FormField label={tTerm('reports.export.customer')}>
                  <CustomerSearchSelect
                    id="report-customer"
                    selectedCustomerId={reportCustomerIdFilter}
                    searchValue={customerSearchQuery}
                    onSearchValueChange={setCustomerSearchQuery}
                    onSelectedCustomerIdChange={onReportCustomerIdFilterChange}
                    placeholder={tTerm('reports.export.customerSearch.placeholder')}
                    listboxLabel={tTerm('reports.export.customerSearch.results')}
                  />
                </FormField>
                <FormField label={tTerm('reports.export.loan')}>
                  <LoanSearchSelect
                    id="report-loan"
                    selectedLoanId={reportLoanIdFilter}
                    searchValue={loanSearchQuery}
                    onSearchValueChange={setLoanSearchQuery}
                    onSelectedLoanIdChange={onReportLoanIdFilterChange}
                    placeholder={tTerm('reports.export.loanSearch.placeholder')}
                    listboxLabel={tTerm('reports.export.loanSearch.results')}
                  />
                </FormField>
              </>
            )}

            {showPaymentType && (
              <FormField label={tTerm('reports.payouts.filter.paymentType')}>
                <OperationalSelect
                  id="report-payment-type"
                  value={reportPaymentTypeFilter}
                  onChange={(event) => onReportPaymentTypeFilterChange(event.target.value)}
                >
                  <option value="">{tTerm('credits.filter.all')}</option>
                  <option value="installment">{getPaymentTypeLabel('installment')}</option>
                  <option value="partial">{getPaymentTypeLabel('partial')}</option>
                  <option value="capital">{getPaymentTypeLabel('capital')}</option>
                  <option value="payoff">{getPaymentTypeLabel('payoff')}</option>
                </OperationalSelect>
              </FormField>
            )}

            {showEmployee && (
              <FormField label={tTerm('reports.payouts.filter.employee')}>
                <UserSearchSelect
                  id="report-employee"
                  selectedUserId={reportEmployeeIdFilter}
                  searchValue={employeeSearchQuery}
                  onSearchValueChange={setEmployeeSearchQuery}
                  onSelectedUserIdChange={onReportEmployeeIdFilterChange}
                  placeholder={tTerm('userSearch.placeholder')}
                  listboxLabel={tTerm('reports.payouts.filter.employee')}
                  role="administrative"
                />
              </FormField>
            )}

            {showStatus && reportType === 'payouts' && (
              <FormField label={tTerm('reports.payouts.filter.status')}>
                <OperationalSelect
                  id="report-payout-status"
                  value={reportStatusFilter}
                  onChange={(event) => onReportStatusFilterChange(event.target.value)}
                >
                  <option value="">{tTerm('common.status.completed')}</option>
                  <option value="annulled">{tTerm('reports.payouts.status.annulled')}</option>
                </OperationalSelect>
              </FormField>
            )}
          </div>
        </div>
      )}

      {(hasInvalidRange || hasInvalidReportCustomerId || hasInvalidReportLoanId) && (
        <div className="reports-export-form__errors" role="status">
          {hasInvalidRange && <p>{tTerm('reports.export.invalidRange')}</p>}
          {hasInvalidReportCustomerId && <p>{tTerm('reports.export.invalidCustomer')}</p>}
          {hasInvalidReportLoanId && <p>{tTerm('reports.export.invalidLoan')}</p>}
        </div>
      )}
    </form>
  );
}
