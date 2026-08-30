# FLOIN - Chennai Flood Intelligence

> Interactive 3D flood simulation for Chennai: **SRTM DEM + IMD rainfall + OpenStreetMap** -> **PostGIS** -> **Python (SCS-CN, D8)** -> **Next.js + Three.js**.

![Next.js](https://img.shields.io/badge/Next.js-16-black) ![Tailwind](https://img.shields.io/badge/Tailwind-3.4-06B6D4) ![Three.js](https://img.shields.io/badge/Three.js-0.185-black) ![PostGIS](https://img.shields.io/badge/PostGIS-16-336791)

Live: `npm run dev` -> http://localhost:3000

---

## Quick Start

```bash
# Frontend (Next.js + Tailwind)
npm install
npm run dev      # http://localhost:3000
npm run build
npm start

# Python
pip install -r requirements.txt
python scripts/preprocess.py
python scripts/simulate.py --P 120 --CN 78 --t 45

# PostGIS
docker compose up -d
python scripts/load_postgis.py --dry-run
python scripts/load_postgis.py
```

## Stack

- **Next.js 16** (App Router, Turbopack) + **Tailwind CSS 3.4** + **TypeScript**
- **Three.js** (terrain + water) + **Leaflet** (Chennai map) - both client-only via `next/dynamic`
- **PostGIS 16-3.4** (`docker-compose.yml`) + **Python/NumPy** (SCS-CN, D8)

## Structure

```
Floin/
 app/
  layout.tsx, page.tsx, globals.css   # Next.js App Router
 components/
  ChennaiMap.tsx     # Leaflet, dynamic ssr:false
  FloodSimulation.tsx # Three.js, dual-scene, depth-driven water
 src/style.css        # FLOIN design tokens (imported in globals.css)
 public/              # GeoJSON + simulation-result.json (served)
 data/
  vectors/            # 9 GeoJSON/CSV (committed)
  processed/          # cleaned + simulation (gitignored)
  rasters/ + raw/ + qgis/
 scripts/             # preprocess, load_postgis, simulate, test_modules
```

## How It Works (User View)

1. **Real City Data** - elevation, rainfall, streets
2. **Flood Simulation** - rain -> runoff -> flow
3. **Clear Insights** - depth and affected areas in 3D

No technical jargon exposed in the UI.

## Developer Modules (Internal)

| Module | Command | Output |
|--------|---------|--------|
| 1 Collect | audited | 9 vectors + 5 rasters, bounds 80.10/12.88-80.35/13.25 |
| 2 Preprocess | `python scripts/preprocess.py` | `data/processed/` cleaned |
| 3 Store | `docker compose up -d && python scripts/load_postgis.py` | 5 geometry + 5 raster tables |
| 4 Simulate | `python scripts/simulate.py` | `result.json` (Q, depth, flood_pct) |
| 5 Visualize | `npm run dev` | Next.js page with 3D + map |

## Production

- `next build` -> `.next/` static + SSR, chunked
- `npm run build` verifies TypeScript
- `python scripts/test_modules.py` validates data + scripts
