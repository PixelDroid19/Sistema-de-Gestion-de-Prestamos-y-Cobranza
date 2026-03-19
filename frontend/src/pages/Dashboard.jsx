
import React, { useEffect, useMemo, useState } from "react";
import { Printer, Download, CreditCard, Users, Briefcase } from "lucide-react";
import { api, handleApiError } from "../utils/api";
import "./Dashboard.css"; 

const Dashboard = ({ user }) => {
  const [loans, setLoans] = useState([]);
  const [payments, setPayments] = useState([]);
  const [summary, setSummary] = useState({
    totalAmount: 0,
    paidAmount: 0,
    pendingAmount: 0
  });
  const [partnerSummary, setPartnerSummary] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (user.role === "socio") {
          const profitabilityRes = await api.getAssociateProfitability();
          const report = profitabilityRes?.data?.report || null;
          setPartnerSummary(report);
          const loansData = Array.isArray(report?.data?.loans) ? report.data.loans : [];
          setLoans(loansData.slice(0, 5));
          setPayments([]);
          setSummary({
            totalAmount: Number(report?.summary?.totalContributed || 0),
            paidAmount: Number(report?.summary?.totalDistributed || 0),
            pendingAmount: Math.max(0, Number(report?.summary?.totalContributed || 0) - Number(report?.summary?.totalDistributed || 0)),
          });
          return;
        }

        const loansRes = user.role === 'customer'
          ? await api.getLoansByCustomer(user.id)
          : user.role === 'agent'
            ? await api.getLoansByAgent(user.id)
            : await api.getLoans();

        const paymentsRes = user.role === 'admin'
          ? await api.getPayments()
          : null;
        
        const loansData = Array.isArray(loansRes?.data?.loans)
          ? loansRes.data.loans
          : Array.isArray(loansRes?.data)
            ? loansRes.data
            : [];
        let paymentsData = Array.isArray(paymentsRes?.data)
          ? paymentsRes.data
          : Array.isArray(paymentsRes?.data?.payments)
            ? paymentsRes.data.payments
            : [];
        
        let filteredLoans = loansData;
        let filteredPayments = paymentsData;
        
        // Filter based on role
        if (user.role === "customer") {
          filteredLoans = loansData.filter(l => l.customerId === user.id);
        } else if (user.role === "agent") {
          filteredLoans = loansData.filter(l => l.agentId === user.id);
        }

        if (user.role !== 'admin') {
          const paymentsByLoan = await Promise.all(
            filteredLoans.map(async (loan) => {
              try {
                const response = await api.getPaymentsByLoan(loan.id);
                return Array.isArray(response?.data) ? response.data : [];
              } catch (error) {
                return [];
              }
            }),
          );
          paymentsData = paymentsByLoan.flat();
          filteredPayments = paymentsData;
        } else {
          filteredPayments = paymentsData;
        }

        setLoans(filteredLoans.slice(0, 5)); // Keep only recent 5
        setPayments(filteredPayments.slice(0, 5));
        
        // Calculate summary
        const total = filteredLoans.reduce((sum, l) => sum + (l.amount || 0), 0);
        const paid = filteredPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
        setSummary({
          totalAmount: total,
          paidAmount: paid,
          pendingAmount: total - paid
        });
        
      } catch (err) {
        console.error("Dashboard error", err);
      }
    };
    fetchData();
  }, [user]);

  const heroCopy = useMemo(() => {
    if (user.role === 'socio') {
      return {
        title: 'Welcome to the partner portal',
        subtitle: 'Review your linked contributions, distributions, and loan exposure from one workspace.',
        action: 'Open Partner Portal',
      };
    }

    return {
      title: 'Welcome to LendFlow',
      subtitle: 'Your centralized loan recovery and management system',
      action: 'View Reports',
    };
  }, [user.role]);

  // Format currency
  const formatCurrency = (amt) => {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amt || 0);
  };

  // Format date
  const formatDate = (dateStr) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  };

  return (
    <div className="dashboard-content">
      <div className="dashboard-header flex items-center justify-between">
        <h2>Dashboard</h2>
        <button className="btn-print flex items-center gap-2">
          <Printer size={16} /> Print
        </button>
      </div>

      <div className="dashboard-grid">
        <div className="main-column">
          {/* Hero Banner */}
          <div className="hero-banner lendflow-banner">
            <div className="hero-content">
              <h1>{heroCopy.title}</h1>
              <p>{heroCopy.subtitle}</p>
              <button className="btn-learn-more">{heroCopy.action}</button>
            </div>
            <div className="hero-illustration">
              <img src="https://api.dicebear.com/7.x/open-peeps/svg?seed=Jocelyn&backgroundColor=transparent" alt="Illustration" />
            </div>
          </div>

          {/* Cards Grid */}
          <div className="cards-grid">
            <div className="card">
              <h3 className="card-title">User Profile</h3>
              <div className="profile-details flex items-center gap-6">
                <img src={`https://api.dicebear.com/7.x/notionists/svg?seed=${user.name}`} alt="Profile avatar" className="profile-avatar" />
                <div className="profile-info-grid">
                  <div className="info-group">
                    <span className="info-label">Name</span>
                    <span className="info-value">{user.name}</span>
                  </div>
                  <div className="info-group">
                    <span className="info-label">Role</span>
                    <span className="info-value" style={{ textTransform: "capitalize" }}>{user.role}</span>
                  </div>
                  <div className="info-group">
                    <span className="info-label">Email</span>
                    <span className="info-value">{user.email}</span>
                  </div>
                </div>
              </div>
              <div className="profile-address mt-4 border-t pt-4">
                <span className="info-label">Platform Access</span>
                <span className="info-value">LendFlow Secured Network<br/>Active Session</span>
              </div>
            </div>

            <div className="card">
              <h3 className="card-title">{user.role === 'socio' ? 'Linked Loans' : 'Recent Loans'}</h3>
              <div className="beneficiary-list">
                {loans.length === 0 ? (
                  <p className="text-muted text-sm mt-4">{user.role === 'socio' ? 'No linked loans found.' : 'No recent loans found.'}</p>
                ) : (
                  loans.slice(0,2).map((loan) => (
                    <div className="beneficiary-item mt-2" key={loan.id}>
                      <div className="icon-box"><Briefcase size={20} /></div>
                      <div className="ben-details">
                        <div className="ben-row"><span className="info-label">Amount</span> <span>{formatCurrency(loan.amount)}</span></div>
                        <div className="ben-row"><span className="info-label">Status</span> <span className={`status-badge ${loan.status}`}>{loan.status}</span></div>
                        <div className="ben-row"><span className="info-label">Term</span> <span>{loan.termMonths} Months</span></div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Tables Grid */}
          <div className="tables-grid">
            <div className="card table-card-full" style={{ gridColumn: "1 / -1" }}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="card-title">{user.role === 'socio' ? 'Partner Snapshot' : 'Recent Payments'}</h3>
                <span className="text-link cursor-pointer">See All</span>
              </div>
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th># ID</th>
                      <th>Date</th>
                      <th>Loan ID</th>
                      <th>Status</th>
                      <th className="text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {user.role === 'socio' ? (
                      <>
                        <tr>
                          <td>#-</td>
                          <td>{new Date().toLocaleDateString()}</td>
                          <td>Associate</td>
                          <td><span className="status-text completed">distributed</span></td>
                          <td className="text-right font-semibold">{formatCurrency(partnerSummary?.summary?.totalDistributed || 0)}</td>
                        </tr>
                      </>
                    ) : payments.length === 0 ? (
                      <tr><td colSpan="5" className="text-center text-muted">No payments found.</td></tr>
                    ) : (
                      payments.map((p) => (
                        <tr key={p.id}>
                          <td>#{p.id}</td>
                          <td>{formatDate(p.paymentDate)}</td>
                          <td>Loan-{p.loanId || "N/A"}</td>
                          <td><span className={`status-text ${p.status}`}>{p.status}</span></td>
                          <td className="text-right font-semibold">{formatCurrency(p.amount)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column / Balances */}
        <div className="side-column">
          <h3 className="card-title mb-4">Portfolio Summary</h3>
          
          <div className="balance-card bg-primary text-white">
            <div className="currency-icon dark"><Briefcase size={18} /></div>
            <div className="balance-info">
              <span className="currency-name opacity-80">Total Value</span>
              <span className="currency-amount text-xl">{formatCurrency(summary.totalAmount)}</span>
            </div>
          </div>

          <div className="balance-card">
            <div className="currency-icon success"><CreditCard size={18} /></div>
            <div className="balance-info">
              <span className="currency-name text-muted">Payments Received</span>
              <span className="currency-amount text-lg">{formatCurrency(summary.paidAmount)}</span>
            </div>
          </div>

          <div className="balance-card">
            <div className="currency-icon warning"><Users size={18} /></div>
            <div className="balance-info">
              <span className="currency-name text-muted">Outstanding Balance</span>
              <span className="currency-amount text-lg">{formatCurrency(summary.pendingAmount)}</span>
            </div>
          </div>
          
          <div className="last-update text-right mt-4 text-muted" style={{fontSize: "0.75rem"}}>
            Last Sync &nbsp;&nbsp;&nbsp; {new Date().toLocaleDateString()}
          </div>
        </div>

      </div>
    </div>
  );
};

export default Dashboard;
