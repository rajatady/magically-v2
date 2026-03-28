import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AuthenticatedApp } from './components/AuthenticatedApp';
import { LoginPage } from './pages/LoginPage';
import { AuthCallbackPage } from './pages/AuthCallbackPage';
import { Shell } from './components/shell/Shell';
import { HomeView } from './components/home/HomeView';
import { FeedView } from './components/feed/FeedView';
import { AgentView } from './components/agent/AgentView';
import { GalleryView } from './components/gallery/GalleryView';
import { GalleryDetailRoute } from './components/gallery/GalleryDetailRoute';

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <TooltipProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/auth/callback" element={<AuthCallbackPage />} />
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <AuthenticatedApp />
                </ProtectedRoute>
              }
            >
              <Route element={<Shell />}>
                <Route index element={<HomeView />} />
                <Route path="feed" element={<FeedView />} />
                <Route path="gallery" element={<GalleryView />} />
                <Route path="gallery/explore" element={<GalleryView />} />
                <Route path="gallery/:agentId" element={<GalleryDetailRoute />} />
                <Route path="agents/:agentId" element={<AgentView />} />
                <Route path="zeus" element={<HomeView />} />
                <Route path="zeus/:chatId" element={<HomeView />} />
                <Route path="settings" element={<PlaceholderView title="Settings" />} />
                <Route path="build" element={<PlaceholderView title="Build" />} />
              </Route>
            </Route>
          </Routes>
        </TooltipProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

function PlaceholderView({ title }: { title: string }) {
  return (
    <div className="flex flex-1 items-center justify-center font-serif text-2xl italic text-text-3">
      {title} — coming soon
    </div>
  );
}
