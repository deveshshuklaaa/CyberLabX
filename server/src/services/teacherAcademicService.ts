import path from 'node:path';
import { constants, promises as fs } from 'node:fs';
import { env } from '../config/env.js';

export interface AcademicAttempt {
  _id: unknown; studentId: unknown; experimentId: unknown; status: string;
  score?: number; startedAt: Date; completedAt?: Date;
  taskResults?: { taskId: string; passed: boolean }[];
}
export interface AcademicReport {
  _id: unknown; studentId: unknown; attemptId: unknown; experimentId: unknown;
  score: number; totalMarks: number; quizScore: number; generatedAt: Date; filePath: string;
}
export interface AcademicExperiment { _id: unknown; title?: string; category?: string; status?: string; }
export const sameId = (a: unknown, b: unknown) => String(a) === String(b);
const finiteScore = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
export const roundPercentage = (value: number) => Math.round(value * 100) / 100;

export function consistentReport(report: AcademicReport, attempt: AcademicAttempt) {
  return attempt.status === 'completed' && sameId(report.attemptId, attempt._id)
    && sameId(report.studentId, attempt.studentId) && sameId(report.experimentId, attempt.experimentId)
    && finiteScore(attempt.score) && report.score === attempt.score && finiteScore(report.totalMarks)
    && report.totalMarks >= report.score && finiteScore(report.quizScore) && report.quizScore <= report.score;
}
export function assessmentScore(attempt: AcademicAttempt, report?: AcademicReport) {
  const value = attempt.status === 'completed' && finiteScore(attempt.score) ? attempt.score : null;
  const known = report && consistentReport(report, attempt);
  const max = known ? report.totalMarks : null;
  return { value, max, percentage: value !== null && max !== null && max > 0 ? roundPercentage(100 * value / max) : null, basis: known ? 'report' as const : 'unknown' as const };
}
export function taskProgress(attempt: AcademicAttempt) {
  return { verifiedTaskCount: new Set((attempt.taskResults ?? []).filter(task => task.passed && typeof task.taskId === 'string').map(task => task.taskId)).size,
    requiredTaskCount: null, percentage: null, basis: 'unknown' as const };
}
export function experimentRef(id: unknown, experiment?: AcademicExperiment) {
  return { id: String(id), title: experiment?.title ?? null, category: experiment?.category?.trim() || null, status: experiment?.status ?? null };
}

/** Open only the deterministic report file for this attempt, never an arbitrary DB path. */
export async function openTeacherReport(report: AcademicReport) {
  let handle: Awaited<ReturnType<typeof fs.open>> | undefined;
  try {
    if (!/^[a-f\d]{24}$/i.test(String(report.attemptId))) return null;
    const root = path.resolve(env.REPORT_DIR);
    const filename = `cyberlabx-report-${report.attemptId}.pdf`;
    const expected = path.join(root, filename);
    if (path.resolve(report.filePath) !== expected) return null;
    const [realRoot, realFile, original] = await Promise.all([fs.realpath(root), fs.realpath(expected), fs.lstat(expected)]);
    if (original.isSymbolicLink() || path.relative(realRoot, realFile) !== filename) return null;
    handle = await fs.open(realFile, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    const opened = await handle.stat();
    if (!opened.isFile() || opened.ino !== original.ino || opened.dev !== original.dev) { await handle.close(); return null; }
    return handle;
  } catch { await handle?.close().catch(() => undefined); return null; }
}
export async function reportAvailable(report: AcademicReport) {
  const handle = await openTeacherReport(report);
  if (!handle) return false;
  await handle.close(); return true;
}

/** Only already-scoped academic projections enter this function, never raw account/quiz data. */
export function academicAnalytics(students: { _id: unknown; isActive: boolean }[], attempts: AcademicAttempt[], reports: AcademicReport[], experiments: AcademicExperiment[], experimentId?: string) {
  const members = new Set(students.map(student => String(student._id)));
  const scoped = attempts.filter(attempt => members.has(String(attempt.studentId)) && (!experimentId || sameId(attempt.experimentId, experimentId)));
  const completed = scoped.filter(attempt => attempt.status === 'completed');
  const reportsByAttempt = new Map(reports.map(report => [String(report.attemptId), report]));
  const attemptsByExperiment = new Map<string, AcademicAttempt[]>();
  for (const attempt of scoped) {
    const key = String(attempt.experimentId), group = attemptsByExperiment.get(key) ?? [];
    group.push(attempt); attemptsByExperiment.set(key, group);
  }
  const published = experiments.filter(experiment => experiment.status === 'published');
  const ids = new Set([...published.map(experiment => String(experiment._id)), ...scoped.map(attempt => String(attempt.experimentId))]);
  const rows = [...ids].filter(id => !experimentId || id === experimentId).sort().map(id => {
    const all = attemptsByExperiment.get(id) ?? [];
    const done = all.filter(attempt => attempt.status === 'completed');
    const scores = done.map(attempt => assessmentScore(attempt, reportsByAttempt.get(String(attempt._id))));
    const raw = scores.flatMap(score => score.value === null ? [] : [score.value]);
    const normalized = scores.flatMap(score => score.percentage === null ? [] : [score.percentage]);
    const completedStudents = new Set(done.map(attempt => String(attempt.studentId))).size;
    return { experiment: experimentRef(id, experiments.find(experiment => sameId(experiment._id, id))), performance: {
      attemptedStudents: new Set(all.map(attempt => String(attempt.studentId))).size, completedStudents,
      attemptCount: all.length, completedAttemptCount: done.length,
      averageScore: raw.length ? Math.round(raw.reduce((a, b) => a + b, 0) / raw.length) : null,
      bestScore: raw.length ? Math.max(...raw) : null,
      normalizedScoreCount: normalized.length, averagePercentage: normalized.length ? roundPercentage(normalized.reduce((a, b) => a + b, 0) / normalized.length) : null,
      completionPercentage: students.length ? roundPercentage(100 * completedStudents / students.length) : null,
    } };
  });
  return { cohort: {
    enrolledStudents: students.length, activeStudents: students.filter(student => student.isActive).length,
    inactiveStudents: students.filter(student => !student.isActive).length,
    attemptedStudents: new Set(scoped.map(attempt => String(attempt.studentId))).size,
    completedStudents: new Set(completed.map(attempt => String(attempt.studentId))).size,
    attemptCount: scoped.length, completedAttemptCount: completed.length,
  }, experiments: rows };
}
