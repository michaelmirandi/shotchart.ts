import { describe, expect, it } from "vitest";
import { createHalfcourt } from "../halfcourt";
import { createShotchartSettings } from "../settings/chart";
import { createShotScatter } from "../shot-scatter";
import type { Shot } from "../types";
import { createZonedShotchart } from "../zoned-shotchart";
import { PRESETS, makeSvg } from "./helpers";

describe("createHalfcourt", () => {
  it.each(PRESETS)("$leagueId: arc extent draws sidelines but no division line", (league) => {
    const svg = makeSvg();
    createHalfcourt(svg, { courtType: league.leagueId });
    expect(svg.querySelectorAll(".shot-chart-court-sideline")).toHaveLength(2);
    expect(svg.querySelector(".shot-chart-court-division-line")).toBeNull();
    expect(svg.querySelector(".shot-chart-court-center-circle")).toBeNull();
    // The crop is framed on all four sides.
    expect(svg.querySelectorAll(".shot-chart-court-top-edge")).toHaveLength(1);
    expect(svg.querySelectorAll(".shot-chart-court-hoop")).toHaveLength(1);
  });

  it.each(PRESETS)("$leagueId: half extent adds the division line + center circle", (league) => {
    const svg = makeSvg();
    createHalfcourt(svg, { courtType: league.leagueId, extent: "half" });
    expect(svg.getAttribute("viewBox")).toBe(
      `-0.1 -0.1 ${league.courtWidth + 0.2} ${league.courtLength / 2 + 0.2}`,
    );
    expect(svg.querySelectorAll(".shot-chart-court-division-line")).toHaveLength(1);
    expect(svg.querySelectorAll(".shot-chart-court-center-circle")).toHaveLength(1);
    expect(svg.querySelector(".shot-chart-court-top-edge")).toBeNull();
  });

  it("mounts the layered structure and destroys it", () => {
    const svg = makeSvg();
    const court = createHalfcourt(svg);
    const wrapper = svg.querySelector("g.shotchart");
    expect(wrapper).not.toBeNull();
    const kids = Array.from(wrapper?.children ?? []).map((el) => {
      const cls = el.getAttribute("class");
      return cls ? `${el.tagName}.${cls}` : el.tagName;
    });
    expect(kids).toEqual([
      "defs",
      "g.shot-chart-floor",
      "g.shot-chart-court",
      "g.shot-chart-overlay",
    ]);
    court.destroy();
    expect(svg.childNodes).toHaveLength(0);
  });
});

describe("createZonedShotchart", () => {
  it.each(PRESETS)("$leagueId: 14 zone polygons + 28 labels", (league) => {
    const svg = makeSvg();
    const chart = createZonedShotchart(svg, {
      courtType: league.leagueId,
      data: [{ bucket: "RIM", fgm: 10, fga: 20, percentile: 50 }],
    });
    expect(svg.querySelectorAll("polygon.shotzone")).toHaveLength(14);
    expect(svg.querySelectorAll(".shot-chart-court text")).toHaveLength(28);

    const rimLabel = svg.querySelector('text[data-zone="rim"]');
    expect(rimLabel?.textContent).toBe("10/20");

    // Both floater zones reach the baseline at center court, so no sliver is
    // left unfilled beneath the rim ring.
    const settings = createShotchartSettings(league);
    const baselineCenter = `${league.courtWidth / 2},${settings.visibleCourtLength()}`;
    for (const key of ["rf", "lf"]) {
      expect(svg.querySelector(`polygon[data-zone="${key}"]`)?.getAttribute("points")).toContain(
        baselineCenter,
      );
    }

    chart.setData([]);
    expect(svg.querySelector('text[data-zone="rim"]')?.textContent).toBe("0/0");
    chart.destroy();
    expect(svg.childNodes).toHaveLength(0);
  });
});

describe("createShotScatter", () => {
  const shots: Shot[] = [
    { x: 0, y: 1, made: true },
    { x: -22, y: 2, made: false },
    { x: 5, y: 18, made: false },
  ];

  it("draws one mark per shot with made / missed classes", () => {
    const svg = makeSvg();
    const chart = createShotScatter(svg, { data: shots });
    expect(svg.querySelectorAll("g.shot")).toHaveLength(3);
    expect(svg.querySelectorAll("g.shot--made")).toHaveLength(1);
    expect(svg.querySelectorAll("g.shot--missed circle")).toHaveLength(2);

    chart.setStyle({ missedMarker: "x" });
    expect(svg.querySelectorAll("g.shot--missed path")).toHaveLength(2);
    expect(svg.querySelectorAll("g.shot--missed circle")).toHaveLength(0);

    chart.setData(shots.slice(0, 1));
    expect(svg.querySelectorAll("g.shot")).toHaveLength(1);
  });

  it("clips the overlay to the court by default and not when disabled", () => {
    const clipped = makeSvg();
    createShotScatter(clipped, { data: shots });
    expect(clipped.querySelector("clipPath")).not.toBeNull();
    expect(clipped.querySelector(".shot-chart-overlay")?.getAttribute("clip-path")).toMatch(
      /^url\(#shotchart-\d+-court-clip\)$/,
    );

    const open = makeSvg();
    createShotScatter(open, { data: shots, clip: false });
    expect(open.querySelector("clipPath")).toBeNull();
  });

  it("keeps extra shot fields through setData (generic)", () => {
    const svg = makeSvg();
    const typed = shots.map((s, i) => ({ ...s, player: `p${i}` }));
    const chart = createShotScatter(svg, { data: typed });
    chart.setData(typed.slice(1));
    expect(svg.querySelectorAll("g.shot")).toHaveLength(2);
  });
});
