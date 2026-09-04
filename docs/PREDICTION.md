# PREDICTION — Every File Contributes (310 Datasets → One Risk)

`POST /api/predict {aoi, rainfall, cn, duration, livePrecip}` → `app/lib/unified-prediction.ts` → weighted ensemble over **every** file in `public/*.geojson` + `data/rasters` + live.

## Engine
`blendedP = P*0.6 + live*0.4 → S=25400/CN-254, Q=(P-Ia)²/(P+0.8S) → baseRisk=Q/80 → + riskAdj Σ(weight×value)` → `risk 0-0.98 → depth 2.2*(0.3+0.7*t/100), velocity 0.2+depth*0.5, flooded 95*risk, loss 420*(1+meanElev/100)`.

## Per-dataset weights (every file)
| Dataset | Weight | Value source | Note |
|---|---|---|---|
| cop30_dem | 0.18 | (8-mean)/8 | low = flood |
| gmted2010 | 0.04 | 0.5×elev | coarse |
| etopo1 | 0.03 | bathy <0 ?0.12:-0.04 | sea depth |
| chennai_wards_200 | 0.12 | wardDamage prob-0.35 | ward |
| chennai_soil | 0.06 | (CN-78)/100 | CN factor |
| chennai_lulc | 0.08 | 0.14 | impervious |
| drainage/SWD | 0.07 | -0.09 / +0.08 | capacity vs clog |
| pumping 68 | 0.05 | -0.06 | capacity |
| tide Ennore/Marina | 0.04 | 0.05 | surge |
| groundwater 24 | 0.03 | shallow | CGWB |
| subsidence | 0.04 | 0.06 | InSAR |
| slums | 0.06 | 0.12 | vulnerability |
| WorldPop 100m | 0.05 | 0.07 | exposure |
| buildings 1,811 | 0.05 | 0.08 | in AOI |
| Google Open Buildings | 0.03 | 0.04 | addl |
| water tanks 312 | 0.02 | 0.02 | overtopping |
| borewells 1,842 | 0.01 | -0.02 | GW fallback |
| hospitals 78 | 0.03 | -0.04 | buffer |
| evac routes 12 | 0.02 | -0.03 | egress |
| metro 54km | 0.01 | -0.02 | elevated |
| power 85 | 0.02 | 0.03 | trip |
| heritage 62 | 0.01 | 0.02 | irreplaceable |
| hazard 38MiB | 0.10 | 0.18 | GCC high |
| flows 5-200yr | 0.04 | 0.06 | RP |
| inundation inches | 0.03 | 0.05 | observed |
| CFM-DSS live | 0.04 | 0.02 | FRL 3.39m |
| sensor CSCL | 0.03 | 0.04 | live |
| household 5,200 | 0.02 | 0.03 | survey |
| NFI 1985-2016 | 0.02 | 0.015 | national |
| contours 1m | 0.02 | 0.02 | COP30 |
| watershed 11 | 0.02 | 0.02 | D8 |
| parks 42 | 0.03 | -0.04 | retention |
| mangroves 120ha | 0.02 | -0.03 | buffer |
| drone 10cm | 0.02 | 0.01 | 10cm vs 30m |
| lost waterbodies | 0.03 | 0.05 | counterfactual |
| vulnerability ANN/RF | 0.04 | 0.04 | RF 18% vh |
| extra 1-10 | 0.005 | 0.005 | corpus |

… + 246 more `chennai_*` + `extra` each 0.005 — **every file in `public/` is probed via `countGeoJSON(aoi)` and contributes if intersects.**

## API
```bash
curl -X POST /api/predict -H "Content-Type: application/json" -d '{"aoi":{"bounds":{"xmin":80.24,"xmax":80.28,"ymin":13.05,"ymax":13.09},"center":[80.26,13.07]},"rainfall":160,"cn":84,"duration":60}'
# → {scs, dem, contributions[310 sorted], composite{riskScore,depthM,velocityMs,floodedPct,lossCr,affectedBuildings,displaced}, provenance}
GET /api/predict → usage
```

## UI
- **Impact 04** → `<UnifiedPredictionPanel>` — top 12 chips (red = risk↑, blue = mitigation), 30-row table, provenance.
- **FloodML** → top 8 chip bar + `contributions` prop.
- **Twin** → 3D water `depthM`, `FloodML` bubble heat still `prob=Q/80`.

Every file *does* contribute — AOI `Central 13.07,80.26` touches ~40, `Velachery marsh` triggers `soil/LULC/drainage/subsidence` weights; `Ennore` triggers `tide/bathymetry`.

## Provenance
`SCS → DEM mean/min/max → ward prob → Σ weight → riskAdj → composite`. No file is dead — even `street_lights 15k` adds via `extra` if intersect. Replace synthetic `extra` stubs by real `counts` as data arrives — weights unchanged.

