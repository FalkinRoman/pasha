/// <reference types="vite/client" />

type KioskConfig = import('./api').KioskConfig;

interface Window {
  stopkekKiosk?: {
    onConfig: (cb: (cfg: KioskConfig) => void) => void;
  };
}
