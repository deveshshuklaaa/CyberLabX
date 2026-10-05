import { Outlet } from 'react-router-dom';
import { UniversityHeader } from '../components/common/UniversityHeader';
import { UniversityFooter } from '../components/common/UniversityFooter';

export function AppLayout() {
  return (
    <div className="min-h-screen bg-canvas flex flex-col justify-between">
      <div>
        <UniversityHeader />
        <main className="py-8 mx-auto max-w-7xl px-4 sm:px-6">
          <Outlet />
        </main>
      </div>
      <UniversityFooter />
    </div>
  );
}


