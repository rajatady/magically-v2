import type { Job } from 'bullmq';
import { BuildProcessor, type AgentBuildJobData } from './build.processor';
import { BuildService } from './build.service';
import { StorageService } from '../registry/storage.service';
import type { DrizzleDB } from '../db';

// @ts-expect-error — Bun global
const isBun = typeof Bun !== 'undefined';

if (!isBun) {
  jest.mock('child_process', () => ({
    execSync: jest.fn().mockReturnValue(Buffer.from('')),
  }));
  jest.mock('fs', () => ({
    ...jest.requireActual('fs'),
    mkdtempSync: jest.fn().mockReturnValue('/tmp/magically-build-abc'),
    rmSync: jest.fn(),
  }));
}

const maybeDescribe = isBun ? describe.skip : describe;

maybeDescribe('BuildProcessor', () => {
  let processor: BuildProcessor;
  let mockDb: Partial<DrizzleDB>;
  let mockStorage: Partial<StorageService>;
  let mockBuildService: Partial<BuildService>;

  const baseJobData: AgentBuildJobData = {
    versionId: 'ver-1',
    agentId: 'hello-world',
    version: '1.0.0',
    bundleUrl: 'https://tigris/bucket/agents/hello-world/1.0.0/bundle.tar.gz',
    manifest: {
      id: 'hello-world',
      runtime: { base: 'python:3.12-slim' },
    },
  };

  afterAll(() => {
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    const updateSet = jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue(undefined) });
    mockDb = {
      update: jest.fn().mockReturnValue({ set: updateSet }),
    } as unknown as DrizzleDB;

    mockStorage = {
      downloadBundle: jest.fn().mockResolvedValue(Buffer.from('fake-tar-gz')),
    };

    mockBuildService = {
      build: jest.fn().mockResolvedValue({
        imageRef: 'ghcr.io/rajatady/magically-agents:hello-world-1.0.0',
        durationMs: 5000,
      }),
    };

    processor = new BuildProcessor(
      mockDb as DrizzleDB,
      mockStorage as StorageService,
      mockBuildService as BuildService,
    );
  });

  it('processes a build job for a container agent', async () => {
    const job = { data: baseJobData } as unknown as Job<AgentBuildJobData>;

    await processor.process(job);

    expect(mockStorage.downloadBundle).toHaveBeenCalledWith(baseJobData.bundleUrl);
    expect(mockBuildService.build).toHaveBeenCalledWith(
      expect.objectContaining({
        agentId: 'hello-world',
        version: '1.0.0',
        bundlePath: '/tmp/magically-build-abc',
      }),
    );
    // Should update DB to 'building' and then 'live'
    expect(mockDb.update).toHaveBeenCalled();
  });

  it('skips build and sets live for agents without runtime block', async () => {
    const job = {
      data: {
        ...baseJobData,
        manifest: { id: 'lightweight', name: 'Light' },
      },
    } as unknown as Job<AgentBuildJobData>;

    await processor.process(job);

    expect(mockStorage.downloadBundle).not.toHaveBeenCalled();
    expect(mockBuildService.build).not.toHaveBeenCalled();
    expect(mockDb.update).toHaveBeenCalled();
  });

  it('sets status to failed on build error', async () => {
    (mockBuildService.build as jest.Mock).mockRejectedValue(new Error('build crashed'));
    const job = { data: baseJobData } as unknown as Job<AgentBuildJobData>;

    await expect(processor.process(job)).rejects.toThrow('build crashed');

    // Should have attempted to set status to 'failed' with buildError
    expect(mockDb.update).toHaveBeenCalled();
  });
});
