import { useEffect, useRef } from 'react';
import { tokenStorage } from '../services/api';

// Deriva a URL do WebSocket a partir da base HTTP (http→ws, https→wss).
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
const WS_URL = BASE_URL.replace(/^http/i, 'ws') + '/ws/calendar';

/**
 * Conecta ao WebSocket do calendário e chama `onChange` sempre que o servidor
 * notifica uma mudança (reserva criada/editada/cancelada por qualquer usuário).
 *
 * - Autentica via token JWT no query param do handshake.
 * - Reconecta automaticamente com backoff exponencial.
 * - Pausa quando a aba está em background e reconecta ao voltar.
 *
 * @param {(msg: object|null) => void} onChange  callback disparado a cada evento
 * @param {boolean} enabled  liga/desliga a conexão (default: true)
 */
export function useCalendarSocket(onChange, enabled = true) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!enabled) return;

    let ws = null;
    let retryTimer = null;
    let attempts = 0;
    let alive = true;

    const connect = () => {
      const token = tokenStorage.get();
      if (!token) {
        // sem token ainda — tenta de novo em breve
        retryTimer = setTimeout(connect, 2000);
        return;
      }

      try {
        ws = new WebSocket(`${WS_URL}?token=${encodeURIComponent(token)}`);
      } catch {
        scheduleReconnect();
        return;
      }

      ws.onopen = () => { attempts = 0; };

      ws.onmessage = (event) => {
        let msg = null;
        try { msg = JSON.parse(event.data); } catch { /* payload não-JSON */ }
        onChangeRef.current?.(msg);
      };

      ws.onclose = () => { if (alive) scheduleReconnect(); };

      ws.onerror = () => { try { ws?.close(); } catch { /* ignore */ } };
    };

    const scheduleReconnect = () => {
      if (!alive) return;
      attempts += 1;
      const delay = Math.min(30000, 1000 * 2 ** Math.min(attempts, 5)); // 2s → 32s, teto 30s
      retryTimer = setTimeout(connect, delay);
    };

    // Reconecta imediatamente quando a aba volta ao foco (após sleep/troca de aba)
    const onVisible = () => {
      if (document.visibilityState === 'visible'
          && (!ws || ws.readyState === WebSocket.CLOSED)) {
        clearTimeout(retryTimer);
        attempts = 0;
        connect();
      }
    };
    document.addEventListener('visibilitychange', onVisible);

    connect();

    return () => {
      alive = false;
      clearTimeout(retryTimer);
      document.removeEventListener('visibilitychange', onVisible);
      if (ws) { ws.onclose = null; try { ws.close(); } catch { /* ignore */ } }
    };
  }, [enabled]);
}
