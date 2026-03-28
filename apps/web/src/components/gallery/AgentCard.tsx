/**
 * Agent cards — editorial luxury.
 * Three variants: compact grid card, editorial hero card, list row.
 */
import { memo } from 'react';
import { cn } from '@/lib/utils';
import { Star, Download, ArrowUpRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { GalleryAgent } from './gallery-data';

interface Props {
  agent: GalleryAgent;
  onClick?: () => void;
}

function formatNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K`;
  return String(n);
}

/* ─── Grid Card ─────────────────────────────────────────────────────────── */

export const AgentCard = memo(function AgentCard({ agent, onClick }: Props) {
  const isDraft = agent.status === 'draft';

  return (
    <button
      onClick={onClick}
      className={cn(
        'group flex w-[140px] shrink-0 cursor-pointer flex-col text-left transition-all duration-500 ease-out sm:w-[168px]',
        'hover:-translate-y-1.5',
      )}
    >
      {/* Icon — gradient square with inset glow */}
      <div
        className={cn(
          'relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-[24px] bg-gradient-to-br transition-all duration-500',
          agent.gradient,
          isDraft && 'opacity-50 saturate-50',
          'shadow-[0_2px_12px_rgba(0,0,0,0.3)]',
          'group-hover:shadow-[0_12px_40px_rgba(0,0,0,0.5)]',
        )}
      >
        {/* Inner highlight */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/15 via-transparent to-black/20" />

        <span className="relative z-10 text-5xl drop-shadow-[0_2px_8px_rgba(0,0,0,0.3)] transition-transform duration-500 ease-out group-hover:scale-110">
          {agent.icon}
        </span>

        {isDraft && (
          <div className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-medium text-white/70 backdrop-blur-md">
            <Sparkles className="size-2.5" />
            Building
          </div>
        )}
      </div>

      {/* Label */}
      <div className="mt-3 px-0.5">
        <h3 className="truncate text-[13px] font-semibold tracking-tight text-text-1">
          {agent.name}
        </h3>
        <p className="mt-0.5 truncate text-[11px] leading-snug text-text-3">
          {agent.subtitle}
        </p>

        {!isDraft && agent.rating && (
          <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-text-3">
            <Star className="size-2.5 fill-yellow-500/90 text-yellow-500/90" />
            <span className="font-medium text-text-2">{agent.rating.toFixed(1)}</span>
            {agent.installs && (
              <span className="text-text-3/60">{formatNumber(agent.installs)}</span>
            )}
          </div>
        )}
      </div>
    </button>
  );
});

/* ─── Hero Story Card (full-width editorial) ────────────────────────────── */

export const HeroStoryCard = memo(function HeroStoryCard({ agent, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className="group relative flex min-h-[220px] w-full cursor-pointer overflow-hidden rounded-[20px] text-left transition-all duration-500 hover:shadow-[0_20px_60px_rgba(0,0,0,0.5)] sm:min-h-[280px] sm:rounded-[28px]"
    >
      {/* Background gradient */}
      <div className={cn('absolute inset-0 bg-gradient-to-br', agent.gradient)} />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/40 to-transparent" />

      {/* Noise texture */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")',
        }}
      />

      {/* Content — positioned bottom-left */}
      <div className="relative z-10 flex flex-1 flex-col justify-end p-5 sm:p-8">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/50 sm:mb-3 sm:text-[11px]">
          Featured
        </p>

        <div className="flex items-end gap-4 sm:gap-5">
          {/* Icon */}
          <div className="flex size-14 shrink-0 items-center justify-center rounded-[14px] bg-white/10 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)] backdrop-blur-md transition-transform duration-500 group-hover:scale-105 sm:size-20 sm:rounded-[20px]">
            <span className="text-3xl drop-shadow-[0_2px_8px_rgba(0,0,0,0.3)] sm:text-[44px]">{agent.icon}</span>
          </div>

          <div className="min-w-0 flex-1">
            <h2 className="font-serif text-xl font-normal italic leading-tight text-white sm:text-[28px]">
              {agent.name}
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-white/60 sm:text-sm">
              {agent.subtitle}
            </p>
            <div className="mt-3 flex items-center gap-3">
              {agent.rating && (
                <span className="flex items-center gap-1 text-xs text-white/50">
                  <Star className="size-3 fill-yellow-400/80 text-yellow-400/80" />
                  {agent.rating.toFixed(1)}
                </span>
              )}
              {agent.installs && (
                <span className="text-xs text-white/40">
                  {formatNumber(agent.installs)} installs
                </span>
              )}
              <span className="text-xs text-white/30">{agent.category}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Hover arrow */}
      <div className="absolute right-6 top-6 flex size-10 items-center justify-center rounded-full bg-white/10 opacity-0 backdrop-blur-sm transition-all duration-300 group-hover:opacity-100">
        <ArrowUpRight className="size-5 text-white" />
      </div>
    </button>
  );
});

/* ─── Editorial Card (medium, for featured rows) ────────────────────────── */

export const EditorialCard = memo(function EditorialCard({ agent, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className="group flex w-full cursor-pointer overflow-hidden rounded-[20px] text-left transition-all duration-400 hover:shadow-[0_12px_40px_rgba(0,0,0,0.4)]"
    >
      {/* Gradient background — constrained height */}
      <div className="relative flex h-[180px] w-full flex-col">
        <div className={cn('absolute inset-0 bg-gradient-to-br', agent.gradient)} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

        <div className="relative z-10 flex flex-1 flex-col justify-end p-5">
          <div className="flex items-center gap-3">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-[14px] bg-white/15 backdrop-blur-sm">
              <span className="text-2xl">{agent.icon}</span>
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-[15px] font-semibold text-white">{agent.name}</h3>
              <p className="mt-0.5 truncate text-xs text-white/55">{agent.subtitle}</p>
            </div>
          </div>
        </div>
      </div>
    </button>
  );
});

/* ─── My Agent Row (rich list item) ─────────────────────────────────────── */

export const MyAgentRow = memo(function MyAgentRow({ agent, onClick }: Props) {
  const isDraft = agent.status === 'draft';

  return (
    <button
      onClick={onClick}
      className="group flex w-full cursor-pointer items-center gap-3 rounded-2xl px-3 py-3 text-left transition-all duration-300 hover:bg-bg-card/70 sm:gap-4 sm:px-4 sm:py-3.5"
    >
      {/* Icon */}
      <div
        className={cn(
          'flex size-14 shrink-0 items-center justify-center rounded-[16px] bg-gradient-to-br shadow-[0_2px_8px_rgba(0,0,0,0.2)] transition-transform duration-300 group-hover:scale-105',
          agent.gradient,
          isDraft && 'opacity-60 saturate-50',
        )}
      >
        <span className="text-2xl drop-shadow-[0_1px_4px_rgba(0,0,0,0.3)]">{agent.icon}</span>
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="truncate text-sm font-semibold text-text-1">{agent.name}</h3>
          {isDraft && (
            <span className="rounded-md bg-accent/15 px-1.5 py-0.5 text-[10px] font-medium text-accent">
              Draft
            </span>
          )}
        </div>
        <p className="mt-0.5 truncate text-xs text-text-3">{agent.subtitle}</p>
        <div className="mt-1 flex items-center gap-3 text-[11px] text-text-3">
          <span>{agent.category}</span>
          <span className="text-text-3/40">v{agent.version}</span>
          {agent.lastUpdated && (
            <span className="text-text-3/40">{agent.lastUpdated}</span>
          )}
        </div>
      </div>

      {/* Right side — action hint */}
      <div className="shrink-0">
        {isDraft ? (
          <Button size="sm" variant="outline" className="h-8 rounded-full border-accent/30 text-[12px] text-accent hover:bg-accent/10">
            Continue
          </Button>
        ) : (
          <Button size="sm" variant="ghost" className="h-8 rounded-full text-[12px] text-text-2">
            Open
          </Button>
        )}
      </div>
    </button>
  );
});

/* ─── Compact Row (for search results) ──────────────────────────────────── */

export const AgentRow = memo(function AgentRow({ agent, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className="group flex w-full cursor-pointer items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-bg-card/60"
    >
      <div
        className={cn(
          'flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br',
          agent.gradient,
        )}
      >
        <span className="text-xl">{agent.icon}</span>
      </div>
      <div className="min-w-0 flex-1">
        <span className="truncate text-sm font-medium text-text-1">{agent.name}</span>
        <p className="truncate text-xs text-text-3">{agent.subtitle}</p>
      </div>
      {agent.rating && (
        <div className="flex shrink-0 items-center gap-1 text-[11px] text-text-3">
          <Star className="size-3 fill-current text-yellow-500" />
          {agent.rating.toFixed(1)}
        </div>
      )}
    </button>
  );
});
