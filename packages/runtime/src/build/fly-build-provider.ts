import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { execSync } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { generateDockerfile } from '@magically/shared';
import { BuildProvider, type BuildInput, type BuildOutput } from './build-provider';

/**
 * Builds agent images using Fly's remote builder (no local Docker needed),
 * then tags and pushes the result to GHCR for persistent storage.
 *
 * Fly's --build-only doesn't persist images in registry.fly.io,
 * so we use docker tag + push to GHCR after the remote build.
 * This requires Docker locally to re-tag — if Docker isn't available,
 * use DockerBuildProvider instead (which does the full build locally).
 */
@Injectable()
export class FlyBuildProvider extends BuildProvider {
  readonly name = 'fly';

  constructor(private readonly config: ConfigService) {
    super();
  }

  private get flyApp(): string {
    return this.config.get('FLY_AGENTS_APP') ?? '';
  }

  private get registry(): string {
    return this.config.get('GHCR_REGISTRY') ?? 'ghcr.io/rajatady/magically-agents';
  }

  async isAvailable(): Promise<boolean> {
    return !!this.config.get('FLY_API_TOKEN') && !!this.config.get('FLY_AGENTS_APP');
  }

  async build(input: BuildInput): Promise<BuildOutput> {
    const { agentId, version, bundlePath, manifest } = input;
    const startedAt = Date.now();
    const ghcrTag = `${this.registry}:${agentId}-${version}`;
    const flyTag = `registry.fly.io/${this.flyApp}:${agentId}-${version}`;
    const dockerfile = generateDockerfile(manifest.runtime);
    const dockerfilePath = join(bundlePath, '.Dockerfile.magically');

    writeFileSync(dockerfilePath, dockerfile);

    try {
      // Build remotely via Fly (uses Depot under the hood)
      execSync(
        `fly deploy ${bundlePath} --app ${this.flyApp} --dockerfile ${dockerfilePath} --image-label ${agentId}-${version} --build-only --ha=false`,
        { stdio: 'pipe', timeout: 600_000 },
      );

      // Tag for GHCR and push (requires local Docker)
      execSync(`docker tag ${flyTag} ${ghcrTag}`, { stdio: 'pipe' });
      execSync(`docker push ${ghcrTag}`, { stdio: 'pipe', timeout: 300_000 });

      return { imageRef: ghcrTag, durationMs: Date.now() - startedAt };
    } finally {
      try { unlinkSync(dockerfilePath); } catch {}
    }
  }
}
