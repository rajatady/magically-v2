import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { generateDockerfile } from '@magically/shared';
import { BuildProvider, type BuildInput, type BuildOutput } from './build-provider';

/**
 * Builds agent images by dispatching a GitHub Actions workflow.
 * No Docker needed locally or on the runtime server.
 *
 * Flow:
 * 1. Dispatch workflow_dispatch event to the builder repo
 * 2. Poll the workflow run until it completes
 * 3. Return the GHCR image reference
 *
 * The workflow receives the Tigris bundle URL and Dockerfile content,
 * builds the image in GitHub's runners, and pushes to GHCR.
 */
@Injectable()
export class GitHubActionsBuildProvider extends BuildProvider {
  readonly name = 'github-actions';
  private readonly logger = new Logger(GitHubActionsBuildProvider.name);

  constructor(private readonly config: ConfigService) {
    super();
  }

  private get repo(): string {
    return this.config.get('GITHUB_BUILDER_REPO') ?? '';
  }

  private get token(): string {
    return this.config.get('GITHUB_BUILDER_TOKEN') ?? '';
  }

  private get registry(): string {
    return this.config.get('GHCR_REGISTRY') ?? 'ghcr.io/rajatady/magically-agents';
  }

  async isAvailable(): Promise<boolean> {
    return !!this.config.get('GITHUB_BUILDER_REPO') && !!this.config.get('GITHUB_BUILDER_TOKEN');
  }

  async build(input: BuildInput): Promise<BuildOutput> {
    const { agentId, version, manifest } = input;
    const startedAt = Date.now();
    const imageRef = `${this.registry}:${agentId}-${version}`;

    // Generate Dockerfile and base64 encode it
    const dockerfile = generateDockerfile(manifest.runtime);
    const dockerfileB64 = Buffer.from(dockerfile).toString('base64');

    // The bundle URL is stored in the job data — the processor passes it via manifest
    // We need it from the registry_versions row. For now, expect it in manifest._bundleUrl
    const bundleUrl = manifest._bundleUrl as string;

    // 1. Dispatch the workflow
    this.logger.log(`Dispatching build for ${agentId}@${version} to ${this.repo}`);

    const dispatchRes = await fetch(
      `https://api.github.com/repos/${this.repo}/actions/workflows/build-agent.yml/dispatches`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ref: 'main',
          inputs: {
            agent_id: agentId,
            version,
            bundle_url: bundleUrl,
            dockerfile_content: dockerfileB64,
          },
        }),
      },
    );

    if (!dispatchRes.ok) {
      const text = await dispatchRes.text();
      throw new Error(`Failed to dispatch workflow: ${dispatchRes.status} ${text}`);
    }

    // 2. Wait a moment then find the run
    await this.sleep(3000);
    const runId = await this.findWorkflowRun(agentId, version);

    // 3. Poll until completion
    const conclusion = await this.pollRunCompletion(runId);

    if (conclusion !== 'success') {
      throw new Error(`GitHub Actions build failed with conclusion: ${conclusion}`);
    }

    this.logger.log(`Built ${agentId}@${version} via GitHub Actions → ${imageRef}`);
    return { imageRef, durationMs: Date.now() - startedAt };
  }

  private async findWorkflowRun(agentId: string, version: string, maxAttempts = 10): Promise<number> {
    for (let i = 0; i < maxAttempts; i++) {
      const res = await fetch(
        `https://api.github.com/repos/${this.repo}/actions/runs?per_page=5`,
        {
          headers: {
            Authorization: `Bearer ${this.token}`,
            Accept: 'application/vnd.github.v3+json',
          },
        },
      );

      if (!res.ok) throw new Error(`Failed to list workflow runs: ${res.status}`);

      const data = await res.json() as any;
      const runs = data.workflow_runs ?? [];

      // Find the most recent run (just dispatched)
      if (runs.length > 0) {
        return runs[0].id;
      }

      await this.sleep(2000);
    }

    throw new Error(`Could not find workflow run for ${agentId}@${version}`);
  }

  private async pollRunCompletion(runId: number, maxAttempts = 120): Promise<string> {
    for (let i = 0; i < maxAttempts; i++) {
      const res = await fetch(
        `https://api.github.com/repos/${this.repo}/actions/runs/${runId}`,
        {
          headers: {
            Authorization: `Bearer ${this.token}`,
            Accept: 'application/vnd.github.v3+json',
          },
        },
      );

      if (!res.ok) throw new Error(`Failed to get run status: ${res.status}`);

      const run = await res.json() as any;

      if (run.status === 'completed') {
        return run.conclusion;
      }

      this.logger.log(`Build run ${runId}: ${run.status}...`);
      await this.sleep(10000);
    }

    throw new Error(`Build timed out after ${maxAttempts * 10}s`);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms));
  }
}
