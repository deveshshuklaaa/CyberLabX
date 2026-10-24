import { assessmentScore, consistentReport, reportAvailable, taskProgress } from './teacherAcademicService.js';
import type { AcademicAttempt, AcademicReport } from './teacherAcademicService.js';

export interface StudentAcademicRow {
  attemptId: unknown; experimentId: unknown; status: string; score?: number | null;
  startedAt: Date; completedAt?: Date; taskResults?: AcademicAttempt['taskResults'];
  report?: AcademicReport[]; [key: string]: unknown;
}
/** Rows must come from the authenticated student's projection, never a public selector. */
export async function studentAcademicRows(rows: StudentAcademicRow[], studentId: unknown) {
  return Promise.all(rows.map(async row => {
    const { report: reports, taskResults, ...publicRow } = row;
    delete publicRow.reportId;
    const attempt: AcademicAttempt = { _id: row.attemptId, studentId, experimentId: row.experimentId, status: row.status, score: row.score ?? undefined, startedAt: row.startedAt, completedAt: row.completedAt, taskResults };
    const report = reports?.find(value => consistentReport(value, attempt));
    return { ...publicRow, assessmentScore: assessmentScore(attempt, report), taskProgress: taskProgress(attempt),
      reportAvailable: report ? await reportAvailable(report) : false, reportId: report ? String(report._id) : undefined };
  }));
}
