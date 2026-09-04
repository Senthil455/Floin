export const runtime = 'nodejs';
import { NextRequest, NextResponse } from "next/server";
import { getDemAvailability, sampleDemGrid } from "@/app/lib/raster";

interface AOI { bounds: { xmin: number; xmax: number; ymin: number; ymax: number }; center?: [number, number]; id?: string; }

function chennaiTopography(lng: number, lat: number): number {
  let elev = 6.5; const dCoast = Math.max(0, 80.34 - lng) * 111;
  elev -= Math.max(0, (3 - dCoast)) * 0.35;
  const dAdyar = Math.hypot((lng - 80.2645) * 111 * Math.cos((lat * Math.PI) / 180), (lat - 13.0102) * 111); elev -= Math.exp(-(dAdyar * dAdyar) / 8) * 2.2;
  const dCooum = Math.hypot((lng - 80.275) * 111 * Math.cos((lat * Math.PI) / 180), (lat - 13.07) * 111); elev -= Math.exp(-(dCooum * dCooum) / 6) * 1.6;
  const dMarsh = Math.hypot((lng - 80.22) * 111 * Math.cos((lat * Math.PI) / 180), (lat - 12.985) * 111); elev -= Math.exp(-(dMarsh * dMarsh) / 4.5) * 3.0;
  const dKosa = Math.hypot((lng - 80.31) * 111 * Math.cos((lat * Math.PI) / 180), (lat - 13.21) * 111); elev += Math.exp(-(dKosa * dKosa) / 12) * 1.2;
  const dChem = Math.hypot((lng - 80.06) * 111 * Math.cos((lat * Math.PI) / 180), (lat - 13.015) * 111); elev += Math.exp(-(dChem * dChem) / 10) * 4.5;
  elev += Math.sin(lng * 18.2) * 0.22 + Math.cos(lat * 22.5) * 0.18; elev += Math.sin(lng * 42 + lat * 31) * 0.08;
  return Math.max(0.6, Math.min(18, elev));
}

async function extractDEMForAOI(aoi: AOI) {
  const resolution = 30; const degPerCell = resolution / 111000;
  const wDeg = aoi.bounds.xmax - aoi.bounds.xmin; const hDeg = aoi.bounds.ymax - aoi.bounds.ymin;
  const gridWidth = Math.max(12, Math.min(120, Math.round(wDeg / degPerCell)));
  const gridHeight = Math.max(12, Math.min(120, Math.round(hDeg / degPerCell)));
  const dem = await sampleDemGrid(aoi.bounds, gridWidth, gridHeight);
  let elevations: number[], source: string;
  if (dem) { elevations = dem.elevations; source = dem.source; }
  else { elevations = []; for (let r = 0; r < gridHeight; r++) for (let c = 0; c < gridWidth; c++) { const lng = aoi.bounds.xmin + (c / gridWidth) * wDeg; const lat = aoi.bounds.ymin + (r / gridHeight) * hDeg; elevations.push(chennaiTopography(lng, lat)); } source = getDemAvailability().demSource + " (procedural fallback)"; }
  let minElev = Infinity, maxElev = -Infinity; for (const v of elevations) { minElev = Math.min(minElev, v); maxElev = Math.max(maxElev, v); }
  const avail = getDemAvailability();
  return { gridWidth, gridHeight, elevations, minElevation: minElev, maxElevation: maxElev, resolution, source, bounds: aoi.bounds, cellSize: resolution, provenance: avail };
}

export async function GET() { return NextResponse.json({ status: "success", ...getDemAvailability(), timestamp: new Date().toISOString() }); }

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json(); const { aoi, requestId } = body as { aoi: AOI; requestId?: string };
    if (!aoi || !aoi.bounds) return NextResponse.json({ error: "Invalid AOI" }, { status: 400 });
    if (aoi.bounds.xmin >= aoi.bounds.xmax || aoi.bounds.ymin >= aoi.bounds.ymax) return NextResponse.json({ error: "Invalid bounds" }, { status: 400 });
    const terrainData = await extractDEMForAOI(aoi);
    const mean = terrainData.elevations.reduce((a, b) => a + b, 0) / terrainData.elevations.length;
    return NextResponse.json({ requestId: requestId || `dem-${Date.now()}`, aoi, timestamp: new Date().toISOString(), terrain: terrainData, statistics: { minElevation: terrainData.minElevation.toFixed(2), maxElevation: terrainData.maxElevation.toFixed(2), range: (terrainData.maxElevation - terrainData.minElevation).toFixed(2), meanElevation: mean.toFixed(2), resolution: `${terrainData.resolution}m`, gridPoints: `${terrainData.gridWidth}x${terrainData.gridHeight}`, source: terrainData.source } });
  } catch (error) { console.error("Terrain extraction error:", error); return NextResponse.json({ error: error instanceof Error ? error.message : "Terrain extraction failed" }, { status: 500 }); }
}
