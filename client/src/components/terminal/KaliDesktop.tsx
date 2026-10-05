import { useEffect, useRef, useState } from 'react';
import RFB from '@novnc/novnc';

export function KaliDesktop({ labSessionId }: { labSessionId: string }) {
  const host = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState('Connecting to Kali desktop…');
  useEffect(() => {
    if (!host.current) return;
    const endpoint = new URL(import.meta.env.VITE_SOCKET_URL ?? 'http://localhost:5000');
    endpoint.protocol = endpoint.protocol === 'https:' ? 'wss:' : 'ws:';
    endpoint.pathname = `/desktop/${labSessionId}`;
    const rfb = new RFB(host.current, endpoint.toString());
    rfb.scaleViewport = true;
    rfb.addEventListener('connect', () => setStatus('Kali desktop connected'));
    rfb.addEventListener('disconnect', () => setStatus('Desktop disconnected. Close and reopen to reconnect.'));
    rfb.addEventListener('securityfailure', () => setStatus('Desktop authentication failed.'));
    return () => rfb.disconnect();
  }, [labSessionId]);
  return <section className="panel p-3 space-y-2">
    <p role="status" className="text-xs">{status}</p>
    <div ref={host} className="h-[600px] bg-black" aria-label="Kali Linux desktop" />
  </section>;
}

