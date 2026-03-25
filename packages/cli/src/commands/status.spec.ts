import { statusCommand } from './status';

const mockFetch = jest.fn();
global.fetch = mockFetch as any;

describe('statusCommand', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe('getStatus', () => {
    it('fetches and returns version status', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          status: 'live',
          imageRef: 'ghcr.io/rajatady/magically-agents:test-1.0.0',
          buildError: null,
        }),
      });

      const result = await statusCommand.getStatus('http://localhost:4321', 'token', 'test', '1.0.0');

      expect(result.status).toBe('live');
      expect(result.imageRef).toBe('ghcr.io/rajatady/magically-agents:test-1.0.0');
    });

    it('returns failed status with build error', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          status: 'failed',
          buildError: 'No Docker available',
          imageRef: null,
        }),
      });

      const result = await statusCommand.getStatus('http://localhost:4321', 'token', 'test', '1.0.0');

      expect(result.status).toBe('failed');
      expect(result.buildError).toBe('No Docker available');
    });
  });
});
