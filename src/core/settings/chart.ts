import type { CourtExtent, LeagueSettings, Point, ShotchartSettings } from "../types";

// Empirically tuned to match the existing NBA + NCAAM values exactly:
//   NBA: 25 - 23.75 * sin(0.534) = 12.91  (matches the prior hardcoded 12.905)
//   NCAAM: 25 - 22.146 * sin(0.534) = 13.73  (matches the prior hardcoded 13.722)
// This is the basketball-convention boundary between the corner-3 line area
// and the middle-3 (top-of-key) area along the 3-point arc, ~30.6° from vertical.
const ATB_BOUNDARY_SIN = 0.50926;

// Distance from backboard face to basket center, in feet. Fixed 15" for any
// regulation hoop mounting (NBA, WNBA, NCAA, FIBA, NFHS — all share it).
// This is NOT the rim radius (basketDiameter / 2 = 0.75'); the rim center is
// mounted 15" out from the backboard regardless of rim diameter.
const RIM_CENTER_OFFSET = 1.25;

// All courts in scope so far are 94×50 except FIBA (49.21' wide) and NFHS
// (84' long, same width). The midrange / floater inflection points below
// were tuned for 94×50; we scale x by the court-width ratio so FIBA stays
// proportional. Y values are distances from baseline (court-length-independent).
function inflection(baseX: number, baseY: number, courtWidth: number, refWidth: number): Point {
  return {
    x: (baseX / refWidth) * courtWidth,
    y: baseY,
  };
}

export function createShotchartSettings(
  leagueSettings: LeagueSettings,
  extent: CourtExtent = "arc",
): ShotchartSettings {
  const { courtLength, courtWidth, basketProtrusionLength, basketDiameter } = leagueSettings;
  const refWidth = 50; // baseline used to scale midrange/floater inflection x-values
  const halfCourtLength = courtLength / 2;

  // Depth from baseline to top of the 3-pt arc = basketCenterFromBaseline + arc radius.
  // basketCenterFromBaseline = backboard offset + standardized 15" rim mounting.
  const basketCenterFromBaseline = basketProtrusionLength + RIM_CENTER_OFFSET;
  const threePointDepth = leagueSettings.threePointRadius + basketCenterFromBaseline;
  // "arc" crops to the arc top plus half the leftover distance to mid-court;
  // "half" shows the whole half court (division line at y = 0).
  const visibleLength =
    extent === "half" ? halfCourtLength : threePointDepth + (halfCourtLength - threePointDepth) / 2;

  const basketCenterY = visibleLength - basketCenterFromBaseline;
  const arcInflectionX = courtWidth / 2 - leagueSettings.threePointRadius * ATB_BOUNDARY_SIN;

  return {
    basketDiameter,
    basketProtrusionLength,
    basketWidth: leagueSettings.basketWidth,
    courtLength,
    courtWidth,
    freeThrowLineLength: leagueSettings.freeThrowLineLength,
    freeThrowCircleRadius: leagueSettings.freeThrowCircleRadius,
    keyMarkWidth: 0.66,
    // Analytics-side RIM zone always uses 4' even when the league has no painted arc (NFHS).
    restrictedCircleRadius: leagueSettings.restrictedAreaRadius ?? 4,
    leagueSettings,
    width: "100%",
    floaterRange: 14.18,
    rimRange: 5,
    leftBaselineMidrangeInside: inflection(39.6, 8.19, courtWidth, refWidth),
    rightBaselineMidrangeInside: inflection(10.4, 8.19, courtWidth, refWidth),
    rightWingMidrangeInside: inflection(31.83, 17.29, courtWidth, refWidth),
    leftWingMidrangeInside: inflection(18.17, 17.29, courtWidth, refWidth),
    rightFloaterInside: inflection(27.55, 9.05, courtWidth, refWidth),
    leftFloaterInside: inflection(22.45, 9.05, courtWidth, refWidth),
    leftThreeInside: { x: arcInflectionX, y: 0 },
    rightThreeInside: { x: arcInflectionX, y: 0 },
    basketCenterY,
    extent,
    visibleCourtLength: (): number => visibleLength,
  };
}
