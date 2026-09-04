import fs from "fs";
import path from "path";

export type RasterMeta = {
  exists: boolean;
  path: string;
  sizeKB: number | null;
  mtime: string | null;
  source: string;
};

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
    const full = path.join(process.cwd(), cfg.rel);
    try {
      const st = fs.statSync(full);
      out[key] = { exists: true, path: cfg.rel, sizeKB: Math.round(st.size / 102.4) / 10, mtime: st.mtime.toISOString(), source: cfg.source };
    } catch {
      out[key] = { exists: false, path: cfg.rel, sizeKB: null, mtime: null, source: cfg.source };
    }
  }
  return out;
}

export function getDemAvailability() {
  const meta = getRasterMeta();
  const dem = meta.dem;
  const postgisEnv = !!process.env.DATABASE_URL;
  return {
    demFilePresent: dem.exists,
    demSource: dem.exists ? dem.source : "Procedural fallback (Chennai topography model)",
    rasters: meta,
    postgisConfigured: postgisEnv,
    note: dem.exists
      ? "DEM file present on disk; API serves sampled model until GeoTIFF decoder is wired (see raster.ts)."
      : "DEM.tif not found — serving high-fidelity procedural Chennai terrain until raster is provided.",
  };
}
