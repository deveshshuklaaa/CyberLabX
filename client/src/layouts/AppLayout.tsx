import { Outlet } from 'react-router-dom';
import { UniversityHeader } from '../components/common/UniversityHeader';
import { UniversityFooter } from '../components/common/UniversityFooter';

export function AppLayout() {
  return (
    <div className="min-h-screen bg-canvas flex flex-col justify-between">
      <div className="flex-1">
        <a href="#main-content" className="skip-link">Skip to main content</a>
        <UniversityHeader />
        <main id="main-content" tabIndex={-1} className="portal-content py-6 sm:py-10 mx-auto max-w-7xl px-4 sm:px-6">
          <Outlet />
        </main>
      </div>
      <UniversityFooter />
    </div>
  );
}


