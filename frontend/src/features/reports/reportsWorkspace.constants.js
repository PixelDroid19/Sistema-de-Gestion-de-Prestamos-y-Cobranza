export const REPORT_TABS = [
  { id: 'overview', label: 'reports.portfolio.tabs.overview.label', icon: '📊', description: 'reports.portfolio.tabs.overview.description' },
  { id: 'recovered', label: 'reports.portfolio.tabs.recovered.label', icon: '✅', description: 'reports.portfolio.tabs.recovered.description' },
  { id: 'outstanding', label: 'reports.portfolio.tabs.outstanding.label', icon: '⏳', description: 'reports.portfolio.tabs.outstanding.description' },
  { id: 'users', label: 'reports.portfolio.tabs.users.label', icon: '👥', description: 'reports.portfolio.tabs.users.description', adminOnly: true },
];

export const emptyAssociateForm = {
  name: '',
  email: '',
  phone: '',
  status: 'active',
  participationPercentage: '',
};

export const emptyMoneyForm = {
  amount: '',
  notes: '',
  contributionDate: '',
  distributionDate: '',
};

export const emptyProportionalForm = {
  amount: '',
  distributionDate: '',
  notes: '',
  idempotencyKey: '',
};

export const RECOVERY_TONE_MAP = {
  pending: 'warning',
  in_progress: 'info',
  recovered: 'success',
};
