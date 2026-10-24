import { useQuery } from '@tanstack/react-query';
import { api } from './api';
import type { StudentHistoryData } from '../types/api';
import { useSessionStore } from '../store/sessionStore';

export function useStudentHistory() {
  const id = useSessionStore(state => state.user?.id);
  return useQuery({ queryKey: ['student-history', id], retry: false, queryFn: async () => {
    const { data } = await api.get<StudentHistoryData>('/student/history');
    if (!Array.isArray(data?.attempts)) throw new Error('Invalid student history.'); return data;
  } });
}
export function attemptDate(value?: string) {
  if (!value || Number.isNaN(Date.parse(value))) return 'Not available';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}
