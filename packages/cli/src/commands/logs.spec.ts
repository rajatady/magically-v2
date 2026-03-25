import { logsCommand } from './logs';

describe('logs command', () => {
  describe('formatLog', () => {
    it('formats an info log entry', () => {
      const formatted = logsCommand.formatLog({
        level: 'info',
        message: 'Hello',
        timestamp: 1700000000000,
      });
      expect(formatted).toContain('INFO');
      expect(formatted).toContain('Hello');
    });

    it('formats an error log entry', () => {
      const formatted = logsCommand.formatLog({
        level: 'error',
        message: 'Failed',
        timestamp: 1700000000000,
      });
      expect(formatted).toContain('ERROR');
      expect(formatted).toContain('Failed');
    });

    it('includes data when present', () => {
      const formatted = logsCommand.formatLog({
        level: 'info',
        message: 'test',
        data: { key: 'val' },
        timestamp: 1700000000000,
      });
      expect(formatted).toContain('key');
      expect(formatted).toContain('val');
    });
  });
});
