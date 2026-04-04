/**
 * Agent Gallery — editorial luxury. Apple "Today" tab meets dark OS.
 * Two tabs: My Agents (dashboard-style list), Explore (magazine layout).
 */
import { memo, useState, useCallback, useMemo, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Search, Plus, ChevronRight, Sparkles } from 'lucide-react';
import { useStore } from '@/lib/store';
import type { AgentSummary } from '@/lib/api';
import { agents as agentsApi } from '@/lib/api';
import { AgentCard, HeroStoryCard, EditorialCard, MyAgentRow } from './AgentCard';
import { exploreAgents, categories, type GalleryAgent } from './gallery-data';

const COLOR_TO_GRADIENT: Record<string, string> = {
  '#6366f1': 'from-indigo-500 to-violet-700',
  '#10b981': 'from-emerald-500 to-teal-700',
  '#f59e0b': 'from-amber-500 to-orange-700',
  '#ef4444': 'from-red-500 to-rose-700',
  '#3b82f6': 'from-blue-500 to-cyan-700',
  '#8b5cf6': 'from-violet-500 to-purple-700',
  '#ec4899': 'from-pink-500 to-fuchsia-700',
  '#f97316': 'from-orange-500 to-red-700',
  '#14b8a6': 'from-teal-500 to-cyan-700',
};

/** Map a real AgentSummary from the API to the GalleryAgent display shape */
function toGalleryAgent(a: AgentSummary): GalleryAgent {
  const gradient = (a.color && COLOR_TO_GRADIENT[a.color]) ?? 'from-indigo-500 to-violet-700';
  return {
    id: a.id,
    name: a.name,
    subtitle: a.description ?? '',
    description: a.description ?? '',
    icon: a.icon ?? '◇',
    color: a.color ?? '#6366f1',
    gradient,
    author: a.author ?? 'You',
    category: a.category ?? 'My Agents',
    version: a.version,
    status: a.status === 'live' ? 'installed' : 'draft',
    functions: a.functions?.map((f) => f.name) ?? [],
  };
}

export const GalleryView = memo(function GalleryView() {
  const navigate = useNavigate();
  const location = useLocation();
  const { agents: storeAgents } = useStore(); // used as fallback in mine() catch
  const tab = location.pathname === '/gallery/explore' ? 'explore' : 'my';
  const setTab = useCallback((t: 'my' | 'explore') => {
    navigate(t === 'explore' ? '/gallery/explore' : '/gallery', { replace: true });
  }, [navigate]);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [myAgentsData, setMyAgentsData] = useState<AgentSummary[]>([]);

  // Load the user's own agents (drafts + live) from API
  useEffect(() => {
    agentsApi.mine()
      .then(setMyAgentsData)
      .catch(() => {
        // Fallback to store agents (only live) if endpoint unavailable
        setMyAgentsData(storeAgents);
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const myAgents = useMemo(() => myAgentsData.map(toGalleryAgent), [myAgentsData]);

  const handleNewAgent = useCallback(() => {
    navigate('/zeus');
  }, [navigate]);

  const handleOpen = useCallback((agent: GalleryAgent) => {
    navigate(`/gallery/${agent.id}`);
  }, [navigate]);

  const handleEdit = useCallback(() => {
    navigate('/zeus');
  }, [navigate]);

  // Filter
  const filteredExplore = useMemo(() => exploreAgents.filter((a) => {
    const matchCat = activeCategory === 'All' || a.category === activeCategory;
    const q = search.toLowerCase();
    const matchSearch = !search || a.name.toLowerCase().includes(q) || a.description.toLowerCase().includes(q) || a.category.toLowerCase().includes(q);
    return matchCat && matchSearch;
  }), [activeCategory, search]);

  const filteredMy = useMemo(() => myAgents.filter((a) =>
    !search || a.name.toLowerCase().includes(search.toLowerCase()),
  ), [search, myAgents]);

  // Group explore by category
  const exploreByCategory = useMemo(() => {
    const map: Record<string, GalleryAgent[]> = {};
    for (const a of filteredExplore) {
      if (!map[a.category]) map[a.category] = [];
      map[a.category].push(a);
    }
    return map;
  }, [filteredExplore]);

  // Top rated for hero + editorial
  const topRated = useMemo(() =>
    [...exploreAgents].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0)),
  []);
  const heroAgent = topRated[0];
  const editorialPicks = topRated.slice(1, 4);

  return (
    <div className="flex-1 overflow-y-auto bg-bg-shell">
      <div className="mx-auto max-w-[960px] px-4 pb-16 pt-8 sm:px-6 sm:pt-10">

        {/* ─── Header ──────────────────────────────────────── */}
        <div className="mb-8 flex items-end justify-between sm:mb-10">
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-text-3 sm:text-[11px]">
              Gallery
            </p>
            <h1 className="font-serif text-[32px] font-normal italic leading-none text-text-1 sm:text-[40px]">
              {tab === 'my' ? 'My Agents' : 'Explore'}
            </h1>
          </div>
          <Button
            onClick={handleNewAgent}
            size="sm"
            className="cursor-pointer rounded-full bg-accent px-4 text-white shadow-[0_0_20px_rgba(249,115,22,0.2)] transition-all hover:bg-accent/90 hover:shadow-[0_0_30px_rgba(249,115,22,0.3)] sm:px-5"
          >
            <Plus className="mr-1.5 size-3.5" /> New Agent
          </Button>
        </div>

        {/* ─── Tab bar + search ────────────────────────────── */}
        <div className="mb-8 flex flex-col gap-3 sm:mb-10 sm:flex-row sm:items-center sm:gap-2">
          {/* Segmented control */}
          <div className="flex rounded-xl bg-bg-card/60 p-1">
            <TabPill active={tab === 'my'} onClick={() => setTab('my')}>My Agents</TabPill>
            <TabPill active={tab === 'explore'} onClick={() => setTab('explore')}>Explore</TabPill>
          </div>

          <div className="relative sm:ml-auto">
            <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-text-3" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search agents..."
              className="h-9 w-full rounded-xl border-none bg-bg-card/60 pl-9 text-[13px] text-text-1 placeholder:text-text-3/60 focus-visible:ring-1 focus-visible:ring-accent/30 sm:w-60"
            />
          </div>
        </div>

        {/* ═══ My Agents Tab ═══════════════════════════════════ */}
        {tab === 'my' && (
          <>
            {filteredMy.length === 0 ? (
              <EmptyState onNew={handleNewAgent} />
            ) : (
              <div className="space-y-1">
                {/* Section header */}
                <div className="mb-4 flex items-center justify-between px-3 sm:px-4">
                  <span className="text-[13px] font-semibold text-text-1">
                    {filteredMy.length} agent{filteredMy.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {/* Agent list */}
                <div className="divide-y divide-border/30">
                  {filteredMy.map((agent) => (
                    <MyAgentRow
                      key={agent.id}
                      agent={agent}
                      onClick={() => agent.status === 'draft' ? handleEdit() : handleOpen(agent)}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* ═══ Explore Tab ═════════════════════════════════════ */}
        {tab === 'explore' && (
          <>
            {/* ── Hero Story ─────────────────────────────────── */}
            {heroAgent && activeCategory === 'All' && !search && (
              <section className="mb-8 sm:mb-10">
                <HeroStoryCard agent={heroAgent} onClick={() => handleOpen(heroAgent)} />
              </section>
            )}

            {/* ── Editorial picks ─────────────────────────────── */}
            {editorialPicks.length > 0 && activeCategory === 'All' && !search && (
              <section className="mb-10 sm:mb-12">
                <SectionHeader title="Editor's Choice" />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
                  {editorialPicks.map((agent) => (
                    <EditorialCard key={agent.id} agent={agent} onClick={() => handleOpen(agent)} />
                  ))}
                </div>
              </section>
            )}

            {/* ── Category pills ──────────────────────────────── */}
            <div className="mb-8 sm:mb-10">
              <ScrollArea className="w-full">
                <div className="flex gap-2 pb-2">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setActiveCategory(cat)}
                      className={`shrink-0 cursor-pointer rounded-full px-3.5 py-1.5 text-[11px] font-medium tracking-wide transition-all duration-300 sm:px-4 sm:py-2 sm:text-[12px] ${
                        activeCategory === cat
                          ? 'bg-text-1 text-bg-shell shadow-[0_0_20px_rgba(244,244,245,0.08)]'
                          : 'bg-bg-card/50 text-text-3 hover:bg-bg-card hover:text-text-2'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </div>

            {/* ── Category sections or filtered grid ──────────── */}
            {activeCategory === 'All' && !search ? (
              <div className="space-y-10 sm:space-y-12">
                {Object.entries(exploreByCategory).map(([category, agents]) => (
                  <section key={category}>
                    <div className="mb-4 flex items-center justify-between sm:mb-5">
                      <SectionHeader title={category} />
                      <button
                        onClick={() => setActiveCategory(category)}
                        className="flex cursor-pointer items-center gap-0.5 text-[12px] font-medium text-accent transition-colors hover:text-accent/80"
                      >
                        See All <ChevronRight className="size-3.5" />
                      </button>
                    </div>
                    <ScrollArea className="w-full">
                      <div className="flex gap-3 pb-4 sm:gap-4">
                        {agents.map((agent) => (
                          <AgentCard key={agent.id} agent={agent} onClick={() => handleOpen(agent)} />
                        ))}
                      </div>
                      <ScrollBar orientation="horizontal" />
                    </ScrollArea>
                  </section>
                ))}
              </div>
            ) : (
              <>
                {filteredExplore.length === 0 ? (
                  <div className="py-20 text-center">
                    <p className="text-sm text-text-3">No agents found</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-6 md:grid-cols-4 lg:grid-cols-5">
                    {filteredExplore.map((agent) => (
                      <AgentCard key={agent.id} agent={agent} onClick={() => handleOpen(agent)} />
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
});

/* ─── Section Header ────────────────────────────────────────────────────── */

function SectionHeader({ title }: { title: string }) {
  return (
    <h2 className="text-[14px] font-semibold tracking-tight text-text-1 sm:text-[15px]">{title}</h2>
  );
}

/* ─── Segmented Tab Pill ────────────────────────────────────────────────── */

function TabPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`cursor-pointer rounded-lg px-4 py-2 text-[13px] font-medium transition-all duration-300 sm:px-5 ${
        active
          ? 'bg-bg-hover text-text-1 shadow-sm'
          : 'text-text-3 hover:text-text-2'
      }`}
    >
      {children}
    </button>
  );
}

/* ─── Empty State ───────────────────────────────────────────────────────── */

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-5 py-20 text-center sm:py-28">
      {/* Glowing orb */}
      <div className="relative flex size-24 items-center justify-center">
        <div className="absolute inset-0 animate-pulse rounded-full bg-accent/10 blur-xl" />
        <div className="relative flex size-20 items-center justify-center rounded-3xl bg-gradient-to-br from-accent/20 to-accent/5 shadow-[inset_0_0_0_1px_rgba(249,115,22,0.1)]">
          <Sparkles className="size-8 text-accent/70" />
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-text-1">No agents yet</h2>
        <p className="mx-auto mt-1.5 max-w-[280px] text-[13px] leading-relaxed text-text-3">
          Build your first agent with Zeus, or explore the gallery to find one.
        </p>
      </div>

      <Button
        onClick={onNew}
        className="mt-1 cursor-pointer rounded-full bg-accent px-6 text-white shadow-[0_0_20px_rgba(249,115,22,0.2)] hover:bg-accent/90 hover:shadow-[0_0_30px_rgba(249,115,22,0.3)]"
      >
        <Plus className="mr-1.5 size-3.5" /> Build with Zeus
      </Button>
    </div>
  );
}
