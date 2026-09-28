"""
FLOIN — Data Quality Audit
==========================
Deep audit of every vector/raster asset under data/ and public/.

Classifies each GeoJSON as:
  REAL_DETAILED  -> many vertices, irregular geometry, real-world provenance
  SYNTHETIC_BOX  -> polygon is an axis-aligned 4/5-vertex rectangle (stub)
  STUB_LINE      -> polyline with too few vertices to be a real network
  POINT_ONLY     -> point placeholder with no areal detail

Outputs:
  data/processed/AUDIT.json   machine-readable
  docs/DATA_AUDIT.md          human-readable ledger

Run:  python scripts/audit_data.py
"""
import json, pathlib, datetime, collections

ROOT = pathlib.Path(__file__).resolve().parent.parent
VEC = ROOT / "data" / "vectors"
PUB = ROOT / "public"
RAST = ROOT / "data" / "rasters"
OUT_JSON = ROOT / "data" / "processed" / "AUDIT.json"
OUT_MD = ROOT / "docs" / "DATA_AUDIT.md"
CHENNAI_BOUNDS = (80.10, 12.88, 80.35, 13.25)

# Real observed / official ground-truth products (curated allow-list)
OBSERVED = {
    "chennai2015_inundation", "chennai2015_stagnation", "chennai2015_hotspots",
    "chennai2015_flooded_streets", "chennai2015_crowd", "buildings",
    "natural_water", "waterway", "highway", "chennai_wards_200",
    # UNOSAT satellite-derived flood/preflood water (Dec 2015 event)
    "fl20151123ind_shp_s1_20151112_flood", "fl20151123ind_shp_s1_20151124_flood",
    "fl20151123ind_shp_s1_20150901_preflood", "fl20151123ind_shp_ls8_20151014_preflood",
    # GCC official layers collected from OpenCity
    "chennai_flood_hazard_zones_map_7f29da20", "chennai_flows_5_year_return_period_ef3286de",
    "chennai_flows_10_years_return_period_1bfef958", "chennai_flows_25_year_return_period_a6b4f2b1",
    "chennai_flows_50_years_return_period_a6b20b7c", "chennai_flows_100_years_return_period_994a99a1",
    "chennai_flows_200_years_return_period_61f1f06f", "chennai_storm_water_drains_swd_map_2023_c4907fed",
    "chennai_waterbodies_map_2019_8d557090", "chennai_water_census_map_2023_7e357cf5",
    "chennai_slum_boundaries_map_5959f0f4", "chennai_gcc_flood_extent_2005_c49407c8",
    "chennai_gcc_flood_hostspots_2020_3a141c21", "chennai_inundation_points_with_depth_of_inundation_814ca028",
    "chennai_basin_rivers_and_streams_map_9434de03", "chennai_basin_macro_drains_map_80b07b87",
    "chennai_basin_micro_drains_map_4d6437e5", "chennai_basin_buckingham_canal_map_1bb30ede",
    "chennai_rivers_map_c6393f3d", "sewerage_command_area_b186696c",
}


def count_vertices(coords):
    if isinstance(coords, dict):
        if coords.get("type") == "GeometryCollection":
            return sum(count_vertices(g.get("coordinates") or []) for g in coords.get("geometries") or [])
        return count_vertices(coords.get("coordinates") or [])
    if isinstance(coords, (list, tuple)):
        if coords and isinstance(coords[0], (int, float)):
            return 1
        return sum(count_vertices(c) for c in coords)
    return 0


def bbox(coords, acc):
    if isinstance(coords, dict):
        if coords.get("type") == "GeometryCollection":
            for g in coords.get("geometries") or []:
                bbox(g, acc)
            return acc
        coords = coords.get("coordinates") or []
    if isinstance(coords, (list, tuple)):
        if coords and isinstance(coords[0], (int, float)):
            acc[0] = min(acc[0], coords[0]); acc[1] = max(acc[1], coords[0])
            acc[2] = min(acc[2], coords[1]); acc[3] = max(acc[3], coords[1])
        else:
            for c in coords:
                bbox(c, acc)
    return acc


def classify(geom, nv):
    """Detect stubs: axis-aligned rectangles (ring of 4-5 pts, one axis constant)."""
    t = geom.get("type")
    c = geom.get("coordinates")
    if t == "Polygon":
        ring = c[0] if c else []
        xs = {round(p[0], 6) for p in ring}
        ys = {round(p[1], 6) for p in ring}
        if len(ring) <= 5 and (len(xs) <= 2 or len(ys) <= 2):
            return "SYNTHETIC_BOX"
        return "REAL_DETAILED"
    if t in ("MultiPolygon", "MultiLineString", "MultiPoint"):
        return "REAL_DETAILED" if nv >= 25 else "STUB_LINE"
    if t == "GeometryCollection":
        kids = [g.get("type") for g in geom.get("geometries") or []]
        if kids and all(k == "Polygon" for k in kids):
            return classify(geom["geometries"][0], nv)
        if nv >= 25:
            return "REAL_DETAILED"
        return "STUB_LINE"
    if t == "Point":
        return "POINT"
    if t in ("LineString",):
        return "REAL_DETAILED" if nv >= 25 else "STUB_LINE"
    return "UNKNOWN"



def audit_geojson(p):
    try:
        j = json.loads(p.read_text(encoding="utf-8"))
    except Exception as e:
        return {"error": str(e)[:120]}
    feats = j.get("features") or []
    if isinstance(feats, dict):
        feats = feats.get("features") or []
    kinds = collections.Counter()
    total_v = 0
    acc = [1e9, -1e9, 1e9, -1e9]
    prop_keys = set()
    for f in feats:
        if not isinstance(f, dict):
            continue
        g = f.get("geometry") or {}
        if not g.get("type"):
            continue
        nv = count_vertices(g)
        total_v += nv
        bbox(g, acc)
        kinds[classify(g, nv)] += 1
        prop_keys |= set((f.get("properties") or {}).keys())
    return {
        "features": len(feats),
        "vertices": total_v,
        "geom_types": dict(collections.Counter(
            (f.get("geometry") or {}).get("type") for f in feats if isinstance(f, dict))),
        "classification": dict(kinds),
        "bbox": None if acc[1] < acc[0] else [round(v, 5) for v in acc],
        "attributes": sorted(prop_keys)[:26],
        "attribute_count": len(prop_keys),
        "name": j.get("name"),
    }


def build_rows():
    rows = []
    for p in sorted(VEC.glob("*.geojson")):
        a = audit_geojson(p)
        c = a.get("classification", {})
        det, box = c.get("REAL_DETAILED", 0), c.get("SYNTHETIC_BOX", 0)
        if det and box:
            verdict = "MIXED"
        elif det:
            verdict = "REAL_DETAILED"
        elif box:
            verdict = "SYNTHETIC_BOX"
        elif c.get("POINT"):
            verdict = "POINT_ONLY"
        elif c.get("STUB_LINE"):
            verdict = "STUB_LINE"
        else:
            verdict = "EMPTY"
        base = p.stem
        rows.append({
            "file": p.name, "id": base, "kb": round(p.stat().st_size / 1024, 1),
            "in_public": (PUB / p.name).exists(), "verdict": verdict,
            "features": a.get("features"), "vertices": a.get("vertices"),
            "geom_types": a.get("geom_types"), "bbox": a.get("bbox"),
            "attribute_count": a.get("attribute_count"), "attributes": a.get("attributes"),
            "declared_name": a.get("name"),
            "observed_ground_truth": base in OBSERVED, "error": a.get("error"),
        })
    return rows


MEANING = {
    "REAL_DETAILED": "irregular real geometry (many vertices)",
    "MIXED": "some real + some rectangle stubs",
    "SYNTHETIC_BOX": "axis-aligned rectangle placeholder",
    "STUB_LINE": "line with <25 vertices (schematic)",
    "POINT_ONLY": "point placeholder, no areal detail",
    "EMPTY": "no usable geometry",
}


def write_report(rows, rasters, summary):
    lines = [
        "# DATA AUDIT — What is real, what is stub",
        "",
        f"Generated `{summary['generated'][:19]}` by `python scripts/audit_data.py`.",
        "",
        "## Verdict counts",
        "",
        "| Verdict | Meaning | Files |",
        "|---|---|---|",
    ]
    cnt = collections.Counter(x["verdict"] for x in rows)
    for k, v in cnt.most_common():
        lines.append(f"| `{k}` | {MEANING.get(k, '-')} | {v} |")
    lines += [
        "",
        f"**Real/usable:** `{summary['geojson_real_any']}/{summary['geojson_total']}` - "
        f"**Stub/placeholder:** `{summary['geojson_stub']}` - "
        f"**Real observed vertices:** `{summary['total_vertices_real']:,}`",
        "",
        "## High-value datasets (>40 KB = genuine payload)",
        "",
        "| File | KB | Features | Vertices | Geometry | Observed GT |",
        "|---|---|---|---|---|---|",
    ]
    for x in sorted([z for z in rows if (z["kb"] or 0) > 40], key=lambda z: -(z["kb"] or 0)):
        g = ",".join(f"{k}:{v}" for k, v in (x["geom_types"] or {}).items())
        lines.append(f"| `{x['file']}` | {x['kb']} | {x['features']} | {x['vertices']} | {g} | "
                     f"{'yes' if x['observed_ground_truth'] else ''} |")
    lines += ["", "## Rasters", "", "| File | KB |", "|---|---|"]
    for x in rasters:
        lines.append(f"| `{x['file']}` | {x['kb']} |")
    lines += ["", "## Stub inventory (safe to replace with real downloads)", "",
              "| File | KB | Features | Declared name |", "|---|---|---|---|"]
    for x in sorted([z for z in rows if z["verdict"] in
                     ("SYNTHETIC_BOX", "STUB_LINE", "POINT_ONLY", "EMPTY")],
                    key=lambda z: z["file"]):
        lines.append(f"| `{x['file']}` | {x['kb']} | {x['features']} | {x['declared_name'] or '-'} |")
    OUT_MD.parent.mkdir(parents=True, exist_ok=True)
    OUT_MD.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main():
    rows = build_rows()
    rasters = [{"file": str(p.relative_to(ROOT)), "kb": round(p.stat().st_size / 1024, 1)}
               for p in sorted(RAST.rglob("*.tif"))]
    raw = ROOT / "data" / "raw"
    raw_tifs = [{"file": str(p.relative_to(ROOT)), "kb": round(p.stat().st_size / 1024, 1)}
                for p in sorted(raw.rglob("*.tif"))] if raw.exists() else []
    for r in raw_tifs:
        if r not in rasters:
            rasters.append(r)
    summary = {
        "generated": datetime.datetime.now().isoformat(),
        "geojson_total": len(rows),
        "geojson_real_any": len([x for x in rows if x["verdict"] in ("REAL_DETAILED", "MIXED")]),
        "geojson_stub": len([x for x in rows if x["verdict"] in
                             ("SYNTHETIC_BOX", "STUB_LINE", "POINT_ONLY", "EMPTY")]),
        "public_total": len(list(PUB.glob("*.geojson"))),
        "total_vertices_real": sum(x["vertices"] or 0 for x in rows
                                   if x["verdict"] in ("REAL_DETAILED", "MIXED")),
        "bounds": CHENNAI_BOUNDS,
        "rasters": rasters,
    }
    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(json.dumps({"summary": summary, "datasets": rows}, indent=1), encoding="utf-8")
    write_report(rows, rasters, summary)
    print(f"[audit] {summary['geojson_total']} geojson | real {summary['geojson_real_any']} | "
          f"stub {summary['geojson_stub']} | real vertices {summary['total_vertices_real']:,}")
    print(f"[audit] -> {OUT_JSON.relative_to(ROOT)}")
    print(f"[audit] -> {OUT_MD.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
