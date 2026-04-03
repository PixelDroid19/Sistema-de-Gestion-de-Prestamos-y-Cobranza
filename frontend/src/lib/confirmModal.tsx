import { tTerm } from '../i18n/terminology';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: 'danger' | 'primary';
}

export interface PromptOptions {
  title: string;
  message: string;
  label: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: 'danger' | 'primary';
}

export type ConfirmResult = boolean | null;
export type PromptResult = string | null;

const confirmStyles = {
  overlay: 'fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4',
  dialog: 'bg-bg-surface rounded-2xl w-full max-w-md border border-border-subtle shadow-2xl overflow-hidden',
  header: 'p-6 border-b border-border-subtle',
  title: 'text-lg font-semibold text-text-primary',
  body: 'p-6',
  message: 'text-sm text-text-secondary',
  footer: 'p-4 bg-bg-base border-t border-border-subtle flex gap-3',
  cancelButton: 'flex-1 py-2.5 text-sm font-medium border border-border-subtle rounded-lg hover:bg-hover-bg transition-colors',
  confirmButton: (variant: 'danger' | 'primary') =>
    `flex-1 py-2.5 text-sm font-medium rounded-lg transition-colors ${
      variant === 'danger'
        ? 'bg-red-500 text-white hover:bg-red-600'
        : 'bg-text-primary text-bg-base hover:bg-text-secondary'
    }`,
  input: 'w-full bg-bg-base border border-border-subtle rounded-lg px-4 py-2.5 text-sm text-text-primary outline-none focus:ring-1 focus:ring-border-strong',
  label: 'block text-sm font-medium text-text-secondary mb-2 mt-4',
};

const createModalContainer = (): HTMLDivElement => {
  const container = document.createElement('div');
  container.className = confirmStyles.overlay;
  document.body.appendChild(container);
  return container;
};

const stopDialogClick = (event: MouseEvent) => {
  event.stopPropagation();
};

const requestConfirmation = async (options: ConfirmOptions): Promise<ConfirmResult> => {
  return new Promise((resolve) => {
    const container = createModalContainer();
    const confirmVariant = options.confirmVariant || 'primary';
    const confirmLabel = options.confirmLabel || tTerm('common.cta.confirm');
    const cancelLabel = options.cancelLabel || tTerm('common.cta.cancel');

    container.innerHTML = `
      <div id="confirm-dialog" class="${confirmStyles.dialog}" style="animation: fadeIn 0.15s ease-out" role="dialog" aria-modal="true">
        <style>
          @keyframes fadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        </style>
        <div class="${confirmStyles.header}">
          <h3 class="${confirmStyles.title}">${options.title}</h3>
        </div>
        <div class="${confirmStyles.body}">
          <p class="${confirmStyles.message}">${options.message}</p>
        </div>
        <div class="${confirmStyles.footer}">
          <button id="confirm-cancel" type="button" class="${confirmStyles.cancelButton}">${cancelLabel}</button>
          <button id="confirm-ok" type="button" class="${confirmStyles.confirmButton(confirmVariant)}">${confirmLabel}</button>
        </div>
      </div>
    `;

    const onClose = (result: ConfirmResult) => {
      document.removeEventListener('keydown', onKeyDown);
      container.remove();
      resolve(result);
    };

    const onOverlayClick = (event: MouseEvent) => {
      if (event.target === container) {
        onClose(null);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose(null);
      }
    };

    container.addEventListener('click', onOverlayClick);
    document.addEventListener('keydown', onKeyDown);
    document.getElementById('confirm-dialog')?.addEventListener('click', stopDialogClick as EventListener);
    document.getElementById('confirm-cancel')?.addEventListener('click', () => onClose(false));
    document.getElementById('confirm-ok')?.addEventListener('click', () => onClose(true));

    (document.getElementById('confirm-ok') as HTMLButtonElement | null)?.focus();
  });
};

export const confirm = requestConfirmation;

export const confirmDanger = async (options: Omit<ConfirmOptions, 'confirmVariant'>): Promise<ConfirmResult> => {
  return requestConfirmation({ ...options, confirmVariant: 'danger' });
};

export const requestInput = async (options: PromptOptions): Promise<PromptResult> => {
  return new Promise((resolve) => {
    const container = createModalContainer();
    const confirmVariant = options.confirmVariant || 'primary';
    const confirmLabel = options.confirmLabel || tTerm('common.cta.confirm');
    const cancelLabel = options.cancelLabel || tTerm('common.cta.cancel');

    container.innerHTML = `
      <div id="prompt-dialog" class="${confirmStyles.dialog}" style="animation: fadeIn 0.15s ease-out" role="dialog" aria-modal="true">
        <style>
          @keyframes fadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        </style>
        <div class="${confirmStyles.header}">
          <h3 class="${confirmStyles.title}">${options.title}</h3>
        </div>
        <div class="${confirmStyles.body}">
          <p class="${confirmStyles.message}">${options.message}</p>
          <label for="prompt-input" class="${confirmStyles.label}">${options.label}</label>
          <input
            id="prompt-input"
            type="text"
            class="${confirmStyles.input}"
            placeholder="${options.placeholder || ''}"
            value="${options.defaultValue || ''}"
          />
        </div>
        <div class="${confirmStyles.footer}">
          <button id="prompt-cancel" type="button" class="${confirmStyles.cancelButton}">${cancelLabel}</button>
          <button id="prompt-ok" type="button" class="${confirmStyles.confirmButton(confirmVariant)}">${confirmLabel}</button>
        </div>
      </div>
    `;

    const onClose = (result: PromptResult) => {
      document.removeEventListener('keydown', onKeyDown);
      container.remove();
      resolve(result);
    };

    const onConfirm = () => {
      const value = (document.getElementById('prompt-input') as HTMLInputElement | null)?.value ?? '';
      onClose(value);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose(null);
      }

      if (event.key === 'Enter') {
        onConfirm();
      }
    };

    const onOverlayClick = (event: MouseEvent) => {
      if (event.target === container) {
        onClose(null);
      }
    };

    container.addEventListener('click', onOverlayClick);
    document.addEventListener('keydown', onKeyDown);
    document.getElementById('prompt-dialog')?.addEventListener('click', stopDialogClick as EventListener);
    document.getElementById('prompt-cancel')?.addEventListener('click', () => onClose(null));
    document.getElementById('prompt-ok')?.addEventListener('click', onConfirm);

    const input = document.getElementById('prompt-input') as HTMLInputElement | null;
    input?.focus();
    input?.select();
  });
};

export const useConfirm = () => {
  return { confirm, confirmDanger, requestInput };
};
