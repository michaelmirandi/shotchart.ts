import { mountFullcourt } from "./fullcourt";
import { trackingToSvg } from "./geometry/project";
import type {
  TrackingFrame,
  TrackingInstance,
  TrackingOptions,
  TrackingPlayer,
  TrackingStyle,
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
};

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

  // Fractional frame position while playing; the displayed index is its floor.
  let position = 0;
  let index = -1;
  let rafId: number | null = null;
  let lastTime: number | null = null;

  // The overlay sits inside the chart's rotate(-90) on a horizontal court, so
  // labels need the opposite turn to read upright.
  const labelRotation = orientation === "horizontal" ? "rotate(90)" : null;

  const layer = layers.overlay.append("g").attr("class", "shot-chart-tracking");
  const playersLayer = layer.append("g").attr("class", "tracking-players");
  const ball = layer.append("circle").attr("class", "tracking-ball");

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
  }

  function show(next: number): void {
    const clamped = Math.max(0, Math.min(frames.length - 1, Math.floor(next)));
    if (clamped === index) return;
    index = clamped;
    render();
    const current = frames[index];
    if (current) options.onFrame?.(index, current);
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
    destroy(): void {
      stop();
      layers.destroy();
    },
  };
}
