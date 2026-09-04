import fs from "fs";
import path from "path";

export type RasterMeta = { exists: boolean; path: string; sizeKB: number | null; mtime: string | null; source: string; };
const RASTER_CANDIDATES: Record<string, { rel: string; source: string }> = {
  dem: { rel: "data/rasters/rasters_COP30/DEM.tif", source: "Copernicus DEM 30m (COP30)" },
  flow_direction: { rel: "data/rasters/Flow_Direction.tif", source: "D8 Flow Direction (QGIS)" },
  flow_accumulation: { rel: "data/rasters/Flow_Accumulation.tif", source: "Flow Accumulation" },
  watershed: { rel: "data/rasters/Watershed.tif", source: "Watershed Delineation" },
  streams: { rel: "data/rasters/Streams.tif", source: "Stream Network" },
};
export function getRasterMeta(): Record<string, RasterMeta> {
  const out: Record<string, RasterMeta> = {};
  for (const [key, cfg] of Object.entries(RASTER_CANDIDATES)) {
    const full = path.join(/*turbopackIgnore: true*/ process.cwd(), cfg.rel);
    try { const st = fs.statSync(full); out[key] = { exists: true, path: cfg.rel, sizeKB: Math.round(st.size / 102.4) / 10, mtime: st.mtime.toISOString(), source: cfg.source }; }
    catch { out[key] = { exists: false, path: cfg.rel, sizeKB: null, mtime: null, source: cfg.source }; }
  }
  return out;
}
export function getDemAvailability() {
  const meta = getRasterMeta(); const dem = meta.dem; const postgisEnv = !!process.env.DATABASE_URL;
  return { demFilePresent: dem.exists, demSource: dem.exists ? dem.source : "Procedural fallback (Chennai topography model)", rasters: meta, postgisConfigured: postgisEnv, note: dem.exists ? "DEM decoded via geotiff + bilinear, cached Float32" : "DEM.tif not found — procedural Chennai fallback" };
}

type DemCache = { width: number; height: number; bbox: [number, number, number, number]; data: Float32Array; loadedAt: string };
let demCache: DemCache | null = null;

export async function loadDem(): Promise<DemCache | null> {
  if (demCache) return demCache;
  const full = path.join(/*turbopackIgnore: true*/ process.cwd(), "data/rasters/rasters_COP30/DEM.tif");
  if (!fs.existsSync(full)) return null;
  try {
    const geotiff: any = await import("geotiff");
    let tiff: any;
    try { tiff = await geotiff.fromFile(full); } catch { const buf = fs.readFileSync(full); const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength); tiff = await geotiff.fromArrayBuffer(ab as ArrayBuffer); }
    const image = await tiff.getImage();
    const bbox = image.getBoundingBox() as [number, number, number, number];
    const width = image.getWidth(), height = image.getHeight();
    const rasters: any = await image.readRasters({ interleave: true });
    const arr = rasters instanceof Float32Array ? rasters : new Float32Array(rasters as any);
    demCache = { width, height, bbox, data: arr, loadedAt: new Date().toISOString() };
    return demCache;
  } catch (e) { console.warn("DEM geotiff load failed, fallback procedural", (e as Error).message?.slice(0,120)); return null; }
}

export async function sampleDemBilinear(lng: number, lat: number): Promise<number | null> {
  const dem = await loadDem(); if (!dem) return null;
  const [minX, minY, maxX, maxY] = dem.bbox;
  if (lng < minX || lng > maxX || lat < minY || lat > maxY) return null;
  const fx = ((lng - minX) / (maxX - minX)) * (dem.width - 1);
  const fy = ((maxY - lat) / (maxY - minY)) * (dem.height - 1);
  const x0 = Math.floor(fx), y0 = Math.floor(fy), x1 = Math.min(x0 + 1, dem.width - 1), y1 = Math.min(y0 + 1, dem.height - 1);
  const tx = fx - x0, ty = fy - y0;
  const i00 = y0 * dem.width + x0, i10 = y0 * dem.width + x1, i01 = y1 * dem.width + x0, i11 = y1 * dem.width + x1;
  const v00 = dem.data[i00], v10 = dem.data[i10], v01 = dem.data[i01], v11 = dem.data[i11];
  if ([v00, v10, v01, v11].some((v) => v == null || isNaN(v))) return null;
  const top = v00 * (1 - tx) + v10 * tx;
  const bot = v01 * (1 - tx) + v11 * tx;
  return top * (1 - ty) + bot * ty;
}

export async function sampleDemGrid(aoi: { xmin: number; ymin: number; xmax: number; ymax: number }, gridW: number, gridH: number): Promise<{ elevations: number[]; source: string } | null> {
  const dem = await loadDem(); if (!dem) return null;
  const elevations: number[] = [];
  let hits = 0;
  for (let r = 0; r < gridH; r++) for (let c = 0; c < gridW; c++) {
    const lng = aoi.xmin + (c / Math.max(1, gridW - 1)) * (aoi.xmax - aoi.xmin);
    const lat = aoi.ymin + (r / Math.max(1, gridH - 1)) * (aoi.ymax - aoi.ymin);
    const v = await sampleDemBilinear(lng, lat);
    if (v != null && isFinite(v) && v > -9999) { elevations.push(v); hits++; } else elevations.push(8 + Math.sin(lng * 10) * 0.5);
  }
  if (hits / elevations.length < 0.1) return null;
  return { elevations, source: `COP30 DEM 30m bilinear (${dem.width}×${dem.height})` };
}
