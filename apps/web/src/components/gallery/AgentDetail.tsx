/**
 * Agent detail — monumental with scroll-driven effects.
 * Sticky glass nav bar, parallax hero, responsive stats grid.
 */
import { memo, useRef, useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  ArrowLeft,
  Star,
  Download,
  Box,
  Play,
  Pencil,
  Users,
  Calendar,
  HardDrive,
  Tag,
  Layers,
  Shield,
  ChevronRight,
} from 'lucide-react';
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

  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollY, setScrollY] = useState(0);

  const handleScroll = useCallback(() => {
    if (scrollRef.current) {
      setScrollY(scrollRef.current.scrollTop);
    }
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  // Parallax values
  const heroProgress = Math.min(scrollY / 300, 1);
  const parallaxY = scrollY * 0.4;
  const heroScale = 1 + heroProgress * 0.05;
  const heroOpacity = 1 - heroProgress * 0.7;
  const navVisible = scrollY > 120;

  return (
    <div ref={scrollRef} className="relative flex-1 overflow-y-auto bg-bg-shell">

      {/* ═══ Sticky glass nav bar ═════════════════════════════ */}
      <div
        className={cn(
          'sticky top-0 z-50 flex items-center gap-3 border-b px-4 py-3 transition-all duration-300 sm:px-6',
          navVisible
            ? 'border-border/30 bg-bg-shell/70 backdrop-blur-xl backdrop-saturate-150'
            : 'border-transparent bg-transparent',
        )}
      >
        <button
          onClick={onBack}
          className="flex cursor-pointer items-center gap-1.5 text-[13px] text-text-2 transition-colors hover:text-text-1"
        >
          <ArrowLeft className="size-4" />
          <span className={cn('transition-opacity duration-300', navVisible ? 'opacity-100' : 'opacity-0')}>
            Gallery
          </span>
        </button>

        {/* Compact agent info — fades in as hero scrolls away */}
        <div
          className={cn(
            'flex flex-1 items-center justify-center gap-2 transition-all duration-300',
            navVisible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0',
          )}
        >
          <span className="text-lg">{agent.icon}</span>
          <span className="text-[13px] font-semibold text-text-1">{agent.name}</span>
        </div>

        {/* Nav action button — fades in */}
        <div className={cn('transition-all duration-300', navVisible ? 'opacity-100' : 'pointer-events-none opacity-0')}>
          {isDraft && (
            <Button size="sm" onClick={onEdit} className="cursor-pointer rounded-full bg-accent/15 text-[12px] text-accent hover:bg-accent/25">
              Continue
            </Button>
          )}
          {isInstalled && (
            <Button size="sm" onClick={onOpen} className="cursor-pointer rounded-full bg-accent/15 text-[12px] text-accent hover:bg-accent/25">
              Open
            </Button>
          )}
          {isPublished && (
            <Button size="sm" onClick={onInstall} className="cursor-pointer rounded-full bg-text-1 text-[12px] text-bg-shell hover:bg-white">
              Get
            </Button>
          )}
        </div>
      </div>

      {/* ═══ Hero ═══════════════════════════════════════════════ */}
      <div className="relative -mt-[52px] overflow-hidden pt-[52px]">
        {/* Parallax gradient background */}
        <div
          className={cn('absolute inset-0 bg-gradient-to-b', agent.gradient)}
          style={{
            transform: `translateY(-${parallaxY}px) scale(${heroScale})`,
            opacity: heroOpacity,
            willChange: 'transform, opacity',
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-bg-shell via-bg-shell/50 to-transparent" />

        {/* Noise texture */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")',
          }}
        />

        <div className="relative z-10 mx-auto max-w-[720px] px-4 pb-10 pt-10 sm:px-6 sm:pb-14 sm:pt-16">
          {/* Icon — monumental, centered */}
          <div
            className="flex flex-col items-center text-center"
            style={{
              transform: `translateY(-${parallaxY * 0.2}px)`,
              opacity: Math.max(1 - heroProgress * 1.2, 0),
              willChange: 'transform, opacity',
            }}
          >
            <div className="flex size-24 items-center justify-center rounded-[24px] bg-white/10 shadow-[0_8px_40px_rgba(0,0,0,0.3),inset_0_0_0_1px_rgba(255,255,255,0.12)] backdrop-blur-md sm:size-32 sm:rounded-[32px]">
              <span className="text-5xl drop-shadow-[0_4px_12px_rgba(0,0,0,0.3)] sm:text-7xl">{agent.icon}</span>
            </div>

            <h1 className="mt-5 font-serif text-[28px] font-normal italic leading-tight text-text-1 sm:mt-6 sm:text-[36px]">
              {agent.name}
            </h1>
            <p className="mt-1.5 text-[14px] text-text-2 sm:mt-2 sm:text-[15px]">{agent.subtitle}</p>
            <p className="mt-1 text-[12px] text-text-3 sm:text-[13px]">{agent.author}</p>

            {/* Primary action */}
            <div className="mt-6">
              {isDraft && (
                <Button
                  onClick={onEdit}
                  className="cursor-pointer rounded-full bg-white/15 px-6 text-white backdrop-blur-sm transition-all hover:bg-white/25 hover:shadow-[0_0_30px_rgba(255,255,255,0.1)] sm:px-8"
                >
                  <Pencil className="mr-2 size-4" /> Continue Building
                </Button>
              )}
              {isInstalled && (
                <Button
                  onClick={onOpen}
                  className="cursor-pointer rounded-full bg-white/15 px-6 text-white backdrop-blur-sm transition-all hover:bg-white/25 hover:shadow-[0_0_30px_rgba(255,255,255,0.1)] sm:px-8"
                >
                  <Play className="mr-2 size-4" /> Open
                </Button>
              )}
              {isPublished && (
                <Button
                  onClick={onInstall}
                  className="cursor-pointer rounded-full bg-text-1 px-6 text-bg-shell shadow-[0_0_30px_rgba(244,244,245,0.15)] transition-all hover:bg-white hover:shadow-[0_0_40px_rgba(244,244,245,0.2)] sm:px-8"
                >
                  <Download className="mr-2 size-4" /> Get
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ═══ Content ════════════════════════════════════════════ */}
      <div className="mx-auto max-w-[720px] px-4 sm:px-6">

        {/* ── Stats ribbon — responsive grid ───────────────── */}
        {/* Mobile: 3 (hide size + category) · Tablet: 4 (hide category) · Desktop: 5 */}
        <div className="-mt-2 grid grid-cols-3 gap-px overflow-hidden rounded-2xl border border-border/30 bg-border/20 sm:grid-cols-4 lg:grid-cols-5">
          {agent.rating && (
            <StatCell
              icon={<Star className="size-3.5 fill-yellow-500/80 text-yellow-500/80 sm:size-4" />}
              value={agent.rating.toFixed(1)}
              label={agent.ratingCount ? `${formatNumber(agent.ratingCount)} ratings` : 'Rating'}
            />
          )}
          {agent.installs && (
            <StatCell
              icon={<Download className="size-3.5 text-text-3 sm:size-4" />}
              value={formatNumber(agent.installs)}
              label="Installs"
            />
          )}
          {agent.size && (
            <StatCell
              icon={<HardDrive className="size-3.5 text-text-3 sm:size-4" />}
              value={agent.size}
              label="Size"
              className="hidden sm:flex"
            />
          )}
          <StatCell
            icon={<Tag className="size-3.5 text-text-3 sm:size-4" />}
            value={agent.version}
            label="Version"
          />
          <StatCell
            icon={<Layers className="size-3.5 text-text-3 sm:size-4" />}
            value={agent.category}
            label="Category"
            className="hidden lg:flex"
          />
        </div>

        {/* ── Description ───────────────────────────────────── */}
        <section className="mt-8 sm:mt-10">
          <p className="text-[14px] leading-[1.7] text-text-2 sm:text-[15px]">
            {agent.description}
          </p>
        </section>

        {/* ── What's Included (Features) ────────────────────── */}
        {agent.features && agent.features.length > 0 && (
          <section className="mt-8 sm:mt-10">
            <h2 className="mb-4 text-[12px] font-semibold uppercase tracking-[0.15em] text-text-3 sm:mb-5 sm:text-[13px]">
              What's Included
            </h2>
            <div className="space-y-0 divide-y divide-border/20">
              {agent.features.map((feature) => (
                <div key={feature} className="flex items-center gap-3 py-3 sm:gap-4 sm:py-4">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent/10 sm:size-9 sm:rounded-xl">
                    <Box className="size-3.5 text-accent sm:size-4" />
                  </div>
                  <span className="flex-1 text-[13px] text-text-1 sm:text-[14px]">{feature}</span>
                  <ChevronRight className="size-4 text-text-3/40" />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ���─ Functions (API surface) ───────────────────────── */}
        {agent.functions && agent.functions.length > 0 && (
          <section className="mt-8 sm:mt-10">
            <h2 className="mb-4 text-[12px] font-semibold uppercase tracking-[0.15em] text-text-3 sm:mb-5 sm:text-[13px]">
              Functions
            </h2>
            <div className="flex flex-wrap gap-2">
              {agent.functions.map((fn) => (
                <div
                  key={fn}
                  className="rounded-lg bg-bg-card/80 px-3 py-1.5 font-mono text-[11px] text-text-2 transition-colors hover:bg-bg-hover hover:text-text-1 sm:px-3.5 sm:py-2 sm:text-[12px]"
                >
                  {fn}()
                </div>
              ))}
            </div>
          </section>
        )}

        <Separator className="my-8 bg-border/20 sm:my-10" />

        {/* ── Information table ──────────────────────────────── */}
        <section className="mb-12 sm:mb-16">
          <h2 className="mb-4 text-[12px] font-semibold uppercase tracking-[0.15em] text-text-3 sm:mb-5 sm:text-[13px]">
            Information
          </h2>
          <div className="space-y-0 divide-y divide-border/20">
            <InfoRow icon={<Users className="size-4" />} label="Developer" value={agent.author} />
            <InfoRow icon={<Layers className="size-4" />} label="Category" value={agent.category} />
            <InfoRow icon={<Tag className="size-4" />} label="Version" value={agent.version} />
            {agent.size && <InfoRow icon={<HardDrive className="size-4" />} label="Size" value={agent.size} />}
            {agent.lastUpdated && <InfoRow icon={<Calendar className="size-4" />} label="Last Updated" value={agent.lastUpdated} />}
            <InfoRow
              icon={<Shield className="size-4" />}
              label="Status"
              value={isDraft ? 'In Development' : isInstalled ? 'Installed' : 'Available'}
            />
          </div>
        </section>
      </div>
    </div>
  );
});

/* ─── Stat Cell (grid-based, glassmorphic) ──────────────────────────────── */

function StatCell({ icon, value, label, className }: { icon: React.ReactNode; value: string; label: string; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center gap-0.5 bg-bg-card/50 px-2 py-3 backdrop-blur-sm sm:gap-1 sm:px-4 sm:py-4', className)}>
      {icon}
      <span className="mt-0.5 text-[12px] font-semibold text-text-1 sm:text-[14px]">{value}</span>
      <span className="text-center text-[9px] leading-tight text-text-3 sm:text-[10px]">{label}</span>
    </div>
  );
}

/* ─── Info Row ──────────────────────────────────────────────────────────── */

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 py-3 sm:py-3.5">
      <span className="text-text-3/60">{icon}</span>
      <span className="flex-1 text-[12px] text-text-3 sm:text-[13px]">{label}</span>
      <span className="text-[12px] font-medium text-text-1 sm:text-[13px]">{value}</span>
    </div>
  );
}
