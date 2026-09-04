import type { CourtType, LeagueSettings } from "../types";
import { fibaSettings } from "./fiba";
import { nbaSettings } from "./nba";
import { ncaamSettings } from "./ncaam";
import { ncaawSettings } from "./ncaaw";
import { nfhsSettings } from "./nfhs";
import { wnbaSettings } from "./wnba";

// Record-based lookup keyed by CourtType. Add a new court → one entry here.
const SETTINGS_BY_ID: Record<CourtType, LeagueSettings> = {
  nba: nbaSettings,
  wnba: wnbaSettings,
  ncaam: ncaamSettings,
  ncaaw: ncaawSettings,
  fiba: fibaSettings,
  nfhs: nfhsSettings,
};

export function resolveLeagueSettings(
  courtType: CourtType | undefined,
  override: LeagueSettings | undefined,
): LeagueSettings {
  if (override) return override;
  return SETTINGS_BY_ID[courtType ?? "nba"];
}
