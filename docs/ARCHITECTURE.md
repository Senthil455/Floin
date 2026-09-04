# ARCHITECTURE — Ledger Live

```
User click 13.07,80.26 (1.5km) → aoi {xmin,xmax,ymin,ymax,center} + blendedP(P*0.6+live*0.4)
 → reqId++ + AbortController
 → POST /query ST_Intersects? → /features 600 (400 cap per basin) → /terrain bilinear 12-120 → /simulate SCS blendedP 6h tanh
 → cache 20 LRU id-xmin/xmax/ymin/ymax-P-CN-t-viewMode
 → Three: dispose(controls/renderer/measureLine) → OrbitControls(damping 0.08) → BASIN_PROFILE 6×7 terrain → wardProb buildings (shared Line mats, 1024 shadow) → water rippleTime+caustics → hover/M/keys → render
```

`@/* → ./*` alias. `app` Server (API) + Client (`"use client"` 3D). `design/tokens.json` DTCG → `globals.css` OKLCH.

Cache: `key` includes `viewMode`, so `depth_heatmap ≠ hydrology`. Race: `if(current!==reqId) return`.

Persist: `app/lib/db-schema.ts` `Map` + `tmp→rename` atomic `projects.json/scenarios.json` (git-kept via `!`).

PostGIS: `app/lib/postgis.ts` `try import("pg") catch null → fileFallbackQuery` bbox manual. `raster.ts` `loadDem() geotiff fromFile` `Float32` cache + `sampleDemBilinear` tx/ty + `sampleDemGrid`.

Live: `hooks/useChennaiLive` `api.open-meteo.com 13.0827,80.2707` 30s.

3D perf: `72/90 seg + 64/40 water, 1024 shadow, shared Line depthWrite:false, frustumCulled, GPU water`.

Next: `BatchedMesh` + `Line2` + `WebGPURenderer` + `3D Tiles`.
