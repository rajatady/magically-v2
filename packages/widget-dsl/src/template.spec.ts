import { resolveTemplate } from './template.js';

const ctx = {
  data: {
    count: 3,
    title: 'Standup',
    values: [10, 20, 30],
    flag: true,
    tag: 'hello',
  },
  item: {
    name: 'Alice',
    score: 42,
  },
  agent: {
    icon: '📅',
    name: 'Calendar Hero',
  },
};

describe('resolveTemplate', () => {
  it('resolves a single expression, preserving the original type', () => {
    expect(resolveTemplate('{{data.count}}', ctx)).toBe(3);
    expect(resolveTemplate('{{data.flag}}', ctx)).toBe(true);
    expect(resolveTemplate('{{data.values}}', ctx)).toEqual([10, 20, 30]);
  });

  it('resolves string interpolation with multiple expressions', () => {
    expect(resolveTemplate('{{data.count}} items', ctx)).toBe('3 items');
    expect(resolveTemplate('{{item.name}} scored {{item.score}}', ctx)).toBe(
      'Alice scored 42',
    );
  });

  it('returns empty string for undefined paths', () => {
    expect(resolveTemplate('{{data.missing}}', ctx)).toBe('');
  });

  it('resolves deeply nested paths', () => {
    expect(resolveTemplate('{{agent.name}}', ctx)).toBe('Calendar Hero');
  });

  it('evaluates equality comparisons', () => {
    expect(resolveTemplate('{{data.count == 3}}', ctx)).toBe(true);
    expect(resolveTemplate('{{data.count == 5}}', ctx)).toBe(false);
    expect(resolveTemplate('{{data.count != 3}}', ctx)).toBe(false);
  });

  it('evaluates numeric comparisons', () => {
    expect(resolveTemplate('{{data.count > 0}}', ctx)).toBe(true);
    expect(resolveTemplate('{{data.count > 10}}', ctx)).toBe(false);
    expect(resolveTemplate('{{item.score >= 42}}', ctx)).toBe(true);
    expect(resolveTemplate('{{item.score <= 41}}', ctx)).toBe(false);
  });

  it('evaluates null comparisons', () => {
    expect(resolveTemplate('{{data.missing != null}}', ctx)).toBe(false);
    expect(resolveTemplate('{{data.count != null}}', ctx)).toBe(true);
  });

  it('evaluates string literal comparisons', () => {
    expect(resolveTemplate(`{{data.tag == 'hello'}}`, ctx)).toBe(true);
    expect(resolveTemplate(`{{data.tag == 'world'}}`, ctx)).toBe(false);
  });
});
