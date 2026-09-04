# QUICK REFERENCE — Ledger

**Start:** `npm install && npm run dev` → `http://localhost:3000` `REV 06D9C60` · `npm run build` 7 routes · `python scripts/preprocess.py && python scripts/simulate.py --P 160 --CN 84 --t 60` · `docker compose up -d`

**01 Twin:** click map (1.5km AOI 0.5-3KM) → `VIEW 7` ink toggles → `03 WEBGL` drag orbit/wheel/shift-pan, hover `E6B422` tooltip, click ripple, `M` measure, `R/F`, `0-6H` hydrograph, `P/CN/t` sliders, `Q/depth/velocity/bldgs` ledgers.

**02 Hydro:** `S=25400/CN-254, Q=(P-Ia)²/(P+0.8S)` mono + `RESERVOIR 4` + `WebFlood 128²` + `FloodML bubble/heat`.

**03 Scenarios:** `+ SAVE` → rail 280px + `DELTA MATRIX` `P/CN/Q/depth` `SIM 3D`.

**04 Impact:** `LOSS ₹Cr` vermillion + `FloodML` + `ASSET INVENTORY` `FOCUS →`.

**05 Evac:** `Crisis 5-role` live `Open-Meteo 30s` + `Evac` detour `1.05-1.45`.

**06 Valid:** `327 hotspots 7,894 streets NSE 0.892` ledger `4` 0.892 hydro.

**07 Registry:** `7 datasets` ledger table `type·count·crs / source`.

**08 Export:** `OPEN LEDGER` (print ` Ctrl+P` 1px) + `DOWNLOAD GEOJSON` `EPSG:4326`.

**API:** `GET /datasets 13` `POST /query ST_Intersects?` `POST /features 600` `GET/POST /terrain geotiff` `POST /simulate blendedP` `projects/scenarios` file.

**Live:** `P*0.6+live*0.4` `Open-Meteo 13.0827,80.2707`.

**Perf:** `400 cap per basin`, `1024 shadow`, `shared Line`.

**Docs:** `README` `DESIGN.md` `docs/ARCHITECTURE,API,DATA,3D,DEMO_SOURCES` `DEPLOYMENT v4` `TEST_GUIDE 12` `IMPLEMENTATION v4`.
