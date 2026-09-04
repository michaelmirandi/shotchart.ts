import type { LeagueSettings } from "../types";
import { ncaamSettings } from "./ncaam";

// NCAA Women's court has been identical to NCAA Men's since 2021-22 (when
// the women's arc moved to the international 22'1.75" line). Distinct named
// export for API clarity — only `leagueId` differs.
export const ncaawSettings: LeagueSettings = {
  ...ncaamSettings,
  leagueId: "ncaaw",
};
