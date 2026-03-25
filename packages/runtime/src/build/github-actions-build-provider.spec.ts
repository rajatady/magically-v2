import { ConfigService } from '@nestjs/config';
import { GitHubActionsBuildProvider } from './github-actions-build-provider';

const mockFetch = jest.fn();
global.fetch = mockFetch as any;

describe('GitHubActionsBuildProvider', () => {
  let provider: GitHubActionsBuildProvider;

  const mockConfig: Partial<ConfigService> = {
    get: jest.fn((key: string) => {
      const map: Record<string, string> = {
        GITHUB_BUILDER_REPO: 'rajatady/magically-builders',
        GITHUB_BUILDER_TOKEN: 'ghp_test_token',
        GHCR_REGISTRY: 'ghcr.io/rajatady/magically-agents',
      };
      return map[key];
    }),
  };

  beforeEach(() => {
    provider = new GitHubActionsBuildProvider(mockConfig as ConfigService);
    mockFetch.mockReset();
  });

  it('has name "github-actions"', () => {
    expect(provider.name).toBe('github-actions');
  });

  describe('isAvailable', () => {
    it('returns true when repo and token are configured', async () => {
      expect(await provider.isAvailable()).toBe(true);
    });

    it('returns false when token is missing', async () => {
      const noToken: Partial<ConfigService> = {
        get: jest.fn(() => undefined),
      };
      const p = new GitHubActionsBuildProvider(noToken as ConfigService);
      expect(await p.isAvailable()).toBe(false);
    });
  });

  describe('build', () => {
    it('dispatches a workflow and polls until completion', async () => {
      // 1. Dispatch workflow — 204 No Content
      mockFetch.mockResolvedValueOnce({ ok: true, status: 204 });

      // 2. List runs — find the triggered run
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          workflow_runs: [{ id: 12345, status: 'in_progress' }],
        }),
      });

      // 3. Poll run status — completed
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 12345, status: 'completed', conclusion: 'success' }),
      });

      const result = await provider.build({
        agentId: 'hello-world',
        version: '1.0.0',
        bundlePath: '/tmp/unused',
        manifest: {
          id: 'hello-world',
          runtime: { base: 'python:3.12-slim' },
        },
      });

      expect(result.imageRef).toBe('ghcr.io/rajatady/magically-agents:hello-world-1.0.0');

      // Verify dispatch was called
      expect(mockFetch.mock.calls[0][0]).toContain('/actions/workflows/build-agent.yml/dispatches');
      expect(mockFetch.mock.calls[0][1].method).toBe('POST');
    });

    it('throws on workflow failure', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, status: 204 });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          workflow_runs: [{ id: 999, status: 'completed' }],
        }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 999, status: 'completed', conclusion: 'failure' }),
      });

      await expect(
        provider.build({
          agentId: 'bad-agent',
          version: '1.0.0',
          bundlePath: '/tmp/unused',
          manifest: { id: 'bad-agent', runtime: { base: 'node:20' } },
        }),
      ).rejects.toThrow(/failed/i);
    });
  });
});
