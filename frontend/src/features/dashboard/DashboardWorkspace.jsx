import React, { useMemo, useState } from 'react'
import {
  ArrowDownLeft,
  ArrowRightCircle,
  ArrowUpRight,
  CreditCard,
  MoreHorizontal,
  PlusCircle,
  SendToBack,
  Wallet,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import Badge from '@/components/ui/Badge'
import Card from '@/components/ui/Card'
import StatePanel from '@/components/ui/StatePanel'
import { useDashboardSummaryQuery, useLoansOverviewQuery, usePaymentsOverviewQuery } from '@/hooks/useDashboard'
import { useAssociateProfitabilityQuery } from '@/hooks/useReports'
import WorkspaceChart from '@/components/widgets/WorkspaceChart'
import WorkspaceGrid from '@/components/widgets/WorkspaceGrid'

const PROFIT_FILTERS = ['week', 'month', 'year']
const MONTH_KEYS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov']
const MONTH_HEIGHTS = [30, 0, 50, 70, 0, 30, 40, 30, 40, 50, 60]
const PROFIT_CHART_SERIES = [{ dataKey: 'value', color: '#4f87ff' }]
const SPENDINGS_CHART_SERIES = [{ dataKey: 'value', color: '#f4c168' }]
const PREMIUM_CHART_SERIES = [{ dataKey: 'value' }]
const CHART_AXIS_LABELS = [16, 17, 18, 19, 20, 21, 22]
const QUICK_ACTIONS = [
  { key: 'send', icon: ArrowUpRight },
  { key: 'receive', icon: ArrowDownLeft },
  { key: 'withdraw', icon: SendToBack },
]
const PLANNING_ITEMS = [
  { key: 'paris', current: '$265', target: '$10,000', progress: '20%' },
  { key: 'brazil', current: '$10,465', target: '$14,000', progress: '75%' },
]
const TRANSACTIONS = [
  { key: 'dribbble', amount: '-$5.78', date: 'September 30, 2022', time: '4:38 PM', status: 'pending' },
  { key: 'youtube', amount: '-$1055.78', date: 'October 2, 2022', time: '03:34 AM', status: 'completed' },
  { key: 'apple', amount: '-$345.78', date: 'October 13, 2022', time: '02:04 PM', status: 'completed' },
]
const DASHBOARD_LAYOUTS = {
  lg: [
    { i: 'heroCards', x: 0, y: 0, w: 2, h: 4 },
    { i: 'profit', x: 2, y: 0, w: 2, h: 4 },
    { i: 'income', x: 0, y: 4, w: 1, h: 3 },
    { i: 'expenses', x: 1, y: 4, w: 1, h: 3 },
    { i: 'spendings', x: 2, y: 4, w: 2, h: 3 },
    { i: 'planning', x: 0, y: 7, w: 1, h: 3 },
    { i: 'transactions', x: 1, y: 7, w: 2, h: 3 },
    { i: 'premium', x: 3, y: 7, w: 1, h: 3 },
  ],
}

const TRANSACTION_BRANDS = {
  dribbble: 'agents-page__brand--rose',
  youtube: 'agents-page__brand--red',
  apple: 'agents-page__brand--ink',
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount || 0)
}

function getOverviewItems(data, primaryKey, nestedKey) {
  if (Array.isArray(data?.items)) return data.items
  if (Array.isArray(data?.data?.[primaryKey])) return data.data[primaryKey]
  if (Array.isArray(data?.data?.[nestedKey])) return data.data[nestedKey]
  if (Array.isArray(data?.data)) return data.data
  return []
}

function sumMoney(items, key) {
  return items.reduce((sum, item) => sum + Number(item?.[key] || 0), 0)
}

function buildDashboardSummary({ isPartner, partnerSummary, isAdmin, dashboardSummary, loans, payments }) {
  if (isPartner) {
    const totalContributed = Number(partnerSummary?.summary?.totalContributed || 668)
    const totalDistributed = Number(partnerSummary?.summary?.totalDistributed || 4465)

    return {
      totalAmount: totalContributed,
      paidAmount: totalDistributed,
      pendingAmount: Math.max(0, totalContributed - totalDistributed),
    }
  }

  if (isAdmin && dashboardSummary) {
    return {
      totalAmount: Number(dashboardSummary.totalPortfolioAmount || 668),
      paidAmount: Number(dashboardSummary.totalRecoveredAmount || 4465),
      pendingAmount: Number(dashboardSummary.totalOutstandingAmount || 2465),
    }
  }

  const totalLoanAmount = sumMoney(loans, 'amount') || 668
  const totalPaymentAmount = sumMoney(payments, 'amount') || 4465

  return {
    totalAmount: totalLoanAmount,
    paidAmount: totalPaymentAmount,
    pendingAmount: Math.max(0, totalLoanAmount - totalPaymentAmount) || 2465,
  }
}

function SummaryCard({ label, value, delta, tone }) {
  return (
    <Card className="dashboard-page__metric-card">
      <span className="dashboard-page__metric-label">{label}</span>
      <strong className="dashboard-page__metric-value">{value}</strong>
      <Badge variant={tone}>{delta}</Badge>
    </Card>
  )
}

function DashboardWorkspace({ user }) {
  const { t } = useTranslation()
  const [profitFilter, setProfitFilter] = useState('week')

  const isPartner = user.role === 'socio'
  const associateProfitabilityQuery = useAssociateProfitabilityQuery(null, { enabled: isPartner })
  const loansQuery = useLoansOverviewQuery({ user, enabled: !isPartner })
  const paymentsQuery = usePaymentsOverviewQuery({ enabled: user.role === 'admin' })
  const dashboardSummaryQuery = useDashboardSummaryQuery({ enabled: user.role === 'admin' })

  const partnerSummary = associateProfitabilityQuery.data?.data?.report || null
  const queriedLoans = useMemo(() => getOverviewItems(loansQuery.data, 'loans', 'loans'), [loansQuery.data])
  const queriedPayments = useMemo(() => getOverviewItems(paymentsQuery.data, 'payments', 'payments'), [paymentsQuery.data])

  const summary = useMemo(() => buildDashboardSummary({
    isPartner,
    partnerSummary,
    isAdmin: user.role === 'admin',
    dashboardSummary: dashboardSummaryQuery.data?.data?.summary,
    loans: queriedLoans,
    payments: queriedPayments,
  }), [dashboardSummaryQuery.data?.data?.summary, isPartner, partnerSummary, queriedLoans, queriedPayments, user.role])

  const isLoading = isPartner
    ? associateProfitabilityQuery.isLoading
    : loansQuery.isLoading || (user.role === 'admin' && dashboardSummaryQuery.isLoading)

  const error = isPartner
    ? associateProfitabilityQuery.error
    : dashboardSummaryQuery.error || loansQuery.error || paymentsQuery.error

  const summaryCards = useMemo(
    () => [
      { label: t('dashboard.metrics.portfolio'), value: formatCurrency(summary.totalAmount), delta: t('dashboard.metrics.portfolioDelta'), tone: 'brand' },
      { label: t('dashboard.metrics.recovered'), value: formatCurrency(summary.paidAmount), delta: t('dashboard.metrics.recoveredDelta'), tone: 'success' },
      { label: t('dashboard.metrics.outstanding'), value: formatCurrency(summary.pendingAmount), delta: t('dashboard.metrics.outstandingDelta'), tone: 'warning' },
    ],
    [summary.paidAmount, summary.pendingAmount, summary.totalAmount, t],
  )

  const chartData = useMemo(() => MONTH_KEYS.map((month, index) => ({
    name: t(`dashboard.months.${month}`),
    value: Number(((summary.totalAmount || 0) * ((MONTH_HEIGHTS[index] || 20) / 100)).toFixed(2)),
  })), [summary.totalAmount, t])

  const statusData = useMemo(() => [
    { name: t('dashboard.metrics.recovered'), value: Math.max(summary.paidAmount, 1) },
    { name: t('dashboard.metrics.outstanding'), value: Math.max(summary.pendingAmount, 1) },
    { name: t('dashboard.metrics.portfolio'), value: Math.max(summary.totalAmount - summary.paidAmount - summary.pendingAmount, 1) },
  ], [summary.paidAmount, summary.pendingAmount, summary.totalAmount, t])

  if (isLoading) {
    return (
      <StatePanel
        icon="⏳"
        title={t('dashboard.loading.title')}
        message={t('dashboard.loading.message')}
        loadingState
      />
    )
  }

  if (error) {
    return (
      <StatePanel
        icon="⚠️"
        title={t('dashboard.errorTitle')}
        message={t('dashboard.errorMessage')}
      />
    )
  }

  return (
    <div className="dashboard-content dashboard-page">
      <section className="dashboard-page__hero">
        <div>
          <span className="section-eyebrow">{t('dashboard.eyebrow')}</span>
          <h1 className="page-title">{t('dashboard.title')}</h1>
          <p className="page-subtitle">{t('dashboard.subtitle')}</p>
        </div>
        <div className="dashboard-page__metric-row">
          {summaryCards.map((card) => (
            <SummaryCard key={card.label} {...card} />
          ))}
        </div>
      </section>

      <WorkspaceGrid layouts={DASHBOARD_LAYOUTS} rowHeight={84}>
        <div key="heroCards">
        <Card className="dash-card dash-my-cards">
          <div className="dash-title-row">
            <div>
              <h3 className="dash-title dash-title--large">{t('dashboard.cards.title')}</h3>
              <button type="button" className="dash-inline-action">
                {t('dashboard.cards.addNew')}
                <PlusCircle size={14} />
              </button>
            </div>
            <span className="dash-action">{t('dashboard.cards.prompt')}</span>
          </div>

          <div className="cc-widget-container">
            <div className="cc-visual" aria-hidden="true">
              <div className="cc-bg-pattern" />
              <div className="cc-details">
                <div className="dashboard-page__card-topline">
                  <span className="dashboard-page__chip-label">
                    <CreditCard size={16} />
                    {t('dashboard.cards.brand')}
                  </span>
                  <span className="dashboard-page__visa">VISA</span>
                </div>
                <div className="cc-number">1234 5678 9101 1121</div>
                <div className="cc-footer">
                  <span>Jack Lewis</span>
                  <span>06/25</span>
                </div>
              </div>
            </div>

            <div className="cc-balance-area">
              <div className="cc-balance-label">{t('dashboard.cards.balance')}</div>
              <div className="cc-balance-amount">{formatCurrency(summary.totalAmount)}</div>
              <button type="button" className="dash-action dash-action--accent">
                {t('dashboard.cards.viewDetails')}
                <ArrowRightCircle size={16} />
              </button>
            </div>

            <div className="cc-quick-actions">
              {QUICK_ACTIONS.map((action) => (
                <button key={action.key} type="button" className="quick-btn">
                  <span className="quick-icon">
                    <action.icon size={18} />
                  </span>
                  <span className="quick-label">{t(`dashboard.quickActions.${action.key}`)}</span>
                </button>
              ))}
            </div>
          </div>
        </Card>
        </div>

        <div key="profit">
        <Card className="dash-card dash-profit">
          <div className="dash-title-row">
            <h3 className="dash-title">{t('dashboard.profit.title')}</h3>
            <button type="button" className="dash-action">
              {t('dashboard.profit.showAll')}
              <ArrowUpRight size={14} />
            </button>
          </div>

          <div className="dashboard-page__centered-row">
            <div className="chart-filters">
              {PROFIT_FILTERS.map((filter) => (
                <button
                  key={filter}
                  type="button"
                  className={`filter-pill ${profitFilter === filter ? 'active' : ''}`}
                  onClick={() => setProfitFilter(filter)}
                >
                  {t(`dashboard.profit.filters.${filter}`)}
                </button>
              ))}
            </div>
          </div>

          <div className="svg-chart-container">
             <WorkspaceChart data={chartData} series={PROFIT_CHART_SERIES} />
             <div className="dashboard-page__chart-axis">
              {CHART_AXIS_LABELS.map((label) => (
                <span key={label}>{label}</span>
              ))}
            </div>
          </div>
        </Card>
        </div>

        <div key="income">
        <Card className="dash-card dash-income">
          <div className="mini-stat-header">
            <div className="dashboard-page__icon-title">
              <div className="mini-icon">
                <ArrowDownLeft size={16} />
              </div>
              <span className="dashboard-page__stat-heading">{t('dashboard.income.title')}</span>
            </div>
            <MoreHorizontal size={18} color="var(--text-muted)" />
          </div>
          <svg viewBox="0 0 200 60" className="dashboard-page__mini-chart" aria-hidden="true">
            <defs>
              <linearGradient id="incGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#34c38f" stopOpacity="0.2" />
                <stop offset="100%" stopColor="#34c38f" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d="M0,30 Q30,10 60,35 T140,20 T200,5" fill="none" stroke="#34c38f" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M0,30 Q30,10 60,35 T140,20 T200,5 L200,60 L0,60 Z" fill="url(#incGrad)" />
          </svg>
          <div className="dashboard-page__stat-footer">
            <span className="mini-value">+{formatCurrency(summary.paidAmount)}</span>
            <Badge variant="success">{t('dashboard.income.delta')}</Badge>
          </div>
        </Card>
        </div>

        <div key="expenses">
        <Card className="dash-card dash-expenses">
          <div className="mini-stat-header">
            <div className="dashboard-page__icon-title">
              <div className="mini-icon mini-icon--muted">
                <ArrowUpRight size={16} />
              </div>
              <span className="dashboard-page__stat-heading">{t('dashboard.expenses.title')}</span>
            </div>
            <MoreHorizontal size={18} color="var(--text-muted)" />
          </div>
          <svg viewBox="0 0 200 60" className="dashboard-page__mini-chart" aria-hidden="true">
            <defs>
              <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#457B66" stopOpacity="0.1" />
                <stop offset="100%" stopColor="#457B66" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d="M0,20 Q40,5 80,45 T160,30 T200,35" fill="none" stroke="#457B66" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M0,20 Q40,5 80,45 T160,30 T200,35 L200,60 L0,60 Z" fill="url(#expGrad)" />
          </svg>
          <div className="dashboard-page__stat-footer">
            <span className="mini-value">-{formatCurrency(summary.pendingAmount)}</span>
            <Badge variant="warning">{t('dashboard.expenses.delta')}</Badge>
          </div>
        </Card>
        </div>

        <div key="spendings">
        <Card className="dash-card dash-spendings">
          <div className="dash-title-row">
            <div className="dashboard-page__icon-title">
              <div className="mini-icon mini-icon--small">
                <Wallet size={12} />
              </div>
              <h3 className="dash-title">{t('dashboard.spendings.title')}</h3>
            </div>
            <button type="button" className="dash-action">
              {t('dashboard.spendings.period')}
            </button>
          </div>
          <WorkspaceChart type="bar" data={chartData} series={SPENDINGS_CHART_SERIES} height={220} />
        </Card>
        </div>

        <div key="planning">
        <Card className="dash-card dash-planning">
          <div className="dash-title-row">
            <h3 className="dash-title">{t('dashboard.planning.title')}</h3>
            <button type="button" className="dash-inline-action">
              {t('dashboard.planning.addNew')}
              <PlusCircle size={14} />
            </button>
          </div>

          {PLANNING_ITEMS.map((item) => (
            <div className="plan-item" key={item.key}>
              <div className="plan-item-header">
                <span>{t(`dashboard.planning.items.${item.key}.name`)}</span>
                <div>
                  <span className="plan-val-current">{item.current} / </span>
                  <span className="plan-val-target">{item.target}</span>
                </div>
              </div>
              <div className="plan-progress-bg">
                <div className="plan-progress-fill" style={{ '--plan-progress-width': item.progress }} />
              </div>
            </div>
          ))}
        </Card>
        </div>

        <div key="transactions">
        <Card className="dash-card dash-transactions">
          <div className="dash-title-row dash-title-row--bordered">
            <h3 className="dash-title">{t('dashboard.transactions.title')}</h3>
            <button type="button" className="dash-action">
              {t('dashboard.transactions.viewAll')}
            </button>
          </div>

          <div className="dashboard-page__transaction-list">
            {TRANSACTIONS.map((transaction) => (
              <div className="tx-item" key={transaction.key}>
                <div className="tx-left">
                  <span className="tx-time">
                    {transaction.date}
                    <br />
                    {transaction.time}
                  </span>
                  <div className={`tx-avatar ${TRANSACTION_BRANDS[transaction.key] || ''}`} />
                  <div className="tx-details">
                    <span className="tx-name">{t(`dashboard.transactions.items.${transaction.key}.name`)}</span>
                    <span className="tx-cat">{t(`dashboard.transactions.items.${transaction.key}.category`)}</span>
                  </div>
                </div>
                <div className="tx-amount-col">
                  <span className="tx-amount">{transaction.amount}</span>
                  <span className="tx-status">{t(`dashboard.transactions.status.${transaction.status}`)}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
        </div>

        <div key="premium">
        <Card className="dash-card dash-premium premium-card">
          <div>
            <div className="dash-title-row">
              <h3 className="dash-title">{t('dashboard.premium.title')}</h3>
              <span className="dashboard-page__premium-chip" aria-hidden="true" />
            </div>
            <p className="premium-text">{t('dashboard.premium.description')}</p>
          </div>

          <div className="dashboard-page__premium-illustration" aria-hidden="true">
            <WorkspaceChart type="pie" data={statusData} xKey="name" series={PREMIUM_CHART_SERIES} height={180} innerRadius={34} outerRadius={64} />
          </div>
        </Card>
        </div>
      </WorkspaceGrid>
    </div>
  )
}

export default DashboardWorkspace
