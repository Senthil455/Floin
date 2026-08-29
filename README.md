# FLOIN — 3D Flood Simulation Platform

```
Floin/                 ← main folder (this repo)
├── index.html         ← Vite entry
├── src/               ← Three.js + Leaflet app
│   ├── main.js
│   └── style.css
├── public/            ← static (favicon, GeoJSON copies for dev)
├── data/              ← all project data (organized)
│   ├── vectors/       ← curated GeoJSONs (committed)
│   │   ├── buildings.geojson (1,811)
│   │   ├── highway.geojson
│   │   ├── natural_water.geojson (555)
│   │   └── waterway*.geojson
│   ├── rasters/       ← DEM / Flow_* / Watershed (local, gitignored *.tif)
│   ├── qgis/          ← .qgz projects (local)
│   ├── raw/           ← OSM PBF, SRTM zips, tars (local, gitignored)
│   └── tEAM fLOIN.pdf ← proposal (local)
├── package.json
└── vite.config.js (implicit)
```

## Run
```
npm install
npm run dev   # http://localhost:5173
npm run build
```

## Modules
1. **Collect** — SRTM DEM + IMD rainfall + OSM vectors → `data/vectors` & `data/rasters`
2. Preprocess (QGIS) → 3. Store (PostGIS) → 4. Simulate (Python) → 5. Visualize (Three.js)
Currently focused on **Module 1** — see `/#module1` live layer explorer.
