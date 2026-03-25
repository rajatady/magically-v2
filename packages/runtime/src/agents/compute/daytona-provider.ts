import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Daytona } from '@daytonaio/sdk';
import { ComputeProvider, type ComputeRunInput, type ComputeRunOutput } from './compute-provider';

/**
 * Runs container agents on Daytona sandboxes.
 *
 * Flow:
 * 1. Ensure a Daytona Snapshot exists for the agent image (created from GHCR)
 * 2. Create an ephemeral sandbox from that snapshot
 * 3. Execute the agent function command
 * 4. Collect output, destroy sandbox
 *
 * Images are pre-built and stored in GHCR via the publish pipeline.
 * Daytona pulls from GHCR using credentials registered in the dashboard.
 */
export class DaytonaProvider extends ComputeProvider {
  readonly name = 'daytona';
  private readonly logger = new Logger(DaytonaProvider.name);
  private client: Daytona | null = null;

  constructor(private readonly config: ConfigService) {
    super();
  }

  private getClient(): Daytona {
    if (!this.client) {
      this.client = new Daytona({
        apiKey: this.config.get('DAYTONA_API_KEY'),
        apiUrl: this.config.get('DAYTONA_API_URL') ?? 'https://app.daytona.io/api',
        target: this.config.get('DAYTONA_TARGET'),
      });
    }
    return this.client;
  }

  async isAvailable(): Promise<boolean> {
    return !!this.config.get('DAYTONA_API_KEY');
  }

  async buildImage(_agentId: string, _agentDir: string, _dockerfile: string, _tag: string): Promise<void> {
    // No-op. Images are pre-built via GitHub Actions → GHCR.
    // Snapshots are created lazily on first run.
  }

  async run(input: ComputeRunInput): Promise<ComputeRunOutput> {
    const { agentId, functionName, image, cmd, env, timeoutSeconds = 300 } = input;
    const startedAt = Date.now();
    const logs: string[] = [];
    const client = this.getClient();

    // Derive snapshot name from image ref: ghcr.io/rajatady/magically-agents:hello-world-1.0.0 → hello-world-1.0.0
    const snapshotName = this.imageToSnapshotName(image);

    // Ensure snapshot exists
    await this.ensureSnapshot(snapshotName, image, logs);

    // Create ephemeral sandbox
    this.logger.log(`Creating sandbox for ${agentId}/${functionName} from snapshot ${snapshotName}`);
    const sandbox = await client.create(
      {
        snapshot: snapshotName,
        ephemeral: true,
        envVars: env,
        labels: {
          'magically.agent': agentId,
          'magically.function': functionName,
        },
        autoStopInterval: Math.ceil(timeoutSeconds / 60) + 1,
      },
      { timeout: 120 },
    );

    logs.push(`Sandbox created for ${agentId}/${functionName}`);

    try {
      // Execute the command
      const command = cmd.join(' ');
      this.logger.log(`Executing: ${command}`);

      const response = await sandbox.process.executeCommand(
        command,
        undefined,
        env,
        timeoutSeconds,
      );

      const exitCode = response.exitCode ?? 0;
      if (response.result) {
        logs.push(...response.result.split('\n').filter(Boolean));
      }

      logs.push(`Sandbox stopped (exit_code=${exitCode})`);

      return { exitCode, logs, durationMs: Date.now() - startedAt };
    } catch (err: any) {
      logs.push(`Execution failed: ${err.message}`);
      return { exitCode: 1, logs, durationMs: Date.now() - startedAt };
    } finally {
      // Always clean up
      try {
        await client.delete(sandbox, 60);
        logs.push('Sandbox deleted');
      } catch (deleteErr: any) {
        this.logger.warn(`Failed to delete sandbox: ${deleteErr.message}`);
      }
    }
  }

  private async ensureSnapshot(snapshotName: string, image: string, logs: string[]): Promise<void> {
    const client = this.getClient();

    try {
      const existing = await client.snapshot.get(snapshotName);
      if (existing) {
        this.logger.log(`Snapshot ${snapshotName} exists`);
        return;
      }
    } catch {
      // Snapshot doesn't exist — create it
    }

    this.logger.log(`Creating snapshot ${snapshotName} from ${image}`);
    logs.push(`Creating snapshot from ${image}...`);

    await client.snapshot.create(
      {
        name: snapshotName,
        image,
      },
      {
        onLogs: (chunk) => this.logger.debug(`[snapshot-build] ${chunk.trim()}`),
        timeout: 600,
      },
    );

    logs.push(`Snapshot ${snapshotName} ready`);
  }

  private imageToSnapshotName(image: string): string {
    // ghcr.io/rajatady/magically-agents:hello-world-1.0.0 → hello-world-1.0.0
    const tag = image.split(':').pop();
    return tag ?? image;
  }
}
