import type { LeagueSettings } from "../types";

// WNBA: identical to NBA in every dimension except the 3-point arc.
// Arc: 22'1.75" radius (6.75 m), corner 3 at 21'8" from basket.
// Corner-3 line sits 3.33' from sideline (25 - 21.667).
// cutoff = basketCenterFromBaseline + sqrt(r² - sr²)
//        = 5.25 + sqrt(22.146² - 21.667²) ≈ 9.83
export const wnbaSettings: LeagueSettings = {
  leagueId: "wnba",

  // Court envelope (identical to NBA)
  courtLength: 94,
  courtWidth: 50,

  // Hoop / backboard (identical to NBA)
  basketProtrusionLength: 4,
  basketDiameter: 1.5,
  basketWidth: 6,

  // Paint (identical to NBA)
  keyWidth: 16,
  keyMarks: [7, 8, 11, 14],
  freeThrowLineLength: 19,

  // FT circle (identical to NBA)
  freeThrowCircleRadius: 6,
  freeThrowCircleStyle: "nba-style",

  // 3-point (WNBA-specific)
  threePointRadius: 22.146,
  threePointSideRadius: 21.667,
  threePointCutOffLength: 9.83,

  // Restricted area (identical to NBA)
  restrictedAreaRadius: 4,

  // Other
  centerCircleRadius: 6,
};
