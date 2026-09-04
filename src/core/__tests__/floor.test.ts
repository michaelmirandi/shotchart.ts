import { describe, expect, it } from "vitest";
import { resolveFloor } from "../floor";
import { createHalfcourt } from "../halfcourt";
import { makeSvg } from "./helpers";

describe("resolveFloor", () => {
  it("defaults to no floor", () => {
    expect(resolveFloor(undefined)).toBeNull();
    expect(resolveFloor("none")).toBeNull();
    expect(resolveFloor({ type: "none" })).toBeNull();
  });

  it("preset shorthand and object forms agree", () => {
    expect(resolveFloor("walnut")).toEqual(resolveFloor({ preset: "walnut" }));
    expect(resolveFloor("wood")).toEqual(resolveFloor({ preset: "maple" }));
  });

  it("derives coherent tones from a custom base color", () => {
    const floor = resolveFloor({ color: "#808080" });
    expect(floor?.base).toBe("#808080");
    expect(floor?.tones).toHaveLength(4);
    expect(new Set(floor?.tones).size).toBe(4);
    expect(floor?.seam).toBe("#3a3a3a");
    expect(floor?.keyColor).toBe("#727272");
  });
});

describe("drawFloor via createHalfcourt", () => {
  it("no floor → empty defs, no floor rects, no on-floor modifier", () => {
    const svg = makeSvg();
    createHalfcourt(svg, { courtType: "nba" });
    expect(svg.querySelector("defs")?.childNodes).toHaveLength(0);
    expect(svg.querySelectorAll(".shot-chart-floor > *")).toHaveLength(0);
    expect(svg.querySelector(".shot-chart-court--on-floor")).toBeNull();
  });

  it("wood floor → base + plank rects, pattern + grain filter, painted key", () => {
    const svg = makeSvg();
    createHalfcourt(svg, { courtType: "nba", floor: "maple" });

    const pattern = svg.querySelector("pattern");
    const filter = svg.querySelector("filter");
    expect(pattern).not.toBeNull();
    expect(filter).not.toBeNull();
    expect(pattern?.getAttribute("patternTransform")).toBe("rotate(90)");

    const planks = svg.querySelector("rect.shot-chart-floor-planks");
    expect(planks?.getAttribute("fill")).toBe(`url(#${pattern?.id})`);
    expect(planks?.getAttribute("filter")).toBe(`url(#${filter?.id})`);
    expect(svg.querySelector("rect.shot-chart-floor-base")).not.toBeNull();

    expect(svg.querySelector(".shot-chart-court--on-floor")).not.toBeNull();
    expect(svg.querySelector("rect.shot-chart-court-key")?.getAttribute("style")).toContain("fill");
  });

  it("solid floor → base rect only", () => {
    const svg = makeSvg();
    createHalfcourt(svg, { floor: { type: "solid", color: "#123456" } });
    expect(svg.querySelector("rect.shot-chart-floor-base")?.getAttribute("fill")).toBe("#123456");
    expect(svg.querySelector("rect.shot-chart-floor-planks")).toBeNull();
    expect(svg.querySelector("pattern")).toBeNull();
  });

  it("two floored charts on one page never share defs ids", () => {
    const a = makeSvg();
    const b = makeSvg();
    createHalfcourt(a, { floor: "maple" });
    createHalfcourt(b, { floor: "walnut" });

    const ids = [a, b].flatMap((svg) =>
      Array.from(svg.querySelectorAll("pattern, filter")).map((el) => el.id),
    );
    expect(ids).toHaveLength(4);
    expect(new Set(ids).size).toBe(4);
    // Each chart references its own defs, never the other's.
    for (const svg of [a, b]) {
      const fill = svg.querySelector("rect.shot-chart-floor-planks")?.getAttribute("fill");
      expect(svg.querySelector(`pattern#${fill?.slice(5, -1)}`)).not.toBeNull();
    }
  });
});
