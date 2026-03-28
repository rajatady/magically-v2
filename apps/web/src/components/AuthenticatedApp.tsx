import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useStore } from '../lib/store';
import { agents, feed, config } from '../lib/api';
import { connectSocket, disconnectSocket } from '../lib/socket';
import { Skeleton } from '@/components/ui/skeleton';

function AppSkeleton() {
  return (
    <div className="flex h-screen w-screen bg-bg-shell">
      {/* Sidebar skeleton */}
      <div className="flex w-16 shrink-0 flex-col items-center gap-2 border-r border-border bg-bg-panel py-4">
        <Skeleton className="size-8 rounded-md" />
        <Skeleton className="size-8 rounded-md" />
        <Skeleton className="size-8 rounded-md" />
        <Skeleton className="size-8 rounded-md" />
      </div>
      {/* Main content skeleton */}
      <div className="flex flex-1 flex-col">
        <div className="flex h-12 shrink-0 items-center justify-end border-b border-border px-4">
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="flex-1 p-6">
          <Skeleton className="mb-6 h-8 w-48" />
          <div className="grid grid-cols-4 gap-3">
            <Skeleton className="h-32 rounded-lg" />
            <Skeleton className="h-32 rounded-lg" />
            <Skeleton className="h-32 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function AuthenticatedApp() {
  const { setAgents, setFeed, setConfig } = useStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    connectSocket();

    Promise.allSettled([
      agents.list().then(setAgents),
      feed.list(50).then(setFeed),
      config.get().then(setConfig),
    ]).then(() => setLoading(false));

    return () => {
      disconnectSocket();
    };
  }, [setAgents, setFeed, setConfig]);

  if (loading) return <AppSkeleton />;

  return <Outlet />;
}
