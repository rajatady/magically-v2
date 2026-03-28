/**
 * A category section with header + horizontal scroll of agent cards.
 * Apple App Store "Today" style layout.
 */
import { memo } from 'react';
import { AgentCard, type AgentCardData } from './AgentCard';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { ChevronRight } from 'lucide-react';

interface Props {
  title: string;
  agents: AgentCardData[];
  onOpen?: (id: string) => void;
  onEdit?: (id: string) => void;
  onInstall?: (id: string) => void;
  onSeeAll?: () => void;
}

export const CategorySection = memo(function CategorySection({
  title,
  agents,
  onOpen,
  onEdit,
  onInstall,
  onSeeAll,
}: Props) {
  if (agents.length === 0) return null;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-text-1">{title}</h3>
        {onSeeAll && (
          <button
            onClick={onSeeAll}
            className="flex items-center gap-0.5 text-sm text-accent transition-colors hover:text-accent/80"
          >
            See All <ChevronRight className="size-4" />
          </button>
        )}
      </div>

      <ScrollArea className="w-full">
        <div className="flex gap-4 pb-4">
          {agents.map((agent) => (
            <div key={agent.id} className="w-[200px] shrink-0">
              <AgentCard
                agent={agent}
                onOpen={onOpen}
                onEdit={onEdit}
                onInstall={onInstall}
              />
            </div>
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
});
