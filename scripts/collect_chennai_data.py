"""
FLOIN — Chennai Data Collector
==============================
Resolves a curated catalog of REAL Chennai flood datasets and downloads them
into the project, converting KML -> GeoJSON clipped to the Chennai AOI.

Sources
  1. OpenCity / GCC CKAN API  (data.opencity.in)  — official GCC vector + CSV
  2. Verified direct-download endpoints (AWS open data, CHC/UCSB, ESA, HDX)

Usage
  python scripts/collect_chennai_data.py --list                  # show catalog
  python scripts/collect_chennai_data.py --plan                  # resolve URLs only
  python scripts/collect_chennai_data.py --tier 1                # P0 essentials
  python scripts/collect_chennai_data.py --only chennai_rainfall_daily_1991_2023
  python scripts/collect_chennai_data.py --tier 1 --only a,b,c
  python scripts/collect_chennai_data.py --tier 1 --keep-kml
  python scripts/collect_chennai_data.py --tier 1 --no-download  # convert only

Writes
  data/sources/source-catalog.json     resolved catalog (id -> url -> target)
  data/sources/FETCHED.json            what was downloaded / converted
"""
import argparse, csv, gzip, io, json, os, pathlib, re, shutil, struct, sys, time, zipfile
import urllib.request, urllib.error
import xml.etree.ElementTree as ET

ROOT = pathlib.Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
VEC = ROOT / "data" / "vectors"
SRC = ROOT / "data" / "sources"
# Chennai AOI — identical to scripts/preprocess.py CHENNAI_BOUNDS
AOI = (80.10, 12.88, 80.35, 13.25)
AOI_BUF = 0.02
CKAN = "https://data.opencity.in/api/3/action/package_show?id="
UA = {"User-Agent": "FLOIN-Chennai-Data-Collector/1.0 (+research)"}


def log(m):
    try:
        print(f"[collect] {m}", flush=True)
    except UnicodeEncodeError:
        print(f"[collect] {m}".encode("ascii", "ignore").decode(), flush=True)


# ---------------------------------------------------------------------------
# Tier 1: OpenCity / Greater Chennai Corporation official datasets
# package -> list of resource-name substrings to keep
# ---------------------------------------------------------------------------
OPENCITY = {
    # --- observed flood ground truth (model targets / validation labels) ---
    "chennai-flooding-data": [
        "Inundation Points with Depth", "Flooding Points in 2015",
        "Flows 5 Year", "Flows 10 Years", "Flows 25 Year", "Flows 50 Years",
        "Flows 100 Years", "Flows 200 Years", "Flood Hazard Zones",
    ],
    "chennai-floods-2020-data": ["Flood Hostspots 2020"],
    "chennai-floods-2005-data": ["Flood Extent 2005"],
    # --- drainage network / hydrography (the biggest accuracy lever) ---
    "chennai-stormwater-drain-swd-maps": ["SWD - Map 2023"],
    "chennai-basin-drainage-maps": [
        "Rivers and Streams", "Buckingham Canal", "Macro Drains", "Micro Drains",
    ],
    "chennai-microwatersheds-map": ["Microwatersheds"],
    "chennai-waterbodies": ["Waterbodies Map - 2019", "Rivers Map"],
    "tamil-nadu-water-bodies-census-data": ["Chennai Water Census Map 2023"],
    # --- rainfall time series (event drivers) ---
    "chennai-rainfall-data": [
        "Monthly Rainfall Data 1901-2021", "Daily Rainfall Data from 1991-2023",
    ],
    # --- reservoir / hydraulic state ---
    "chennai-lake-leves-since-2003": [
        "Poondi", "Cholavaram", "Chembarambakkam", "Veeranam", "Red Hills",
    ],
    "chennai-lakes-inflow-and-outflow": ["2023", "2024"],
    "chennai-ward-wise-groundwater-levels": ["2023", "2024"],
    # --- exposure / vulnerability ---
    "chennai-census-2011-data": ["Ward-wise Census Data - 2011"],
    "chennai-slums": ["Slums Map", "Slum Boundaries Map", "Slum Housing"],
    "chennai-healthcare-uphcs-and-uchcs": ["UPHCs Map", "UCHCs Map"],
    "chennai-sewerage-collection-system": ["Sewerage Command Area", "Ventilating Columns"],
    "chennai-parks": ["Neighbourhood Parks Map", "Chennai Parks"],
    # --- hydrology support layers (accuracy round-2: roads, admin, water supply) ---
    "chennai-road-centerline-map": ["Road Centerline"],
    "greater-chennai-corporation-wards-info": ["Ward"],
    "chennai-water-supply": ["Water Supply", "Water bodies", "Waterbody"],
    "chennai-solid-waste-management-data": ["Solid Waste"],
    "chennai-bus-shelters": ["Bus Shelter"],
}


# ---------------------------------------------------------------------------
# Tier 2/3: verified external direct-download + keyless-API sources
# access: direct = plain file GET | api = JSON endpoint | portal = manual/UI
# ---------------------------------------------------------------------------
EXTERNAL = [
    # ===== TERRAIN (P0 — drives every depth number) =====
    dict(id="cop30_dem_n13e080", tier=1, cat="terrain", resolution="30 m",
         url="https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_N13_00_E080_00_DEM/Copernicus_DSM_COG_10_N13_00_E080_00_DEM.tif",
         target="data/raw/dem/COP30_N13E080_30m.tif", fmt="tif",
         publisher="ESA / Airbus (Copernicus DEM GLO-30)", license="Copernicus DEM Free",
         variable="DSM elevation (m)", why="Official COP30 COG tile behind data/rasters/rasters_COP30/DEM.tif"),
    dict(id="cop30_dem_n12e080", tier=1, cat="terrain", resolution="30 m",
         url="https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_N12_00_E080_00_DEM/Copernicus_DSM_COG_10_N12_00_E080_00_DEM.tif",
         target="data/raw/dem/COP30_N12E080_30m.tif", fmt="tif",
         publisher="ESA / Airbus (Copernicus DEM GLO-30)", license="Copernicus DEM Free",
         variable="DSM elevation (m)", why="South half of AOI (Adyar / Velachery / Pallikaranai)"),
    dict(id="srtm1_n13e080", tier=1, cat="terrain", resolution="30 m",
         url="https://s3.amazonaws.com/elevation-tiles-prod/skadi/N13/N13E080.hgt.gz",
         target="data/raw/dem/SRTM1_N13E080.hgt.gz", fmt="hgt.gz",
         publisher="NASA/USGS SRTM 1-arcsec (AWS Terrain Tiles)", license="Public Domain",
         variable="SRTM elevation (m)", why="Independent DEM for vertical-accuracy cross-check"),
    dict(id="terrarium_z14_chennai", tier=2, cat="terrain", resolution="9 m @ z14",
         url="https://s3.amazonaws.com/elevation-tiles-prod/terrarium/14/{x}/{y}.png",
         target="data/raw/dem/terrarium_z14/", fmt="png-tiles",
         publisher="Mapzen / AWS Open Data", license="ODbL",
         variable="RGB-packed elevation", why="Finer 9 m hillshade for 3D twin detail"),
    # ===== RAINFALL (P0 — the forcing term) =====
    dict(id="chirps_daily_2015_11", tier=1, cat="rainfall", resolution="0.05 deg (~5.5 km)",
         url="https://data.chc.ucsb.edu/products/CHIRPS-2.0/global_daily/tifs/p05/2015/chirps-v2.0.2015.11.{d:02d}.tif.gz",
         target="data/raw/rainfall/chirps/", fmt="tif.gz", days=list(range(1, 31)),
         publisher="UCSB CHC CHIRPS v2.0", license="Public Domain",
         variable="daily precipitation (mm)", why="Rain build-up before the Dec-2015 flood peak"),
    dict(id="chirps_daily_2015_12", tier=1, cat="rainfall", resolution="0.05 deg",
         url="https://data.chc.ucsb.edu/products/CHIRPS-2.0/global_daily/tifs/p05/2015/chirps-v2.0.2015.12.{d:02d}.tif.gz",
         target="data/raw/rainfall/chirps/", fmt="tif.gz", days=list(range(1, 32)),
         publisher="UCSB CHC CHIRPS v2.0", license="Public Domain",
         variable="daily precipitation (mm)", why="Dec-2015 event — primary validation storm"),
    dict(id="chirps_daily_2023_12", tier=2, cat="rainfall", resolution="0.05 deg",
         url="https://data.chc.ucsb.edu/products/CHIRPS-2.0/global_daily/tifs/p05/2023/chirps-v2.0.2023.12.{d:02d}.tif.gz",
         target="data/raw/rainfall/chirps/", fmt="tif.gz", days=list(range(1, 32)),
         publisher="UCSB CHC CHIRPS v2.0", license="Public Domain",
         variable="daily precipitation (mm)", why="Cyclone Michaung Dec-2023 event"),
    dict(id="chirps_daily_2020_11", tier=2, cat="rainfall", resolution="0.05 deg",
         url="https://data.chc.ucsb.edu/products/CHIRPS-2.0/global_daily/tifs/p05/2020/chirps-v2.0.2020.11.{d:02d}.tif.gz",
         target="data/raw/rainfall/chirps/", fmt="tif.gz", days=list(range(1, 31)),
         publisher="UCSB CHC CHIRPS v2.0", license="Public Domain",
         variable="daily precipitation (mm)", why="Cyclone Nivar Nov-2020 event (GCC 2020 hotspots validation)"),
    dict(id="chirps_daily_2021_11", tier=2, cat="rainfall", resolution="0.05 deg",
         url="https://data.chc.ucsb.edu/products/CHIRPS-2.0/global_daily/tifs/p05/2021/chirps-v2.0.2021.11.{d:02d}.tif.gz",
         target="data/raw/rainfall/chirps/", fmt="tif.gz", days=list(range(1, 31)),
         publisher="UCSB CHC CHIRPS v2.0", license="Public Domain",
         variable="daily precipitation (mm)", why="Nov-2021 NE-monsoon flood (extra hold-out event)"),
    dict(id="openmeteo_archive_chennai_1940_2025", tier=1, cat="rainfall", resolution="ERA5 ~11 km",
         url="https://archive-api.open-meteo.com/v1/archive?latitude=13.0827&longitude=80.2707&start_date=1940-01-01&end_date=2025-12-31&daily=precipitation_sum,rain_sum,et0_fao_evapotranspiration&timezone=Asia%2FKolkata",
         target="data/vectors/openmeteo_chennai_daily_1940_2025.json", fmt="json-api", access="api",
         publisher="Open-Meteo (ERA5 reanalysis)", license="CC-BY 4.0",
         variable="daily precip / rain / ET0", why="85-yr continuous forcing series, no API key"),
    dict(id="nasa_power_chennai_daily_1981_2025", tier=1, cat="rainfall", resolution="0.5 x 0.625 deg",
         url="https://power.larc.nasa.gov/api/temporal/daily/point?parameters=PRECTOTCORR,T2M,RH2M,WS2M&community=AG&longitude=80.2707&latitude=13.0827&start=19810101&end=20241231&format=JSON",
         target="data/vectors/nasa_power_chennai_daily_1981_2024.json", fmt="json-api", access="api",
         publisher="NASA POWER / MERRA-2", license="Public Domain",
         variable="precip / temp / humidity / wind", why="Independent rainfall + antecedent moisture"),
    dict(id="openmeteo_flood_glofas_adyar", tier=1, cat="discharge", resolution="GloFAS ~5 km",
         url="https://flood-api.open-meteo.com/v1/flood?latitude=13.0827&longitude=80.2707&daily=river_discharge,river_discharge_mean,river_discharge_max&start_date=1984-01-01&end_date=2024-12-31",
         target="data/vectors/openmeteo_glofas_discharge_chennai.json", fmt="json-api", access="api",
         publisher="Open-Meteo / Copernicus GloFAS", license="CC-BY 4.0",
         variable="river discharge (m3/s)", why="Analysed discharge for Adyar-Cooum outflow"),
    # ===== FLOOD OBSERVATION (P0 — the labels) =====
    dict(id="unosat_chennai_flood_2015", tier=2, cat="flood-observation", resolution="vector",
         url="https://unosat-maps.web.cern.ch/unosat-maps/IN/FL20151123IND/FL20151123IND_shp.zip",
         target="data/raw/flood-obs/FL20151123IND_shp.zip", fmt="shp-zip", access="direct",
         publisher="UNITAR-UNOSAT via HDX", license="CC BY-NC-SA 3.0",
         variable="satellite-detected flood-water polygons (Dec 2015)",
         why="Independent satellite extent to audit the GCC 2015 inundation labels"),
    # ===== LAND COVER / IMPERVIOUSNESS (P1 — sets CN) =====
    dict(id="esa_worldcover_2021_10m", tier=2, cat="lulc", resolution="10 m",
         url="https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map/ESA_WorldCover_10m_2021_v200_N12E078_Map.tif",
         target="data/raw/lulc/ESA_WorldCover_10m_2021_v200_N12E078.tif", fmt="tif",
         publisher="ESA WorldCover v200", license="CC-BY 4.0",
         variable="11-class land cover",
         why="Real impervious fraction to derive per-ward CN, replacing synthetic chennai_lulc"),
    dict(id="worldpop_ind_2020_constrained", tier=3, cat="population", resolution="100 m",
         url="https://data.worldpop.org/GIS/Population/Global_2000_2020_Constrained/2020/BSGM/IND/ind_ppp_2020_constrained.tif",
         target="data/raw/population/ind_ppp_2020_constrained.tif", fmt="tif",
         publisher="WorldPop, Univ. of Southampton", license="CC-BY 4.0",
         variable="population count per 100 m cell",
         why="Replaces fixed ward 'pop' constants with real dasymetric exposure (531 MB)"),
]



# ---------------------------------------------------------------------------
# KML -> GeoJSON (stdlib only: KML is XML)
# ---------------------------------------------------------------------------
KNS = "{http://www.opengis.net/kml/2.2}"


def _coords(txt):
    pts = []
    for tok in (txt or "").split():
        p = tok.split(",")
        if len(p) >= 2:
            try:
                pts.append([round(float(p[0]), 6), round(float(p[1]), 6)])
            except ValueError:
                pass
    return pts


def _ring_closed(r):
    if len(r) >= 3 and r[0] != r[-1]:
        r = r + [r[0]]
    return r


def kml_placemark(pm):
    props = {}
    for tag in ("name", "description", "styleUrl"):
        el = pm.find(KNS + tag)
        if el is not None and (el.text or "").strip():
            props[tag.lower()] = el.text.strip()[:250]
    ext = pm.find(KNS + "ExtendedData")
    if ext is not None:
        for d in ext.iter():
            if d.tag.endswith("Data"):
                k = d.get("name") or "field"
                v = d.find(KNS + "value")
                if v is not None and (v.text or "").strip():
                    props[k[:48]] = v.text.strip()[:200]
    pts, lines, polys = [], [], []
    geoms: list = []
    for g in pm.iter():
        if g.tag == KNS + "Point":
            c = g.find(KNS + "coordinates")
            p = _coords(c.text if c is not None else "")
            if p:
                pts.append(p[0])
        elif g.tag in (KNS + "LineString", KNS + "LinearRing"):
            c = g.find(KNS + "coordinates")
            p = _coords(c.text if c is not None else "")
            if len(p) >= 2:
                lines.append(p)
        elif g.tag == KNS + "Polygon":
            outer = g.find(KNS + "outerBoundaryIs/" + KNS + "LinearRing/" + KNS + "coordinates")
            if outer is None:
                outer = g.find(KNS + "outerBoundaryIs")
                outer = outer.find(KNS + "LinearRing/" + KNS + "coordinates") if outer is not None else None
            ring = _coords(outer.text if outer is not None else "")
            if len(ring) >= 3:
                polys.append([_ring_closed(ring)])
    for p in pts:
        geoms.append({"type": "Point", "coordinates": p})
    # GCC "flows" KML stores each hazard polygon twice: once as the Polygon and
    # once as a LineString tracing the same ring. Drop the redundant line, which
    # roughly halves those files (8-12 MB -> 4-6 MB).
    if polys:
        rings = {tuple(map(tuple, _ring_closed(p[0]))) for p in polys}
        lines = [l for l in lines
                 if tuple(map(tuple, _ring_closed(l))) not in rings]
    for l in lines:
        geoms.append({"type": "LineString", "coordinates": l})
    for p in polys:
        geoms.append({"type": "Polygon", "coordinates": p})
    if not geoms:
        return None
    # Prefer a single typed geometry, then a homogeneous Multi*, so the app's
    # countGeoJSON() (Point/LineString/Polygon/Multi*/GeometryCollection aware)
    # can read it. A raw GeometryCollection is the last resort.
    if len(geoms) == 1:
        geom = geoms[0]
    else:
        kinds = {g["type"] for g in geoms}
        if kinds == {"Point"}:
            geom = {"type": "MultiPoint", "coordinates": [g["coordinates"] for g in geoms]}
        elif kinds == {"LineString"}:
            geom = {"type": "MultiLineString", "coordinates": [g["coordinates"] for g in geoms]}
        elif kinds == {"Polygon"}:
            geom = {"type": "MultiPolygon", "coordinates": [g["coordinates"] for g in geoms]}
        else:
            geom = {"type": "GeometryCollection", "geometries": geoms}
    return {"type": "Feature", "properties": props, "geometry": geom}


def _flat_bbox(geom):
    acc = [1e9, -1e9, 1e9, -1e9]
    def walk(c):
        if isinstance(c, list) and c and isinstance(c[0], (int, float)):
            acc[0] = min(acc[0], c[0]); acc[1] = max(acc[1], c[0])
            acc[2] = min(acc[2], c[1]); acc[3] = max(acc[3], c[1])
        elif isinstance(c, list):
            for x in c:
                walk(x)
    if geom.get("type") == "GeometryCollection":
        for g in geom.get("geometries", []):
            walk(g.get("coordinates", []))
    else:
        walk(geom.get("coordinates", []))
    return acc


def kml_to_geojson(src, dst, clip=True):
    tree = ET.parse(str(src))
    root = tree.getroot()
    feats = []
    for pm in root.iter(KNS + "Placemark"):
        f = kml_placemark(pm)
        if not f:
            continue
        if clip:
            b = _flat_bbox(f["geometry"])
            if b[1] < AOI[0] - AOI_BUF or b[0] > AOI[2] + AOI_BUF:
                continue
            if b[3] < AOI[1] - AOI_BUF or b[2] > AOI[3] + AOI_BUF:
                continue
        feats.append(f)
    fc = {"type": "FeatureCollection", "crs": {"type": "name", "properties": {"name": "urn:ogc:def:crs:OGC:1.3:CRS84"}},
          "features": feats}
    dst.parent.mkdir(parents=True, exist_ok=True)
    dst.write_text(json.dumps(fc, separators=(",", ":")), encoding="utf-8")
    return len(feats)


# ---------------------------------------------------------------------------
# Shapefile (inside a zip) -> GeoJSON — stdlib only
# UNOSAT / HDX ship flood polygons as ESRI shapefiles; parse the .shp binary
# directly: outer rings are clockwise (negative signed area), holes CCW.
# ---------------------------------------------------------------------------
def _shp_rings(body):
    """Return (shape_type, rings) for one record body, or None."""
    stype = struct.unpack("<i", body[0:4])[0]
    if stype in (0,):
        return None
    if stype == 1:  # Point
        x, y = struct.unpack("<2d", body[4:20])
        return ("Point", [[[round(x, 6), round(y, 6)]]])
    if stype in (3, 5, 13, 15, 23, 25, 28):  # polyline / polygon families
        num_parts, num_points = struct.unpack("<2i", body[36:44])
        if num_parts <= 0 or num_points <= 0:
            return None
        parts = struct.unpack(f"<{num_parts}i", body[44:44 + 4 * num_parts])
        off = 44 + 4 * num_parts
        raw = struct.unpack(f"<{2 * num_points}d", body[off:off + 16 * num_points])
        pts = [[round(raw[i], 6), round(raw[i + 1], 6)] for i in range(0, len(raw), 2)]
        rings = []
        for i, s in enumerate(parts):
            e = parts[i + 1] if i + 1 < num_parts else num_points
            rings.append(pts[s:e])
        return (stype, rings)
    return None  # multipoint / multipatch: not needed


def _signed_area(ring):
    a = 0.0
    for i in range(len(ring) - 1):
        a += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1]
    return a / 2.0


def _rings_to_geometry(stype, rings):
    if stype == 1:
        return {"type": "Point", "coordinates": rings[0][0]}
    if stype in (3, 13, 23):  # polylines: each part is a line
        if len(rings) == 1:
            return {"type": "LineString", "coordinates": rings[0]}
        return {"type": "MultiLineString", "coordinates": rings}
    # polygons: shell = CW (area<0); a CCW ring holes into the last shell
    polys, cur = [], None
    for r in rings:
        if len(r) < 4:
            continue
        if _signed_area(r) < 0 or cur is None:
            cur = [r]
            polys.append(cur)
        else:
            cur.append(r)
    if not polys:
        return None
    if len(polys) == 1:
        return {"type": "Polygon", "coordinates": polys[0]}
    return {"type": "MultiPolygon", "coordinates": polys}


def shp_zip_to_geojson(src_zip, clip=True):
    """Convert every .shp in a zip into data/vectors/<stem>_<shpstem>.geojson."""
    zf = zipfile.ZipFile(str(src_zip))
    made = []
    for shp_name in sorted(n for n in zf.namelist() if n.lower().endswith(".shp")):
        if re.sub(r"[^A-Za-z0-9]+", "_", pathlib.Path(shp_name).stem).lower().endswith("analysis_extent"):
            continue  # bounding-box of the satellite scene, not flood data
        feats = []
        with zf.open(shp_name) as f:
            data = f.read()
        off, n = 100, len(data)
        while off + 8 <= n:
            try:
                content_words = struct.unpack(">i", data[off + 4:off + 8])[0]
            except struct.error:
                break
            clen = content_words * 2
            if clen <= 0 or off + 8 + clen > n:
                break
            g = _shp_rings(data[off + 8:off + 8 + clen])
            off += 8 + clen
            if not g:
                continue
            geom = _rings_to_geometry(*g)
            if not geom:
                continue
            b = _flat_bbox(geom)
            if clip and (b[1] < AOI[0] - AOI_BUF or b[0] > AOI[2] + AOI_BUF
                         or b[3] < AOI[1] - AOI_BUF or b[2] > AOI[3] + AOI_BUF):
                continue
            feats.append({"type": "Feature", "properties": {"source_shp": shp_name}, "geometry": geom})
        stem = re.sub(r"[^A-Za-z0-9]+", "_", f"{pathlib.Path(src_zip).stem}_{pathlib.Path(shp_name).stem}").strip("_").lower()[:64]
        dst = VEC / (stem + ".geojson")
        fc = {"type": "FeatureCollection",
              "crs": {"type": "name", "properties": {"name": "urn:ogc:def:crs:OGC:1.3:CRS84"}},
              "features": feats}
        dst.write_text(json.dumps(fc, separators=(",", ":")), encoding="utf-8")
        made.append(dst)
    return made



# ---------------------------------------------------------------------------
# Resolution + download
# ---------------------------------------------------------------------------
def fetch_json(url, timeout=90):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8", "replace"))


def resolve_opencity():
    """Resolve the curated GCC package->resource selection into concrete URLs."""
    out = []
    for pkg, keys in OPENCITY.items():
        try:
            data = fetch_json(CKAN + pkg)
        except Exception as e:
            log(f"  ! CKAN {pkg}: {e}")
            continue
        res = (data.get("result") or {}).get("resources") or []
        for r in res:
            nm = (r.get("name") or "")
            if not any(k.lower() in nm.lower() for k in keys):
                continue
            fmt = (r.get("format") or "").lower()
            if fmt not in ("kml", "csv", "geojson", "json", "xlsx", "zip", "shp"):
                continue
            url = r.get("url") or ""
            guid = url.split("/")[-1].rsplit(".", 1)[0][:8] or "00000000"
            slug = re.sub(r"[^a-z0-9]+", "_", nm.lower()).strip("_")[:56]
            fname = f"{slug}__{guid}.{fmt}"
            out.append(dict(
                id=re.sub(r"[^a-z0-9]+", "_", f"{pkg}_{nm}".lower()).strip("_")[:70],
                tier=1, cat=pkg.split("-")[1] if "-" in pkg else "gcc",
                url=url, fmt=fmt, target=f"data/raw/opencity/{pkg}/{fname}",
                publisher="Greater Chennai Corporation via OpenCity", license="Public Domain",
                resolution="vector/CSV", variable=nm,
                why=f"Official GCC layer ({pkg})", size=r.get("size")))
    return out


def download(url, dst, timeout=300, retries=2):
    if dst.is_dir():
        return "err:target-is-directory", 0
    dst.parent.mkdir(parents=True, exist_ok=True)
    if dst.exists() and dst.stat().st_size > 0:
        return "cached", dst.stat().st_size
    for a in range(retries + 1):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=timeout) as r, open(dst, "wb") as f:
                shutil.copyfileobj(r, f, 1 << 20)
            return "ok", dst.stat().st_size
        except Exception as e:
            if a == retries:
                return f"err:{str(e)[:80]}", 0
            time.sleep(2 + 3 * a)
    return "err", 0


def collect_openmeteo_derived(src_json, out_csv):
    """Flatten an Open-Meteo JSON response into a tidy CSV next to it."""
    j = json.loads(pathlib.Path(src_json).read_text(encoding="utf-8"))
    daily = j.get("daily") or {}
    times = daily.get("time") or []
    if not times:
        return 0
    keys = [k for k in daily.keys() if k != "time"]
    with open(out_csv, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["date"] + keys)
        for i, t in enumerate(times):
            w.writerow([t] + [daily[k][i] if i < len(daily[k]) else "" for k in keys])
    return len(times)



# ---------------------------------------------------------------------------
# Catalog + main
# ---------------------------------------------------------------------------
def build_catalog():
    ext = [dict(e) for e in EXTERNAL]
    ocl = resolve_opencity()
    log(f"catalog: {len(ext)} external + {len(ocl)} OpenCity/GCC = {len(ext) + len(ocl)}")
    return ext, ocl


def cmd_list(cat):
    ext, ocl = cat
    for tier in (1, 2, 3):
        rows = [e for e in ext + ocl if e.get("tier") == tier]
        if not rows:
            continue
        log(f"--- tier {tier} ({len(rows)}) ---")
        for e in rows:
            log(f"  {e['id'][:52]:<52} {e.get('fmt', ''):<9} {e.get('cat', ''):<18} {e.get('variable', '')[:44]}")


def cmd_run(cat, args):
    ext, ocl = cat
    pool = ext + ocl
    if args.only:
        want = {x.strip().lower() for x in args.only.split(",")}
        pool = [e for e in pool if e["id"].lower() in want or
                any(w in e["id"].lower() for w in want)]
    elif args.tier:
        pool = [e for e in pool if e.get("tier") in set(args.tier)]
    if not pool:
        log("nothing selected")
        return
    log(f"selected {len(pool)} sources"
        + (" (plan only)" if args.plan else "")
        + (" (no download, convert only)" if args.no_download else ""))
    fetched = []
    for e in pool:
        if e.get("access") == "portal":
            log(f"  SKIP (portal, manual step) {e['id']} -> {e.get('url')}")
            continue
        days = e.get("days")
        targets = [e]
        if days:
            targets = []
            for d in days:
                v = dict(e)
                v["url"] = e["url"].format(d=d)
                v["target"] = e["target"].rstrip("/") + "/" + e["url"].split("/")[-1].format(d=d)
                targets.append(v)
        for v in targets:
            url, out = v["url"], ROOT / v["target"]
            if args.plan:
                log(f"  PLAN {v['id'][:40]:<40} {url[:110]}")
                continue
            if out.exists() and not args.force:
                log(f"  cached {out.relative_to(ROOT)}")
                fetched.append({"id": v["id"], "file": v["target"], "status": "cached",
                                "bytes": out.stat().st_size})
                continue
            if args.no_download:
                continue
            t0 = time.time()
            status, size = download(url, out, timeout=args.timeout)
            dt = round(time.time() - t0, 1)
            if status in ("ok", "cached"):
                log(f"  {status:<6} {round(size / 1024, 1):>9} KB  {dt:>7}s  {out.relative_to(ROOT)}")
            else:
                log(f"  FAIL   {status}  {url[:100]}")
            fetched.append({"id": v["id"], "url": url, "file": v["target"],
                            "status": status, "bytes": size, "seconds": dt})
    if not args.plan:
        produced: list = []
        convert_kml(pool, args, produced)
        convert_shp(pool, args, produced)
        flatten_api(pool)
        if args.promote:
            promote(produced, args.max_public_mb)
        (SRC / "FETCHED.json").write_text(
            json.dumps({"generated": time.strftime("%Y-%m-%dT%H:%M:%S"),
                        "aoi": AOI, "count": len(fetched), "items": fetched}, indent=1),
            encoding="utf-8")
        log(f"-> data/sources/FETCHED.json ({len(fetched)} items)")


def convert_kml(pool, args, produced=None):
    made = []
    for e in pool:
        base = ROOT / e["target"]
        d = base if base.is_dir() else base.parent
        if not d.exists():
            continue
        for k in sorted(d.glob("*.kml")):
            gj = VEC / (re.sub(r"[^A-Za-z0-9]+", "_", k.stem).strip("_").lower()[:64] + ".geojson")
            if gj.exists() and not args.force:
                made.append(gj)
                continue
            try:
                n = kml_to_geojson(k, gj, clip=not args.no_clip)
                log(f"  kml->geojson {n:>6} feats {round(gj.stat().st_size / 1024, 1):>9} KB  {gj.name}")
                made.append(gj)
            except Exception as ex:
                log(f"  kml->geojson FAIL {k.name}: {str(ex)[:70]}")
    if produced is not None:
        produced.extend(made)
    return made


def convert_shp(pool, args, produced=None):
    """Unzip + parse any shp-zip sources into data/vectors/ GeoJSON."""
    made = []
    for e in pool:
        if e.get("fmt") != "shp-zip":
            continue
        z = ROOT / e["target"]
        if not z.exists():
            continue
        for gj in shp_zip_to_geojson(z, clip=not args.no_clip):
            if gj.exists() and gj.stat().st_size > 0:
                log(f"  shp->geojson {round(gj.stat().st_size / 1024, 1):>9} KB  {gj.name}")
                made.append(gj)
    if produced is not None:
        produced.extend(made)
    return made


def flatten_api(pool):
    for e in pool:
        if e.get("fmt") != "json-api":
            continue
        p = ROOT / e["target"]
        if not p.exists():
            continue
        try:
            n = collect_openmeteo_derived(p, p.with_suffix(".csv"))
            if n:
                log(f"  json->csv {n:>7} rows  {p.with_suffix('.csv').name}")
        except Exception as ex:
            log(f"  json->csv FAIL {p.name}: {str(ex)[:70]}")


# Canonical ids the app expects in public/. Everything else is copied as-is
# subject to --max-public-mb, because public/ is served over HTTP.
PROMOTE_ALIAS = {
    "chennai_storm_water_drains_swd_map_2023": "chennai_swd_drains_2023",
    "chennai_microwatersheds_map": "chennai_microwatersheds",
    "chennai_waterbodies_map_2019": "chennai_waterbodies_2019",
    "chennai_water_census_map_2023": "chennai_water_census_2023",
    "chennai_basin_rivers_and_streams_map": "chennai_basin_rivers_streams",
    "chennai_basin_macro_drains_map": "chennai_basin_macro_drains",
    "chennai_basin_micro_drains_map": "chennai_basin_micro_drains",
    "chennai_inundation_points_with_depth_of_inundation": "chennai_inundation_depth_inches",
    "chennai_flooding_points_in_2015": "chennai_flooding_points_2015",
    "chennai_gcc_flood_extentspots_2020": "chennai_gcc_flood_hotspots_2020",
    "chennai_gcc_flood_hostspots_2020": "chennai_gcc_flood_hotspots_2020",
    "chennai_gcc_flood_extent_2005": "chennai_gcc_flood_extent_2005",
    "chennai_slum_boundaries_map": "chennai_slum_boundaries",
    "chennai_uphcs_map": "chennai_uphcs",
    "chennai_uchcs_map": "chennai_uchcs",
    "sewerage_command_area": "chennai_sewerage_command_area",
    "chennai_neighbourhood_parks_map": "chennai_neighbourhood_parks",
}
# Return-period layers keep a stable name so a caller can pick a hazard level.
for _rp in (5, 10, 25, 50, 100, 200):
    PROMOTE_ALIAS[f"chennai_flows_{_rp}_year_return_period"] = f"chennai_flow_{_rp}yr_return"


def promote(produced, max_mb):
    """Copy collected GeoJSON into public/ so the Next.js app can serve it."""
    pub = ROOT / "public"
    pub.mkdir(parents=True, exist_ok=True)
    cap = max_mb * 1024 * 1024
    copied = skipped = 0
    for gj in produced:
        if not gj.exists():
            continue
        stem = gj.stem
        alias = None
        for key, name in PROMOTE_ALIAS.items():
            if stem.startswith(key):
                alias = name
                break
        out = pub / ((alias or stem) + ".geojson")
        size = gj.stat().st_size
        if size > cap:
            log(f"  SKIP public/ {round(size / 1024 / 1024, 1):>7} MB > cap  {gj.name}")
            skipped += 1
            continue
        if out.exists() and out.stat().st_size == size:
            copied += 1
            continue
        shutil.copyfile(gj, out)
        log(f"  public/ {round(size / 1024, 1):>9} KB  {out.name}")
        copied += 1
    log(f"promote: {copied} copied, {skipped} skipped over cap ({max_mb} MB)")



def main(argv=None):
    ap = argparse.ArgumentParser(description="FLOIN Chennai data collector")
    ap.add_argument("--list", action="store_true", help="list the resolved catalog")
    ap.add_argument("--plan", action="store_true", help="resolve and print URLs, download nothing")
    ap.add_argument("--tier", type=int, nargs="+", help="only these tiers (1 2 3)")
    ap.add_argument("--only", help="comma-separated ids / id substrings")
    ap.add_argument("--no-download", action="store_true", help="skip GET, only convert existing")
    ap.add_argument("--keep-kml", action="store_true", help="keep the raw KML alongside GeoJSON")
    ap.add_argument("--promote", action="store_true",
                    help="copy collected GeoJSON into public/ so the app can serve it")
    ap.add_argument("--max-public-mb", type=float, default=8.0,
                    help="skip promote for files larger than this (default 8 MB)")
    ap.add_argument("--no-clip", action="store_true", help="do not clip KML to the Chennai AOI")
    ap.add_argument("--force", action="store_true", help="re-download / re-convert")
    ap.add_argument("--timeout", type=int, default=300, help="per-file timeout seconds")
    args = ap.parse_args(argv)

    for d in (RAW, VEC, SRC):
        d.mkdir(parents=True, exist_ok=True)
    cat = build_catalog()
    allrows = [{k: v for k, v in e.items() if k != "days"} for e in cat[0] + cat[1]]
    (SRC / "source-catalog.json").write_text(json.dumps(
        {"generated": time.strftime("%Y-%m-%dT%H:%M:%S"), "aoi": AOI,
         "count": len(allrows), "sources": allrows}, indent=1), encoding="utf-8")
    log(f"-> data/sources/source-catalog.json ({len(allrows)} sources)")
    if args.list:
        cmd_list(cat)
        return 0
    cmd_run(cat, args)
    return 0


if __name__ == "__main__":
    sys.exit(main())

