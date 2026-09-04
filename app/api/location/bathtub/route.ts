export const runtime = 'nodejs';
import { NextRequest, NextResponse } from "next/server";
import { sampleDemGrid, getDemAvailability } from "@/app/lib/raster";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { aoi, floodLevel, includeSeaDepth = false, palette = "classic" } = body as { aoi: any; floodLevel: number; includeSeaDepth?: boolean; palette?: string };
    if (!aoi || !aoi.bounds) return NextResponse.json({ error: "Invalid AOI" }, { status: 400 });
    if (typeof floodLevel !== "number" || !isFinite(floodLevel)) return NextResponse.json({ error: "floodLevel number required (-10..18)" }, { status: 400 });
    if (floodLevel < -10 || floodLevel > 18) return NextResponse.json({ error: "floodLevel out of range -10..18" }, { status: 400 });
    const gridW = 48, gridH = 48;
    const dem = await sampleDemGrid(aoi.bounds, gridW, gridH);
    const source = dem?.source || getDemAvailability().demSource;
    const elevations = dem?.elevations || [];
    let flooded = 0, total = elevations.length || gridW * gridH, maxDepth = 0, sumDepth = 0;
    const cells: { lng: number; lat: number; elev: number; depth: number }[] = [];
    for (let i = 0; i < total; i++) {
      const elev = elevations[i] ?? 6;
      if (!includeSeaDepth && elev < 0) continue;
      if (elev < floodLevel) {
        const depth = floodLevel - elev;
        flooded++; maxDepth = Math.max(maxDepth, depth); sumDepth += depth;
        if (cells.length < 600) {
          const row = Math.floor(i / gridW), col = i % gridW;
          const lng = aoi.bounds.xmin + (col / (gridW - 1)) * (aoi.bounds.xmax - aoi.bounds.xmin);
          const lat = aoi.bounds.ymin + (row / (gridH - 1)) * (aoi.bounds.ymax - aoi.bounds.ymin);
          cells.push({ lng, lat, elev, depth });
        }
      }
    }
    const pct = total ? (flooded / total) * 100 : 0;
    return NextResponse.json({
      status: "success",
      floodLevel, includeSeaDepth, palette,
      source, grid: `${gridW}x${gridH}`,
      statistics: { flooded, total, pct: +pct.toFixed(1), maxDepth: +maxDepth.toFixed(2), meanDepth: +(flooded ? sumDepth / flooded : 0).toFixed(2) },
      cells,
      provenance: getDemAvailability(),
      disclaimer: "FloodMap.net parity — bathtub model: below threshold = flooded. Not hydrologic (no runoff/diversion/land type). Use SCS-CN for physics.",
    });
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 500 }); }
}
