import { max } from "d3-array";
import { type Hexbin, hexbin as d3Hexbin } from "d3-hexbin";
import { scaleLinear, scaleSqrt } from "d3-scale";
import { shotToSvg } from "./geometry/project";
import { mountHalfcourt } from "./halfcourt";
import { createColorScale } from "./themes/color-scale";
import { orangeBluePalette, redGreenPalette } from "./themes/palettes";
import type {
  HexbinDatum,
  HexbinShotchartInstance,
  HexbinShotchartOptions,
  HexbinSizeScale,
  Shot,
  ShotchartSettings,
  Theme,
} from "./types";

interface ProjectedShot {
  px: number;
  py: number;
  made: boolean;
}

const DEFAULTS = {
  radius: 1.5,
  theme: "red-green" as Theme,
  colorDomain: [0.25, 0.65] as [number, number],
  minAttempts: 1,
  sizeScale: "sqrt" as HexbinSizeScale,
  minSizeRatio: 0.3,
  opacity: 0.9,
  outline: true,
};

function makeHexbin(settings: ShotchartSettings, radius: number): Hexbin<ProjectedShot> {
  // Binning happens in feet, so cells are league-consistent and independent of pixel size.
  return d3Hexbin<ProjectedShot>()
    .x((d) => d.px)
    .y((d) => d.py)
    .radius(radius)
    .extent([
      [0, 0],
      [settings.courtWidth, settings.visibleCourtLength()],
    ]);
}

/**
 * Aggregate shots into hex cells of `radius` feet. Pure — use it for legends,
 * tables, or tests without mounting a chart.
 */
export function binShots(
  shots: readonly Shot[],
  settings: ShotchartSettings,
  radius: number,
): HexbinDatum[] {
  const projected: ProjectedShot[] = shots.map((s) => {
    const p = shotToSvg(s, settings);
    return { px: p.x, py: p.y, made: s.made };
  });

  return makeHexbin(
    settings,
    radius,
  )(projected).map((bin) => {
    const fga = bin.length;
    let fgm = 0;
    for (const s of bin) if (s.made) fgm += 1;
    return { x: bin.x, y: bin.y, fga, fgm, fgPct: fga === 0 ? 0 : fgm / fga };
  });
}

function sizeFor(
  mode: HexbinSizeScale,
  maxFga: number,
  radius: number,
  minSizeRatio: number,
): (fga: number) => number {
  if (mode === "none") return () => radius;
  const scale = (mode === "sqrt" ? scaleSqrt() : scaleLinear())
    .domain([0, Math.max(1, maxFga)])
    .range([radius * minSizeRatio, radius])
    .clamp(true);
  return (fga) => scale(fga);
}

function colorFor(theme: Theme, colorDomain: [number, number]): (fgPct: number) => string {
  const palette = theme === "blue-orange" ? orangeBluePalette : redGreenPalette;
  // Reuse the 0–100 percentile palette scale by mapping the FG% domain onto it.
  const toPercentile = scaleLinear().domain(colorDomain).range([0, 100]).clamp(true);
  const color = createColorScale(palette);
  return (fgPct) => color(toPercentile(fgPct));
}

/**
 * Mount a court with shots aggregated into hexagons: fill = FG% on the
 * theme's palette, size = attempt frequency.
 */
export function createHexbinShotchart<T extends Shot = Shot>(
  svg: SVGSVGElement,
  options: HexbinShotchartOptions<T>,
): HexbinShotchartInstance<T> {
  const { settings, layers } = mountHalfcourt(svg, options);

  let currentData: T[] = options.data;
  let currentTheme: Theme = options.theme ?? DEFAULTS.theme;
  let radius = options.radius ?? DEFAULTS.radius;
  const colorDomain = options.colorDomain ?? DEFAULTS.colorDomain;
  const minAttempts = options.minAttempts ?? DEFAULTS.minAttempts;
  const sizeScale = options.sizeScale ?? DEFAULTS.sizeScale;
  const minSizeRatio = options.minSizeRatio ?? DEFAULTS.minSizeRatio;
  const opacity = options.opacity ?? DEFAULTS.opacity;
  const outline = options.outline ?? DEFAULTS.outline;

  // Outlines live in their own group beneath the fills so z-order survives re-joins.
  const outlines = layers.overlay.append("g").attr("class", "shot-chart-hexbin-outlines");
  const layer = layers.overlay.append("g").attr("class", "shot-chart-hexbins");
  let currentBins: HexbinDatum[] = [];

  function render(): void {
    currentBins = binShots(currentData, settings, radius);
    const visible = currentBins.filter((b) => b.fga >= minAttempts);

    const hex = makeHexbin(settings, radius);
    const size = sizeFor(sizeScale, max(visible, (b) => b.fga) ?? 0, radius, minSizeRatio);
    const color = colorFor(currentTheme, colorDomain);

    // The full-radius footprint of every cell, regardless of how small its fill is.
    outlines
      .selectAll<SVGPathElement, HexbinDatum>("path.hexbin-outline")
      .data(outline ? visible : [])
      .join("path")
      .attr("class", "hexbin-outline")
      .attr("transform", (d) => `translate(${d.x}, ${d.y})`)
      .attr("d", hex.hexagon());

    layer
      .selectAll<SVGPathElement, HexbinDatum>("path.hexbin")
      .data(visible)
      .join("path")
      .attr("class", "hexbin")
      .attr("transform", (d) => `translate(${d.x}, ${d.y})`)
      .attr("d", (d) => hex.hexagon(size(d.fga)))
      .attr("fill-opacity", opacity)
      .attr("data-fga", (d) => d.fga)
      .attr("data-fgm", (d) => d.fgm)
      .attr("data-fg-pct", (d) => d.fgPct.toFixed(3))
      .style("fill", (d) => color(d.fgPct));
  }

  render();

  return {
    setData(data: T[]): void {
      currentData = data;
      render();
    },
    setTheme(theme: Theme): void {
      currentTheme = theme;
      render();
    },
    setRadius(next: number): void {
      radius = next;
      render();
    },
    bins(): HexbinDatum[] {
      return currentBins;
    },
    destroy(): void {
      layers.destroy();
    },
  };
}
