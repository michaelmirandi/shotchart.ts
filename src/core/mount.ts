import { type Selection, select } from "d3-selection";
import type { ShotchartSettings } from "./types";

type GroupSelection = Selection<SVGGElement, unknown, null, undefined>;
type DefsSelection = Selection<SVGDefsElement, unknown, null, undefined>;

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MountOptions {
  /** Drawing extent in feet. Padding for stroke overhang is added automatically. */
  viewBox: Bounds;
  /** Optional transform applied to the whole chart (fullcourt rotation). */
  transform?: string;
}

/**
 * The layered DOM every chart renders into:
 *
 *   <g class="shotchart">
 *     <defs/>                          patterns, filters, clipPaths (ids prefixed by `id`)
 *     <g class="shot-chart-floor"/>    hardwood / solid background
 *     <g class="shot-chart-court"/>    lines, zones, labels
 *     <g class="shot-chart-overlay"/>  shots, hexbins
 *   </g>
 *
 * The floor and overlay are siblings of the court group on purpose — the
 * stylesheet's `.shot-chart-court * { fill: transparent }` must not reach them.
 */
export interface ChartLayers {
  /** Unique per mounted chart — use as a prefix for `<defs>` ids. */
  id: string;
  wrapper: GroupSelection;
  defs: DefsSelection;
  floor: GroupSelection;
  court: GroupSelection;
  overlay: GroupSelection;
  /** Remove everything this mount appended to the host SVG. */
  destroy(): void;
}

// 2× stroke-width padding so baseline / sideline / top strokes don't clip.
const VIEWBOX_PAD = 0.1;

let instanceCounter = 0;

export function mountChart(svg: SVGSVGElement, options: MountOptions): ChartLayers {
  instanceCounter += 1;
  const id = `shotchart-${instanceCounter}`;
  const { x, y, width, height } = options.viewBox;

  const root = select(svg)
    .attr("width", "100%")
    .attr(
      "viewBox",
      `${x - VIEWBOX_PAD} ${y - VIEWBOX_PAD} ${width + VIEWBOX_PAD * 2} ${height + VIEWBOX_PAD * 2}`,
    );

  const wrapper = root.append("g").attr("class", "shotchart").attr("data-shotchart-id", id);
  if (options.transform) wrapper.attr("transform", options.transform);

  const defs = wrapper.append("defs");
  const floor = wrapper.append("g").attr("class", "shot-chart-floor");
  const court = wrapper.append("g").attr("class", "shot-chart-court");
  const overlay = wrapper.append("g").attr("class", "shot-chart-overlay");

  return {
    id,
    wrapper,
    defs,
    floor,
    court,
    overlay,
    destroy(): void {
      wrapper.remove();
    },
  };
}

/** The rectangle a halfcourt-based chart draws into, in feet. */
export function courtBounds(settings: ShotchartSettings): Bounds {
  return { x: 0, y: 0, width: settings.courtWidth, height: settings.visibleCourtLength() };
}
