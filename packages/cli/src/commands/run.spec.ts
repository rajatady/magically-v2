import { runCommand } from './run';

describe('run command', () => {
  describe('buildUrl', () => {
    it('builds the correct API URL', () => {
      const url = runCommand.buildUrl('http://localhost:4321', 'my-agent', 'myFunc');
      expect(url).toBe('http://localhost:4321/api/agents/my-agent/run/myFunc');
    });

    it('strips trailing slash from base', () => {
      const url = runCommand.buildUrl('http://localhost:4321/', 'a', 'b');
      expect(url).toBe('http://localhost:4321/api/agents/a/run/b');
    });
  });

  describe('parsePayload', () => {
    it('parses JSON string', () => {
      expect(runCommand.parsePayload('{"a":1}')).toEqual({ a: 1 });
    });

    it('returns empty object for undefined', () => {
      expect(runCommand.parsePayload(undefined)).toEqual({});
    });

    it('throws on invalid JSON', () => {
      expect(() => runCommand.parsePayload('not json')).toThrow();
    });
  });
});
