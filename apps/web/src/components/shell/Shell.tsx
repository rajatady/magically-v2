import { useNavigate } from 'react-router-dom';
import { useStore } from '../../lib/store';
import { useAuthStore } from '../../lib/auth';
import { Sidebar } from './Sidebar';
import { HomeView } from '../home/HomeView';
import { FeedView } from '../feed/FeedView';
import { ZeusPanel } from '../zeus/ZeusPanel';
import { AgentView } from '../agent/AgentView';

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
    <div style={{
      display: 'flex',
      height: '100vh',
      width: '100vw',
      overflow: 'hidden',
      background: 'var(--bg-shell)',
    }}>
      <Sidebar />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <header style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          padding: '8px 16px',
          borderBottom: '1px solid var(--border-1, #2a2a2f)',
          gap: 12,
          flexShrink: 0,
        }}>
          {user && (
            <>
              <span style={{ fontSize: 13, color: 'var(--text-2, #a1a1aa)' }}>
                {user.name ?? user.email}
              </span>
              <button
                onClick={handleLogout}
                style={{
                  background: 'none',
                  border: '1px solid var(--border-1, #2a2a2f)',
                  color: 'var(--text-2, #a1a1aa)',
                  borderRadius: 6,
                  padding: '4px 10px',
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                Logout
              </button>
            </>
          )}
        </header>

        <main style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
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
    <div style={{
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'var(--text-3)',
      fontStyle: 'italic',
      fontFamily: 'var(--font-serif)',
      fontSize: 24,
    }}>
      {title} — coming soon
    </div>
  );
}
