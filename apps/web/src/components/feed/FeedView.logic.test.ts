import { describe, expect, it } from 'vitest';
import { getFeedItemColor, getFeedItemIconName } from './FeedView.logic';

describe('getFeedItemColor', () => {
  it('returns correct color for known types', () => {
    expect(getFeedItemColor('success')).toBe('#22c55e');
    expect(getFeedItemColor('warning')).toBe('#f59e0b');
    expect(getFeedItemColor('error')).toBe('#ef4444');
    expect(getFeedItemColor('info')).toBe('var(--text-3)');
    expect(getFeedItemColor('audio')).toBe('var(--accent)');
  });

  it('returns fallback for unknown type', () => {
    expect(getFeedItemColor('unknown')).toBe('var(--text-3)');
  });
});

describe('getFeedItemIconName', () => {
  it('returns correct icon name for known types', () => {
    expect(getFeedItemIconName('success')).toBe('check-circle');
    expect(getFeedItemIconName('warning')).toBe('alert-triangle');
    expect(getFeedItemIconName('error')).toBe('x-circle');
    expect(getFeedItemIconName('info')).toBe('info');
    expect(getFeedItemIconName('audio')).toBe('music');
  });

  it('returns fallback for unknown type', () => {
    expect(getFeedItemIconName('unknown')).toBe('info');
  });
});
