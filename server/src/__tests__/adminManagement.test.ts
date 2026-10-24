import http from 'node:http';
import type { AddressInfo } from 'node:net';
import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../config/env.js', () => ({ env: { JWT_SECRET: 'admin-management-test-secret', CLIENT_URL: 'http://localhost:5173', LAB_BACKEND: 'docker' }, isProduction: false }));
import { app } from '../app.js';
import { User } from '../models/User.js';
import { AuditEvent } from '../models/AuditEvent.js';
import { env } from '../config/env.js';
import { auditChanges } from '../services/adminManagementService.js';
const id = (n: number) => new Types.ObjectId(n.toString(16).padStart(24, '0'));
let users: any[], events: any[], server: http.Server, base: string;
function matches(row: any, filter: any): boolean {
  return Object.entries(filter).every(([key, value]: [string, any]) => {
    if (key === '$or') return value.some((part: any) => matches(row, part));
    if (value && '$regex' in Object(value)) return new RegExp(value.$regex, value.$options).test(row[key]);
    if (value && ('$gte' in Object(value) || '$lt' in Object(value))) return (!value.$gte || row[key] >= value.$gte) && (!value.$lt || row[key] < value.$lt);
    return String(row[key]) === String(value);
  });
}
function query(read: () => any) {
  let skip = 0, limit = Infinity, sort: Record<string, number> = {};
  const result: any = { select: () => result, lean: () => result, sort: (value: Record<string, number>) => { sort = value; return result; }, skip: (value: number) => { skip = value; return result; }, limit: (value: number) => { limit = value; return result; },
    then: (resolve: (value: any) => unknown, reject: (error: unknown) => unknown) => Promise.resolve().then(() => {
      const rows = read(); if (!Array.isArray(rows)) return rows;
      return [...rows].sort((a, b) => { for (const [key, order] of Object.entries(sort)) { if (a[key] < b[key]) return -order; if (a[key] > b[key]) return order; } return 0; }).slice(skip, skip + limit);
    }).then(resolve, reject) };
  return result;
}
async function call(path: string, options: { actor?: number | null; method?: string; body?: unknown } = {}) {
  const actor = options.actor === undefined ? 1 : options.actor;
  return fetch(base + '/api/admin' + path, { method: options.method ?? 'GET', headers: { ...(actor === null ? {} : { Cookie: `cyberlabx_session=${jwt.sign({ sub: String(id(actor)), role: 'admin' }, env.JWT_SECRET)}` }), ...(options.body ? { 'Content-Type': 'application/json' } : {}) }, ...(options.body ? { body: JSON.stringify(options.body) } : {}) });
}
beforeAll(async () => { server = http.createServer(app); await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve)); base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`; });
afterAll(async () => { vi.restoreAllMocks(); await new Promise<void>(resolve => server.close(() => resolve())); });
beforeEach(() => {
  vi.restoreAllMocks();
  users = [1, 2, 3, 4, 5].map(n => ({ _id: id(n), firstName: n === 5 ? 'Literal .*' : `User${n}`, lastName: 'Example', email: `user${n}@example.test`, role: n <= 2 ? 'admin' : n === 3 ? 'faculty' : 'student', isActive: n !== 5, teacherId: n === 4 ? id(3) : undefined, enrolledAt: n === 4 ? new Date('2026-10-01T00:00:00Z') : undefined, createdAt: new Date('2026-10-01T00:00:00Z'), updatedAt: new Date('2026-10-01T00:00:00Z'), passwordHash: 'private-hash', googleId: 'private-google-subject' }));
  events = Array.from({ length: 27 }, (_, n) => ({ _id: id(100 + n), action: n % 2 ? 'user.created' : 'user.updated', userId: id(1), resourceType: 'User', resourceId: String(id(4)), createdAt: new Date('2026-10-01T00:00:00Z'), metadata: n === 0 ? { before: { role: 'student' }, after: { role: 'faculty' }, password: 'private-credential' } : { role: 'faculty', password: 'private-credential' }, ip: 'private-ip', userAgent: 'private-agent' }));
  vi.spyOn(User, 'findById').mockImplementation(((value: unknown) => query(() => users.find(row => String(row._id) === String(value)) ?? null)) as any);
  vi.spyOn(User, 'exists').mockImplementation((async (filter: any) => users.some(row => matches(row, filter)) ? { _id: id(1) } : null) as any);
  vi.spyOn(User, 'find').mockImplementation(((filter: any = {}) => query(() => users.filter(row => matches(row, filter)))) as any);
  vi.spyOn(User, 'countDocuments').mockImplementation(((filter: any = {}) => query(() => users.filter(row => matches(row, filter)).length)) as any);
  vi.spyOn(AuditEvent, 'find').mockImplementation(((filter: any = {}) => query(() => events.filter(row => matches(row, filter)))) as any);
  vi.spyOn(AuditEvent, 'countDocuments').mockImplementation(((filter: any = {}) => query(() => events.filter(row => matches(row, filter)).length)) as any);
  vi.spyOn(User, 'create'); vi.spyOn(User, 'findByIdAndUpdate'); vi.spyOn(User, 'findOneAndUpdate'); vi.spyOn(AuditEvent, 'create');
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});
describe('admin directory, detail and audit reads', () => {
  it.each([null, 3, 4, 5])('rejects actor %s before privileged reads/writes', async actor => {
    for (const path of ['/users', `/users/${id(4)}`, '/audit-events']) expect((await call(path, { actor })).status).toBe(actor === null || actor === 5 ? 401 : 403);
    for (const [path, method] of [['/users', 'POST'], [`/users/${id(4)}`, 'PATCH']]) expect((await call(path, { actor, method, body: {} })).status).toBe(actor === null || actor === 5 ? 401 : 403);
    expect(User.find).not.toHaveBeenCalled(); expect(AuditEvent.find).not.toHaveBeenCalled();
  });
  it('returns deterministic paginated directory with safe DTOs and honest unavailable management', async () => {
    const response = await call('/users?page=2&limit=2'); const body = await response.json(); expect(response.status).toBe(200);
    expect(body.pagination).toEqual({ page: 2, limit: 2, total: 5 }); expect(body.users.map((user: any) => user.id)).toEqual([String(id(3)), String(id(4))]);
    expect(body.users[1]).toMatchObject({ teacherId: String(id(3)), managementVersion: null }); expect(body.management.writesAvailable).toBe(false);
    expect(JSON.stringify(body)).not.toMatch(/passwordHash|googleId|private-/); expect(response.headers.get('cache-control')).toBe('private, no-store');
  });
  it('combines role/status filters, exact normalized email and literal name search', async () => {
    expect((await (await call('/users?role=student&isActive=false')).json()).users.map((row: any) => row.id)).toEqual([String(id(5))]);
    expect((await (await call('/users?email=%20USER4%40EXAMPLE.TEST%20')).json()).pagination.total).toBe(1);
    const body = await (await call('/users?q=.*')).json(); expect(body.pagination.total).toBe(1); expect(body.users[0].id).toBe(String(id(5)));
    expect((await (await call('/users?q=user4%40example.test')).json()).pagination.total).toBe(0);
  });
  it.each(['page=0', 'page=10001', 'limit=101', 'role=teacher', 'isActive=0', 'email=bad', 'q=x&email=user1%40example.test', 'q=x&q=y', 'sort=email', 'q[$ne]=x'])('rejects directory query %s', async suffix => { expect((await call('/users?' + suffix)).status).toBe(400); });
  it('looks up inactive users without disclosing auth internals and validates IDs/query', async () => {
    expect((await (await call(`/users/${id(5)}`)).json()).user.isActive).toBe(false);
    expect((await call('/users/invalid')).status).toBe(400); expect((await call(`/users/${id(999)}`)).status).toBe(404); expect((await call(`/users/${id(4)}?role=admin`)).status).toBe(400);
    expect((await (await call('/users?page=100&limit=1')).json()).users).toEqual([]);
  });
  it('searches all audit records beyond 20 with stable tie ordering and correct totals', async () => {
    const response = await call('/audit-events?page=2&limit=20'), body = await response.json(); expect(response.status).toBe(200);
    expect(body.pagination).toEqual({ page: 2, limit: 20, total: 27 }); expect(body.events).toHaveLength(7);
    expect(body.events[0].id).toBe(String(id(106))); expect(body.events[6].id).toBe(String(id(100)));
    expect(body.events[6].changes).toEqual([{ field: 'role', before: 'student', after: 'faculty' }]);
    expect(body.events[0].changes).toEqual([]); expect(JSON.stringify(body)).not.toMatch(/metadata|private-|password|userAgent|googleId/);
  });
  it('combines audit filters and applies exclusive UTC boundaries', async () => {
    const body = await (await call(`/audit-events?action=user.created&actorId=${id(1)}&resourceType=User&resourceId=${id(4)}&from=2026-10-01T00:00:00Z&to=2026-10-02T00:00:00Z`)).json(); expect(body.pagination.total).toBe(13);
    expect((await (await call('/audit-events?to=2026-10-01T00:00:00Z')).json()).pagination.total).toBe(0);
    expect((await (await call(`/audit-events?actorId=${id(999)}`)).json()).events).toEqual([]);
  });
  it.each(['actorId=bad', 'resourceType=Any', 'from=bad', 'from=2026-10-01T00:00:00Z&to=2026-10-01T00:00:00.000Z', 'metadata=x', 'limit=0', 'action=x&action=y'])('rejects audit query %s', async suffix => { expect((await call('/audit-events?' + suffix)).status).toBe(400); });
  it('rechecks active admin before returning directory, detail and audit data', async () => {
    vi.mocked(User.exists).mockResolvedValue(null);
    for (const path of ['/users', `/users/${id(4)}`, '/audit-events']) expect((await call(path)).status).toBe(401);
  });
  it('sanitizes internal failures', async () => {
    vi.mocked(AuditEvent.find).mockImplementation(() => { throw new Error('private-credential'); });
    const response = await call('/audit-events'); expect(response.status).toBe(500); expect(JSON.stringify(await response.json())).not.toContain('private-credential');
  });
});
describe('POL-ADMIN-1 fail-closed account management', () => {
  it.each([{ role: 'student' }, { role: 'faculty' }, { isActive: false }])('rejects self privilege removal %j', async change => {
    const response = await call(`/users/${id(1)}`, { method: 'PATCH', body: { ...change, expectedManagementVersion: 0 } });
    expect(response.status).toBe(409); expect((await response.json()).code).toBe('SELF_ADMIN_CHANGE_FORBIDDEN');
  });
  it('blocks every update without atomic management, including sole admin, no-op and stale-looking requests', async () => {
    users = users.filter(user => String(user._id) !== String(id(2)));
    const before = JSON.stringify(users), auditBefore = JSON.stringify(events);
    for (const [target, body] of [[1, { role: 'admin' }], [3, { role: 'student' }], [4, { role: 'faculty' }], [4, { isActive: false }], [4, { role: 'student', expectedManagementVersion: 100 }]] as const) {
      const response = await call(`/users/${id(target)}`, { method: 'PATCH', body: { expectedManagementVersion: 0, ...body } }); expect(response.status).toBe(503); expect((await response.json()).code).toBe('ACCOUNT_UPDATE_UNAVAILABLE');
    }
    expect(users.filter(user => user.role === 'admin' && user.isActive)).toHaveLength(1); expect(JSON.stringify(users)).toBe(before); expect(JSON.stringify(events)).toBe(auditBefore);
    expect(User.findByIdAndUpdate).not.toHaveBeenCalled(); expect(User.findOneAndUpdate).not.toHaveBeenCalled(); expect(AuditEvent.create).not.toHaveBeenCalled();
  });
  it('keeps two admins active when they concurrently request each other’s removal', async () => {
    const responses = await Promise.all([call(`/users/${id(2)}`, { method: 'PATCH', body: { isActive: false, expectedManagementVersion: 0 } }), call(`/users/${id(1)}`, { actor: 2, method: 'PATCH', body: { role: 'student', expectedManagementVersion: 0 } })]);
    expect(responses.map(response => response.status)).toEqual([503, 503]); expect(users.filter(user => user.role === 'admin' && user.isActive)).toHaveLength(2);
    // This proves denial on all writers, not transaction-capable successful concurrent mutations.
  });
  it.each([{}, { role: 'faculty' }, { isActive: 'false', expectedManagementVersion: 0 }, { role: 'faculty', expectedManagementVersion: -1 }, { role: 'faculty', teacherId: String(id(3)), expectedManagementVersion: 0 }])('validates strict versioned updates %j', async body => { expect((await call(`/users/${id(4)}`, { method: 'PATCH', body })).status).toBe(400); });
  it('validates creation/duplicates but never creates an unaudited account', async () => {
    const body = { firstName: 'New', lastName: 'Student', email: 'new@example.test', password: 'unit-test-password', role: 'student' };
    expect((await call('/users', { method: 'POST', body: { ...body, email: ' USER4@EXAMPLE.TEST ' } })).status).toBe(409);
    expect((await call('/users', { method: 'POST', body })).status).toBe(503);
    for (const extra of [{ teacherId: String(id(3)) }, { password: 'short' }, { role: 'teacher' }, { firstName: ' ' }]) expect((await call('/users', { method: 'POST', body: { ...body, ...extra } })).status).toBe(400);
    expect(User.create).not.toHaveBeenCalled(); expect(AuditEvent.create).not.toHaveBeenCalled();
  });
  it('returns 400/404 for malformed and nonexistent update targets', async () => {
    const options = { method: 'PATCH', body: { isActive: false, expectedManagementVersion: 0 } };
    expect((await call('/users/bad', options)).status).toBe(400); expect((await call(`/users/${id(999)}`, options)).status).toBe(404);
  });
  it('redacts unsafe/malformed audit changes instead of inventing history', () => {
    expect(auditChanges({ role: 'faculty' })).toEqual([]);
    expect(auditChanges({ before: { password: 'secret' }, after: { password: 'changed' } })).toEqual([]);
    expect(auditChanges({ changes: [{ field: 'role', before: 'student', after: 'secret' }, { field: 'isActive', before: true, after: false }, { field: 'token', before: null, after: 'secret' }] })).toEqual([{ field: 'isActive', before: true, after: false }]);
  });
});
