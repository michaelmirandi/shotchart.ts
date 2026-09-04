import type { LeagueSettings } from "../types";

// NFHS (US High School) — same width as NBA but 10' shorter.
// 3-pt arc at 19'9" spans 180° (terminates at basket-center y level),
// then a 5'3" straight corner-3 section from baseline up to the arc end.
// Geometrically: sr = r and cutoff = basketCenterFromBaseline = 5.25'
// → tpAngle = π/2 → arc spans exactly 180°, joins straight tangentially.
// Corner-3 line sits 5.25' from each sideline (25 ± 19.75).
// No painted restricted-area arc on the court — the zoned chart still
// uses a logical 4' rim radius for analytics (see chart.ts).
export const nfhsSettings: LeagueSettings = {
  leagueId: "nfhs",

  // Court envelope
  courtLength: 84,
  courtWidth: 50,

  // Hoop / backboard (same as NBA)
  basketProtrusionLength: 4,
  basketDiameter: 1.5,
  basketWidth: 6,

  // Paint (matches NCAA-M dimensions)
  keyWidth: 12,
  keyMarks: [11, 14, 17],
  freeThrowLineLength: 19,

  // FT circle
  freeThrowCircleRadius: 6,
  freeThrowCircleStyle: "ncaa-style",

  // 3-point
  threePointRadius: 19.75,
  threePointSideRadius: 19.75,
  threePointCutOffLength: 5.25,

  // Restricted area — no arc drawn on court
  restrictedAreaRadius: null,

  // Other
  centerCircleRadius: 6,
};
