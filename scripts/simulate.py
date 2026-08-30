import argparse, json, pathlib, sys
import numpy as np
ROOT = pathlib.Path(__file__).resolve().parent.parent

def scs_runoff(P, CN):
    S = (25400.0/CN) - 254.0
    Ia = 0.2*S
    Q = 0.0 if P <= Ia else (P - Ia)**2 / (P + 0.8*S)
    return S, Ia, Q

def d8_direction(dem):
    h,w = dem.shape
    dirs = np.zeros((h,w), dtype=np.int16)
    code_map = {(0,1):1,(1,1):2,(1,0):4,(1,-1):8,(0,-1):16,(-1,-1):32,(-1,0):64,(-1,1):128}
    for r in range(1,h-1):
        for c in range(1,w-1):
            best_slope = 0
            best_code = 0
            center = dem[r,c]
            for (dr,dc), code in code_map.items():
                slope = (center - dem[r+dr,c+dc]) / (1.414 if dr!=0 and dc!=0 else 1.0)
                if slope > best_slope:
                    best_slope = slope; best_code = code
            dirs[r,c] = best_code
    return dirs

def flow_accumulation(dirs):
    h,w = dirs.shape
    acc = np.ones((h,w), dtype=np.int32)
    inv = {1:(0,-1),2:(-1,-1),4:(-1,0),8:(-1,1),16:(0,1),32:(1,1),64:(1,0),128:(1,-1)}
    order = np.argsort(acc.ravel())[::-1]
    return acc

def flood_depth_grid(dem, Q, t_factor=0.6):
    norm = min(Q/120.0,1.0)
    base = norm * 2.2 * (0.3 + 0.7*t_factor)
    depth = np.maximum(0, base - (dem - dem.min())*0.08)
    depth = np.clip(depth, 0, 3.5)
    return depth

def simulate(P=120, CN=78, t=45, grid=60):
    S,Ia,Q = scs_runoff(P, CN)
    xs = np.linspace(0, 4*np.pi, grid)
    ys = np.linspace(0, 4*np.pi, grid)
    xx,yy = np.meshgrid(xs,ys)
    dem = np.sin(xx*0.6)*0.6 + np.cos(yy*0.7)*0.5 + np.sin(xx*1.3+yy*0.9)*0.25
    dem -= np.hypot(xx-2*np.pi, yy-2*np.pi)/8
    dirs = d8_direction(dem)
    t_factor = t/100.0
    depth = flood_depth_grid(dem, Q, t_factor)
    extent = (depth > 0.15).astype(np.uint8)
    velocity = 0.2 + depth*0.5
    flooded = int(extent.sum())
    total = grid*grid
    pct = flooded/total*100
    stats = {
        "P": P, "CN": CN, "S": round(float(S),2), "Ia": round(float(Ia),2),
        "Q": round(float(Q),2), "t": t,
        "depth_mean": round(float(depth[extent==1].mean() if flooded else 0),2),
        "depth_max": round(float(depth.max()),2),
        "flooded_cells": flooded, "total_cells": total,
        "flood_pct": round(float(pct),1),
        "velocity_mean": round(float(velocity[extent==1].mean() if flooded else 0),2),
    }
    return stats, depth, dem, dirs, extent

def main():
    ap=argparse.ArgumentParser(description="FLOIN Module 4 — Flood Simulation")
    ap.add_argument("--P", type=float, default=120, help="Rainfall mm")
    ap.add_argument("--CN", type=float, default=78, help="Curve Number")
    ap.add_argument("--t", type=int, default=45, help="Time step 0-100")
    ap.add_argument("--grid", type=int, default=60)
    ap.add_argument("--out", type=str, default="data/processed/simulation/result.json")
    args=ap.parse_args()
    stats, depth, dem, dirs, extent = simulate(args.P, args.CN, args.t, args.grid)
    print(f"[simulate] P={stats['P']} CN={stats['CN']} -> S={stats['S']} Ia={stats['Ia']} Q={stats['Q']}")
    print(f"[simulate] depth max={stats['depth_max']} mean={stats['depth_mean']} flooded={stats['flooded_cells']}/{stats['total_cells']} ({stats['flood_pct']}%) velocity={stats['velocity_mean']}")
    out = ROOT/args.out
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(stats, indent=2), encoding='utf-8')
    print(f"-> {out.relative_to(ROOT)}")
    # optional: save numpy arrays
    # np.save(out.with_suffix('.depth.npy'), depth)

if __name__=="__main__":
    main()
