# DB SHARING — how the spatial database travels over GitHub

> Last verified `2026-09-30`. Expected layers: 8 vectors + 5 rasters = 13 (`db/schema.sql` + `floin_expected_layers`). Local TIFFs cleaned 2026-09-30; rebuild via image/dump or re-drop TIFFs into `data/rasters/`.

> The database is a **build product**, not source. `data/vectors/*.geojson` + `data/rasters/*.tif`
> are the inputs, `db/schema.sql` + `scripts/load_postgis.py` are the recipe, and the materialised
> PostGIS instance is distributed as **artifacts** (GitHub Releases + GHCR), never as git content.

---

## 01 // The decision — what was rejected and why

| Option | Verdict | Why |
|---|---|---|
| Commit `pgdata/` (the Postgres data directory) | **rejected** | Not portable: `initdb` layouts differ per OS/arch, opaque binary files, one commit per checkpoint, tens of thousands of files, huge history. A clone can't even start it reliably. |
| Commit a `pg_dump` into the repo (`db/floin.dump`) | **rejected** | Binary blob in history: no diff/review, every refresh adds a new full copy forever (dumps don't delta), 100 MB hard file limit. |
| Git LFS for the dump | **rejected** | Works, but taxes every clone with an LFS install + 1 GB free quota on the whole repo, to version an artifact that is regenerated, not edited. |
| **Versioned schema + loader in git** | **adopted** | ≈10 KB of reviewable SQL (`db/schema.sql`) that defines the contract, plus the existing `scripts/load_postgis.py`. Deterministic rebuild, pull-request friendly. |
| **`pg_dump -Fc` as a GitHub Release asset** | **adopted** | 2 GB/file, outside git history, versioned by tag, fetchable with `gh`/`curl`. `npm run db:publish` / `npm run db:pull`. |
| **Prebuilt PostGIS image on GHCR** | **adopted** | `docker pull ghcr.io/senthil455/floin-postgis:latest` → a running loaded database in one step, and it is **the only way to share the raster layers** (`data/rasters/*.tif` is gitignored). |
| Managed PostGIS (Supabase/Neon/Aiven…) for *one live* DB everyone points at | **optional** | Only if you want a single running instance instead of copies. Put the URL in a secret/`.env`, never in git — see §07. |

**Rule of thumb:** the more materialised the database is, the less it belongs in git.

---

## 02 // What ships where

| Artifact | Home | Tracked in git | Contains |
|---|---|---|---|
| `db/schema.sql` | repo | yes | PostGIS extension, `floin_meta`, `floin_expected_layers`, 8 vector skeletons + GIST, `floin_ingest_log`, `floin_db_report`, read grants |
| `data/vectors/*.geojson` | repo | yes (331 files, ~110 MB) | every vector layer's input data |
| `data/rasters/rasters_COP30/DEM.tif` + 4 derived `.tif` | **local disk only** | no (`.gitignore`) | raster layers `dem`, `flow_direction`, `flow_accumulation`, `watershed`, `streams` |
| `db/Dockerfile`, `db/bootstrap-load.sh` | repo | yes | the prebuilt image: schema + data baked in, loads on first boot |
| `.github/workflows/db.yml` | repo | yes | builds → boots → verifies → dumps → publishes |
| `db/dumps/*.dump` + `*.meta.json` | **Release asset** | no (`db/dumps/` ignored) | full database, `pg_dump -Fc` + sha256/row-count sidecar |
| `ghcr.io/senthil455/floin-postgis` | GHCR | n/a | the same database as a container image |

Consequence to be explicit about: **a clean clone rebuilds a vector-only database.** The five raster
layers arrive only through a locally built image or a dump produced on a machine that has the TIFFs.
`npm run db:verify` reports them as a *note*, and only `--strict` turns that into a failure.

---

## 03 // Consume the database

**A — rebuild locally from the repo (no artifacts, vector-only)**

```bash
docker compose up -d          # PostGIS 16-3.4, schema auto-applied from db/schema.sql
npm run db:load               # ogr2ogr + raster2pgsql via scripts/load_postgis.py
npm run db:verify             # row counts, SRID, layer presence
```

**B — pull the prebuilt image (everything, including rasters, if it was built where the TIFFs live)**

```bash
docker pull ghcr.io/senthil455/floin-postgis:latest
docker run -d --name floin-postgis -e POSTGRES_PASSWORD=floin -p 5432:5432 \
  ghcr.io/senthil455/floin-postgis:latest
npm run db:verify
```

**C — restore a shared dump (no Docker build, works with any PostGIS)**

```bash
npm run db:pull                      # newest db-* release -> db/dumps + pg_restore
npm run db:pull -- --no-restore      # download only, restore later with npm run db:restore
```

Restores always use `--no-owner`, so a dump published by one role loads cleanly into another; the
grant block at the end of `db/schema.sql` re-exposes the data to the `floin` application role.

---

## 04 // Publish the database

```bash
npm run db:dump                      # db/dumps/floin-<utc>.dump + .meta.json (sha256, row counts, git sha)
npm run db:publish                   # -> GitHub Release tag db-<YYYYMMDD>
npm run db:publish -- --tag db-2026-09  # explicit tag
npm run db:image                     # build db/Dockerfile locally + push to GHCR
npm run db:image -- --tag db-2026-09 --no-push   # build only
```

Everything supports `--dry-run` (`npm run db:dump -- --dry-run`): commands are printed, nothing runs.

CI does the same on its own for every change to `db/**`, `scripts/**`, `data/vectors/**`:
build image → boot → wait for the first-boot load → `npm run db:verify` → `npm run db:dump` →
upload the dump as a workflow artifact. Image push to GHCR and Release attachment happen on **tags**
or a manual `workflow_dispatch` with `publish=true` (keeps `main` from churning images).

---

## 05 // The contract the app depends on

`app/api/location/query/route.ts:90` and `app/api/location/features/route.ts:14` run:

```sql
SELECT ST_AsGeoJSON(geom)::json AS geometry, row_to_json(t) - 'geom' AS props
  FROM <table> t
 WHERE ST_Intersects(geom, ST_MakeEnvelope($1,$2,$3,$4,4326))
```

so any shared database must keep:

| Requirement | Where it is guaranteed |
|---|---|
| a column named `geom` | `db/schema.sql` vector skeletons, `ogr2ogr -lco GEOMETRY_NAME=geom`, `raster2pgsql` raster tables |
| SRID 4326 | `geometry(Geometry, 4326)` typmod, `raster2pgsql -s 4326`, `floin_meta.crs` |
| the 8 vector table names | `TABLE_MAP` in both routes ↔ `floin_expected_layers` (checked by `npm run db:verify`) |
| queryable without PostGIS | `app/lib/postgis.ts` `tryPostGISQuery()` → `fileFallbackQuery()` reads `public/<id>.geojson`; `source` in the response tells you which path answered |

`GET /api/location/terrain` reports `postgisConfigured` from the mere presence of `DATABASE_URL`
(`app/lib/raster.ts:22`) — it does **not** probe the server, so a stale `DATABASE_URL` shows
`true` while every feature request still answers `source: "file"`. `npm run db:verify` is the
honest check.

---

## 06 // Verify + troubleshooting

```bash
npm run db:verify                 # vectors must be loaded; missing rasters are a note
npm run db:verify -- --strict     # rasters count too (use before publishing an image/dump)
```

| Symptom | Cause | Fix |
|---|---|---|
| `role "floin" does not exist` in the Next.js log, responses say `source: "file"` | `DATABASE_URL` points at a database that was never created | `npm run db:up` + `npm run db:load`, or comment out `DATABASE_URL` in `.env.local` to silence it |
| `db_share.py verify` → `floin_db_report missing` | `db/schema.sql` not applied | `psql "$DATABASE_URL" -f db/schema.sql` |
| `db_share.py verify` → vectors `0 rows` | schema applied, data not loaded | `npm run db:load` (or `npm run db:pull`) |
| rasters `MISSING` | TIFFs are gitignored, so CI-built images are vector-only | drop the TIFFs into `data/rasters/` and `npm run db:image` |
| `pg_dump: command not found` | no local PostgreSQL client | keep the compose container up — `db_share.py` then uses `docker exec floin-postgis` |

---

## 07 // One live shared database (optional)

If the team should point at a *single running* instance instead of copies, host PostGIS on a managed
service (Supabase, Neon, Aiven, RDS) and share only the connection string out of band:

```bash
# .env.local — never committed (.gitignore: .env*)
DATABASE_URL=postgresql://floin:…@db.example.com:5432/floin
```

- apply the shared schema once: `psql "$DATABASE_URL" -f db/schema.sql`
- CI: store it as the `DATABASE_URL` **secret**, not in a committed file
- publish snapshots from it with `npm run db:dump && npm run db:publish`
- rotating credentials means rotating the secret — nothing in git changes

Reviewers can always check what such an instance contains with `npm run db:verify`.

---

## 08 // Files added for this

| File | Role |
|---|---|
| `db/schema.sql` | canonical, idempotent DDL — also the compose init script |
| `db/Dockerfile` | prebuilt GHCR image (GDAL + schema + data baked in) |
| `db/bootstrap-load.sh` | first-boot load inside that image (`FLOIN_SKIP_LOAD=1` to skip) |
| `scripts/db_share.py` | `verify` / `dump` / `restore` / `publish` / `pull` / `image` |
| `.github/workflows/db.yml` | build → load → verify → dump → publish |
| `data/rasters/.gitkeep` | keeps the (ignored) raster dir present so `db/Dockerfile` can `COPY` it |
