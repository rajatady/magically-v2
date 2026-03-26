import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  generateDockerfile,
  ImageBuildError,
  BuildTimeoutError,
  BuildDispatchError,
} from '@magically/shared';
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

  private get flyApp(): string {
    return this.config.get('FLY_AGENTS_APP') ?? '';
  }

  async isAvailable(): Promise<boolean> {
    return !!this.config.get('GITHUB_BUILDER_REPO') && !!this.config.get('GITHUB_BUILDER_TOKEN');
  }

  async build(input: BuildInput): Promise<BuildOutput> {
    const { agentId, version, manifest } = input;
    const startedAt = Date.now();
    const imageRef = `${this.registry}:${agentId}-${version}`;
    const flyImageRef = this.flyApp
      ? `registry.fly.io/${this.flyApp}:${agentId}-${version}`
      : undefined;

    const dockerfile = generateDockerfile(manifest.runtime);
    const dockerfileB64 = Buffer.from(dockerfile).toString('base64');
    const bundleUrl = manifest._bundleUrl as string;

    // 1. Dispatch the build
    this.logger.log(`Dispatching build for ${agentId}@${version}`);
    await this.dispatchWorkflow(agentId, version, bundleUrl, dockerfileB64);

    // 2. Find the run
    await this.sleep(3000);
    const runId = await this.findWorkflowRun(agentId, version);

    // 3. Poll until completion
    const conclusion = await this.pollRunCompletion(runId, agentId, version);

    // 4. If failed, fetch the reason
    if (conclusion !== 'success') {
      const failureDetail = await this.getFailureDetail(runId);
      throw new ImageBuildError(
        agentId,
        version,
        failureDetail.step,
        failureDetail.reason,
        failureDetail.details,
      );
    }

    this.logger.log(`Built ${agentId}@${version} → ${imageRef}`);
    return { imageRef, flyImageRef, durationMs: Date.now() - startedAt };
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private async dispatchWorkflow(
    agentId: string,
    version: string,
    bundleUrl: string,
    dockerfileB64: string,
  ): Promise<void> {
    const res = await fetch(
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

    if (!res.ok) {
      const text = await res.text();
      throw new BuildDispatchError(
        'Could not start the build process',
        `Dispatch returned ${res.status}: ${text}`,
      );
    }
  }

  private async findWorkflowRun(agentId: string, version: string, maxAttempts = 10): Promise<number> {
    for (let i = 0; i < maxAttempts; i++) {
      const res = await this.ghApi(`/repos/${this.repo}/actions/runs?per_page=5`);
      const runs = (res.workflow_runs ?? []) as Array<{ id: number }>;

      if (runs.length > 0) return runs[0].id;
      await this.sleep(2000);
    }

    throw new BuildDispatchError(
      'Build was dispatched but could not be tracked',
      `No workflow run found for ${agentId}@${version} after ${maxAttempts} attempts`,
    );
  }

  private async pollRunCompletion(
    runId: number,
    agentId: string,
    version: string,
    maxAttempts = 120,
  ): Promise<string> {
    for (let i = 0; i < maxAttempts; i++) {
      const run = await this.ghApi(`/repos/${this.repo}/actions/runs/${runId}`) as {
        status: string;
        conclusion: string;
      };

      if (run.status === 'completed') return run.conclusion;

      this.logger.log(`Build in progress... (${(i + 1) * 10}s)`);
      await this.sleep(10000);
    }

    throw new BuildTimeoutError(agentId, version, maxAttempts * 10);
  }

  /** Fetch which step failed and why */
  private async getFailureDetail(runId: number): Promise<{
    step: string;
    reason: string;
    details: string;
  }> {
    try {
      const data = await this.ghApi(`/repos/${this.repo}/actions/runs/${runId}/jobs`) as {
        jobs: Array<{
          id: number;
          name: string;
          conclusion: string;
          steps: Array<{ name: string; conclusion: string }>;
        }>;
      };

      for (const job of data.jobs) {
        const failedStep = job.steps.find((s) => s.conclusion === 'failure');
        if (!failedStep) continue;

        // Map internal step names to user-facing descriptions
        const step = this.mapStepName(failedStep.name);

        // Try to get logs for the failed job
        let logs = '';
        try {
          const logRes = await fetch(
            `https://api.github.com/repos/${this.repo}/actions/jobs/${job.id}/logs`,
            {
              headers: {
                Authorization: `Bearer ${this.token}`,
                Accept: 'application/vnd.github.v3+json',
              },
              redirect: 'follow',
            },
          );
          if (logRes.ok) {
            const fullLog = await logRes.text();
            // Extract last 30 lines — usually contains the error
            const lines = fullLog.split('\n');
            logs = lines.slice(-30).join('\n');
          }
        } catch {
          // Log fetch failed — continue with what we have
        }

        return {
          step,
          reason: `Build step "${step}" failed`,
          details: logs || `Step "${failedStep.name}" returned failure`,
        };
      }
    } catch {
      // Couldn't fetch failure details
    }

    return {
      step: 'unknown',
      reason: 'Build failed for an unknown reason',
      details: `Run ID: ${runId}`,
    };
  }

  /** Map internal CI step names to user-facing descriptions */
  private mapStepName(internalName: string): string {
    const map: Record<string, string> = {
      'Download agent bundle from Tigris': 'downloading agent bundle',
      'Write Dockerfile': 'preparing build configuration',
      'Log in to GHCR': 'authenticating with image registry',
      'Set up Docker Buildx': 'setting up build tools',
      'Log in to Fly registry': 'authenticating with compute registry',
      'Build and push to GHCR + Fly': 'building and pushing image',
      'Build and push to GHCR': 'building and pushing image',
    };
    return map[internalName] ?? internalName.toLowerCase();
  }

  private async ghApi(path: string): Promise<Record<string, unknown>> {
    const res = await fetch(`https://api.github.com${path}`, {
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!res.ok) {
      throw new BuildDispatchError(
        'Failed to communicate with build service',
        `API ${path} returned ${res.status}`,
      );
    }

    return res.json() as Promise<Record<string, unknown>>;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms));
  }
}
