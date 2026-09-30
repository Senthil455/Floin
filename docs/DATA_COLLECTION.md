# DATA COLLECTION — Chennai Accuracy Upgrade

Deep audit of what the project actually contains, what it needs, and the real
sources that were collected to close the gap.

Regenerate the evidence:

```bash
python scripts/audit_data.py           # -> data/processed/AUDIT.json, docs/DATA_AUDIT.md (AUDIT.json cleaned 2026-09-30; re-runs recreate it)
python scripts/collect_chennai_data.py --list
python scripts/collect_chennai_data.py --tier 1   # re-fetches data/raw/ removed 2026-09-30
```

> Note `2026-09-30`: `data/raw/`, `data/qgis/`, `data/arcgis_api/`, `data/chennai2015/`, `data/rasters/*.tif` were removed as gitignored caches. Section 3 below describes what the collector fetches; re-run it to restore.

---

## 1. Inventory verdict — 12 real datasets out of 294

`scripts/audit_data.py` walks every GeoJSON in `data/vectors/` and classifies the
geometry. A `SYNTHETIC_BOX` is an axis-aligned rectangle (a ring of 4–5 points
where one axis is constant) — i.e. a hand-typed placeholder, not a survey.

| Verdict | Meaning | Files |
|---|---|---|
| `SYNTHETIC_BOX` | axis-aligned rectangle placeholder | 144 |
| `POINT_ONLY` | point placeholder, no areal detail | 91 |
| `STUB_LINE` | polyline with < 25 vertices | 47 |
| `REAL_DETAILED` | irregular real geometry | 11 |
| `MIXED` | some real + some rectangle | 1 |

**Original baseline: `12 / 294`. Placeholder: `282`.**
**After collection rounds 1-2: `33 / 324` real GeoJSON, `4,599,735` observed
vertices** — live counters in `docs/DATA_AUDIT.md`, new assets in section 3.8.
All 238,619 real vertices live in just 9 files:

| File | KB | Features | Vertices | Note |
|---|---|---|---|---|
| `chennai2015_inundation.geojson` | 3,447 | 4,001 | 85,519 | GCC observed 2015 |
| `buildings.geojson` | 2,761 | 1,811 | 22,051 | OSM MultiPolygon |
| `chennai2015_flooded_streets.geojson` | 2,518 | 7,894 | 34,683 | GCC observed 2015 |
| `chennai_flood_hazard_zones_gcc.geojson` | 1,647 | 400 | 62,252 | GCC hazard zoning |
| `natural_water.geojson` | 597 | 555 | 15,125 | OSM water |
| `chennai_wards_200.geojson` | 594 | 201 | 12,971 | GCC wards |
| `chennai2015_crowd.geojson` | 434 | 1,000 | 4,408 | crowd-sourced |
| `chennai2015_hotspots.geojson` | 138 | 327 | 327 | GCC SDSS |
| `chennai2015_stagnation.geojson` | 92 | 753 | 753 | GCC SDSS |

Everything else named `chennai_*` — all 260-odd files — is a placeholder.
`docs/PREDICTION.md` advertises "**310 Datasets → One Risk**", but only 12 of
those 310 carry real geometry; the other ~282 contribute a binary
`countGeoJSON(aoi) > 0` flag times a hand-assigned weight of 0.005–0.06.

### Rasters actually present

| File | KB | What it is |
|---|---|---|
| `data/rasters/rasters_COP30/DEM.tif` | 5,802 | Copernicus GLO-30 **DSM**, 1 tile (N13 E080) |
| `data/rasters/Flow_Accumulation.tif` | 3,372 | QGIS D8 derivative |
| `data/rasters/Watershed.tif` | 1,196 | QGIS D8 — 11 basins |
| `data/rasters/Streams.tif` | 954 | QGIS D8 |
| `data/rasters/Flow_Direction.tif` | 735 | QGIS D8 |

There is **no** soil raster, **no** land-cover raster, **no** imperviousness
raster, **no** rainfall raster and **no** observed flood-extent raster.

---

## 2. Why accuracy is currently capped

Ranked by how much each gap moves a depth prediction.

### 2.1 Drainage network — the biggest lever, 5 polylines
`data/vectors/chennai_drainage.geojson` is **five hand-drawn LineStrings**
(Cooum, Adyar, Buckingham, Otteri Nullah, Pallikaranai) with `capacity_cusecs`
values typed in by hand. In a city with a mean elevation of ~6 m and a 1:6000
slope, *where water goes* is decided by the stormwater drain topology, not by
the DEM. The prediction engine has no real conduit geometry, width, invert
level, culvert count or blockage state.

### 2.2 Rainfall forcing — one synthetic snapshot
`rainfall_stations.geojson` is 8 invented stations all stamped
`2024-12-03` with invented `rainfall_mm`. `floodml-chennai.ts` then hard-codes
`basePrecip` per ward (45, 78, 112, 145…). The SCS-CN chain
`S=25400/CN-254, Q=(P-Ia)²/(P+0.8S)` therefore runs on a single guessed `P`.
There is no intensity–duration–frequency curve, no antecedent moisture
condition (AMC), and no time-stepped hyetograph.

### 2.3 Runoff coefficient — guessed rectangles
`chennai_lulc.geojson` is **5 rectangles** with `impervious` typed as
0.85 / 0.92 / 0 / 0.1 / 0.15 and `cn` as 88 / 91 / 100 / 78 / 62.
`chennai_soil.geojson` is **3 rectangles** with `cn_factor` 78 / 68 / 86.
The composite curve number — the single most sensitive parameter in the whole
model — is derived from 8 hand-typed numbers covering the entire city.

### 2.4 DEM — a DSM, one tile, uncalibrated
COP30 GLO-30 is a *surface* model: it includes building roofs and tree canopy.
Over a city whose ground sits 1–14 m above sea level, a 5–10 m roof bias is the
same order of magnitude as the flood depth being predicted. Only one 1°×1°
tile is present, there is no vertical-datum check, and no LiDAR/DTM anywhere.

### 2.5 Training labels — a single event
All observed data is **November–December 2015**: 4,001 inundation polygons,
327 hotspots, 753 stagnation points, 7,894 flooded streets, 1,000 crowd reports.
Chennai also flooded badly in 2005, 2015, 2017, 2020, 2021 and 2023 (Michaung).
A model cannot learn a rainfall→depth relationship from one storm, and cannot be
validated at all without held-out events.

### 2.6 Exposure — 1,811 buildings for ~1.5 M
`buildings.geojson` holds 1,811 OSM footprints. Greater Chennai has on the order
of 1.5 million structures, so the building layer covers roughly **0.1 %**.
`chennai_building_heights_lidar.geojson` is a 2.2 KB stub with 6 features.

### 2.7 Boundary conditions — all hard-coded
Reservoir outflow (`4,500 cusecs`), tide, storm surge and groundwater depth are
literals in TypeScript. Chembarambakkam's real 2015 release was the direct cause
of the Adyar flooding; nothing in the repo reads an actual release log.


---

## 3. What was collected

`scripts/collect_chennai_data.py` resolves **62 real sources** — 15 external
keyless endpoints plus 47 curated Greater Chennai Corporation resources pulled
live from the OpenCity CKAN API. Full resolved list:
`data/sources/source-catalog.json`; what actually landed (154 fetched items):
`data/sources/FETCHED.json`.

### 3.1 Terrain
| Dataset | Res | Size | Why it matters |
|---|---|---|---|
| `COP30_N13E080_30m.tif` | 30 m | 12.1 MB | North half of the AOI, official COG tile |
| `COP30_N12E080_30m.tif` | 30 m | 7.0 MB | South half — Adyar / Velachery / Pallikaranai |
| `SRTM1_N13E080.hgt.gz` | 30 m | 5.0 MB | Independent DEM for vertical-bias cross-check |

### 3.2 Rainfall — the forcing term
| Dataset | Res / span | Size | Why it matters |
|---|---|---|---|
| CHIRPS v2.0 daily, **61 tiles** Nov–Dec 2015 | 0.05° daily | 190 MB | The actual Dec-2015 storm day by day — replaces the single invented `P` |
| `openmeteo_chennai_daily_1940_2025` | ERA5 daily, 31,412 rows | 864 KB | 85-year rainfall + ET0 for IDF and AMC |
| `nasa_power_chennai_daily_1981_2024` | 0.5° daily | ~1 MB | Independent rainfall, temperature, humidity, wind |
| GCC Chennai Daily Rainfall 1991-2023 | station daily | 873 KB | Official city gauge record |
| GCC Chennai Monthly Rainfall 1901-2021 | station monthly | 17 KB | 120-year baseline |

### 3.3 Discharge and reservoir state
| Dataset | Span | Size | Why it matters |
|---|---|---|---|
| GloFAS `river_discharge` Chennai | 1984-2024, 14,976 rows | 410 KB | Real analysed outflow at the Adyar–Cooum mouth |
| Chembarambakkam / Poondi / Cholavaram / Red Hills / Veeranam storage | from 2003 | 6 CSV | The Chembarambakkam release caused the 2015 Adyar flood |
| Chennai Lakes Inflow & Outflow 2021-2024 | daily | ~180 KB | Live hydraulic state for the reservoir boundary |
| Ward-wise Monthly Groundwater Depth 2021-2024 | 200 wards | ~75 KB | Infiltration capacity / baseflow |

### 3.4 Flood ground truth — the labels
| Dataset | Features | Why it matters |
|---|---|---|
| Chennai Flows 5 / 10 / 25 / 50 / 100 / 200-yr return period | 6 KML | **Official GCC design-storm hazard zones** — a direct target to score against |
| Chennai Flood Hazard Zones Map | KML | GCC High / Moderate / Low zoning |
| Chennai Inundation Points with Depth (inches) | KML | Observed depth, not just extent |
| Chennai Flooding Points 2015 | KML | Observed 2015 event points |
| GCC Flood Hotspots **2020** | KML | Second event — enables temporal validation |
| GCC Flood Hotspots **2005** + Flood Extent 2005 | 2 KML | Third event |

### 3.5 Drainage network — the biggest single upgrade
| Dataset | Size | Why it matters |
|---|---|---|
| **GCC Storm Water Drains (SWD) Map 2023** | 27.4 MB KML | Real conduit geometry across all of GCC — replaces 5 hand-drawn lines |
| Chennai Microwatersheds Map | 4.3 MB **GeoJSON** | Real sub-basin delineation — replaces the 11-basin D8 raster |
| Basin Rivers & Streams | 3.3 MB KML | Full river / stream topology |
| Basin Macro Drains | 74 KB KML | Primary conveyance |
| Basin Micro Drains | 124 KB KML | Street-level conveyance |
| Buckingham Canal | 17 KB KML | The critical north–south coastal outfall |
| Waterbodies Map 2019 / Basin Waterbodies | 2.5 MB / 17.8 MB KML | Every tank and pond — retention storage |
| Tamil Nadu Water Bodies Census 2023 (Chennai) | 591 KB KML | Official national waterbody census |
| Chennai Rivers Map | 328 KB KML | River centrelines |

### 3.6 Exposure, vulnerability and land
| Dataset | Size | Why it matters |
|---|---|---|
| Ward-wise Census 2011 | 462 KB CSV | Real ward population / households for `wardDamage()` |
| Chennai Slums Map + Slum Boundaries Map | 2.8 MB KML | Actual slum geometry — the most flood-vulnerable population |
| Slum Housing & Population 2011 | CSV | Slum-level attributes |
| Sewerage Command Area + Ventilating Columns | 3.1 MB KML | Below-ground network and its interaction with the SWD |
| UPHC / UCHC healthcare maps | 112 KB KML | Real health facilities for impact modelling |
| Chennai Parks (CSV + neighbourhood parks map) | 26 KB | Retention / infiltration capacity |

### 3.7 Documented but not auto-downloaded
`data/sources/reference-portals.json` catalogues **61 further portals** that
need a UI, registration or GIS-client step — IMD 0.25° gridded rainfall, ISRO
CartoDEM, ASF ALOS PALSAR, Copernicus EMS, Sentinel-1/2, JRC Global Surface
Water, SoilGrids, Google / Microsoft building footprints, INCOIS tide and surge,
India-WRIS, CGWB, NASA NEX-GDDP-CMIP6, Esri Living Atlas, plus the QGIS,
HEC-RAS and ArcGIS Hydro toolchains — each with publisher, access route and a
stated reason for the project.

### 3.8 Round-2 collection — satellite labels, land cover, event rainfall
Second pass over the catalog (`--tier 2`), all keyless direct downloads.

| Dataset | Res | Size | Why it matters |
|---|---|---|---|
| **UNOSAT Sentinel-1 flood waters, 12 Nov 2015** | polygons | 10.6 MB (3,974 feats) | Independent satellite flood extent — validates the GCC 2015 inundation labels |
| **UNOSAT Sentinel-1 flood waters, 24 Nov 2015** | polygons | 6.9 MB (3,104 feats) | Second-date extent — the storm peak sequence |
| UNOSAT Sentinel-1 pre-flood water, 01 Sep 2015 | polygons | 5.9 MB (1,150 feats) | Permanent-water baseline; flood-only = flood minus baseline |
| UNOSAT Landsat-8 pre-flood water, 14 Oct 2015 | polygons | 1.1 MB (562 feats) | Optical cross-check of the baseline |
| **ESA WorldCover 10 m 2021 (tile N12E078, COG)** | 10 m raster | 113.6 MB | Real impervious/water/built fraction per microwatershed → CN stops being guessed |
| CHIRPS daily, **91 more tiles**: Dec-2023 (Michaung), Nov-2020 (Nivar), Nov-2021 flood | 0.05° daily | ~96 MB | Forcing for every held-out validation event (see §4 Phase 3) |

Raw: `data/raw/flood-obs/FL20151123IND_shp.zip` (UNOSAT shapefiles, parsed
without GDAL into `data/vectors/fl20151123ind_shp_*.geojson`, scene
`analysis_extent` bounding boxes discarded) and
`data/raw/lulc/ESA_WorldCover_10m_2021_v200_N12E078.tif` (Cloud-Optimised
GeoTIFF — range-request friendly, so QGIS can stream it without a full copy).
All four UNOSAT layers are promoted to `public/` and flagged as observed
ground truth in `scripts/audit_data.py`.

### 3.9 ArcGIS / QGIS toolchain — turning the raw assets into features
The downloads above are raw; the derived features that actually move accuracy
are produced in the desktop GIS stack already wired into `data/qgis/*.qgz`:

1. **CN per microwatershed (QGIS or ArcGIS Pro):** load
   `ESA_WorldCover_10m_2021_v200_N12E078.tif` + `Microwatersheds`,
   run *Zonal Histogram / Tabulate Area* (built-in, or `SAGA`/`ArcGIS.zonal`),
   intersect with SoilGrids HSG (WCS → QGIS Add Layer → WCS with
   `https://maps.isric.org/mapserv?map=/map/hysogs.map`), then map
   (built %, HSG) → SCS curve number per microwatershed.
2. **HAND / depth normalization (QGIS):** WhiteboxTools *Elevation above
   Stream* on the COP30 DSM mosaic (`data/raw/dem/*.tif`) with the SWD 2023
   network as streams; HAND bins calibrate the depth-vs-elevation curve.
3. **Event validation (any GIS):** overlay the UNOSAT 12/24-Nov layers with the
   predicted extent grid → CSI / POD / FAR per §4 Phase 3, using the GCC
   hotspots as the second opinion.
4. **ArcGIS side:** *Esri Living Atlas* (imagery + elevation + Sentinel-2 land
   cover) and *ArcGIS Hydro / HEC-GeoRAS* for the cross-check runs; HEC-RAS 2D
   remains the hydraulic benchmark for the browser shallow-water engine.


---

## 4. Accuracy roadmap

Ordered so each phase removes the largest error term first.

### Phase 1 — Replace the geometric stubs (largest immediate gain)
| Current stub | Replace with | Effect |
|---|---|---|
| `chennai_drainage.geojson` (5 lines) | GCC SWD 2023 (27.4 MB) + macro/micro drains + Buckingham Canal | Conveyance topology becomes real; water stops being routed by the DEM alone |
| `chennai_watershed_boundaries.geojson` (11 D8 basins) | Chennai Microwatersheds GeoJSON | Sub-basin routing at the scale the drains actually operate |
| `chennai_waterbodies.geojson` (rectangle) | Waterbodies 2019 + Water Bodies Census 2023 | Real retention storage volume |
| `rainfall_stations.geojson` (8 invented, one date) | IMD 0.25° gridded + GCC 1991-2023 daily gauges | Real spatial rainfall pattern |
| `chennai_lulc.geojson` (5 rectangles) | ESA WorldCover 10 m zonal stats per microwatershed | CN stops being 5 hand-typed numbers |
| `chennai_soil.geojson` (3 rectangles) | SoilGrids 250 m + NBSS&LUP 1:50 k | Real hydrologic soil group A–D |
| `chennai_census_2011_wards.csv` | OpenCity Ward-wise Census 2011 (462 KB) | Real population / household exposure |
| `wardDamage()` ward constants | WorldPop 100 m constrained | Dasymetric exposure instead of 8 ward literals |

### Phase 2 — Calibrate the hydrology
1. **CN per microwatershed** = f(WorldCover impervious fraction, SoilGrids HSG).
   Stop using one composite CN of 78–84 for the whole city.
2. **AMC from antecedent rainfall** — the 5-day prior total from the 85-year
   Open-Meteo / NASA POWER series selects AMC I / II / III, which shifts CN by
   ±15. The engine currently ignores antecedent moisture entirely.
3. **Ia = λ·S with a calibrated λ.** The code hard-codes the textbook λ = 0.2;
   Indian urban catchments typically calibrate to 0.05–0.1.
4. **IDF curves** from the 1940-2025 series + CHIRPS, so `P` in
   `/api/simulate` comes from a real return period instead of being typed.
5. **Route through the real drain network** — replace the flat `Q` with convex
   routing along the SWD graph, respecting capacity and invert levels.
6. **Reservoir release + tide boundary** from the collected storage/inflow logs
   and INCOIS tide, instead of the literal `4,500 cusecs`.

### Phase 3 — Validate against held-out events
The project reports no accuracy metric at all today. With 2005, 2015, 2020 and
2023 now available, use an event split:

| Split | Events | Purpose |
|---|---|---|
| Train | 2015 + 2020 | Fit λ, CN per class, roughness `n` |
| Test | 2005 | Tune the damage / loss curve |
| Blind | 2023 (Michaung) | Report the headline accuracy |

Report standard hydrology metrics, never a self-declared score:
- **Flood extent** — CSI, POD, FAR, F1 vs GCC 2005/2020 hotspots and UNOSAT 2015
- **Depth** — RMSE / MAE vs `chennai_inundation_depth_inches` and 2015 building depths
- **Hydrograph** — NSE / KGE against the GloFAS discharge series
- **Design storms** — agreement with the six GCC return-period zones (5 → 200 yr)
- **Spatial** — ROC-AUC / Brier score on a per-ward binary flood / no-flood label
