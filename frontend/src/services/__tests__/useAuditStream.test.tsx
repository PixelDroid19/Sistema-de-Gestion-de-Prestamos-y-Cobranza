import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuditStream } from '../useAuditStream';

class MockEventSource {
  static instances: MockEventSource[] = [];

  onerror: (() => void) | null = null;

  constructor(public readonly url: string) {
    MockEventSource.instances.push(this);
  }

  addEventListener = vi.fn();
  close = vi.fn();
}

describe('useAuditStream', () => {
  beforeEach(() => {
    window.localStorage.clear();
    MockEventSource.instances = [];
    vi.useFakeTimers();
    vi.stubGlobal('EventSource', MockEventSource);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('resolves reconnect errors from the active locale', () => {
    window.localStorage.setItem('app.locale', 'en');

    const { result } = renderHook(() => useAuditStream({ enabled: true }));

    act(() => {
      MockEventSource.instances[0].onerror?.();
    });

    expect(result.current.connected).toBe(false);
    expect(result.current.error).toBe('Connection lost. Reconnecting...');
  });
});
