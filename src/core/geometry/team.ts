import { polygonHull } from "d3-polygon";
import type { Point, TrackingPlayer, TrackingTeam } from "../types";

/**
 * The mean position of one team's players, in tracking feet. This is the
 * team's center of mass — not `polygonCentroid`, which is an area centroid.
 * Returns `null` when the team has nobody on the floor.
 */
export function teamCentroid(players: TrackingPlayer[], team: TrackingTeam): Point | null {
  let x = 0;
  let y = 0;
  let n = 0;
  for (const p of players) {
    if (p.team !== team) continue;
    x += p.x;
    y += p.y;
    n += 1;
  }
  return n === 0 ? null : { x: x / n, y: y / n };
}

/**
 * The convex hull around one team's players, in tracking feet — the "shell"
 * the team covers. Returns `[]` when fewer than 3 players can form one.
 */
export function teamHull(players: TrackingPlayer[], team: TrackingTeam): Point[] {
  const points = players.filter((p) => p.team === team).map((p): [number, number] => [p.x, p.y]);
  const hull = points.length >= 3 ? polygonHull(points) : null;
  return hull ? hull.map(([x, y]) => ({ x, y })) : [];
}
