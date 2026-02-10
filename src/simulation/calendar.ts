export type Season = "spring" | "summer" | "fall" | "winter";
export type Weather = "sunny" | "rain";

const SEASONS: Season[] = ["spring", "summer", "fall", "winter"];
const DAYS_PER_SEASON = 28;
const DAYS_PER_YEAR = DAYS_PER_SEASON * SEASONS.length;

function mulberry32(seed: number): number {
  let t = (seed >>> 0) + 0x6d2b79f5;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function calendarFromDay(day: number): { season: Season; dayOfSeason: number; year: number } {
  const dayIndex = Math.max(0, day - 1);
  const year = Math.floor(dayIndex / DAYS_PER_YEAR) + 1;
  const dayOfYear = dayIndex % DAYS_PER_YEAR;
  const seasonIndex = Math.floor(dayOfYear / DAYS_PER_SEASON);
  const season = SEASONS[seasonIndex] ?? "spring";
  const dayOfSeason = (dayOfYear % DAYS_PER_SEASON) + 1;
  return { season, dayOfSeason, year };
}

export function weatherForDay(day: number): Weather {
  const { season } = calendarFromDay(day);
  const r = mulberry32(day * 99991 + 1337);
  if (season === "winter") return "sunny";
  return r < 0.2 ? "rain" : "sunny";
}

