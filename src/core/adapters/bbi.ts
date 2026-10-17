import type { TrackingFrame, TrackingPlayer, TrackingTeam } from "../types";

// CSV parsers hand back strings; JSON/Arrow exports hand back numbers. Accept both.
type Cell = string | number | boolean | null | undefined;

/** One row of BBI `tracking_player_frames` (`player_frames.csv`). Extra columns are ignored. */
export interface BbiPlayerFrameRow {
  frame_idx: Cell;
  player_id_tracking: Cell;
  team_side: Cell;
  x: Cell;
  y: Cell;
  jersey?: Cell;
  game_clock?: Cell;
  shot_clock?: Cell;
}

/** One row of BBI `tracking_ball` (`ball_frames.csv`). Extra columns are ignored. */
export interface BbiBallFrameRow {
  frame_idx: Cell;
  x: Cell;
  y: Cell;
  z?: Cell;
  game_clock?: Cell;
  shot_clock?: Cell;
}

/** One row of BBI `roster.csv`. Extra columns are ignored. */
export interface BbiRosterRow {
  player_id_tracking: Cell;
  jersey?: Cell;
}

export interface BbiTrackingOptions {
  /** Supplies jersey labels for player rows that lack a `jersey` column. */
  roster?: BbiRosterRow[];
}

function num(value: Cell): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function label(value: Cell): string | undefined {
  return value === null || value === undefined || value === "" ? undefined : String(value);
}

/**
 * Turn flat BBI player-frame and ball-frame rows into `TrackingFrame`s.
 *
 * Frames are driven by the ball rows (player frames drop out during some dead
 * balls while the ball keeps reporting), so those frames come back with an
 * empty `players` array. With no ball rows, the player rows drive instead.
 * Coordinates pass through unchanged — BBI already uses feet from center court.
 */
export function fromBbiTracking(
  playerRows: BbiPlayerFrameRow[],
  ballRows: BbiBallFrameRow[] = [],
  options: BbiTrackingOptions = {},
): TrackingFrame[] {
  const jerseys = new Map<string, string>();
  for (const row of options.roster ?? []) {
    const jersey = label(row.jersey);
    if (jersey !== undefined) jerseys.set(String(row.player_id_tracking), jersey);
  }

  const frames = new Map<number, TrackingFrame>();
  const frameFor = (row: BbiPlayerFrameRow | BbiBallFrameRow, idx: number): TrackingFrame => {
    let frame = frames.get(idx);
    if (!frame) {
      frame = { frame: idx, players: [], ball: null };
      const gameClock = num(row.game_clock);
      if (gameClock !== null) frame.gameClock = gameClock;
      if (row.shot_clock !== undefined) frame.shotClock = num(row.shot_clock);
      frames.set(idx, frame);
    }
    return frame;
  };

  for (const row of ballRows) {
    const idx = num(row.frame_idx);
    const x = num(row.x);
    const y = num(row.y);
    if (idx === null) continue;
    const frame = frameFor(row, idx);
    if (x !== null && y !== null) frame.ball = { x, y, z: num(row.z) ?? 0 };
  }

  const ballDriven = frames.size > 0;
  for (const row of playerRows) {
    const idx = num(row.frame_idx);
    const x = num(row.x);
    const y = num(row.y);
    if (idx === null || x === null || y === null) continue;
    if (ballDriven && !frames.has(idx)) continue;
    const id = String(row.player_id_tracking);
    const team: TrackingTeam = row.team_side === "home" ? "home" : "away";
    const player: TrackingPlayer = { id, team, x, y };
    const jersey = label(row.jersey) ?? jerseys.get(id);
    if (jersey !== undefined) player.label = jersey;
    frameFor(row, idx).players.push(player);
  }

  return [...frames.values()].sort((a, b) => a.frame - b.frame);
}
