import type { Request, RequestHandler, Response } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { User } from '../models/User.js';
import { AuditEvent } from '../models/AuditEvent.js';
import { accountManagement, adminUser, adminUserFields, auditChanges } from '../services/adminManagementService.js';

const id = z.string().regex(/^[a-f\d]{24}$/i).transform(value => value.toLowerCase());
const role = z.enum(['student', 'faculty', 'admin']);
const integer = (max: number, fallback: string) => z.string().regex(/^[1-9]\d*$/).default(fallback).transform(Number).pipe(z.number().int().min(1).max(max));
const pageFields = { page: integer(10000, '1'), limit: integer(100, '25') };
const email = z.string().trim().email().max(254).transform(value => value.toLowerCase());
const directoryQuery = z.object({ ...pageFields, role: role.optional(), isActive: z.enum(['true', 'false']).optional(), email: email.optional(), q: z.string().trim().min(1).max(80).optional() }).strict().refine(value => !(value.email && value.q));
const auditQuery = z.object({ ...pageFields, action: z.string().trim().min(1).max(80).optional(), actorId: id.optional(), resourceType: z.enum(['User', 'Experiment']).optional(), resourceId: id.optional(), from: z.string().datetime().optional(), to: z.string().datetime().optional() }).strict().refine(value => !value.from || !value.to || Date.parse(value.from) < Date.parse(value.to));
const createInput = z.object({ firstName: z.string().trim().min(1).max(60), lastName: z.string().trim().min(1).max(60), email, password: z.string().min(12).max(128), role }).strict();
const updateInput = z.object({ role: role.optional(), isActive: z.boolean().optional(), expectedManagementVersion: z.number().int().min(0) }).strict().refine(value => value.role !== undefined || value.isActive !== undefined);
class AdminError extends Error { constructor(readonly status: number, readonly code: string, message: string) { super(message); } }
const route = (handler: (req: Request, res: Response) => Promise<void>): RequestHandler => async (req, res) => {
  try { res.setHeader('Cache-Control', 'private, no-store'); await handler(req, res); }
  catch (error) {
    if (error instanceof AdminError) { res.status(error.status).json({ message: error.message, code: error.code }); return; }
    if (error instanceof z.ZodError) { res.status(400).json({ message: 'Invalid request data.', code: 'INVALID_REQUEST' }); return; }
    console.error('Administrative request failed.'); res.status(500).json({ message: 'Administrative data is temporarily unavailable.', code: 'INTERNAL_ERROR' });
  }
};
async function activeAdmin(req: Request) {
  if (!await User.exists({ _id: req.user!._id, role: 'admin', isActive: true })) throw new AdminError(401, 'AUTH_REQUIRED', 'Your administrative session is unavailable. Sign in again.');
}
function noQuery(req: Request) { z.object({}).strict().parse(req.query); }
function unavailable(): never { throw new AdminError(503, accountManagement.code, accountManagement.message); }

export const listUsers = route(async (req, res) => {
  const query = directoryQuery.parse(req.query);
  const literal = query.q?.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const filter = { ...(query.role ? { role: query.role } : {}), ...(query.isActive ? { isActive: query.isActive === 'true' } : {}), ...(query.email ? { email: query.email } : {}),
    ...(literal ? { $or: [{ firstName: { $regex: literal, $options: 'i' } }, { lastName: { $regex: literal, $options: 'i' } }] } : {}) };
  const [users, total] = await Promise.all([User.find(filter).select(adminUserFields).sort({ _id: 1 }).skip((query.page - 1) * query.limit).limit(query.limit).lean(), User.countDocuments(filter)]);
  await activeAdmin(req); res.json({ users: users.map(adminUser), pagination: { page: query.page, limit: query.limit, total }, management: accountManagement });
});
export const getUser = route(async (req, res) => {
  const userId = id.parse(req.params.id); noQuery(req);
  const user = await User.findById(userId).select(adminUserFields).lean();
  if (!user) throw new AdminError(404, 'NOT_FOUND', 'User not found.');
  await activeAdmin(req); res.json({ user: adminUser(user), management: accountManagement });
});
export const createUser = route(async (req) => {
  noQuery(req); const data = createInput.parse(req.body); await activeAdmin(req);
  if (await User.exists({ email: data.email })) throw new AdminError(409, 'DUPLICATE_EMAIL', 'An account with this email already exists. Select the existing account in the directory.');
  // Creation also needs atomic actor/account/audit writes. Do not leave an unaudited account.
  unavailable();
});
export const updateUser = route(async (req) => {
  const userId = id.parse(req.params.id); noQuery(req); const data = updateInput.parse(req.body); await activeAdmin(req);
  if (userId === String(req.user!._id) && (data.isActive === false || (data.role !== undefined && data.role !== 'admin'))) {
    throw new AdminError(409, 'SELF_ADMIN_CHANGE_FORBIDDEN', 'You cannot deactivate or demote your own administrator account.');
  }
  if (!await User.exists({ _id: userId })) throw new AdminError(404, 'NOT_FOUND', 'User not found.');
  // Failing ALL writes closed protects last-admin, stale-version, caller-revocation,
  // audit rollback and teacher-demotion/enrollment races without a false count check.
  unavailable();
});
export const listAuditEvents = route(async (req, res) => {
  const query = auditQuery.parse(req.query);
  const filter = { ...(query.action ? { action: query.action } : {}), ...(query.actorId ? { userId: new Types.ObjectId(query.actorId) } : {}), ...(query.resourceType ? { resourceType: query.resourceType } : {}), ...(query.resourceId ? { resourceId: query.resourceId } : {}),
    ...(query.from || query.to ? { createdAt: { ...(query.from ? { $gte: new Date(query.from) } : {}), ...(query.to ? { $lt: new Date(query.to) } : {}) } } : {}) };
  const [events, total] = await Promise.all([AuditEvent.find(filter).select('_id action createdAt userId resourceType resourceId metadata').sort({ createdAt: -1, _id: -1 }).skip((query.page - 1) * query.limit).limit(query.limit).lean(), AuditEvent.countDocuments(filter)]);
  await activeAdmin(req);
  res.json({ events: events.map(event => ({ id: String(event._id), action: event.action, createdAt: event.createdAt, actorId: event.userId ? String(event.userId) : null,
    resource: { type: event.resourceType ?? null, id: event.resourceId ?? null }, changes: auditChanges(event.metadata) })), pagination: { page: query.page, limit: query.limit, total } });
});
