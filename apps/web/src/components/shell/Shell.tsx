import { useEffect } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useStore } from '@/lib/store';
import { useAuthStore } from '@/lib/auth';
import { Sidebar } from './Sidebar';
import { ZeusPanel } from '../zeus/ZeusPanel';
import { Button } from '@/components/ui/button';

export function Shell() {
  const { zeusOpen, toggleZeus } = useStore();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const location = useLocation();

  // Sync URL → state: /zeus or /zeus/:chatId opens the panel
  useEffect(() => {
    const isZeusRoute = location.pathname.startsWith('/zeus');
    if (isZeusRoute && !zeusOpen) {
      toggleZeus();
    }
  }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleCloseZeus = () => {
    if (zeusOpen) toggleZeus();
    // Navigate away from /zeus route when closing
    if (location.pathname.startsWith('/zeus')) {
      navigate('/');
    }
  };

  const handleOpenZeus = () => {
    if (!zeusOpen) toggleZeus();
    // Only change URL if we're at root or already on a zeus route
    // Preserve the current page URL when opening from gallery, feed, etc.
    const isNeutralRoute = location.pathname === '/' || location.pathname.startsWith('/zeus');
    if (isNeutralRoute) {
      navigate('/zeus');
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bg-shell">
      <Sidebar onZeusClick={handleOpenZeus} />

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex shrink-0 items-center justify-end gap-3 border-b border-border px-4 py-2">
          {user && (
            <>
              <span className="text-[13px] text-text-2">
                {user.name ?? user.email}
              </span>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                Logout
              </Button>
            </>
          )}
        </header>

        <main className="flex flex-1 flex-col overflow-hidden">
          <Outlet />
        </main>
      </div>

      {zeusOpen && <ZeusPanel onClose={handleCloseZeus} />}
    </div>
  );
}
