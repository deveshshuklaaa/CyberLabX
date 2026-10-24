import { useEffect, useRef } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { io, type Socket } from 'socket.io-client';
import '@xterm/xterm/css/xterm.css';

export function Terminal({ labSessionId, targetHostname, onOutput, onConnectionChange }: {
  labSessionId: string; targetHostname: string; onOutput?: (value: string) => void;
  onConnectionChange?: (status: string) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!host.current) return;
    onConnectionChange?.('Connecting');
    const term = new XTerm({ cursorBlink: true, fontFamily: 'JetBrains Mono, monospace', fontSize: 14,
      theme: { background: '#0B0F19', foreground: '#E2E8F0', cursor: '#22C55E' } });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(host.current);
    fit.fit();
    const socket: Socket = io(import.meta.env.VITE_SOCKET_URL ?? 'http://localhost:5000', { withCredentials: true, transports: ['websocket'] });
    let ready = false;
    const resize = () => {
      fit.fit();
      if (ready) socket.emit('terminal:resize', { labSessionId, cols: term.cols, rows: term.rows });
    };
    socket.on('connect', () => {
      ready = false;
      onConnectionChange?.('Joining terminal');
      socket.emit('terminal:join', { labSessionId });
    });
    socket.on('terminal:ready', ({ restored = false, backend }: { restored?: boolean; backend?: 'docker' | 'qemu' } = {}) => {
      ready = true;
      resize();
      onConnectionChange?.('Connected');
      if (!restored) term.write(`\r\n\x1b[32mConnected to ${backend === 'qemu' ? 'real Kali VM (use sudo for SYN and OS scans)' : 'isolated lab'}. Target: ${targetHostname}\x1b[0m\r\n`);
    });
    socket.on('disconnect', () => { ready = false; onConnectionChange?.('Disconnected; waiting to reconnect'); });
    socket.on('connect_error', () => { ready = false; onConnectionChange?.('Connection failed; retrying'); });
    socket.on('terminal:output', (data: string) => { term.write(data); onOutput?.(data); });
    socket.on('terminal:error', ({ message }: { message: string }) => {
      onConnectionChange?.('Terminal error');
      term.write(`\r\n\x1b[31m${message}\x1b[0m\r\n`);
    });
    const input = term.onData(data => { if (ready) socket.emit('terminal:input', { labSessionId, data }); });
    window.addEventListener('resize', resize);
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : undefined;
    observer?.observe(host.current);
    return () => {
      observer?.disconnect(); input.dispose(); window.removeEventListener('resize', resize); socket.disconnect();
      // xterm 5.5 queues viewport resets in animation frames. Drain pending writes
      // and that frame before disposing the renderer those callbacks still use.
      term.write('', () => { window.requestAnimationFrame(() => term.dispose()); });
    };
  }, [labSessionId, onOutput, targetHostname, onConnectionChange]);
  return <div ref={host} className="h-[360px] sm:h-[430px] w-full overflow-hidden rounded-lg p-2 sm:p-3" aria-label="Interactive lab terminal" />;
}
