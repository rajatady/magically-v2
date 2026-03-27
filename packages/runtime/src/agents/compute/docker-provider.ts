import { execSync } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { ComputeProvider, type ComputeRunInput, type ComputeRunOutput } from './compute-provider';

export class DockerProvider extends ComputeProvider {
  readonly name = 'docker';

  async isAvailable(): Promise<boolean> {
    try {
      execSync('docker info', { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  async buildImage(agentId: string, agentDir: string, dockerfile: string, tag: string): Promise<void> {
    // Check if image already exists
    try {
      execSync(`docker image inspect ${tag}`, { stdio: 'ignore' });
      return;
    } catch {}

    const dockerfilePath = join(agentDir, '.Dockerfile.magically');
    writeFileSync(dockerfilePath, dockerfile);
    try {
      execSync(`docker build -f ${dockerfilePath} -t ${tag} ${agentDir}`, {
        stdio: 'pipe',
        timeout: 300_000,
      });
    } finally {
      unlinkSync(dockerfilePath);
    }
  }

  async run(input: ComputeRunInput): Promise<ComputeRunOutput> {
    const { image, cmd, env, timeoutSeconds = 300 } = input;

    const args = ['run', '--rm'];
    for (const [k, v] of Object.entries(env)) {
      args.push('-e', `${k}=${v}`);
    }
    args.push(image, ...cmd);

    const startedAt = Date.now();

    try {
      const output = execSync(`docker ${args.map(a => `'${a}'`).join(' ')}`, {
        encoding: 'utf-8',
        timeout: timeoutSeconds * 1000,
      });

      return {
        exitCode: 0,
        logs: output.split('\n').filter(Boolean),
        durationMs: Date.now() - startedAt,
      };
    } catch (err: unknown) {
      const execErr = err as { stdout?: string; stderr?: string; status?: number };
      const output = (execErr.stdout || '') + (execErr.stderr || '');
      return {
        exitCode: execErr.status ?? 1,
        logs: output.split('\n').filter(Boolean),
        durationMs: Date.now() - startedAt,
      };
    }
  }
}
