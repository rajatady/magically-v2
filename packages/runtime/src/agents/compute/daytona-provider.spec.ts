import { ConfigService } from '@nestjs/config';
import { DaytonaProvider } from './daytona-provider';

// Mock the SDK
const mockExecuteCommand = jest.fn();
const mockDelete = jest.fn();
const mockCreate = jest.fn();
const mockSnapshotGet = jest.fn();
const mockSnapshotCreate = jest.fn();

jest.mock('@daytonaio/sdk', () => ({
  Daytona: jest.fn().mockImplementation(() => ({
    create: mockCreate,
    delete: mockDelete,
    snapshot: {
      get: mockSnapshotGet,
      create: mockSnapshotCreate,
    },
  })),
  Image: {
    base: jest.fn().mockReturnValue('mock-image'),
  },
}));

describe('DaytonaProvider', () => {
  let provider: DaytonaProvider;

  const mockConfig: Partial<ConfigService> = {
    get: jest.fn((key: string) => {
      const map: Record<string, string> = {
        DAYTONA_API_KEY: 'dtn_test_key',
        DAYTONA_API_URL: 'https://app.daytona.io/api',
        GHCR_REGISTRY: 'ghcr.io/rajatady/magically-agents',
      };
      return map[key];
    }),
  };

  beforeEach(() => {
    provider = new DaytonaProvider(mockConfig as ConfigService);
    jest.clearAllMocks();
  });

  it('has name "daytona"', () => {
    expect(provider.name).toBe('daytona');
  });

  describe('isAvailable', () => {
    it('returns true when API key is configured', async () => {
      expect(await provider.isAvailable()).toBe(true);
    });

    it('returns false when API key is missing', async () => {
      const noKey: Partial<ConfigService> = {
        get: jest.fn(() => undefined),
      };
      const p = new DaytonaProvider(noKey as ConfigService);
      expect(await p.isAvailable()).toBe(false);
    });
  });

  describe('buildImage', () => {
    it('is a no-op (images are pre-built via GitHub Actions)', async () => {
      // buildImage signature matches abstract: (agentId, agentDir, dockerfile, tag)
      // DaytonaProvider ignores all params — images come from GHCR
      await provider.buildImage('test', '/tmp/test', 'FROM node:20', 'test:1.0.0');
      expect(mockCreate).not.toHaveBeenCalled();
    });
  });

  describe('run', () => {
    it('creates an ephemeral sandbox from a snapshot and executes the command', async () => {
      const mockSandbox = {
        process: { executeCommand: mockExecuteCommand },
      };

      // Snapshot exists
      mockSnapshotGet.mockResolvedValue({ name: 'hello-world-1.0.0', state: 'active' });
      mockCreate.mockResolvedValue(mockSandbox);
      mockExecuteCommand.mockResolvedValue({
        exitCode: 0,
        result: 'Hello from Daytona!',
      });
      mockDelete.mockResolvedValue(undefined);

      const output = await provider.run({
        agentId: 'hello-world',
        functionName: 'greet',
        image: 'ghcr.io/rajatady/magically-agents:hello-world-1.0.0',
        cmd: ['python', 'greet.py'],
        env: { GREETING_NAME: 'World' },
        timeoutSeconds: 60,
      });

      expect(output.exitCode).toBe(0);
      expect(output.logs).toContain('Hello from Daytona!');
      expect(output.durationMs).toBeGreaterThanOrEqual(0);

      // Verify sandbox was created from snapshot
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          snapshot: 'hello-world-1.0.0',
          ephemeral: true,
        }),
        expect.any(Object),
      );

      // Verify command was executed
      expect(mockExecuteCommand).toHaveBeenCalledWith(
        'python greet.py',
        undefined,
        expect.objectContaining({ GREETING_NAME: 'World' }),
        60,
      );

      // Verify sandbox was cleaned up
      expect(mockDelete).toHaveBeenCalledWith(mockSandbox, 60);
    });

    it('creates a snapshot if it does not exist', async () => {
      const mockSandbox = {
        process: { executeCommand: mockExecuteCommand },
      };

      // Snapshot doesn't exist
      mockSnapshotGet.mockRejectedValue(new Error('not found'));
      mockSnapshotCreate.mockResolvedValue({ name: 'hello-world-1.0.0' });
      mockCreate.mockResolvedValue(mockSandbox);
      mockExecuteCommand.mockResolvedValue({ exitCode: 0, result: '' });
      mockDelete.mockResolvedValue(undefined);

      await provider.run({
        agentId: 'hello-world',
        functionName: 'greet',
        image: 'ghcr.io/rajatady/magically-agents:hello-world-1.0.0',
        cmd: ['python', 'greet.py'],
        env: {},
      });

      // Should have created the snapshot from the GHCR image
      expect(mockSnapshotCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'hello-world-1.0.0',
          image: 'ghcr.io/rajatady/magically-agents:hello-world-1.0.0',
        }),
        expect.any(Object),
      );
    });

    it('returns error output on non-zero exit code', async () => {
      const mockSandbox = {
        process: { executeCommand: mockExecuteCommand },
      };

      mockSnapshotGet.mockResolvedValue({ name: 'test-1.0.0', state: 'active' });
      mockCreate.mockResolvedValue(mockSandbox);
      mockExecuteCommand.mockResolvedValue({
        exitCode: 1,
        result: 'Error: file not found',
      });
      mockDelete.mockResolvedValue(undefined);

      const output = await provider.run({
        agentId: 'test',
        functionName: 'fail',
        image: 'ghcr.io/rajatady/magically-agents:test-1.0.0',
        cmd: ['python', 'fail.py'],
        env: {},
      });

      expect(output.exitCode).toBe(1);
      expect(output.logs).toContain('Error: file not found');
    });

    it('cleans up sandbox even when execution fails', async () => {
      const mockSandbox = {
        process: { executeCommand: mockExecuteCommand },
      };

      mockSnapshotGet.mockResolvedValue({ name: 'crash-1.0.0', state: 'active' });
      mockCreate.mockResolvedValue(mockSandbox);
      mockExecuteCommand.mockRejectedValue(new Error('sandbox crashed'));
      mockDelete.mockResolvedValue(undefined);

      const output = await provider.run({
        agentId: 'crash',
        functionName: 'boom',
        image: 'ghcr.io/rajatady/magically-agents:crash-1.0.0',
        cmd: ['python', 'boom.py'],
        env: {},
      });

      expect(output.exitCode).toBe(1);
      expect(mockDelete).toHaveBeenCalledWith(mockSandbox, 60);
    });
  });
});
