import { useNavigate } from 'react-router-dom';
import { useStore } from '@/lib/store';
import { useAuthStore } from '@/lib/auth';
import { Sidebar } from './Sidebar';
import { HomeView } from '../home/HomeView';
import { FeedView } from '../feed/FeedView';
import { ZeusPanel } from '../zeus/ZeusPanel';
import { AgentView } from '../agent/AgentView';
import { Button } from '@/components/ui/button';

export function Shell() {
  const { view, zeusOpen } = useStore();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bg-shell">
      <Sidebar />

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
          {view === 'home'     && <HomeView />}
          {view === 'feed'     && <FeedView />}
          {view === 'agent'    && <AgentView />}
          {view === 'gallery'  && <PlaceholderView title="Gallery" />}
          {view === 'build'    && <PlaceholderView title="Build" />}
          {view === 'settings' && <PlaceholderView title="Settings" />}
        </main>
      </div>

      {zeusOpen && <ZeusPanel />}
    </div>
  );
}

function PlaceholderView({ title }: { title: string }) {
  return (
    <div className="flex flex-1 items-center justify-center font-serif text-2xl italic text-text-3">
      {title} — coming soon
    </div>
  );
}
