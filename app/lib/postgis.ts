import fs from "fs";
import path from "path";

export async function tryPostGISQuery(sql: string, params: any[]): Promise<any[] | null> {
  if (!process.env.DATABASE_URL) return null;
  try {
    // @ts-ignore - pg is optional peer, fallback to file if missing
    const pg: any = await (Function('return import("pg")')() as Promise<any>).catch(() => null);
    if (!pg) return null;
    const { Pool } = pg;
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2, idleTimeoutMillis: 3000, connectionTimeoutMillis: 2000 });
    const client = await pool.connect();
    try {
      const res = await client.query(sql, params);
      return res.rows;
    } finally {
      client.release();
      await pool.end().catch(() => {});
    }
  } catch (e) {
    console.warn("PostGIS unavailable, fallback to file", (e as Error).message?.slice(0, 80));
    return null;
  }
}

export function fileFallbackQuery(aoi: any, file: string, limit = 500): { count: number; features: any[] } {
  try {
    const full = path.join(process.cwd(), "public", `${file}.geojson`);
    if (!fs.existsSync(full)) return { count: 0, features: [] };
    const j = JSON.parse(fs.readFileSync(full, "utf-8"));
    const feats = j.features || [];
    const filtered = feats.filter((f: any) => {
      const g = f.geometry; if (!g) return false;
      const coords = g.coordinates; const t = g.type;
      if (t === "Point") return coords[0] >= aoi.bounds.xmin && coords[0] <= aoi.bounds.xmax && coords[1] >= aoi.bounds.ymin && coords[1] <= aoi.bounds.ymax;
      if (t === "LineString" || t === "MultiLineString") {
        const cs = t === "LineString" ? coords : coords.flat(1);
        return cs.some((c: any) => Array.isArray(c) && c[0] >= aoi.bounds.xmin && c[0] <= aoi.bounds.xmax && c[1] >= aoi.bounds.ymin && c[1] <= aoi.bounds.ymax);
      }
      if (t === "Polygon" || t === "MultiPolygon") {
        const rings = t === "Polygon" ? [coords[0]] : coords.map((p: any) => p[0]);
        return rings.some((r: any) => r.some((c: any) => c[0] >= aoi.bounds.xmin && c[0] <= aoi.bounds.xmax && c[1] >= aoi.bounds.ymin && c[1] <= aoi.bounds.ymax));
      }
      return false;
    });
    return { count: filtered.length, features: filtered.slice(0, limit) };
  } catch { return { count: 0, features: [] }; }
}
