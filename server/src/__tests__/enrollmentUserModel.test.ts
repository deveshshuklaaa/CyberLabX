import { describe, expect, it } from 'vitest';
import { Types } from 'mongoose';
import { User } from '../models/User.js';
import { publicUser } from '../services/authService.js';

describe('single-teacher student assignment model', () => {
  it('keeps existing local and Google accounts unassigned without migration or seed enrollment', async () => {
    const student = new User({ firstName: 'Test', email: 'student@example.test', googleId: 'test-subject' });
    await expect(student.validate()).resolves.toBeUndefined();
    expect(student.teacherId).toBeUndefined(); expect(student.enrolledAt).toBeUndefined();
  });
  it('stores one teacher reference and enrollment date, with an index for cohort queries', async () => {
    const teacherId = new Types.ObjectId(); const enrolledAt = new Date();
    const student = new User({ firstName: 'Test', email: 'student@example.test', googleId: 'test-subject', teacherId, enrolledAt });
    await expect(student.validate()).resolves.toBeUndefined();
    expect(student.teacherId).toEqual(teacherId); expect(student.enrolledAt).toEqual(enrolledAt);
    expect(User.schema.indexes()).toContainEqual([{ teacherId: 1, role: 1, _id: 1 }, expect.objectContaining({})]);
  });
  it('cannot store multiple teacher IDs in the scalar reference', async () => {
    const student = new User({ firstName: 'Test', email: 'student@example.test', googleId: 'test-subject', teacherId: [new Types.ObjectId(), new Types.ObjectId()] });
    await expect(student.validate()).rejects.toHaveProperty('errors.teacherId');
  });
  it('preserves the existing public auth response contract', () => {
    const student = new User({ firstName: 'Test', email: 'student@example.test', googleId: 'test-subject', teacherId: new Types.ObjectId(), enrolledAt: new Date() });
    expect(Object.keys(publicUser(student)).sort()).toEqual(['id', 'firstName', 'lastName', 'email', 'role', 'isActive'].sort());
  });
});
