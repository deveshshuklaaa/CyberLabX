import { AlertCircle, LoaderCircle } from 'lucide-react';

export function LoadingState({ message }: { message: string }) {
  return <div className="state-panel" role="status"><LoaderCircle size={24} aria-hidden="true" className="mx-auto mb-3 animate-spin text-brand" /><p className="text-sm text-muted">{message}</p></div>;
}

export function ErrorState({ message, onRetry, retrying = false }: { message: string; onRetry: () => void; retrying?: boolean }) {
  return <div className="error-panel" role="alert">
    <p className="flex items-center gap-2 text-sm font-semibold text-danger"><AlertCircle size={20} aria-hidden="true" />{message}</p>
    <button type="button" className="button-secondary mt-4" onClick={onRetry} disabled={retrying}>{retrying ? 'Retrying...' : 'Try again'}</button>
  </div>;
}
