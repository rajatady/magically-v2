import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Shell } from './components/shell/Shell';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { AuthCallbackPage } from './pages/AuthCallbackPage';
import { useStore } from './lib/store';
import { useAuthStore } from './lib/auth';
import { agents, feed, config } from './lib/api';
import { connectSocket } from './lib/socket';

function AuthenticatedApp() {
  const { setAgents, setFeed, setConfig } = useStore();

  useEffect(() => {
    connectSocket();
    agents.list().then(setAgents).catch(console.error);
    feed.list(50).then(setFeed).catch(console.error);
    config.get().then(setConfig).catch(console.error);
  }, [setAgents, setFeed, setConfig]);

  return <Shell />;
}

export default function App() {
  useEffect(() => {
    useAuthStore.getState().restore();
  }, []);

  return (
    <BrowserRouter>
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
        />
      </Routes>
    </BrowserRouter>
  );
}
