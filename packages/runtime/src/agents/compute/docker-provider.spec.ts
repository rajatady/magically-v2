import { execSync } from 'child_process';
import { DockerProvider } from './docker-provider.js';

let dockerAvailable = false;
try {
  execSync('docker info', { stdio: 'ignore' });
  dockerAvailable = true;
} catch {}

const describeDocker = dockerAvailable ? describe : describe.skip;

describeDocker('DockerProvider', () => {
  let provider: DockerProvider;

  beforeEach(() => {
    provider = new DockerProvider();
  });

  it('reports as available when Docker is running', async () => {
    expect(await provider.isAvailable()).toBe(true);
  });

  it('has name "docker"', () => {
    expect(provider.name).toBe('docker');
  });

  it('runs a simple command and captures output', async () => {
    const result = await provider.run({
      agentId: 'test',
      functionName: 'echo',
      image: 'alpine:latest',
      cmd: ['echo', 'hello from docker'],
      env: {},
      timeoutSeconds: 30,
    });

    expect(result.exitCode).toBe(0);
    expect(result.logs.some(l => l.includes('hello from docker'))).toBe(true);
    expect(result.durationMs).toBeGreaterThan(0);
  });

  it('passes environment variables to the container', async () => {
    const result = await provider.run({
      agentId: 'test',
      functionName: 'env',
      image: 'alpine:latest',
      cmd: ['sh', '-c', 'echo $GREETING'],
      env: { GREETING: 'hi-from-env' },
      timeoutSeconds: 30,
    });

    expect(result.exitCode).toBe(0);
    expect(result.logs.some(l => l.includes('hi-from-env'))).toBe(true);
  });

  it('returns non-zero exit code on failure', async () => {
    const result = await provider.run({
      agentId: 'test',
      functionName: 'fail',
      image: 'alpine:latest',
      cmd: ['sh', '-c', 'exit 42'],
      env: {},
      timeoutSeconds: 30,
    });

    expect(result.exitCode).not.toBe(0);
  });
});
