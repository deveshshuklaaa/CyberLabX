import http from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import os from 'node:os';
import { promises as fs } from 'node:fs';
import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../config/env.js', () => ({ env: { JWT_SECRET: 'academic-test-only-secret', CLIENT_URL: 'http://localhost:5173', LAB_BACKEND: 'docker', REPORT_DIR: '' }, isProduction: false }));
import { app } from '../app.js';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { Attempt } from '../models/Attempt.js';
import { Report } from '../models/Report.js';
import { Experiment } from '../models/Experiment.js';
import { consistentReport } from '../services/teacherAcademicService.js';

// Real HTTP/auth/role middleware, with explicitly mocked MongoDB projections.
// Live database/PDF verification is recorded separately in the Stage 5 report.
const id = (n: number) => new Types.ObjectId(n.toString(16).padStart(24, '0'));
const ids = { teacher: id(1), other: id(2), student: id(3), foreign: id(4), admin: id(5), inactive: id(6), experiment: id(10), attempt: id(20), report: id(30) };
let accounts: any[], attempts: any[], reports: any[], experiments: any[];
let server: http.Server, base: string, root: string;
const pdf = Buffer.from('%PDF-1.4\nunit-test-file-only\n%%EOF');
function matches(row: any, filter: any): boolean {
  return Object.entries(filter).every(([key, value]: [string, any]) => {
    if (key === '$or') return value.some((part: any) => matches(row, part));
    if (value && '$in' in Object(value)) return value.$in.some((item: unknown) => String(row[key]) === String(item));
    if (value && ('$gte' in Object(value) || '$lt' in Object(value))) return (!value.$gte || row[key] >= value.$gte) && (!value.$lt || row[key] < value.$lt);
    return String(row[key]) === String(value);
  });
}
function query(read: () => any) {
  let populate = false;
  let skip = 0, limit = Infinity, order: Record<string, number> = {};
  const result: any = {
    populate: () => { populate = true; return result; },
    select: () => result, lean: () => result,
    sort: (value: Record<string, number>) => { order = value; return result; },
    skip: (value: number) => { skip = value; return result; }, limit: (value: number) => { limit = value; return result; },
    then: (resolve: (value: any) => unknown, reject: (error: unknown) => unknown) => Promise.resolve().then(() => {
      const original = read();
      const rows = populate && original && !Array.isArray(original) ? { ...original, experimentId: experiments.find(e => String(e._id) === String(original.experimentId)), populated: () => original.experimentId } : original;
      return Array.isArray(rows) ? [...rows].sort((a, b) => {
        for (const [key, direction] of Object.entries(order)) { if (a[key] < b[key]) return -direction; if (a[key] > b[key]) return direction; }
        return 0;
      }).slice(skip, skip + limit) : rows;
    }).then(resolve, reject),
  };
  return result;
}
async function call(url: string, actor: keyof typeof ids | null = 'teacher') {
  return fetch(base + '/api' + url, { headers: actor ? { Cookie: `cyberlabx_session=${jwt.sign({ sub: String(ids[actor]), role: 'admin' }, env.JWT_SECRET)}` } : {} });
}
beforeAll(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'cyberlabx-academic-unit-')); env.REPORT_DIR = root;
  await fs.writeFile(path.join(root, `cyberlabx-report-${ids.attempt}.pdf`), pdf);
  server = http.createServer(app); await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => {
  vi.restoreAllMocks(); await new Promise<void>(resolve => server.close(() => resolve()));
  const target = path.resolve(root);
  if (path.dirname(target) !== path.resolve(os.tmpdir()) || !path.basename(target).startsWith('cyberlabx-academic-unit-')) throw new Error('Unexpected fixture cleanup directory');
  await fs.rm(target, { recursive: true, force: true });
});
beforeEach(() => {
  vi.restoreAllMocks();
  accounts = Object.entries(ids).filter(([name]) => !['experiment', 'attempt', 'report'].includes(name)).map(([name, _id]) => ({ _id, role: ['teacher', 'other'].includes(name) ? 'faculty' : name === 'admin' ? 'admin' : 'student', isActive: name !== 'inactive', ...(name === 'student' || name === 'inactive' ? { teacherId: ids.teacher } : name === 'foreign' ? { teacherId: ids.other } : {}) }));
  attempts = [{ _id: ids.attempt, studentId: ids.student, experimentId: ids.experiment, status: 'completed', score: 0, startedAt: new Date('2026-10-01T10:00:00Z'), completedAt: new Date('2026-10-01T11:00:00Z'), taskResults: [{ taskId: 'one', passed: true }, { taskId: 'one', passed: true }, { taskId: 'two', passed: false }], quizAnswers: ['secret-answer'], containerId: 'secret-container' }];
  reports = [{ _id: ids.report, studentId: ids.student, attemptId: ids.attempt, experimentId: ids.experiment, score: 0, totalMarks: 75, quizScore: 0, generatedAt: new Date('2026-10-01T11:00:00Z'), filePath: path.join(root, `cyberlabx-report-${ids.attempt}.pdf`) }];
  experiments = [{ _id: ids.experiment, title: 'Nmap', category: 'Network', status: 'published' }];
  vi.spyOn(User, 'findById').mockImplementation(((value: unknown) => query(() => accounts.find(row => String(row._id) === String(value)))) as any);
  vi.spyOn(User, 'exists').mockImplementation((async (filter: any) => accounts.some(row => matches(row, filter)) ? { _id: ids.student } : null) as any);
  vi.spyOn(User, 'find').mockImplementation(((filter: any) => query(() => accounts.filter(row => matches(row, filter)))) as any);
  vi.spyOn(Attempt, 'find').mockImplementation(((filter: any) => query(() => attempts.filter(row => matches(row, filter)))) as any);
  vi.spyOn(Attempt, 'countDocuments').mockImplementation(((filter: any) => query(() => attempts.filter(row => matches(row, filter)).length)) as any);
  vi.spyOn(Attempt, 'findOne').mockImplementation(((filter: any) => query(() => attempts.find(row => matches(row, filter)))) as any);
  vi.spyOn(Report, 'find').mockImplementation(((filter: any) => query(() => reports.filter(row => matches(row, filter)))) as any);
  vi.spyOn(Report, 'findOne').mockImplementation(((filter: any) => query(() => reports.find(row => matches(row, filter)))) as any);
  vi.spyOn(Report, 'aggregate').mockImplementation(((pipeline: any[]) => query(() => {
    const selected = reports.filter(row => matches(row, pipeline[0].$match) && attempts.some(attempt => consistentReport(row, attempt)));
    const facet = pipeline.at(-1).$facet;
    const skip = facet.rows.find((step: any) => step.$skip !== undefined).$skip;
    const limit = facet.rows.find((step: any) => step.$limit !== undefined).$limit;
    return [{ rows: selected.slice(skip, skip + limit), count: [{ total: selected.length }], invalid: reports.filter(row => matches(row, pipeline[0].$match) && !attempts.some(attempt => consistentReport(row, attempt))).slice(0, 1) }];
  })) as any);
  vi.spyOn(Experiment, 'find').mockImplementation(((filter: any) => query(() => experiments.filter(row => matches(row, filter)))) as any);
  vi.spyOn(Attempt, 'aggregate').mockImplementation(((pipeline: any[]) => query(() => {
    const selected = attempts.filter(row => matches(row, pipeline[0].$match));
    const project = (row: any) => ({ attemptId: row._id, experimentId: row.experimentId, experimentTitle: experiments.find(e => String(e._id) === String(row.experimentId))?.title, status: row.status, score: row.status === 'completed' ? row.score : null, startedAt: row.startedAt, completedAt: row.completedAt, taskResults: row.taskResults, report: reports.filter(r => String(r.studentId) === String(row.studentId) && String(r.attemptId) === String(row._id)) });
    if (!pipeline[1]?.$facet) return selected.map(project);
    const done = selected.filter(row => row.status === 'completed'); const best = [...new Set(done.map(row => String(row.experimentId)))].map(exp => Math.max(...done.filter(row => String(row.experimentId) === exp).map(row => row.score)));
    return [{ attempted: [{ count: new Set(selected.map(row => String(row.experimentId))).size }], completedScores: [{ count: best.length, averageScore: best.length ? best.reduce((a,b) => a+b,0)/best.length : 0, bestScore: best.length ? Math.max(...best) : 0 }], publishedCompleted: [{ count: new Set(done.filter(row => experiments.some(e => e.status === 'published' && String(e._id) === String(row.experimentId))).map(row => String(row.experimentId))).size }], recentAttempts: selected.slice(0,5).map(project) }];
  })) as any);
  vi.spyOn(Experiment, 'countDocuments').mockImplementation(((filter: any) => query(() => experiments.filter(row => matches(row, filter)).length)) as any);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});


describe('student product reads (real HTTP; mocked MongoDB, temporary unit PDF)', () => {
  it('projects catalogue category and task counts, with blank categories null', async () => {
    experiments[0].category = ' Network '; experiments[0].tasks = [{ id: 'one' }];
    let body = await (await call('/experiments', 'student')).json(); expect(body.experiments[0]).toMatchObject({ category: 'Network', taskCount: 1 }); expect(body.experiments[0].tasks).toBeUndefined();
    experiments[0].category = ' '; body = await (await call('/experiments', 'student')).json(); expect(body.experiments[0].category).toBeNull();
    expect(Experiment.find).toHaveBeenCalledWith({ status: 'published' });
  });
  it('adds historical score/task fields and real availability to own history and recent activity', async () => {
    attempts[0].score = 75; reports[0].score = 75;
    for (const url of ['/student/history', '/student/dashboard']) {
      const response = await call(url, 'student'); expect(response.status).toBe(200); const body = await response.json(); const row = (body.attempts ?? body.recentAttempts)[0];
      expect(row).toMatchObject({ assessmentScore: { value: 75, max: 75, percentage: 100 }, taskProgress: { verifiedTaskCount: 1, requiredTaskCount: null, percentage: null }, reportAvailable: true });
      expect(JSON.stringify(body)).not.toMatch(/filePath|quizAnswers|containerId|taskResults/); expect(response.headers.get('cache-control')).toBe('private, no-store');
    }
  });
  it('uses published intersection instead of archived completions as the curriculum numerator', async () => {
    attempts[0].score = 75; reports[0].score = 75; attempts.push({ ...attempts[0], _id: id(24), experimentId: id(98), score: 100 });
    const body = await (await call('/student/dashboard', 'student')).json(); expect(body).toMatchObject({ scoreUnit: 'points', stats: { experimentsCompleted: 2, publishedExperimentsCompleted: 1, totalExperiments: 1, averageScore: 88, bestScore: 100 } });
  });
  it('shows genuine completed zero, unknown legacy maxima, and ungraded other states', async () => {
    reports = []; let body = await (await call('/student/history', 'student')).json(); expect(body.attempts[0].assessmentScore).toEqual({ value: 0, max: null, percentage: null, basis: 'unknown' });
    for (const status of ['running', 'failed', 'expired']) { attempts[0].status = status; attempts[0].score = 99; body = await (await call('/student/history', 'student')).json(); expect(body.attempts[0].assessmentScore.value).toBeNull(); expect(body.attempts[0].reportAvailable).toBe(false); }
  });
  it('does not let foreign or inconsistent reports supply maxima or availability', async () => {
    reports[0].studentId = ids.foreign; const body = await (await call('/student/history', 'student')).json(); expect(body.attempts[0]).toMatchObject({ reportAvailable: false, assessmentScore: { max: null } });
    expect((await call(`/reports/${ids.report}/download`, 'student')).status).toBe(404);
  });
  it('restores own attempt with verified task IDs and sanitized experiment answers', async () => {
    const response = await call(`/attempts/${ids.attempt}`, 'student'); expect(response.status).toBe(200); const body = await response.json(); expect(body.attempt).toMatchObject({ verifiedTaskIds: ['one'], assessmentScore: { max: 75 }, taskProgress: { requiredTaskCount: null } }); expect(JSON.stringify(body)).not.toMatch(/quizAnswers|containerId|filePath/);
  });
  it('keeps metadata when the temporary PDF disappears and denies download', async () => {
    const filename = path.join(root, `cyberlabx-report-${ids.attempt}.pdf`); await fs.unlink(filename);
    try { const history = await (await call('/student/history', 'student')).json(); expect(history.attempts[0]).toMatchObject({ reportAvailable: false, reportId: String(ids.report), assessmentScore: { max: 75 } }); const meta = await (await call(`/reports/${ids.report}`, 'student')).json(); expect(meta.report.available).toBe(false); expect((await call(`/reports/${ids.report}/download`, 'student')).status).toBe(404); }
    finally { await fs.writeFile(filename, pdf); }
  });
  it('serves the exact bound PDF privately and rejects an in-root substitute', async () => {
    const response = await call(`/reports/${ids.report}/download`, 'student'); expect(response.status).toBe(200); expect(response.headers.get('cache-control')).toBe('private, no-store'); expect(Buffer.from(await response.arrayBuffer())).toEqual(pdf);
    reports[0].filePath = path.join(root, 'substitute.pdf'); await fs.writeFile(reports[0].filePath, pdf); expect((await call(`/reports/${ids.report}/download`, 'student')).status).toBe(404);
  });
  it.each(['teacher', 'admin'] as const)('preserves student-only history, attempt and report role guards for %s', async actor => {
    for (const url of ['/student/history', '/student/dashboard', `/attempts/${ids.attempt}`, `/reports/${ids.report}`, `/reports/${ids.report}/download`]) expect((await call(url, actor)).status).toBe(403);
  });
  it('rejects unauthenticated reads and foreign attempt IDs', async () => {
    expect((await call('/student/history', null)).status).toBe(401); expect((await call(`/attempts/${id(99)}`, 'student')).status).toBe(404);
  });
});
