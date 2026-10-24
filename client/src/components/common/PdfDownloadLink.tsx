import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { api } from '../../services/api';

export function PdfDownloadLink({ reportId, label = 'Download report', ariaLabel, testId, onUnavailable }: { reportId: string; label?: string; ariaLabel?: string; testId?: string; onUnavailable?: () => void }) {
  const [pending, setPending] = useState(false), [error, setError] = useState('');
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const path = `/reports/${encodeURIComponent(reportId)}/download`;
  const download = async () => {
    if (pending) return; setPending(true); setError('');
    try {
      const response = await api.get<Blob>(path, { responseType: 'blob' });
      if (!active.current) return;
      if (!String(response.headers['content-type']).includes('application/pdf')) throw new Error('Invalid PDF');
      const url = URL.createObjectURL(response.data), anchor = document.createElement('a');
      anchor.href = url; anchor.download = `CyberLabX-report-${reportId}.pdf`; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (failure) {
      if (!active.current) return;
      const status = axios.isAxiosError(failure) ? failure.response?.status : undefined;
      setError(status === 404 ? 'The report file is unavailable. Refresh history to check its current availability.' : status === 401 || status === 403 ? 'Your session cannot access this report. Sign in again or refresh your account.' : 'PDF download failed. Check your connection and try again.');
      if (status === 404) onUnavailable?.();
    } finally { if (active.current) setPending(false); }
  };
  return <span className="inline-flex flex-col items-start gap-2"><a className="button-secondary text-sm" href={`${api.defaults.baseURL ?? '/api'}${path}`} target="_blank" rel="noreferrer" aria-label={ariaLabel} aria-disabled={pending} data-testid={testId} onClick={event => { event.preventDefault(); void download(); }}>{pending ? 'Downloading PDF...' : label}</a>{error && <span role="alert" className="text-xs text-danger text-left max-w-xs">{error}</span>}</span>;
}
