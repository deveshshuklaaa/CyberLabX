import { User, type UserDocument } from '../models/User.js';
import { Attempt } from '../models/Attempt.js';
import { publicUser } from './authService.js';

export const enrollmentStudentFields = 'firstName lastName email role isActive teacherId enrolledAt';

export function enrollmentInfo(student: UserDocument, teacherActive: boolean) {
  return {
    teacherId: String(student.teacherId),
    status: student.isActive && teacherActive ? 'active' : 'inactive',
    enrolledAt: student.enrolledAt ?? null,
  };
}

export function enrolledStudent(student: UserDocument, teacherActive: boolean) {
  return { student: publicUser(student), enrollment: enrollmentInfo(student, teacherActive) };
}

export async function enrollExistingStudent(teacher: UserDocument, selector: { _id: string } | { email: string }) {
  // Missing/null matches legacy unassigned accounts. The predicate prevents both duplicate
  // enrollment and two teachers winning concurrent requests for the same student document.
  const student = await User.findOneAndUpdate(
    { ...selector, role: 'student', isActive: true, teacherId: null },
    { $set: { teacherId: teacher._id, enrolledAt: new Date() } },
    { new: true, runValidators: true },
  ).select(enrollmentStudentFields);
  if (student) return { kind: 'created' as const, student };
  const eligible = await User.exists({ ...selector, role: 'student', isActive: true });
  return { kind: eligible ? 'conflict' as const : 'not-found' as const };
}

/** Academic summary only; no quiz answers, command logs, report paths or lab credentials. */
export async function enrollmentProgress(student: UserDocument) {
  const completed = { $eq: ['$status', 'completed'] };
  const [progress] = await Attempt.aggregate([
    { $match: { studentId: student._id } },
    { $group: {
      _id: null,
      attempts: { $sum: 1 },
      completedAttempts: { $sum: { $cond: [completed, 1, 0] } },
      averageScore: { $avg: { $cond: [completed, '$score', null] } },
      bestScore: { $max: { $cond: [completed, '$score', null] } },
    } },
  ]);
  return {
    attempts: progress?.attempts ?? 0,
    completedAttempts: progress?.completedAttempts ?? 0,
    averageScore: Math.round(progress?.averageScore ?? 0),
    bestScore: progress?.bestScore ?? 0,
  };
}
