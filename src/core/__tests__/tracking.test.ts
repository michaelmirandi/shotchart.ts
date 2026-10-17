import { afterEach, describe, expect, it, vi } from "vitest";
import { fromBbiTracking } from "../adapters/bbi";
import { trackingToSvg } from "../geometry/project";
import { teamCentroid, teamHull } from "../geometry/team";
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

describe("teamCentroid / teamHull", () => {
  const players = [
    { id: 1, team: "home" as const, x: 0, y: 0 },
    { id: 2, team: "home" as const, x: 4, y: 0 },
    { id: 3, team: "home" as const, x: 4, y: 4 },
    { id: 4, team: "home" as const, x: 0, y: 4 },
    { id: 5, team: "home" as const, x: 2, y: 2 },
    { id: 6, team: "away" as const, x: 30, y: 10 },
  ];

  it("centroid is the mean of the team's positions", () => {
    expect(teamCentroid(players, "home")).toEqual({ x: 2, y: 2 });
    expect(teamCentroid(players, "away")).toEqual({ x: 30, y: 10 });
    expect(teamCentroid([], "home")).toBeNull();
  });

  it("hull wraps the outer players and skips interior ones", () => {
    const hull = teamHull(players, "home");
    expect(hull).toHaveLength(4);
    expect(hull).not.toContainEqual({ x: 2, y: 2 });
    expect(teamHull(players, "away")).toEqual([]);
  });
});

describe("createTracking team shapes", () => {
  const withOffense = (frames: TrackingFrame[]) =>
    frames.map((f) => ({ ...f, offense: "away" as const }));
  const count = (svg: SVGSVGElement, selector: string) => svg.querySelectorAll(selector).length;

  it("draws nothing by default", () => {
    const svg = makeSvg();
    createTracking(svg, { data: withOffense(makeFrames(2)) });
    expect(count(svg, ".tracking-shapes > *, .tracking-centroids > *")).toBe(0);
  });

  it("draws the defense hull, spokes and centroid in the defense color", () => {
    const svg = makeSvg();
    createTracking(svg, {
      data: withOffense(makeFrames(2)),
      shapes: { defense: { centroid: true, hull: true, spokes: true } },
    });
    // Away has the ball, so home (players 0–4) defends.
    expect(count(svg, "path.tracking-hull--defense")).toBe(1);
    expect(count(svg, "line.tracking-spoke--defense")).toBe(5);
    expect(count(svg, "g.tracking-centroid--defense")).toBe(1);
    expect(count(svg, ".tracking-hull--offense, .tracking-centroid--offense")).toBe(0);

    const marker = svg.querySelector("g.tracking-centroid--defense");
    expect(marker?.getAttribute("data-team")).toBe("home");
    expect(marker?.querySelector(".tracking-centroid-ring")?.getAttribute("stroke")).toBe(
      "#2563eb",
    );

    // Mean of players 0–4 at frame 0: x = -40 + 16 = -24, y = -20 + 8 = -12.
    const settings = createShotchartSettings(ncaamSettings, "half");
    const expected = trackingToSvg({ x: -24, y: -12 }, settings);
    const [tx, ty] = translateOf(marker);
    expect(tx).toBeCloseTo(expected.x);
    expect(ty).toBeCloseTo(expected.y);
  });

  it("falls back to the offense option, and draws nothing when offense is unknown", () => {
    const shapes = { offense: { centroid: true } };
    const known = makeSvg();
    createTracking(known, { data: makeFrames(1), offense: "home", shapes });
    expect(known.querySelector("g.tracking-centroid--offense")?.getAttribute("data-team")).toBe(
      "home",
    );

    const unknown = makeSvg();
    createTracking(unknown, { data: makeFrames(1), shapes });
    expect(count(unknown, "g.tracking-centroid")).toBe(0);
  });

  it("setShapes toggles shapes without rebuilding player nodes", () => {
    const svg = makeSvg();
    const chart = createTracking(svg, { data: withOffense(makeFrames(2)) });
    const node = svg.querySelector('g.tracking-player[data-id="0"]');

    chart.setShapes({ defense: { hull: true }, offense: { centroid: true } });
    expect(count(svg, "path.tracking-hull--defense")).toBe(1);
    expect(count(svg, "g.tracking-centroid--offense")).toBe(1);

    chart.setShapes({ defense: { centroid: true } });
    expect(count(svg, "path.tracking-hull--defense")).toBe(1);
    expect(count(svg, "g.tracking-centroid--defense")).toBe(1);

    chart.setShapes({ defense: { hull: false, centroid: false }, offense: { centroid: false } });
    expect(count(svg, ".tracking-shapes > *, .tracking-centroids > *")).toBe(0);
    expect(svg.querySelector('g.tracking-player[data-id="0"]')).toBe(node);
  });
});

describe("createTracking overlay hooks", () => {
  it("overlay() survives setData and is removed by destroy", () => {
    const svg = makeSvg();
    const chart = createTracking(svg, { data: makeFrames(2) });
    const layer = chart.overlay();
    layer.appendChild(document.createElementNS("http://www.w3.org/2000/svg", "circle"));

    chart.setData(makeFrames(3));
    chart.setShapes({ defense: { hull: true } });
    expect(chart.overlay()).toBe(layer);
    expect(layer.childNodes).toHaveLength(1);
    expect(layer.classList.contains("tracking-custom")).toBe(true);

    chart.destroy();
    expect(layer.isConnected).toBe(false);
  });

  it("project matches trackingToSvg and orientation is exposed", () => {
    const chart = createTracking(makeSvg(), { courtType: "ncaam", data: makeFrames(1) });
    const settings = createShotchartSettings(ncaamSettings, "half");
    expect(chart.project({ x: -41.75, y: 3 })).toEqual(
      trackingToSvg({ x: -41.75, y: 3 }, settings),
    );
    expect(chart.orientation).toBe("horizontal");
  });

  it("addFrameListener fires on frame changes until unsubscribed", () => {
    const chart = createTracking(makeSvg(), { data: makeFrames(5) });
    const listener = vi.fn();
    const off = chart.addFrameListener(listener);

    chart.setFrame(2);
    expect(listener).toHaveBeenLastCalledWith(2, expect.objectContaining({ frame: 102 }));
    expect(chart.current()?.frame).toBe(102);

    off();
    chart.setFrame(3);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe("fromBbiTracking possessions", () => {
  const ballRows = [0, 1, 2, 3].map((f) => ({ frame_idx: String(f), x: "0", y: "0" }));
  const possessions = [
    { start_frame: "0", end_frame: "2", off_team_id_tracking: "57" },
    { start_frame: "2", end_frame: "3", off_team_id_tracking: "33" },
  ];

  it("maps possessions to a side through the roster", () => {
    const frames = fromBbiTracking([], ballRows, {
      possessions,
      roster: [
        { player_id_tracking: "464", side: "home", team_id_tracking: "33" },
        { player_id_tracking: "140", side: "away", team_id_tracking: "57" },
      ],
    });
    expect(frames.map((f) => f.offense)).toEqual(["away", "away", "home", undefined]);
  });

  it("homeTeamId overrides the roster", () => {
    const frames = fromBbiTracking([], ballRows, { possessions, homeTeamId: 57 });
    expect(frames.map((f) => f.offense)).toEqual(["home", "home", "away", undefined]);
  });
});
