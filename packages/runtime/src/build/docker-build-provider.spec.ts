import { ConfigService } from '@nestjs/config';
import { DockerBuildProvider } from './docker-build-provider';

jest.mock('child_process', () => ({
  execSync: jest.fn(),
}));

jest.mock('fs', () => ({
  writeFileSync: jest.fn(),
  unlinkSync: jest.fn(),
}));

import { execSync } from 'child_process';
const mockExecSync = execSync as jest.MockedFunction<typeof execSync>;

describe('DockerBuildProvider', () => {
  let provider: DockerBuildProvider;

  const mockConfig: Partial<ConfigService> = {
    get: jest.fn((key: string) => {
      if (key === 'GHCR_REGISTRY') return 'ghcr.io/rajatady/magically-agents';
      return undefined;
    }),
  };

  beforeEach(() => {
    provider = new DockerBuildProvider(mockConfig as ConfigService);
    mockExecSync.mockReset();
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
    it('builds and pushes a Docker image to GHCR', async () => {
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

      // Verify docker push was called
      const pushCall = mockExecSync.mock.calls.find(
        (c) => (c[0] as string).includes('docker push'),
      );
      expect(pushCall).toBeDefined();
      expect(pushCall![0]).toContain('ghcr.io/rajatady/magically-agents:hello-world-1.0.0');
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
