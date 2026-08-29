import pathlib, subprocess, sys, json, os
ROOT = pathlib.Path(__file__).resolve().parent.parent
PUB = ROOT/"public"
VEC = ROOT/"data/processed/vectors"
RAST = ROOT/"data/rasters"
DB = "postgresql://floin:floin@localhost:5432/floin"

def run(cmd, dry=False):
    print(f"$ {cmd}")
    if dry: return True
    r=subprocess.run(cmd, shell=True)
    return r.returncode==0

def main(dry=False):
    print("[load_postgis] Module 3 — Store & Organize")
    if dry: print("[dry-run] printing commands only")
    cmds=[]
    vectors=[
        ("buildings","buildings.geojson"),
        ("highway","highway.geojson"),
        ("natural_water","natural_water.geojson"),
        ("waterway","waterway.geojson"),
        ("rainfall_stations","rainfall_stations.geojson"),
    ]
    for table, fname in vectors:
        src = VEC/fname
        if not src.exists(): src = ROOT/f"data/vectors/{fname}"
        if not src.exists(): 
            print(f"skip {fname} not found"); continue
        cmd = f'ogr2ogr -f PostgreSQL PG:"host=localhost dbname=floin user=floin password=floin" "{src}" -nln {table} -overwrite -lco GEOMETRY_NAME=geom -lco FID=id'
        cmds.append(cmd)
        run(cmd, dry)
    rasters=[
        ("dem","rasters_COP30/DEM.tif"),
        ("flow_direction","Flow_Direction.tif"),
        ("flow_accumulation","Flow_Accumulation.tif"),
        ("watershed","Watershed.tif"),
        ("streams","Streams.tif"),
    ]
    for table, rel in rasters:
        src = RAST/rel.split("/")[-1] if "/" not in rel else RAST.parent/rel
        src2 = ROOT/f"data/rasters/{rel.split('/')[-1]}"
        if (RAST/rel).exists(): src=RAST/rel
        elif (RAST.parent/rel).exists(): src=RAST.parent/rel
        elif src2.exists(): src=src2
        else:
            print(f"skip raster {rel}"); continue
        cmd = f'raster2pgsql -s 4326 -I -C -M -t 256x256 "{src}" public.{table} | psql "{DB}"'
        cmds.append(cmd)
        run(cmd, dry)
    print("\nVector tables → PostGIS geometry(geom), Raster tables → raster(rast) + spatial index")
    print("Verify: psql floin -c \"\\d buildings; SELECT postgis_full_version();\"")

if __name__=="__main__":
    dry="--dry-run" in sys.argv or "-n" in sys.argv
    main(dry)
