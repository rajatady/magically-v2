/**
 * Agent card — used in both "My Agents" and "Explore" tabs.
 * Adapts visually based on agent status (draft, installed, published).
 */
import { memo } from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AgentImage } from './AgentImage';
import { Play, Pencil, Download, Star } from 'lucide-react';

export type AgentStatus = 'draft' | 'installed' | 'published';

export interface AgentCardData {
  id: string;
  name: string;
  description: string;
  icon: string;
  color?: string;
  coverImage?: string | null;
  author?: string;
  category?: string;
  version?: string;
  status: AgentStatus;
  rating?: number;
  installs?: number;
  functions?: string[];
}

interface Props {
  agent: AgentCardData;
  onOpen?: (id: string) => void;
  onEdit?: (id: string) => void;
  onInstall?: (id: string) => void;
  variant?: 'grid' | 'list';
}

const statusConfig = {
  draft: {
    label: 'Draft',
    badgeClass: 'border-dashed border-text-3 text-text-3 bg-transparent',
    cardClass: 'border-dashed border-text-3/30',
    glowClass: '',
  },
  installed: {
    label: 'Installed',
    badgeClass: 'bg-green-500/15 text-green-400 border-green-500/30',
    cardClass: 'border-border',
    glowClass: '',
  },
  published: {
    label: 'Store',
    badgeClass: 'bg-accent/15 text-accent border-accent/30',
    cardClass: 'border-border',
    glowClass: '',
  },
};

export const AgentCard = memo(function AgentCard({
  agent,
  onOpen,
  onEdit,
  onInstall,
  variant = 'grid',
}: Props) {
  const config = statusConfig[agent.status];
  const isDraft = agent.status === 'draft';

  if (variant === 'list') {
    return (
      <div
        className={cn(
          'group flex items-center gap-4 rounded-xl border px-4 py-3 transition-all',
          config.cardClass,
          'bg-bg-card hover:bg-bg-hover',
        )}
      >
        <AgentImage
          src={agent.coverImage}
          alt={agent.name}
          fallbackEmoji={agent.icon}
          className="size-12 shrink-0 rounded-xl"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-text-1">{agent.name}</span>
            <Badge variant="outline" className={cn('text-[10px]', config.badgeClass)}>
              {config.label}
            </Badge>
          </div>
          <p className="mt-0.5 truncate text-xs text-text-3">{agent.description}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {isDraft && onEdit && (
            <Button variant="outline" size="sm" onClick={() => onEdit(agent.id)}>
              <Pencil className="mr-1 size-3" /> Continue
            </Button>
          )}
          {!isDraft && onOpen && (
            <Button variant="outline" size="sm" onClick={() => onOpen(agent.id)}>
              <Play className="mr-1 size-3" /> Open
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-2xl border transition-all',
        'hover:-translate-y-1 hover:shadow-[0_12px_40px_rgba(0,0,0,0.5)]',
        config.cardClass,
        isDraft ? 'bg-bg-panel' : 'bg-bg-card',
      )}
    >
      {/* Cover image / icon area */}
      <div className="relative">
        <AgentImage
          src={agent.coverImage}
          alt={agent.name}
          fallbackEmoji={agent.icon}
          className="w-full"
          aspectRatio="4/3"
        />

        {/* Status badge overlay */}
        <div className="absolute left-3 top-3">
          <Badge variant="outline" className={cn('text-[10px] backdrop-blur-md', config.badgeClass)}>
            {config.label}
          </Badge>
        </div>

        {/* Draft progress overlay */}
        {isDraft && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
            <Button
              size="sm"
              className="bg-accent text-white hover:bg-accent/90"
              onClick={() => onEdit?.(agent.id)}
            >
              <Pencil className="mr-1.5 size-3.5" /> Continue Building
            </Button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-semibold text-text-1">{agent.name}</h3>
            {agent.author && (
              <p className="mt-0.5 text-xs text-text-3">{agent.author}</p>
            )}
          </div>
          {agent.rating && (
            <div className="flex shrink-0 items-center gap-0.5 text-xs text-yellow-500">
              <Star className="size-3 fill-current" />
              <span>{agent.rating.toFixed(1)}</span>
            </div>
          )}
        </div>

        <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-text-2">
          {agent.description}
        </p>

        {agent.category && (
          <div className="mt-3">
            <Badge variant="secondary" className="text-[10px]">
              {agent.category}
            </Badge>
          </div>
        )}

        {/* Action area */}
        <div className="mt-auto flex items-center gap-2 pt-4">
          {isDraft ? (
            <Button
              variant="outline"
              size="sm"
              className="w-full border-dashed"
              onClick={() => onEdit?.(agent.id)}
            >
              <Pencil className="mr-1.5 size-3" /> Continue
            </Button>
          ) : agent.status === 'installed' ? (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => onOpen?.(agent.id)}
            >
              <Play className="mr-1.5 size-3" /> Open
            </Button>
          ) : (
            <Button
              size="sm"
              className="w-full bg-accent text-white hover:bg-accent/90"
              onClick={() => onInstall?.(agent.id)}
            >
              <Download className="mr-1.5 size-3" /> Get
            </Button>
          )}
        </div>
      </div>
    </div>
  );
});
