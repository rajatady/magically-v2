import { useState, useEffect } from 'react';

function formatTime(d: Date) {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(d: Date) {
  return d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
}

export default function ClockApp() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: '"DM Sans", system-ui, sans-serif',
      background: '#0a0a0b',
      color: '#f4f4f5',
      gap: 8,
    }}>
      <div style={{ fontSize: 64, lineHeight: 1 }}>🕐</div>
      <div style={{ fontSize: 48, fontWeight: 300, letterSpacing: '-1px' }}>
        {formatTime(now)}
      </div>
      <div style={{ fontSize: 16, color: '#a1a1aa' }}>
        {formatDate(now)}
      </div>
    </div>
  );
}
