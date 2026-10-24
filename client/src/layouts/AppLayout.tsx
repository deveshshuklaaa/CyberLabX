import { Outlet, useLocation } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import { UniversityHeader } from '../components/common/UniversityHeader';
import { UniversityFooter } from '../components/common/UniversityFooter';

export function AppLayout() {
  const { pathname } = useLocation(); const main = useRef<HTMLElement>(null);
  useEffect(() => { main.current?.focus({ preventScroll: true }); document.documentElement.scrollTop = 0; }, [pathname]);
  return (
    <div className="min-h-screen bg-canvas flex flex-col justify-between">
      <div className="flex-1">
        <a href="#main-content" className="skip-link">Skip to main content</a>
        <UniversityHeader />
        <main ref={main} id="main-content" tabIndex={-1} className="portal-content py-6 sm:py-10 mx-auto max-w-7xl px-4 sm:px-6 w-full">
          <Outlet />
        </main>
      </div>
      <UniversityFooter />
    </div>
  );
}


