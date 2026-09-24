import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import NewCustomer from '../NewCustomer';

const createCustomer = vi.fn();
const updateCustomer = vi.fn();
let routeId: string | undefined;
let existingCustomer: Record<string, unknown> | null;

vi.mock('react-router-dom', () => ({ useParams: () => ({ id: routeId }) }));
vi.mock('../../services/customerService', () => ({
  useCustomers: () => ({ createCustomer: { mutateAsync: createCustomer }, updateCustomer: { mutateAsync: updateCustomer } }),
  useCustomerById: () => ({ data: existingCustomer ? { data: { customer: existingCustomer } } : null, isLoading: false, isError: false }),
}));
vi.mock('../hooks/useCreateEntitySubmit', () => ({
  useCreateEntitySubmit: (config: { mutate: (payload: unknown) => Promise<unknown>; onSuccess: () => void }) => ({
    isSubmitting: false,
    run: async (payload: unknown) => { await config.mutate(payload); config.onSuccess(); },
  }),
}));

const change = (container: HTMLElement, id: string, value: string) => {
  const input = container.querySelector<HTMLInputElement>(`#${id}`);
  expect(input).not.toBeNull();
  fireEvent.change(input!, { target: { value } });
};

describe('NewCustomer household fields', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routeId = undefined;
    existingCustomer = null;
    createCustomer.mockResolvedValue({});
    updateCustomer.mockResolvedValue({});
  });

  it('sends separate household values when creating a customer', async () => {
    const { container } = render(<NewCustomer onBack={vi.fn()} />);
    change(container, 'new-customer-first-name', 'Ana');
    change(container, 'new-customer-last-name', 'Gomez');
    change(container, 'new-customer-document-id', '123456');
    change(container, 'new-customer-phone', '3001234567');
    change(container, 'new-customer-email', 'ana@example.com');
    change(container, 'new-customer-housing-type', 'Familiar');
    change(container, 'new-customer-marital-status', 'Soltera');
    change(container, 'new-customer-occupation', 'Empleada');
    change(container, 'new-customer-dependents', '2');
    change(container, 'new-customer-address', 'Cra 2 # 7-61');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cliente' }));
    await waitFor(() => expect(createCustomer).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Ana Gomez', housingType: 'Familiar', maritalStatus: 'Soltera',
      occupation: 'Empleada', dependentsCount: 2, address: 'Cra 2 # 7-61',
    })));
  });

  it('loads and updates household fields without dropping other profile data', async () => {
    routeId = '5';
    existingCustomer = {
      name: 'Ana Gomez', documentNumber: '123456', status: 'active', phone: '3001234567',
      email: 'ana@example.com', address: 'Cra 2 # 7-61',
      housingType: 'Familiar', maritalStatus: 'Soltera', occupation: 'Empleada', dependentsCount: 0,
    };
    const { container } = render(<NewCustomer onBack={vi.fn()} />);
    expect(container.querySelector<HTMLInputElement>('#new-customer-housing-type')?.value).toBe('Familiar');
    change(container, 'new-customer-housing-type', 'Arrendada');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => expect(updateCustomer).toHaveBeenCalledWith(expect.objectContaining({
      id: 5, housingType: 'Arrendada', dependentsCount: 0,
      occupation: 'Empleada', address: 'Cra 2 # 7-61',
    })));
  });
});
