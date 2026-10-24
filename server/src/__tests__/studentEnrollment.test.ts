import http from 'node:http';
import type { AddressInfo } from 'node:net';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../config/env.js', () => ({ env: {
  JWT_SECRET: 'enrollment-test-session-secret-only', JWT_EXPIRES_IN: '7d', BCRYPT_ROUNDS: 4,
  CLIENT_URL: 'http://localhost:5173', LAB_BACKEND: 'docker',
}, isProduction: false }));
vi.mock('express-rate-limit', () => ({ default: () => (_req: unknown, _res: unknown, next: () => void) => next() }));

import { app } from '../app.js';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { Attempt } from '../models/Attempt.js';
import { Report } from '../models/Report.js';
import { AuditEvent } from '../models/AuditEvent.js';

// Real Express routing, cookies, JWT verification and role middleware; MongoDB is mocked.
// Atomicity is checked through the conditional update and competing HTTP requests,
// not claimed as live MongoDB validation.
const id = (value: number) => new Types.ObjectId(value.toString(16).padStart(24, '0'));
const ids = { teacherA: id(1), teacherB: id(2), admin: id(3), studentA: id(10), studentB: id(11), available: id(12), inactive: id(13), inactiveAvailable: id(14) };
type Actor = keyof typeof ids;
let accounts: any[];
let attempts: any[];
let reports: any[];
let server: http.Server;
let base: string;

function matches(record: any, filter: any) {
  return Object.entries(filter).every(([key, value]: [string, any]) => {
    if (value === null) return record[key] == null;
    if (value && '$in' in Object(value)) return value.$in.some((item: unknown) => String(item) === String(record[key]));
    return String(record[key]) === String(value);
  });
}

function query(read: () => any) {
  let skip = 0; let limit = Infinity;
  const result: any = {
    select: vi.fn(() => result), sort: vi.fn(() => result), lean: vi.fn(() => result),
    skip: vi.fn((value: number) => { skip = value; return result; }),
    limit: vi.fn((value: number) => { limit = value; return result; }),
    then(resolve: (value: any) => unknown, reject: (error: unknown) => unknown) {
      return Promise.resolve().then(() => {
        const value = read();
        return Array.isArray(value) ? value.slice(skip, skip + limit) : value;
      }).then(resolve, reject);
    },
  };
  return result;
}

function updateAccount(filter: any, update: any) {
  const account = accounts.find(candidate => matches(candidate, filter));
  if (!account) return null;
  Object.assign(account, update.$set);
  for (const key of Object.keys(update.$unset ?? {})) delete account[key];
  return account;
}

function session(actor: Actor, options: jwt.SignOptions = {}) {
  // An elevated JWT claim must never override the current database role.
  return `cyberlabx_session=${jwt.sign({ sub: String(ids[actor]), role: 'admin' }, env.JWT_SECRET, options)}`;
}

async function call(path: string, options: { as?: Actor | null; method?: string; body?: unknown; cookie?: string } = {}) {
  const cookie = options.cookie ?? (options.as === null ? '' : session(options.as ?? 'teacherA'));
  return fetch(base + '/api' + path, { method: options.method ?? 'GET', headers: {
    ...(cookie ? { Cookie: cookie } : {}), ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
  }, body: options.body === undefined ? undefined : JSON.stringify(options.body) });
}

const studentPath = (actor: Actor) => `/teacher/students/${ids[actor]}`;
const adminPath = (teacher: Actor = 'teacherA') => `/admin/teachers/${ids[teacher]}/students`;
const account = (actor: Actor) => accounts.find(value => String(value._id) === String(ids[actor]));

beforeAll(async () => {
  server = http.createServer(app);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  vi.restoreAllMocks();
});
beforeEach(() => {
  vi.restoreAllMocks();
  accounts = Object.entries(ids).map(([name, _id]) => ({
    _id, firstName: name, lastName: 'Test', email: `${name.toLowerCase()}@example.test`,
    role: name === 'admin' ? 'admin' : name.startsWith('teacher') ? 'faculty' : 'student',
    isActive: !name.startsWith('inactive'), passwordHash: 'never-expose-password-hash', googleId: 'never-expose-google-subject',
  }));
  Object.assign(account('studentA'), { teacherId: ids.teacherA, enrolledAt: new Date('2026-10-20T10:00:00Z') });
  Object.assign(account('studentB'), { teacherId: ids.teacherB, enrolledAt: new Date('2026-10-20T10:00:00Z') });
  Object.assign(account('inactive'), { teacherId: ids.teacherA, enrolledAt: new Date('2026-10-20T10:00:00Z') });
  attempts = [
    { studentId: ids.studentA, status: 'completed', score: 80 }, { studentId: ids.studentA, status: 'completed', score: 90 },
    { studentId: ids.studentA, status: 'running', score: 99 }, { studentId: ids.studentB, status: 'completed', score: 100 },
  ];
  reports = [{ studentId: ids.studentA }, { studentId: ids.studentA }, { studentId: ids.studentB }];
  vi.spyOn(User, 'findById').mockImplementation(((value: unknown) => query(() => accounts.find(row => String(row._id) === String(value)) ?? null)) as any);
  vi.spyOn(User, 'findOne').mockImplementation(((filter: any) => query(() => accounts.find(row => matches(row, filter)) ?? null)) as any);
  vi.spyOn(User, 'find').mockImplementation(((filter: any) => query(() => accounts.filter(row => matches(row, filter)))) as any);
  vi.spyOn(User, 'exists').mockImplementation((async (filter: any) => {
    const found = accounts.find(row => matches(row, filter)); return found ? { _id: found._id } : null;
  }) as any);
  vi.spyOn(User, 'countDocuments').mockImplementation(((filter: any) => query(() => accounts.filter(row => matches(row, filter)).length)) as any);
  vi.spyOn(User, 'findOneAndUpdate').mockImplementation(((filter: any, update: any) => query(() => updateAccount(filter, update))) as any);
  vi.spyOn(User, 'findByIdAndUpdate').mockImplementation(((value: unknown, update: any) => query(() => updateAccount({ _id: value }, update))) as any);
  vi.spyOn(User, 'create').mockImplementation((async (value: any) => {
    const created = { ...value, _id: id(100), isActive: true }; accounts.push(created); return created;
  }) as any);
  vi.spyOn(Attempt, 'countDocuments').mockImplementation(((filter: any) => query(() => attempts.filter(row => matches(row, filter)).length)) as any);
  vi.spyOn(Attempt, 'aggregate').mockImplementation(((pipeline: any[]) => query(() => {
    const selected = attempts.filter(row => matches(row, pipeline[0].$match));
    const completed = selected.filter(row => row.status === 'completed');
    const average = completed.length ? completed.reduce((sum, row) => sum + row.score, 0) / completed.length : 0;
    return selected.length ? [{ average, attempts: selected.length, completedAttempts: completed.length, averageScore: average, bestScore: Math.max(0, ...completed.map(row => row.score)) }] : [];
  })) as any);
  vi.spyOn(Report, 'countDocuments').mockImplementation(((filter: any = {}) => query(() => reports.filter(row => matches(row, filter)).length)) as any);
  vi.spyOn(AuditEvent, 'create').mockResolvedValue({} as any);
  // The existing error handler logs expected Zod failures; keep these negative tests quiet.
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('teacher enrollment over HTTP', () => {
  it('lists only owned students, includes inactive status, and omits credentials', async () => {
    const response = await call('/teacher/students');
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.pagination).toEqual({ page: 1, limit: 25, total: 2 });
    expect(body.students.map((row: any) => row.student.id)).toEqual([String(ids.studentA), String(ids.inactive)]);
    expect(body.students.map((row: any) => row.enrollment.status)).toEqual(['active', 'inactive']);
    expect(JSON.stringify(body)).not.toMatch(/passwordHash|googleId|never-expose/);
  });
  it('supports the existing faculty alias and bounded pagination', async () => {
    const response = await call('/faculty/students?page=2&limit=1');
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.pagination).toEqual({ page: 2, limit: 1, total: 2 });
    expect(body.students).toHaveLength(1);
  });
  it('enrolls by existing student ID, assigning the authenticated teacher and time', async () => {
    const response = await call('/teacher/students', { method: 'POST', body: { studentId: String(ids.available) } });
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.student).toMatchObject({ id: String(ids.available), role: 'student', isActive: true });
    expect(body.enrollment).toMatchObject({ teacherId: String(ids.teacherA), status: 'active', enrolledAt: expect.any(String) });
    expect(User.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: String(ids.available), role: 'student', isActive: true, teacherId: null },
      { $set: { teacherId: ids.teacherA, enrolledAt: expect.any(Date) } }, { new: true, runValidators: true },
    );
    expect(User.create).not.toHaveBeenCalled();
  });
  it('identifies an existing account by exact, normalized email without a directory API', async () => {
    const response = await call('/faculty/students', { method: 'POST', body: { email: ' Available@Example.Test ' } });
    expect(response.status).toBe(201);
    expect((await response.json()).student.id).toBe(String(ids.available));
  });
  it('returns only owned student information and safe progress totals', async () => {
    const response = await call(studentPath('studentA'));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.progress).toEqual({ attempts: 3, completedAttempts: 2, averageScore: 85, bestScore: 90 });
    expect(Attempt.aggregate).toHaveBeenCalledWith(expect.arrayContaining([{ $match: { studentId: ids.studentA } }]));
    expect(JSON.stringify(body)).not.toMatch(/passwordHash|googleId|correctOption|filePath|containerId/);
  });
  it('returns zero progress for an enrolled student without attempts', async () => {
    const response = await call(studentPath('inactive'));
    expect((await response.json()).progress).toEqual({ attempts: 0, completedAttempts: 0, averageScore: 0, bestScore: 0 });
  });
  it('unenrolls without deleting the account, attempts, reports or existing session', async () => {
    const response = await call(studentPath('studentA'), { method: 'DELETE' });
    expect(response.status).toBe(204); expect(await response.text()).toBe('');
    expect(account('studentA')).toMatchObject({ role: 'student', isActive: true });
    expect(account('studentA').teacherId).toBeUndefined(); expect(account('studentA').enrolledAt).toBeUndefined();
    expect(attempts).toHaveLength(4); expect(reports).toHaveLength(3);
    expect((await call('/auth/me', { as: 'studentA' })).status).toBe(200);
    expect(await (await call('/student/enrollment', { as: 'studentA' })).json()).toEqual({ enrollment: null });
  });
  it('lets an owning teacher remove an inactive student', async () => {
    expect((await call(studentPath('inactive'), { method: 'DELETE' })).status).toBe(204);
  });
  it('rejects duplicate enrollment without changing its original timestamp', async () => {
    const enrolledAt = account('studentA').enrolledAt;
    const response = await call('/teacher/students', { method: 'POST', body: { studentId: String(ids.studentA) } });
    expect(response.status).toBe(409); expect(account('studentA').enrolledAt).toBe(enrolledAt);
  });
  it('rejects enrollment by a second teacher without exposing the current teacher', async () => {
    const response = await call('/teacher/students', { method: 'POST', body: { studentId: String(ids.studentB) } });
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ message: 'Student is already enrolled.' });
    expect(account('studentB').teacherId).toEqual(ids.teacherB);
  });
  it('permits only one winner for competing requests using the atomic assignment predicate', async () => {
    const responses = await Promise.all(['teacherA', 'teacherB'].map(as => call('/teacher/students', {
      as: as as Actor, method: 'POST', body: { studentId: String(ids.available) },
    })));
    expect(responses.map(response => response.status).sort()).toEqual([201, 409]);
    expect([String(ids.teacherA), String(ids.teacherB)]).toContain(String(account('available').teacherId));
  });
  it('allows enrollment by another teacher only after the existing owner removes it', async () => {
    await call(studentPath('studentA'), { method: 'DELETE' });
    const response = await call('/teacher/students', { as: 'teacherB', method: 'POST', body: { studentId: String(ids.studentA) } });
    expect(response.status).toBe(201); expect(account('studentA').teacherId).toEqual(ids.teacherB);
  });
  it.each(['studentB', 'available'] as Actor[])('hides student %s and denies deleting their enrollment', async actor => {
    expect((await call(studentPath(actor))).status).toBe(404);
    expect((await call(studentPath(actor), { method: 'DELETE' })).status).toBe(404);
    expect(Attempt.aggregate).not.toHaveBeenCalled();
  });
  it('rejects removing a missing enrollment and a repeated removal', async () => {
    expect((await call(`/teacher/students/${id(999)}`, { method: 'DELETE' })).status).toBe(404);
    expect((await call(studentPath('studentA'), { method: 'DELETE' })).status).toBe(204);
    expect((await call(studentPath('studentA'), { method: 'DELETE' })).status).toBe(404);
  });
  it.each(['teacherB', 'admin', 'inactiveAvailable'] as Actor[])('rejects ineligible account %s without exposing its profile', async actor => {
    const response = await call('/teacher/students', { method: 'POST', body: { studentId: String(ids[actor]) } });
    expect(response.status).toBe(404); expect(await response.json()).toEqual({ message: 'Eligible student not found.' });
  });
  it('rejects nonexistent IDs and partial email searches without creating accounts', async () => {
    for (const body of [{ studentId: String(id(999)) }, { email: 'missing@example.test' }]) {
      expect((await call('/teacher/students', { method: 'POST', body })).status).toBe(404);
    }
    expect(User.create).not.toHaveBeenCalled();
    expect((await call('/teacher/students', { method: 'POST', body: { email: 'available' } })).status).toBe(400);
  });
  it.each([
    {}, { studentId: 'invalid' }, { studentId: { $ne: null } },
    { studentId: String(ids.available), teacherId: String(ids.teacherB) },
    { studentId: String(ids.available), role: 'admin' },
    { studentId: String(ids.available), email: 'available@example.test' },
  ])('rejects malformed or authority-bearing bodies: %j', async body => {
    const response = await call('/teacher/students', { method: 'POST', body });
    expect(response.status).toBe(400); expect(await response.json()).toEqual({ message: 'Invalid request data.' });
    expect(User.findOneAndUpdate).not.toHaveBeenCalled();
  });
  it('rejects invalid path IDs and unbounded or authority-bearing list queries', async () => {
    for (const suffix of ['?limit=101', '?page=0', '?limit=no', `?teacherId=${ids.teacherB}`]) {
      expect((await call('/teacher/students' + suffix)).status).toBe(400);
    }
    for (const method of ['GET', 'DELETE']) expect((await call('/teacher/students/invalid', { method })).status).toBe(400);
  });
});

describe('enrollment session and role authorization', () => {
  it('rejects missing, invalid, expired and disabled sessions before data access', async () => {
    for (const cookie of ['', 'cyberlabx_session=invalid', session('teacherA', { expiresIn: -1 })]) {
      expect((await call('/teacher/students', { cookie })).status).toBe(401);
    }
    account('teacherA').isActive = false;
    expect((await call('/teacher/students')).status).toBe(401);
    expect(User.find).not.toHaveBeenCalled(); expect(User.findOneAndUpdate).not.toHaveBeenCalled();
  });
  it.each(['studentA', 'studentB'] as Actor[])('student %s cannot enroll themselves or anyone else, despite a forged role claim', async as => {
    for (const target of [as, 'available'] as Actor[]) {
      expect((await call('/teacher/students', { as, method: 'POST', body: { studentId: String(ids[target]) } })).status).toBe(403);
    }
    expect((await call(studentPath('studentB'), { as })).status).toBe(403);
    expect((await call(studentPath('studentA'), { as, method: 'DELETE' })).status).toBe(403);
    expect(User.findOneAndUpdate).not.toHaveBeenCalled();
  });
  it.each(['teacherA', 'studentA'] as Actor[])('rejects %s on admin management endpoints', async as => {
    expect((await call(adminPath(), { as })).status).toBe(403);
    expect((await call(adminPath(), { as, method: 'POST', body: { studentId: String(ids.available) } })).status).toBe(403);
    expect((await call(adminPath() + `/${ids.studentA}`, { as, method: 'DELETE' })).status).toBe(403);
  });
  it.each(['teacherA', 'admin'] as Actor[])('rejects %s on student-only enrollment access', async as => {
    expect((await call('/student/enrollment', { as })).status).toBe(403);
  });
  it('does not let admin impersonate a teacher through the faculty endpoint', async () => {
    expect((await call('/teacher/students', { as: 'admin' })).status).toBe(403);
  });
  it('does not accept an arbitrary student ID on the own-enrollment endpoint', async () => {
    const response = await call(`/student/enrollment?studentId=${ids.studentB}`, { as: 'studentA' });
    expect((await response.json()).enrollment.teacherId).toBe(String(ids.teacherA));
    expect((await call(`/student/enrollment/${ids.studentB}`, { as: 'studentA' })).status).toBe(404);
  });
  it('creates an authenticated Student with a normalized email and hashed password', async () => {
    const response = await call('/auth/register', { as: null, method: 'POST', body: {
      firstName: ' New ', lastName: ' Student ', email: ' New@Example.Test ', password: 'long-enough-test-password',
    } });
    expect(response.status).toBe(201);
    expect(response.headers.getSetCookie().some(cookie => cookie.includes('HttpOnly') && cookie.startsWith('cyberlabx_session='))).toBe(true);
    const created = accounts.find(row => row.email === 'new@example.test');
    expect(created).toMatchObject({ firstName: 'New', lastName: 'Student', role: 'student', isActive: true });
    expect(created.password).toBeUndefined();
    expect(created.passwordHash).not.toBe('long-enough-test-password');
    expect(await bcrypt.compare('long-enough-test-password', created.passwordHash)).toBe(true);
    expect(JSON.stringify(await response.json())).not.toMatch(/password|hash/i);
  });
  it('rejects public registration fields that could assign privileges or enrollment', async () => {
    for (const extra of [{ role: 'admin' }, { role: 'faculty' }, { teacherId: String(ids.teacherA) }, { enrolledAt: new Date().toISOString() }]) {
      const response = await call('/auth/register', { as: null, method: 'POST', body: {
        firstName: 'New', lastName: 'Student', email: 'new@example.test', password: 'long-enough-test-password', ...extra,
      } });
      expect(response.status).toBe(400);
    }
    expect(accounts.some(row => row.email === 'new@example.test')).toBe(false);
  });
  it('returns a clear conflict for existing emails and uniqueness races', async () => {
    const existing = await call('/auth/register', { as: null, method: 'POST', body: {
      firstName: 'Existing', lastName: 'Student', email: 'studenta@example.test', password: 'long-enough-test-password',
    } });
    expect(existing.status).toBe(409);
    expect(await existing.json()).toEqual({ message: 'An account with this email already exists.' });

    vi.mocked(User.create).mockRejectedValueOnce(Object.assign(new Error('duplicate key'), { code: 11000 }));
    const race = await call('/auth/register', { as: null, method: 'POST', body: {
      firstName: 'Racing', lastName: 'Student', email: 'race@example.test', password: 'long-enough-test-password',
    } });
    expect(race.status).toBe(409);
    expect(await race.json()).toEqual({ message: 'An account with this email already exists.' });
  });
});

describe('student and admin enrollment access', () => {
  it('returns only the authenticated student enrollment and safe teacher information', async () => {
    const response = await call('/student/enrollment', { as: 'studentA' });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ enrollment: {
      teacherId: String(ids.teacherA), status: 'active', enrolledAt: '2026-10-20T10:00:00.000Z',
      teacher: { id: String(ids.teacherA), firstName: 'teacherA', lastName: 'Test', email: 'teachera@example.test', isActive: true },
    } });
  });
  it('returns null for an unassigned student', async () => {
    expect(await (await call('/student/enrollment', { as: 'available' })).json()).toEqual({ enrollment: null });
  });
  it('marks a disabled or no-longer-faculty teacher assignment inactive', async () => {
    account('teacherA').isActive = false;
    expect((await (await call('/student/enrollment', { as: 'studentA' })).json()).enrollment.status).toBe('inactive');
    account('teacherA').role = 'admin';
    const body = await (await call('/student/enrollment', { as: 'studentA' })).json();
    expect(body.enrollment).toMatchObject({ teacherId: String(ids.teacherA), status: 'inactive', teacher: null });
  });
  it('lets admins list, view, enroll and remove for a specified teacher', async () => {
    expect((await call(adminPath(), { as: 'admin' })).status).toBe(200);
    expect((await call(adminPath() + `/${ids.studentA}`, { as: 'admin' })).status).toBe(200);
    const enrolled = await call(adminPath('teacherB'), { as: 'admin', method: 'POST', body: { studentId: String(ids.available) } });
    expect(enrolled.status).toBe(201); expect(account('available').teacherId).toEqual(ids.teacherB);
    expect((await call(adminPath('teacherB') + `/${ids.available}`, { as: 'admin', method: 'DELETE' })).status).toBe(204);
    expect(account('available')).toBeDefined();
  });
  it('does not let admin bypass duplicate ownership or mismatch a teacher-student pair', async () => {
    expect((await call(adminPath(), { as: 'admin', method: 'POST', body: { studentId: String(ids.studentB) } })).status).toBe(409);
    expect((await call(adminPath() + `/${ids.studentB}`, { as: 'admin' })).status).toBe(404);
    expect((await call(adminPath() + `/${ids.studentB}`, { as: 'admin', method: 'DELETE' })).status).toBe(404);
    expect(account('studentB').teacherId).toEqual(ids.teacherB);
  });
  it('rejects non-faculty, missing, inactive and malformed admin teacher targets', async () => {
    for (const teacherId of [ids.studentA, id(999)]) {
      expect((await call(`/admin/teachers/${teacherId}/students`, { as: 'admin', method: 'POST', body: { studentId: String(ids.available) } })).status).toBe(404);
    }
    expect((await call('/admin/teachers/invalid/students', { as: 'admin' })).status).toBe(400);
    account('teacherA').isActive = false;
    expect((await call(adminPath(), { as: 'admin', method: 'POST', body: { studentId: String(ids.available) } })).status).toBe(404);
    const body = await (await call(adminPath(), { as: 'admin' })).json();
    expect(body.students.every((row: any) => row.enrollment.status === 'inactive')).toBe(true);
  });
  it('allows admins to release an assignment after the teacher is deleted', async () => {
    accounts = accounts.filter(row => String(row._id) !== String(ids.teacherA));
    expect((await call(adminPath() + `/${ids.studentA}`, { as: 'admin', method: 'DELETE' })).status).toBe(204);
    expect(account('studentA').teacherId).toBeUndefined();
  });
  it('preserves student assignment when promotion is blocked by the atomic management gate', async () => {
    const response = await call(`/admin/users/${ids.studentA}`, { as: 'admin', method: 'PATCH', body: { role: 'faculty', expectedManagementVersion: 0 } });
    expect(response.status).toBe(503); expect(account('studentA').teacherId).toEqual(ids.teacherA); expect(account('studentA').enrolledAt).toBeInstanceOf(Date);
  });
  it('retains assignment when disabling is blocked, still allowing explicit removal', async () => {
    expect((await call(`/admin/users/${ids.studentA}`, { as: 'admin', method: 'PATCH', body: { isActive: false, expectedManagementVersion: 0 } })).status).toBe(503);
    expect(account('studentA').isActive).toBe(true);
    expect(account('studentA').teacherId).toEqual(ids.teacherA);
    expect((await call(studentPath('studentA'), { method: 'DELETE' })).status).toBe(204);
  });
});

describe('faculty metrics respect enrollment ownership', () => {
  it.each(['/teacher/dashboard', '/faculty/dashboard'])('scopes %s without changing the metrics contract', async path => {
    const response = await call(path);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ metrics: { students: 1, completedAttempts: 2, averageScore: 85, reports: 2 } });
    expect(User.find).toHaveBeenCalledWith({ role: 'student', teacherId: ids.teacherA });
    expect(Report.countDocuments).toHaveBeenCalledWith({ studentId: { $in: [ids.studentA, ids.inactive] } });
  });
  it('returns zero cohort metrics after all own students are unenrolled', async () => {
    delete account('studentA').teacherId; delete account('inactive').teacherId;
    expect(await (await call('/teacher/dashboard')).json()).toEqual({ metrics: { students: 0, completedAttempts: 0, averageScore: 0, reports: 0 } });
  });
  it('preserves platform-wide metrics for admins', async () => {
    const body = await (await call('/teacher/dashboard', { as: 'admin' })).json();
    expect(body.metrics).toEqual({ students: 3, completedAttempts: 3, averageScore: 90, reports: 3 });
    expect(User.find).not.toHaveBeenCalled(); expect(Report.countDocuments).toHaveBeenCalledWith({});
  });
});
