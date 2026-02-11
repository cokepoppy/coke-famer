export type NpcId = "townie";

export type NpcDef = {
  id: NpcId;
  name: string;
};

export const NPCS: Record<NpcId, NpcDef> = {
  townie: { id: "townie", name: "Townie" }
};

