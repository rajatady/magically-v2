import { useState } from 'react';

export default function AskLlmApp() {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAsk = async () => {
    if (!question.trim()) return;
    setLoading(true);
    setAnswer('');

    try {
      const res = await fetch(`/api/agents/ask-llm/run/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      });
      const data = await res.json();
      setAnswer(data.result?.answer ?? data.error ?? 'No response');
    } catch (err: any) {
      setAnswer(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      padding: 24,
      fontFamily: '"DM Sans", system-ui, sans-serif',
      background: '#0a0a0b',
      color: '#f4f4f5',
      gap: 16,
    }}>
      <div style={{ fontSize: 32 }}>🧠</div>
      <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>Ask LLM</h1>

      <div style={{ display: 'flex', gap: 8 }}>
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAsk()}
          placeholder="Ask anything..."
          style={{
            flex: 1,
            padding: '10px 12px',
            background: '#141416',
            border: '1px solid #2a2a2f',
            borderRadius: 8,
            color: '#f4f4f5',
            fontSize: 14,
            outline: 'none',
          }}
        />
        <button
          onClick={handleAsk}
          disabled={loading}
          style={{
            padding: '10px 20px',
            background: '#f97316',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            fontWeight: 600,
            fontSize: 14,
            cursor: loading ? 'wait' : 'pointer',
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? '...' : 'Ask'}
        </button>
      </div>

      {answer && (
        <div style={{
          padding: 16,
          background: '#141416',
          borderRadius: 8,
          border: '1px solid #2a2a2f',
          fontSize: 14,
          lineHeight: 1.6,
          whiteSpace: 'pre-wrap',
          overflow: 'auto',
          flex: 1,
        }}>
          {answer}
        </div>
      )}
    </div>
  );
}
