import { useQueryClient } from '@tanstack/react-query';
import { PdfDownloadLink } from './PdfDownloadLink';
import type { StudentHistoryAttempt } from '../../types/api';

export function ReportLink({ attempt }: { attempt: StudentHistoryAttempt }) {
  const client = useQueryClient();
  if (attempt.status !== 'completed' || !attempt.reportAvailable || !attempt.reportId) return <span className="text-xs text-muted">Report unavailable</span>;
  return <PdfDownloadLink reportId={attempt.reportId} ariaLabel={`Download report for ${attempt.experimentTitle || 'experiment'} (${attempt.attemptId})`} onUnavailable={() => { void client.invalidateQueries({ queryKey: ['student-history'] }); void client.invalidateQueries({ queryKey: ['student-dashboard'] }); }} />;
}
