import { drawFloor, resolveFloor, styleCourtForFloor } from "./floor";
import { drawCourt } from "./halfcourt";
import { type ChartLayers, mountChart } from "./mount";
import { createShotchartSettings } from "./settings/chart";
import { resolveLeagueSettings } from "./settings/resolve";
import type { FullcourtInstance, FullcourtOptions, Orientation, ShotchartSettings } from "./types";

export interface MountedFullcourt {
  /** Half-court settings — the full court is two of these halves. */
  settings: ShotchartSettings;
  layers: ChartLayers;
  orientation: Orientation;
}

/**
 * Draw a full court and return its layers. Two `drawCourt` halves (each spanning the whole half
 * court, so they bring their own sidelines, division line, and half of the
 * center circle) are composed in a vertical local frame; the horizontal
 * layout is that frame rotated as a whole, so geometry is never duplicated.
 */
export function mountFullcourt(svg: SVGSVGElement, options: FullcourtOptions): MountedFullcourt {
  const league = resolveLeagueSettings(options.courtType, options.leagueSettings);
  const settings = createShotchartSettings(league, "half");
  const orientation = options.orientation ?? "horizontal";

  const { courtWidth, courtLength } = settings;
  const halfLength = courtLength / 2;
  const horizontal = orientation === "horizontal";

  const layers = mountChart(svg, {
    viewBox: horizontal
      ? { x: 0, y: 0, width: courtLength, height: courtWidth }
      : { x: 0, y: 0, width: courtWidth, height: courtLength },
    // rotate(-90) maps local (x, y) → (y, -x); the translate lifts it back into
    // view: (x, y) → (y, courtWidth - x). A true rotation, so handedness is kept.
    transform: horizontal ? `translate(0, ${courtWidth}) rotate(-90)` : undefined,
  });

  const floor = resolveFloor(options.floor);
  // Planks run the length of the court — the y axis of the local frame.
  if (floor) drawFloor(layers, { x: 0, y: 0, width: courtWidth, height: courtLength }, floor, "y");

  // Near half: baseline at y = courtLength. Far half: the same drawing spun
  // 180° about center court, so its baseline lands at y = 0.
  const near = layers.court
    .append("g")
    .attr("class", "shot-chart-court shot-chart-court--near")
    .attr("transform", `translate(0, ${halfLength})`);
  const far = layers.court
    .append("g")
    .attr("class", "shot-chart-court shot-chart-court--far")
    .attr("transform", `rotate(180, ${courtWidth / 2}, ${halfLength}) translate(0, ${halfLength})`);

  drawCourt(near, settings);
  drawCourt(far, settings);

  if (floor) {
    styleCourtForFloor(near, floor);
    styleCourtForFloor(far, floor);
  }

  return { settings, layers, orientation };
}

/** Mount a static full court. Returns an instance with a `destroy()` method. */
export function createFullcourt(
  svg: SVGSVGElement,
  options: FullcourtOptions = {},
): FullcourtInstance {
  const { layers } = mountFullcourt(svg, options);

  return {
    destroy(): void {
      layers.destroy();
    },
  };
}
