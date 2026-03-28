import { useNavigate } from 'react-router-dom';
import { useStore } from '../../lib/store';
import { Button } from '@/components/ui/button';
import { filterWidgetAgents, getGreeting } from './HomeView.logic';

export function HomeView() {
  const { agents } = useStore();
  const navigate = useNavigate();
  const widgetAgents = filterWidgetAgents(agents);

  return (
    <div data-testid="home-view" className="flex-1 overflow-y-auto bg-bg-shell p-6">
      <h1 className="mb-6 font-serif text-[28px] font-normal italic text-text-1">
        {getGreeting()} ✨
      </h1>

      {widgetAgents.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-4 items-start gap-3">
          {widgetAgents.map((agent) => (
            <WidgetCard
              key={agent.id}
              agent={agent}
              onClick={() => navigate(`/agents/${agent.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function WidgetCard({
  agent,
  onClick,
}: {
  agent: { id: string; name: string; icon?: string; color?: string };
  onClick: () => void;
}) {
  return (
    <div
      data-testid={`widget-${agent.id}`}
      onClick={onClick}
      className="min-h-[120px] cursor-pointer rounded-xl border border-border bg-bg-card p-4 transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(0,0,0,0.4)]"
    >
      <div className="mb-2 flex items-center gap-2">
        <span className="text-lg">{agent.icon ?? '◇'}</span>
        <span className="text-[13px] font-medium text-text-2">{agent.name}</span>
      </div>
      <div className="text-xs text-text-3">Click to open</div>
    </div>
  );
}

function EmptyState() {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center gap-4 pt-20 text-center text-text-3">
      <div className="text-5xl">✨</div>
      <h2 className="text-xl font-medium text-text-2">Your home screen is empty</h2>
      <p className="max-w-xs text-sm">
        Ask Zeus to build your first agent, or browse the Gallery to find one.
      </p>
      <Button onClick={() => navigate('/zeus')} className="mt-2">
        Ask Zeus
      </Button>
    </div>
  );
}
