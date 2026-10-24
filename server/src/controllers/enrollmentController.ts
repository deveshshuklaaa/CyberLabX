import type { Request } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { User } from '../models/User.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { enrolledStudent, enrollmentInfo, enrollmentProgress, enrollmentStudentFields, enrollExistingStudent } from '../services/enrollmentService.js';

const objectId = z.string().regex(/^[a-f\d]{24}$/i);
const enrollmentInput = z.union([
  z.object({ studentId: objectId }).strict(),
  z.object({ email: z.string().trim().email().max(254).transform(value => value.toLowerCase()) }).strict(),
]);
const paginationInput = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
}).strict();

// Only the admin router accepts a teacher ID. Faculty identity always comes from requireAuth.
function teacherIdFor(req: Request) {
  return req.user!.role === 'admin' ? new Types.ObjectId(objectId.parse(req.params.teacherId)) : req.user!._id;
}

async function teacherFor(req: Request) {
  return req.user!.role === 'faculty' ? req.user! : User.findOne({ _id: teacherIdFor(req), role: 'faculty' });
}

export const listEnrolledStudents = asyncHandler(async (req, res) => {
  const { page, limit } = paginationInput.parse(req.query);
  const teacher = await teacherFor(req);
  if (!teacher) return res.status(404).json({ message: 'Teacher not found.' });
  const filter = { teacherId: teacher._id, role: 'student' };
  const [students, total] = await Promise.all([
    User.find(filter).select(enrollmentStudentFields).sort({ _id: 1 }).skip((page - 1) * limit).limit(limit),
    User.countDocuments(filter),
  ]);
  res.json({ students: students.map(student => enrolledStudent(student, teacher.isActive)), pagination: { page, limit, total } });
});

export const enrollStudent = asyncHandler(async (req, res) => {
  const input = enrollmentInput.parse(req.body);
  const teacher = await teacherFor(req);
  if (!teacher || !teacher.isActive) return res.status(404).json({ message: 'Active teacher not found.' });
  const selector = 'studentId' in input ? { _id: input.studentId } : { email: input.email };
  const result = await enrollExistingStudent(teacher, selector);
  if (result.kind === 'conflict') return res.status(409).json({ message: 'Student is already enrolled.' });
  if (!result.student) return res.status(404).json({ message: 'Eligible student not found.' });
  res.status(201).json(enrolledStudent(result.student, teacher.isActive));
});

export const getEnrolledStudent = asyncHandler(async (req, res) => {
  const studentId = objectId.parse(req.params.studentId);
  const teacher = await teacherFor(req);
  if (!teacher) return res.status(404).json({ message: 'Teacher not found.' });
  const student = await User.findOne({ _id: studentId, teacherId: teacher._id, role: 'student' }).select(enrollmentStudentFields);
  if (!student) return res.status(404).json({ message: 'Enrolled student not found.' });
  res.json({ ...enrolledStudent(student, teacher.isActive), progress: await enrollmentProgress(student) });
});

export const removeEnrollment = asyncHandler(async (req, res) => {
  const studentId = objectId.parse(req.params.studentId);
  // Admins may also release a stale assignment after its teacher was removed or changed role.
  const student = await User.findOneAndUpdate(
    { _id: studentId, teacherId: teacherIdFor(req), role: 'student' },
    { $unset: { teacherId: 1, enrolledAt: 1 } },
    { new: true },
  ).select('_id');
  if (!student) return res.status(404).json({ message: 'Enrolled student not found.' });
  res.status(204).send();
});

export const ownEnrollment = asyncHandler(async (req, res) => {
  const student = req.user!;
  if (!student.teacherId) return res.json({ enrollment: null });
  const teacher = await User.findOne({ _id: student.teacherId, role: 'faculty' }).select('firstName lastName email role isActive');
  res.json({ enrollment: {
    ...enrollmentInfo(student, Boolean(teacher?.isActive)),
    teacher: teacher ? { id: String(teacher._id), firstName: teacher.firstName, lastName: teacher.lastName, email: teacher.email, isActive: teacher.isActive } : null,
  } });
});
