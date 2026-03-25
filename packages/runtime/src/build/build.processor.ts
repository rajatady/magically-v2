import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { eq } from 'drizzle-orm';
import { execSync } from 'child_process';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { InjectDB, type DrizzleDB } from '../db';
import { registryVersions } from '../db/schema';
import { StorageService } from '../registry/storage.service';
import { BuildService } from './build.service';

export interface AgentBuildJobData {
  versionId: string;
  agentId: string;
  version: string;
  bundleUrl: string;
  manifest: Record<string, any>;
}

@Processor('agent-build')
export class BuildProcessor extends WorkerHost {
  private readonly logger = new Logger(BuildProcessor.name);

  constructor(
    @InjectDB() private readonly db: DrizzleDB,
    private readonly storage: StorageService,
    private readonly buildService: BuildService,
  ) {
    super();
  }

  async process(job: Job<AgentBuildJobData>): Promise<void> {
    const { versionId, agentId, version, bundleUrl, manifest } = job.data;

    // No runtime block → lightweight agent, mark live immediately
    if (!manifest.runtime) {
      this.logger.log(`${agentId}@${version} is lightweight — marking live`);
      await this.updateVersion(versionId, { status: 'live' });
      return;
    }

    // Update status to 'building'
    await this.updateVersion(versionId, { status: 'building' });
    this.logger.log(`Building ${agentId}@${version}...`);

    // Download bundle from Tigris
    const bundleBuffer = await this.storage.downloadBundle(bundleUrl);

    // Extract to temp directory
    const tmpDir = mkdtempSync(join(tmpdir(), 'magically-build-'));

    try {
      // Extract tar.gz
      execSync(`tar xzf - -C ${tmpDir}`, { input: bundleBuffer, stdio: ['pipe', 'pipe', 'pipe'] });

      // Build image — attach bundleUrl to manifest for remote builders (GitHub Actions)
      const result = await this.buildService.build({
        agentId,
        version,
        bundlePath: tmpDir,
        manifest: { ...manifest, _bundleUrl: bundleUrl },
      });

      // Update DB with imageRef and mark live
      await this.updateVersion(versionId, {
        status: 'live',
        imageRef: result.imageRef,
      });

      this.logger.log(`Built ${agentId}@${version} → ${result.imageRef} (${result.durationMs}ms)`);
    } catch (err: any) {
      this.logger.error(`Build failed for ${agentId}@${version}: ${err.message}`);
      await this.updateVersion(versionId, {
        status: 'failed',
        buildError: err.message,
      });
      throw err; // Re-throw so BullMQ can retry
    } finally {
      try { rmSync(tmpDir, { recursive: true, force: true }); } catch {}
    }
  }

  private async updateVersion(versionId: string, data: Record<string, any>): Promise<void> {
    await this.db
      .update(registryVersions)
      .set(data)
      .where(eq(registryVersions.id, versionId));
  }
}
