import React from 'react';
import {
  countDigitsBeforeCursor,
  cursorAfterDigitOffset,
  resolveGroupedMoneyCursorAfterDelete,
} from '../../../lib/moneyInput';
import {
  buildAppInputChangeDetail,
  getAppInputDisplayValue,
  getAppInputHtmlType,
  getAppInputMode,
  isRollbackSensitiveVariant,
  normalizeAppInputValue,
  resolveFormatGroupedDecimals,
  shouldRollbackNumericEdit,
  type AppInputChangeDetail,
  type AppInputVariant,
} from './appInputUtils';
import './AppInput.css';

export type { AppInputChangeDetail, AppInputVariant };

export type AppInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'inputMode'
> & {
  // 'type' intentionally not omitted to support 'password' (and allow override for special cases like login);
  // runtime in render prefers computed from variant unless caller passes password etc.
  value: string;
  variant?: AppInputVariant;
  icon?: React.ReactNode;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  invalid?: boolean;
  allowZero?: boolean;
  minValue?: number;
  maxValue?: number;
  maxDigits?: number;
  maxDecimals?: number;
  trimText?: boolean;
  /** Groups thousands in decimal display (es-CO: 120.554,50). Defaults to true when `prefix` is set on `decimal`. */
  formatGroupedDecimals?: boolean;
  onValueChange: (value: string, detail: AppInputChangeDetail, event: React.ChangeEvent<HTMLInputElement>) => void;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  inputClassName?: string;
  shellClassName?: string;
};

export function AppInput({
  value,
  variant = 'text',
  icon,
  prefix,
  suffix,
  invalid = false,
  allowZero,
  minValue,
  maxValue,
  maxDigits,
  maxDecimals,
  trimText,
  formatGroupedDecimals,
  onValueChange,
  maxLength,
  inputMode,
  className = '',
  inputClassName = '',
  shellClassName = '',
  onFocus,
  onBlur,
  onMouseDown,
  onSelect,
  onBeforeInput,
  onKeyDown,
  onPaste,
  'aria-invalid': ariaInvalid,
  ...rest
}: AppInputProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const editBaselineValueRef = React.useRef(value);
  const rollbackLockRef = React.useRef(false);
  const pendingCursorRef = React.useRef<number | null>(null);
  const pendingDigitOffsetRef = React.useRef<number | null>(null);
  const groupedDecimals = resolveFormatGroupedDecimals(variant, formatGroupedDecimals, prefix);
  const usesGroupedMoneyDisplay = (groupedDecimals && variant === 'decimal') || variant === 'money';
  const normalizeOptions = {
    allowZero,
    minValue,
    maxValue,
    maxDigits,
    maxDecimals,
    trimText,
    maxLength,
    formatGroupedDecimals: groupedDecimals,
  };
  const displayOptions = {
    formatGroupedDecimals: groupedDecimals,
    maxDecimals,
  };

  React.useEffect(() => {
    if (document.activeElement !== inputRef.current) {
      editBaselineValueRef.current = value;
    }
  }, [value]);

  React.useLayoutEffect(() => {
    const input = inputRef.current;
    if (!input || document.activeElement !== input) {
      pendingCursorRef.current = null;
      // keep digit offset briefly; clear on explicit blur
      return;
    }

    const applyOffset = (offset: number) => {
      const target = cursorAfterDigitOffset(input.value, offset);
      const sl = input.scrollLeft;
      input.setSelectionRange(target, target);
      input.scrollLeft = sl;
    };

    // Strong preference for digit offset: re-apply on *every* post-render while focused
    // and we have a pending (or last known) offset. This survives value prop updates
    // from parent (policy, calc, other fields) that would otherwise push caret to end.
    if (pendingDigitOffsetRef.current !== null) {
      applyOffset(pendingDigitOffsetRef.current);
      // Do not clear immediately; give a rAF retry in case React or browser selection
      // handlers run after layout and move it again (common with controlled inputs).
      const off = pendingDigitOffsetRef.current;
      requestAnimationFrame(() => {
        if (inputRef.current && document.activeElement === inputRef.current && pendingDigitOffsetRef.current !== null) {
          applyOffset(off);
          pendingDigitOffsetRef.current = null;
          pendingCursorRef.current = null;
        }
      });
      pendingDigitOffsetRef.current = null;
      pendingCursorRef.current = null;
      return;
    }

    if (pendingCursorRef.current !== null) {
      const cursor = Math.min(pendingCursorRef.current, input.value.length);
      const sl = input.scrollLeft;
      input.setSelectionRange(cursor, cursor);
      input.scrollLeft = sl;
      pendingCursorRef.current = null;
    }
  }, [value, variant, groupedDecimals, maxDecimals]);

  const emitValue = (nextValue: string, event: React.ChangeEvent<HTMLInputElement>) => {
    if (document.activeElement === inputRef.current && isRollbackSensitiveVariant(variant)) {
      editBaselineValueRef.current = nextValue;
    }
    const detail = buildAppInputChangeDetail(variant, nextValue, displayOptions);
    onValueChange(nextValue, detail, event);
  };

  const buildSyntheticChangeEvent = (
    event: Event | React.SyntheticEvent<HTMLInputElement>,
  ): React.ChangeEvent<HTMLInputElement> | null => {
    if (!inputRef.current) {
      return null;
    }

    return {
      target: inputRef.current,
      currentTarget: inputRef.current,
      nativeEvent: 'nativeEvent' in event ? event.nativeEvent : event,
      preventDefault: () => {},
      stopPropagation: () => {},
      isDefaultPrevented: () => false,
      isPropagationStopped: () => false,
      persist: () => {},
      timeStamp: Date.now(),
      type: 'change',
      bubbles: true,
      cancelable: false,
      defaultPrevented: false,
      eventPhase: 0,
      isTrusted: false,
    } as unknown as React.ChangeEvent<HTMLInputElement>;
  };

  const restoreFocusedValue = (event: Event | React.SyntheticEvent<HTMLInputElement>) => {
    rollbackLockRef.current = true;
    const syntheticEvent = buildSyntheticChangeEvent(event);
    if (!syntheticEvent) {
      return;
    }

    emitValue(editBaselineValueRef.current, syntheticEvent);
    queueMicrotask(() => {
      rollbackLockRef.current = false;
    });
    requestAnimationFrame(() => {
      const input = inputRef.current;
      if (!input) {
        rollbackLockRef.current = false;
        return;
      }

      if (document.activeElement === input || document.activeElement === document.body) {
        input.focus({ preventScroll: true });
        const cursor = input.value.length;
        input.setSelectionRange(cursor, cursor);
      }
      rollbackLockRef.current = false;
    });
  };

  const queueFormattedMoneyCursor = (cursor: number, digitOffset?: number) => {
    pendingCursorRef.current = Math.max(0, cursor);
    if (typeof digitOffset === 'number' && digitOffset >= 0) {
      pendingDigitOffsetRef.current = digitOffset;
    }
  };

  const resolveFormattedMoneyCursor = (
    nextDisplay: string,
    nextFormatted: string,
    selectionStart: number,
  ) => {
    if (variant === 'decimal' && groupedDecimals) {
      const decimalSeparatorIndex = nextDisplay.lastIndexOf(',');
      const formattedSeparatorIndex = nextFormatted.lastIndexOf(',');

      if (
        decimalSeparatorIndex >= 0
        && formattedSeparatorIndex >= 0
        && selectionStart > decimalSeparatorIndex
      ) {
        const decimalDigitsBeforeCursor = countDigitsBeforeCursor(
          nextDisplay.slice(decimalSeparatorIndex + 1, selectionStart),
          selectionStart - decimalSeparatorIndex - 1,
        );

        return Math.min(
          formattedSeparatorIndex + 1 + decimalDigitsBeforeCursor,
          nextFormatted.length,
        );
      }
    }

    return cursorAfterDigitOffset(
      nextFormatted,
      countDigitsBeforeCursor(nextDisplay, selectionStart),
    );
  };

  const isDecimalSeparatorCursor = (
    nextDisplay: string,
    nextFormatted: string,
    selectionStart: number,
  ) => (
    variant === 'decimal'
    && groupedDecimals
    && nextDisplay.lastIndexOf(',') >= 0
    && nextFormatted.lastIndexOf(',') >= 0
    && selectionStart > nextDisplay.lastIndexOf(',')
  );

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (rollbackLockRef.current) {
      return;
    }

    if (variant === 'date' || variant === 'email' || variant === 'tel') {
      emitValue(event.target.value, event);
      return;
    }

    const input = event.currentTarget;
    const previousDisplay = getAppInputDisplayValue(variant, value, displayOptions);
    const nextDisplay = input.value;
    const editContext = usesGroupedMoneyDisplay
      ? {
          previousCanonical: value,
          previousDisplay,
          nextDisplay,
        }
      : undefined;
    const normalizedValue = normalizeAppInputValue(
      variant,
      nextDisplay,
      normalizeOptions,
      editContext,
    );
    if (normalizedValue === null) {
      return;
    }

    if (usesGroupedMoneyDisplay && document.activeElement === input) {
      const nextFormatted = getAppInputDisplayValue(variant, normalizedValue, displayOptions);
      // Always derive cursor from logical digit count in the *user-edited* display
      // (post keystroke/paste/delete). This ensures caret stays with the same
      // digit offset even when formatting (re)inserts separators on inserts or
      // deletes anywhere, not only end-backspaces.
      const digitOffset = countDigitsBeforeCursor(
        nextDisplay,
        input.selectionStart ?? nextDisplay.length,
      );
      const selectionStart = input.selectionStart ?? nextDisplay.length;
      const targetCursor = resolveFormattedMoneyCursor(
        nextDisplay,
        nextFormatted,
        selectionStart,
      );

      // Synchronous correction on the live DOM element *during* the change event.
      // This is critical for controlled inputs: we set the formatted value + caret
      // immediately so that the subsequent React re-render (from emit -> parent state -> new canonical prop)
      // sets the <input value> to the *same* string we just put in, without the browser defaulting
      // the caret to the end. The layout effect is a safety net for later updates.
      input.value = nextFormatted;
      input.setSelectionRange(targetCursor, targetCursor);

      queueFormattedMoneyCursor(
        targetCursor,
        isDecimalSeparatorCursor(nextDisplay, nextFormatted, selectionStart) ? undefined : digitOffset,
      );
    }

    emitValue(normalizedValue, event);
  };

  const handleFocus = (event: React.FocusEvent<HTMLInputElement>) => {
    rollbackLockRef.current = false;
    editBaselineValueRef.current = value;
    // do not clear digit offset here; the layout effect will apply if present
    onFocus?.(event);
  };

  const handleBlur = (event: React.FocusEvent<HTMLInputElement>) => {
    rollbackLockRef.current = false;
    pendingCursorRef.current = null;
    pendingDigitOffsetRef.current = null;
    onBlur?.(event);
  };

  const handleMouseDown = (event: React.MouseEvent<HTMLInputElement>) => {
    rollbackLockRef.current = false;
    onMouseDown?.(event);
  };

  const handleSelect = (event: React.SyntheticEvent<HTMLInputElement>) => {
    const target = event.currentTarget;
    if (
      typeof target.selectionStart === 'number'
      && typeof target.selectionEnd === 'number'
      && target.selectionStart !== target.selectionEnd
    ) {
      editBaselineValueRef.current = value;
    }
    onSelect?.(event);
  };

  const handleBeforeInput = (event: React.FormEvent<HTMLInputElement>) => {
    const nativeEvent = event.nativeEvent as InputEvent | undefined;
    const insertedText = typeof nativeEvent?.data === 'string' ? nativeEvent.data : undefined;

    if (rollbackLockRef.current && insertedText) {
      event.preventDefault();
      return;
    }

    if (shouldRollbackNumericEdit(variant, insertedText)) {
      event.preventDefault();
      restoreFocusedValue(event);
      return;
    }

    (onBeforeInput as React.FormEventHandler<HTMLInputElement> | undefined)?.(event);
  };


  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace' || event.key === 'Delete') {
      rollbackLockRef.current = false;

      if (usesGroupedMoneyDisplay) {
        const input = event.currentTarget;
        const selectionStart = input.selectionStart ?? input.value.length;
        const selectionEnd = input.selectionEnd ?? selectionStart;
        const previousDisplay = getAppInputDisplayValue(variant, value, displayOptions);

        if (
          selectionStart === selectionEnd
          && (
            (event.key === 'Backspace' && selectionStart <= 0)
            || (event.key === 'Delete' && selectionStart >= previousDisplay.length)
          )
        ) {
          onKeyDown?.(event);
          return;
        }

        event.preventDefault();

        const nextDisplay = selectionStart !== selectionEnd
          ? `${previousDisplay.slice(0, selectionStart)}${previousDisplay.slice(selectionEnd)}`
          : event.key === 'Backspace'
            ? `${previousDisplay.slice(0, selectionStart - 1)}${previousDisplay.slice(selectionStart)}`
            : `${previousDisplay.slice(0, selectionStart)}${previousDisplay.slice(selectionStart + 1)}`;

        const normalizedValue = normalizeAppInputValue(
          variant,
          nextDisplay,
          normalizeOptions,
          {
            previousCanonical: value,
            previousDisplay,
            nextDisplay,
          },
        );

        if (normalizedValue === null) {
          return;
        }

        const nextFormatted = getAppInputDisplayValue(variant, normalizedValue, displayOptions);
        const targetCursor = resolveGroupedMoneyCursorAfterDelete(
          previousDisplay,
          nextFormatted,
          selectionStart,
          selectionEnd,
          event.key,
        );

        input.value = nextFormatted;
        input.setSelectionRange(targetCursor, targetCursor);
        queueFormattedMoneyCursor(targetCursor, countDigitsBeforeCursor(nextFormatted, targetCursor));

        const syntheticEvent = buildSyntheticChangeEvent(event);
        if (syntheticEvent) {
          emitValue(normalizedValue, syntheticEvent);
        }
        return;
      }
    }

    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'a') {
      editBaselineValueRef.current = value;
      onKeyDown?.(event);
      return;
    }

    if (rollbackLockRef.current && event.key.length === 1) {
      event.preventDefault();
      return;
    }

    if (event.key.length === 1 && shouldRollbackNumericEdit(variant, event.key)) {
      event.preventDefault();
      restoreFocusedValue(event);
      return;
    }

    onKeyDown?.(event);
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    if (shouldRollbackNumericEdit(variant, event.clipboardData.getData('text'))) {
      event.preventDefault();
      restoreFocusedValue(event);
      return;
    }

    onPaste?.(event);
  };

  return (
    <div
      className={[
        'operational-control',
        invalid ? 'operational-control--invalid' : '',
        shellClassName,
        className,
      ].filter(Boolean).join(' ')}
    >
      {icon ? <span className="operational-control-icon" aria-hidden="true">{icon}</span> : null}
      {prefix ? <span className="operational-control-prefix" aria-hidden="true">{prefix}</span> : null}
      <input
        ref={inputRef}
        className={`operational-control-input ${inputClassName}`.trim()}
        type={getAppInputHtmlType(variant)}
        inputMode={inputMode ?? getAppInputMode(variant)}
        value={getAppInputDisplayValue(variant, value, displayOptions)}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onMouseDown={handleMouseDown}
        onSelect={handleSelect}
        onBeforeInput={handleBeforeInput}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        maxLength={maxLength}
        aria-invalid={invalid || ariaInvalid}
        {...rest}
      />
      {suffix ? (
        <span
          className={[
            'operational-control-suffix',
            typeof suffix === 'string' ? '' : 'operational-control-suffix--interactive',
          ].filter(Boolean).join(' ')}
          aria-hidden={typeof suffix === 'string' ? true : undefined}
        >
          {suffix}
        </span>
      ) : null}
    </div>
  );
}
