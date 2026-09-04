import { fibaSettings } from "../settings/fiba";
import { nbaSettings } from "../settings/nba";
import { ncaamSettings } from "../settings/ncaam";
import { ncaawSettings } from "../settings/ncaaw";
import { nfhsSettings } from "../settings/nfhs";
import { wnbaSettings } from "../settings/wnba";
import type { LeagueSettings } from "../types";

export const PRESETS: LeagueSettings[] = [
  nbaSettings,
  wnbaSettings,
  ncaamSettings,
  ncaawSettings,
  fibaSettings,
  nfhsSettings,
];

export function makeSvg(): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  document.body.appendChild(svg);
  return svg;
}
