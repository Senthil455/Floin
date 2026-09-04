# FLOIN — Test Guide v4 · Ledger Live

## 0. Start

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # 7 routes
python scripts/preprocess.py && python scripts/simulate.py --P 160 --CN 84 --t 60
docker compose up -d && python scripts/load_postgis.py --dry-run
```

## 1. Datasets — `GET /api/datasets` → 13, buildings 1811, `byCategory`, `featureCount`

## 2. Query — `POST /api/location/query` `{aoi{bounds,center}}` → `covers/featureCount` 7×, `summary` + `source postgis/file`

## 3. Features — `POST /api/location/features` `{aoi,datasets[buildings,highway],limit600}` → `FeatureCollection` per id, `count`

## 4. Terrain — `GET /api/location/terrain` → 5 rasters `DEM 5802KB`. `POST {aoi}` → `grid 12-120` bilinear `min/max/mean/range` `COP30 bilinear` or fallback.

## 5. Simulate — `POST /api/simulate` `{aoi,rainfall,cn,duration}` → `blendedP` (live 40%), `S/Ia/Q`, `floodDepth,velocity,affectedBuildings,extent`, `timeSeries 0-6h`

## 6. Projects — `POST /api/projects` `{name,location}` → `id proj-…` persists `data/processed/projects.json`

## 7. Scenarios — `POST /api/scenarios` `{projectId,name,parameters,aoi}` → `id scn-…` persisted

## 8. Visual — Twin

- Open `01 DIGITAL TWIN` → `03 WEBGL` shows `INSTRUMENT LIVE` + `OrbitControls` drag/wheel/shift-pan
- Hover building → `E6B422` emissive + mono tooltip + `grab/pointer`
- Click terrain → ripple + inspector `Terrain Cell degE degN` / building `wardProb`
- `M` measure → 2pt `LineDashed` km, `R` reset, `F` AOI, `Space/←→` hour, double-click focus
- Switch `central → velachery` → terrain bowl -0.4 marsh, buildings 380→160, mat `d6d3c4`
- Switch `digital_twin → hydrology` → contour 14-band vs `velocity_field` teal arrows 18 cones

## 9. Live — `05 EVACUATION` top shows `CrisisFlow` live `Open-Meteo` 30s `precip/temp/humidity + daily` + 5-role tabs `GOV/POL/HOS/FIR/CIT` → resource ledger

## 10. WebFlood + FloodML — `02 HYDROLOGY` → `WebFlood 128²` `g9.81 dt0.02` `max/mean/flooded` live + `FloodML` bubble `r8+prob28` + heat `4×2` + table sorted `damage`

## 11. Print — `Ctrl+P` → header/aside/fixed hidden, ledger 1px black, `WebFlood` border avoid

## 12. Race — Rapid 5 clicks → only `REQ #last` renders, `AbortError` silent, cache 20 LRU `id-xmin/xmax/ymin/ymax-P-CN-t-viewMode`

| # | Pass |
|---|---|
| 1-7 | API 200 + `source` tag |
| 8 | Hover/ripple/measure/compass `N° km` |
| 9 | Live tick + 5-role |
| 10 | WebFlood/FloodML stats |
| 11 | Print preview 1px |
| 12 | No stale render |

All green → `NSE 0.892` ledger export `OPEN LEDGER` + `DOWNLOAD GEOJSON` work.
