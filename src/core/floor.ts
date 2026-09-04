import type { Selection } from "d3-selection";
import type { Bounds, ChartLayers } from "./mount";
import type { FloorInput, FloorOptions, FloorPreset } from "./types";

type GroupSelection = Selection<SVGGElement, unknown, null, undefined>;

/** Which axis the planks run along, in the chart's local frame. */
export type PlankAxis = "x" | "y";

interface PresetSpec {
  base: string;
  tones: string[];
  seam: string;
  key: string;
}

const PRESETS: Record<FloorPreset, PresetSpec> = {
  maple: {
    base: "#d8b07a",
    tones: ["#dcb684", "#d3a973", "#e0bb8b", "#cfa46e"],
    seam: "#8b6a45",
    key: "#c9a26b",
  },
  walnut: {
    base: "#7a5236",
    tones: ["#7e5639", "#734b31", "#845c3e", "#6e472e"],
    seam: "#3f2a1b",
    key: "#6b4630",
  },
  dark: {
    base: "#3a3a3a",
    tones: ["#3d3d3d", "#363636", "#414141", "#333333"],
    seam: "#222222",
    key: "#2e2e2e",
  },
};

const DEFAULTS = {
  plankWidth: 0.5,
  plankLength: 6,
  grain: true,
  seamOpacity: 0.25,
  paintKey: true,
} as const;

// Rows of planks per pattern tile. Running-bond offsets below are chosen so
// no two adjacent rows share a joint and the tile repeats seamlessly.
const ROWS_PER_TILE = 8;

export interface ResolvedFloor {
  type: "solid" | "wood";
  base: string;
  tones: string[];
  seam: string;
  keyColor: string;
  /** `null` = leave line color to the stylesheet. */
  lineColor: string | null;
  plankWidth: number;
  plankLength: number;
  grain: boolean;
  seamOpacity: number;
  paintKey: boolean;
}

function parseHex(hex: string): [number, number, number] | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.replace(/./g, (c) => c + c);
  return [
    Number.parseInt(h.slice(0, 2), 16),
    Number.parseInt(h.slice(2, 4), 16),
    Number.parseInt(h.slice(4, 6), 16),
  ];
}

function shiftHex(hex: string, delta: number): string {
  const rgb = parseHex(hex);
  if (!rgb) return hex;
  const clamp = (v: number): number => Math.max(0, Math.min(255, Math.round(v + delta)));
  return `#${rgb.map((v) => clamp(v).toString(16).padStart(2, "0")).join("")}`;
}

/** Normalize the public `floor` option into a fully specified spec, or `null` for no floor. */
export function resolveFloor(input: FloorInput | undefined): ResolvedFloor | null {
  if (input === undefined || input === "none") return null;

  let options: FloorOptions;
  if (typeof input === "string") {
    options = input === "wood" ? {} : { preset: input };
  } else {
    options = input;
  }

  const type = options.type ?? "wood";
  if (type === "none") return null;

  const preset = PRESETS[options.preset ?? "maple"];
  const custom = options.color !== undefined;
  const base = options.color ?? preset.base;

  return {
    type,
    base,
    // A custom base color derives its plank tones / seam / key from itself so
    // the floor stays coherent; presets ship hand-picked values.
    tones: custom ? [4, -5, 8, -10].map((d) => shiftHex(base, d)) : preset.tones,
    seam: custom ? shiftHex(base, -70) : preset.seam,
    keyColor: options.keyColor ?? (custom ? shiftHex(base, -14) : preset.key),
    lineColor: options.lineColor ?? null,
    plankWidth: options.plankWidth ?? DEFAULTS.plankWidth,
    plankLength: options.plankLength ?? DEFAULTS.plankLength,
    grain: options.grain ?? DEFAULTS.grain,
    seamOpacity: options.seamOpacity ?? DEFAULTS.seamOpacity,
    paintKey: options.paintKey ?? DEFAULTS.paintKey,
  };
}

function appendPlankPattern(
  layers: ChartLayers,
  floor: ResolvedFloor,
  plankAxis: PlankAxis,
): string {
  const patternId = `${layers.id}-planks`;
  const { plankWidth, plankLength, tones, seam, seamOpacity } = floor;
  const seamWidth = Math.min(0.04, plankWidth / 8);

  // The tile is two plank-lengths wide so each row holds one full plank plus
  // the two ends of its neighbor, which wrap across the tile edge with the
  // same tone. Joints therefore only land at the stagger points — a seam at
  // the tile edge would line up in every row and read as a grid.
  const tileWidth = plankLength * 2;

  const pattern = layers.defs
    .append("pattern")
    .attr("id", patternId)
    .attr("patternUnits", "userSpaceOnUse")
    .attr("width", tileWidth)
    .attr("height", plankWidth * ROWS_PER_TILE);

  // Planks are authored running along x; rotate the tile when they should run along y.
  if (plankAxis === "y") pattern.attr("patternTransform", "rotate(90)");

  for (let row = 0; row < ROWS_PER_TILE; row += 1) {
    const y = row * plankWidth;
    // Deterministic running-bond offset in (0, 1) — never 0 so joints stagger every row.
    const joint = (((row * 37) % 100) + 13) / 100;
    const jointX = joint * plankLength;
    const toneA = tones[(row * 3) % tones.length];
    const toneB = tones[(row * 3 + 1) % tones.length];

    // [0, jointX) and [jointX + L, 2L) are the same wrapped plank (tone B);
    // [jointX, jointX + L) is the full plank in between (tone A).
    const spans: [number, number, string][] = [
      [0, jointX, toneB],
      [jointX, jointX + plankLength, toneA],
      [jointX + plankLength, tileWidth, toneB],
    ];
    for (const [x0, x1, tone] of spans) {
      pattern
        .append("rect")
        .attr("x", x0)
        .attr("y", y)
        .attr("width", x1 - x0)
        .attr("height", plankWidth)
        .attr("fill", tone);
    }

    // Seams: the long edge below this row, plus the two end joints.
    const seams: [number, number, number, number][] = [
      [0, y + plankWidth, tileWidth, y + plankWidth],
      [jointX, y, jointX, y + plankWidth],
      [jointX + plankLength, y, jointX + plankLength, y + plankWidth],
    ];
    for (const [x1, y1, x2, y2] of seams) {
      pattern
        .append("line")
        .attr("x1", x1)
        .attr("y1", y1)
        .attr("x2", x2)
        .attr("y2", y2)
        .attr("stroke", seam)
        .attr("stroke-width", seamWidth)
        .attr("stroke-opacity", seamOpacity);
    }
  }

  return patternId;
}

function appendGrainFilter(layers: ChartLayers, plankAxis: PlankAxis): string {
  const filterId = `${layers.id}-grain`;
  // High frequency across the plank, low along it → streaky grain. Frequencies
  // are per user unit (feet), so the grain scales with the chart.
  const baseFrequency = plankAxis === "y" ? "0.05 0.9" : "0.9 0.05";

  const filter = layers.defs
    .append("filter")
    .attr("id", filterId)
    .attr("color-interpolation-filters", "sRGB");

  filter
    .append("feTurbulence")
    .attr("type", "fractalNoise")
    .attr("baseFrequency", baseFrequency)
    .attr("numOctaves", 2)
    .attr("seed", 7)
    .attr("result", "noise");
  filter
    .append("feColorMatrix")
    .attr("in", "noise")
    .attr("type", "saturate")
    .attr("values", 0)
    .attr("result", "gray");
  filter
    .append("feComponentTransfer")
    .attr("in", "gray")
    .attr("result", "grain")
    .append("feFuncA")
    .attr("type", "table")
    .attr("tableValues", "0 0.14");
  filter
    .append("feBlend")
    .attr("in", "SourceGraphic")
    .attr("in2", "grain")
    .attr("mode", "multiply");

  return filterId;
}

/**
 * Paint the floor into `layers.floor`. `bounds` is the court rectangle in the
 * chart's local frame; `plankAxis` is the axis planks run along in that frame
 * (planks run the length of the court, so `"y"` for the portrait halfcourt).
 */
export function drawFloor(
  layers: ChartLayers,
  bounds: Bounds,
  floor: ResolvedFloor,
  plankAxis: PlankAxis,
): void {
  const { x, y, width, height } = bounds;

  layers.floor
    .append("rect")
    .attr("class", "shot-chart-floor-base")
    .attr("x", x)
    .attr("y", y)
    .attr("width", width)
    .attr("height", height)
    .attr("fill", floor.base);

  if (floor.type === "solid") return;

  const patternId = appendPlankPattern(layers, floor, plankAxis);
  const planks = layers.floor
    .append("rect")
    .attr("class", "shot-chart-floor-planks")
    .attr("x", x)
    .attr("y", y)
    .attr("width", width)
    .attr("height", height)
    .attr("fill", `url(#${patternId})`);

  if (floor.grain) {
    const filterId = appendGrainFilter(layers, plankAxis);
    planks.attr("filter", `url(#${filterId})`);
  }
}

/**
 * Switch an already-drawn court group to its on-floor look: paint-colored
 * lines (via the `--on-floor` modifier class) and an optional painted lane.
 * Must run after `drawCourt`.
 */
export function styleCourtForFloor(court: GroupSelection, floor: ResolvedFloor): void {
  court.classed("shot-chart-court--on-floor", true);

  if (floor.paintKey) {
    // `.style()`, not `.attr()`: the stylesheet's `.shot-chart-court * { fill: transparent }`
    // beats presentation attributes.
    court.select("rect.shot-chart-court-key").style("fill", floor.keyColor);
  }

  if (floor.lineColor !== null) {
    court.selectAll<SVGElement, unknown>("*").style("stroke", floor.lineColor);
  }
}
