export type CourtType = "nba" | "wnba" | "ncaam" | "ncaaw" | "fiba" | "nfhs";

export type BackgroundTheme = "dark" | "light";

export type Theme = "blue-orange" | "red-green";

/**
 * How much of the half court a chart shows.
 * - `"arc"` (default): baseline up to just past the 3-pt arc — the classic shotchart crop.
 * - `"half"`: the entire half court, including the division line and center circle.
 */
export type CourtExtent = "arc" | "half";

/** Fullcourt layout. `"horizontal"` puts the baskets left and right. */
export type Orientation = "horizontal" | "vertical";

export type ShotchartZone =
  | "R-C3"
  | "L-C3"
  | "R-ATB"
  | "L-ATB"
  | "M-ATB"
  | "RB-MR"
  | "LB-MR"
  | "RW-MR"
  | "LW-MR"
  | "M-MR"
  | "L-FL"
  | "R-FL"
  | "M-FL"
  | "RIM";

export type ShotchartZoneClassName =
  | "right-corner-three-zone"
  | "left-corner-three-zone"
  | "right-three-zone"
  | "left-three-zone"
  | "middle-three-zone"
  | "right-baseline-midrange-zone"
  | "left-baseline-midrange-zone"
  | "right-wing-midrange-zone"
  | "left-wing-midrange-zone"
  | "middle-midrange-zone"
  | "left-floater-zone"
  | "right-floater-zone"
  | "middle-floater-zone"
  | "rim-zone";

export interface Point {
  x: number;
  y: number;
}

export interface LeagueSettings {
  leagueId: CourtType;

  // Court envelope (feet)
  courtLength: number;
  courtWidth: number;

  // Hoop / backboard (feet)
  basketProtrusionLength: number; // baseline to backboard face
  basketDiameter: number; // rim diameter
  basketWidth: number; // backboard width

  // Paint
  keyWidth: number;
  keyMarks: number[];
  freeThrowLineLength: number; // baseline to FT line

  // Free throw circle
  freeThrowCircleRadius: number;
  freeThrowCircleStyle: "nba-style" | "ncaa-style"; // "nba-style" = dashed inside half

  // 3-point arc
  threePointRadius: number;
  threePointSideRadius: number;
  threePointCutOffLength: number;

  // Restricted area (null = no arc drawn — NFHS)
  restrictedAreaRadius: number | null;

  // Other
  centerCircleRadius: number;
}

export interface ShotchartSettings {
  basketDiameter: number;
  basketProtrusionLength: number;
  basketWidth: number;
  courtLength: number;
  courtWidth: number;
  freeThrowLineLength: number;
  freeThrowCircleRadius: number;
  keyMarkWidth: number;
  restrictedCircleRadius: number; // analytics radius (RIM zone); always positive even when league has no painted arc
  leagueSettings: LeagueSettings;
  width: string;
  floaterRange: number;
  rimRange: number;
  leftBaselineMidrangeInside: Point;
  rightBaselineMidrangeInside: Point;
  rightWingMidrangeInside: Point;
  leftWingMidrangeInside: Point;
  rightFloaterInside: Point;
  leftFloaterInside: Point;
  leftThreeInside: Point; // arc/ATB boundary, derived from arc geometry
  rightThreeInside: Point;
  basketCenterY: number; // SVG y of basket center; use for overlays + as the arc origin
  extent: CourtExtent;
  visibleCourtLength: () => number;
}

export interface CourtLines {
  threePointLineXY: Point[];
  restrictedAreaXY: Point[];
  ftOutXY: Point[];
  floaterXY: Point[];
  rimXY: Point[];
}

export type CourtLineKey = keyof CourtLines;

export interface Zone {
  className: string;
  points: Point[];
}

export type LabeledZones = Record<string, Point[]>;

export interface ZonePoints {
  labeledZones: LabeledZones;
  zones: Zone[];
}

export interface ZoneData {
  bucket: ShotchartZone;
  fgm: number;
  fga: number;
  percentile: number;
}

// ---------------------------------------------------------------------------
// Floor
// ---------------------------------------------------------------------------

export type FloorPreset = "maple" | "walnut" | "dark";

export type FloorType = "none" | "solid" | "wood";

export interface FloorOptions {
  /** `"wood"` (default) draws hardwood planks, `"solid"` a flat color, `"none"` nothing. */
  type?: FloorType;
  /** Wood tone preset. Defaults to `"maple"`. */
  preset?: FloorPreset;
  /** Base color override — the solid color, or the wood's base tone. */
  color?: string;
  /** Plank width in feet. Defaults to `0.5`. */
  plankWidth?: number;
  /** Plank length in feet. Defaults to `6`. */
  plankLength?: number;
  /** Subtle wood-grain noise overlay. Defaults to `true`. */
  grain?: boolean;
  /** Opacity of the seams between planks. Defaults to `0.25`. */
  seamOpacity?: number;
  /** Fill the lane with `keyColor`. Defaults to `true`. */
  paintKey?: boolean;
  /** Lane paint color. Defaults to a tone derived from the preset. */
  keyColor?: string;
  /** Court line paint color. Defaults to white (via the stylesheet). */
  lineColor?: string;
}

/** `"none"` (default) keeps the transparent court. A preset name is shorthand for `{ preset }`. */
export type FloorInput = "none" | "wood" | FloorPreset | FloorOptions;

// ---------------------------------------------------------------------------
// Halfcourt / zoned
// ---------------------------------------------------------------------------

export interface HalfcourtOptions {
  /** Court dimensions preset. Defaults to `"nba"`. */
  courtType?: CourtType;
  /** Override the preset with a custom league configuration. */
  leagueSettings?: LeagueSettings;
  /** How much of the half court to show. Defaults to `"arc"`. */
  extent?: CourtExtent;
  /** Hardwood / solid floor behind the court. Defaults to `"none"`. */
  floor?: FloorInput;
}

export interface HalfcourtInstance {
  /** Remove the rendered court from the host SVG. */
  destroy(): void;
}

export interface ZonedShotchartOptions extends HalfcourtOptions {
  /** Per-zone shot statistics. Zones with no entry render as empty. */
  data: ZoneData[];
  /** Color palette for zone fills. Defaults to `"red-green"`. */
  theme?: Theme;
  /** Background context — controls text styling for empty zones. Defaults to `"light"`. */
  backgroundTheme?: BackgroundTheme;
}

export interface ZonedShotchartInstance {
  /** Update zone fills + label text without rebuilding the court. */
  setData(data: ZoneData[]): void;
  /** Swap the color palette. Walks existing zones, no DOM rebuild. */
  setTheme(theme: Theme): void;
  /** Update the background-aware text styling. */
  setBackground(backgroundTheme: BackgroundTheme): void;
  /** Remove the rendered chart from the host SVG. */
  destroy(): void;
}

// ---------------------------------------------------------------------------
// Per-shot data
// ---------------------------------------------------------------------------

/**
 * One field-goal attempt in court coordinates: feet from the basket center,
 * `+x` to the right as drawn (baseline at the bottom), `+y` toward halfcourt.
 * NBA Stats API `LOC_X / 10`, `LOC_Y / 10` maps directly.
 */
export interface Shot {
  x: number;
  y: number;
  made: boolean;
}

export type MissedMarker = "ring" | "x";

export interface ShotScatterStyle {
  /** Mark radius in feet. */
  radius: number;
  madeColor: string;
  missedColor: string;
  /** Hollow ring or an X for misses. */
  missedMarker: MissedMarker;
  opacity: number;
  /** Stroke width of hollow / X marks, in feet. */
  strokeWidth: number;
}

export interface ShotScatterOptions<T extends Shot = Shot> extends HalfcourtOptions {
  data: T[];
  style?: Partial<ShotScatterStyle>;
  /** Clip marks to the court rectangle. Defaults to `true`. */
  clip?: boolean;
}

export interface ShotScatterInstance<T extends Shot = Shot> {
  /** Replace the plotted shots (d3 join — only changed marks touch the DOM). */
  setData(data: T[]): void;
  /** Merge style overrides and re-render marks. */
  setStyle(style: Partial<ShotScatterStyle>): void;
  /** Remove the rendered chart from the host SVG. */
  destroy(): void;
}

// ---------------------------------------------------------------------------
// Hexbin
// ---------------------------------------------------------------------------

/** One aggregated hex cell. `x` / `y` are the cell center in SVG (court) coordinates. */
export interface HexbinDatum {
  x: number;
  y: number;
  fga: number;
  fgm: number;
  /** `fgm / fga`, 0–1. */
  fgPct: number;
}

export type HexbinSizeScale = "sqrt" | "linear" | "none";

export interface HexbinShotchartOptions<T extends Shot = Shot> extends HalfcourtOptions {
  data: T[];
  /** Hex radius in feet. Defaults to `1.5`. */
  radius?: number;
  /** Color palette. Defaults to `"red-green"`. */
  theme?: Theme;
  /** FG% range (0–1) mapped across the palette. Defaults to `[0.25, 0.65]`. */
  colorDomain?: [number, number];
  /** Hide cells with fewer attempts. Defaults to `1`. */
  minAttempts?: number;
  /** How attempt count drives hex size. Defaults to `"sqrt"`. */
  sizeScale?: HexbinSizeScale;
  /** Smallest hex as a fraction of `radius`. Defaults to `0.3`. */
  minSizeRatio?: number;
  /** Fill opacity. Defaults to `0.9`. */
  opacity?: number;
  /** Draw a faint outline of every cell at full radius, so low-frequency cells still show their footprint. Defaults to `true`. */
  outline?: boolean;
}

export interface HexbinShotchartInstance<T extends Shot = Shot> {
  /** Replace the shots, re-bin, and re-render. */
  setData(data: T[]): void;
  /** Swap the color palette. */
  setTheme(theme: Theme): void;
  /** Change the hex radius (feet), re-bin, and re-render. */
  setRadius(radius: number): void;
  /** The current aggregation — handy for legends or tests. */
  bins(): HexbinDatum[];
  /** Remove the rendered chart from the host SVG. */
  destroy(): void;
}

// ---------------------------------------------------------------------------
// Fullcourt
// ---------------------------------------------------------------------------

export interface FullcourtOptions {
  /** Court dimensions preset. Defaults to `"nba"`. */
  courtType?: CourtType;
  /** Override the preset with a custom league configuration. */
  leagueSettings?: LeagueSettings;
  /** Defaults to `"horizontal"` (baskets left and right). */
  orientation?: Orientation;
  /** Hardwood / solid floor behind the court. Defaults to `"none"`. */
  floor?: FloorInput;
}

export interface FullcourtInstance {
  /** Remove the rendered court from the host SVG. */
  destroy(): void;
}

// ---------------------------------------------------------------------------
// Tracking
// ---------------------------------------------------------------------------

export type TrackingTeam = "home" | "away";

/**
 * One player's position in a tracking frame, in feet from center court:
 * `x` along the court's length (baskets at about ±41.75), `y` across it.
 */
export interface TrackingPlayer {
  id: string | number;
  team: TrackingTeam;
  x: number;
  y: number;
  /** Drawn inside the dot — usually the jersey number. */
  label?: string;
}

/** The ball's position in feet from center court. `z` is height off the floor. */
export interface TrackingBall {
  x: number;
  y: number;
  z?: number;
}

/** Everything on the court at one instant. */
export interface TrackingFrame {
  /** Source frame index (e.g. 25 Hz `frame_idx`). Informational. */
  frame: number;
  /** Seconds left in the period. */
  gameClock?: number;
  /** Seconds left on the shot clock; `null` when it is off. */
  shotClock?: number | null;
  players: TrackingPlayer[];
  ball?: TrackingBall | null;
}

export interface TrackingStyle {
  /** Player dot radius in feet. */
  playerRadius: number;
  homeColor: string;
  awayColor: string;
  /** Ball radius in feet at floor level; grows with `z`. */
  ballRadius: number;
  ballColor: string;
  /** Draw each player's `label` inside the dot. */
  labels: boolean;
  labelColor: string;
  opacity: number;
}

export interface TrackingOptions extends FullcourtOptions {
  data: TrackingFrame[];
  style?: Partial<TrackingStyle>;
  /** Source frame rate. Defaults to `25`. */
  fps?: number;
  /** Playback speed multiplier. Defaults to `1`. */
  speed?: number;
  /** Restart from the first frame when playback reaches the end. Defaults to `false`. */
  loop?: boolean;
  /** Called whenever the displayed frame changes (playback or `setFrame`). */
  onFrame?: (index: number, frame: TrackingFrame) => void;
}

export interface TrackingInstance {
  /** Jump to a frame index (clamped to the data). */
  setFrame(index: number): void;
  /** The index of the displayed frame. */
  frame(): number;
  /** Start playback from the current frame (restarts if at the end). */
  play(): void;
  pause(): void;
  isPlaying(): boolean;
  /** Change the playback speed multiplier. */
  setSpeed(speed: number): void;
  /** Replace the frames and jump back to the first one. */
  setData(data: TrackingFrame[]): void;
  /** Merge style overrides and re-render. */
  setStyle(style: Partial<TrackingStyle>): void;
  /** Stop playback and remove the rendered chart from the host SVG. */
  destroy(): void;
}
