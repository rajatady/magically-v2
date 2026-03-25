import { useEffect } from 'react';
import { Shell } from './components/shell/Shell.js';
import { useStore } from './lib/store.js';
import { agents, feed, config } from './lib/api.js';
import { connectSocket } from './lib/socket.js';

export default function App() {
  const { setAgents, setFeed, setConfig } = useStore();

  useEffect(() => {
    connectSocket();

    // Load initial data
    agents.list().then(setAgents).catch(console.error);
    feed.list(50).then(setFeed).catch(console.error);
    config.get().then(setConfig).catch(console.error);
  }, [setAgents, setFeed, setConfig]);

  return <Shell />;
}
