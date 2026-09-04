import type { LeagueSettings } from "../types";

// FIBA / EuroLeague — all metric dimensions converted to feet (internal unit).
//   28 m × 15 m court → 91.86' × 49.21'
//   Arc: 6.75 m radius = 22.146' (same as WNBA / NCAA-W)
//   Corner-3 line is 0.9 m from sideline → sideRadius = 49.21/2 - 0.9*3.281 ≈ 21.667
//   basketCenterFromBaseline = 1.2 m (backboard) + 0.381 m (15" rim mount) ≈ 5.19'
//   cutoff = 5.19 + sqrt(22.146² - 21.667²) ≈ 9.77
//   Restricted area: 1.25 m radius = 4.1'
//   FT circle: 1.8 m radius = 5.91'
export const fibaSettings: LeagueSettings = {
  leagueId: "fiba",

  // Court envelope
  courtLength: 91.86, // 28 m
  courtWidth: 49.21, // 15 m

  // Hoop / backboard
  basketProtrusionLength: 3.94, // 1.2 m
  basketDiameter: 1.5, // 0.45 m rim diameter (matches NBA)
  basketWidth: 5.91, // 1.8 m backboard

  // Paint
  keyWidth: 16.08, // 4.9 m
  keyMarks: [7, 8, 11, 14], // FIBA uses same hashmarks as NBA
  freeThrowLineLength: 19.03, // 5.8 m

  // FT circle
  freeThrowCircleRadius: 5.91, // 1.8 m
  freeThrowCircleStyle: "nba-style", // FIBA has the dashed inner-half circle

  // 3-point
  threePointRadius: 22.146, // 6.75 m
  threePointSideRadius: 21.667,
  threePointCutOffLength: 9.77,

  // Restricted area
  restrictedAreaRadius: 4.1, // 1.25 m

  // Other
  centerCircleRadius: 5.91, // 1.8 m
};
