import { mountFullcourt } from "./fullcourt";
import { trackingToSvg } from "./geometry/project";
import { teamCentroid, teamHull } from "./geometry/team";
import type {
  Point,
  TrackingFrame,
  TrackingInstance,
  TrackingOptions,
  TrackingPlayer,
  TrackingShapeToggles,
  TrackingShapes,
  TrackingStyle,
  TrackingTeam,
} from "./types";

const DEFAULT_STYLE: TrackingStyle = {
  playerRadius: 1,
  homeColor: "#2563eb",
  awayColor: "#dc2626",
  ballRadius: 0.5,
  ballColor: "#f97316",
  labels: true,
  labelColor: "#ffffff",
  opacity: 1,
  hullOpacity: 0.15,
  centroidRadius: 0.8,
  spokeWidth: 0.12,
};

type Role = keyof TrackingShapes;

/** One side of the ball's shapes for the displayed frame, already in SVG coords. */
interface TeamShape {
  role: Role;
  team: TrackingTeam;
  toggles: TrackingShapeToggles;
  centroid: Point;
  hull: Point[];
  spokes: { key: string; role: Role; team: TrackingTeam; from: Point; to: Point }[];
}

type FrameListener = (index: number, frame: TrackingFrame) => void;

// The ball grows by its radius for every 20 ft of height — enough to read a
// lob or a shot arc without hiding the players underneath.
const BALL_HEIGHT_SCALE = 20;

/**
 * Mount a full court and play back tracking frames on it: one dot per
 * player (keyed by `id`, so dots persist and only move between frames) and
 * the ball on top. Playback is time-based, so it runs at `fps × speed`
 * regardless of the display's refresh rate.
 */
export function createTracking(svg: SVGSVGElement, options: TrackingOptions): TrackingInstance {
  const { settings, layers, orientation } = mountFullcourt(svg, options);

  let frames: TrackingFrame[] = options.data;
  let style: TrackingStyle = { ...DEFAULT_STYLE, ...options.style };
  const fps = options.fps ?? 25;
  const loop = options.loop ?? false;
  let speed = options.speed ?? 1;
  let shapes: TrackingShapes = { ...options.shapes };
  const listeners = new Set<FrameListener>();
  const project = (p: { x: number; y: number }): Point => trackingToSvg(p, settings);

  // Fractional frame position while playing; the displayed index is its floor.
  let position = 0;
  let index = -1;
  let rafId: number | null = null;
  let lastTime: number | null = null;

  // The overlay sits inside the chart's rotate(-90) on a horizontal court, so
  // labels need the opposite turn to read upright.
  const labelRotation = orientation === "horizontal" ? "rotate(90)" : null;

  // Bottom to top: hulls + spokes, players, centroid markers, ball, caller's layer.
  const layer = layers.overlay.append("g").attr("class", "shot-chart-tracking");
  const shapesLayer = layer.append("g").attr("class", "tracking-shapes");
  const playersLayer = layer.append("g").attr("class", "tracking-players");
  const centroidsLayer = layer.append("g").attr("class", "tracking-centroids");
  const ball = layer.append("circle").attr("class", "tracking-ball");
  const custom = layer.append("g").attr("class", "tracking-custom");

  const teamColor = (team: TrackingTeam): string =>
    team === "home" ? style.homeColor : style.awayColor;

  function teamShapes(frame: TrackingFrame | undefined): TeamShape[] {
    const offense = frame?.offense ?? options.offense;
    if (!frame || !offense) return [];
    const defense: TrackingTeam = offense === "home" ? "away" : "home";
    const sides: [Role, TrackingTeam][] = [
      ["defense", defense],
      ["offense", offense],
    ];

    return sides.flatMap(([role, team]) => {
      const toggles = shapes[role] ?? {};
      if (!toggles.centroid && !toggles.hull && !toggles.spokes) return [];
      const center = teamCentroid(frame.players, team);
      if (!center) return [];
      const centroid = project(center);
      return [
        {
          role,
          team,
          toggles,
          centroid,
          hull: toggles.hull ? teamHull(frame.players, team).map(project) : [],
          spokes: toggles.spokes
            ? frame.players
                .filter((p) => p.team === team)
                .map((p) => ({
                  key: `${role}-${p.id}`,
                  role,
                  team,
                  from: centroid,
                  to: project(p),
                }))
            : [],
        },
      ];
    });
  }

  function renderShapes(frame: TrackingFrame | undefined): void {
    const teams = teamShapes(frame);

    shapesLayer
      .selectAll<SVGPathElement, TeamShape>("path.tracking-hull")
      .data(
        teams.filter((t) => t.hull.length > 0),
        (d) => d.role,
      )
      .join("path")
      .attr("class", (d) => `tracking-hull tracking-hull--${d.role}`)
      .attr("data-team", (d) => d.team)
      .attr("d", (d) => `M${d.hull.map((p) => `${p.x},${p.y}`).join("L")}Z`)
      .attr("fill", (d) => teamColor(d.team))
      .attr("fill-opacity", style.hullOpacity)
      .attr("stroke", (d) => teamColor(d.team))
      .attr("stroke-opacity", 0.6)
      .attr("stroke-width", style.spokeWidth)
      .attr("stroke-linejoin", "round");

    shapesLayer
      .selectAll<SVGLineElement, TeamShape["spokes"][number]>("line.tracking-spoke")
      .data(
        teams.flatMap((t) => t.spokes),
        (d) => d.key,
      )
      .join("line")
      .attr("class", (d) => `tracking-spoke tracking-spoke--${d.role}`)
      .attr("x1", (d) => d.from.x)
      .attr("y1", (d) => d.from.y)
      .attr("x2", (d) => d.to.x)
      .attr("y2", (d) => d.to.y)
      .attr("stroke", (d) => teamColor(d.team))
      .attr("stroke-opacity", 0.7)
      .attr("stroke-width", style.spokeWidth)
      .attr("stroke-dasharray", `${style.spokeWidth * 4} ${style.spokeWidth * 3}`);

    // A hollow ring + crosshair, so the centroid never reads as a player dot.
    const r = style.centroidRadius;
    const markers = centroidsLayer
      .selectAll<SVGGElement, TeamShape>("g.tracking-centroid")
      .data(
        teams.filter((t) => t.toggles.centroid),
        (d) => d.role,
      )
      .join((enter) => {
        const g = enter.append("g");
        g.append("circle").attr("class", "tracking-centroid-halo").attr("fill", "none");
        g.append("circle").attr("class", "tracking-centroid-ring").attr("fill", "none");
        g.append("path").attr("class", "tracking-centroid-cross").attr("fill", "none");
        return g;
      })
      .attr("class", (d) => `tracking-centroid tracking-centroid--${d.role}`)
      .attr("data-team", (d) => d.team)
      .attr("transform", (d) => `translate(${d.centroid.x}, ${d.centroid.y})`);

    markers
      .select(".tracking-centroid-halo")
      .attr("r", r)
      .attr("stroke", "#ffffff")
      .attr("stroke-opacity", 0.85)
      .attr("stroke-width", style.spokeWidth * 3.5);
    markers
      .select(".tracking-centroid-ring")
      .attr("r", r)
      .attr("stroke", (d) => teamColor(d.team))
      .attr("stroke-width", style.spokeWidth * 1.5);
    markers
      .select(".tracking-centroid-cross")
      .attr("d", `M${-r * 1.6},0H${r * 1.6}M0,${-r * 1.6}V${r * 1.6}`)
      .attr("stroke", (d) => teamColor(d.team))
      .attr("stroke-width", style.spokeWidth);
  }

  function render(): void {
    const current = frames[index];
    const players = current?.players ?? [];

    const marks = playersLayer
      .selectAll<SVGGElement, TrackingPlayer>("g.tracking-player")
      .data(players, (d) => String(d.id))
      .join((enter) => {
        const g = enter.append("g");
        g.append("circle");
        g.append("text")
          .attr("text-anchor", "middle")
          .attr("dominant-baseline", "central")
          .attr("font-weight", 600);
        return g;
      })
      .attr("class", (d) => `tracking-player tracking-player--${d.team}`)
      .attr("data-id", (d) => String(d.id))
      .attr("opacity", style.opacity)
      .attr("transform", (d) => {
        const p = trackingToSvg(d, settings);
        return `translate(${p.x}, ${p.y})`;
      });

    marks
      .select("circle")
      .attr("r", style.playerRadius)
      .attr("fill", (d) => (d.team === "home" ? style.homeColor : style.awayColor));

    // Inline `!important` so the stylesheet's `.shotchart text` label rule
    // (black fill + stroke, rem font size) doesn't restyle the jersey numbers.
    marks
      .select("text")
      .attr("transform", labelRotation)
      .style("font-size", `${style.playerRadius * 1.1}px`, "important")
      .style("fill", style.labelColor, "important")
      .style("stroke", "none", "important")
      .text((d) => (style.labels ? (d.label ?? "") : ""));

    const b = current?.ball;
    if (b) {
      const p = trackingToSvg(b, settings);
      const lift = 1 + Math.max(0, b.z ?? 0) / BALL_HEIGHT_SCALE;
      ball
        .attr("display", null)
        .attr("cx", p.x)
        .attr("cy", p.y)
        .attr("r", style.ballRadius * lift)
        .attr("fill", style.ballColor)
        .attr("stroke", "#000000")
        .attr("stroke-opacity", 0.35)
        .attr("stroke-width", 0.1);
    } else {
      ball.attr("display", "none");
    }

    renderShapes(current);
  }

  function show(next: number): void {
    const clamped = Math.max(0, Math.min(frames.length - 1, Math.floor(next)));
    if (clamped === index) return;
    index = clamped;
    render();
    const current = frames[index];
    if (!current) return;
    options.onFrame?.(index, current);
    for (const listener of listeners) listener(index, current);
  }

  function stop(): void {
    if (rafId !== null) cancelAnimationFrame(rafId);
    rafId = null;
    lastTime = null;
  }

  function tick(now: number): void {
    if (lastTime !== null) position += ((now - lastTime) * fps * speed) / 1000;
    lastTime = now;

    if (position >= frames.length - 1) {
      if (loop && frames.length > 1) {
        position %= frames.length - 1;
      } else {
        // Stop first so `onFrame` for the last frame already sees `isPlaying() === false`.
        position = frames.length - 1;
        stop();
        show(position);
        return;
      }
    }

    show(position);
    rafId = requestAnimationFrame(tick);
  }

  show(0);

  return {
    setFrame(next: number): void {
      position = Math.max(0, Math.min(frames.length - 1, Math.floor(next)));
      show(position);
    },
    frame(): number {
      return Math.max(index, 0);
    },
    play(): void {
      if (rafId !== null || frames.length < 2) return;
      if (index >= frames.length - 1) position = 0;
      rafId = requestAnimationFrame(tick);
    },
    pause(): void {
      stop();
    },
    isPlaying(): boolean {
      return rafId !== null;
    },
    setSpeed(next: number): void {
      speed = next;
    },
    setData(data: TrackingFrame[]): void {
      frames = data;
      position = 0;
      index = -1;
      show(0);
    },
    setStyle(next: Partial<TrackingStyle>): void {
      style = { ...style, ...next };
      render();
    },
    setShapes(next: TrackingShapes): void {
      shapes = {
        defense: { ...shapes.defense, ...next.defense },
        offense: { ...shapes.offense, ...next.offense },
      };
      renderShapes(frames[index]);
    },
    current(): TrackingFrame | undefined {
      return frames[index];
    },
    overlay(): SVGGElement {
      // Appended above and only removed by destroy(), so the node always exists.
      return custom.node() as SVGGElement;
    },
    project,
    addFrameListener(listener: FrameListener): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    orientation,
    destroy(): void {
      stop();
      listeners.clear();
      layers.destroy();
    },
  };
}
