import { useQuery } from '@tanstack/react-query';
import { api } from './api';
import type { StudentHistoryData } from '../types/api';

export function useStudentHistory() {
  return useQuery({ queryKey: ['student-history'], queryFn: () => api.get<StudentHistoryData>('/student/history').then(response => response.data) });
}
export function attemptDate(value?: string) {
  if (!value || Number.isNaN(Date.parse(value))) return 'Not available';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}
