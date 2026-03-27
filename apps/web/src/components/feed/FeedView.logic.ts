export const TYPE_COLORS: Record<string, string> = {
  info:    'var(--text-3)',
  success: '#22c55e',
  warning: '#f59e0b',
  error:   '#ef4444',
  audio:   'var(--accent)',
};

export const TYPE_ICONS: Record<string, string> = {
  info:    '◎',
  success: '✓',
  warning: '⚠',
  error:   '✕',
  audio:   '♪',
};

const FALLBACK_COLOR = 'var(--text-3)';
const FALLBACK_ICON = '◎';

export function getFeedItemColor(type: string): string {
  return TYPE_COLORS[type] ?? FALLBACK_COLOR;
}

export function getFeedItemIcon(type: string): string {
  return TYPE_ICONS[type] ?? FALLBACK_ICON;
}
