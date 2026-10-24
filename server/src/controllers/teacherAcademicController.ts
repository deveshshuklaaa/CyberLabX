import type { Request, RequestHandler, Response } from 'express';
import { pipeline } from 'node:stream/promises';
import { Types } from 'mongoose';
import { z } from 'zod';
import { User } from '../models/User.js';
import { Attempt } from '../models/Attempt.js';
import { Report } from '../models/Report.js';
import { Experiment } from '../models/Experiment.js';
import { academicAnalytics, assessmentScore, consistentReport, experimentRef, openTeacherReport, reportAvailable, sameId, taskProgress } from '../services/teacherAcademicService.js';
import type { AcademicAttempt, AcademicReport } from '../services/teacherAcademicService.js';

const id = z.string().regex(/^[a-f\d]{24}$/i).transform(value => value.toLowerCase());
const integer = (max: number, fallback: string) => z.string().regex(/^[1-9]\d*$/).default(fallback).transform(Number).pipe(z.number().int().min(1).max(max));
const filters = { page: integer(10000, '1'), limit: integer(100, '25'), experimentId: id.optional(), from: z.string().datetime().optional(), to: z.string().datetime().optional() };
const range = (input: { from?: string; to?: string }) => !input.from || !input.to || Date.parse(input.from) < Date.parse(input.to);
const historyQuery = z.object({ ...filters, status: z.enum(['running', 'completed', 'expired', 'failed']).optional() }).strict().refine(range);
const reportQuery = z.object(filters).strict().refine(range);
class AcademicError extends Error { constructor(readonly status: number, readonly code: string, message: string) { super(message); } }
const unavailable = () => new AcademicError(404, 'NOT_FOUND', 'Academic record unavailable.');

// New routes have additive error codes; existing auth/enrollment/student contracts are untouched.
const route = (handler: (req: Request, res: Response) => Promise<void>): RequestHandler => async (req, res) => {
  try { res.setHeader('Cache-Control', 'private, no-store'); await handler(req, res); }
  catch (error) {
    if (res.headersSent) { res.destroy(); return; }
    if (error instanceof AcademicError) { res.status(error.status).json({ message: error.message, code: error.code }); return; }
    if (error instanceof z.ZodError) { res.status(400).json({ message: 'Invalid request data.', code: 'INVALID_REQUEST' }); return; }
    console.error('Teacher academic read failed.');
    res.status(500).json({ message: 'Academic data is temporarily unavailable.', code: 'INTERNAL_ERROR' });
  }
};
async function owned(req: Request, studentId: string) {
  if (!await User.exists({ _id: studentId, role: 'student', teacherId: req.user!._id })) throw unavailable();
}
function dateFilter(from?: string, to?: string) { return from || to ? { ...(from ? { $gte: new Date(from) } : {}), ...(to ? { $lt: new Date(to) } : {}) } : undefined; }
const attemptFields = '_id studentId experimentId status score startedAt completedAt taskResults.taskId taskResults.passed';
const reportFields = '_id studentId attemptId experimentId score totalMarks quizScore generatedAt filePath';
const integrityWarning = () => console.warn('Inconsistent teacher academic report reference excluded.');

export const teacherAttempts = route(async (req, res) => {
  const studentId = id.parse(req.params.studentId), query = historyQuery.parse(req.query);
  await owned(req, studentId);
  const dates = dateFilter(query.from, query.to);
  const filter = { studentId: new Types.ObjectId(studentId), ...(query.status ? { status: query.status } : {}), ...(query.experimentId ? { experimentId: new Types.ObjectId(query.experimentId) } : {}), ...(dates ? { startedAt: dates } : {}) };
  const [attempts, total] = await Promise.all([Attempt.find(filter).select(attemptFields).sort({ startedAt: -1, _id: -1 }).skip((query.page - 1) * query.limit).limit(query.limit).lean(), Attempt.countDocuments(filter)]);
  const [reports, experiments] = await Promise.all([
    Report.find({ studentId, attemptId: { $in: attempts.map(attempt => attempt._id) } }).select(reportFields).lean(),
    Experiment.find({ _id: { $in: attempts.map(attempt => attempt.experimentId) } }).select('_id title category status').lean(),
  ]);
  const rows = await Promise.all(attempts.map(async attempt => {
    const report = reports.find(item => consistentReport(item, attempt));
    if (!report && reports.some(item => sameId(item.attemptId, attempt._id))) integrityWarning();
    return { id: String(attempt._id), experiment: experimentRef(attempt.experimentId, experiments.find(item => sameId(item._id, attempt.experimentId))), status: attempt.status,
      startedAt: attempt.startedAt, completedAt: attempt.completedAt ?? null, assessmentScore: assessmentScore(attempt, report), taskProgress: taskProgress(attempt),
      report: report ? { id: String(report._id), available: await reportAvailable(report) } : null };
  }));
  await owned(req, studentId);
  res.json({ studentId, scope: 'current-enrollment-all-history', attempts: rows, pagination: { page: query.page, limit: query.limit, total } });
});

export const teacherReports = route(async (req, res) => {
  const studentId = id.parse(req.params.studentId), query = reportQuery.parse(req.query);
  await owned(req, studentId);
  const dates = dateFilter(query.from, query.to);
  const match = { studentId: new Types.ObjectId(studentId), ...(query.experimentId ? { experimentId: new Types.ObjectId(query.experimentId) } : {}), ...(dates ? { generatedAt: dates } : {}) };
  // Integrity filtering is before pagination/count; malformed references never inflate totals.
  const valid = { 'attempt.status': 'completed', score: { $gte: 0, $lte: Number.MAX_VALUE }, totalMarks: { $gte: 0, $lte: Number.MAX_VALUE }, quizScore: { $gte: 0, $lte: Number.MAX_VALUE }, $expr: { $and: [
      { $eq: ['$studentId', '$attempt.studentId'] }, { $eq: ['$experimentId', '$attempt.experimentId'] }, { $eq: ['$score', '$attempt.score'] }, { $lte: ['$score', '$totalMarks'] }, { $lte: ['$quizScore', '$score'] },
    ] } };
  const [result] = await Report.aggregate([
    { $match: match },
    { $lookup: { from: 'attempts', localField: 'attemptId', foreignField: '_id', as: 'attempt' } }, { $unwind: { path: '$attempt', preserveNullAndEmptyArrays: true } },
    { $facet: {
      rows: [{ $match: valid }, { $sort: { generatedAt: -1, _id: -1 } }, { $skip: (query.page - 1) * query.limit }, { $limit: query.limit }, { $project: { attempt: 0 } }],
      count: [{ $match: valid }, { $count: 'total' }],
      invalid: [{ $match: { $nor: [valid] } }, { $limit: 1 }],
    } },
  ]);
  if (result?.invalid?.length) integrityWarning();
  const reports: AcademicReport[] = result?.rows ?? [];
  const experiments = await Experiment.find({ _id: { $in: reports.map(report => report.experimentId) } }).select('_id title category status').lean();
  const rows = await Promise.all(reports.map(async report => {
    const available = await reportAvailable(report);
    return { id: String(report._id), attemptId: String(report.attemptId), experiment: experimentRef(report.experimentId, experiments.find(item => sameId(item._id, report.experimentId))), generatedAt: report.generatedAt,
      score: report.score, totalMarks: report.totalMarks, quizScore: report.quizScore, available,
      downloadUrl: available ? `/api/teacher/students/${studentId}/reports/${report._id}/download` : null };
  }));
  await owned(req, studentId);
  res.json({ studentId, reports: rows, pagination: { page: query.page, limit: query.limit, total: result?.count?.[0]?.total ?? 0 } });
});

export const teacherReportDownload = route(async (req, res) => {
  const studentId = id.parse(req.params.studentId), reportId = id.parse(req.params.reportId);
  z.object({}).strict().parse(req.query); await owned(req, studentId);
  const report = await Report.findOne({ _id: reportId, studentId }).select(reportFields).lean();
  if (!report) throw unavailable();
  const attempt = await Attempt.findOne({ _id: report.attemptId, studentId }).select(attemptFields).lean();
  if (!attempt || !consistentReport(report, attempt)) { integrityWarning(); throw unavailable(); }
  const handle = await openTeacherReport(report);
  if (!handle) throw unavailable();
  try { await owned(req, studentId); }
  catch (error) { await handle.close(); throw error; }
  res.type('application/pdf'); res.attachment(`CyberLabX-report-${reportId}.pdf`);
  await pipeline(handle.createReadStream(), res);
});

export const teacherAnalytics = route(async (req, res) => {
  const query = reportQuery.parse(req.query), teacherId = req.user!._id;
  const students = await User.find({ role: 'student', teacherId }).select('_id isActive').lean();
  const dates = dateFilter(query.from, query.to);
  const attempts: AcademicAttempt[] = await Attempt.find({ studentId: { $in: students.map(student => student._id) }, ...(query.experimentId ? { experimentId: new Types.ObjectId(query.experimentId) } : {}), ...(dates ? { startedAt: dates } : {}) }).select(attemptFields).lean();
  const [reports, experiments] = await Promise.all([
    Report.find({ studentId: { $in: students.map(student => student._id) }, attemptId: { $in: attempts.map(attempt => attempt._id) } }).select(reportFields).lean(),
    Experiment.find({ $or: [{ status: 'published' }, { _id: { $in: attempts.map(attempt => attempt.experimentId) } }] }).select('_id title category status').lean(),
  ]);
  const data = academicAnalytics(students, attempts, reports, experiments, query.experimentId);
  // A membership/active-state change during the read requires a fresh request, not stale scope.
  const current = await User.find({ role: 'student', teacherId }).select('_id isActive').lean();
  const signature = (members: typeof students) => members.map(student => `${student._id}:${student.isActive}`).sort().join(',');
  if (signature(students) !== signature(current)) throw new AcademicError(409, 'COHORT_CHANGED', 'Cohort changed while loading. Refresh the overview.');
  res.json({ scope: { teacherId: String(teacherId), membership: 'current', includeInactive: true, history: 'includes-before-enrollment', from: query.from ?? null, to: query.to ?? null },
    cohort: data.cohort, experiments: data.experiments.slice((query.page - 1) * query.limit, query.page * query.limit), pagination: { page: query.page, limit: query.limit, total: data.experiments.length } });
});
