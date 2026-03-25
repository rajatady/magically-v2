import { useStore, type View } from '../../lib/store.js';

interface NavItem {
  id: View;
  icon: string;
  label: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'home',     icon: '⌂',  label: 'Home' },
  { id: 'feed',     icon: '◎',  label: 'Feed' },
  { id: 'gallery',  icon: '⊞',  label: 'Gallery' },
  { id: 'build',    icon: '+',  label: 'Build' },
  { id: 'settings', icon: '⚙', label: 'Settings' },
];

export function Sidebar() {
  const { view, zeusOpen, setView, toggleZeus, agents } = useStore();

  return (
    <nav
      data-testid="sidebar"
      style={{
        width: 64,
        background: 'var(--bg-panel)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '16px 0',
        gap: 4,
        flexShrink: 0,
      }}
    >
      {/* Logo */}
      <div style={{ fontSize: 22, marginBottom: 12 }}>✨</div>

      {/* Zeus button */}
      <SidebarButton
        icon="◈"
        label="Zeus"
        active={zeusOpen}
        onClick={toggleZeus}
      />

      <div style={{ height: 1, width: 32, background: 'var(--border)', margin: '8px 0' }} />

      {/* Main nav */}
      {NAV_ITEMS.map((item) => (
        <SidebarButton
          key={item.id}
          icon={item.icon}
          label={item.label}
          active={view === item.id}
          onClick={() => setView(item.id)}
        />
      ))}

      <div style={{ height: 1, width: 32, background: 'var(--border)', margin: '8px 0' }} />

      {/* Installed agents */}
      {agents.slice(0, 8).map((agent) => (
        <SidebarButton
          key={agent.id}
          icon={agent.icon ?? '◇'}
          label={agent.name}
          active={view === 'agent'}
          onClick={() => setView('agent', agent.id)}
        />
      ))}
    </nav>
  );
}

function SidebarButton({
  icon,
  label,
  active,
  onClick,
}: {
  icon: string;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      title={label}
      onClick={onClick}
      style={{
        width: 40,
        height: 40,
        borderRadius: 'var(--radius-sm)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 16,
        background: active ? 'var(--accent-dim)' : 'transparent',
        color: active ? 'var(--accent)' : 'var(--text-2)',
        transition: 'all 0.15s',
        cursor: 'pointer',
      }}
    >
      {icon}
    </button>
  );
}
