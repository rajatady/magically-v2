import { execSync } from 'child_process';
import { join } from 'path';
import { buildCommand } from './build';

export const pushCommand = {
  registryTag(flyApp: string, agentId: string, version: string): string {
    return `registry.fly.io/${flyApp}:${agentId}-${version}`;
  },

  deployArgs(agentDir: string, flyApp: string, imageLabel: string): string[] {
    return [
      'deploy',
      agentDir,
      '--app', flyApp,
      '--image-label', imageLabel,
      '--ha=false',
      '--build-only',
    ];
  },

  exec(agentDir: string, flyApp: string): void {
    const manifest = buildCommand.parseManifest(agentDir);
    const imageLabel = `${manifest.id}-${manifest.version}`;
    const args = pushCommand.deployArgs(agentDir, flyApp, imageLabel);

    console.log(`Pushing ${manifest.id}@${manifest.version}...`);
    execSync(`fly ${args.join(' ')}`, { stdio: 'inherit', cwd: agentDir });
    console.log(`Pushed: ${manifest.id}@${manifest.version}`);
  },
};
