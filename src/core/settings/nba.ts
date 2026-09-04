import type { LeagueSettings } from "../types";

export const nbaSettings: LeagueSettings = {
  leagueId: "nba",

  // Court envelope
  courtLength: 94,
  courtWidth: 50,

  // Hoop / backboard
  basketProtrusionLength: 4,
  basketDiameter: 1.5,
  basketWidth: 6,

  // Paint
  keyWidth: 16,
  keyMarks: [7, 8, 11, 14],
  freeThrowLineLength: 19,

  // FT circle
  freeThrowCircleRadius: 6,
  freeThrowCircleStyle: "nba-style",

  // 3-point
  // cutoff = basketCenterFromBaseline + sqrt(r² - sr²) = 5.25 + 9.166 = 14.416
  threePointRadius: 23.75,
  threePointSideRadius: 21.91,
  threePointCutOffLength: 14.416,

  // Restricted area
  restrictedAreaRadius: 4,

  // Other
  centerCircleRadius: 6,
};
