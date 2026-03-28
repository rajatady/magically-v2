/**
 * App Store-style agent gallery.
 * Two tabs: "My Agents" (drafts + installed) and "Explore" (store).
 */
import { memo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/lib/store';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Search, Plus, LayoutGrid, List } from 'lucide-react';
import { AgentCard, type AgentCardData } from './AgentCard';
import { CategoryHeader } from './CategoryHeader';
import { CategorySection } from './CategorySection';
import {
  myAgents as dummyMyAgents,
  exploreAgents as dummyExploreAgents,
  categories,
  featuredCategory,
} from './gallery-data';

export const GalleryView = memo(function GalleryView() {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const navigate = useNavigate();
  const { toggleZeus } = useStore();

  const handleOpen = useCallback((id: string) => {
    // Navigate to agent view
  }, []);

  const handleEdit = useCallback((id: string) => {
    // Open Zeus with this agent's workspace
    navigate(`/zeus`);
    toggleZeus();
  }, [navigate, toggleZeus]);

  const handleInstall = useCallback((id: string) => {
    // Install from store (future)
  }, []);

  const handleNewAgent = useCallback(() => {
    navigate('/zeus');
    toggleZeus();
  }, [navigate, toggleZeus]);

  // Filter explore agents by category + search
  const filteredExplore = dummyExploreAgents.filter((a) => {
    const matchesCategory = activeCategory === 'All' || a.category === activeCategory;
    const matchesSearch = !search || a.name.toLowerCase().includes(search.toLowerCase()) || a.description.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Filter my agents by search
  const filteredMy = dummyMyAgents.filter((a) => {
    return !search || a.name.toLowerCase().includes(search.toLowerCase());
  });

  // Group explore by category for sections
  const exploreByCategory = filteredExplore.reduce<Record<string, AgentCardData[]>>((acc, a) => {
    const cat = a.category ?? 'Other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(a);
    return acc;
  }, {});

  return (
    <div className="flex-1 overflow-y-auto bg-bg-shell">
      <div className="mx-auto max-w-5xl px-6 py-6">
        {/* Page header */}
        <div className="mb-6 flex items-center justify-between">
          <h1 className="font-serif text-3xl font-normal italic text-text-1">
            Agents
          </h1>
          <Button onClick={handleNewAgent} className="bg-accent text-white hover:bg-accent/90">
            <Plus className="mr-1.5 size-4" /> New Agent
          </Button>
        </div>

        <Tabs defaultValue="my-agents" className="w-full">
          <div className="mb-6 flex items-center justify-between gap-4">
            <TabsList className="bg-bg-panel">
              <TabsTrigger value="my-agents">My Agents</TabsTrigger>
              <TabsTrigger value="explore">Explore</TabsTrigger>
            </TabsList>

            <div className="flex items-center gap-2">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-3" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search agents..."
                  className="w-64 bg-bg-panel pl-9"
                />
              </div>

              {/* View toggle */}
              <div className="flex rounded-lg border border-border bg-bg-panel p-0.5">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`rounded-md p-1.5 transition-colors ${viewMode === 'grid' ? 'bg-bg-hover text-text-1' : 'text-text-3 hover:text-text-2'}`}
                >
                  <LayoutGrid className="size-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`rounded-md p-1.5 transition-colors ${viewMode === 'list' ? 'bg-bg-hover text-text-1' : 'text-text-3 hover:text-text-2'}`}
                >
                  <List className="size-4" />
                </button>
              </div>
            </div>
          </div>

          {/* ─── My Agents ──────────────────────────────────── */}
          <TabsContent value="my-agents">
            {filteredMy.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
                <span className="text-5xl">✨</span>
                <h2 className="text-xl font-medium text-text-2">No agents yet</h2>
                <p className="max-w-sm text-sm text-text-3">
                  Build your first agent with Zeus, or explore the store to find one.
                </p>
                <Button onClick={handleNewAgent} className="bg-accent text-white hover:bg-accent/90">
                  <Plus className="mr-1.5 size-4" /> Build with Zeus
                </Button>
              </div>
            ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {filteredMy.map((agent) => (
                  <AgentCard
                    key={agent.id}
                    agent={agent}
                    onOpen={handleOpen}
                    onEdit={handleEdit}
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredMy.map((agent) => (
                  <AgentCard
                    key={agent.id}
                    agent={agent}
                    variant="list"
                    onOpen={handleOpen}
                    onEdit={handleEdit}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* ─── Explore ────────────────────────────────────── */}
          <TabsContent value="explore">
            {/* Featured header */}
            <CategoryHeader
              title={featuredCategory.title}
              subtitle={featuredCategory.subtitle}
              gradient={featuredCategory.gradient}
              className="mb-8"
            />

            {/* Category filter pills */}
            <div className="mb-6 flex flex-wrap gap-2">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`rounded-full px-4 py-1.5 text-xs font-medium transition-all ${
                    activeCategory === cat
                      ? 'bg-accent text-white'
                      : 'bg-bg-card text-text-2 hover:bg-bg-hover hover:text-text-1'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Category sections or flat grid */}
            {activeCategory === 'All' ? (
              <div className="space-y-10">
                {Object.entries(exploreByCategory).map(([category, agents]) => (
                  <CategorySection
                    key={category}
                    title={category}
                    agents={agents}
                    onInstall={handleInstall}
                    onSeeAll={() => setActiveCategory(category)}
                  />
                ))}
              </div>
            ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {filteredExplore.map((agent) => (
                  <AgentCard
                    key={agent.id}
                    agent={agent}
                    onInstall={handleInstall}
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredExplore.map((agent) => (
                  <AgentCard
                    key={agent.id}
                    agent={agent}
                    variant="list"
                    onInstall={handleInstall}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
});
