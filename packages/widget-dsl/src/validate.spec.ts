import { validateWidgetSpec, parseRefreshInterval } from './validate.js';

describe('validateWidgetSpec', () => {
  const validSpec = {
    size: 'medium',
    refresh: '1m',
    layout: {
      type: 'stack',
      children: [{ type: 'text', value: 'Hello' }],
    },
  };

  it('accepts a valid spec', () => {
    const result = validateWidgetSpec(validSpec);
    expect(result.valid).toBe(true);
    expect(result.spec).toBeDefined();
    expect(result.spec?.theme).toBe('auto'); // default applied
  });

  it('rejects an invalid size', () => {
    const result = validateWidgetSpec({ ...validSpec, size: 'gigantic' });
    expect(result.valid).toBe(false);
    expect(result.errors?.some((e) => e.includes('size'))).toBe(true);
  });

  it('rejects missing required fields', () => {
    const result = validateWidgetSpec({ size: 'small' }); // no layout
    expect(result.valid).toBe(false);
  });

  it('accepts all valid sizes', () => {
    const sizes = ['small', 'medium', 'large', 'tall', 'wide', 'hero'];
    for (const size of sizes) {
      const result = validateWidgetSpec({ ...validSpec, size });
      expect(result.valid).toBe(true);
    }
  });

  it('accepts all valid themes', () => {
    for (const theme of ['auto', 'light', 'dark']) {
      const result = validateWidgetSpec({ ...validSpec, theme });
      expect(result.valid).toBe(true);
    }
  });

  it('returns multiple errors for multiple problems', () => {
    const result = validateWidgetSpec({ size: 'bad', theme: 'neon' });
    expect(result.valid).toBe(false);
    expect((result.errors?.length ?? 0)).toBeGreaterThan(1);
  });
});

describe('parseRefreshInterval', () => {
  it('parses seconds', () => expect(parseRefreshInterval('30s')).toBe(30_000));
  it('parses minutes', () => expect(parseRefreshInterval('5m')).toBe(300_000));
  it('parses hours', () => expect(parseRefreshInterval('2h')).toBe(7_200_000));

  it('throws on invalid format', () => {
    expect(() => parseRefreshInterval('10')).toThrow();
    expect(() => parseRefreshInterval('5d')).toThrow();
    expect(() => parseRefreshInterval('')).toThrow();
  });
});
