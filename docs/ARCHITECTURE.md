# ARCHITECTURE — Ledger Live (v4 · 18 Datasets · Dynamic Ward Damage)

```
User click 13.07,80.26 (1.5km) → aoi {xmin,xmax,ymin,ymax,center} + blendedP(P*0.6+live*0.4) via useChennaiLive 30s
 → reqId++ + AbortController (last click wins)
 → POST /query ST_Intersects? (pg) or fileFallback bbox → counts 7× covers/featureCount
 → POST /features 600 → 90-520 cap/basin via lngLatToXZ 14 → wardForLngLat→wardDamage(Q,pop) per building
 → POST /terrain geotiff Float32 bilinear cache 12-120 (sampleDemGrid) or chennaiTopography fallback
 → POST /simulate SCS-CN blendedP → S/Ia/Q + timeSeries 7×tanh*exp + floodDepth/velocity/affectedBuildings
 → cache 20 LRU key id-xmin/xmax/ymin/ymax-P-CN-t-viewMode
 → Three: disposeScene(controls/renderer) → createProScene OrbitControls(damping 0.08, 3-28, maxPolar 0.48π) → BASIN_PROFILE 6×7 terrain 72|90seg → wardProb buildings shared mats 1024 shadow → water Shader rippleCenter/Time caustics GPU → hover emissive #E6B422 tooltip + M measure dashed km + compass/scale + Rain 600 → render
 → Inspector terrain cell / building wardProb → risk, Evac detour 1.05-1.45, FloodML 8-ward bubble/heat, WebFlood 128² FBO
```

`@/* → ./*` alias. `app` Server (API `runtime nodejs` for geotiff) + Client (`"use client"` 3D via `next/dynamic ssr:false`). `design/tokens.json` DTCG → `globals.css` OKLCH (paper/ink/vermillion/hydro).

Cache: `key` includes `viewMode`, so `depth_heatmap ≠ hydrology`. Race: `if(current!==reqId) return` + `AbortError` silent.

Persist: `app/lib/db-schema.ts` `Map` + `tmp→rename` atomic `projects.json/scenarios.json` (git-kept via `!data/processed/*.json`).

PostGIS: `app/lib/postgis.ts` `try import("pg") catch null → fileFallbackQuery` manual bbox `ST_Intersects`. `raster.ts` `getRasterMeta` 5 candidates + `loadDem() geotiff fromFile→fromArrayBuffer fallback` `Float32` cache + `sampleDemBilinear tx/ty` + `sampleDemGrid 12-120` + `getDemAvailability()`.

Live: `hooks/useChennaiLive` `api.open-meteo.com 13.0827,80.2707` 30s + `hooks/useHydrology` `S/Ia/Q/economicLoss`.

3D perf: `72/90 seg + 64/40 water, 1024 shadow, shared LineBasic depthWrite:false, frustumCulled, GPU water, wards 201`.

Next: `BatchedMesh` (varied extrusions) + `Line2` width + `WebGPURenderer TSL` + `3D Tiles` LOD.
