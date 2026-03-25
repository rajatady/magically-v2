import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { execSync } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { generateDockerfile } from '@magically/shared';
import { BuildProvider, type BuildInput, type BuildOutput } from './build-provider';

@Injectable()
export class DockerBuildProvider extends BuildProvider {
  readonly name = 'docker';

  constructor(private readonly config: ConfigService) {
    super();
  }

  private get registry(): string {
    return this.config.get('GHCR_REGISTRY') ?? 'ghcr.io/rajatady/magically-agents';
  }

  async isAvailable(): Promise<boolean> {
    try {
      execSync('docker info', { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  async build(input: BuildInput): Promise<BuildOutput> {
    const { agentId, version, bundlePath, manifest } = input;
    const startedAt = Date.now();
    const tag = `${this.registry}:${agentId}-${version}`;
    const dockerfile = generateDockerfile(manifest.runtime);
    const dockerfilePath = join(bundlePath, '.Dockerfile.magically');

    writeFileSync(dockerfilePath, dockerfile);

    try {
      execSync(`docker build -f ${dockerfilePath} -t ${tag} ${bundlePath}`, {
        stdio: 'pipe',
        timeout: 600_000,
      });

      execSync(`docker push ${tag}`, {
        stdio: 'pipe',
        timeout: 300_000,
      });

      return { imageRef: tag, durationMs: Date.now() - startedAt };
    } finally {
      try { unlinkSync(dockerfilePath); } catch {}
    }
  }
}
