# shotchart.ts

Framework-agnostic basketball shotchart primitives built on D3. Renders to any SVG element — works in React, Vue, Svelte, vanilla JS, anything that can hand you a `<svg>`.

- **Six court presets** — NBA, WNBA, NCAA-M, NCAA-W, FIBA, NFHS High School
- **Five charts** — halfcourt, fullcourt, 14-zone shotchart, per-shot scatter, hexbin density
- **Procedural hardwood floor** — planks, seams and grain drawn in SVG, no image assets
- **Targeted updates** — `setData()`, `setTheme()`, `setStyle()`, `setRadius()` mutate the existing DOM instead of rebuilding
- **Dual CJS + ESM**, full `.d.ts` declarations, d3 externalized
- **Zero framework dependencies**

## Install

```bash
pnpm add shotchart.ts
# or
npm install shotchart.ts
# or
yarn add shotchart.ts
```

D3 modules (`d3-selection`, `d3-scale`, `d3-shape`, `d3-array`, `d3-hexbin`) are declared as runtime dependencies and installed automatically.

## Stylesheet

The chart relies on a small stylesheet for court strokes, floor paint and zone label sizing. Import it once at your app entry:

```ts
import "shotchart.ts/styles.css";
```

Every chart mounts this structure into your `<svg>`, so you can target any layer with CSS:

```html
<g class="shotchart">
  <defs/>                         <!-- floor pattern / grain filter / clipPath -->
  <g class="shot-chart-floor"/>   <!-- hardwood or solid background -->
  <g class="shot-chart-court"/>   <!-- lines, zones, labels -->
  <g class="shot-chart-overlay"/> <!-- shots, hexbins -->
</g>
```

## Halfcourt

A static court diagram, no data.

```ts
import { createHalfcourt } from "shotchart.ts";

const svg = document.querySelector<SVGSVGElement>("#my-court");
const chart = createHalfcourt(svg!, { courtType: "nba", floor: "maple" });

// later
chart.destroy();
```

### `createHalfcourt(svg, options?)`

| Option           | Type                                                         | Default  | Notes                                                                                   |
| ---------------- | ------------------------------------------------------------ | -------- | --------------------------------------------------------------------------------------- |
| `courtType`      | `"nba" \| "wnba" \| "ncaam" \| "ncaaw" \| "fiba" \| "nfhs"` | `"nba"`  | Picks the dimension preset (see [Court types](#court-types)).                           |
| `leagueSettings` | `LeagueSettings`                                             | —        | Override the preset with a custom league. Wins over `courtType`.                        |
| `extent`         | `"arc" \| "half"`                                            | `"arc"`  | `"arc"` crops just past the 3-pt line; `"half"` shows the whole half court with the division line and center circle. |
| `floor`          | `FloorInput`                                                 | `"none"` | Hardwood / solid background (see [Court floor](#court-floor)).                          |

Returns `{ destroy(): void }`.

These four options are shared by every halfcourt-based chart below (`createZonedShotchart`, `createShotScatter`, `createHexbinShotchart`).

### Court types

| `courtType` | Court size  | 3-pt radius              | Notes                                                                 |
| ----------- | ----------- | ------------------------ | --------------------------------------------------------------------- |
| `"nba"`     | 94' × 50'   | 23'9" (corner 22')       | Default. Dashed inner half on FT circle.                              |
| `"wnba"`    | 94' × 50'   | 22'1.75" (corner 21'8")  | Identical to NBA except the 3-point arc.                              |
| `"ncaam"`   | 94' × 50'   | 22'1.75" (since 2019)    | Solid FT circle, narrower 12' paint.                                  |
| `"ncaaw"`   | 94' × 50'   | 22'1.75" (since 2021-22) | Identical to NCAA-M.                                                  |
| `"fiba"`    | 28m × 15m   | 6.75m (≈22'1.75")        | EuroLeague spec. Metric values converted to feet internally.          |
| `"nfhs"`    | 84' × 50'   | 19'9" (5'3" straight)    | 10' shorter court. **No painted restricted-area arc** on the court.   |

#### Units

All `LeagueSettings` values are in **feet**, and so is the SVG: the viewBox is set so 1 user unit = 1 foot. FIBA's metric dimensions (28m × 15m, 6.75m arc, 1.25m restricted area) are converted to feet (91.86' × 49.21', 22.146', 4.1') at the settings boundary.

## Court floor

Every factory accepts a `floor` option. Pass a preset name or an object:

```ts
createHalfcourt(svg, { floor: "walnut" });

createFullcourt(svg, {
  floor: { color: "#3b5b8f", plankWidth: 0.75, grain: false, keyColor: "#2c4670" },
});
```

```ts
type FloorInput = "none" | "wood" | "maple" | "walnut" | "dark" | FloorOptions;

interface FloorOptions {
  type?: "none" | "solid" | "wood"; // default "wood"
  preset?: "maple" | "walnut" | "dark";
  color?: string;        // base tone (the solid color, or the wood's base)
  plankWidth?: number;   // feet, default 0.5
  plankLength?: number;  // feet, default 6
  grain?: boolean;       // feTurbulence overlay, default true
  seamOpacity?: number;  // default 0.25
  paintKey?: boolean;    // fill the lane, default true
  keyColor?: string;     // lane paint (defaults to a preset-derived tone)
  lineColor?: string;    // court line paint (defaults to white via CSS)
}
```

The floor is a `<pattern>` of staggered plank `<rect>`s plus an optional `feTurbulence` grain filter, all sized in feet so it scales with the chart. When a floor is present the court group gets a `shot-chart-court--on-floor` class: lines become 2" white paint, the rim turns orange and the lane is painted. Override any of it in CSS.

## Fullcourt

Both ends, sidelines, division line and center circle, for all six courts.

```ts
import { createFullcourt } from "shotchart.ts";

const court = createFullcourt(svg, { courtType: "fiba", orientation: "horizontal", floor: "maple" });
court.destroy();
```

### `createFullcourt(svg, options?)`

| Option           | Type                         | Default        | Notes                                                       |
| ---------------- | ---------------------------- | -------------- | ----------------------------------------------------------- |
| `courtType`      | `CourtType`                  | `"nba"`        |                                                             |
| `leagueSettings` | `LeagueSettings`             | —              | Override the preset.                                        |
| `orientation`    | `"horizontal" \| "vertical"` | `"horizontal"` | Horizontal = baskets left and right; viewBox is `courtLength × courtWidth`. |
| `floor`          | `FloorInput`                 | `"none"`       |                                                             |

Returns `{ destroy(): void }`. Each half is its own `<g class="shot-chart-court shot-chart-court--near|--far">`.

## Zoned shotchart

A court with 14 shooting zones colored by percentile and labeled with FGM / FGA + FG%.

```ts
import { createZonedShotchart, type ZoneData } from "shotchart.ts";
import "shotchart.ts/styles.css";

const data: ZoneData[] = [
  { bucket: "RIM",   fgm: 18, fga: 24, percentile: 88 },
  { bucket: "R-C3",  fgm: 4,  fga: 11, percentile: 42 },
  { bucket: "M-ATB", fgm: 7,  fga: 19, percentile: 61 },
  // ...one entry per zone you have stats for
];

const chart = createZonedShotchart(svg, {
  courtType: "nba",
  theme: "red-green",
  backgroundTheme: "light",
  data,
});

// Update without rebuilding the DOM
chart.setData(newData);
chart.setTheme("blue-orange");
chart.setBackground("dark");

// Clean up
chart.destroy();
```

### `createZonedShotchart(svg, options)`

| Option            | Type                           | Default       | Notes                                                                 |
| ----------------- | ------------------------------ | ------------- | --------------------------------------------------------------------- |
| `data`            | `ZoneData[]`                   | required      | One entry per zone you have stats for. Missing zones render as empty. |
| `theme`           | `"red-green" \| "blue-orange"` | `"red-green"` | Color palette for percentile fills.                                   |
| `backgroundTheme` | `"dark" \| "light"`            | `"light"`     | Drives text styling for empty zones so labels remain legible.         |
| + halfcourt options | `courtType`, `leagueSettings`, `extent`, `floor` | | NFHS still has a logical 4' RIM zone for analytics even though no arc is drawn. |

Returns `{ setData, setTheme, setBackground, destroy }`.

### `ZoneData`

```ts
interface ZoneData {
  bucket: ShotchartZone;  // see codes below
  fgm: number;
  fga: number;
  percentile: number;     // 0–100, or -1 for "no data"
}
```

### Zone codes

| Code     | Zone                            |
| -------- | ------------------------------- |
| `R-C3`   | Right corner three              |
| `L-C3`   | Left corner three               |
| `R-ATB`  | Right above-the-break three     |
| `L-ATB`  | Left above-the-break three      |
| `M-ATB`  | Middle above-the-break three    |
| `RB-MR`  | Right baseline midrange         |
| `LB-MR`  | Left baseline midrange          |
| `RW-MR`  | Right wing midrange             |
| `LW-MR`  | Left wing midrange              |
| `M-MR`   | Middle midrange                 |
| `R-FL`   | Right floater range             |
| `L-FL`   | Left floater range              |
| `M-FL`   | Middle floater range            |
| `RIM`    | Restricted area / rim           |

## Shot data

The scatter and hexbin charts take individual attempts:

```ts
interface Shot {
  x: number;      // feet from basket center, +x to the right as drawn
  y: number;      // feet from basket center, +y toward halfcourt
  made: boolean;
}
```

That is the NBA Stats API convention divided by ten, so `shotchartdetail` rows map directly:

```ts
const shots: Shot[] = rows.map((r) => ({
  x: r.LOC_X / 10,
  y: r.LOC_Y / 10,
  made: r.SHOT_MADE_FLAG === 1,
}));
```

Shots are league-independent — the same list renders on any court. If your source looks mirrored, negate `x`. Extra fields are fine: the factories are generic over `T extends Shot`, so `setData()` keeps your type.

## Shot scatter

One mark per attempt: filled dots for makes, hollow rings (or X's) for misses.

```ts
import { createShotScatter } from "shotchart.ts";

const chart = createShotScatter(svg, {
  courtType: "nba",
  floor: "maple",
  data: shots,
  style: { missedMarker: "x", radius: 0.5 },
});

chart.setData(nextShots);            // d3 join — only changed marks touch the DOM
chart.setStyle({ madeColor: "#0f0" });
chart.destroy();
```

### `createShotScatter(svg, options)`

| Option  | Type                        | Default | Notes                                                  |
| ------- | --------------------------- | ------- | ------------------------------------------------------ |
| `data`  | `Shot[]`                    | required |                                                       |
| `style` | `Partial<ShotScatterStyle>` | —       | See below.                                             |
| `clip`  | `boolean`                   | `true`  | Clip marks to the court rectangle (hides heaves).      |
| + halfcourt options | `courtType`, `leagueSettings`, `extent`, `floor` | | |

```ts
interface ShotScatterStyle {
  radius: number;        // feet, default 0.6
  madeColor: string;     // default "#22c55e"
  missedColor: string;   // default "#ef4444"
  missedMarker: "ring" | "x"; // default "ring"
  opacity: number;       // default 0.85
  strokeWidth: number;   // feet, default 0.15
}
```

Returns `{ setData, setStyle, destroy }`. Each mark is `<g class="shot shot--made|shot--missed" data-made>`.

## Hexbin shotchart

Shots aggregated into hexagons: **color = FG%** on the theme's palette, **size = attempt frequency**.

```ts
import { createHexbinShotchart } from "shotchart.ts";

const chart = createHexbinShotchart(svg, {
  courtType: "nba",
  data: shots,
  radius: 1.5,           // feet
  theme: "red-green",
  colorDomain: [0.25, 0.65],
  minAttempts: 2,
});

chart.setData(nextShots);
chart.setTheme("blue-orange");
chart.setRadius(2);
chart.bins();            // HexbinDatum[] — the live aggregation
chart.destroy();
```

### `createHexbinShotchart(svg, options)`

| Option         | Type                            | Default        | Notes                                                        |
| -------------- | ------------------------------- | -------------- | ------------------------------------------------------------ |
| `data`         | `Shot[]`                        | required       |                                                              |
| `radius`       | `number`                        | `1.5`          | Hex radius in feet. Binning happens in feet, so cells mean the same thing on every court. |
| `theme`        | `"red-green" \| "blue-orange"`  | `"red-green"`  |                                                              |
| `colorDomain`  | `[number, number]`              | `[0.25, 0.65]` | FG% range (0–1) mapped across the palette.                   |
| `minAttempts`  | `number`                        | `1`            | Hide cells with fewer attempts.                              |
| `sizeScale`    | `"sqrt" \| "linear" \| "none"`  | `"sqrt"`       | How attempt count drives hex size.                           |
| `minSizeRatio` | `number`                        | `0.3`          | Smallest hex as a fraction of `radius`.                      |
| `opacity`      | `number`                        | `0.9`          |                                                              |
| `outline`      | `boolean`                       | `true`         | Faint full-radius outline of every cell, so low-frequency cells still show their footprint. |
| + halfcourt options | `courtType`, `leagueSettings`, `extent`, `floor` | | |

Returns `{ setData, setTheme, setRadius, bins, destroy }`. The pure aggregation is also exported as `binShots(shots, settings, radius): HexbinDatum[]`:

```ts
interface HexbinDatum { x: number; y: number; fga: number; fgm: number; fgPct: number }
```

## Coordinates

`createShotchartSettings(leagueSettings, extent?)` returns the derived SVG layout the renderers use (`basketCenterY`, `visibleCourtLength()`, court width, …), and `shotToSvg` / `svgToShot` convert between basket-relative feet and SVG coordinates. Use them for your own overlays:

```ts
import { select } from "d3-selection";
import { createHalfcourt, createShotchartSettings, nbaSettings, shotToSvg } from "shotchart.ts";

createHalfcourt(svg, { courtType: "nba" });
const settings = createShotchartSettings(nbaSettings);

// Append outside the court group so plain fills apply.
const overlay = select(svg).append("g");
const { x, y } = shotToSvg({ x: -22, y: 1 }, settings); // right corner
overlay.append("circle").attr("cx", x).attr("cy", y).attr("r", 0.5).attr("fill", "gold");
```

## React wrapper

The library doesn't ship a React wrapper, but writing one is straightforward:

```tsx
import { useEffect, useRef } from "react";
import {
  createZonedShotchart,
  type ZoneData,
  type ZonedShotchartInstance,
} from "shotchart.ts";
import "shotchart.ts/styles.css";

interface Props {
  data: ZoneData[];
  courtType?: "nba" | "wnba" | "ncaam" | "ncaaw" | "fiba" | "nfhs";
  theme?: "red-green" | "blue-orange";
  backgroundTheme?: "dark" | "light";
}

export function ZonedShotchart(props: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const chartRef = useRef<ZonedShotchartInstance | null>(null);

  // Create once per court type — structural changes only
  useEffect(() => {
    if (!svgRef.current) return;
    chartRef.current = createZonedShotchart(svgRef.current, props);
    return () => chartRef.current?.destroy();
  }, [props.courtType]);

  // Cheap updates
  useEffect(() => { chartRef.current?.setData(props.data); }, [props.data]);
  useEffect(() => { props.theme && chartRef.current?.setTheme(props.theme); }, [props.theme]);
  useEffect(() => {
    props.backgroundTheme && chartRef.current?.setBackground(props.backgroundTheme);
  }, [props.backgroundTheme]);

  return <svg ref={svgRef} />;
}
```

## Other exports

For custom integrations — legend rendering, alternate palettes, etc:

```ts
import {
  // presets (one per courtType)
  nbaSettings,
  wnbaSettings,
  ncaamSettings,
  ncaawSettings,
  fibaSettings,
  nfhsSettings,

  // layout + projection
  createShotchartSettings,
  shotToSvg,
  svgToShot,

  // aggregation
  binShots,

  // palettes
  redGreenPalette,
  orangeBluePalette,

  // color helpers
  createColorScale,
  zoneColor,

  // pure utilities
  polygonCentroid,
  formatPercentage,
} from "shotchart.ts";
```

## Migration from 0.x

Version 1.0.0 expands the supported court types from 2 to 6 and reshapes `LeagueSettings` to carry every court-dependent dimension (so adding a new court is data, not code).

- `CourtType` is now `"nba" | "wnba" | "ncaam" | "ncaaw" | "fiba" | "nfhs"`. The old `"college"` value is **removed** — use `"ncaam"`.
- `collegeSettings` is **removed** — use `ncaamSettings`.
- `LeagueSettings` now requires `courtLength`, `courtWidth`, `basketProtrusionLength`, `basketDiameter`, `basketWidth`, `freeThrowLineLength`, `freeThrowCircleRadius`, `freeThrowCircleStyle`, `restrictedAreaRadius`, and `centerCircleRadius`. The previous `leftThreeInside` / `rightThreeInside` points are no longer required — the renderer derives them from arc geometry.
- If you were passing a custom `leagueSettings` object, populate the new fields. The shipped presets cover the common cases.
- The court group is now nested: `svg > g.shotchart > g.shot-chart-court`. Class names are unchanged, but selectors that assumed the court group was a direct child of the `<svg>` need updating.
- Halfcourts now draw sidelines (`.shot-chart-court-sideline`).
- The stylesheet's label rule is scoped to `.shotchart text` instead of a bare `text` selector, so it no longer restyles other SVG text on your page.

## Development

```bash
pnpm install
pnpm build       # tsup → dist/
pnpm typecheck   # tsc --noEmit
pnpm test        # vitest (happy-dom)
pnpm lint        # biome check --write
```

## Roadmap

- [x] Customizable court backgrounds
- [x] Individual shot plotting (one dot per shot)
- [x] Hexbin density shotchart
- [x] Fullcourt
- [ ] Team designs & customizable courts
- [ ] Player tracking for Fullcourt

## License

ISC © Michael Mirandi
