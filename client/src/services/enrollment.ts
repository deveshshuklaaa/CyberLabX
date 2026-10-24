import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { api, errorMessage } from './api';

// Enrollment responses are separate from the unchanged authenticated-user contract.
export interface EnrollmentInfo { teacherId: string; status: 'active' | 'inactive'; enrolledAt: string | null; }
export interface EnrolledStudent {
  student: { id: string; firstName: string; lastName: string; email: string; role: 'student'; isActive: boolean };
  enrollment: EnrollmentInfo;
}
export interface StudentList { students: EnrolledStudent[]; pagination: { page: number; limit: number; total: number }; }
export interface StudentDetail extends EnrolledStudent { progress: { attempts: number; completedAttempts: number; averageScore: number; bestScore: number }; }
export interface OwnEnrollment { enrollment: (EnrollmentInfo & { teacher: { id: string; firstName: string; lastName: string; email: string; isActive: boolean } | null }) | null; }
export type EnrollmentSelector = { email: string; studentId?: never } | { studentId: string; email?: never };

export const enrollmentKeys = {
  lists: ['teacher-students'] as const,
  list: (teacherId: string, page: number) => ['teacher-students', teacherId, page] as const,
  details: ['teacher-student'] as const,
  detail: (teacherId: string, studentId: string) => ['teacher-student', teacherId, studentId] as const,
  own: (studentId: string) => ['student-enrollment', studentId] as const,
};
export const enrollmentPageSize = 10;

export function useEnrolledStudents(teacherId: string, page: number) {
  return useQuery({ queryKey: enrollmentKeys.list(teacherId, page), retry: false, queryFn: async () => {
    const { data } = await api.get<StudentList>('/teacher/students', { params: { page, limit: enrollmentPageSize } });
    if (!Array.isArray(data?.students) || !data.pagination || !Number.isInteger(data.pagination.total) || data.pagination.total < 0) throw new Error('Invalid enrollment response.');
    return data;
  } });
}
export function useEnrolledStudent(teacherId: string, studentId: string) {
  return useQuery({ queryKey: enrollmentKeys.detail(teacherId, studentId), retry: false, queryFn: async () => {
    const { data } = await api.get<StudentDetail>(`/teacher/students/${studentId}`);
    if (data?.student?.id !== studentId || !data.enrollment || !data.progress || !['attempts', 'completedAttempts', 'averageScore', 'bestScore'].every(key => {
      const value = data.progress[key as keyof StudentDetail['progress']];
      return typeof value === 'number' && Number.isFinite(value) && value >= 0;
    })) throw new Error('Invalid student progress response.');
    return data;
  } });
}
export function useOwnEnrollment(studentId: string) {
  return useQuery({ queryKey: enrollmentKeys.own(studentId), retry: false, queryFn: async () => {
    const { data } = await api.get<OwnEnrollment>('/student/enrollment');
    if (!data || !Object.hasOwn(data, 'enrollment') || (data.enrollment !== null && !data.enrollment?.teacherId)) throw new Error('Invalid enrollment response.');
    return data;
  } });
}
export function useRefreshEnrollments() {
  const client = useQueryClient();
  return () => Promise.all([
    client.invalidateQueries({ queryKey: enrollmentKeys.lists }),
    client.invalidateQueries({ queryKey: enrollmentKeys.details }),
    client.invalidateQueries({ queryKey: ['faculty-dashboard'] }),
    client.invalidateQueries({ queryKey: ['student-enrollment'] }),
    client.invalidateQueries({ queryKey: ['teacher-academics'] }),
    client.invalidateQueries({ queryKey: ['teacher-analytics'] }),
  ]);
}
export function enrollmentError(error: unknown) {
  if (axios.isAxiosError(error)) {
    if (error.response?.status === 401) return 'Your session is unavailable. Sign in again to view enrollment.';
    if (error.response?.status === 403) return 'You do not have permission to access this enrollment.';
    if (error.response?.status === 409) return 'This student is already enrolled. An existing assignment must be removed before another teacher can enroll them.';
    if (error.response?.status === 404) return 'The student or enrollment is unavailable. Check the exact identifier or refresh your students.';
  }
  return errorMessage(error);
}
export function enrollmentDate(value: string | null) {
  return value && !Number.isNaN(Date.parse(value)) ? new Date(value).toLocaleString() : 'Not recorded';
}
