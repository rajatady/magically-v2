import { ConfigService } from '@nestjs/config';
import { DockerBuildProvider } from './docker-build-provider';

// Jest hoists jest.mock calls — they must be top-level, not inside conditionals
jest.mock('child_process', () => ({
  execSync: jest.fn().mockReturnValue(Buffer.from('')),
}));
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  writeFileSync: jest.fn(),
  unlinkSync: jest.fn(),
}));

import { execSync } from 'child_process';

describe('DockerBuildProvider', () => {
  let provider: DockerBuildProvider;
  const mockExecSync = execSync as jest.MockedFunction<typeof execSync>;

  const mockConfig: Partial<ConfigService> = {
    get: jest.fn((key: string) => {
      if (key === 'GHCR_REGISTRY') return 'ghcr.io/rajatady/magically-agents';
      return undefined;
    }),
  };

  beforeEach(() => {
    provider = new DockerBuildProvider(mockConfig as ConfigService);
    mockExecSync.mockReset().mockReturnValue(Buffer.from(''));
  });

  it('has name "docker"', () => {
    expect(provider.name).toBe('docker');
  });

  describe('isAvailable', () => {
    it('returns true when Docker is installed', async () => {
      mockExecSync.mockReturnValue(Buffer.from('Docker version 24.0'));
      expect(await provider.isAvailable()).toBe(true);
    });

    it('returns false when Docker is not installed', async () => {
      mockExecSync.mockImplementation(() => { throw new Error('not found'); });
      expect(await provider.isAvailable()).toBe(false);
    });
  });

  describe('build', () => {
    it('builds a Docker image locally (no push)', async () => {
      const result = await provider.build({
        agentId: 'hello-world',
        version: '1.0.0',
        bundlePath: '/tmp/agent-bundle',
        manifest: { id: 'hello-world' },
      });

      expect(result.imageRef).toContain('hello-world');
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      expect(mockExecSync).toHaveBeenCalled();
    });

    it('generates a Dockerfile from the manifest runtime block', async () => {
      await provider.build({
        agentId: 'py-agent',
        version: '2.0.0',
        bundlePath: '/tmp/py-bundle',
        manifest: {
          id: 'py-agent',
          runtime: { base: 'python:3.12-slim', install: 'pip install -r requirements.txt' },
        },
      });

      const fs = require('fs');
      expect(fs.writeFileSync).toHaveBeenCalled();
    });
  });
});
