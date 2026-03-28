/**
 * Agent detail view — Apple App Store inspired.
 * Hero with gradient + icon, metadata ribbon, description, features, functions.
 */
import { memo } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Star, Download, Clock, Box, Play, Pencil, ExternalLink } from 'lucide-react';
import type { GalleryAgent } from './gallery-data';

interface Props {
  agent: GalleryAgent;
  onBack: () => void;
  onOpen?: () => void;
  onEdit?: () => void;
  onInstall?: () => void;
}

function formatNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K`;
  return String(n);
}

export const AgentDetail = memo(function AgentDetail({ agent, onBack, onOpen, onEdit, onInstall }: Props) {
  const isDraft = agent.status === 'draft';
  const isInstalled = agent.status === 'installed';
  const isPublished = agent.status === 'published';

  return (
    <div className="flex-1 overflow-y-auto bg-bg-shell">
      {/* Hero */}
      <div className={cn('relative overflow-hidden bg-gradient-to-b', agent.gradient, 'pb-8 pt-6')}>
        {/* Noise texture */}
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")' }} />

        <div className="relative mx-auto max-w-3xl px-6">
          {/* Back button */}
          <button
            onClick={onBack}
            className="mb-6 flex items-center gap-1.5 text-sm text-white/70 transition-colors hover:text-white"
          >
            <ArrowLeft className="size-4" /> Back
          </button>

          <div className="flex items-start gap-6">
            {/* Icon */}
            <div className="flex size-28 shrink-0 items-center justify-center rounded-[28px] bg-white/10 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)] backdrop-blur-sm">
              <span className="text-6xl">{agent.icon}</span>
            </div>

            {/* Meta */}
            <div className="min-w-0 flex-1 pt-1">
              <h1 className="text-2xl font-bold text-white">{agent.name}</h1>
              <p className="mt-1 text-sm text-white/60">{agent.subtitle}</p>
              <p className="mt-0.5 text-xs text-white/40">{agent.author}</p>

              {/* Action button */}
              <div className="mt-4">
                {isDraft && (
                  <Button onClick={onEdit} className="bg-white/20 text-white backdrop-blur-sm hover:bg-white/30">
                    <Pencil className="mr-1.5 size-4" /> Continue Building
                  </Button>
                )}
                {isInstalled && (
                  <Button onClick={onOpen} className="bg-white/20 text-white backdrop-blur-sm hover:bg-white/30">
                    <Play className="mr-1.5 size-4" /> Open
                  </Button>
                )}
                {isPublished && (
                  <Button onClick={onInstall} className="bg-white text-black hover:bg-white/90">
                    <Download className="mr-1.5 size-4" /> Get
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-3xl px-6">
        {/* Stats ribbon */}
        <div className="-mt-px flex items-center gap-6 rounded-2xl border border-border/50 bg-bg-card px-6 py-4">
          {agent.rating && (
            <Stat
              label="Rating"
              value={
                <span className="flex items-center gap-1">
                  <Star className="size-4 fill-current text-yellow-500" />
                  {agent.rating.toFixed(1)}
                </span>
              }
              sub={agent.ratingCount ? `${formatNumber(agent.ratingCount)} ratings` : undefined}
            />
          )}
          {agent.installs && (
            <Stat label="Installs" value={formatNumber(agent.installs)} />
          )}
          {agent.size && (
            <Stat label="Size" value={agent.size} />
          )}
          <Stat label="Version" value={agent.version} />
          <Stat label="Category" value={agent.category} />
          {agent.lastUpdated && (
            <Stat label="Updated" value={agent.lastUpdated} />
          )}
        </div>

        {/* Description */}
        <section className="mt-8">
          <p className="text-sm leading-relaxed text-text-2">{agent.description}</p>
        </section>

        {/* Features */}
        {agent.features && agent.features.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-4 text-base font-semibold text-text-1">Features</h2>
            <div className="grid grid-cols-2 gap-3">
              {agent.features.map((feature) => (
                <div key={feature} className="flex items-center gap-3 rounded-xl bg-bg-card/50 px-4 py-3">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent/10">
                    <Box className="size-4 text-accent" />
                  </div>
                  <span className="text-sm text-text-1">{feature}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Functions */}
        {agent.functions && agent.functions.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-4 text-base font-semibold text-text-1">Functions</h2>
            <div className="flex flex-wrap gap-2">
              {agent.functions.map((fn) => (
                <Badge key={fn} variant="secondary" className="font-mono text-xs">
                  {fn}()
                </Badge>
              ))}
            </div>
          </section>
        )}

        {/* Information */}
        <section className="mb-12 mt-8">
          <h2 className="mb-4 text-base font-semibold text-text-1">Information</h2>
          <div className="space-y-0 divide-y divide-border/50">
            <InfoRow label="Developer" value={agent.author} />
            <InfoRow label="Category" value={agent.category} />
            <InfoRow label="Version" value={agent.version} />
            {agent.size && <InfoRow label="Size" value={agent.size} />}
            {agent.lastUpdated && <InfoRow label="Last Updated" value={agent.lastUpdated} />}
            <InfoRow label="Status" value={agent.status === 'draft' ? 'In Development' : agent.status === 'installed' ? 'Installed' : 'Available'} />
          </div>
        </section>
      </div>
    </div>
  );
});

function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="flex flex-col items-center text-center">
      <span className="text-[10px] uppercase tracking-wider text-text-3">{label}</span>
      <span className="mt-1 text-sm font-semibold text-text-1">{value}</span>
      {sub && <span className="text-[10px] text-text-3">{sub}</span>}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-3">
      <span className="text-sm text-text-3">{label}</span>
      <span className="text-sm text-text-1">{value}</span>
    </div>
  );
}
