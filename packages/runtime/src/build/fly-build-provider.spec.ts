import { ConfigService } from '@nestjs/config';
import { FlyBuildProvider } from './fly-build-provider';
import * as childProcess from 'child_process';
import * as fs from 'fs';

describe('FlyBuildProvider', () => {
  let provider: FlyBuildProvider;
  let mockExecSync: jest.SpyInstance;

  const mockConfig: Partial<ConfigService> = {
    get: jest.fn((key: string) => {
      const map: Record<string, string> = {
        FLY_API_TOKEN: 'test-fly-token',
        FLY_AGENTS_APP: 'magically-runtime',
        GHCR_REGISTRY: 'ghcr.io/rajatady/magically-agents',
      };
      return map[key];
    }),
  };

  beforeAll(() => {
    mockExecSync = jest.spyOn(childProcess, 'execSync').mockReturnValue(Buffer.from('') as any);
    jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
    jest.spyOn(fs, 'unlinkSync').mockImplementation(() => {});
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    provider = new FlyBuildProvider(mockConfig as ConfigService);
    mockExecSync.mockReset();
  });

  it('has name "fly"', () => {
    expect(provider.name).toBe('fly');
  });

  describe('isAvailable', () => {
    it('returns true when Fly token and app are configured', async () => {
      expect(await provider.isAvailable()).toBe(true);
    });

    it('returns false when Fly token is missing', async () => {
      const noToken: Partial<ConfigService> = {
        get: jest.fn(() => undefined),
      };
      const p = new FlyBuildProvider(noToken as ConfigService);
      expect(await p.isAvailable()).toBe(false);
    });
  });

  describe('build', () => {
    it('builds via fly deploy and pushes to GHCR', async () => {
      mockExecSync.mockReturnValue(Buffer.from(''));

      const result = await provider.build({
        agentId: 'hello-world',
        version: '1.0.0',
        bundlePath: '/tmp/bundle-hello-world',
        manifest: {
          id: 'hello-world',
          runtime: { base: 'python:3.12-slim' },
        },
      });

      expect(result.imageRef).toBe('ghcr.io/rajatady/magically-agents:hello-world-1.0.0');

      // Verify fly deploy --build-only was called
      const flyCall = mockExecSync.mock.calls.find(
        (c) => (c[0] as string).includes('fly deploy'),
      );
      expect(flyCall).toBeDefined();
      expect(flyCall![0]).toContain('--build-only');

      // Verify docker tag + push to GHCR
      const pushCall = mockExecSync.mock.calls.find(
        (c) => (c[0] as string).includes('docker push'),
      );
      expect(pushCall).toBeDefined();
    });
  });
});
