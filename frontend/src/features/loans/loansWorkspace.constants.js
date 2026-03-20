export const LOAN_STATUS_TONE_MAP = {
  approved: 'success',
  pending: 'warning',
  rejected: 'danger',
  active: 'success',
  defaulted: 'danger',
  closed: 'info',
};

export const RECOVERY_STATUS_LABELS = {
  pending: 'loans.statusLabels.pending',
  in_progress: 'loans.statusLabels.in_progress',
  recovered: 'loans.statusLabels.recovered',
};

export const RECOVERY_STATUS_TONE_MAP = {
  pending: 'warning',
  in_progress: 'info',
  recovered: 'success',
};

export const LOAN_TERM_OPTIONS = [3, 6, 9, 12, 15, 18, 24];

export const emptyPromiseDraft = { promisedDate: '', amount: '', notes: '' };
export const emptyAttachmentDraft = { category: '', description: '', customerVisible: false, file: null };
export const emptyCustomerDocumentDraft = { category: '', description: '', customerVisible: false, file: null };
