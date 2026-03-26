/// <reference types="vite/client" />

interface MagicallyBridge {
  getApiUrl: () => string | null;
  confirm: (message: string) => Promise<boolean>;
  openExternal: (url: string) => Promise<boolean>;
  hapticImpact: () => void;
  hapticNotification: () => void;
}

interface Window {
  magicallyBridge?: MagicallyBridge;
}

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
}
