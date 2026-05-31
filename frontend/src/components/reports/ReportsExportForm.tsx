import { useMemo, useState, type FormEvent } from 'react';
import { getPaymentTypeLabel } from '../../constants/paymentTypes';
import { tTerm } from '../../i18n/terminology';
import { FormField, SelectInput, TextInput } from '../shared/Surfaces';
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
  reportAssociateIdFilter: string;
  onReportAssociateIdFilterChange: (value: string) => void;
  reportCustomerIdFilter: string;
  onReportCustomerIdFilterChange: (value: string) => void;
  reportLoanIdFilter: string;
  onReportLoanIdFilterChange: (value: string) => void;
  reportFormat: ReportExportFormat;
  onReportFormatChange: (value: ReportExportFormat) => void;
  hasInvalidRange: boolean;
  hasInvalidAssociateId: boolean;
  hasInvalidReportCustomerId: boolean;
  hasInvalidReportLoanId: boolean;
  layout?: 'panel' | 'modal';
  formId?: string;
  onSubmit?: (event: FormEvent) => void;
};

const acceptNumericFilter = (value: string, onChange: (value: string) => void) => {
  if (!/^\d*$/.test(value.trim())) {
    return;
  }

  onChange(value);
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
  reportAssociateIdFilter,
  onReportAssociateIdFilterChange,
  reportCustomerIdFilter,
  onReportCustomerIdFilterChange,
  reportLoanIdFilter,
  onReportLoanIdFilterChange,
  reportFormat,
  onReportFormatChange,
  hasInvalidRange,
  hasInvalidAssociateId,
  hasInvalidReportCustomerId,
  hasInvalidReportLoanId,
  layout = 'panel',
  formId,
  onSubmit,
}: ReportsExportFormProps) {
  const [filtersExpanded, setFiltersExpanded] = useState(layout === 'modal');

  const showFormat = reportType === 'credits' || reportType === 'associates' || reportType === 'payouts';
  const showStatus = reportType === 'credits' || reportType === 'associates' || reportType === 'payouts';
  const showAssociateId = reportType === 'associates';
  const showCustomerLoan = reportType === 'credits' || reportType === 'payouts';
  const showPaymentType = reportType === 'payouts';
  const hasAdvancedFilters = showStatus || showAssociateId || showCustomerLoan || showPaymentType;

  const activeAdvancedFilterCount = useMemo(() => {
    let count = 0;
    if (reportStatusFilter) count += 1;
    if (reportPaymentTypeFilter) count += 1;
    if (reportAssociateIdFilter.trim()) count += 1;
    if (reportCustomerIdFilter.trim()) count += 1;
    if (reportLoanIdFilter.trim()) count += 1;
    return count;
  }, [
    reportAssociateIdFilter,
    reportCustomerIdFilter,
    reportLoanIdFilter,
    reportPaymentTypeFilter,
    reportStatusFilter,
  ]);

  const handleTypeChange = (value: string) => {
    const nextType = value as ReportExportType;
    onReportTypeChange(nextType);
    onReportStatusFilterChange('');
    onReportPaymentTypeFilterChange('');
    onReportAssociateIdFilterChange('');
    onReportCustomerIdFilterChange('');
    onReportLoanIdFilterChange('');
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
          <SelectInput
            id="report-type"
            value={reportType}
            onChange={(event) => handleTypeChange(event.target.value)}
          >
            <option value="credits">{tTerm('reports.export.type.credits')}</option>
            <option value="profitability">{tTerm('reports.export.type.profitability')}</option>
            <option value="associates">{tTerm('reports.export.type.associates')}</option>
            <option value="payouts">{tTerm('reports.export.type.payouts')}</option>
          </SelectInput>
        </FormField>

        <FormField label={tTerm('reports.export.from')}>
          <TextInput
            id="report-from"
            type="date"
            value={reportRange.fromDate}
            onChange={(event) => onReportRangeChange('fromDate', event.target.value)}
          />
        </FormField>

        <FormField label={tTerm('reports.export.to')}>
          <TextInput
            id="report-to"
            type="date"
            value={reportRange.toDate}
            onChange={(event) => onReportRangeChange('toDate', event.target.value)}
          />
        </FormField>

        {showFormat && (
          <FormField label={tTerm('reports.export.format')}>
            <SelectInput
              id="report-format"
              value={reportFormat}
              onChange={(event) => onReportFormatChange(event.target.value as ReportExportFormat)}
            >
              <option value="xlsx">{tTerm('reports.export.format.xlsx')}</option>
              <option value="pdf">{tTerm('reports.export.format.pdf')}</option>
            </SelectInput>
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
                <SelectInput
                  id="report-status"
                  value={reportStatusFilter}
                  onChange={(event) => onReportStatusFilterChange(event.target.value)}
                >
                  <option value="">{tTerm('credits.filter.all')}</option>
                  {reportType === 'credits' ? (
                    <>
                      <option value="approved">{tTerm('credits.status.approved')}</option>
                      <option value="active">{tTerm('common.status.active')}</option>
                      <option value="overdue">{tTerm('schedule.status.overdue')}</option>
                      <option value="defaulted">{tTerm('credits.status.defaulted')}</option>
                      <option value="closed">{tTerm('common.status.closed')}</option>
                      <option value="paid">{tTerm('schedule.status.paid')}</option>
                    </>
                  ) : (
                    <>
                      <option value="active">{tTerm('common.status.active')}</option>
                      <option value="inactive">{tTerm('common.status.inactive')}</option>
                    </>
                  )}
                </SelectInput>
              </FormField>
            )}

            {showAssociateId && (
              <FormField label={tTerm('reports.export.associate')}>
                <TextInput
                  id="report-associate"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder={tTerm('reports.export.associate.placeholder')}
                  value={reportAssociateIdFilter}
                  onChange={(event) => acceptNumericFilter(event.target.value, onReportAssociateIdFilterChange)}
                />
              </FormField>
            )}

            {showCustomerLoan && (
              <>
                <FormField label={tTerm('reports.export.customer')}>
                  <TextInput
                    id="report-customer"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder={tTerm('reports.export.idPlaceholder')}
                    value={reportCustomerIdFilter}
                    onChange={(event) => acceptNumericFilter(event.target.value, onReportCustomerIdFilterChange)}
                  />
                </FormField>
                <FormField label={tTerm('reports.export.loan')}>
                  <TextInput
                    id="report-loan"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder={tTerm('reports.export.idPlaceholder')}
                    value={reportLoanIdFilter}
                    onChange={(event) => acceptNumericFilter(event.target.value, onReportLoanIdFilterChange)}
                  />
                </FormField>
              </>
            )}

            {showPaymentType && (
              <FormField label={tTerm('reports.payouts.filter.paymentType')}>
                <SelectInput
                  id="report-payment-type"
                  value={reportPaymentTypeFilter}
                  onChange={(event) => onReportPaymentTypeFilterChange(event.target.value)}
                >
                  <option value="">{tTerm('credits.filter.all')}</option>
                  <option value="installment">{getPaymentTypeLabel('installment')}</option>
                  <option value="partial">{getPaymentTypeLabel('partial')}</option>
                  <option value="capital">{getPaymentTypeLabel('capital')}</option>
                  <option value="payoff">{getPaymentTypeLabel('payoff')}</option>
                </SelectInput>
              </FormField>
            )}

            {showStatus && reportType === 'payouts' && (
              <FormField label={tTerm('reports.payouts.filter.status')}>
                <SelectInput
                  id="report-payout-status"
                  value={reportStatusFilter}
                  onChange={(event) => onReportStatusFilterChange(event.target.value)}
                >
                  <option value="">{tTerm('common.status.completed')}</option>
                  <option value="annulled">{tTerm('reports.payouts.status.annulled')}</option>
                </SelectInput>
              </FormField>
            )}
          </div>
        </div>
      )}

      {(hasInvalidRange || hasInvalidAssociateId || hasInvalidReportCustomerId || hasInvalidReportLoanId) && (
        <div className="reports-export-form__errors" role="status">
          {hasInvalidRange && <p>{tTerm('reports.export.invalidRange')}</p>}
          {hasInvalidAssociateId && <p>{tTerm('reports.export.invalidAssociate')}</p>}
          {hasInvalidReportCustomerId && <p>{tTerm('reports.export.invalidCustomer')}</p>}
          {hasInvalidReportLoanId && <p>{tTerm('reports.export.invalidLoan')}</p>}
        </div>
      )}
    </form>
  );
}
