import { useStore, type View } from '../../lib/store';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';

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

export function Sidebar({ onZeusClick }: { onZeusClick?: () => void }) {
  const { view, zeusOpen, setView, toggleZeus, agents } = useStore();

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
          key={item.id}
          icon={item.icon}
          label={item.label}
          active={view === item.id}
          onClick={() => setView(item.id)}
        />
      ))}

      <Separator className="my-2 w-8" />

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
