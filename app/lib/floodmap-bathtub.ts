// Ported bathtub flood-fill core from FloodMap.net clones
// Primary reference: https://netaction.github.io/floodmap/ + https://github.com/kkmcgg/floodmap
// Original FloodMap.net is proprietary; this is the open community clone logic (MIT) adapted to FLOIN's COP30/ETOPO stack.
// Algorithm: for each DEM cell, flooded = elevation < waterLevel (+ bathymetry if includeSeaDepth); depth = waterLevel - elevation; color by palette.
// FloodMap.net UI parity: Water Level (-/+) meter Set, Include Sea Depth, Rainbow/Classic palette, click-to-set at elevation, map style switch.

export type BathtubOpts = { includeSeaDepth: boolean; palette: "classic" | "rainbow" };
export function isFlooded(elev: number, waterLevel: number, opts: BathtubOpts): boolean {
  if (!isFinite(elev) || !isFinite(waterLevel)) return false;
  if (!opts.includeSeaDepth && elev < 0) return false;
  return elev < waterLevel;
}
export function floodDepth(elev: number, waterLevel: number): number {
  return Math.max(0, waterLevel - elev);
}
export function floodColor(depth: number, palette: "classic" | "rainbow", opacityBase = 0.42): { color: string; opacity: number } {
  const opacity = opacityBase + Math.min(0.32, depth * 0.05);
  if (palette === "classic") return { color: "#0E7490", opacity };
  const hue = 220 - Math.min(1, depth / 6) * 200;
  return { color: `hsl(${hue},85%,50%)`, opacity };
}
export function waterLevelToSceneY(levelM: number): number {
  return levelM * 0.11 - 0.85 + 0.02;
}
