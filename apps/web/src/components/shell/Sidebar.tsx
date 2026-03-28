import { useNavigate, useLocation } from 'react-router-dom';
import { useStore } from '../../lib/store';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';

interface NavItem {
  path: string;
  icon: string;
  label: string;
}

const NAV_ITEMS: NavItem[] = [
  { path: '/',         icon: '⌂',  label: 'Home' },
  { path: '/feed',     icon: '◎',  label: 'Feed' },
  { path: '/gallery',  icon: '⊞',  label: 'Gallery' },
  { path: '/build',    icon: '+',  label: 'Build' },
  { path: '/settings', icon: '⚙', label: 'Settings' },
];

export function Sidebar({ onZeusClick }: { onZeusClick?: () => void }) {
  const { zeusOpen, toggleZeus, agents } = useStore();
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <nav
      data-testid="sidebar"
      className="flex w-16 shrink-0 flex-col items-center gap-1 border-r border-border bg-bg-panel py-4"
    >
      {/* Logo */}
      <div className="mb-3 text-[22px]">✨</div>

      {/* Zeus button */}
      <SidebarButton icon="◈" label="Zeus" active={zeusOpen} onClick={onZeusClick ?? toggleZeus} />

      <Separator className="my-2 w-8" />

      {/* Main nav */}
      {NAV_ITEMS.map((item) => (
        <SidebarButton
          key={item.path}
          icon={item.icon}
          label={item.label}
          active={isActive(item.path)}
          onClick={() => navigate(item.path)}
        />
      ))}

      <Separator className="my-2 w-8" />

      {/* Installed agents */}
      {agents.slice(0, 8).map((agent) => (
        <SidebarButton
          key={agent.id}
          icon={agent.icon ?? '◇'}
          label={agent.name}
          active={location.pathname === `/agents/${agent.id}`}
          onClick={() => navigate(`/agents/${agent.id}`)}
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
      className={cn(
        'flex size-10 items-center justify-center rounded-md text-base transition-all cursor-pointer',
        active
          ? 'bg-accent-dim text-accent'
          : 'bg-transparent text-text-2 hover:bg-bg-hover',
      )}
    >
      {icon}
    </button>
  );
}
