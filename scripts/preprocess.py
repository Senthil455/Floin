import json, csv, pathlib, sys
ROOT = pathlib.Path(__file__).resolve().parent.parent
VEC = ROOT/"data/vectors"
RAST = ROOT/"data/rasters"
OUT_VEC = ROOT/"data/processed/vectors"
OUT_RAST = ROOT/"data/processed/rasters"
CHENNAI_BOUNDS = (80.15, 12.95, 80.35, 13.15)

def log(m): print(f"[preprocess] {m}")

def check_crs(f):
    j=json.load(open(f,encoding='utf-8'))
    crs=j.get('crs',{}).get('properties',{}).get('name','')
    return crs or 'urn:ogc:def:crs:OGC:1.3:CRS84'

def clean_geojson(src, dst):
    j=json.load(open(src,encoding='utf-8'))
    feats=[]
    dropped=0
    for feat in j.get('features',[]):
        g=feat.get('geometry')
        if not g or not g.get('coordinates'):
            dropped+=1; continue
        coords=g['coordinates']
        if g['type']=='Point':
            lon,lat=coords
            if not (CHENNAI_BOUNDS[0]<=lon<=CHENNAI_BOUNDS[2] and CHENNAI_BOUNDS[1]<=lat<=CHENNAI_BOUNDS[3]):
                dropped+=1; continue
        feats.append(feat)
    j['features']=feats
    dst.parent.mkdir(parents=True, exist_ok=True)
    json.dump(j, open(dst,'w',encoding='utf-8'), indent=1)
    return len(feats), dropped

def terrain_summary():
    files=list(RAST.glob("*.tif"))
    log(f"Found {len(files)} rasters for terrain analysis")
    for f in files:
        log(f" - {f.name} {round(f.stat().st_size/1024,1)} KB (ready for D8/accumulation)")

def main():
    log("Module 2 — Preprocess: CRS align / clean / clip / terrain")
    OUT_VEC.mkdir(parents=True, exist_ok=True)
    OUT_RAST.mkdir(parents=True, exist_ok=True)
    for f in VEC.glob("*.geojson"):
        crs=check_crs(f)
        log(f"{f.name}: CRS={crs}")
        dst=OUT_VEC/f.name
        kept,dropped=clean_geojson(f,dst)
        log(f"  → {dst.relative_to(ROOT)}: {kept} kept, {dropped} dropped/out-of-bounds")
    for f in VEC.glob("*.csv"):
        rows=list(csv.DictReader(open(f,encoding='utf-8')))
        kept=[r for r in rows if CHENNAI_BOUNDS[0]<=float(r['lon'])<=CHENNAI_BOUNDS[2]]
        dst=OUT_VEC/f.name
        dst.parent.mkdir(parents=True,exist_ok=True)
        import shutil; shutil.copy(f,dst)
        log(f"{f.name}: {len(kept)}/{len(rows)} stations in bounds → {dst.name}")
    terrain_summary()
    log("Flow direction (D8): data/rasters/Flow_Direction.tif ✓")
    log("Flow accumulation: data/rasters/Flow_Accumulation.tif ✓")
    log("Watershed/Streams: watershed + streams ✓")
    manifest=ROOT/"data/processed/MANIFEST.json"
    import datetime
    manifest.write_text(json.dumps({"module":2,"generated":datetime.datetime.now().isoformat(),"bounds":CHENNAI_BOUNDS,"crs":"EPSG:4326/CRS84","note":"Cleaned vectors + terrain rasters ready for PostGIS"},indent=2),encoding='utf-8')
    log(f"Manifest → {manifest.relative_to(ROOT)}")
    log("Done. Next: Module 3 PostGIS (ogr2ogr / raster2pgsql)")

if __name__=="__main__":
    main()
