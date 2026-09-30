import pathlib, subprocess, sys, json, os, shutil
ROOT = pathlib.Path(__file__).resolve().parent.parent
VEC = ROOT/"data/processed/vectors"
VEC_FALLBACK = ROOT/"data/vectors"
RAST = ROOT/"data/rasters"
RAST_COP = RAST/"rasters_COP30"
DB = os.environ.get("DATABASE_URL", "postgresql://floin:floin@localhost:5432/floin")
DB_PG = os.environ.get("PG_CONN", "host=localhost dbname=floin user=floin password=floin")

if os.name == "nt":
    # Auto-pick GDAL + PG client tools from common Windows installs
    # (QGIS ships ogr2ogr; EDB PostgreSQL ships psql; PostGIS adds raster2pgsql)
    qgis_bins = list(pathlib.Path("C:/Program Files").glob("QGIS*/bin"))
    pg_bins = (
        sorted(pathlib.Path("C:/Program Files/PostgreSQL").glob("*/bin"), reverse=True)
        + sorted(pathlib.Path("C:/Program Files (x86)/PostgreSQL").glob("*/bin"), reverse=True)
    )
    extra = ";".join([str(p) for p in qgis_bins + pg_bins if p.is_dir()])
    if extra:
        os.environ["PATH"] = extra + ";" + os.environ.get("PATH", "")

def need_tool(name):
    if not shutil.which(name):
        print(f"ERROR: required tool '{name}' not found in PATH")
        return False
    return True

def run(cmd, dry=False):
    """Run a command and report failure.

    A str goes through the shell (ogr2ogr and the raster2pgsql|psql pipeline need it).
    A list is executed directly, which is required for any command that *ends* in a
    quoted argument: cmd.exe strips the outermost quote pair of the whole line, so
    `psql "URL" -c "SQL"` arrives at psql as `-c SQL` split in two and the SQL is
    silently ignored ("extra command-line argument ... ignored").
    """
    printable = cmd if isinstance(cmd, str) else " ".join(
        f'"{c}"' if " " in str(c) else str(c) for c in cmd
    )
    print(f"$ {printable}")
    if dry: return True
    r=subprocess.run(cmd, shell=isinstance(cmd, str))
    if r.returncode != 0:
        print(f"WARN command failed with code {r.returncode}: {printable}")
    return r.returncode==0

def main(dry=False):
    print("[load_postgis] Module 3 -- Store & Organize")
    if dry: print("[dry-run] printing commands only")
    else:
        for tool in ["ogr2ogr","raster2pgsql","psql"]:
            need_tool(tool)
        # Options before the URL (psql <= 16 stops option parsing at the first positional
        # argument) and argv instead of a string, so the SQL survives cmd.exe quoting.
        psql = shutil.which("psql") or "psql"
        run([psql, "-c", "CREATE EXTENSION IF NOT EXISTS postgis;", DB], dry)
    vectors=[
        ("buildings","buildings.geojson"),
        ("highway","highway.geojson"),
        ("natural_water","natural_water.geojson"),
        ("waterway","waterway.geojson"),
        ("rainfall_stations","rainfall_stations.geojson"),
        ("chennai2015_inundation","chennai2015_inundation.geojson"),
        ("chennai2015_hotspots","chennai2015_hotspots.geojson"),
        ("chennai2015_flooded_streets","chennai2015_flooded_streets.geojson"),
    ]
    for table, fname in vectors:
        src = VEC/fname
        if not src.exists(): src = VEC_FALLBACK/fname
        if not src.exists():
            print(f"skip {fname} not found"); continue
        cmd = f'ogr2ogr -f PostgreSQL PG:"{DB_PG}" "{src}" -nln {table} -overwrite -lco GEOMETRY_NAME=geom -lco FID=id -lco SPATIAL_INDEX=GIST'
        run(cmd, dry)
    rasters={
        "dem": RAST_COP/"DEM.tif",
        "flow_direction": RAST/"Flow_Direction.tif",
        "flow_accumulation": RAST/"Flow_Accumulation.tif",
        "watershed": RAST/"Watershed.tif",
        "streams": RAST/"Streams.tif",
    }
    for table, src in rasters.items():
        if not src.exists():
            print(f"skip raster {table} not found: {src}"); continue
        cmd = f'raster2pgsql -s 4326 -I -C -M -t 256x256 "{src}" public.{table} | psql "{DB}"'
        run(cmd, dry)
    print("\nVector tables -> PostGIS geometry(geom), Raster tables -> raster(rast) + spatial index")
    print("Verify: psql floin -c \"\\d buildings; SELECT postgis_full_version();\"")

if __name__=="__main__":
    dry="--dry-run" in sys.argv or "-n" in sys.argv
    main(dry)
