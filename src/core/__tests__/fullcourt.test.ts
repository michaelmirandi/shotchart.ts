import { describe, expect, it } from "vitest";
import { createFullcourt } from "../fullcourt";
import { nbaSettings } from "../settings/nba";
import { nfhsSettings } from "../settings/nfhs";
import { PRESETS, makeSvg } from "./helpers";

describe("createFullcourt", () => {
  it.each(PRESETS)("$leagueId: horizontal viewBox is courtLength × courtWidth", (league) => {
    const svg = makeSvg();
    createFullcourt(svg, { courtType: league.leagueId });
    expect(svg.getAttribute("viewBox")).toBe(
      `-0.1 -0.1 ${league.courtLength + 0.2} ${league.courtWidth + 0.2}`,
    );
    expect(svg.querySelector("g.shotchart")?.getAttribute("transform")).toContain("rotate(-90)");
  });

  it.each(PRESETS)("$leagueId: vertical viewBox is courtWidth × courtLength", (league) => {
    const svg = makeSvg();
    createFullcourt(svg, { courtType: league.leagueId, orientation: "vertical" });
    expect(svg.getAttribute("viewBox")).toBe(
      `-0.1 -0.1 ${league.courtWidth + 0.2} ${league.courtLength + 0.2}`,
    );
    expect(svg.querySelector("g.shotchart")?.getAttribute("transform")).toBeNull();
  });

  it("composes two full halves: 2 baselines, 4 sidelines, 2 division halves, 2 hoops", () => {
    const svg = makeSvg();
    createFullcourt(svg, { courtType: "nba" });
    expect(svg.querySelectorAll(".shot-chart-court--near, .shot-chart-court--far")).toHaveLength(2);
    expect(svg.querySelectorAll(".shot-chart-court-baseline")).toHaveLength(2);
    expect(svg.querySelectorAll(".shot-chart-court-sideline")).toHaveLength(4);
    expect(svg.querySelectorAll(".shot-chart-court-division-line")).toHaveLength(2);
    expect(svg.querySelectorAll(".shot-chart-court-center-circle")).toHaveLength(2);
    expect(svg.querySelectorAll(".shot-chart-court-hoop")).toHaveLength(2);
    expect(svg.querySelectorAll(".shot-chart-court-restricted-area")).toHaveLength(2);
  });

  it("the far half is the near half spun about center court", () => {
    const svg = makeSvg();
    createFullcourt(svg, { courtType: "nba", orientation: "vertical" });
    const half = nbaSettings.courtLength / 2;
    expect(svg.querySelector(".shot-chart-court--near")?.getAttribute("transform")).toBe(
      `translate(0, ${half})`,
    );
    expect(svg.querySelector(".shot-chart-court--far")?.getAttribute("transform")).toBe(
      `rotate(180, ${nbaSettings.courtWidth / 2}, ${half}) translate(0, ${half})`,
    );
  });

  it("NFHS has no restricted-area arcs on either end", () => {
    const svg = makeSvg();
    createFullcourt(svg, { courtType: nfhsSettings.leagueId });
    expect(svg.querySelectorAll(".shot-chart-court-restricted-area")).toHaveLength(0);
    expect(svg.querySelectorAll(".shot-chart-court-key-block")).toHaveLength(4);
  });

  it("destroy removes everything it mounted", () => {
    const svg = makeSvg();
    const court = createFullcourt(svg, { floor: "maple" });
    expect(svg.childNodes.length).toBeGreaterThan(0);
    court.destroy();
    expect(svg.childNodes).toHaveLength(0);
  });
});
