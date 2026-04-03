import { useMemo, useState } from 'react';

export type OperationalModalType =
  | 'delete-credit'
  | 'record-payment'
  | 'edit-payment-method'
  | 'create-promise'
  | 'create-follow-up'
  | 'download-report';

export type InstallmentContext = {
  installmentId?: number;
  installmentNumber?: number;
  amount?: number;
  status?: string;
};

export type OperationalPayload = {
  loanId?: number;
  paymentId?: number;
  reportId?: number | string;
  installment?: InstallmentContext;
  meta?: Record<string, unknown>;
};

type OperationalModalState =
  | { isOpen: false; type: null; payload: null }
  | { isOpen: true; type: OperationalModalType; payload: OperationalPayload };

const CLOSED_STATE: OperationalModalState = {
  isOpen: false,
  type: null,
  payload: null,
};

export const useOperationalModalState = () => {
  const [state, setState] = useState<OperationalModalState>(CLOSED_STATE);

  const openModal = (type: OperationalModalType, payload: OperationalPayload = {}) => {
    setState({
      isOpen: true,
      type,
      payload,
    });
  };

  const closeModal = () => setState(CLOSED_STATE);

  const helpers = useMemo(
    () => ({
      is: (type: OperationalModalType) => state.isOpen && state.type === type,
      currentType: state.type,
      payload: state.payload,
      isOpen: state.isOpen,
    }),
    [state],
  );

  return {
    state,
    openModal,
    closeModal,
    ...helpers,
  };
};
