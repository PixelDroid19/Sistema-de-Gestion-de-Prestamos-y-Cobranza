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
  input: 'w-full bg-bg-base border border-border-subtle rounded-lg px-4 py-2.5 text-sm text-text-primary outline-none focus:ring-2 focus:ring-brand-primary/35 focus:border-brand-primary/40',
  label: 'block text-sm font-medium text-text-secondary mb-2 mt-4',
};

const modalFocusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

const getFocusableModalElements = (dialog: HTMLElement) => (
  Array.from(dialog.querySelectorAll<HTMLElement>(modalFocusableSelector))
    .filter((element) => element.tabIndex >= 0 && element.getAttribute('aria-hidden') !== 'true')
);

const createModalContainer = (): HTMLDivElement => {
  const container = document.createElement('div');
  container.className = confirmStyles.overlay;
  document.body.appendChild(container);
  return container;
};

const stopDialogClick = (event: MouseEvent) => {
  event.stopPropagation();
};

const createTextElement = <K extends keyof HTMLElementTagNameMap>(
  tagName: K,
  className: string,
  text: string,
): HTMLElementTagNameMap[K] => {
  const element = document.createElement(tagName);
  element.className = className;
  element.textContent = text;
  return element;
};

const createButton = (id: string, className: string, label: string): HTMLButtonElement => {
  const button = document.createElement('button');
  button.id = id;
  button.type = 'button';
  button.className = className;
  button.textContent = label;
  return button;
};

const createDialogScaffold = (id: string, title: string) => {
  const titleId = `${id}-title`;
  const messageId = `${id}-message`;
  const dialog = document.createElement('div');
  dialog.id = id;
  dialog.className = confirmStyles.dialog;
  dialog.style.animation = 'fadeIn 0.15s ease-out';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-labelledby', titleId);
  dialog.setAttribute('aria-describedby', messageId);

  const style = document.createElement('style');
  style.textContent = '@keyframes fadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }';
  dialog.appendChild(style);

  const header = document.createElement('div');
  header.className = confirmStyles.header;
  const titleElement = createTextElement('h3', confirmStyles.title, title);
  titleElement.id = titleId;
  header.appendChild(titleElement);
  dialog.appendChild(header);

  const body = document.createElement('div');
  body.className = confirmStyles.body;
  dialog.appendChild(body);

  const footer = document.createElement('div');
  footer.className = confirmStyles.footer;
  dialog.appendChild(footer);

  return { dialog, body, footer, messageId };
};

const trapDialogTabFocus = (event: KeyboardEvent, dialog: HTMLElement) => {
  if (event.key !== 'Tab') {
    return;
  }

  const focusableElements = getFocusableModalElements(dialog);
  if (focusableElements.length === 0) {
    event.preventDefault();
    dialog.focus({ preventScroll: true });
    return;
  }

  const firstFocusable = focusableElements[0];
  const lastFocusable = focusableElements[focusableElements.length - 1];
  const activeElement = document.activeElement;

  if (event.shiftKey) {
    if (activeElement === firstFocusable || activeElement === dialog || !dialog.contains(activeElement)) {
      event.preventDefault();
      lastFocusable.focus({ preventScroll: true });
    }
    return;
  }

  if (activeElement === lastFocusable || activeElement === dialog || !dialog.contains(activeElement)) {
    event.preventDefault();
    firstFocusable.focus({ preventScroll: true });
  }
};

const requestConfirmation = async (options: ConfirmOptions): Promise<ConfirmResult> => {
  return new Promise((resolve) => {
    const container = createModalContainer();
    const confirmVariant = options.confirmVariant || 'primary';
    const confirmLabel = options.confirmLabel || tTerm('common.cta.confirm');
    const cancelLabel = options.cancelLabel || tTerm('common.cta.cancel');
    const { dialog, body, footer, messageId } = createDialogScaffold('confirm-dialog', options.title);
    const cancelButton = createButton('confirm-cancel', confirmStyles.cancelButton, cancelLabel);
    const confirmButton = createButton('confirm-ok', confirmStyles.confirmButton(confirmVariant), confirmLabel);
    const message = createTextElement('p', confirmStyles.message, options.message);

    message.id = messageId;
    body.appendChild(message);
    footer.append(cancelButton, confirmButton);
    container.appendChild(dialog);

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
        return;
      }

      trapDialogTabFocus(event, dialog);
    };

    container.addEventListener('click', onOverlayClick);
    document.addEventListener('keydown', onKeyDown);
    dialog.addEventListener('click', stopDialogClick as EventListener);
    cancelButton.addEventListener('click', () => onClose(false));
    confirmButton.addEventListener('click', () => onClose(true));

    confirmButton.focus();
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
    const { dialog, body, footer, messageId } = createDialogScaffold('prompt-dialog', options.title);
    const message = createTextElement('p', confirmStyles.message, options.message);
    const label = createTextElement('label', confirmStyles.label, options.label);
    label.setAttribute('for', 'prompt-input');

    const input = document.createElement('input');
    input.id = 'prompt-input';
    input.type = 'text';
    input.className = confirmStyles.input;
    input.placeholder = options.placeholder || '';
    input.value = options.defaultValue || '';

    const cancelButton = createButton('prompt-cancel', confirmStyles.cancelButton, cancelLabel);
    const confirmButton = createButton('prompt-ok', confirmStyles.confirmButton(confirmVariant), confirmLabel);

    message.id = messageId;
    body.append(message, label, input);
    footer.append(cancelButton, confirmButton);
    container.appendChild(dialog);

    const onClose = (result: PromptResult) => {
      document.removeEventListener('keydown', onKeyDown);
      container.remove();
      resolve(result);
    };

    const onConfirm = () => {
      onClose(input.value);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose(null);
        return;
      }

      if (event.key === 'Enter') {
        onConfirm();
        return;
      }

      trapDialogTabFocus(event, dialog);
    };

    const onOverlayClick = (event: MouseEvent) => {
      if (event.target === container) {
        onClose(null);
      }
    };

    container.addEventListener('click', onOverlayClick);
    document.addEventListener('keydown', onKeyDown);
    dialog.addEventListener('click', stopDialogClick as EventListener);
    cancelButton.addEventListener('click', () => onClose(null));
    confirmButton.addEventListener('click', onConfirm);

    input.focus();
    input.select();
  });
};

export const useConfirm = () => {
  return { confirm, confirmDanger, requestInput };
};
