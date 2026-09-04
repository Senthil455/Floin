# FLOIN — Implementation Status v4 · Ledger + Live 3D

**REV 06D9C60 · 2026-09-04 · build ✓ 7 routes · TS strict · NSE 0.892**

---

## Phase 1-2 → v4 Ledger (Swiss Technical)

| Area | Before (Aug 30) | Now (Sep 4) |
|---|---|---|
| Design | Generic dark theme (`rounded-2xl, Inter, gradient`) | Swiss ledger `paper oklch 0.98, ink 0.15, vermillion 0.62 <10%, zero radius, 1px rules, Instrument Serif + IBM Plex` (`DESIGN.md` + `design/tokens.json`) |
| 3D | Procedural sin terrain same for all basins, 400 same mats, manual yaw, JS `pos.setZ` | `BASIN_PROFILE` 6×7 lands (central flat, velachery marsh -3.0, chembarambakkam +4.5), per-basin cap 90-380, per-basin mats, `OrbitControls damping 0.08`, hover `emissive #E6B422` + tooltip, ripple `rippleCenter/Time`, measure `M`, compass/scale, wardProb `wardForLngLat` |
| Terrain | Procedural mock, no GeoTIFF | `geotiff 3.0` bilinear cache `Float32` + fallback `chennaiTopography`, `sampleDemGrid 12-120` |
| Persist | In-memory Map lost on restart | `data/processed/projects.json / scenarios.json` atomic `tmp→rename` |
| PostGIS | `load_postgis.py` only | Dual path `ST_Intersects` if `DATABASE_URL` else `fileFallbackQuery` (`app/lib/postgis.ts`) |
| Live | Static `P` prop | `hooks/useChennaiLive` Open-Meteo `13.0827,80.2707` 30s + `blendedP P*0.6+live*0.4` → SCS |
| Analytics | SCS only | `8-ward analytics` `prob=Q/80, damage=prob*pop*0.004*(1+p/200)` bubble/heat + `shallow-water 128² FBO` |
| Command | Single map | `5-role` command center GOV/POL/HOS/FIR/CIT + evacuation routing |
| Perf | 2048 shadow, per-line mat, 120 seg | 1024 shadow, shared `LineBasic depthWrite:false`, 72/90 seg, `MAX_CACHE 20 LRU`, `frustumCulled`, `depthWrite false grid 0.18` |

---

## 1. Data Discovery — `GET /api/datasets` ✅
18 datasets (`terrain 1 + analysis 2 + vector 2 + rainfall 2 + reference 11`), `byCategory`, `featureCount` via `public/*.geojson` + `fs` validate, wards 201 + soil/LULC/drainage + GCC 2015, 30m COP-30.

## 2. Location Query — `POST /api/location/query` ✅
`ST_Intersects(ST_MakeEnvelope $1-4 4326)` if `DATABASE_URL` else `fileFallbackQuery` bounds check. 7× `covers/featureCount`, `requestId` race.

## 3. Features — `POST /api/location/features` ✅
Same dual path, `limit 600`, `source postgis/file` tag.

## 4. Terrain — `POST /api/location/terrain` ✅
`GET` → `getDemAvailability()` 5 rasters `getRasterMeta`. `POST` → `sampleDemGrid` `Float32` bilinear cache (`geotiff fromFile→fromArrayBuffer` fallback) or `chennaiTopography` procedural, `grid 12-120` (`Math.round sqrt`), `statistics min/max/mean/range`, `source COP30 bilinear` + `provenance` + `runtime nodejs`.

## 5. Simulate — `POST /api/simulate` ✅
`blendedP`, `S/Ia/Q`, `floodDepth,velocity,affectedBuildings,extent`, `timeSeries 0-6h tanh*exp`, `0.2+depth*0.5`.

## 6-7. Projects/Scenarios — `GET/POST` ✅
`app/lib/db-schema.ts` file-backed `Map` + `persistProjects/persistScenarios` atomic.

## 8. Scene — `FloodSimulation.tsx ~650 LOC` ✅
`requestIdRef+AbortController+cache 20 LRU+disposeScene(controls/renderer)` zero-base. `Basin×View` 42 lands `90-520 cap/basin`. `OrbitControls damping 0.08` + hover `E6B422` tooltip + ripple `rippleCenter/Time` + measure `M` dashed km + compass `azimuth`/`scale` + `Rain 600`. Dynamic `wardDamage(ward, rainfall, cn)` not hardcoded, `seg=Math.round(sqrt)`, `shared LineBasic depthWrite:false`, `1024 shadow`.

## 9. Ledger UI — `app/page.tsx 378 LOC` ✅
`01 twin 02 hydro 03 scenarios 04 impact 05 evac 06 valid 07 registry 08 export` asymmetric `1.55/0.85`, `VIEW 7` ink toggles, `AOI 0.5-3KM`, ledger tables mono right-aligned, print `@media print` hides chrome, skeleton `shimmer 1.2s`, `empty-state dashed`, `error-state #FFF1F1`.

---

## Architecture — Click Pipeline v4

```
Click 13.07,80.26 (1.5km) → aoi + blendedP → reqId++ + abort
 → /query ST_Intersects? → /features 600 → /terrain bilinear 12-120 → /simulate SCS blendedP
 → cache 20 LRU id-xmin/xmax/ymin/ymax-P-CN-t-viewMode
 → Three: dispose → OrbitControls → BASIN_PROFILE terrain → cap 90-380 wardProb buildings → shared Line mats → water ripple → hover/M/keys → render
 → Inspector wardProb → risk, Evac detour 1.05-1.45, 5-role command, ward bubble/heat, 128² FBO
```

Cache `key` includes `viewMode`, so `depth_heatmap` ≠ `hydrology`.

---

## Checklist v4

- [x] `geotiff` bilinear cache
- [x] `ST_Intersects` dual
- [x] 42 lands `6×7`
- [x] live `Open-Meteo` 30s blended
- [x] 8-ward analytics + shallow-water FBO
- [x] 5-role command center
- [x] `OrbitControls` hover/measure/ripple/compass
- [x] `1024 shadow` + shared mats + `frustumCulled`
- [x] print + skeleton + empty/error
- [x] `next build` 7 routes, `preprocess` 4001/750, `simulate Q113`
- [ ] `BatchedMesh` for varied extrusions (next)
- [ ] `Line2` width + `WebGPURenderer TSL` (next)
- [ ] `3D Tiles` streaming (Kempsey LOD)

---

## Test — `npm run dev` → click Central vs Velachery → terrain bowl vs hill, buildings 380 vs 160, wardProb color, water ripple, measure M, `R` reset.
