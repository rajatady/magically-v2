import { join } from 'path';
import { devCommand } from './dev';

const helloWorldDir = join(__dirname, '../../../../agents/hello-world');

describe('dev command', () => {
  describe('loadManifest', () => {
    it('loads and parses manifest.json from agent dir', () => {
      const manifest = devCommand.loadManifest(helloWorldDir);
      expect(manifest.id).toBe('hello-world');
      expect(manifest.functions).toBeDefined();
      expect(manifest.functions.length).toBeGreaterThan(0);
    });

    it('throws if manifest.json does not exist', () => {
      expect(() => devCommand.loadManifest('/tmp/nonexistent-agent-dir')).toThrow(/manifest\.json/);
    });
  });

  describe('resolveFunction', () => {
    it('finds a declared function by name', () => {
      const manifest = devCommand.loadManifest(helloWorldDir);
      const fn = devCommand.resolveFunction(manifest, 'greet');
      expect(fn).toBeDefined();
      expect(fn.name).toBe('greet');
    });

    it('throws if function is not in manifest', () => {
      const manifest = devCommand.loadManifest(helloWorldDir);
      expect(() => devCommand.resolveFunction(manifest, 'nonexistent')).toThrow(/not declared/);
    });
  });

  describe('buildContext', () => {
    const base = 'http://localhost:4321';

    it('builds a context with agentId, agentDir, and log', () => {
      const ctx = devCommand.buildContext('test-agent', '/tmp/test', {}, base);
      expect(ctx.agentId).toBe('test-agent');
      expect(ctx.agentDir).toBe('/tmp/test');
      expect(ctx.trigger.type).toBe('manual');
      expect(typeof ctx.log.info).toBe('function');
      expect(typeof ctx.log.warn).toBe('function');
      expect(typeof ctx.log.error).toBe('function');
      expect(typeof ctx.emit).toBe('function');
    });

    it('injects secrets from env map', () => {
      const ctx = devCommand.buildContext('test-agent', '/tmp/test', { API_KEY: 'abc123' }, base);
      expect(ctx.secrets.API_KEY).toBe('abc123');
    });

    it('includes payload in trigger when provided', () => {
      const ctx = devCommand.buildContext('test-agent', '/tmp/test', {}, base, { foo: 'bar' });
      expect(ctx.trigger.payload).toEqual({ foo: 'bar' });
    });
  });

  describe('loadFunctionHandler', () => {
    it('loads a JS function file that exports a handler', () => {
      const handler = devCommand.loadFunctionHandler(helloWorldDir, 'greet');
      expect(typeof handler).toBe('function');
    });

    it('throws if function file does not exist', () => {
      expect(() => devCommand.loadFunctionHandler(helloWorldDir, 'nonexistent')).toThrow();
    });
  });
});
