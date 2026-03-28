import { useParams } from 'react-router-dom';
import { useStore } from '../../lib/store';
import { useAuthStore } from '../../lib/auth';
import { BASE_URL } from '../../lib/api';

export function AgentView() {
  const { agentId } = useParams<{ agentId: string }>();
  const { agents } = useStore();
  const token = useAuthStore((s) => s.token);
  const agent = agents.find((a) => a.id === agentId);

  if (!agent) {
    return (
      <div className="flex flex-1 items-center justify-center text-text-3">
        Agent not found
      </div>
    );
  }

  const hasUi = agent.functions.length > 0 || 'ui' in agent;

  if (!hasUi) {
    return (
      <div data-testid="agent-view" className="flex flex-1 flex-col overflow-hidden">
        <AgentHeader agent={agent} />
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-text-3">
          <span className="text-5xl">{agent.icon ?? '◇'}</span>
          <span className="text-base font-medium">{agent.name}</span>
          <span className="text-[13px]">{agent.description ?? 'No UI configured for this agent'}</span>
        </div>
      </div>
    );
  }

  const src = `${BASE_URL}/agents/${agent.id}/ui?token=${encodeURIComponent(token ?? '')}`;

  return (
    <div data-testid="agent-view" className="flex flex-1 flex-col overflow-hidden">
      <AgentHeader agent={agent} />
      <iframe
        data-testid={`agent-iframe-${agent.id}`}
        src={src}
        data-agent-id={agent.id}
        title={agent.name}
        sandbox="allow-scripts allow-forms allow-same-origin"
        className="w-full flex-1 border-none bg-bg-shell"
      />
    </div>
  );
}

function AgentHeader({ agent }: { agent: { icon?: string; name: string; color?: string } }) {
  return (
    <div className="flex h-12 shrink-0 items-center gap-2.5 border-b border-border bg-bg-panel px-5">
      <span className="text-lg">{agent.icon ?? '◇'}</span>
      <span className="text-[15px] font-semibold">{agent.name}</span>
      {agent.color && (
        <span
          className="size-2 shrink-0 rounded-full"
          style={{ background: agent.color }}
        />
      )}
    </div>
  );
}
