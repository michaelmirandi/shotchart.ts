import { shotToSvg } from "./geometry/project";
import { mountHalfcourt } from "./halfcourt";
import { courtBounds } from "./mount";
import type { Shot, ShotScatterInstance, ShotScatterOptions, ShotScatterStyle } from "./types";

const DEFAULT_STYLE: ShotScatterStyle = {
  radius: 0.6,
  madeColor: "#22c55e",
  missedColor: "#ef4444",
  missedMarker: "ring",
  opacity: 0.85,
  strokeWidth: 0.15,
};

/**
 * Mount a court with one mark per shot. Makes are filled dots; misses are
 * hollow rings or X's. Marks live in the overlay layer (outside the court
 * group) so plain `fill` / `stroke` attributes apply without fighting the
 * stylesheet.
 */
export function createShotScatter<T extends Shot = Shot>(
  svg: SVGSVGElement,
  options: ShotScatterOptions<T>,
): ShotScatterInstance<T> {
  const { settings, layers } = mountHalfcourt(svg, options);

  let currentData: T[] = options.data;
  let style: ShotScatterStyle = { ...DEFAULT_STYLE, ...options.style };

  if (options.clip ?? true) {
    const clipId = `${layers.id}-court-clip`;
    const bounds = courtBounds(settings);
    layers.defs
      .append("clipPath")
      .attr("id", clipId)
      .append("rect")
      .attr("x", bounds.x)
      .attr("y", bounds.y)
      .attr("width", bounds.width)
      .attr("height", bounds.height);
    layers.overlay.attr("clip-path", `url(#${clipId})`);
  }

  const layer = layers.overlay.append("g").attr("class", "shot-chart-shots");

  function render(): void {
    const marks = layer
      .selectAll<SVGGElement, T>("g.shot")
      .data(currentData)
      .join("g")
      .attr("class", (d) => `shot ${d.made ? "shot--made" : "shot--missed"}`)
      .attr("data-made", (d) => String(d.made))
      .attr("transform", (d) => {
        const p = shotToSvg(d, settings);
        return `translate(${p.x}, ${p.y})`;
      })
      .attr("opacity", style.opacity);

    // Marker shape can change with `setStyle`, so rebuild the (single) child.
    marks.selectAll("*").remove();

    marks
      .filter((d) => d.made)
      .append("circle")
      .attr("r", style.radius)
      .attr("fill", style.madeColor);

    const missed = marks.filter((d) => !d.made);
    if (style.missedMarker === "ring") {
      missed
        .append("circle")
        .attr("r", style.radius)
        .attr("fill", "none")
        .attr("stroke", style.missedColor)
        .attr("stroke-width", style.strokeWidth);
    } else {
      const r = style.radius;
      missed
        .append("path")
        .attr("d", `M${-r},${-r}L${r},${r}M${r},${-r}L${-r},${r}`)
        .attr("fill", "none")
        .attr("stroke", style.missedColor)
        .attr("stroke-width", style.strokeWidth)
        .attr("stroke-linecap", "round");
    }
  }

  render();

  return {
    setData(data: T[]): void {
      currentData = data;
      render();
    },
    setStyle(next: Partial<ShotScatterStyle>): void {
      style = { ...style, ...next };
      render();
    },
    destroy(): void {
      layers.destroy();
    },
  };
}
