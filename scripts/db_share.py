"""FLOIN — share the spatial database over GitHub.

Companion to db/schema.sql (which defines the database) and scripts/load_postgis.py
(which fills it). This script moves a *materialised* database between machines and
GitHub without ever committing the database to git:

    verify    connect, then diff floin_expected_layers against what is really loaded
    dump      pg_dump -Fc  ->  db/dumps/floin-<utc>.dump  (+ .meta.json sidecar)
    restore   pg_restore --clean --if-exists --no-owner
    publish   gh release upload <tag> db/dumps/*.dump     (GitHub Releases, not git)
    pull      gh release download <tag>  then restore
    image     docker build -f db/Dockerfile  then push ghcr.io/<owner>/floin-postgis

Connection resolution, first hit wins:
    --db-url / DATABASE_URL / PG_CONN (host=… dbname=… user=…) / localhost default

Client resolution: `docker exec <container>` when the compose container is up (no local
PostgreSQL client needed), otherwise pg_dump/pg_restore/psql from PATH — including the
common Windows installs, same auto-detect trick as scripts/load_postgis.py.

Every subcommand accepts --dry-run: commands are printed, nothing is executed.
Exit code is non-zero when `verify` finds a layer missing, so CI can gate on it.
"""

import argparse
import datetime as dt
import hashlib
import json
import os
import pathlib
import shutil
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
DUMP_DIR = ROOT / "db" / "dumps"
GIT_SHA_CMD = ["git", "rev-parse", "--short", "HEAD"]

# Defaults are the repo's own values (see .env.example / docker-compose.yml).
REPO = os.environ.get("FLOIN_GH_REPO", "Senthil455/Floin")
CONTAINER = os.environ.get("FLOIN_DB_CONTAINER", "floin-postgis")
IMAGE = os.environ.get("FLOIN_DB_IMAGE", "ghcr.io/senthil455/floin-postgis")
DB_URL = os.environ.get("DATABASE_URL", "postgresql://floin:floin@localhost:5432/floin")
PG_CONN = os.environ.get("PG_CONN", "host=localhost dbname=floin user=floin password=floin")

VECTOR_LAYERS = [
    "buildings",
    "highway",
    "natural_water",
    "waterway",
    "rainfall_stations",
    "chennai2015_inundation",
    "chennai2015_hotspots",
    "chennai2015_flooded_streets",
]


def _augment_path() -> None:
    """Windows: pick up pg_dump/psql from the usual PostgreSQL installs."""
    if os.name != "nt":
        return
    bins = sorted(pathlib.Path("C:/Program Files/PostgreSQL").glob("*/bin")) + sorted(
        pathlib.Path("C:/Program Files (x86)/PostgreSQL").glob("*/bin")
    )
    extra = ";".join(str(p) for p in bins if p.is_dir())
    if extra:
        os.environ["PATH"] = extra + ";" + os.environ.get("PATH", "")


def sh(cmd, dry=False, capture=False) -> str:
    """Run one shell command, echoing it first (the load_postgis.py convention)."""
    print(f"$ {cmd}")
    if dry:
        return ""
    proc = subprocess.run(cmd, shell=True, capture_output=capture, text=True)
    if capture and proc.returncode != 0:
        print((proc.stderr or "").strip()[:400], file=sys.stderr)
    return (proc.stdout or "") if capture else ""


def docker_available() -> bool:
    return shutil.which("docker") is not None


def container_up() -> bool:
    if not docker_available():
        return False
    proc = subprocess.run(
        ["docker", "inspect", "-f", "{{.State.Running}}", CONTAINER],
        capture_output=True,
        text=True,
    )
    return proc.returncode == 0 and proc.stdout.strip() == "true"


def db_identity() -> tuple[str, str]:
    """(user, database) parsed from DATABASE_URL, falling back to PG_CONN."""
    url = DB_URL
    user = "floin"
    name = "floin"
    if "://" in url:
        rest = url.split("://", 1)[1]
        if "@" in rest:
            user = rest.split("@", 1)[0].split(":", 1)[0]
        name = rest.split("@")[-1].split("/", 1)[-1].split("?", 1)[0] or name
    else:
        for part in PG_CONN.split():
            if part.startswith("user="):
                user = part.split("=", 1)[1]
            elif part.startswith("dbname="):
                name = part.split("=", 1)[1]
    return user, name


def psql(sql: str, dry=False) -> str:
    """Run one SQL statement and return the raw stdout (tuples-only, unaligned)."""
    user, name = db_identity()
    flat = " ".join(sql.split())
    if container_up() or dry:
        cmd = f'docker exec -i {CONTAINER} psql -U {user} -d {name} -tA -c "{flat}"'
    else:
        cmd = f'psql -w "{DB_URL}" -tA -c "{flat}"'
    return sh(cmd, dry=dry, capture=True).strip()


def git_sha() -> str:
    proc = subprocess.run(GIT_SHA_CMD, cwd=ROOT, capture_output=True, text=True)
    return proc.stdout.strip() or "unknown"


def utc_stamp() -> str:
    return dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def layer_counts(dry: bool) -> dict:
    """Exact row counts — reltuples reports -1 on a never-analysed restore."""
    out = {}
    for layer in VECTOR_LAYERS:
        raw = psql(f"SELECT count(*) FROM public.{layer};", dry)
        out[layer] = int(raw) if raw.isdigit() else -1
    return out


def raster_tables(dry: bool) -> list:
    raw = psql(
        "SELECT coalesce(string_agg(r_table_name, ' '), '') "
        "FROM raster_columns WHERE r_table_schema = 'public';",
        dry,
    )
    return raw.split() if raw else []


# ---------------------------------------------------------------------------
# verify
# ---------------------------------------------------------------------------

def cmd_verify(args) -> int:
    dry = args.dry_run
    print("[db_share] verify — schema, layers, PostGIS version")

    version = psql("SELECT postgis_full_version();", dry)
    if not dry and not version:
        print("  ! no reply from the database")
        print("    local:  npm run db:up  &&  npm run db:load")
        print("    shared: npm run db:pull   (or pull the image — docs/DB_SHARING.md)")
        return 2
    if version:
        print(f"  postgis : {' '.join(version.split(' ')[:2])}")

    report_raw = psql(
        "SELECT coalesce(json_agg(row_to_json(r)), '[]'::json) FROM floin_db_report r;", dry
    )
    if not dry and not report_raw:
        print("  ! floin_db_report missing — db/schema.sql has not been applied here")
        print(f'    apply it:  psql "{DB_URL}" -f db/schema.sql')
        return 1

    rows = json.loads(report_raw) if report_raw else []
    counts = layer_counts(dry)
    rasters = raster_tables(dry)

    print()
    print(f"  {'layer':<30} {'role':<7} {'rows':>8}  {'srid':<5} geom")
    print(f"  {'-' * 30} {'-' * 7} {'-' * 8}  {'-' * 5} ----")
    missing = []
    for row in rows:
        name, role, present = row["layer_name"], row["layer_role"], row["table_present"]
        if role == "vector":
            n = counts.get(name, -1)
            if not present or n <= 0:
                missing.append(name)
            print(f"  {name:<30} {role:<7} {n:>8}  {row['srid'] or '-':<5} {row['actual_geom_type'] or '-'}")
        else:
            loaded = name in rasters
            if not loaded:
                missing.append(name)
            print(f"  {name:<30} {role:<7} {'-':>8}  {row['srid'] or '-':<5} {'raster' if loaded else 'MISSING'}")

    print()
    if missing:
        print(f"  {len(missing)} layer(s) not loaded: {', '.join(missing)}")
        print("  vector -> npm run db:load (or npm run db:pull); missing rasters are expected")
        print("  on a clean clone because data/rasters/*.tif is gitignored (see data/rasters/.gitkeep)")
        return 1
    print("  all expected layers present")
    return 0


# ---------------------------------------------------------------------------
# dump / restore
# ---------------------------------------------------------------------------

def newest_dump() -> pathlib.Path:
    dumps = sorted(DUMP_DIR.glob("*.dump"), key=lambda p: p.stat().st_mtime, reverse=True)
    if not dumps:
        raise SystemExit(f"no *.dump in {DUMP_DIR} — run `npm run db:dump` or `npm run db:pull` first")
    return dumps[0]


def sha256_of(path: pathlib.Path) -> str:
    digest = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def cmd_dump(args) -> int:
    dry = args.dry_run
    user, db = db_identity()
    DUMP_DIR.mkdir(parents=True, exist_ok=True)
    name = args.name or f"floin-{utc_stamp()}.dump"
    out = DUMP_DIR / name
    print("[db_share] dump — materialised database -> db/dumps (custom format, compressed)")

    if container_up():
        print(f"[db_share] client: docker exec {CONTAINER}")
        remote = f"/tmp/{name}"
        sh(f"docker exec {CONTAINER} pg_dump -U {user} -d {db} -Fc -f {remote}", dry)
        sh(f'docker cp {CONTAINER}:{remote} "{out}"', dry)
        sh(f"docker exec {CONTAINER} rm -f {remote}", dry)
    else:
        print("[db_share] client: pg_dump from PATH")
        sh(f'pg_dump -w "{DB_URL}" -Fc -f "{out}"', dry)

    meta = {
        "dump": name,
        "created_at": dt.datetime.now(dt.timezone.utc).isoformat(),
        "git_sha": git_sha(),
        "crs": "EPSG:4326",
        "postgis": "16-3.4",
        "vector_layers": layer_counts(dry) if not dry else {lyr: None for lyr in VECTOR_LAYERS},
        "raster_tables": raster_tables(dry) if not dry else None,
    }
    if not dry:
        meta["dump_bytes"] = out.stat().st_size
        meta["dump_sha256"] = sha256_of(out)
        meta_path = DUMP_DIR / f"{name}.meta.json"
        meta_path.write_text(json.dumps(meta, indent=1), encoding="utf-8")
        print(f"[db_share] wrote {out} ({meta['dump_bytes'] / 1024 / 1024:.1f} MB)")
        print(f"[db_share] wrote {meta_path}")
    print("[db_share] next: npm run db:publish   (uploads it as a GitHub Release asset)")
    return 0


def cmd_restore(args) -> int:
    dry = args.dry_run
    user, db = db_identity()
    src = pathlib.Path(args.file).resolve() if args.file else newest_dump()
    if not src.exists():
        raise SystemExit(f"dump not found: {src}")
    print(f"[db_share] restore — {src.name} -> {db} (dump ownership dropped: --no-owner)")

    if container_up():
        print(f"[db_share] client: docker exec {CONTAINER}")
        remote = f"/tmp/{src.name}"
        sh(f'docker cp "{src}" {CONTAINER}:{remote}', dry)
        sh(
            f"docker exec {CONTAINER} pg_restore --clean --if-exists --no-owner "
            f"-U {user} -d {db} {remote}",
            dry,
        )
    else:
        print("[db_share] client: pg_restore from PATH")
        sh(f'pg_restore -w --clean --if-exists --no-owner -d "{DB_URL}" "{src}"', dry)

    print("[db_share] next: npm run db:verify")
    return 0


# ---------------------------------------------------------------------------
# publish / pull  — GitHub Releases are the right home for a binary database:
# no git history growth, 2 GB per file, no Git LFS quota involved.
# ---------------------------------------------------------------------------

def cmd_publish(args) -> int:
    dry = args.dry_run
    src = pathlib.Path(args.file).resolve() if args.file else newest_dump()
    if not src.exists():
        raise SystemExit(f"dump not found: {src}")
    meta = src.with_suffix(src.suffix + ".meta.json")
    tag = args.tag or f"db-{dt.datetime.now(dt.timezone.utc).strftime('%Y%m%d')}"
    print(f"[db_share] publish — {src.name} -> GitHub Release '{tag}' on {REPO}")

    exists = False
    if not dry:
        exists = (
            subprocess.run(
                f'gh release view "{tag}" --repo {REPO}', shell=True, capture_output=True, text=True
            ).returncode
            == 0
        )

    notes = DUMP_DIR / f"{tag}.notes.md"
    if not dry:
        notes.write_text(
            f"FLOIN PostGIS 16-3.4 — Chennai flood-intelligence database.\n\n"
            f"- CRS EPSG:4326, geometry column `geom` (contract for app/api/location/*)\n"
            f"- asset: `{src.name}` (`pg_dump -Fc`) + `{meta.name}` sidecar\n"
            f"- restore: `npm run db:pull -- --tag {tag}`\n"
            f"- or by hand: `pg_restore --no-owner --dbname \"$DATABASE_URL\" {src.name}`\n"
            f"- git sha: {git_sha()}\n",
            encoding="utf-8",
        )
    if not exists:
        sh(f'gh release create "{tag}" --repo {REPO} --title "FLOIN DB {tag}" --notes-file "{notes}"', dry)
    payload = [str(src)] + ([str(meta)] if meta.exists() else [])
    sh(
        f'gh release upload "{tag}" ' + " ".join(f'"{p}"' for p in payload) + f" --repo {REPO} --clobber",
        dry,
    )
    print(f"[db_share] consumers: npm run db:pull -- --tag {tag}")
    return 0


def latest_db_release() -> str:
    proc = subprocess.run(
        f'gh release list --repo {REPO} --limit 50 --json tagName -q ".[].tagName"',
        shell=True,
        capture_output=True,
        text=True,
    )
    tags = [t for t in proc.stdout.split() if t.startswith("db-")]
    if not tags:
        raise SystemExit(f"no db-* release on {REPO} — publish one first: npm run db:publish")
    return tags[0]


def cmd_pull(args) -> int:
    dry = args.dry_run
    tag = args.tag or ("" if dry else latest_db_release())
    DUMP_DIR.mkdir(parents=True, exist_ok=True)
    print(f"[db_share] pull — GitHub Release '{tag or '<latest db-*>'}' -> db/dumps")
    sh(
        f'gh release download "{tag}" --repo {REPO} -p "*.dump" -p "*.meta.json" '
        f'-D "{DUMP_DIR}" --clobber',
        dry,
    )
    if args.no_restore:
        print("[db_share] --no-restore: dump downloaded, run `npm run db:restore` when ready")
        return 0
    if dry:
        print('$ restore <newest dump>   (skipped in dry-run: nothing was downloaded)')
        return 0
    return cmd_restore(argparse.Namespace(file=str(newest_dump()), dry_run=False))


# ---------------------------------------------------------------------------
# image — the whole database in one pull, nothing to build locally
# ---------------------------------------------------------------------------

def cmd_image(args) -> int:
    dry = args.dry_run
    tag = args.tag or "latest"
    print(f"[db_share] image — db/Dockerfile (schema + data baked in) -> {IMAGE}:{tag}")
    if IMAGE != IMAGE.lower():
        print(f"[db_share] WARN: GHCR requires a lowercase image path, got {IMAGE}")
    sh(f'docker build -f db/Dockerfile -t {IMAGE}:{tag} "{ROOT}"', dry)
    if args.no_push:
        print("[db_share] --no-push: built locally only")
        return 0
    sh(f"docker push {IMAGE}:{tag}", dry)
    print(f"[db_share] consumers: docker pull {IMAGE}:{tag}")
    return 0


def main() -> int:
    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("--dry-run", action="store_true", help="print commands, execute nothing")

    parser = argparse.ArgumentParser(
        prog="db_share.py",
        description="Share the FLOIN PostGIS database over GitHub (see docs/DB_SHARING.md)",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    p = sub.add_parser("verify", parents=[common], help="diff the live DB against floin_expected_layers")
    p.set_defaults(func=cmd_verify)
    p = sub.add_parser("dump", parents=[common], help="pg_dump -Fc into db/dumps + .meta.json")
    p.add_argument("--name", help="dump file name (default floin-<utc>.dump)")
    p.set_defaults(func=cmd_dump)
    p = sub.add_parser("restore", parents=[common], help="pg_restore a dump into the target DB")
    p.add_argument("--file", help="dump path (default: newest in db/dumps)")
    p.set_defaults(func=cmd_restore)
    p = sub.add_parser("publish", parents=[common], help="attach the dump to a GitHub Release")
    p.add_argument("--tag", help="release tag (default db-<YYYYMMDD>)")
    p.add_argument("--file", help="dump path (default: newest in db/dumps)")
    p.set_defaults(func=cmd_publish)
    p = sub.add_parser("pull", parents=[common], help="download a dump from a Release, then restore")
    p.add_argument("--tag", help="release tag (default: newest db-* release)")
    p.add_argument("--no-restore", action="store_true", help="download only")
    p.set_defaults(func=cmd_pull)
    p = sub.add_parser("image", parents=[common], help="build + push the prebuilt PostGIS image")
    p.add_argument("--tag", help="image tag (default latest)")
    p.add_argument("--no-push", action="store_true", help="build only")
    p.set_defaults(func=cmd_image)

    args = parser.parse_args()
    _augment_path()
    print(f"[db_share] db={db_identity()[1]} repo={REPO} client={'docker exec' if container_up() else 'PATH'}")
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
