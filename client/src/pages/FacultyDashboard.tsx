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
  const { data, isLoading } = useQuery({
    queryKey: ['faculty-dashboard'],
    queryFn: () => api.get('/faculty/dashboard').then(r => r.data),
  });

  return (
    <div className="space-y-8">
      {/* Top Banner */}
      <div className="border-b border-line pb-4">
        <span className="text-xs font-bold uppercase tracking-wider text-brand">
          Somaiya Vidyavihar University · Faculty Portal
        </span>
        <h1 className="mt-1 text-2xl sm:text-3xl font-black text-ink uppercase font-sans">
          Faculty Laboratory Analytics
        </h1>
        <p className="mt-1 text-sm text-muted">
          Aggregated cohort progress metrics and evaluation report status across all students.
        </p>
      </div>

      {isLoading ? (
        <div className="panel p-10 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-brand border-t-transparent mb-3" />
          <p className="text-sm text-muted">Loading cohort metrics…</p>
        </div>
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
