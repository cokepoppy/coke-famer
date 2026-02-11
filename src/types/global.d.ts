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
      gold?: number;
      season?: string;
      dayOfSeason?: number;
      year?: number;
      weather?: string;
      selectedSeed?: string;
      timePaused?: boolean;
      toast?: { text: string; kind: "info" | "warn" | "error"; ts: number } | null;
      chest?: { tx: number; ty: number; slots: Array<{ itemId: string; qty: number } | null> } | null;
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
        invPickup: (index: number) => { itemId: string; qty: number } | null;
        invSplitHalf: (index: number) => { itemId: string; qty: number } | null;
        invPlace: (index: number, stack: { itemId: string; qty: number }) => { itemId: string; qty: number } | null;
        invPlaceOne: (
          index: number,
          stack: { itemId: string; qty: number }
        ) => { ok: boolean; remaining: { itemId: string; qty: number } | null };
        shopBuy: (itemId: string, qty: number) => { ok: boolean; reason?: string };
        sellStack: (stack: { itemId: string; qty: number }) => { ok: boolean; goldGained?: number; reason?: string };
        placeChestAt: (tx: number, ty: number) => boolean;
        openChestAt: (tx: number, ty: number) => boolean;
        closeChest: () => void;
        chestPickup: (index: number) => { itemId: string; qty: number } | null;
        chestSplitHalf: (index: number) => { itemId: string; qty: number } | null;
        chestPlace: (index: number, stack: { itemId: string; qty: number }) => { itemId: string; qty: number } | null;
        chestPlaceOne: (
          index: number,
          stack: { itemId: string; qty: number }
        ) => { ok: boolean; remaining: { itemId: string; qty: number } | null };
      };
    };
  }
}
