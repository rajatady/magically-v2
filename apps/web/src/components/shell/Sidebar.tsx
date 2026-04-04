import { useNavigate, useLocation } from 'react-router-dom';
import { useStore } from '../../lib/store';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import {
  Home,
  Rss,
  MessageSquare,
  LayoutGrid,
  Plus,
  Settings,
  Sparkles,
  Zap,
  type LucideIcon,
} from 'lucide-react';

interface NavItem {
  path: string;
  icon: LucideIcon;
  label: string;
}

const NAV_ITEMS: NavItem[] = [
  { path: '/',         icon: Home,          label: 'Home' },
  { path: '/feed',     icon: Rss,           label: 'Feed' },
  { path: '/chats',    icon: MessageSquare, label: 'Chats' },
  { path: '/gallery',  icon: LayoutGrid,    label: 'Gallery' },
  { path: '/build',    icon: Plus,          label: 'Build' },
  { path: '/settings', icon: Settings,      label: 'Settings' },
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
      <div className="mb-3">
        <Sparkles size={22} className="text-accent" />
      </div>

      {/* Zeus button */}
      <SidebarButton Icon={Zap} label="Zeus" active={zeusOpen} onClick={onZeusClick ?? toggleZeus} />

      <Separator className="my-2 w-8" />

      {/* Main nav */}
      {NAV_ITEMS.map((item) => (
        <SidebarButton
          key={item.path}
          Icon={item.icon}
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
          emoji={agent.icon ?? '◇'}
          label={agent.name}
          active={location.pathname === `/agents/${agent.id}`}
          onClick={() => navigate(`/agents/${agent.id}`)}
        />
      ))}
    </nav>
  );
}

function SidebarButton({
  Icon,
  emoji,
  label,
  active,
  onClick,
}: {
  Icon?: LucideIcon;
  emoji?: string;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      title={label}
      onClick={onClick}
      className={cn(
        'flex size-10 items-center justify-center rounded-md transition-all cursor-pointer',
        active
          ? 'bg-accent-dim text-accent'
          : 'bg-transparent text-text-2 hover:bg-bg-hover',
      )}
    >
      {Icon ? <Icon size={18} strokeWidth={active ? 2.2 : 1.8} /> : <span className="text-base">{emoji}</span>}
    </button>
  );
}
