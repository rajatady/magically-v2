import { describe, expect, it } from 'vitest';
import { getFeedItemColor, getFeedItemIcon } from './FeedView.logic';

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

describe('getFeedItemIcon', () => {
  it('returns correct icon for known types', () => {
    expect(getFeedItemIcon('success')).toBe('✓');
    expect(getFeedItemIcon('warning')).toBe('⚠');
    expect(getFeedItemIcon('error')).toBe('✕');
    expect(getFeedItemIcon('info')).toBe('◎');
    expect(getFeedItemIcon('audio')).toBe('♪');
  });

  it('returns fallback for unknown type', () => {
    expect(getFeedItemIcon('unknown')).toBe('◎');
  });
});
