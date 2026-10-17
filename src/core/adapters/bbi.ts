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
  /** `home` / `away` — with `team_id_tracking`, maps possessions to a side. */
  side?: Cell;
  team_id_tracking?: Cell;
}

/** One row of BBI `tracking_possessions` (`possessions.csv`). Extra columns are ignored. */
export interface BbiPossessionRow {
  start_frame: Cell;
  end_frame: Cell;
  off_team_id_tracking: Cell;
}

export interface BbiTrackingOptions {
  /** Supplies jersey labels, and the team id → side mapping for `possessions`. */
  roster?: BbiRosterRow[];
  /** Sets each frame's `offense` from the possession it falls in (`[start_frame, end_frame)`). */
  possessions?: BbiPossessionRow[];
  /** The home team's `*_team_id_tracking` (`games.csv` `home_team_id`). Overrides the roster mapping. */
  homeTeamId?: Cell;
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

  const sorted = [...frames.values()].sort((a, b) => a.frame - b.frame);
  if (options.possessions?.length) assignOffense(sorted, options);
  return sorted;
}

function assignOffense(frames: TrackingFrame[], options: BbiTrackingOptions): void {
  const sideOf = (teamId: Cell): TrackingTeam | undefined => {
    const id = String(teamId);
    if (options.homeTeamId !== undefined && options.homeTeamId !== null) {
      return id === String(options.homeTeamId) ? "home" : "away";
    }
    const row = options.roster?.find((r) => String(r.team_id_tracking) === id);
    return row?.side === "home" || row?.side === "away" ? row.side : undefined;
  };

  const spans = (options.possessions ?? [])
    .map((p) => ({
      start: num(p.start_frame),
      end: num(p.end_frame),
      team: sideOf(p.off_team_id_tracking),
    }))
    .filter(
      (p): p is { start: number; end: number; team: TrackingTeam } =>
        p.start !== null && p.end !== null && p.team !== undefined,
    )
    .sort((a, b) => a.start - b.start);

  // Frames and spans are both sorted, so one forward sweep assigns everything.
  let i = 0;
  for (const frame of frames) {
    while (i < spans.length && (spans[i]?.end ?? 0) <= frame.frame) i += 1;
    const span = spans[i];
    if (span && span.start <= frame.frame) frame.offense = span.team;
  }
}
