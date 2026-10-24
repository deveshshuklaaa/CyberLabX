import type { StudentHistoryAttempt } from '../../types/api';

export function AttemptStatus({ status }: { status: StudentHistoryAttempt['status'] | 'not-started' }) {
  const labels = { completed: 'Completed', running: 'In progress', expired: 'Expired', failed: 'Failed', 'not-started': 'Not started' };
  const styles = { completed: 'status-success', running: 'status-warning', expired: 'status-neutral', failed: 'status-danger', 'not-started': 'status-neutral' };
  return <span className={`status-badge ${styles[status]}`}>{labels[status]}</span>;
}
