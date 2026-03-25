import { BuildService, BUILD_PROVIDERS } from './build.service';
import { BuildProvider, type BuildInput, type BuildOutput } from './build-provider';

class StubProvider extends BuildProvider {
  constructor(
    readonly name: string,
    private available: boolean,
  ) {
    super();
  }

  async build(input: BuildInput): Promise<BuildOutput> {
    return { imageRef: `${this.name}/${input.agentId}:${input.version}`, durationMs: 50 };
  }

  async isAvailable(): Promise<boolean> {
    return this.available;
  }
}

describe('BuildService', () => {
  const input: BuildInput = {
    agentId: 'test',
    version: '1.0.0',
    bundlePath: '/tmp/test',
    manifest: { id: 'test', runtime: { base: 'node:20' } },
  };

  it('uses the first available provider', async () => {
    const docker = new StubProvider('docker', true);
    const fly = new StubProvider('fly', true);
    const service = new BuildService([docker, fly]);

    const result = await service.build(input);
    expect(result.imageRef).toBe('docker/test:1.0.0');
  });

  it('falls back to second provider when first is unavailable', async () => {
    const docker = new StubProvider('docker', false);
    const fly = new StubProvider('fly', true);
    const service = new BuildService([docker, fly]);

    const result = await service.build(input);
    expect(result.imageRef).toBe('fly/test:1.0.0');
  });

  it('throws when no provider is available', async () => {
    const docker = new StubProvider('docker', false);
    const fly = new StubProvider('fly', false);
    const service = new BuildService([docker, fly]);

    await expect(service.build(input)).rejects.toThrow(/no build provider/i);
  });
});
