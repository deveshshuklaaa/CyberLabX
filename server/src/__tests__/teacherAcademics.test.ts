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
import { academicAnalytics, assessmentScore, consistentReport, openTeacherReport, taskProgress } from '../services/teacherAcademicService.js';

// Real HTTP/auth/role middleware, with explicitly mocked MongoDB projections.
// Live database/PDF verification is recorded separately in the Stage 5 report.
const id = (n: number) => new Types.ObjectId(n.toString(16).padStart(24, '0'));
const ids = { teacher: id(1), other: id(2), student: id(3), foreign: id(4), admin: id(5), inactive: id(6), experiment: id(10), attempt: id(20), report: id(30) };
let accounts: any[], attempts: any[], reports: any[], experiments: any[];
let server: http.Server, base: string, root: string;
const pdf = Buffer.from('%PDF-1.4\nunit-test-file-only\n%%EOF');
const studentPath = `/teacher/students/${ids.student}`;
function matches(row: any, filter: any): boolean {
  return Object.entries(filter).every(([key, value]: [string, any]) => {
    if (key === '$or') return value.some((part: any) => matches(row, part));
    if (value && '$in' in Object(value)) return value.$in.some((item: unknown) => String(row[key]) === String(item));
    if (value && ('$gte' in Object(value) || '$lt' in Object(value))) return (!value.$gte || row[key] >= value.$gte) && (!value.$lt || row[key] < value.$lt);
    return String(row[key]) === String(value);
  });
}
function query(read: () => any) {
  let skip = 0, limit = Infinity, order: Record<string, number> = {};
  const result: any = {
    select: () => result, lean: () => result,
    sort: (value: Record<string, number>) => { order = value; return result; },
    skip: (value: number) => { skip = value; return result; }, limit: (value: number) => { limit = value; return result; },
    then: (resolve: (value: any) => unknown, reject: (error: unknown) => unknown) => Promise.resolve().then(() => {
      const rows = read();
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
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

describe('teacher academic authorization and reads', () => {
  const paths = () => [`${studentPath}/attempts`, `${studentPath}/reports`, `${studentPath}/reports/${ids.report}/download`, '/teacher/analytics/experiments'];
  it.each([null, 'student', 'admin'] as const)('protects every route from %s, using the database role', async actor => {
    for (const url of paths()) expect((await call(url, actor)).status).toBe(actor === null ? 401 : 403);
    expect(Attempt.find).not.toHaveBeenCalled(); expect(Report.find).not.toHaveBeenCalled();
  });
  it('returns identical 404s for foreign, removed and nonexistent students', async () => {
    for (const studentId of [ids.foreign, id(999), ids.student]) {
      if (String(studentId) === String(ids.student)) delete accounts.find(row => row.role === 'student' && String(row._id) === String(ids.student)).teacherId;
      for (const suffix of ['/attempts', '/reports', `/reports/${ids.report}/download`]) {
        const response = await call(`/teacher/students/${studentId}${suffix}`);
        expect(response.status).toBe(404); expect(await response.json()).toEqual({ message: 'Academic record unavailable.', code: 'NOT_FOUND' });
      }
    }
    expect(Report.findOne).not.toHaveBeenCalled();
  });
  it('exposes safe completed history, genuine zero and recorded maximum only', async () => {
    const response = await call(`${studentPath}/attempts`); expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.attempts[0]).toMatchObject({ assessmentScore: { value: 0, max: 75, percentage: 0, basis: 'report' }, taskProgress: { verifiedTaskCount: 1, requiredTaskCount: null }, report: { available: true } });
    expect(body.pagination).toEqual({ page: 1, limit: 25, total: 1 });
    expect(JSON.stringify(body)).not.toMatch(/quizAnswers|filePath|secret|containerId/);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });
  it.each(['running', 'failed', 'expired'])('shows %s without a fabricated grade or report', async status => {
    attempts[0].status = status; attempts[0].score = 99;
    const body = await (await call(`${studentPath}/attempts?status=${status}`)).json();
    expect(body.attempts[0]).toMatchObject({ status, assessmentScore: { value: null, max: null, percentage: null }, report: null });
  });
  it('filters before counting, supports exclusive dates and bounded pagination', async () => {
    expect((await (await call(`${studentPath}/attempts?status=failed`)).json()).pagination.total).toBe(0);
    expect((await (await call(`${studentPath}/attempts?to=2026-10-01T10:00:00Z`)).json()).pagination.total).toBe(0);
    const body = await (await call(`${studentPath}/attempts?page=2&limit=1&experimentId=${ids.experiment}`)).json();
    expect(body.attempts).toEqual([]); expect(body.pagination).toEqual({ page: 2, limit: 1, total: 1 });
  });
  it.each(['page=0', 'page=10001', 'limit=101', 'status=bogus', 'status=failed&status=running', 'unknown=1', 'experimentId=bad', 'from=2026-10-01T00:00:00Z&to=2026-10-01T00:00:00.000Z'])('rejects malformed history query %s', async query => {
    expect((await call(`${studentPath}/attempts?${query}`)).status).toBe(400);
  });
  it('lists consistent reports without paths and downloads the actual allowed file', async () => {
    const list = await (await call(`${studentPath}/reports`)).json();
    expect(list.reports[0]).toMatchObject({ id: String(ids.report), available: true, score: 0, totalMarks: 75 });
    expect(JSON.stringify(list)).not.toContain('filePath');
    const response = await call(list.reports[0].downloadUrl.replace('/api', ''));
    expect(response.status).toBe(200); expect(response.headers.get('content-type')).toContain('application/pdf');
    expect(response.headers.get('content-disposition')).toContain(String(ids.report));
    expect(Buffer.from(await response.arrayBuffer())).toEqual(pdf);
  });
  it('excludes inconsistent report references before pagination and denies direct download', async () => {
    reports[0].studentId = ids.foreign;
    expect((await (await call(`${studentPath}/reports`)).json()).pagination.total).toBe(0);
    expect((await call(`${studentPath}/reports/${ids.report}/download`)).status).toBe(404);
    reports[0].studentId = ids.student; reports[0].totalMarks = -1;
    expect((await call(`${studentPath}/reports/${ids.report}/download`)).status).toBe(404);
    expect((await (await call(`${studentPath}/reports`)).json()).reports).toEqual([]);
    expect(console.warn).toHaveBeenCalledWith('Inconsistent teacher academic report reference excluded.');
  });
  it('preserves missing-file metadata but denies download and arbitrary paths', async () => {
    reports[0].filePath = path.join(root, 'different.pdf'); await fs.writeFile(reports[0].filePath, pdf);
    expect((await (await call(`${studentPath}/reports`)).json()).reports[0].available).toBe(false);
    expect((await call(`${studentPath}/reports/${ids.report}/download`)).status).toBe(404);
    reports[0].filePath = path.join(root, '..', 'outside.pdf'); expect(await openTeacherReport(reports[0])).toBeNull();
  });
  it('denies a report whose real path escapes the report root', async () => {
    const realpath = fs.realpath.bind(fs);
    vi.spyOn(fs, 'realpath').mockImplementation(((value: any) => String(value).endsWith('.pdf') ? Promise.resolve(path.join(root, '..', 'outside.pdf')) : realpath(value)) as any);
    expect(await openTeacherReport(reports[0])).toBeNull();
  });
  it.each(['/attempts', '/reports', `/reports/${ids.report}/download`])('rechecks ownership immediately before response for %s', async suffix => {
    vi.mocked(User.exists).mockResolvedValueOnce({ _id: ids.student }).mockResolvedValueOnce(null);
    const response = await call(studentPath + suffix); expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).not.toContain('application/pdf');
  });
  it('keeps student-only attempts and report downloads forbidden for faculty', async () => {
    expect((await call(`/attempts/${ids.attempt}`)).status).toBe(403);
    expect((await call(`/reports/${ids.attempt}/download`)).status).toBe(403);
  });
  it('supports faculty aliases with exactly the same ownership enforcement', async () => {
    expect((await call(studentPath.replace('/teacher', '/faculty') + '/attempts')).status).toBe(200);
    expect((await call(studentPath.replace('/teacher', '/faculty') + '/reports', 'other')).status).toBe(404);
    expect((await call('/faculty/analytics/experiments', 'admin')).status).toBe(403);
  });
  it('returns current cohort metrics and excludes every foreign student', async () => {
    attempts.push({ ...attempts[0], _id: id(21), studentId: ids.foreign, score: 100 });
    const body = await (await call('/teacher/analytics/experiments')).json();
    expect(body.cohort).toMatchObject({ enrolledStudents: 2, activeStudents: 1, inactiveStudents: 1, attemptCount: 1 });
    expect(body.experiments[0].performance).toMatchObject({ averageScore: 0, bestScore: 0, averagePercentage: 0, normalizedScoreCount: 1, completionPercentage: 50 });
    expect(Attempt.find).toHaveBeenCalledWith({ studentId: { $in: [ids.student, ids.inactive] } });
  });
  it('returns an honest empty cohort and retries only after explicit membership-change response', async () => {
    accounts = accounts.filter(row => row.role !== 'student');
    const body = await (await call('/teacher/analytics/experiments')).json();
    expect(body.cohort.enrolledStudents).toBe(0); expect(body.experiments[0].performance).toMatchObject({ averageScore: null, completionPercentage: null });
    vi.mocked(User.find).mockImplementationOnce((() => query(() => [{ _id: ids.student, isActive: true }])) as any).mockImplementationOnce((() => query(() => [])) as any);
    const response = await call('/teacher/analytics/experiments'); expect(response.status).toBe(409); expect((await response.json()).code).toBe('COHORT_CHANGED');
  });
});

describe('teacher score and completion denominators', () => {
  it('uses valid historical maxima, excludes ungraded attempts, and retains unknown legacy totals', () => {
    expect(assessmentScore({ ...attempts[0], score: 50 })).toEqual({ value: 50, max: null, percentage: null, basis: 'unknown' });
    expect(assessmentScore({ ...attempts[0], status: 'running', score: 100 }, reports[0]).value).toBeNull();
    expect(assessmentScore({ ...attempts[0], score: NaN }).value).toBeNull();
    expect(taskProgress(attempts[0])).toEqual({ verifiedTaskCount: 1, requiredTaskCount: null, percentage: null, basis: 'unknown' });
  });
  it('counts repeats as attempts, students once, includes inactive members, and reports normalized coverage', () => {
    const second = { ...attempts[0], _id: id(21), score: 50 }, legacy = { ...attempts[0], _id: id(22), score: 100 };
    const data = academicAnalytics([{ _id: ids.student, isActive: true }, { _id: ids.inactive, isActive: false }], [attempts[0], second, legacy, { ...second, studentId: ids.foreign }], [reports[0], { ...reports[0], attemptId: second._id, score: 50, totalMarks: 100 }], experiments);
    expect(data.cohort).toMatchObject({ attemptedStudents: 1, completedStudents: 1, attemptCount: 3 });
    expect(data.experiments[0].performance).toMatchObject({ averageScore: 50, bestScore: 100, averagePercentage: 25, normalizedScoreCount: 2, completionPercentage: 50 });
  });
  it('retains historical references to deleted experiments without inventing catalogue metadata', () => {
    const data = academicAnalytics([{ _id: ids.student, isActive: true }], attempts, [], []);
    expect(data.experiments[0].experiment).toEqual({ id: String(ids.experiment), title: null, category: null, status: null });
    expect(data.experiments[0].performance.averagePercentage).toBeNull();
  });
});
