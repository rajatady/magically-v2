import { BuildProvider, type BuildInput, type BuildOutput } from './build-provider';

class MockBuildProvider extends BuildProvider {
  readonly name = 'mock';

  constructor(private available: boolean) {
    super();
  }

  async build(input: BuildInput): Promise<BuildOutput> {
    return {
      imageRef: `mock-registry/${input.agentId}:${input.version}`,
      durationMs: 100,
    };
  }

  async isAvailable(): Promise<boolean> {
    return this.available;
  }
}

describe('BuildProvider', () => {
  it('can be extended and used', async () => {
    const provider = new MockBuildProvider(true);

    expect(provider.name).toBe('mock');
    expect(await provider.isAvailable()).toBe(true);

    const output = await provider.build({
      agentId: 'test-agent',
      version: '1.0.0',
      bundlePath: '/tmp/test',
      manifest: { id: 'test-agent', runtime: { base: 'node:20' } },
    });

    expect(output.imageRef).toBe('mock-registry/test-agent:1.0.0');
    expect(output.durationMs).toBe(100);
  });

  it('can report unavailability', async () => {
    const provider = new MockBuildProvider(false);
    expect(await provider.isAvailable()).toBe(false);
  });
});
