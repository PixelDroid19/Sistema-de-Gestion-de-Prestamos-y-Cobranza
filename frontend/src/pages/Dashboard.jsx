import React, { useMemo, useState } from "react";
import {
  PlusCircle, ArrowUpRight, ArrowDownLeft, SendToBack,
  MoreHorizontal, ArrowRight, CreditCard, Wallet, MoveUpRight, ArrowRightCircle
} from "lucide-react";
import { useDashboardSummaryQuery, useLoansOverviewQuery, usePaymentsOverviewQuery } from '../hooks/useDashboard';
import { useAssociateProfitabilityQuery } from '../hooks/useReports';
import "./Dashboard.css";

const Dashboard = ({ user }) => {
  const isSocio = user.role === 'socio';
  const associateProfitabilityQuery = useAssociateProfitabilityQuery(null, { enabled: isSocio });
  const loansQuery = useLoansOverviewQuery({ user, enabled: !isSocio });
  const paymentsQuery = usePaymentsOverviewQuery({ enabled: user.role === 'admin' });
  const dashboardSummaryQuery = useDashboardSummaryQuery({ enabled: user.role === 'admin' });

  const partnerSummary = associateProfitabilityQuery.data?.data?.report || null;
  const queriedLoans = Array.isArray(loansQuery.data?.data?.loans) ? loansQuery.data.data.loans : Array.isArray(loansQuery.data?.data) ? loansQuery.data.data : [];
  const queriedPayments = Array.isArray(paymentsQuery.data?.data) ? paymentsQuery.data.data : Array.isArray(paymentsQuery.data?.data?.payments) ? paymentsQuery.data.data.payments : [];

  const summary = isSocio
    ? {
      totalAmount: Number(partnerSummary?.summary?.totalContributed || 668.00),
      paidAmount: Number(partnerSummary?.summary?.totalDistributed || 4465.00),
      pendingAmount: Math.max(0, Number(partnerSummary?.summary?.totalContributed || 2465.00) - Number(partnerSummary?.summary?.totalDistributed || 0)),
    }
    : user.role === 'admin' && dashboardSummaryQuery.data?.data?.summary
      ? {
        totalAmount: Number(dashboardSummaryQuery.data.data.summary.totalPortfolioAmount || 668.00),
        paidAmount: Number(dashboardSummaryQuery.data.data.summary.totalRecoveredAmount || 4465.00),
        pendingAmount: Number(dashboardSummaryQuery.data.data.summary.totalOutstandingAmount || 2465.00),
      }
      : {
        totalAmount: queriedLoans.reduce((sum, loan) => sum + Number(loan.amount || 0), 0) || 668.00,
        paidAmount: queriedPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0) || 4465.00,
        pendingAmount: Math.max(0, queriedLoans.reduce((sum, loan) => sum + Number(loan.amount || 0), 0) - queriedPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0)) || 2465.00,
      };

  const [profitFilter, setProfitFilter] = useState('Week');

  const formatCurrency = (amt) => {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amt || 0);
  };

  return (
    <div className="dashboard-content">
      <div className="dash-grid">

        {/* === 1. MY CARDS WIDGET === */}
        <div className="dash-card dash-my-cards">
          <div className="dash-title-row">
            <div className="flex items-center gap-2">
              <h3 className="dash-title" style={{ fontSize: '1.4rem' }}>My cards</h3>
              <span className="dash-action text-muted" style={{ fontSize: '0.8rem' }}>Add new <PlusCircle size={14} color="#34c38f" /></span>
            </div>
            <span className="dash-action" style={{ fontSize: '0.8.5rem', fontWeight: 600 }}>What would you like to do</span>
          </div>

          <div className="cc-widget-container">
            {/* Credit Card Graphic */}
            <div className="cc-visual">
              <div className="cc-bg-pattern"></div>
              <div className="cc-details">
                <div className="flex justify-between items-center">
                  <span style={{ opacity: 0.8, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
                    Credit Card
                  </span>
                  <span style={{ fontWeight: 800, fontStyle: 'italic', fontSize: '1.2rem', opacity: 0.9 }}>VISA</span>
                </div>
                <div className="cc-number">1234 5678 9101 1121</div>
                <div className="cc-footer">
                  <span>Jack Lewis</span>
                  <span>06/25</span>
                </div>
              </div>
            </div>

            {/* Balance & Actions */}
            <div className="cc-balance-area">
              <div className="cc-balance-label">Card balance</div>
              <div className="cc-balance-amount">{formatCurrency(summary.totalAmount)}</div>
              <div className="dash-action" style={{ margin: '0.5rem 0', color: '#457B66' }}>
                View details <ArrowRightCircle size={16} />
              </div>
            </div>

            <div className="cc-quick-actions">
              <div className="quick-btn">
                <div className="quick-icon"><ArrowUpRight size={18} /></div>
                <span className="quick-label">Send</span>
              </div>
              <div className="quick-btn">
                <div className="quick-icon"><ArrowDownLeft size={18} /></div>
                <span className="quick-label">Receive</span>
              </div>
              <div className="quick-btn">
                <div className="quick-icon"><SendToBack size={18} /></div>
                <span className="quick-label">Withdraw</span>
              </div>
            </div>
          </div>
        </div>

        {/* === 2. PROFIT WIDGET === */}
        <div className="dash-card dash-profit" style={{ paddingBottom: '0.5rem' }}>
          <div className="dash-title-row">
            <h3 className="dash-title">Profit</h3>
            <div className="flex items-center gap-4">
              <span className="dash-action" style={{ fontSize: '0.8rem' }}>Show all <ArrowUpRight size={14} color="#34c38f" /></span>
            </div>
          </div>
          <div className="flex justify-center">
            <div className="chart-filters" style={{ background: '#F8FAFC', padding: '4px', borderRadius: '16px' }}>
              {['Week', 'Month', 'Year'].map(f => (
                <span key={f} className={`filter-pill ${profitFilter === f ? 'active' : ''}`} onClick={() => setProfitFilter(f)}>
                  {f}
                </span>
              ))}
            </div>
          </div>
          <div className="svg-chart-container">
            <svg viewBox="0 0 400 120" style={{ width: '100%', height: '100px', display: 'block' }}>
              <defs>
                <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#457B66" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="#457B66" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d="M0,80 Q50,70 100,85 T200,60 T300,70 T400,20 L400,120 L0,120 Z" fill="url(#profitGrad)" />
              <path d="M0,80 Q50,70 100,85 T200,60 T300,70 T400,20" fill="none" stroke="#457B66" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
            <div className="flex justify-between mt-2" style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
               <span>16</span><span>17</span><span>18</span><span>19</span><span>20</span><span>21</span><span>22</span>
            </div>
        </div>
      </div>

      {/* === 3. INCOME WIDGET === */}
      <div className="dash-card dash-income">
        <div className="mini-stat-header">
          <div className="flex items-center gap-2">
            <div className="mini-icon"><ArrowDownLeft size={16} /></div>
            <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Income</span>
          </div>
          <MoreHorizontal size={18} color="var(--text-muted)" />
        </div>
        <svg viewBox="0 0 200 60" style={{ width: '100%', height: '60px', marginTop: '1rem', marginBottom: '1rem' }}>
          <defs>
            <linearGradient id="incGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#34c38f" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#34c38f" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d="M0,30 Q30,10 60,35 T140,20 T200,5" fill="none" stroke="#34c38f" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M0,30 Q30,10 60,35 T140,20 T200,5 L200,60 L0,60 Z" fill="url(#incGrad)" />
        </svg>
        <div className="flex items-center gap-2">
          <span className="mini-value" style={{ fontSize: '1.4rem' }}>+{formatCurrency(summary.paidAmount)}</span>
          <span className="badge badge-up">+12% <ArrowUpRight size={10} /></span>
        </div>
      </div>

      {/* === 4. EXPENSES WIDGET === */}
      <div className="dash-card dash-expenses">
        <div className="mini-stat-header">
          <div className="flex items-center gap-2">
            <div className="mini-icon" style={{ background: '#E2E8F0', color: '#457B66' }}><ArrowUpRight size={16} /></div>
            <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Expenses</span>
          </div>
          <MoreHorizontal size={18} color="var(--text-muted)" />
        </div>
        <svg viewBox="0 0 200 60" style={{ width: '100%', height: '60px', marginTop: '1rem', marginBottom: '1rem' }}>
          <defs>
            <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#457B66" stopOpacity="0.1" />
              <stop offset="100%" stopColor="#457B66" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d="M0,20 Q40,5 80,45 T160,30 T200,35" fill="none" stroke="#457B66" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M0,20 Q40,5 80,45 T160,30 T200,35 L200,60 L0,60 Z" fill="url(#expGrad)" />
        </svg>
        <div className="flex items-center gap-2">
          <span className="mini-value" style={{ fontSize: '1.4rem' }}>-{formatCurrency(summary.pendingAmount)}</span>
          <span className="badge badge-down">-23% <ArrowUpRight size={10} style={{ transform: 'rotate(90deg)' }} /></span>
        </div>
      </div>

      {/* === 5. SPENDINGS STATISTIC WIDGET === */}
      <div className="dash-card dash-spendings">
        <div className="dash-title-row">
          <div className="flex items-center gap-2">
            <div className="mini-icon" style={{ width: 24, height: 24 }}><CreditCard size={12} /></div>
            <h3 className="dash-title" style={{ fontSize: '1rem' }}>Spendings statistic</h3>
          </div>
          <span className="dash-action" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Year
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
          </span>
        </div>
        <div className="bar-chart">
          {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'June', 'July', 'Aug', 'Sep', 'Oct', 'Nov'].map((m, i) => {
            // Pseudo-random heights for the yellow fill based on index
            const heights = [30, 0, 50, 70, 0, 30, 40, 30, 40, 50, 60, 0];
            return (
              <div className="bar-col" key={m}>
                <div className="bar-bg">
                  <div className="bar-fill" style={{ height: `${heights[i]}%` }}></div>
                </div>
                <span className="bar-label">{m}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* === 6. PLANNING WIDGET === */}
      <div className="dash-card dash-planning">
        <div className="dash-title-row">
          <h3 className="dash-title" style={{ fontSize: '1rem' }}>Planning</h3>
          <span className="dash-action text-muted" style={{ fontSize: '0.75rem' }}>Add new <PlusCircle size={14} color="#34c38f" /></span>
        </div>

        <div className="plan-item">
          <div className="plan-item-header">
            <span>House in Paris</span>
            <div>
              <span className="plan-val-current">$265 / </span>
              <span className="plan-val-target">$10,000</span>
            </div>
          </div>
          <div className="plan-progress-bg">
            <div className="plan-progress-fill" style={{ width: '20%' }}></div>
          </div>
        </div>

        <div className="plan-item">
          <div className="plan-item-header">
            <span>Trip to Brazil</span>
            <div>
              <span className="plan-val-current">$10,465 / </span>
              <span className="plan-val-target">$14,000</span>
            </div>
          </div>
          <div className="plan-progress-bg">
            <div className="plan-progress-fill" style={{ width: '75%' }}></div>
          </div>
        </div>
      </div>

      {/* === 7. LATEST TRANSACTIONS WIDGET === */}
      <div className="dash-card dash-transactions">
        <div className="dash-title-row border-b pb-4 mb-4" style={{ borderBottom: '1px solid var(--border-color)', margin: 0 }}>
          <h3 className="dash-title" style={{ fontSize: '1rem' }}>Latest transactions</h3>
          <span className="dash-action text-muted"><ArrowUpRight size={14} color="var(--text-primary)" style={{ transform: 'rotate(45deg)' }} /></span>
        </div>

        <div style={{ marginTop: '1.5rem' }}>
          <div className="tx-item">
            <div className="tx-left">
              <span className="tx-time">September 30, 2022<br />4:38 PM</span>
              <div className="tx-avatar" style={{ color: '#E11D48' }}><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10" /><path fill="#fff" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20ZM8 14h8v2H8zm0-4h8v2H8z" /></svg></div>
              <div className="tx-details">
                <span className="tx-name">Dribble</span>
                <span className="tx-cat">Pro upgrade</span>
              </div>
            </div>
            <div className="tx-amount-col">
              <span className="tx-amount">-$5.78</span>
              <span className="tx-status">Pending</span>
            </div>
          </div>

          <div className="tx-item">
            <div className="tx-left">
              <span className="tx-time">October 2, 2022<br />03:34 AM</span>
              <div className="tx-avatar" style={{ color: '#DC2626' }}><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M21.58 6.5A2.78 2.78 0 0 0 19.62 4.6C17.9 4.14 12 4.14 12 4.14s-5.9 0-7.62.46A2.78 2.78 0 0 0 2.42 6.5C2 8.16 2 11.59 2 11.59s0 3.44.42 5.09a2.78 2.78 0 0 0 1.96 1.9C6.1 19.04 12 19.04 12 19.04s5.9 0 7.62-.46a2.78 2.78 0 0 0 1.96-1.9c.42-1.65.42-5.09.42-5.09s0-3.44-.42-5.09ZM10 14.59V8.6l5.5 3-5.5 2.99Z" /></svg></div>
              <div className="tx-details">
                <span className="tx-name">Youtube</span>
                <span className="tx-cat">Subscription</span>
              </div>
            </div>
            <div className="tx-amount-col">
              <span className="tx-amount">-$1055.78</span>
              <span className="tx-status">Completed</span>
            </div>
          </div>

          <div className="tx-item">
            <div className="tx-left">
              <span className="tx-time">October 13, 2022<br />02:04 PM</span>
              <div className="tx-avatar" style={{ color: '#1F2937' }}><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 20.6c-4.8 0-8.6-3.9-8.6-8.6 0-4.8 3.9-8.6 8.6-8.6 4.8 0 8.6 3.9 8.6 8.6 0 4.8-3.9 8.6-8.6 8.6zm4.5-9.4c0-2.4-1.9-4.4-4.4-4.4S7.6 8.8 7.6 11.2s1.9 4.4 4.4 4.4 4.5-1.9 4.5-4.4zm-2.8.9h-1.3v2c0 .2-.2.4-.4.4-.2 0-.4-.2-.4-.4v-2H10.3c-.2 0-.4-.2-.4-.4 0-.2.2-.4.4-.4h1.3V9.8c0-.2.2-.4.4-.4.2 0 .4.2.4.4V11h1.3c.2 0 .4.2.4.4 0 .2-.2.4-.4.4z" /></svg></div>
              <div className="tx-details">
                <span className="tx-name">Apple</span>
                <span className="tx-cat">Games</span>
              </div>
            </div>
            <div className="tx-amount-col">
              <span className="tx-amount">-$345.78</span>
              <span className="tx-status">Completed</span>
            </div>
          </div>
        </div>
      </div>

      {/* === 8. GO PREMIUM WIDGET === */}
      <div className="dash-card dash-premium premium-card">
        <div>
          <div className="dash-title-row">
            <h3 className="dash-title" style={{ fontSize: '1rem' }}>Go premium</h3>
            <span className="dash-action text-muted">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" fill="#E2E8F0" /><circle cx="12" cy="12" r="5" fill="#457B66" /><path d="M16 8l-8 8" stroke="#ffffff" strokeWidth="2" /></svg>
            </span>
          </div>
          <p className="premium-text">
            Explore all banking functions with Lifetime membership
          </p>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1rem' }}>
          {/* Simulating the little illustration in the image */}
          <svg width="100" height="70" viewBox="0 0 100 70" fill="none" style={{ overflow: 'visible' }}>
            {/* Card */}
            <rect x="20" y="20" width="60" height="40" rx="4" fill="#ffffff" stroke="#1F2937" strokeWidth="2" strokeLinejoin="round" />
            <rect x="25" y="25" width="50" height="30" rx="2" fill="#FEE2E2" />
            <path d="M40 40 L45 45 L55 35" stroke="#1F2937" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="20" cy="15" r="3" fill="#FCA5A5" />
            <circle cx="85" cy="55" r="4" fill="#FCA5A5" />
            <path d="M15 45 Q10 40 10 30 Q10 20 20 20" fill="none" stroke="#1F2937" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M85 45 Q90 40 90 30 Q90 20 80 20" fill="none" stroke="#1F2937" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
      </div>

    </div>
    </div >
  );
};

export default Dashboard;
