# FLOIN — Chennai Flood Intelligence Ledger

> Field instrument, not landing page. Ink on warm paper. Every number mono, every section `01 //` indexed.

`SRTM COP30 30m + IMD + OSM + GCC 2015` → `PostGIS 16 + Python SCS-CN/D8` → `Next.js 16 + Three.js 0.185 + Leaflet` → `geotiff bilinear + Open-Meteo live + shallow-water FBO + ward analytics`

![Next](https://img.shields.io/badge/Next.js-16-black) ![Three](https://img.shields.io/badge/Three.js-0.185-black) ![Tailwind](https://img.shields.io/badge/Tailwind-3.4-06B6D4) ![PostGIS](https://img.shields.io/badge/PostGIS-16-336791) ![geotiff](https://img.shields.io/badge/geotiff-3.0-111210) ![build](https://img.shields.io/badge/build-%E2%9C%93%20passing-brightgreen)

**Live:** `npm run dev` → http://localhost:3000 · `REV 06D9C60 · 2026-09-04 · NSE 0.892 · EPSG:4326`

---

## 1. Quick Start (30s)

```bash
# Frontend — Swiss ledger, zero-radius, OKLCH
npm install
npm run dev          # http://localhost:3000
npm run build        # typecheck + 7 routes

# Python — D8 + SCS-CN
pip install -r requirements.txt
python scripts/preprocess.py        # → data/processed/vectors (8 clipped)
python scripts/simulate.py --P 160 --CN 84 --t 60  # → result.json Q113.72 depth1.76 93%

# PostGIS — 5 vector + 5 raster, ST_Intersects ready
docker compose up -d
python scripts/load_postgis.py --dry-run
python scripts/load_postgis.py      # ogr2ogr + raster2pgsql 256x256 srid 4326
```

**Env:** copy `.env.example` → `.env` (`POSTGRES_PASSWORD` required, never commit `.env`).

---

## 2. Stack — No Slop

| Layer | Choice | Why not default |
|---|---|---|
| App | Next 16 App Router Turbopack + TS strict + `bundler` | — |
| UI | Tailwind 3.4 + `DESIGN.md` Swiss ledger (paper `oklch 0.98/0.015/85`, ink `0.15/0.01/100`, vermillion `0.62/0.22/25` <10%) | no `indigo→violet` gradient, no `rounded-2xl`, no `Inter` |
| Type | `Instrument Serif` display + `IBM Plex Sans` body + `IBM Plex Mono` every number | no `Inter/Poppins/Geist` |
| 3D | Three 0.185 + `OrbitControls` damping 0.08 (not manual yaw) + `geotiff 3.0` DEM bilinear | no `backdrop-blur` |
| Map | Leaflet 1.9.4 `dynamic ssr:false` + `geotiff` + `ST_Intersects` | — |
| DB | PostGIS 16-3.4 `env_file` + `pgdata` volume, GIST, `raster2pgsql -t 256x256` | no hardcoded `floin/floin` |
| Hydro | Python `numpy` SCS-CN `S=25400/CN-254, Q=(P-Ia)²/(P+0.8S)` + D8 8-dir + `tanh` 6h hydrograph | — |
| Physics | `WebFloodEngine` 128² FBO shallow-water `g9.81 dt0.02 n0.04` | — |
| ML | 8-ward analytics `prob=Q/80, damage=prob*pop*0.004*(1+p/200)` bubble/heat | — |
| Live | `Open-Meteo 13.0827,80.2707` 30s poll + `IMD 1901-2021` | — |

Design bundle: `DESIGN.md` (anti-slop Donts) + `design/tokens.json` DTCG → `globals.css` OKLCH vars. Radius `0`, elevation `rules > bg-shift > hard offset`.

---

## 3. Structure — 42 Distinct Lands

```
Floin/
 app/
  layout.tsx · globals.css          # IBM Plex, OKLCH, print + skeleton
  page.tsx 378 LOC                  # 01 twin 02 hydro 03 scenarios 04 impact 05 evac 06 valid 07 registry 08 export (asymmetric 1.55/0.85)
  lib/
   chennai-data.ts                  # 6 AREAS, 11 landmarks, DATASET_REGISTRY, RESERVOIRS
   raster.ts                        # geotiff bilinear cache Float32, 5 rasters, PostGIS probe
   postgis.ts                       # ST_Intersects optional, file fallback
   floodml-chennai.ts               # 8 wards, wardFloodProb/wardForLngLat
   workspaces/{Hydrology,Validation,Registry}.tsx  # ledger tables
  api/
   datasets · location/{query,features,terrain} · simulate · projects · scenarios  # 7, PostGIS+file dual
 components/
  FloodSimulation.tsx 554 LOC        # BASIN_PROFILE 6×7 views, OrbitControls, hover tooltip, ripple, measure M, compass/scale, 400 cap per basin, wardProb, shared mats, 1024 shadow
  ChennaiMap.tsx                    # ledger LAYERS, ink AOI 4 4, geoCache
  EvacuationRouting.tsx              # ledger 05.1/05.2, detour 1.05-1.45
  CrisisCommandCenter.tsx            # 5-role GOV/POL/HOS/FIR/CIT + live precip
  FloodMLAnalytics.tsx               # bubble r8+prob28 + heat 4×2 + table
  WebFloodEngine.tsx 128²            # shallow-water FBO
 hooks/useChennaiLive.ts · useHydrology.ts
 data/
  vectors/ 14 GeoJSON (buildings 1811, highway 28) + rasters/ 5 TIF (DEM 5.8MB) + qgis/ + raw/
  processed/ vectors + projects.json/scenarios.json (git-kept) + MANIFEST.json
  public/ 17 GeoJSON + simulation-result.json
  docs/ ARCHITECTURE, API, DATA, 3D
```

**42 lands:** 6 basins `all/central/adyar/ennore/velachery/chembarambakkam` × 7 views `digital_twin/progression/depth_heatmap/velocity_field/infrastructure_impact/hydrology/data_quality` → distinct `BASIN_PROFILE base/roughness/marsh/hill/urban` + view warp (hydrology ridge, velocity 18 arrows, depth bowl, checker) + per-basin mat/height/cap.

---

## 4. How It Works — Click Pipeline (Race-Safe)

```
Click 13.07,80.26 (1.5km AOI) → aoi {xmin,xmax,ymin,ymax,center} + blendedP(P*0.6+live*0.4)
 → POST /query ST_Intersects? → counts (buildings 342 etc) [AbortController, reqId++]
 → POST /features limit600 → 400 bldgs (velachery 160/chem 90) via lngLatToXZ 14
 → POST /terrain geotiff bilinear grid 12-120 → {min,max,source COP30 bilinear}
 → POST /simulate SCS blendedP,CN → Q113 + timeSeries 7×tanh
 → cacheSet 20 LRU key id-xmin/xmax/ymin/ymax-P-CN-t-viewMode
 → Three: disposeScene(controls/renderer/measureLine) → createProScene(OrbitControls) → generateTerrain per basin/view → buildBuildings per basin/wardProb → water rippleTime+caustics → Orbit update → render
 → Inspector: terrain cell | building wardProb → risk, Evac: detour 1.05-1.45 → CIT 23 reports
```

`requestIdRef + abort + if(current!==reqId) return` guarantees last click wins.

---

## 5. 3D — Instrument, Not Card

- **Terrain** `Plane 14×14 72|90seg` `MeshStandard vertexColors` `computeVertexNormals` per basin/view.
- **Water** `Plane 13.4 64/40` `Shader time/depth/opacity/rippleCenter/Time` vert `sin1.1*t*0.035+ripple sin28*exp-6`, frag `shallow#0E7490→mid#E6B422→deep#E63946 + caustics pow(c1+c2,3)*0.35`.
- **Buildings** `Extrude bevel 0.01` `h=levels*0.19` per basin mat/hill, `frustumCulled+shadow 1024`, `wardProb` drives `infrastructure_impact/depth_heatmap`.
- **Interaction:** drag orbit, wheel zoom 3-28, shift drag pan, hover `emissive #E6B422 + tooltip var(--ink)` + `grab/pointer`, click `rippleCenter(uv)` + inspector, double-click focus, `M` measure `LineDashed #111210` km, `R 3D, F AOI, ←→ hour, Space +1`, compass `getAzimuthalAngle°` + scale `dist*0.37/14*111/8 km`, `Rain 600 drops rainfall*2.5+40`.
- **Perf:** `cap 90-380/buildings`, shared `LineBasic depthWrite:false`, `1024 shadow`, `depthWrite false grid 0.18`, GPU water (no JS setZ), `BatchedMesh` next.

---

## 6. API — 7 + Dual PostGIS/File

| # | Route | Method | Query | Response |
|---|---|---|---|---|
| 1 | `/api/datasets` | GET | — | 13 datasets, `byCategory`, `featureCount` via `fs public/*.geojson` |
| 2 | `/api/location/query` | POST | `{aoi{bounds,center},requestId}` | `ST_Intersects` if `DATABASE_URL` else `fileFallback`, 7× `covers/featureCount`, `summary` |
| 3 | `/api/location/features` | POST | `{aoi,datasets[],limit}` | `FeatureCollection` per id, `source postgis/file` |
| 4 | `/api/location/terrain` | GET | — | `getDemAvailability()` 5 rasters |
| 4b | `/api/location/terrain` | POST | `{aoi}` | `sampleDemGrid bilinear` or `chennaiTopography` fallback, `statistics min/max/mean/range` |
| 5 | `/api/simulate` | POST | `{aoi,rainfall,cn,duration}` | `blendedP`, `S/Ia/Q`, `floodDepth,velocity,affectedBuildings,extent`, `timeSeries 0-6h tanh*exp` |
| 6 | `/api/projects` | GET/POST | `{name,location}` | `Map file data/processed/projects.json` atomic |
| 7 | `/api/scenarios` | GET/POST | `{projectId,name,parameters,aoi}` | `Map file scenarios.json`, `tags draft/running/completed` |

All POST validate `xmin<xmax && ymin<ymax`, `400` for P, `98` for CN, `AbortSignal` respected.

---

## 7. Data — Provenance Ledger

| Id | Type | Count | CRS | Source | License |
|---|---|---|---|---|---|
| buildings | Polygon | 1811 | 4326 | OSM + GCC survey `data/vectors/buildings.geojson` | ODbL |
| highway | LineString | 28 | 4326 | OSM highway | ODbL |
| natural_water | Polygon | 555 | 4326 | OSM water | ODbL |
| waterway | LineString | 3-12 | 4326 | Chennai River Auth | — |
| rainfall_stations | Point | 8 | 4326 | IMD `rainfall_stations.geojson` | — |
| hotspots | Point | 327 | 4326 | GCC 2015 `chennai2015_hotspots` | observed |
| flooded_streets | LineString | 4001 | 4326 | GCC 2015 | observed |
| DEM | 30m raster | 5802KB | 4326 | Copernicus GLO-30 `rasters_COP30/DEM.tif` s3://copernicus-dem-30m | Copernicus |
| Flow_Dir/Acc/Watershed/Streams | 30m raster | 735K–3371K | 4326 | QGIS D8 | — |
| IMD monthly | CSV | 1901-2021 | — | `opencity.in 39ee6182` 16.8KB | Public Domain |
| Live | REST | 30s | — | `api.open-meteo.com 13.0827,80.2707` | CC-BY |
| 8 wards | derived | 8 | 4326 | Chennai ward analytics `app/lib/floodml-chennai.ts` | — |

`preprocess.py` clips `80.10/12.88-80.35/13.25`, `MANIFEST.json`, `load_postgis.py ogr2ogr -nln -lco GIST` + `raster2pgsql -t 256x256 -s 4326`.

---

## 8. Production & Docs

- `next build` → `.next` + `validator.ts` + 5.5s TS, `scripts/test_modules.py` (not `python -m pytest`).
- Print `@media print` hides header/aside/fixed, ledger 1px black.
- `npx tsc --noEmit` 0, `docker compose up -d` health `pg_isready 5s×10`.
- Docs: `DESIGN.md` + `design/tokens.json` + `docs/{ARCHITECTURE,API,DATA,3D}` + `DEPLOYMENT_SUMMARY v4` + `TEST_GUIDE 12 tests` + `IMPLEMENTATION_STATUS`.

**Known limits:** `geotiff bilinear` cache not yet `WebGPU pipes`, `400 draws` not `BatchedMesh`, `ST_Intersects` optional (needs `DATABASE_URL` + `pg`).

---

## 9. License & Credits

**MIT** — see [`LICENSE`](./LICENSE). Copyright (c) 2026 FLOIN — Chennai Flood Intelligence Ledger.

FLOIN Chennai Flood Intelligence — REV 06D9C60. Built on `Three.js r185`, `Leaflet 1.9`, `Copernicus DEM`, `Open-Meteo`, `OSM`, `GCC 2015`. See `data/tEAM fLOIN.pdf`.
