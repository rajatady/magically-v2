export const TYPE_COLORS: Record<string, string> = {
  info:    'var(--text-3)',
  success: '#22c55e',
  warning: '#f59e0b',
  error:   '#ef4444',
  audio:   'var(--accent)',
};

export const TYPE_ICON_NAMES: Record<string, string> = {
  info:    'info',
  success: 'check-circle',
  warning: 'alert-triangle',
  error:   'x-circle',
  audio:   'music',
};

const FALLBACK_COLOR = 'var(--text-3)';
const FALLBACK_ICON_NAME = 'info';

export function getFeedItemColor(type: string): string {
  return TYPE_COLORS[type] ?? FALLBACK_COLOR;
}

export function getFeedItemIconName(type: string): string {
  return TYPE_ICON_NAMES[type] ?? FALLBACK_ICON_NAME;
}
