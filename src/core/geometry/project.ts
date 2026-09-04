import type { Point, ShotchartSettings } from "../types";

/**
 * Court coordinates → SVG coordinates.
 *
 * Court coords are feet from the basket center: `+x` to the right as drawn,
 * `+y` toward halfcourt. SVG coords have the origin at the top-left of the
 * chart with `y` increasing toward the baseline.
 */
export function shotToSvg(shot: { x: number; y: number }, settings: ShotchartSettings): Point {
  return {
    x: settings.courtWidth / 2 + shot.x,
    y: settings.basketCenterY - shot.y,
  };
}

/** SVG coordinates → court coordinates (inverse of `shotToSvg`). */
export function svgToShot(point: Point, settings: ShotchartSettings): { x: number; y: number } {
  return {
    x: point.x - settings.courtWidth / 2,
    y: settings.basketCenterY - point.y,
  };
}
