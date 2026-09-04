# DATA — Provenance Ledger

| Id | Geo | Count | CRS | Path | Source | Provenance |
|---|---|---|---|---|---|---|
| buildings | Polygon | 1811→400 cap | 4326 | `data/vectors/buildings.geojson` → `public/buildings.geojson` | OSM + GCC survey | clipped `80.10/12.88-80.35/13.25` `preprocess.py` |
| highway | LineString | 28 | 4326 | `highway.geojson` | OSM highway | — |
| natural_water | Polygon | 555 | 4326 | `natural_water.geojson` | OSM water | — |
| waterway | LineString | 3-12 | 4326 | `waterway*.geojson` | Chennai River Auth | — |
| rainfall_stations | Point | 8 | 4326 | `rainfall_stations.geojson` | IMD | — |
| hotspots | Point | 327 | 4326 | `chennai2015_hotspots.geojson` | GCC 2015 observed | — |
| flooded_streets | LineString | 4001 | 4326 | `chennai2015_flooded_streets.geojson` | GCC 2015 | — |
| DEM | Raster 30m | 5802KB | 4326 | `rasters/rasters_COP30/DEM.tif` `s3://copernicus-dem-30m` | Copernicus GLO-30 | `geotiff bilinear Float32 cache` |
| Flow_Dir/Acc/Watershed/Streams | Raster | 735K-3371K | 4326 | `rasters/*.tif` | QGIS D8 | — |
| IMD monthly | CSV | 1901-2021 16.8KB | — | `opencity.in 39ee6182` | `Imd.gov.in` public domain | grid `80.25,13.25` |
| Live | REST 30s | — | — | `api.open-meteo.com 13.0827,80.2707` | CC-BY | `current precip/temp/humidity/wind + daily sum` |
| 8 wards | derived | 8 | 4326 | `app/lib/floodml-chennai.ts` | FloodML Chennai | `wardFloodProb Q/80` |

`preprocess.py` `CRS84` clip `12292 .DS_Store` ignored, `MANIFEST.json`, `load_postgis.py ogr2ogr -nln -lco GIST` + `raster2pgsql -t 256x256 -s 4326`.

Public `17 GeoJSON` + `simulation-result.json` served. `Github_demos/` 7 transplants ignored via `.gitignore`.

PostGIS tables: `buildings,highway,natural_water,waterway,rainfall_stations` + `dem,flow_direction,flow_accumulation,watershed,streams` raster.
