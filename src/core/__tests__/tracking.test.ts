import { afterEach, describe, expect, it, vi } from "vitest";
import { fromBbiTracking } from "../adapters/bbi";
import { trackingToSvg } from "../geometry/project";
import { createShotchartSettings } from "../settings/chart";
import { ncaamSettings } from "../settings/ncaam";
import { createTracking } from "../tracking";
import type { TrackingFrame } from "../types";
import { PRESETS, makeSvg } from "./helpers";

function makeFrames(count: number): TrackingFrame[] {
  return Array.from({ length: count }, (_, i) => ({
    frame: 100 + i,
    gameClock: 1200 - i / 25,
    players: Array.from({ length: 10 }, (_, p) => ({
      id: p,
      team: p < 5 ? ("home" as const) : ("away" as const),
      x: -40 + p * 8 + i,
      y: -20 + p * 4,
      label: String(p + 1),
    })),
    ball: { x: i, y: 0, z: 4 },
  }));
}

// Local (vertical) frame → horizontal screen: (x, y) → (y, courtWidth - x).
function toScreen(p: { x: number; y: number }, courtWidth: number) {
  return { x: p.y, y: courtWidth - p.x };
}

function translateOf(el: Element | null | undefined): [number, number] {
  const m = el?.getAttribute("transform")?.match(/translate\(([-\d.e]+), ([-\d.e]+)\)/);
  if (!m) throw new Error("no translate");
  return [Number(m[1]), Number(m[2])];
}

afterEach(() => {
  vi.useRealTimers();
});

describe("trackingToSvg", () => {
  const settings = createShotchartSettings(ncaamSettings, "half");

  it.each(PRESETS)("$leagueId: center court maps to the middle of the court", (league) => {
    const s = createShotchartSettings(league, "half");
    expect(trackingToSvg({ x: 0, y: 0 }, s)).toEqual({
      x: league.courtWidth / 2,
      y: league.courtLength / 2,
    });
  });

  it("horizontal court: left basket at 5.25 ft, +x right, +y up", () => {
    const basket = toScreen(trackingToSvg({ x: -41.75, y: 0 }, settings), 50);
    expect(basket.x).toBeCloseTo(5.25);
    expect(basket.y).toBeCloseTo(25);

    const upRight = toScreen(trackingToSvg({ x: 10, y: 10 }, settings), 50);
    expect(upRight.x).toBeCloseTo(57);
    expect(upRight.y).toBeCloseTo(15);
  });
});

describe("createTracking", () => {
  it("draws a full court with 10 players and the ball", () => {
    const svg = makeSvg();
    createTracking(svg, { courtType: "ncaam", data: makeFrames(3) });
    expect(svg.querySelectorAll(".shot-chart-court--near, .shot-chart-court--far")).toHaveLength(2);
    expect(svg.querySelectorAll("g.tracking-player")).toHaveLength(10);
    expect(svg.querySelectorAll("g.tracking-player--home")).toHaveLength(5);
    expect(svg.querySelector("circle.tracking-ball")?.getAttribute("display")).toBeNull();
  });

  it("setFrame moves the same DOM nodes and fires onFrame", () => {
    const svg = makeSvg();
    const onFrame = vi.fn();
    const chart = createTracking(svg, { data: makeFrames(5), onFrame });
    expect(onFrame).toHaveBeenLastCalledWith(0, expect.objectContaining({ frame: 100 }));

    const node = svg.querySelector('g.tracking-player[data-id="0"]');
    const [, before] = translateOf(node);
    chart.setFrame(3);
    expect(chart.frame()).toBe(3);
    expect(onFrame).toHaveBeenLastCalledWith(3, expect.objectContaining({ frame: 103 }));
    expect(svg.querySelector('g.tracking-player[data-id="0"]')).toBe(node);
    expect(translateOf(node)[1]).toBeCloseTo(before + 3);

    chart.setFrame(99);
    expect(chart.frame()).toBe(4);
  });

  it("counter-rotates labels only on a horizontal court", () => {
    const horizontal = makeSvg();
    createTracking(horizontal, { data: makeFrames(1) });
    const label = horizontal.querySelector("g.tracking-player text");
    expect(label?.getAttribute("transform")).toBe("rotate(90)");
    expect(label?.textContent).toBe("1");
    // Beats the stylesheet's `.shotchart text { fill: black !important }`.
    expect((label as SVGTextElement).style.getPropertyPriority("fill")).toBe("important");

    const vertical = makeSvg();
    createTracking(vertical, { data: makeFrames(1), orientation: "vertical" });
    expect(vertical.querySelector("g.tracking-player text")?.getAttribute("transform")).toBeNull();
  });

  it("hides the ball and players when a frame has none", () => {
    const svg = makeSvg();
    createTracking(svg, { data: [{ frame: 0, players: [], ball: null }] });
    expect(svg.querySelectorAll("g.tracking-player")).toHaveLength(0);
    expect(svg.querySelector("circle.tracking-ball")?.getAttribute("display")).toBe("none");
  });

  it("setData resets to the first frame; setStyle recolors", () => {
    const svg = makeSvg();
    const chart = createTracking(svg, { data: makeFrames(5) });
    chart.setFrame(4);
    chart.setData(makeFrames(2));
    expect(chart.frame()).toBe(0);

    chart.setStyle({ homeColor: "#000000", labels: false });
    const home = svg.querySelector("g.tracking-player--home");
    expect(home?.querySelector("circle")?.getAttribute("fill")).toBe("#000000");
    expect(home?.querySelector("text")?.textContent).toBe("");
  });

  it("plays at fps × speed and stops at the end", () => {
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame", "performance"] });
    const svg = makeSvg();
    const chart = createTracking(svg, { data: makeFrames(30), fps: 25, speed: 2 });

    chart.play();
    expect(chart.isPlaying()).toBe(true);
    vi.advanceTimersByTime(200);
    // ~200 ms × 50 frames/s ≈ 10 frames (minus the first tick, which only sets the clock).
    expect(chart.frame()).toBeGreaterThanOrEqual(8);
    expect(chart.frame()).toBeLessThanOrEqual(10);

    chart.pause();
    const paused = chart.frame();
    vi.advanceTimersByTime(200);
    expect(chart.isPlaying()).toBe(false);
    expect(chart.frame()).toBe(paused);

    const playingAtLastFrame: boolean[] = [];
    chart.destroy();
    const ending = createTracking(makeSvg(), {
      data: makeFrames(30),
      onFrame: (i) => {
        if (i === 29) playingAtLastFrame.push(ending.isPlaying());
      },
    });
    ending.play();
    vi.advanceTimersByTime(2000);
    expect(ending.frame()).toBe(29);
    expect(ending.isPlaying()).toBe(false);
    expect(playingAtLastFrame).toEqual([false]);
  });

  it("destroy stops playback and removes everything it mounted", () => {
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame", "performance"] });
    const svg = makeSvg();
    const chart = createTracking(svg, { data: makeFrames(30), loop: true });
    chart.play();
    chart.destroy();
    expect(chart.isPlaying()).toBe(false);
    expect(svg.childNodes).toHaveLength(0);
  });
});

describe("fromBbiTracking", () => {
  const ballRows = [
    { frame_idx: "2", x: "1.5", y: "-2", z: "9.5", game_clock: "1197.92", shot_clock: "29.9" },
    { frame_idx: "1", x: "1", y: "-2", z: "", game_clock: "1198.0", shot_clock: "" },
  ];
  const playerRows = [
    {
      frame_idx: "1",
      player_id_tracking: "140",
      team_side: "away",
      jersey: "1",
      x: "3.1",
      y: "8.9",
    },
    { frame_idx: "1", player_id_tracking: "464", team_side: "home", x: "-3", y: "2" },
    { frame_idx: "9", player_id_tracking: "140", team_side: "away", x: "0", y: "0" },
  ];

  it("drives frames from the ball rows, sorted, with numbers coerced", () => {
    const frames = fromBbiTracking(playerRows, ballRows, {
      roster: [{ player_id_tracking: "464", jersey: "6" }],
    });
    expect(frames.map((f) => f.frame)).toEqual([1, 2]);

    const [first, second] = frames;
    expect(first?.gameClock).toBe(1198);
    expect(first?.shotClock).toBeNull();
    expect(first?.ball).toEqual({ x: 1, y: -2, z: 0 });
    expect(first?.players).toEqual([
      { id: "140", team: "away", x: 3.1, y: 8.9, label: "1" },
      { id: "464", team: "home", x: -3, y: 2, label: "6" },
    ]);

    // Ball-only frame (a dead-ball gap in the player feed).
    expect(second?.players).toEqual([]);
    expect(second?.shotClock).toBeCloseTo(29.9);
    expect(second?.ball?.z).toBeCloseTo(9.5);
  });

  it("falls back to player rows when there are no ball rows", () => {
    const frames = fromBbiTracking(playerRows);
    expect(frames.map((f) => f.frame)).toEqual([1, 9]);
    expect(frames[0]?.ball).toBeNull();
    expect(frames[1]?.players).toHaveLength(1);
  });
});
