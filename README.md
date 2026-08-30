# FLOIN - 3D Flood Simulation Platform

> Chennai flood model: **SRTM DEM + IMD rainfall + OpenStreetMap** -> **QGIS** -> **PostGIS** -> **Python (SCS-CN, D8, routing)** -> **Three.js** interactive 3D.

![Vite](https://img.shields.io/badge/Vite-8.x-646CFF) ![Three.js](https://img.shields.io/badge/Three.js-0.185-black) ![PostGIS](https://img.shields.io/badge/PostGIS-16--3.4-336791) ![Python](https://img.shields.io/badge/Python-3.11+-3776AB)

Live demo: `http://localhost:5173` (hero 3D + Leaflet explorer + flood sliders)

---

## Architecture

```
QGIS (preprocess) -> PostGIS (store) -> Python/NumPy (simulate) -> Three.js/WebGL (visualize)
       |                    |                     |                       |
  data/vectors/     docker-compose.yml    scripts/simulate.py      src/main.js
  data/rasters/     ogr2ogr/raster2pgsql  SCS-CN + D8 + depth      Leaflet map
```

## Quick Start

```bash
# Frontend
npm install
npm run dev      # http://localhost:5173
npm run build    # production build (chunked: three, leaflet)
npm run preview

# Python
pip install -r requirements.txt
python scripts/preprocess.py
python scripts/simulate.py --P 120 --CN 78 --t 45 --grid 60
python scripts/test_modules.py

# PostGIS (requires Docker)
docker compose up -d
python scripts/load_postgis.py --dry-run
python scripts/load_postgis.py
psql "host=localhost dbname=floin user=floin password=floin" -c "\d buildings"
```

## Project Structure

```
Floin/  <- Vite project root
 index.html
 vite.config.js          # manualChunks: three/leaflet/geotiff
 src/
  main.js                # dual-scene Three.js + Leaflet, CHENNAI_BOUNDS 80.10/12.88
  style.css
 public/                 # favicon + GeoJSON copies for dev + simulation-result.json
 data/
  vectors/               # 9 GeoJSON/CSV curated (committed) - buildings 1811, highway 28, etc.
  processed/vectors/     # cleaned output (generated, gitignored)
  processed/simulation/result.json
  rasters/               # Flow_*.tif, Watershed, Streams (gitignored *.tif)
  rasters/rasters_COP30/DEM.tif 5.94MB
  raw/                   # OSM PBF 530MB, SRTM zips, tars (gitignored)
  qgis/                  # .qgz projects (gitignored)
 scripts/
  preprocess.py          # Module 2: CRS 4326, clip, terrain summary, MANIFEST.json
  load_postgis.py/.ps1   # Module 3: ogr2ogr 5 vectors, raster2pgsql 5 rasters (-I -C -M -t 256)
  simulate.py            # Module 4: SCS-CN -> D8 (int16) -> accumulation -> depth -> JSON
  test_modules.py        # vectors/rasters/preprocess/simulate
 docker-compose.yml       # postgis:16-3.4, floin/floin, healthcheck
 .env.example
 requirements.txt
```

## Modules

| Module | Command | Input | Output |
|--------|---------|-------|--------|
| **1 Collect** | audited | SRTM, IMD, OSM | `data/vectors/` 9 files + `data/rasters/` 5 tifs, bounds 80.10/12.88-80.35/13.25 |
| **2 Preprocess** | `python scripts/preprocess.py` | 9 vectors + 4 rasters | `data/processed/vectors/` cleaned, `MANIFEST.json` |
| **3 Store** | `docker compose up -d && python scripts/load_postgis.py` | processed vectors + rasters | PostGIS 5 `geometry` + 5 `raster` tables (GIST) |
| **4 Simulate** | `python scripts/simulate.py --P 120 --CN 78 --t 45` | P, CN, t, grid | `data/processed/simulation/result.json` + `public/simulation-result.json` |
| **5 Visualize** | `npm run dev` | PostGIS/GeoJSON + simulation | Three.js terrain + water (depth-driven), Leaflet explorer |

### Core Algorithms

- **SCS-CN:** `S=(25400/CN)-254, Ia=0.2S, Q=(P-Ia)^2/(P+0.8S)` if `P>Ia`
- **D8:** steepest slope among 8 neighbors -> code 1/2/4/8/16/32/64/128 (`int16`)
- **Accumulation:** sorted by elevation descending -> propagate `acc`
- **Depth:** `base*norm* t_factor`, `acc_norm` weighted, terrain factor, `clip 0-3.5m`, extent `>0.15m`

## Environment

Copy `.env.example` to `.env` if customizing:

```
DATABASE_URL=postgresql://floin:floin@localhost:5432/floin
PG_CONN=host=localhost dbname=floin user=floin password=floin
```

No secrets committed. Large files gitignored: `data/raw/`, `*.tif`, `data/processed/`, `data/qgis/`.

## Production Build

- Vite splits `three` (138KB gz) + `leaflet` (43KB) via `manualChunks(id)`
- `npm run build` -> `dist/` (served by `vite preview` or static host)
- Python `requirements.txt` pinned to `numpy>=1.24` (numpy 2.0 `ptp` compat via `np.ptp`)
- Docker healthcheck `pg_isready`

## Testing

```bash
python scripts/test_modules.py   # vectors, rasters, preprocess, simulate
npm run build
npm run test   # wrapper for both python tests
```

## Deployment

Static frontend: `dist/` to any host. PostGIS: `docker compose up -d` on server. Ensure `DATABASE_URL` env.

## Team

TEAM FLOIN - Chennai Flood Simulation 2026. Proposal: `data/tEAM fLOIN.pdf`.
