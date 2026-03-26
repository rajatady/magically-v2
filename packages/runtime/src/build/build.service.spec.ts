import { ConfigService } from '@nestjs/config';
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

function mockConfig(buildProvider = 'auto'): ConfigService {
  return { get: jest.fn((key: string, def?: string) => key === 'BUILD_PROVIDER' ? buildProvider : def) } as unknown as ConfigService;
}

describe('BuildService', () => {
  const input: BuildInput = {
    agentId: 'test',
    version: '1.0.0',
    bundlePath: '/tmp/test',
    manifest: { id: 'test', runtime: { base: 'node:20' } },
  };

  it('uses the first available provider in auto mode', async () => {
    const docker = new StubProvider('docker', true);
    const fly = new StubProvider('fly', true);
    const service = new BuildService([docker, fly], mockConfig());

    const result = await service.build(input);
    expect(result.imageRef).toBe('docker/test:1.0.0');
  });

  it('falls back to second provider when first is unavailable', async () => {
    const docker = new StubProvider('docker', false);
    const fly = new StubProvider('fly', true);
    const service = new BuildService([docker, fly], mockConfig());

    const result = await service.build(input);
    expect(result.imageRef).toBe('fly/test:1.0.0');
  });

  it('throws when no provider is available', async () => {
    const docker = new StubProvider('docker', false);
    const fly = new StubProvider('fly', false);
    const service = new BuildService([docker, fly], mockConfig());

    await expect(service.build(input)).rejects.toThrow(/no build provider/i);
  });

  it('uses explicit provider when BUILD_PROVIDER is set', async () => {
    const docker = new StubProvider('docker', true);
    const fly = new StubProvider('fly', true);
    const service = new BuildService([docker, fly], mockConfig('fly'));

    const result = await service.build(input);
    expect(result.imageRef).toBe('fly/test:1.0.0');
  });

  it('throws when explicit provider is unavailable', async () => {
    const docker = new StubProvider('docker', true);
    const fly = new StubProvider('fly', false);
    const service = new BuildService([docker, fly], mockConfig('fly'));

    await expect(service.build(input)).rejects.toThrow(/no build provider/i);
  });
});
