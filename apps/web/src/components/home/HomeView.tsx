import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { widgets as widgetsApi, feed as feedApi } from '../../lib/api';
import type { UserWidget, FeedItem } from '../../lib/api';
import { getGreeting } from './HomeView.logic';

const SIZE_SPANS: Record<string, string> = {
  small: 'col-span-4 md:col-span-4',
  medium: 'col-span-6 md:col-span-6',
  large: 'col-span-8 md:col-span-8',
};

export function HomeView() {
  const [userWidgets, setUserWidgets] = useState<UserWidget[]>([]);
  const [latestFeed, setLatestFeed] = useState<FeedItem | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([
      widgetsApi.list().catch(() => []),
      feedApi.list(1).catch(() => []),
    ]).then(([w, f]) => {
      setUserWidgets(w);
      setLatestFeed(f[0] ?? null);
    }).finally(() => setLoading(false));
  }, []);

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const activeCount = userWidgets.length;

  if (loading) {
    return (
      <div data-testid="home-view" className="flex-1 overflow-y-auto p-8" style={{
        background: `
          radial-gradient(ellipse at 20% 50%, rgba(139, 92, 246, 0.06) 0%, transparent 50%),
          radial-gradient(ellipse at 80% 20%, rgba(59, 130, 246, 0.04) 0%, transparent 50%),
          radial-gradient(ellipse at 50% 80%, rgba(168, 85, 247, 0.04) 0%, transparent 50%),
          var(--bg-shell)`
      }}>
        <div className="max-w-[1200px] mx-auto">
          <div className="mb-8">
            <div className="h-10 w-72 animate-pulse rounded-lg bg-white/5" />
            <div className="h-4 w-48 mt-2 animate-pulse rounded bg-white/5" />
          </div>
          <div className="grid grid-cols-12 gap-4">
            {[4, 6, 6, 4].map((span, i) => (
              <div key={i} className={`col-span-${span} h-[200px] animate-pulse rounded-2xl bg-white/[0.03]`} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="home-view" className="flex-1 overflow-y-auto p-8" style={{
      background: `
        radial-gradient(ellipse at 20% 50%, rgba(139, 92, 246, 0.06) 0%, transparent 50%),
        radial-gradient(ellipse at 80% 20%, rgba(59, 130, 246, 0.04) 0%, transparent 50%),
        radial-gradient(ellipse at 50% 80%, rgba(168, 85, 247, 0.04) 0%, transparent 50%),
        var(--bg-shell)`
    }}>
      <div className="max-w-[1200px] mx-auto">
        {/* Greeting */}
        <div className="mb-8" style={{ animation: 'fadeInUp 0.5s ease-out' }}>
          <h1 className="font-serif text-4xl italic text-text-1">
            {getGreeting()}, Rajat
          </h1>
          <p className="text-sm mt-1 text-text-3">
            {dateStr} · {activeCount} {activeCount === 1 ? 'agent' : 'agents'} active
          </p>
        </div>

        {/* Live feed ticker */}
        {latestFeed && (
          <div className="mb-8" style={{ animation: 'fadeInUp 0.5s ease-out 0.1s both' }}>
            <div className="flex items-center gap-3 px-4 py-3 rounded-2xl border border-border bg-bg-card/80">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full animate-pulse bg-accent" />
                <span className="text-[10px] font-medium uppercase tracking-wider text-accent">Live</span>
              </div>
              <div className="flex-1 overflow-hidden">
                <span className="text-sm text-text-1/80">
                  {latestFeed.agentId && (
                    <span className="text-text-3">{latestFeed.agentId}: </span>
                  )}
                  {latestFeed.title}
                </span>
              </div>
              <button
                onClick={() => navigate('/feed')}
                className="text-xs text-text-3 transition-colors hover:text-text-1"
              >
                View all →
              </button>
            </div>
          </div>
        )}

        {/* Widgets */}
        {userWidgets.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-12 gap-4 auto-rows-auto items-start">
            {userWidgets.map((w, i) => (
              <div
                key={w.id}
                className={`${SIZE_SPANS[w.size] ?? SIZE_SPANS.medium} rounded-2xl border border-border overflow-hidden transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg`}
                style={{
                  animation: `widgetAppear 0.5s cubic-bezier(0.16, 1, 0.3, 1) ${0.15 + i * 0.08}s both`,
                }}
                dangerouslySetInnerHTML={{ __html: w.html }}
              />
            ))}
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes widgetAppear {
          from { opacity: 0; transform: scale(0.95) translateY(8px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
}

function EmptyState() {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center gap-4 pt-20 text-center text-text-3">
      <Sparkles size={48} className="text-accent" />
      <h2 className="text-xl font-medium text-text-2">Your home screen is empty</h2>
      <p className="max-w-xs text-sm">
        Ask Zeus to build your first agent, or browse the Gallery to find one.
      </p>
      <Button onClick={() => navigate('/zeus')} className="mt-2">
        Ask Zeus
      </Button>
    </div>
  );
}
