/**
 * Native bridge interface for platform-specific capabilities.
 *
 * When running inside a native shell (Capacitor/Electron), delegates to
 * `window.magicallyBridge`. In the browser, falls back to web APIs.
 */

export interface NativeApi {
  dialogs: {
    confirm: (message: string) => Promise<boolean>;
  };
  shell: {
    openExternal: (url: string) => Promise<void>;
  };
  haptics: {
    impact: () => void;
    notification: () => void;
  };
}

function createBrowserFallback(): NativeApi {
  return {
    dialogs: {
      confirm: async (message: string) => window.confirm(message),
    },
    shell: {
      openExternal: async (url: string) => {
        window.open(url, '_blank', 'noopener,noreferrer');
      },
    },
    haptics: {
      impact: () => {},
      notification: () => {},
    },
  };
}

function createNativeApi(): NativeApi {
  const bridge = window.magicallyBridge!;

  return {
    dialogs: {
      confirm: (message: string) => bridge.confirm(message),
    },
    shell: {
      openExternal: async (url: string) => {
        const opened = await bridge.openExternal(url);
        if (!opened) {
          window.open(url, '_blank', 'noopener,noreferrer');
        }
      },
    },
    haptics: {
      impact: () => bridge.hapticImpact(),
      notification: () => bridge.hapticNotification(),
    },
  };
}

let instance: NativeApi | null = null;

/**
 * Returns the NativeApi if available, or undefined in SSR / before init.
 */
export function readNativeApi(): NativeApi | undefined {
  if (typeof window === 'undefined') return undefined;
  if (instance) return instance;

  if (window.magicallyBridge) {
    instance = createNativeApi();
  } else {
    instance = createBrowserFallback();
  }

  return instance;
}

/**
 * Returns the NativeApi, throwing if unavailable (e.g. SSR).
 */
export function ensureNativeApi(): NativeApi {
  const api = readNativeApi();
  if (!api) {
    throw new Error('Native API is not available.');
  }
  return api;
}
