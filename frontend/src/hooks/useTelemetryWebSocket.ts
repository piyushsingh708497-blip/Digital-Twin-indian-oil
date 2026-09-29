// OIL-TWIN AI - Native Real-Time Telemetry WebSocket Hook
// Manages safe reconnecting WebSocket connection to /ws/telemetry/{wellId}

import { useEffect, useRef } from 'react';
import { getTelemetryWsUrl } from '../services/api';
import { useAppStore } from '../store/useAppStore';
import type { Telemetry } from '../types';

export function useTelemetryWebSocket(wellId: string) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const staleTimerRef = useRef<number | null>(null);
  const reconnectAttemptsRef = useRef(0);

  const { setWsStatus, setLastTelemetry } = useAppStore();

  useEffect(() => {
    let isMounted = true;

    function resetStaleTimer() {
      if (staleTimerRef.current) {
        window.clearTimeout(staleTimerRef.current);
      }
      staleTimerRef.current = window.setTimeout(() => {
        if (isMounted) {
          setWsStatus('stale');
        }
      }, 9000); // After ~9 seconds without frame, mark as stale
    }

    function connect() {
      if (!isMounted) return;

      // Close any previous socket
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }

      setWsStatus('connecting');
      const url = getTelemetryWsUrl(wellId);

      try {
        const ws = new WebSocket(url);
        wsRef.current = ws;

        ws.onopen = () => {
          if (!isMounted) {
            ws.close();
            return;
          }
          reconnectAttemptsRef.current = 0;
          setWsStatus('connected');
          resetStaleTimer();
        };

        ws.onmessage = (event) => {
          if (!isMounted) return;
          try {
            const data = JSON.parse(event.data);
            if (data.error) {
              console.warn(`[WS ${wellId}] Server error:`, data.error);
              return;
            }
            if (data.ts && data.srp && data.surface) {
              setLastTelemetry(data as Telemetry);
              setWsStatus('connected');
              resetStaleTimer();
            }
          } catch (err) {
            console.error(`[WS ${wellId}] Frame decode error:`, err);
          }
        };

        ws.onerror = () => {
          if (!isMounted) return;
          // Trigger reconnect in onclose
        };

        ws.onclose = () => {
          if (!isMounted) return;
          setWsStatus('reconnecting');
          if (staleTimerRef.current) {
            window.clearTimeout(staleTimerRef.current);
          }

          // Exponential backoff reconnect: 1s, 2s, 3s, max 5s
          const delay = Math.min(1000 * Math.pow(1.5, reconnectAttemptsRef.current), 5000);
          reconnectAttemptsRef.current += 1;

          reconnectTimeoutRef.current = window.setTimeout(() => {
            connect();
          }, delay);
        };
      } catch (err) {
        console.error(`[WS ${wellId}] Connection init error:`, err);
        setWsStatus('offline');
      }
    }

    connect();

    return () => {
      isMounted = false;
      if (reconnectTimeoutRef.current) {
        window.clearTimeout(reconnectTimeoutRef.current);
      }
      if (staleTimerRef.current) {
        window.clearTimeout(staleTimerRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [wellId, setWsStatus, setLastTelemetry]);
}
