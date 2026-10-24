import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

/** Native modal provides focus containment, background isolation and Escape support. */
export function ConfirmDialog({ label, onCancel, children }: { label: string; onCancel: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', '');
    return () => { if (dialog.open && typeof dialog.close === 'function') dialog.close(); };
  }, []);
  return <dialog ref={ref} aria-label={label} className="m-auto w-[calc(100%-2rem)] max-w-lg max-h-[85vh] overflow-y-auto rounded-xl border border-line bg-white p-5 text-ink shadow-xl backdrop:bg-ink/50" onCancel={event => { event.preventDefault(); onCancel(); }}>{children}</dialog>;
}
