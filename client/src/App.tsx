import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppLayout } from './layouts/AppLayout';
import { ProtectedRoute } from './routes/ProtectedRoute';
import { Login } from './pages/Login';
import { StudentDashboard } from './pages/StudentDashboard';
import { Experiments } from './pages/Experiments';
import { ExperimentOverview } from './pages/ExperimentOverview';
import { LabWorkspace } from './pages/LabWorkspace';
import { StudentProgress } from './pages/StudentProgress';
import { StudentHistory } from './pages/StudentHistory';
import { StudentProfile } from './pages/StudentProfile';
import { FacultyDashboard } from './pages/FacultyDashboard';
import { AdminDashboard } from './pages/AdminDashboard';
import { useSessionBootstrap } from './hooks/useSession';

const client = new QueryClient();

function Shell() {
  useSessionBootstrap();
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          {/* Student portal pages */}
          <Route index element={<StudentDashboard />} />
          <Route path="dashboard" element={<Navigate to="/" replace />} />
          <Route path="experiments" element={<Experiments />} />
          <Route path="experiments/:id" element={<ExperimentOverview />} />
          <Route path="progress" element={<StudentProgress />} />
          <Route path="history" element={<StudentHistory />} />
          <Route path="profile" element={<StudentProfile />} />

          {/* Lab workspace (no shared layout chrome needed) */}
          <Route path="labs/:labSessionId" element={<LabWorkspace />} />

          {/* Role-gated portals */}
          <Route element={<ProtectedRoute roles={['faculty', 'admin']} />}>
            <Route path="faculty" element={<FacultyDashboard />} />
          </Route>
          <Route element={<ProtectedRoute roles={['admin']} />}>
            <Route path="admin" element={<AdminDashboard />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={client}>
      <BrowserRouter>
        <Shell />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
