# FLOIN — Deployment Summary v4 · Ledger Live

**REV 06D9C60 · 2026-09-04 · 7 routes · `geotiff 3.0` · `PostGIS 16` · `OrbitControls`**

## What Shipped Since v1 (Aug 30)

| v1 | v4 |
|---|---|
| Dark slop `Inter, rounded-2xl, cyan glow` | Swiss ledger `paper/ink/vermillion 0 radius, Instrument+IBM Plex` (`DESIGN.md`) |
| Procedural terrain same everywhere | `BASIN_PROFILE 6` + `geotiff bilinear Float32 cache` + 42 lands `6×7` |
| In-memory Map lost on restart | `projects.json / scenarios.json` atomic |
| No PostGIS at runtime | Dual `ST_Intersects` + `fileFallback` (`postgis.ts`) |
| Static P | `blendedP P*0.6+live*0.4` `Open-Meteo 13.0827,80.2707 30s` |
| Manual yaw/pitch, JS water `pos.setZ` | `OrbitControls damping 0.08` + hover `E6B422` tooltip + ripple `rippleCenter/Time` + measure `M` + compass/scale |
| Per-line `LineBasic` + 2048 shadow | Shared `LineBasic depthWrite:false` + 1024 shadow + `frustumCulled` |
| SCS only | + `shallow-water 128² FBO` + `8-ward analytics` + `5-role command` |
| No print | `@media print` ledger 1px black + skeleton shimmer |

## Build

```
npm run build → ✓ 7 routes (datasets, query, features, terrain GET+POST, simulate, projects, scenarios)
                TS strict 0, Turbopack 4.5s, validator.ts
python scripts/preprocess.py → 4001 inundation, 750 stagnation, 555 water (clipped 80.10/12.88-80.35/13.25)
python scripts/simulate.py --P 160 --CN 84 --t 60 → Q113.72 depth1.76 93.3% 3359/16384
docker compose up -d -- health pg_isready 5s×10, raster2pgsql 256x256
```

## API — 7 + Live

`GET /datasets 13` · `POST /query ST_Intersects?` · `POST /features 600` · `GET /terrain 5 rasters` · `POST /terrain bilinear 12-120` · `POST /simulate blendedP 6h tanh` · `projects/scenarios` file-backed.

## 3D — Instrument

`Plane 14 72|90 + Plane 13.4 64|40` `Shader caustics+foam+ripple` GPU-only, `400 cap per basin` `wardProb` → `infrastructure_impact/depth_heatmap`, `OrbitControls 3-28`, `Rain 600 drops`.

## Env

`.env.example` templated `POSTGRES_PASSWORD`, `docker-compose env_file`, `.env` gitignored, `!data/processed/*.json` kept.

## Next

`BatchedMesh` + `Line2` + `WebGPURenderer TSL` + `3D Tiles LOD`.
