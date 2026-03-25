import { useState, useRef, useEffect } from 'react';
import { useStore } from '../../lib/store.js';
import { streamZeusChat } from '../../lib/api.js';

export function ZeusPanel() {
  const {
    messages,
    zeusTyping,
    conversationId,
    addMessage,
    appendToLastMessage,
    setZeusTyping,
    setConversationId,
    toggleZeus,
  } = useStore();

  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || sending) return;

    setInput('');
    setSending(true);
    addMessage({ role: 'user', content: text });
    setZeusTyping(true);

    try {
      let convId = conversationId;
      for await (const chunk of streamZeusChat(text, convId ?? undefined)) {
        if (chunk.error) break;
        if (chunk.conversationId && !convId) {
          convId = chunk.conversationId;
          setConversationId(convId);
        }
        if (chunk.content) appendToLastMessage(chunk.content);
        if (chunk.done) setZeusTyping(false);
      }
    } catch (err) {
      addMessage({ role: 'assistant', content: 'Something went wrong. Check your API key in Settings.' });
      setZeusTyping(false);
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      data-testid="zeus-panel"
      style={{
        width: 360,
        borderLeft: '1px solid var(--border)',
        background: 'var(--bg-panel)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
      }}
    >
      {/* Header */}
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: 'var(--accent)', fontSize: 16 }}>◈</span>
          <span style={{ fontWeight: 600 }}>Zeus</span>
        </div>
        <button
          onClick={toggleZeus}
          style={{ color: 'var(--text-3)', fontSize: 18 }}
        >
          ×
        </button>
      </div>

      {/* Messages */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}>
        {messages.length === 0 && (
          <div style={{ color: 'var(--text-3)', fontSize: 13, lineHeight: 1.6 }}>
            Hey! I'm Zeus. Ask me anything — build an agent, find information, or just chat.
          </div>
        )}

        {messages.map((msg, i) => (
          <MessageBubble key={i} role={msg.role} content={msg.content} />
        ))}

        {zeusTyping && (
          <div style={{ display: 'flex', gap: 4, padding: '4px 0' }}>
            {[0, 1, 2].map((i) => (
              <span key={i} style={{
                width: 6, height: 6, borderRadius: '50%',
                background: 'var(--accent)',
                animation: `pulse 1s ${i * 0.2}s infinite`,
              }} />
            ))}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: '12px 16px',
        borderTop: '1px solid var(--border)',
        display: 'flex',
        gap: 8,
        alignItems: 'flex-end',
      }}>
        <textarea
          data-testid="zeus-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
          placeholder="Ask Zeus…"
          rows={1}
          style={{
            flex: 1,
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: '10px 14px',
            fontSize: 14,
            color: 'var(--text-1)',
            resize: 'none',
            lineHeight: 1.4,
            maxHeight: 120,
            overflow: 'auto',
          }}
        />
        <button
          data-testid="zeus-send"
          onClick={sendMessage}
          disabled={!input.trim() || sending}
          style={{
            background: input.trim() && !sending ? 'var(--accent)' : 'var(--bg-hover)',
            color: input.trim() && !sending ? 'white' : 'var(--text-3)',
            width: 36,
            height: 36,
            borderRadius: 'var(--radius-sm)',
            fontSize: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            transition: 'all 0.15s',
          }}
        >
          ↑
        </button>
      </div>
    </div>
  );
}

function MessageBubble({ role, content }: { role: 'user' | 'assistant'; content: string }) {
  const isUser = role === 'user';
  return (
    <div style={{
      display: 'flex',
      justifyContent: isUser ? 'flex-end' : 'flex-start',
    }}>
      <div style={{
        maxWidth: '85%',
        background: isUser ? 'var(--accent)' : 'var(--bg-card)',
        color: isUser ? 'white' : 'var(--text-1)',
        borderRadius: isUser
          ? 'var(--radius-md) var(--radius-md) 4px var(--radius-md)'
          : 'var(--radius-md) var(--radius-md) var(--radius-md) 4px',
        padding: '10px 14px',
        fontSize: 14,
        lineHeight: 1.5,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}>
        {content}
      </div>
    </div>
  );
}
