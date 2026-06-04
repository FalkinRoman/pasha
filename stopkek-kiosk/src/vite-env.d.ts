/// <reference types="vite/client" />

type KioskConfig = import('./api').KioskConfig;

interface Window {
  stopkekKiosk?: {
    onConfig: (cb: (cfg: KioskConfig) => void) => void;
    onDisplayMode: (cb: (mode: 'overlay' | 'header') => void) => void;
    onStaffQuitRequest: (cb: () => void) => void;
    setDisplayMode: (mode: 'overlay' | 'header') => Promise<void>;
    verifyStaffPassword: (password: string) => Promise<boolean>;
    confirmStaffQuit: () => void;
  };
}
