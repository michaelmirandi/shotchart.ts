import { describe, expect, it } from "vitest";
import { shotToSvg, svgToShot } from "../geometry/project";
import { createShotchartSettings } from "../settings/chart";
import { nbaSettings } from "../settings/nba";
import { PRESETS } from "./helpers";

describe("createShotchartSettings", () => {
  it("NBA arc extent: 38' visible, basket 5.25' off the baseline", () => {
    const s = createShotchartSettings(nbaSettings);
    expect(s.extent).toBe("arc");
    expect(s.visibleCourtLength()).toBeCloseTo(38);
    expect(s.visibleCourtLength() - s.basketCenterY).toBeCloseTo(5.25);
  });

  it.each(PRESETS)("$leagueId half extent spans the whole half court", (league) => {
    const s = createShotchartSettings(league, "half");
    expect(s.extent).toBe("half");
    expect(s.visibleCourtLength()).toBeCloseTo(league.courtLength / 2);
    expect(s.visibleCourtLength() - s.basketCenterY).toBeCloseTo(
      league.basketProtrusionLength + 1.25,
    );
  });
});

describe("shotToSvg / svgToShot", () => {
  it.each(PRESETS)("$leagueId: a shot at the basket lands on the hoop", (league) => {
    const s = createShotchartSettings(league);
    expect(shotToSvg({ x: 0, y: 0 }, s)).toEqual({ x: league.courtWidth / 2, y: s.basketCenterY });
  });

  it("+y goes toward halfcourt (up the SVG), +x goes right", () => {
    const s = createShotchartSettings(nbaSettings);
    const p = shotToSvg({ x: 10, y: 20 }, s);
    expect(p.x).toBeCloseTo(35);
    expect(p.y).toBeCloseTo(s.basketCenterY - 20);
  });

  it.each(PRESETS)("$leagueId: round-trips", (league) => {
    const s = createShotchartSettings(league, "half");
    for (const shot of [
      { x: -22.5, y: 1 },
      { x: 3.2, y: 27.9 },
      { x: 0, y: -4 },
    ]) {
      const back = svgToShot(shotToSvg(shot, s), s);
      expect(back.x).toBeCloseTo(shot.x);
      expect(back.y).toBeCloseTo(shot.y);
    }
  });
});
