import type { LeagueSettings } from "../types";

export const ncaamSettings: LeagueSettings = {
  leagueId: "ncaam",

  // Court envelope
  courtLength: 94,
  courtWidth: 50,

  // Hoop / backboard
  basketProtrusionLength: 4,
  basketDiameter: 1.5,
  basketWidth: 6,

  // Paint
  keyWidth: 12,
  keyMarks: [11, 14, 17],
  freeThrowLineLength: 19,

  // FT circle
  freeThrowCircleRadius: 6,
  freeThrowCircleStyle: "ncaa-style",

  // 3-point (since 2019: 22'1.75")
  // cutoff = basketCenterFromBaseline + sqrt(r² - sr²) = 5.25 + 4.79 = 10.04
  threePointRadius: 22.146,
  threePointSideRadius: 21.55,
  threePointCutOffLength: 10.04,

  // Restricted area
  restrictedAreaRadius: 4,

  // Other
  centerCircleRadius: 6,
};
