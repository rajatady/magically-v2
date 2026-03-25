import { ComputeProvider, type ComputeRunInput, type ComputeRunOutput } from './compute-provider.js';

class MockProvider extends ComputeProvider {
  readonly name = 'mock';
  available = true;
  buildCalled = false;
  lastInput: ComputeRunInput | null = null;

  async isAvailable() { return this.available; }
  async buildImage(_agentId: string, _agentDir: string, _dockerfile: string, _tag: string) { this.buildCalled = true; }
  async run(input: ComputeRunInput): Promise<ComputeRunOutput> {
    this.lastInput = input;
    return { exitCode: 0, logs: ['ran'], durationMs: 100 };
  }
}

describe('ComputeProvider abstract class', () => {
  it('can be extended and used', async () => {
    const mock = new MockProvider();
    expect(mock.name).toBe('mock');
    expect(await mock.isAvailable()).toBe(true);

    const result = await mock.run({
      agentId: 'test',
      functionName: 'fn',
      image: 'img:1',
      cmd: ['echo'],
      env: { A: 'B' },
    });

    expect(result.exitCode).toBe(0);
    expect(mock.lastInput?.agentId).toBe('test');
    expect(mock.lastInput?.env).toEqual({ A: 'B' });
  });

  it('buildImage can be called', async () => {
    const mock = new MockProvider();
    await mock.buildImage('test', '/dir', 'FROM alpine', 'tag');
    expect(mock.buildCalled).toBe(true);
  });

  it('isAvailable can return false', async () => {
    const mock = new MockProvider();
    mock.available = false;
    expect(await mock.isAvailable()).toBe(false);
  });
});
