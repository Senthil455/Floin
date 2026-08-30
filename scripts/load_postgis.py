import pathlib, subprocess, sys, json, os, shutil
ROOT = pathlib.Path(__file__).resolve().parent.parent
VEC = ROOT/"data/processed/vectors"
VEC_FALLBACK = ROOT/"data/vectors"
RAST = ROOT/"data/rasters"
RAST_COP = RAST/"rasters_COP30"
DB = os.environ.get("DATABASE_URL", "postgresql://floin:floin@localhost:5432/floin")
DB_PG = os.environ.get("PG_CONN", "host=localhost dbname=floin user=floin password=floin")

def need_tool(name):
    if not shutil.which(name):
        print(f"ERROR: required tool '{name}' not found in PATH")
        return False
    return True

def run(cmd, dry=False):
    print(f"$ {cmd}")
    if dry: return True
    r=subprocess.run(cmd, shell=True)
    if r.returncode != 0:
        print(f"WARN command failed with code {r.returncode}: {cmd}")
    return r.returncode==0

def main(dry=False):
    print("[load_postgis] Module 3 -- Store & Organize")
    if dry: print("[dry-run] printing commands only")
    else:
        for tool in ["ogr2ogr","raster2pgsql","psql"]:
            need_tool(tool)
        run(f'psql "{DB}" -c "CREATE EXTENSION IF NOT EXISTS postgis;"', dry)
    vectors=[
        ("buildings","buildings.geojson"),
        ("highway","highway.geojson"),
        ("natural_water","natural_water.geojson"),
        ("waterway","waterway.geojson"),
        ("rainfall_stations","rainfall_stations.geojson"),
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
