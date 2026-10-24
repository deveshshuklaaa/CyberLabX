import { api } from '../../services/api';
import type { StudentHistoryAttempt } from '../../types/api';

export function ReportLink({ attempt }: { attempt: StudentHistoryAttempt }) {
  if (!attempt.reportAvailable || !attempt.reportId) return <span className="text-xs text-muted">Report unavailable</span>;
  return <a className="button-secondary text-sm" href={`${api.defaults.baseURL}/reports/${encodeURIComponent(attempt.reportId)}/download`} target="_blank" rel="noreferrer" aria-label={`Download report for ${attempt.experimentTitle || 'experiment'} (${attempt.attemptId})`}>Download report</a>;
}
