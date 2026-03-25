import { AgentManifestSchema } from './types.js';

describe('AgentManifestSchema', () => {
  const minimal = { id: 'my-agent', name: 'My Agent', version: '1.0.0' };

  it('parses a minimal valid manifest', () => {
    const result = AgentManifestSchema.parse(minimal);
    expect(result.id).toBe('my-agent');
    expect(result.tools).toEqual([]);
    expect(result.functions).toEqual([]);
  });

  it('rejects id with uppercase letters', () => {
    expect(() =>
      AgentManifestSchema.parse({ ...minimal, id: 'MyAgent' }),
    ).toThrow();
  });

  it('rejects id with spaces', () => {
    expect(() =>
      AgentManifestSchema.parse({ ...minimal, id: 'my agent' }),
    ).toThrow();
  });

  it('accepts id with dashes and numbers', () => {
    const result = AgentManifestSchema.parse({ ...minimal, id: 'agent-v2-prod' });
    expect(result.id).toBe('agent-v2-prod');
  });

  it('parses a full manifest with all optional fields', () => {
    const full = {
      ...minimal,
      description: 'Tracks calendar meetings',
      icon: '📅',
      color: '#3b82f6',
      author: 'magically',
      tools: ['google-calendar', 'web-search'],
      triggers: [
        { type: 'cron', name: 'Morning briefing', entrypoint: 'getUpcomingEvents', schedule: '0 7 * * *' },
        { type: 'event', name: 'Meeting starting', entrypoint: 'getUpcomingEvents', event: 'calendar:event-starting' },
      ],
      ui: { entry: 'ui/App.tsx', widget: 'widget.json' },
      permissions: { data: ['calendar'], actions: ['notify'], memory: 'read' },
      functions: [
        {
          name: 'getUpcomingEvents',
          description: 'Returns upcoming calendar events',
          parameters: { type: 'object', properties: {} },
        },
      ],
      remixOf: 'calendar-basic',
    };

    const result = AgentManifestSchema.parse(full);
    expect(result.tools).toContain('google-calendar');
    expect(result.permissions?.memory).toBe('read');
    expect(result.functions[0].name).toBe('getUpcomingEvents');
    expect(result.remixOf).toBe('calendar-basic');
  });

  it('defaults memory permission to none', () => {
    const result = AgentManifestSchema.parse({
      ...minimal,
      permissions: { data: [], actions: [] },
    });
    expect(result.permissions?.memory).toBe('none');
  });

  it('rejects invalid memory permission value', () => {
    expect(() =>
      AgentManifestSchema.parse({
        ...minimal,
        permissions: { data: [], actions: [], memory: 'write-only' },
      }),
    ).toThrow();
  });
});
