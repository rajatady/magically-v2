import { publishCommand } from './publish';
import * as childProcess from 'child_process';
import * as fs from 'fs';

const mockFetch = jest.fn();
let mockExecSync: jest.SpyInstance;

describe('publishCommand', () => {
  beforeAll(() => {
    mockExecSync = jest.spyOn(childProcess, 'execSync').mockReturnValue(Buffer.from('') as any);
    jest.spyOn(fs, 'readFileSync').mockReturnValue(Buffer.from('fake-bundle') as any);
    jest.spyOn(fs, 'existsSync').mockReturnValue(true as any);
    global.fetch = mockFetch as any;
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe('createBundle', () => {
    it('creates a tar.gz buffer from an agent directory', () => {
      const buffer = publishCommand.createBundle('/tmp/fake-agent');
      // execSync should have been called with tar
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('tar czf'),
        expect.any(Object),
      );
    });
  });

  describe('publish', () => {
    it('sends multipart request to the runtime and returns result', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          agentId: 'test',
          version: '1.0.0',
          versionId: 'v-1',
          status: 'processing',
        }),
      });

      const result = await publishCommand.sendPublish(
        'http://localhost:4321',
        'test-token',
        { id: 'test', version: '1.0.0' },
        Buffer.from('fake-bundle'),
      );

      expect(result.status).toBe('processing');
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:4321/api/registry/publish',
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  describe('pollStatus', () => {
    it('polls until status is live', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'building' }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'live', imageRef: 'ghcr.io/test:1.0.0' }) });

      const result = await publishCommand.pollStatus(
        'http://localhost:4321',
        'test-token',
        'test',
        '1.0.0',
        100, // fast poll for tests
      );

      expect(result.status).toBe('live');
    });

    it('returns failed status with error', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'failed', buildError: 'Docker not found' }),
      });

      const result = await publishCommand.pollStatus(
        'http://localhost:4321',
        'test-token',
        'test',
        '1.0.0',
        100,
      );

      expect(result.status).toBe('failed');
      expect(result.buildError).toBe('Docker not found');
    });
  });
});
