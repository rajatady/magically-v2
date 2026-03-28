import { useParams, useNavigate } from 'react-router-dom';
import { AgentDetail } from './AgentDetail';
import { myAgents, exploreAgents } from './gallery-data';

const allAgents = [...myAgents, ...exploreAgents];

export function GalleryDetailRoute() {
  const { agentId } = useParams<{ agentId: string }>();
  const navigate = useNavigate();

  const agent = allAgents.find((a) => a.id === agentId);

  if (!agent) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <p className="text-4xl">◇</p>
        <p className="text-sm font-medium text-text-2">Agent not found</p>
        <button
          onClick={() => navigate('/gallery')}
          className="cursor-pointer text-xs text-accent hover:text-accent/80"
        >
          ← Back to Gallery
        </button>
      </div>
    );
  }

  return (
    <AgentDetail
      agent={agent}
      onBack={() => navigate('/gallery')}
      onOpen={() => {}}
      onEdit={() => navigate('/zeus')}
      onInstall={() => {}}
    />
  );
}
