import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { api } from './api';
import { enrollmentError } from './enrollment';

export function academicError(error: unknown) {
  if (axios.isAxiosError(error) && error.response?.status === 409 && error.response.data?.code === 'COHORT_CHANGED') return 'Your cohort changed while loading. Refresh the overview to load current assignments.';
  return enrollmentError(error);
}

export interface Score { value: number | null; max: number | null; percentage: number | null; basis: 'report' | 'attempt-snapshot' | 'unknown'; }
export interface ExperimentRef { id: string; title: string | null; category: string | null; status: string | null; }
export interface AcademicAttempt {
  id: string; experiment: ExperimentRef; status: 'running' | 'completed' | 'expired' | 'failed'; startedAt: string; completedAt: string | null;
  assessmentScore: Score; taskProgress: { verifiedTaskCount: number; requiredTaskCount: number | null; percentage: number | null; basis: string };
  report: { id: string; available: boolean } | null;
}
export interface AcademicReport { id: string; attemptId: string; experiment: ExperimentRef; generatedAt: string; score: number; totalMarks: number; quizScore: number; available: boolean; downloadUrl: string | null; }
export interface AcademicFilters { page: number; limit: number; status?: string; experimentId?: string; from?: string; to?: string; }
export interface AcademicPage { page: number; limit: number; total: number; }
export interface Performance { attemptedStudents: number; completedStudents: number; attemptCount: number; completedAttemptCount: number; averageScore: number | null; bestScore: number | null; normalizedScoreCount: number; averagePercentage: number | null; completionPercentage: number | null; }
export interface CohortAnalytics { cohort: { enrolledStudents: number; activeStudents: number; inactiveStudents: number; attemptedStudents: number; completedStudents: number; attemptCount: number; completedAttemptCount: number }; experiments: { experiment: ExperimentRef; performance: Performance }[]; pagination: AcademicPage; }

export function useAcademicAttempts(teacherId: string, studentId: string, filters: AcademicFilters) {
  return useQuery({ queryKey: ['teacher-academics', teacherId, studentId, 'attempts', filters], retry: false, queryFn: async () => {
    const { data } = await api.get<{ attempts: AcademicAttempt[]; pagination: AcademicPage }>(`/teacher/students/${studentId}/attempts`, { params: filters });
    if (!Array.isArray(data?.attempts) || !data.pagination) throw new Error('Invalid attempt history.');
    return data;
  } });
}
export function useAcademicReports(teacherId: string, studentId: string, filters: AcademicFilters) {
  return useQuery({ queryKey: ['teacher-academics', teacherId, studentId, 'reports', filters], retry: false, queryFn: async () => {
    const { data } = await api.get<{ reports: AcademicReport[]; pagination: AcademicPage }>(`/teacher/students/${studentId}/reports`, { params: filters });
    if (!Array.isArray(data?.reports) || !data.pagination) throw new Error('Invalid report list.');
    return data;
  } });
}
export function useCohortAnalytics(teacherId: string, filters: AcademicFilters) {
  return useQuery({ queryKey: ['teacher-analytics', teacherId, filters], retry: false, queryFn: async () => {
    const { data } = await api.get<CohortAnalytics>('/teacher/analytics/experiments', { params: filters });
    if (!data?.cohort || !Array.isArray(data.experiments) || !data.pagination) throw new Error('Invalid performance response.');
    return data;
  } });
}
