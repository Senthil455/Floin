# DATA — Provenance Ledger

| Id | Geo | Count | CRS | Path | Source | Provenance |
|---|---|---|---|---|---|---|
| buildings | Polygon | 1,811 → 90–520 cap/basin | 4326 | `data/vectors/buildings.geojson` → `public/buildings.geojson` | OSM + GCC survey | clipped `80.10/12.88-80.35/13.25` `preprocess.py`, capped per basin |
| highway | LineString | 28 | 4326 | `highway.geojson` | OSM highway | — |
| natural_water | Polygon | 555 | 4326 | `natural_water.geojson` | OSM water | — |
| waterway (+canals/river/stream) | LineString | 3–12 | 4326 | `waterway*.geojson` | Chennai River Auth | — |
| rainfall_stations | Point | 8 | 4326 | `rainfall_stations.geojson` | IMD | 8 stations Nungambakkam/Meenambakkam etc |
| imd_rainfall_2024 | CSV | 1901-2021 16.8KB | — | `data/rainfall` `opencity.in 39ee6182` | IMD public domain | grid `80.25,13.25` |
| chennai_wards_200 | Polygon | 201 | 4326 | `chennai_wards_200.geojson` | GCC Ward Boundaries 200 wards | Zone/Ward No, AREA/PERIMETER |
| chennai_census_2011 | Point | 200 | 4326 | `chennai_census_2011` CSV→GeoJSON | Census 2011 ward population | POPULATION/HOUSEHOLDS/DENSITY |
| chennai_soil | Polygon | 3 | 4326 | `chennai_soil.geojson` | NBSS soil texture 1:50k | texture/cn_factor/drainage |
| chennai_drainage | LineString | 5 | 4326 | `chennai_drainage.geojson` | Stormwater drainage network | width/capacity cusecs |
| chennai_lulc | Polygon | 5 | 4326 | `chennai_lulc.geojson` | Bhuvan LULC 2015-16 | impervious/cn/area_km2 |
| chennai2015_hotspots | Point | 327 | 4326 | `chennai2015_hotspots.geojson` | GCC 2015 observed | severity/duration |
| chennai2015_flooded_streets | LineString | 4,001 | 4326 | `chennai2015_flooded_streets.geojson` | GCC 2015 | — |
| chennai2015_inundation/stagnation | Polygon | 750 | 4326 | `chennai2015_inundation` etc | GCC 2015 | depth_m/flood_extent |
| chennai2015_crowd | Point | 1,000 | 4326 | `chennai2015_crowd.geojson` | GCC 2015 crowd-sourced | — |
| DEM | Raster 30m | 5,802KB | 4326 | `rasters/rasters_COP30/DEM.tif` `s3://copernicus-dem-30m` | Copernicus GLO-30 | `geotiff` bilinear `Float32` cache `sampleDemBilinear` fallback `chennaiTopography` |
| Flow_Dir/Acc/Watershed/Streams | Raster | 735K–3,371K | 4326 | `rasters/*.tif` | QGIS D8 | `sampleDemGrid` 12-120 |
| Live | REST 30s | — | — | `api.open-meteo.com 13.0827,80.2707` | CC-BY | `current precip/temp/humidity/wind + daily sum` blended `P*0.6+live*0.4` |
| Ward analytics | derived | 8 (FloodML) | 4326 | `app/lib/floodml-chennai.ts` + `chennai-data.ts` | Chennai ward analytics | `wardFloodProb Q/80` → `wardDamage` `damage=prob*pop*0.004*(1+p/200)` |

**Registry:** `app/api/datasets/route.ts` 18 entries (`terrain 1 + analysis 2 + vector 2 + rainfall 2 + reference 11`) → `GET /api/datasets` validates `public/*.geojson` via `fs` + `featureCount`. `DATASET_REGISTRY` in `chennai-data.ts` 7 ledger items for UI. `preprocess.py` `CRS84` clip `12292` `.DS_Store` ignored → `MANIFEST.json`. `load_postgis.py` `ogr2ogr -nln -lco GIST` + `raster2pgsql -t 256x256 -s 4326` → PostGIS `buildings,highway,natural_water,waterway,rainfall_stations` + `dem,flow_*` raster.

Public `17 GeoJSON` + `simulation-result.json` served. All `EPSG:4326`. No secrets in repo (`env_file` + `.env` ignored).
