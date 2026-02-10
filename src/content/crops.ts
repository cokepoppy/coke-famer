export type CropId = "parsnip";

export type CropDef = {
  id: CropId;
  name: string;
  seedItemId: string;
  produceItemId: string;
  growthDaysPerStage: number[];
};

export const CROPS: Record<CropId, CropDef> = {
  parsnip: {
    id: "parsnip",
    name: "Parsnip",
    seedItemId: "parsnip_seed",
    produceItemId: "parsnip",
    growthDaysPerStage: [1, 1, 1, 1]
  }
};

