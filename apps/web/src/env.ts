/**
 * Environment detection for native shell integration.
 *
 * When running inside a Capacitor/Electron shell, the native platform
 * injects `window.magicallyBridge` with platform-specific capabilities.
 * In the browser, these capabilities have web fallbacks or are no-ops.
 */

export const isNative =
  typeof window !== 'undefined' &&
  'magicallyBridge' in window;
