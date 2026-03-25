import { useStore } from './store.js';

// Reset store between tests
beforeEach(() => {
  useStore.setState({
    view: 'home',
    activeAgentId: null,
    zeusOpen: false,
    agents: [],
    feed: [],
    config: null,
    conversationId: null,
    messages: [],
    zeusTyping: false,
  });
});

describe('store navigation', () => {
  it('setView changes view', () => {
    useStore.getState().setView('feed');
    expect(useStore.getState().view).toBe('feed');
  });

  it('setView with agentId sets activeAgentId', () => {
    useStore.getState().setView('agent', 'calendar-hero');
    expect(useStore.getState().view).toBe('agent');
    expect(useStore.getState().activeAgentId).toBe('calendar-hero');
  });

  it('toggleZeus flips zeusOpen', () => {
    expect(useStore.getState().zeusOpen).toBe(false);
    useStore.getState().toggleZeus();
    expect(useStore.getState().zeusOpen).toBe(true);
    useStore.getState().toggleZeus();
    expect(useStore.getState().zeusOpen).toBe(false);
  });
});

describe('store feed', () => {
  const sampleItem = {
    id: 'item-1',
    type: 'info' as const,
    title: 'Test',
    read: false,
    createdAt: new Date().toISOString(),
  };

  it('prependFeedItem adds to the front', () => {
    useStore.getState().setFeed([{ ...sampleItem, id: 'existing' }]);
    useStore.getState().prependFeedItem({ ...sampleItem, id: 'new', title: 'New' });
    expect(useStore.getState().feed[0].id).toBe('new');
  });

  it('markFeedRead updates the read flag', () => {
    useStore.getState().setFeed([sampleItem]);
    useStore.getState().markFeedRead('item-1');
    expect(useStore.getState().feed[0].read).toBe(true);
  });

  it('dismissFeedItem removes the item', () => {
    useStore.getState().setFeed([sampleItem]);
    useStore.getState().dismissFeedItem('item-1');
    expect(useStore.getState().feed).toHaveLength(0);
  });
});

describe('store zeus messages', () => {
  it('addMessage appends a message', () => {
    useStore.getState().addMessage({ role: 'user', content: 'Hello' });
    expect(useStore.getState().messages).toHaveLength(1);
    expect(useStore.getState().messages[0].content).toBe('Hello');
  });

  it('appendToLastMessage extends the last assistant message', () => {
    useStore.getState().addMessage({ role: 'assistant', content: 'Hello' });
    useStore.getState().appendToLastMessage(' world');
    expect(useStore.getState().messages[0].content).toBe('Hello world');
  });

  it('appendToLastMessage creates a new assistant message if last is user', () => {
    useStore.getState().addMessage({ role: 'user', content: 'Hi' });
    useStore.getState().appendToLastMessage('Response');
    expect(useStore.getState().messages).toHaveLength(2);
    expect(useStore.getState().messages[1]).toMatchObject({
      role: 'assistant',
      content: 'Response',
    });
  });
});
