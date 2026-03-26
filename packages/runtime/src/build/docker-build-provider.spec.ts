import { ConfigService } from '@nestjs/config';
import { DockerBuildProvider } from './docker-build-provider';
import * as childProcess from 'child_process';
import * as fs from 'fs';

describe('DockerBuildProvider', () => {
  let provider: DockerBuildProvider;
  let mockExecSync: jest.SpyInstance;

  const mockConfig: Partial<ConfigService> = {
    get: jest.fn((key: string) => {
      if (key === 'GHCR_REGISTRY') return 'ghcr.io/rajatady/magically-agents';
      return undefined;
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
    provider = new DockerBuildProvider(mockConfig as ConfigService);
    mockExecSync.mockReset().mockReturnValue(Buffer.from('') as any);
  });

  it('has name "docker"', () => {
    expect(provider.name).toBe('docker');
  });

  describe('isAvailable', () => {
    it('returns true when Docker is installed', async () => {
      mockExecSync.mockReturnValue(Buffer.from(''));
      expect(await provider.isAvailable()).toBe(true);
    });

    it('returns false when Docker is not installed', async () => {
      mockExecSync.mockImplementation(() => { throw new Error('not found'); });
      expect(await provider.isAvailable()).toBe(false);
    });
  });

  describe('build', () => {
    it('builds a Docker image locally (no push)', async () => {
      mockExecSync.mockReturnValue(Buffer.from(''));

      const result = await provider.build({
        agentId: 'hello-world',
        version: '1.0.0',
        bundlePath: '/tmp/bundle-hello-world',
        manifest: {
          id: 'hello-world',
          runtime: { base: 'python:3.12-slim', system: [], install: '' },
        },
      });

      expect(result.imageRef).toBe('ghcr.io/rajatady/magically-agents:hello-world-1.0.0');
      expect(result.durationMs).toBeGreaterThanOrEqual(0);

      // Verify docker build was called
      const buildCall = mockExecSync.mock.calls.find(
        (c) => (c[0] as string).includes('docker build'),
      );
      expect(buildCall).toBeDefined();
      expect(buildCall![0]).toContain('-t ghcr.io/rajatady/magically-agents:hello-world-1.0.0');

      // Docker push should NOT be called — local builds stay local
      const pushCall = mockExecSync.mock.calls.find(
        (c) => (c[0] as string).includes('docker push'),
      );
      expect(pushCall).toBeUndefined();
    });

    it('generates a Dockerfile from the manifest runtime block', async () => {
      mockExecSync.mockReturnValue(Buffer.from(''));

      await provider.build({
        agentId: 'test',
        version: '2.0.0',
        bundlePath: '/tmp/bundle-test',
        manifest: {
          id: 'test',
          runtime: {
            base: 'python:3.12-slim',
            system: ['chromium'],
            install: 'pip install playwright',
          },
        },
      });

      // The build command should reference a Dockerfile written to the bundle path
      const buildCall = mockExecSync.mock.calls.find(
        (c) => (c[0] as string).includes('docker build'),
      );
      expect(buildCall![0]).toContain('/tmp/bundle-test');
    });
  });
});
