import { readFileSync, existsSync, writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import { generateDockerfile, type RuntimeConfig } from '@magically/shared/dockerfile';

export { generateDockerfile };

interface Manifest {
  id: string;
  name: string;
  version: string;
  runtime?: RuntimeConfig;
  [key: string]: unknown;
}

export const buildCommand = {
  parseManifest(agentDir: string): Manifest {
    const manifestPath = join(agentDir, 'manifest.json');
    if (!existsSync(manifestPath)) {
      throw new Error(`manifest.json not found in ${agentDir}`);
    }
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as Manifest;
    if (!manifest.runtime) {
      throw new Error(`Agent ${manifest.id} has no runtime block — lightweight agents don't need building`);
    }
    return manifest;
  },

  imageTag(agentId: string, version: string): string {
    return `magically-agent-${agentId}:${version}`;
  },

  exec(agentDir: string): void {
    const manifest = buildCommand.parseManifest(agentDir);
    const tag = buildCommand.imageTag(manifest.id, manifest.version);
    const dockerfile = generateDockerfile(manifest.runtime!);

    const dockerfilePath = join(agentDir, '.Dockerfile.magically');
    writeFileSync(dockerfilePath, dockerfile);
    try {
      console.log(`Building ${tag}...`);
      execSync(`docker build -f ${dockerfilePath} -t ${tag} ${agentDir}`, { stdio: 'inherit' });
      console.log(`Built: ${tag}`);
    } finally {
      unlinkSync(dockerfilePath);
    }
  },
};
