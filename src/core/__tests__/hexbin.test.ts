import { describe, expect, it } from "vitest";
import { binShots, createHexbinShotchart } from "../hexbin-shotchart";
import { createShotchartSettings } from "../settings/chart";
import { nbaSettings } from "../settings/nba";
import type { Shot } from "../types";
import { makeSvg } from "./helpers";

function spread(count: number): Shot[] {
  // Deterministic fan of shots across the front court.
  const shots: Shot[] = [];
  for (let i = 0; i < count; i += 1) {
    const angle = -1.2 + (2.4 * i) / count;
    const r = 2 + (i % 11) * 2.3;
    shots.push({ x: r * Math.sin(angle), y: r * Math.cos(angle), made: i % 3 === 0 });
  }
  return shots;
}

describe("binShots", () => {
  const settings = createShotchartSettings(nbaSettings);

  it("attempts across all cells sum to the shot count", () => {
    const shots = spread(120);
    const bins = binShots(shots, settings, 1.5);
    expect(bins.reduce((sum, b) => sum + b.fga, 0)).toBe(120);
    expect(bins.reduce((sum, b) => sum + b.fgm, 0)).toBe(shots.filter((s) => s.made).length);
  });

  it("computes fgm / fga per cell", () => {
    const shots: Shot[] = [
      { x: 0, y: 0, made: true },
      { x: 0.1, y: 0, made: true },
      { x: 0, y: 0.1, made: false },
    ];
    const bins = binShots(shots, settings, 1.5);
    expect(bins).toHaveLength(1);
    expect(bins[0]).toMatchObject({ fga: 3, fgm: 2 });
    expect(bins[0].fgPct).toBeCloseTo(2 / 3);
    expect(bins[0].x).toBeCloseTo(settings.courtWidth / 2, 0);
  });

  it("a larger radius produces fewer cells", () => {
    const shots = spread(200);
    expect(binShots(shots, settings, 3).length).toBeLessThan(binShots(shots, settings, 1).length);
  });
});

describe("createHexbinShotchart", () => {
  it("renders one hexagon per visible cell and tears down cleanly", () => {
    const svg = makeSvg();
    const chart = createHexbinShotchart(svg, { data: spread(150), minAttempts: 2 });

    const visible = chart.bins().filter((b) => b.fga >= 2);
    expect(visible.length).toBeGreaterThan(0);
    expect(svg.querySelectorAll("path.hexbin")).toHaveLength(visible.length);
    // One full-radius outline per rendered cell, drawn in the group beneath the fills.
    expect(svg.querySelectorAll("path.hexbin-outline")).toHaveLength(visible.length);
    const groups = Array.from(svg.querySelector(".shot-chart-overlay")?.children ?? []).map((g) =>
      g.getAttribute("class"),
    );
    expect(groups).toEqual(["shot-chart-hexbin-outlines", "shot-chart-hexbins"]);

    chart.setRadius(3);
    expect(svg.querySelectorAll("path.hexbin")).toHaveLength(
      chart.bins().filter((b) => b.fga >= 2).length,
    );
    expect(svg.querySelectorAll("path.hexbin-outline")).toHaveLength(
      chart.bins().filter((b) => b.fga >= 2).length,
    );

    chart.destroy();
    expect(svg.childNodes).toHaveLength(0);
  });

  it("outline: false draws no footprints", () => {
    const svg = makeSvg();
    createHexbinShotchart(svg, { data: spread(60), outline: false });
    expect(svg.querySelectorAll("path.hexbin").length).toBeGreaterThan(0);
    expect(svg.querySelectorAll("path.hexbin-outline")).toHaveLength(0);
  });

  it("hexagons sit in the overlay layer, outside the court group", () => {
    const svg = makeSvg();
    createHexbinShotchart(svg, { data: spread(30) });
    const hex = svg.querySelector("path.hexbin");
    expect(hex?.closest(".shot-chart-overlay")).not.toBeNull();
    expect(hex?.closest(".shot-chart-court")).toBeNull();
  });
});
