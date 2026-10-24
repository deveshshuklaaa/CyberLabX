import { PageHeading } from '../components/common/PageHeading';
import { LoadingState, ErrorState } from '../components/common/QueryState';
import { useQuery } from '@tanstack/react-query';
import { Award, BookOpen, FileText, Users } from 'lucide-react';
import { api } from '../services/api';

const ICONS: Record<string, React.ReactNode> = {
  students: <Users size={20} />,
  completedAttempts: <BookOpen size={20} />,
  averageScore: <Award size={20} />,
  reports: <FileText size={20} />,
};

export function FacultyDashboard() {
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['faculty-dashboard'],
    queryFn: () => api.get('/faculty/dashboard').then(r => r.data),
  });

  return (
    <div className="space-y-8">
      <PageHeading title="Faculty Laboratory Analytics" description="Aggregated cohort progress metrics and evaluation report status across all students." eyebrow="Somaiya Vidyavihar University | Faculty Portal" />

      {isLoading ? (
        <LoadingState message="Loading cohort metrics..." />
      ) : isError || !data ? (
        <ErrorState message="Unable to load dashboard data." onRetry={() => { void refetch(); }} retrying={isFetching} />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {Object.entries(data.metrics).map(([key, value]) => (
            <div key={key} className="panel p-6 bg-surface border border-line shadow-xs relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-brand" />
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-brand/10 text-brand shrink-0">
                  {ICONS[key] ?? <Award size={20} />}
                </div>
                <div>
                  <p className="text-2xl font-black text-ink font-sans leading-none">
                    {key === 'averageScore' ? `${value}%` : String(value)}
                  </p>
                  <p className="text-xs font-bold text-muted uppercase tracking-wider mt-1.5">
                    {key.replace(/([A-Z])/g, ' $1')}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
