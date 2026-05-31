import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ModalShell, ViewTabs } from '../shared/Surfaces';

describe('shared surfaces', () => {
  it('exposes view tabs with tab semantics and keyboard navigation', async () => {
    const user = userEvent.setup();

    function ViewTabsHarness() {
      const [activeTab, setActiveTab] = useState('credits');

      return (
        <ViewTabs
          ariaLabel="Secciones de prueba"
          activeTab={activeTab}
          onChange={setActiveTab}
          tabs={[
            { id: 'credits', label: 'Créditos' },
            { id: 'reports', label: 'Reportes', count: 4 },
            { id: 'settings', label: 'Configuración' },
          ]}
        />
      );
    }

    render(<ViewTabsHarness />);

    const tablist = screen.getByRole('tablist', { name: 'Secciones de prueba' });
    const creditsTab = screen.getByRole('tab', { name: 'Créditos' });
    const reportsTab = screen.getByRole('tab', { name: 'Reportes 4' });
    const settingsTab = screen.getByRole('tab', { name: 'Configuración' });

    expect(tablist).toContainElement(creditsTab);
    expect(creditsTab).toHaveAttribute('aria-selected', 'true');
    expect(reportsTab).toHaveAttribute('aria-selected', 'false');

    creditsTab.focus();
    await user.keyboard('{ArrowRight}');
    expect(reportsTab).toHaveFocus();
    expect(reportsTab).toHaveAttribute('aria-selected', 'true');

    await user.keyboard('{End}');
    expect(settingsTab).toHaveFocus();
    expect(settingsTab).toHaveAttribute('aria-selected', 'true');

    await user.keyboard('{Home}');
    expect(creditsTab).toHaveFocus();
    expect(creditsTab).toHaveAttribute('aria-selected', 'true');
  });

  it('exposes modal shells as labelled modal dialogs', () => {
    render(
      <ModalShell title="Registrar pago" subtitle="Datos del comprobante">
        <button type="button">Cerrar</button>
      </ModalShell>,
    );

    const dialog = screen.getByRole('dialog', { name: 'Registrar pago' });

    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('moves initial keyboard focus into modal shells', () => {
    render(
      <ModalShell title="Editar método">
        <button type="button">Cerrar</button>
      </ModalShell>,
    );

    expect(screen.getByRole('dialog', { name: 'Editar método' })).toHaveFocus();
  });

  it('keeps tab focus inside modal shells', async () => {
    const user = userEvent.setup();

    render(
      <>
        <button type="button">Fuera del modal</button>
        <ModalShell title="Registrar abono">
          <button type="button">Cancelar</button>
          <button type="button">Guardar</button>
        </ModalShell>
      </>,
    );

    expect(screen.getByRole('dialog', { name: 'Registrar abono' })).toHaveFocus();

    await user.tab();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus();

    await user.tab();
    expect(screen.getByRole('button', { name: 'Guardar' })).toHaveFocus();

    await user.tab();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus();

    await user.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'Guardar' })).toHaveFocus();
  });

  it('calls modal shell onClose from Escape and overlay clicks only', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { container } = render(
      <ModalShell title="Editar política" onClose={onClose}>
        <button type="button">Dentro del modal</button>
      </ModalShell>,
    );

    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('dialog', { name: 'Editar política' }));
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(container.querySelector('.modal-overlay') as HTMLElement);
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
