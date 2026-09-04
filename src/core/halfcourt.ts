import type { Selection } from "d3-selection";
import { type ResolvedFloor, drawFloor, resolveFloor, styleCourtForFloor } from "./floor";
import { appendArcPath } from "./geometry/arcs";
import { type ChartLayers, courtBounds, mountChart } from "./mount";
import { createShotchartSettings } from "./settings/chart";
import { resolveLeagueSettings } from "./settings/resolve";
import type { CourtLines, HalfcourtInstance, HalfcourtOptions, ShotchartSettings } from "./types";

type CourtSelection = Selection<SVGGElement, unknown, null, undefined>;

/**
 * Render the court onto an existing `<g>` element. Returns the court line
 * point arrays that the zoned shotchart needs to partition shooting zones.
 *
 * Everything is positioned relative to `settings.visibleCourtLength()` (the
 * baseline). With `extent: "half"` the top edge is the division line, so the
 * near half of the center circle is drawn there too.
 */
export function drawCourt(base: CourtSelection, settings: ShotchartSettings): CourtLines {
  const courtLines: CourtLines = {
    threePointLineXY: [],
    restrictedAreaXY: [],
    ftOutXY: [],
    floaterXY: [],
    rimXY: [],
  };

  base
    .append("rect")
    .attr("class", "shot-chart-court-key")
    .attr("x", settings.courtWidth / 2 - settings.leagueSettings.keyWidth / 2)
    .attr("y", settings.visibleCourtLength() - settings.freeThrowLineLength)
    .attr("width", settings.leagueSettings.keyWidth)
    .attr("height", settings.freeThrowLineLength);

  base
    .append("line")
    .attr("class", "shot-chart-court-baseline")
    .attr("x1", 0)
    .attr("y1", settings.visibleCourtLength())
    .attr("x2", settings.courtWidth)
    .attr("y2", settings.visibleCourtLength());

  for (const x of [0, settings.courtWidth]) {
    base
      .append("line")
      .attr("class", "shot-chart-court-sideline")
      .attr("x1", x)
      .attr("y1", 0)
      .attr("x2", x)
      .attr("y2", settings.visibleCourtLength());
  }

  if (settings.extent === "half") {
    base
      .append("line")
      .attr("class", "shot-chart-court-division-line")
      .attr("x1", 0)
      .attr("y1", 0)
      .attr("x2", settings.courtWidth)
      .attr("y2", 0);

    // Near half of the center circle: angle 0 points "up", so π/2 → 3π/2
    // sweeps right → down → left, i.e. the half on our side of the division line.
    appendArcPath(
      base,
      settings.leagueSettings.centerCircleRadius,
      Math.PI / 2,
      1.5 * Math.PI,
      settings.courtWidth / 2,
      0,
    )
      .attr("class", "shot-chart-court-center-circle")
      .attr("transform", `translate(${settings.courtWidth / 2}, 0)`);
  } else {
    // The arc crop has no real court line along its top edge. Frame it anyway
    // so the court reads as a closed box (it matters on a painted floor).
    base
      .append("line")
      .attr("class", "shot-chart-court-top-edge")
      .attr("x1", 0)
      .attr("y1", 0)
      .attr("x2", settings.courtWidth)
      .attr("y2", 0);
  }

  const basketCenterY = settings.basketCenterY;
  const basketCenterFromBaseline = settings.visibleCourtLength() - basketCenterY;
  const tpAngle = Math.atan(
    settings.leagueSettings.threePointSideRadius /
      (settings.leagueSettings.threePointCutOffLength - basketCenterFromBaseline),
  );

  appendArcPath(
    base,
    settings.leagueSettings.threePointRadius,
    -tpAngle,
    tpAngle,
    settings.courtWidth / 2,
    basketCenterY,
    "threePointLineXY",
    courtLines,
  )
    .attr("class", "shot-chart-court-3pt-line")
    .attr("transform", `translate(${settings.courtWidth / 2}, ${basketCenterY})`);

  for (const n of [1, -1]) {
    base
      .append("line")
      .attr("class", "shot-chart-court-3pt-line")
      .attr("x1", settings.courtWidth / 2 + settings.leagueSettings.threePointSideRadius * n)
      .attr("y1", settings.visibleCourtLength() - settings.leagueSettings.threePointCutOffLength)
      .attr("x2", settings.courtWidth / 2 + settings.leagueSettings.threePointSideRadius * n)
      .attr("y2", settings.visibleCourtLength());
  }

  // Some leagues (NFHS) don't have a painted restricted-area arc, but the
  // analytics RIM zone always needs a logical 4' radius. Only the *drawn* arc
  // is gated on `restrictedAreaRadius`; the zoned chart uses
  // `settings.restrictedCircleRadius` directly for its RIM polygon.
  if (settings.leagueSettings.restrictedAreaRadius !== null) {
    appendArcPath(
      base,
      settings.leagueSettings.restrictedAreaRadius,
      -Math.PI / 2,
      Math.PI / 2,
      settings.courtWidth / 2,
      basketCenterY,
      "restrictedAreaXY",
      courtLines,
    )
      .attr("class", "shot-chart-court-restricted-area")
      .attr("transform", `translate(${settings.courtWidth / 2}, ${basketCenterY})`);
  }

  const ftCenterY = settings.visibleCourtLength() - settings.freeThrowLineLength;

  appendArcPath(
    base,
    settings.freeThrowCircleRadius,
    -Math.PI / 2,
    Math.PI / 2,
    settings.courtWidth / 2,
    ftCenterY,
    "ftOutXY",
    courtLines,
  )
    .attr("class", "shot-chart-court-ft-circle-top")
    .attr("transform", `translate(${settings.courtWidth / 2}, ${ftCenterY})`);

  if (settings.leagueSettings.freeThrowCircleStyle === "nba-style") {
    appendArcPath(base, settings.freeThrowCircleRadius, Math.PI / 2, 1.5 * Math.PI)
      .attr("class", "shot-chart-court-ft-circle-bottom")
      .attr("transform", `translate(${settings.courtWidth / 2}, ${ftCenterY})`);
  } else {
    // Fill comes from the stylesheet (`.shot-chart-court-key-block`) so the
    // on-floor variant can recolor the blocks.
    for (const offset of [-1, 1] as const) {
      const x =
        offset === -1
          ? settings.courtWidth / 2 - settings.leagueSettings.keyWidth / 2 - 0.66
          : settings.courtWidth / 2 + settings.leagueSettings.keyWidth / 2;
      base
        .append("rect")
        .attr("class", "shot-chart-court-key-block")
        .attr("x", x)
        .attr("y", settings.visibleCourtLength() - 7)
        .attr("width", 0.66)
        .attr("height", 1);
    }
  }

  for (const mark of settings.leagueSettings.keyMarks) {
    for (const n of [1, -1]) {
      base
        .append("line")
        .attr("class", "shot-chart-court-key-mark")
        .attr(
          "x1",
          settings.courtWidth / 2 +
            (settings.leagueSettings.keyWidth / 2) * n +
            settings.keyMarkWidth * n,
        )
        .attr("y1", settings.visibleCourtLength() - mark)
        .attr("x2", settings.courtWidth / 2 + (settings.leagueSettings.keyWidth / 2) * n)
        .attr("y2", settings.visibleCourtLength() - mark);
    }
  }

  base
    .append("line")
    .attr("class", "shot-chart-court-backboard")
    .attr("x1", settings.courtWidth / 2 - settings.basketWidth / 2)
    .attr("y1", settings.visibleCourtLength() - settings.basketProtrusionLength)
    .attr("x2", settings.courtWidth / 2 + settings.basketWidth / 2)
    .attr("y2", settings.visibleCourtLength() - settings.basketProtrusionLength);

  base
    .append("circle")
    .attr("class", "shot-chart-court-hoop")
    .attr("cx", settings.courtWidth / 2)
    .attr("cy", basketCenterY)
    .attr("r", settings.basketDiameter / 2);

  return courtLines;
}

export interface MountedHalfcourt {
  settings: ShotchartSettings;
  layers: ChartLayers;
  courtLines: CourtLines;
  floor: ResolvedFloor | null;
}

/**
 * Shared setup for every halfcourt-based chart: resolve the league, size the
 * SVG, paint the optional floor, draw the court. Charts then render into
 * `layers.court` (zones / labels) or `layers.overlay` (shots / hexbins).
 */
export function mountHalfcourt(svg: SVGSVGElement, options: HalfcourtOptions): MountedHalfcourt {
  const league = resolveLeagueSettings(options.courtType, options.leagueSettings);
  const settings = createShotchartSettings(league, options.extent);
  const bounds = courtBounds(settings);

  const layers = mountChart(svg, { viewBox: bounds });
  const floor = resolveFloor(options.floor);
  // Planks run the length of the court — the y axis in this portrait frame.
  if (floor) drawFloor(layers, bounds, floor, "y");

  const courtLines = drawCourt(layers.court, settings);
  if (floor) styleCourtForFloor(layers.court, floor);

  return { settings, layers, courtLines, floor };
}

/**
 * Mount a static halfcourt onto an SVG element. Returns an instance with a
 * `destroy()` method that removes everything this call appended.
 */
export function createHalfcourt(
  svg: SVGSVGElement,
  options: HalfcourtOptions = {},
): HalfcourtInstance {
  const { layers } = mountHalfcourt(svg, options);

  return {
    destroy(): void {
      layers.destroy();
    },
  };
}
