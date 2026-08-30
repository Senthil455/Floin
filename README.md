# FLOIN - 3D Flood Simulation Platform

Chennai flood model: SRTM DEM + IMD rainfall + OSM (buildings/roads/water) -> QGIS preprocess -> PostGIS -> Python (SCS-CN, D8, routing) -> Three.js 3D.

## Quick Start

```
npm install
npm run dev     # http://localhost:5173
npm run build
npm run preview
```

Python (Module 2 + 4):
```
pip install -r requirements.txt
python scripts/preprocess.py
python scripts/simulate.py --P 120 --CN 78 --t 45
```

PostGIS (Module 3):
```
docker compose up -d
python scripts/load_postgis.py --dry-run
python scripts/load_postgis.py
```

## Structure

```
Floin/  (repo root = Vite project)
 index.html, src/, public/, vite.config.js, package.json
 data/
  vectors/          curated GeoJSON + CSV (committed)
  processed/vectors cleaned (generated, gitignored)
  rasters/          DEM / Flow_* / Watershed / Streams
  rasters/rasters_COP30/DEM.tif
  raw/              OSM PBF 530MB, SRTM zips (gitignored)
  qgis/             .qgz (gitignored)
 scripts/
  preprocess.py  Module 2
  load_postgis.py/.ps1  Module 3
  simulate.py    Module 4
 docker-compose.yml Module 3
```

## Modules

1. Collect - 9 vectors + 5 rasters validated
2. Preprocess - `scripts/preprocess.py` CRS 4326, clip 80.10/12.88-80.35/13.25, terrain
3. Store - `docker compose up -d` + `ogr2ogr`/`raster2pgsql`
4. Simulate - `scripts/simulate.py` SCS-CN -> D8 -> accumulation -> depth
5. Visualize - Three.js + Leaflet live map + depth slider

Env: copy `.env.example` to `.env` if needed (DATABASE_URL).

## Production Notes

- Build splits three/leaflet via vite.config.js
- No secrets in repo (.env gitignored)
- All vectors CRS84, rasters 4326
