import { pushCommand } from './push';

describe('push command', () => {
  describe('registryTag', () => {
    it('generates correct Fly registry tag', () => {
      const tag = pushCommand.registryTag('my-app', 'my-agent', '1.0.0');
      expect(tag).toBe('registry.fly.io/my-app:my-agent-1.0.0');
    });
  });

  describe('deployArgs', () => {
    it('generates fly deploy arguments', () => {
      const args = pushCommand.deployArgs('/path/to/agent', 'my-app', 'my-agent-1.0.0');
      expect(args).toContain('--app');
      expect(args).toContain('my-app');
      expect(args).toContain('--image-label');
      expect(args).toContain('my-agent-1.0.0');
      expect(args).toContain('--ha=false');
      expect(args).toContain('--build-only');
    });
  });
});
