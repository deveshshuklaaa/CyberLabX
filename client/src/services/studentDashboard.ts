import { useQuery } from '@tanstack/react-query';
import { api } from './api';
import { useSessionStore } from '../store/sessionStore';
import type { StudentDashboardData } from '../types/api';
export function useStudentDashboard() {
  const id = useSessionStore(state => state.user?.id);
  return useQuery({ queryKey: ['student-dashboard', id], retry: false, queryFn: async () => {
    const { data } = await api.get<StudentDashboardData>('/student/dashboard');
    if (!data?.stats || !Array.isArray(data.recentAttempts) || !['totalExperiments', 'experimentsAttempted', 'experimentsCompleted', 'averageScore', 'bestScore'].every(key => {
      const value = data.stats[key as keyof typeof data.stats]; return typeof value === 'number' && Number.isFinite(value) && value >= 0;
    }) || data.stats.publishedExperimentsCompleted !== undefined && (!Number.isInteger(data.stats.publishedExperimentsCompleted) || data.stats.publishedExperimentsCompleted < 0 || data.stats.publishedExperimentsCompleted > data.stats.totalExperiments)) throw new Error('Invalid student summary.');
    return data;
  } });
}
