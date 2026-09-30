# QUICK REFERENCE — Ledger

> Verified `2026-09-30` · `main 077079e` · 9 routes · 303 registry entries · `data/vectors/` 331 files · `public/` ~320 GeoJSON

**Start:** `npm install && npm run dev` → `http://localhost:3000` `REV 077079e` · `npm run build` 9 routes · `python scripts/preprocess.py && python scripts/simulate.py --P 160 --CN 84 --t 60` · `docker compose up -d`

**01 Twin:** click map (1.5km AOI 0.5-3KM) → `VIEW 7` ink toggles → `03 WEBGL` drag orbit/wheel/shift-pan, hover `E6B422` tooltip, click ripple, `M` measure, `R/F`, `0-6H` hydrograph, `P/CN/t` sliders, `Q/depth/velocity/bldgs` ledgers.

**02 Hydro:** `S=25400/CN-254, Q=(P-Ia)²/(P+0.8S)` mono + `RESERVOIR 4` + `shallow-water 128²` + `ward bubble/heat`.

**03 Scenarios:** `+ SAVE` → rail 280px + `DELTA MATRIX` `P/CN/Q/depth` `SIM 3D`.

**04 Impact:** `LOSS ₹Cr` vermillion + `ward analytics` + `ASSET INVENTORY` `FOCUS →`.

**05 Evac:** `5-role command` live `Open-Meteo 30s` + `Evac` detour `1.05-1.45`.

**06 Valid:** `327 hotspots 7,894 streets NSE 0.892` ledger `4` 0.892 hydro.

**07 Registry:** `303 registry entries` ledger table `type·count·crs / source` (wards 201 + soil/LULC/drainage + GCC 2015 + UNOSAT).

**08 Export:** `OPEN LEDGER` (print `Ctrl+P` 1px) + `DOWNLOAD GEOJSON` `EPSG:4326`.

**API:** `GET /datasets 303` `POST /query ST_Intersects?` `POST /features 600` `GET/POST /terrain geotiff bilinear Float32` `POST /bathtub` `POST /simulate blendedP` `POST /predict` `projects/scenarios` file (created on first POST).

**Live:** `P*0.6+live*0.4` `Open-Meteo 13.0827,80.2707` 30s.

**Perf:** `90-520 cap/basin`, `1024 shadow`, `shared Line depthWrite:false`, `frustumCulled`.

**Docs:** `README` `DESIGN.md` `docs/ARCHITECTURE,API,DATA,DATA_AUDIT,DATA_COLLECTION,DB_SHARING,PREDICTION,3D` `DEPLOYMENT v5` `TEST_GUIDE 12` `IMPLEMENTATION v5`.
