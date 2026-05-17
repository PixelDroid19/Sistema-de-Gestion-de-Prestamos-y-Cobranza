import { useCallback, useEffect, useRef, useState } from 'react';
import type { AuditStreamEvent } from '../types/audit';

const MAX_BUFFER = 200;
const RECONNECT_DELAY_MS = 3_000;

interface UseAuditStreamOptions {
  enabled?: boolean;
  maxEvents?: number;
}

interface UseAuditStreamResult {
  events: AuditStreamEvent[];
  connected: boolean;
  error: string | null;
  clear: () => void;
}

/**
 * Subscribe to the audit SSE stream at `/api/audits/stream`.
 * Buffers the last `maxEvents` events in state for live rendering.
 */
export function useAuditStream({
  enabled = false,
  maxEvents = MAX_BUFFER,
}: UseAuditStreamOptions = {}): UseAuditStreamResult {
  const [events, setEvents] = useState<AuditStreamEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = useCallback(() => setEvents([]), []);

  useEffect(() => {
    if (!enabled) {
      esRef.current?.close();
      esRef.current = null;
      setConnected(false);
      return;
    }

    const connect = () => {
      const es = new EventSource('/api/audits/stream');
      esRef.current = es;

      es.addEventListener('connected', () => {
        setConnected(true);
        setError(null);
      });

      es.addEventListener('audit', (e: MessageEvent) => {
        try {
          const parsed = JSON.parse(e.data) as AuditStreamEvent;
          setEvents((prev) => [parsed, ...prev].slice(0, maxEvents));
        } catch {
          // malformed event — skip
        }
      });

      es.onerror = () => {
        es.close();
        esRef.current = null;
        setConnected(false);
        setError('Connection lost — reconnecting…');
        reconnectTimer.current = setTimeout(connect, RECONNECT_DELAY_MS);
      };
    };

    connect();

    return () => {
      esRef.current?.close();
      esRef.current = null;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      setConnected(false);
    };
  }, [enabled, maxEvents]);

  return { events, connected, error, clear };
}
