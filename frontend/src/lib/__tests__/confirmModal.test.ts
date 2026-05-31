import { afterEach, describe, expect, it } from 'vitest';
import userEvent from '@testing-library/user-event';
import { confirmDanger, requestInput } from '../confirmModal';

describe('confirmModal', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('renders confirmation content as text instead of executable HTML', async () => {
    const result = confirmDanger({
      title: '<img src=x onerror=alert(1)> Eliminar cliente',
      message: '<script id="modal-payload">alert(1)</script> Cliente operativo',
      confirmLabel: 'Eliminar',
      cancelLabel: 'Cancelar',
    });

    expect(document.querySelector('img')).toBeNull();
    expect(document.getElementById('modal-payload')).toBeNull();
    expect(document.body.textContent).toContain('<img src=x onerror=alert(1)> Eliminar cliente');
    expect(document.body.textContent).toContain('<script id="modal-payload">alert(1)</script> Cliente operativo');

    document.getElementById('confirm-ok')?.click();

    await expect(result).resolves.toBe(true);
  });

  it('labels confirmation dialogs and keeps tab focus inside', async () => {
    const user = userEvent.setup();
    const outsideButton = document.createElement('button');
    outsideButton.type = 'button';
    outsideButton.textContent = 'Fuera del modal';
    document.body.appendChild(outsideButton);

    const result = confirmDanger({
      title: 'Eliminar cliente',
      message: 'Esta acción requiere confirmación administrativa.',
      confirmLabel: 'Eliminar',
      cancelLabel: 'Cancelar',
    });

    const dialog = document.getElementById('confirm-dialog');
    const cancelButton = document.getElementById('confirm-cancel');
    const confirmButton = document.getElementById('confirm-ok');

    expect(dialog).toHaveAccessibleName('Eliminar cliente');
    expect(dialog).toHaveAccessibleDescription('Esta acción requiere confirmación administrativa.');
    expect(confirmButton).toHaveFocus();

    await user.tab();
    expect(cancelButton).toHaveFocus();

    await user.tab({ shift: true });
    expect(confirmButton).toHaveFocus();

    confirmButton?.click();

    await expect(result).resolves.toBe(true);
  });

  it('renders prompt content and defaults without creating markup from user text', async () => {
    const placeholder = '" autofocus onfocus="alert(1)';
    const defaultValue = '<img src=x onerror=alert(1)>';
    const result = requestInput({
      title: 'Anular exportacion',
      message: '<button id="forged-confirm">Aprobar</button>',
      label: 'Motivo <em>operativo</em>',
      placeholder,
      defaultValue,
      confirmLabel: 'Guardar',
      cancelLabel: 'Cancelar',
    });

    expect(document.getElementById('forged-confirm')).toBeNull();
    expect(document.querySelector('em')).toBeNull();
    expect(document.body.textContent).toContain('<button id="forged-confirm">Aprobar</button>');
    expect(document.body.textContent).toContain('Motivo <em>operativo</em>');

    const input = document.getElementById('prompt-input') as HTMLInputElement | null;
    expect(input?.placeholder).toBe(placeholder);
    expect(input?.value).toBe(defaultValue);

    input!.value = 'Correccion solicitada por auditoria';
    document.getElementById('prompt-ok')?.click();

    await expect(result).resolves.toBe('Correccion solicitada por auditoria');
  });

  it('labels prompt dialogs and keeps tab focus inside', async () => {
    const user = userEvent.setup();
    const outsideButton = document.createElement('button');
    outsideButton.type = 'button';
    outsideButton.textContent = 'Fuera del modal';
    document.body.appendChild(outsideButton);

    const result = requestInput({
      title: 'Registrar motivo',
      message: 'Escriba el motivo de la operación.',
      label: 'Motivo',
      defaultValue: 'Corrección operativa',
      confirmLabel: 'Guardar',
      cancelLabel: 'Cancelar',
    });

    const dialog = document.getElementById('prompt-dialog');
    const input = document.getElementById('prompt-input');
    const confirmButton = document.getElementById('prompt-ok');

    expect(dialog).toHaveAccessibleName('Registrar motivo');
    expect(dialog).toHaveAccessibleDescription('Escriba el motivo de la operación.');
    expect(input).toHaveFocus();

    await user.tab({ shift: true });
    expect(confirmButton).toHaveFocus();

    await user.tab();
    expect(input).toHaveFocus();

    confirmButton?.click();

    await expect(result).resolves.toBe('Corrección operativa');
  });
});
