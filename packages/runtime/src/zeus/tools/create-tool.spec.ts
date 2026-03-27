import { describe, it, expect } from 'vitest';
import { safeExecute } from './create-tool';

describe('safeExecute', () => {
  it('returns the result of the function', async () => {
    const result = await safeExecute('test', async () => ({ value: 42 }));
    expect(result).toEqual({ value: 42 });
  });

  it('catches Error and returns { error: message }', async () => {
    const result = await safeExecute('test', async () => {
      throw new Error('DB connection lost');
    });
    expect(result).toEqual({ error: 'DB connection lost' });
  });

  it('catches non-Error throws and returns generic message', async () => {
    const result = await safeExecute('test', async () => {
      throw 'something broke';
    });
    expect(result).toEqual({ error: 'Tool execution failed' });
  });
});
