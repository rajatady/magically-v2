/**
 * Agent Gallery — Dreamer-inspired, Apple App Store layout.
 * Two tabs: My Agents, Explore. Detail view inline.
 */
import { memo, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/lib/store';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Search, Plus, ChevronRight } from 'lucide-react';
import { AgentCard, FeaturedAgentCard, AgentRow } from './AgentCard';
import { AgentDetail } from './AgentDetail';
import { myAgents, exploreAgents, categories, type GalleryAgent } from './gallery-data';

export const GalleryView = memo(function GalleryView() {
  const [tab, setTab] = useState<'my' | 'explore'>('my');
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [selectedAgent, setSelectedAgent] = useState<GalleryAgent | null>(null);
  const navigate = useNavigate();
  const { toggleZeus } = useStore();

  const handleNewAgent = useCallback(() => {
    navigate('/zeus');
    if (!useStore.getState().zeusOpen) toggleZeus();
  }, [navigate, toggleZeus]);

  const handleOpen = useCallback((agent: GalleryAgent) => {
    setSelectedAgent(agent);
  }, []);

  const handleEdit = useCallback((agent: GalleryAgent) => {
    navigate('/zeus');
    if (!useStore.getState().zeusOpen) toggleZeus();
  }, [navigate, toggleZeus]);

  // Filter
  const filteredExplore = useMemo(() => exploreAgents.filter((a) => {
    const matchCat = activeCategory === 'All' || a.category === activeCategory;
    const matchSearch = !search || a.name.toLowerCase().includes(search.toLowerCase()) || a.description.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  }), [activeCategory, search]);

  const filteredMy = useMemo(() => myAgents.filter((a) =>
    !search || a.name.toLowerCase().includes(search.toLowerCase()),
  ), [search]);

  // Group explore by category
  const exploreByCategory = useMemo(() => {
    const map: Record<string, GalleryAgent[]> = {};
    for (const a of filteredExplore) {
      if (!map[a.category]) map[a.category] = [];
      map[a.category].push(a);
    }
    return map;
  }, [filteredExplore]);

  // Top rated for featured section
  const topRated = useMemo(() =>
    [...exploreAgents].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0)).slice(0, 4),
  []);

  // Detail view
  if (selectedAgent) {
    return (
      <AgentDetail
        agent={selectedAgent}
        onBack={() => setSelectedAgent(null)}
        onOpen={() => {}}
        onEdit={() => handleEdit(selectedAgent)}
        onInstall={() => {}}
      />
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-bg-shell">
      <div className="mx-auto max-w-5xl px-6 py-8">

        {/* Header */}
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h1 className="font-serif text-4xl font-normal italic text-text-1">
              {tab === 'my' ? 'My Agents' : 'Explore'}
            </h1>
            <p className="mt-1 text-sm text-text-3">
              {tab === 'my' ? 'Your personal agents — built and installed' : 'Discover agents built by the community'}
            </p>
          </div>
          <Button onClick={handleNewAgent} size="sm" className="bg-accent text-white hover:bg-accent/90">
            <Plus className="mr-1.5 size-3.5" /> New Agent
          </Button>
        </div>

        {/* Tab bar + search */}
        <div className="mb-8 flex items-center gap-6">
          <nav className="flex gap-1">
            <TabButton active={tab === 'my'} onClick={() => setTab('my')}>My Agents</TabButton>
            <TabButton active={tab === 'explore'} onClick={() => setTab('explore')}>Explore</TabButton>
          </nav>
          <div className="relative ml-auto">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-3" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="w-56 border-none bg-bg-card pl-9 text-sm focus-visible:ring-accent/30"
            />
          </div>
        </div>

        {/* ─── My Agents Tab ─────────────────────────────── */}
        {tab === 'my' && (
          <>
            {filteredMy.length === 0 ? (
              <EmptyState onNew={handleNewAgent} />
            ) : (
              <div className="grid grid-cols-3 gap-6 sm:grid-cols-4 lg:grid-cols-5">
                {filteredMy.map((agent) => (
                  <AgentCard
                    key={agent.id}
                    agent={agent}
                    onClick={() => agent.status === 'draft' ? handleEdit(agent) : handleOpen(agent)}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* ─── Explore Tab ───────────────────────────────── */}
        {tab === 'explore' && (
          <>
            {/* Featured section */}
            <section className="mb-10">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-text-1">Featured</h2>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {topRated.map((agent) => (
                  <FeaturedAgentCard key={agent.id} agent={agent} onClick={() => handleOpen(agent)} />
                ))}
              </div>
            </section>

            {/* Category pills */}
            <div className="mb-8">
              <ScrollArea className="w-full">
                <div className="flex gap-2 pb-2">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setActiveCategory(cat)}
                      className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-medium transition-all ${
                        activeCategory === cat
                          ? 'bg-accent text-white shadow-[0_0_12px_rgba(249,115,22,0.3)]'
                          : 'bg-bg-card text-text-2 hover:bg-bg-hover hover:text-text-1'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </div>

            {/* Category sections or filtered grid */}
            {activeCategory === 'All' ? (
              <div className="space-y-10">
                {Object.entries(exploreByCategory).map(([category, agents]) => (
                  <section key={category}>
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="text-base font-semibold text-text-1">{category}</h3>
                      <button
                        onClick={() => setActiveCategory(category)}
                        className="flex items-center gap-0.5 text-xs text-accent hover:text-accent/80"
                      >
                        See All <ChevronRight className="size-3.5" />
                      </button>
                    </div>
                    <ScrollArea className="w-full">
                      <div className="flex gap-5 pb-4">
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
              <div className="grid grid-cols-3 gap-6 sm:grid-cols-4 lg:grid-cols-5">
                {filteredExplore.map((agent) => (
                  <AgentCard key={agent.id} agent={agent} onClick={() => handleOpen(agent)} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
});

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
        active
          ? 'bg-bg-card text-text-1'
          : 'text-text-3 hover:text-text-2'
      }`}
    >
      {children}
    </button>
  );
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
      <div className="flex size-20 items-center justify-center rounded-3xl bg-gradient-to-br from-accent/20 to-accent/5">
        <span className="text-4xl">✨</span>
      </div>
      <h2 className="text-lg font-medium text-text-1">No agents yet</h2>
      <p className="max-w-xs text-sm text-text-3">
        Build your first agent with Zeus, or explore the store to find one.
      </p>
      <Button onClick={onNew} size="sm" className="bg-accent text-white hover:bg-accent/90">
        <Plus className="mr-1.5 size-3.5" /> Build with Zeus
      </Button>
    </div>
  );
}
