import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CustomerDetails from '../CustomerDetails';

const navigateSpy = vi.fn();
const uploadDocumentMutateAsync = vi.fn();
const deleteDocumentMutateAsync = vi.fn();

let documentsFixture: any[] = [];
let loansFixture: any[] = [];

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateSpy,
  useParams: () => ({ id: '5' }),
}));

vi.mock('../../services/customerService', () => ({
  useCustomerById: () => ({
    data: {
      data: {
        customer: {
          id: 5,
          name: 'Cliente QA',
          status: 'active',
          email: 'cliente.qa@example.com',
          phone: '+573001112233',
          address: 'Calle QA 123',
          documentNumber: 'QA-5',
        },
      },
    },
    isLoading: false,
    isError: false,
  }),
  useCustomerDocuments: () => ({
    documents: documentsFixture,
    uploadDocument: {
      mutateAsync: uploadDocumentMutateAsync,
      isPending: false,
    },
    deleteDocument: {
      mutateAsync: deleteDocumentMutateAsync,
    },
    downloadDocumentUrl: (documentId: number) => `/api/customers/5/documents/${documentId}/download`,
  }),
}));

vi.mock('../../services/reportService', () => ({
  useCustomerReports: () => ({
    history: { data: { timeline: [] } },
    creditProfile: { data: { profile: { summary: {} } } },
  }),
}));

vi.mock('../../services/loanService', () => ({
  useLoans: () => ({
    data: {
      data: {
        loans: loansFixture,
      },
    },
  }),
}));

vi.mock('../../lib/toast', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    apiErrorSafe: vi.fn(),
  },
}));

vi.mock('../../lib/confirmModal', () => ({
  confirmDanger: vi.fn().mockResolvedValue(true),
}));

describe('CustomerDetails behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    documentsFixture = [];
    loansFixture = [];
  });

  it('uploads customer documents as internal records by default', async () => {
    uploadDocumentMutateAsync.mockResolvedValue({ success: true });

    const { container } = render(<CustomerDetails />);

    fireEvent.click(screen.getByRole('button', { name: 'Documentos' }));

    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'proof_of_address' },
    });

    const file = new File(['qa'], 'documento.png', { type: 'image/png' });
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement | null;
    expect(fileInput).not.toBeNull();
    fireEvent.change(fileInput as HTMLInputElement, {
      target: { files: [file] },
    });

    const uploadForm = container.querySelector('form');
    expect(uploadForm).not.toBeNull();
    fireEvent.submit(uploadForm as HTMLFormElement);

    await waitFor(() => {
      expect(uploadDocumentMutateAsync).toHaveBeenCalledWith({
        file,
        metadata: {
          category: 'proof_of_address',
          customerVisible: false,
        },
      });
    });
  });

  it('renders stored document category and operational visibility labels', () => {
    documentsFixture = [
      {
        id: 9,
        originalName: 'soporte.pdf',
        category: 'income_proof',
        customerVisible: false,
        createdAt: '2026-04-26T12:00:00.000Z',
      },
    ];

    render(<CustomerDetails />);

    fireEvent.click(screen.getByRole('button', { name: 'Documentos' }));

    expect(screen.getByText('Comprobante de Ingresos')).toBeInTheDocument();
    expect(screen.getByText(/Uso interno/i)).toBeInTheDocument();
    expect(screen.queryByText(/Visible para cliente/i)).not.toBeInTheDocument();
  });

  it('does not show negative outstanding balance for overpaid customer credits', () => {
    loansFixture = [
      {
        id: 3,
        customerId: 5,
        status: 'closed',
        amount: 900000,
        totalPaid: 933147,
        interestRate: 24,
        termMonths: 6,
        startDate: '2026-04-27T00:00:00.000Z',
      },
    ];

    render(<CustomerDetails />);

    fireEvent.click(screen.getByRole('button', { name: 'Créditos' }));

    expect(screen.getByText('Saldo Pendiente')).toBeInTheDocument();
    expect(screen.getByText(/\$\s*0/)).toBeInTheDocument();
    expect(screen.queryByText(/-\$/)).not.toBeInTheDocument();
  });
});
