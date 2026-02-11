import type { Season } from "../simulation/calendar";

export type CropId = "parsnip" | "potato" | "blueberry" | "cranberry";

export type CropDef = {
  id: CropId;
  name: string;
  seedItemId: string;
  produceItemId: string;
  growthDaysPerStage: number[];
  regrowDays?: number;
  harvestQty?: number;
  seasons: Season[];
};

export const CROPS: Record<CropId, CropDef> = {
  parsnip: {
    id: "parsnip",
    name: "Parsnip",
    seedItemId: "parsnip_seed",
    produceItemId: "parsnip",
    growthDaysPerStage: [1, 1, 1, 1],
    harvestQty: 1,
    seasons: ["spring"]
  },
  potato: {
    id: "potato",
    name: "Potato",
    seedItemId: "potato_seed",
    produceItemId: "potato",
    growthDaysPerStage: [2, 2, 2, 1],
    harvestQty: 1,
    seasons: ["spring"]
  },
  blueberry: {
    id: "blueberry",
    name: "Blueberry",
    seedItemId: "blueberry_seed",
    produceItemId: "blueberry",
    growthDaysPerStage: [3, 3, 4, 3],
    regrowDays: 4,
    harvestQty: 3,
    seasons: ["summer"]
  },
  cranberry: {
    id: "cranberry",
    name: "Cranberry",
    seedItemId: "cranberry_seed",
    produceItemId: "cranberry",
    growthDaysPerStage: [3, 4, 4, 4],
    regrowDays: 5,
    harvestQty: 2,
    seasons: ["fall"]
  }
};
