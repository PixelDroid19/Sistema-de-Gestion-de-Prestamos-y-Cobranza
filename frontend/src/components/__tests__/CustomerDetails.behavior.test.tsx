import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CustomerDetails from '../CustomerDetails';

const navigateSpy = vi.fn();
const uploadDocumentMutateAsync = vi.fn();
const deleteDocumentMutateAsync = vi.fn();

let documentsFixture: any[] = [];
let loansFixture: any[] = [];
let historyFixture: any[] = [];

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
    history: { data: { timeline: historyFixture } },
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
    historyFixture = [];
  });

  it('uploads customer documents as internal records by default', async () => {
    uploadDocumentMutateAsync.mockResolvedValue({ success: true });

    const { container } = render(<CustomerDetails />);

    fireEvent.click(screen.getByRole('tab', { name: 'Documentos' }));

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

    fireEvent.click(screen.getByRole('tab', { name: 'Documentos' }));

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

    fireEvent.click(screen.getByRole('tab', { name: 'Créditos' }));

    expect(screen.getByText('Saldo Pendiente')).toBeInTheDocument();
    expect(screen.getByText(/COP\s*0/)).toBeInTheDocument();
    expect(screen.queryByText(/-COP/)).not.toBeInTheDocument();
  });

  it('keeps internal customer and loan identifiers out of detail surfaces', () => {
    loansFixture = [
      {
        id: 3,
        customerId: 5,
        status: 'active',
        amount: 900000,
        totalPaid: 300000,
        interestRate: 24,
        termMonths: 6,
        startDate: '2026-04-27T00:00:00.000Z',
      },
    ];

    render(<CustomerDetails />);

    expect(screen.queryByText(/ID:/i)).not.toBeInTheDocument();
    expect(screen.getByText('Documento: QA-5')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Créditos' }));

    expect(screen.getByText('Crédito del cliente')).toBeInTheDocument();
    expect(screen.queryByText('Crédito #3')).not.toBeInTheDocument();
  });

  it('renders customer loan statuses with operator-facing labels', () => {
    loansFixture = [
      {
        id: 4,
        customerId: 5,
        status: 'defaulted',
        amount: 900000,
        totalPaid: 100000,
        interestRate: 24,
        termMonths: 6,
        startDate: '2026-04-27T00:00:00.000Z',
      },
    ];

    render(<CustomerDetails />);

    fireEvent.click(screen.getByRole('tab', { name: 'Créditos' }));

    expect(screen.getByText('En mora')).toBeInTheDocument();
    expect(screen.queryByText(/^defaulted$/i)).not.toBeInTheDocument();
  });

  it('renders unknown history events with neutral operational fallbacks', () => {
    historyFixture = [
      {
        action: 'internal_policy_recalculated',
        entityType: 'calculation_profile_version',
        date: '2026-05-30T12:00:00.000Z',
      },
    ];

    render(<CustomerDetails />);

    fireEvent.click(screen.getByRole('tab', { name: 'Historial' }));

    expect(screen.getByText('Evento registrado')).toBeInTheDocument();
    expect(screen.getByText('Actividad del cliente')).toBeInTheDocument();
    expect(screen.queryByText(/Internal policy recalculated/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Calculation profile version/i)).not.toBeInTheDocument();
  });
});
