# DEMO_SOURCES — 7 Github_demos Transplant

| Demo | Files | FLOIN Transplant | Location |
|---|---|---|---|
| `CrisisFlow` Deck.gl Bangalore Twin (README 18k, no code) | `README.md` STGCN + 5-role | `CrisisCommandCenter.tsx` 5-role GOV/POL/HOS/FIR/CIT + live `Open-Meteo 30s` | `evacuation` top |
| `WebFlood` GLOW FBO Iowa City (`simulation.js 6k + GLOW 78k + tiff.js`) | `g9.81 dt0.02 n0.04` shallow-water | `WebFloodEngine.tsx` 128² `Float32` `terrain/water/vel` `ImageData` depth `r6+220*d` | `hydrology` |
| `FloodML` Flask RF 98.7% (`app.py 4k + model.pickle 405k`) | bubble `r8+prob28` + heat `color-mix` | `FloodMLAnalytics.tsx` 8 wards `CHENNAI_WARDS` `wardFloodProb Q/80` | `hydrology` + `impact` |
| `WebGL-Fluid` `script.js 53k` | `splat` Navier-Stokes | `FloodSimulation` `rippleCenter/Time` `sin28*exp-6` | water shader |
| `webgl-water` `water.js 5.6k` | `FLOAT textureA/B` caustics | `waterMat` `pow(c1+c2,3)*0.35 + foam` | water frag |
| `flood-forecasting` LSTM | Handoff/ME LSTM | SCS `blendedP` badge (stretch) | `simulate` |
| `FloodPrediction` BS5 video | video hero anti-pattern | `DESIGN.md banned` (ledger, not video) | — |

**Data:** `COP-DEM GLO-30 s3://copernicus-dem-30m` (Open-Meteo, OpenTopography), `opencity.in 1901-2021` , `IMD api.imd.gov.in` fallback.

All 7 live in `Github_demos/` gitignored, transplanted as ledger `paper/ink` components.
