import { ConfigService } from '@nestjs/config';
import { FlyProvider } from './fly-provider';

function makeConfig(env: Record<string, string>): ConfigService {
  return { get: (key: string) => env[key] } as unknown as ConfigService;
}

const flyAvailable = !!process.env.FLY_API_TOKEN && !!process.env.FLY_AGENTS_APP;
const describeFly = flyAvailable ? describe : describe.skip;

describeFly('FlyProvider', () => {
  let provider: FlyProvider;

  beforeEach(() => {
    provider = new FlyProvider(makeConfig({
      FLY_API_TOKEN: process.env.FLY_API_TOKEN!,
      FLY_AGENTS_APP: process.env.FLY_AGENTS_APP!,
    }));
  });

  it('reports as available when config is set', async () => {
    expect(await provider.isAvailable()).toBe(true);
  });

  it('has name "fly"', () => {
    expect(provider.name).toBe('fly');
  });

  it('runs a container on Fly Machines and destroys it', async () => {
    const result = await provider.run({
      agentId: 'test',
      functionName: 'greet',
      image: 'python:3.12-slim',
      cmd: ['python', '-c', 'print("hello from fly")'],
      env: { TEST_VAR: 'works' },
      timeoutSeconds: 60,
    });

    expect(result.exitCode).toBe(0);
    expect(result.durationMs).toBeGreaterThan(0);
    expect(result.logs.some(l => l.includes('destroyed'))).toBe(true);
  }, 120_000);
});

describe('FlyProvider (unavailable)', () => {
  it('reports unavailable when config is missing', async () => {
    const provider = new FlyProvider(makeConfig({}));
    expect(await provider.isAvailable()).toBe(false);
  });
});
