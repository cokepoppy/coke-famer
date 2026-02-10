export {};

declare global {
  interface Window {
    __cokeFamer?: {
      ready: boolean;
      player: { x: number; y: number; tx: number; ty: number };
      day: number;
      minutes?: number;
      timeText?: string;
      energy?: number;
      energyMax?: number;
      mode: string;
      inventory: Record<string, number>;
      inventorySlots?: Array<{ itemId: string; qty: number } | null>;
      timePaused?: boolean;
      toast?: { text: string; kind: "info" | "warn" | "error"; ts: number } | null;
      tilledCount: number;
      lastClick: { tx: number; ty: number; blocked: boolean; toggled: boolean } | null;
      lastAction: { kind: string; ok: boolean; tx: number; ty: number } | null;
      api?: {
        sleep: () => void;
        save: () => void;
        load: () => void;
        reset: () => void;
        useAt: (tx: number, ty: number, mode?: string) => boolean;
        setPaused: (paused: boolean) => void;
      };
    };
  }
}
