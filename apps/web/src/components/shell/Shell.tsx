import { useStore } from '../../lib/store.js';
import { Sidebar } from './Sidebar.js';
import { HomeView } from '../home/HomeView.js';
import { FeedView } from '../feed/FeedView.js';
import { ZeusPanel } from '../zeus/ZeusPanel.js';
import { AgentView } from '../agent/AgentView.js';

export function Shell() {
  const { view, zeusOpen } = useStore();

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      width: '100vw',
      overflow: 'hidden',
      background: 'var(--bg-shell)',
    }}>
      <Sidebar />

      <main style={{
        flex: 1,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {view === 'home'     && <HomeView />}
        {view === 'feed'     && <FeedView />}
        {view === 'agent'    && <AgentView />}
        {view === 'gallery'  && <PlaceholderView title="Gallery" />}
        {view === 'build'    && <PlaceholderView title="Build" />}
        {view === 'settings' && <PlaceholderView title="Settings" />}
      </main>

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
