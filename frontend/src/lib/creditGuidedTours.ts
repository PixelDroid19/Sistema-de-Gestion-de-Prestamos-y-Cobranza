import { startViewGuide } from './guidedTours';

export const startCreditsTour = () => startViewGuide('credits');

export const startNewCreditTour = () => startViewGuide('new-credit');

export const startCreditDetailsTour = (context?: { loanId?: number | string }) => (
  startViewGuide('credit-details', { loanId: context?.loanId })
);
