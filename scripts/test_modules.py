import json, pathlib, sys
ROOT = pathlib.Path(__file__).resolve().parent.parent
def test_vectors():
    for p in (ROOT/"data/vectors").glob("*.geojson"):
        j=json.load(open(p,encoding='utf-8'))
        assert "features" in j, f"{p.name} missing features"
        assert len(j["features"])>0, f"{p.name} empty"
    print("vectors: OK")
def test_rasters():
    for p in (ROOT/"data/rasters").glob("*.tif"):
        assert p.stat().st_size>0
    assert (ROOT/"data/rasters/rasters_COP30/DEM.tif").exists()
    print("rasters: OK")
def test_preprocess():
    import subprocess
    r=subprocess.run([sys.executable,"scripts/preprocess.py"], capture_output=True, text=True)
    assert r.returncode==0, r.stderr
    print("preprocess: OK")
def test_simulate():
    import subprocess
    r=subprocess.run([sys.executable,"scripts/simulate.py","--P","120","--CN","78","--t","45"], capture_output=True, text=True)
    assert r.returncode==0, r.stderr
    j=json.load(open(ROOT/"data/processed/simulation/result.json",encoding='utf-8'))
    assert j["Q"]>0 and j["depth_max"]>=0
    print("simulate: OK")
if __name__=="__main__":
    test_vectors(); test_rasters(); test_preprocess(); test_simulate()
    print("All critical tests passed")
