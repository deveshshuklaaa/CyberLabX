import type { IUser } from '../models/User.js';

// POL-ADMIN-1 requires an approved shared serialization guard and transaction design.
// None is deployed here. Never infer permission from topology alone.
export const accountManagement = Object.freeze({
  writesAvailable: false, code: 'ACCOUNT_UPDATE_UNAVAILABLE',
  message: 'Account creation and role/status changes are temporarily unavailable. Existing accounts can still be viewed and teacher assignments managed.',
});
export const adminUserFields = '_id firstName lastName email role isActive teacherId enrolledAt createdAt updatedAt';
export function adminUser(user: Pick<IUser, 'firstName' | 'lastName' | 'email' | 'role' | 'isActive' | 'teacherId' | 'enrolledAt' | 'createdAt' | 'updatedAt'> & { _id: unknown }) {
  return { id: String(user._id), firstName: user.firstName, lastName: user.lastName, email: user.email,
    role: user.role, isActive: user.isActive, teacherId: user.teacherId ? String(user.teacherId) : null,
    enrolledAt: user.enrolledAt ?? null, createdAt: user.createdAt ?? null, updatedAt: user.updatedAt ?? null,
    // No version is persisted; do not invent an optimistic-lock token.
    managementVersion: null };
}
type Change = { field: 'role' | 'isActive' | 'status'; before: string | boolean | null; after: string | boolean | null };
function object(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }
export function auditChanges(metadata: unknown): Change[] {
  if (!object(metadata)) return [];
  const candidates: unknown[] = Array.isArray(metadata.changes) ? metadata.changes : object(metadata.before) && object(metadata.after)
    ? ['role', 'isActive', 'status'].map(field => ({ field, before: (metadata.before as Record<string, unknown>)[field], after: (metadata.after as Record<string, unknown>)[field] })) : [];
  const valid = (field: string, value: unknown) => value === null || (field === 'isActive' ? typeof value === 'boolean' : typeof value === 'string' && (field === 'role' ? ['student', 'faculty', 'admin'] : ['draft', 'published', 'archived']).includes(value));
  const seen = new Set<string>();
  return candidates.flatMap(candidate => {
    if (!object(candidate) || typeof candidate.field !== 'string' || !['role', 'isActive', 'status'].includes(candidate.field) || seen.has(candidate.field)
      || !valid(candidate.field, candidate.before) || !valid(candidate.field, candidate.after)) return [];
    seen.add(candidate.field); return [{ field: candidate.field, before: candidate.before, after: candidate.after } as Change];
  });
}
