"use client";
import { useEffect, useRef, useState, useMemo } from "react";
import * as THREE from "three";

const CHENNAI_BOUNDS = { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 };
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
function scs(P: number, CN: number) {
  const S = 25400 / CN - 254;
  const Ia = 0.2 * S;
  const Q = P <= Ia ? 0 : (P - Ia) ** 2 / (P + 0.8 * S);
  return { S, Ia, Q };
}
function depthFrom(Q: number, t: number) {
  return clamp(Q / 120, 0, 1) * 2.2 * (0.3 + 0.7 * (t / 100));
}
function lngLatToXZ(lng: number, lat: number, size = 14) {
  const nx = (lng - CHENNAI_BOUNDS.xmin) / (CHENNAI_BOUNDS.xmax - CHENNAI_BOUNDS.xmin);
  const ny = (lat - CHENNAI_BOUNDS.ymin) / (CHENNAI_BOUNDS.ymax - CHENNAI_BOUNDS.ymin);
  return [(nx - 0.5) * size, (ny - 0.5) * size] as const;
}
function aoiToXZBounds(aoi: any, size = 14) {
  const [x1, z1] = lngLatToXZ(aoi.bounds.xmin, aoi.bounds.ymin, size);
  const [x2, z2] = lngLatToXZ(aoi.bounds.xmax, aoi.bounds.ymax, size);
  return { minX: Math.min(x1, x2), maxX: Math.max(x1, x2), minZ: Math.min(z1, z2), maxZ: Math.max(z1, z2), cx: (x1 + x2) / 2, cz: (z1 + z2) / 2, w: Math.abs(x2 - x1), h: Math.abs(z2 - z1) };
}

function createWindowTexture() {
  const c = document.createElement("canvas");
  c.width = 256; c.height = 256;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#cbd5e1";
  ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = "#0f172a";
  for (let y = 20; y < 236; y += 32) {
    for (let x = 16; x < 240; x += 28) {
      ctx.fillRect(x, y, 18, 22);
      ctx.fillStyle = y % 64 === 20 ? "#38bdf8" : "#0f172a";
      ctx.fillRect(x + 2, y + 2, 14, 18);
      ctx.fillStyle = "#0f172a";
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

let requestCounter = 0;
const cache = new Map<string, any>();

export default function FloodSimulation({ selectedArea }: { selectedArea?: any }) {
  const heroRef = useRef<HTMLDivElement>(null);
  const simRef = useRef<HTMLCanvasElement>(null);
  const simCtxRef = useRef<any>(null);
  const requestIdRef = useRef(0);
  const [P, setP] = useState(120);
  const [CN, setCN] = useState(78);
  const [t, setT] = useState(45);
  const [playing, setPlaying] = useState(true);
  const [showBuildings, setShowBuildings] = useState(true);
  const [showContours, setShowContours] = useState(true);
  const [debug, setDebug] = useState<any>(null);

  const { S, Ia, Q } = useMemo(() => scs(P, CN), [P, CN]);
  const d = useMemo(() => depthFrom(Q, t), [Q, t]);

  const stats = useMemo(() => ({
    depth: d.toFixed(2),
    runoff: Q.toFixed(1),
    buildings: Math.round(80 + d * 900 + Q * 3).toLocaleString(),
    velocity: (0.2 + d * 0.5).toFixed(1),
  }), [d, Q]);

  useEffect(() => {
    if (!heroRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = 560; canvas.height = 280;
    heroRef.current.innerHTML = "";
    heroRef.current.appendChild(canvas);
    const ctx = createProScene(canvas, { isHero: true, aoi: { bounds: CHENNAI_BOUNDS, center: [80.27, 13.08], id: "hero" } });
    loadVectorsForAOI(ctx.buildingsGroup, ctx.roadsGroup, { bounds: CHENNAI_BOUNDS, center: [80.27, 13.08], id: "hero" }, false, 0);
    let raf = 0; let phase = 0;
    const animate = () => {
      raf = requestAnimationFrame(animate);
      phase += 0.008;
      const pos: any = ctx.water.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin(pos.getX(i) * 1.2 + phase * 2) * 0.03);
      pos.needsUpdate = true;
      (ctx.water.material as any).uniforms.time.value = phase;
      ctx.controls.update();
      ctx.renderer.render(ctx.scene, ctx.camera);
    };
    animate();
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (!simRef.current) return;
    const canvas = simRef.current;
    const aoi = selectedArea || { bounds: CHENNAI_BOUNDS, center: [80.225, 13.065], id: "all" };
    const reqId = ++requestCounter;
    requestIdRef.current = reqId;
    const cacheKey = `${aoi.id}-${aoi.bounds.xmin.toFixed(3)}-${P}-${CN}-${t}`;

    const ctx = createProScene(canvas, { isHero: false, showContours, d, aoi });
    simCtxRef.current = ctx;

    const statusEl = document.getElementById("sim-status");
    if (statusEl) statusEl.textContent = `Request #${reqId}: Loading ${aoi.id} • ${aoi.bounds.xmin.toFixed(3)},${aoi.bounds.ymin.toFixed(3)}`;
    setTimeout(() => { const el = document.getElementById("sim-status"); if (el) el.style.display = "none"; }, 2200);

    (async () => {
      if (cache.has(cacheKey)) {
        const c = cache.get(cacheKey);
        if (requestIdRef.current !== reqId) return;
        applyCachedResult(ctx, c, aoi);
        setDebug({ requestId: reqId, aoi, terrain: c.terrain, counts: c.counts, cached: true });
        return;
      }

      const terrainStats = generateTerrainForAOI(ctx.terrain, aoi);
      const counts = await loadVectorsForAOI(ctx.buildingsGroup, ctx.roadsGroup, aoi, true, reqId);
      if (requestIdRef.current !== reqId) return;

      const simResult = runLocalizedSimulation(terrainStats, counts, P, CN, t, aoi);
      cache.set(cacheKey, { terrain: terrainStats, counts, simResult });
      applyCachedResult(ctx, { terrain: terrainStats, counts, simResult }, aoi);
      setDebug({ requestId: reqId, aoi, terrain: terrainStats, counts, simResult, cached: false });
    })();

    let raf = 0; let phase = 0;
    const animate = () => {
      raf = requestAnimationFrame(animate);
      phase += playing ? 0.006 : 0;
      const pos: any = ctx.water.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin(pos.getX(i) * 1.1 + phase * 3) * 0.035);
      pos.needsUpdate = true;
      (ctx.water.material as any).uniforms.time.value = phase;
      (ctx.water.material as any).uniforms.depth.value = d;
      updateBuildingImpact(ctx.buildingsGroup, d);
      ctx.controls.update();
      ctx.renderer.render(ctx.scene, ctx.camera);
    };
    animate();
    return () => {
      cancelAnimationFrame(raf);
      disposeScene(ctx);
    };
  }, [selectedArea?.id, selectedArea?.bounds.xmin, selectedArea?.bounds.ymin, P, CN, t, playing, showContours, showBuildings, d]);

  useEffect(() => {
    if (!simCtxRef.current || !selectedArea) return;
    const ctx = simCtxRef.current;
    const [cx, cz] = lngLatToXZ(selectedArea.center[0], selectedArea.center[1], 14);
    const dist = selectedArea.id === "all" ? 14 : 6.5;
    if (ctx.controls?.target) {
      ctx.controls.target.set(cx, -0.2, cz);
      ctx.camera.position.set(cx + dist * 0.6, 5.8, cz + dist * 0.6);
      ctx.controls.update();
    }
  }, [selectedArea]);

  return (
    <>
      <div className="hero-card" style={{ display: "none" }}>
        <div ref={heroRef} id="hero-preview" />
        <span id="hero-depth" style={{ display: "none" }}>{stats.depth}</span>
        <span id="hero-runoff" style={{ display: "none" }}>{Q.toFixed(0)}</span>
      </div>

      <div className="sim-layout">
        <div className="sim-canvas-wrap" style={{ position: "relative", background: "#040a14", borderRadius: 16, overflow: "hidden", border: "1px solid #1e3a5a" }}>
          <div id="sim-status" className="sim-status" style={{ position: "absolute", top: 12, left: 12, zIndex: 2, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)", padding: "6px 10px", borderRadius: 999, fontSize: ".72rem", border: "1px solid #1e3a5a", fontFamily: "JetBrains Mono" }}>Ready</div>
          <canvas ref={simRef} id="sim" aria-label="Localized 3D flood terrain" style={{ width: "100%", height: 560, display: "block" }} />

          {debug && (
            <div style={{ position: "absolute", bottom: 12, left: 12, background: "rgba(0,0,0,0.72)", backdropFilter: "blur(8px)", border: "1px solid #1e3a5a", borderRadius: 10, padding: "8px 10px", fontSize: ".62rem", fontFamily: "JetBrains Mono", lineHeight: 1.4, maxWidth: "62%" }}>
              <div style={{ fontWeight: 700, color: "#22d3ee" }}>Req #{debug.requestId} • {debug.aoi?.id} {debug.cached ? "(cached)" : ""}</div>
              <div style={{ color: "#e6eef8" }}>AOI: {debug.aoi?.center[1].toFixed(4)}, {debug.aoi?.center[0].toFixed(4)} • {debug.aoi?.bounds.xmin.toFixed(3)}-{debug.aoi?.bounds.xmax.toFixed(3)} × {debug.aoi?.bounds.ymin.toFixed(3)}-{debug.aoi?.bounds.ymax.toFixed(3)}</div>
              <div style={{ color: "#8aa0b8" }}>Terrain: {debug.terrain?.min?.toFixed(2)}-{debug.terrain?.max?.toFixed(2)}m • {debug.terrain?.grid} grid • {debug.terrain?.source}</div>
              <div style={{ color: "#8aa0b8" }}>Buildings: {debug.counts?.buildings} • Roads: {debug.counts?.roads} • Hotspots: {debug.counts?.hotspots ?? 0} • Rivers: {debug.counts?.rivers ?? 0}</div>
            </div>
          )}

          <div style={{ position: "absolute", top: 12, right: 12, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)", border: "1px solid #1e3a5a", borderRadius: 10, padding: "8px 10px", fontSize: ".68rem", lineHeight: 1.4 }}>
            <div style={{ fontWeight: 700, color: "#e6eef8" }}>{selectedArea?.center ? `${selectedArea.center[1].toFixed(2)}N, ${selectedArea.center[0].toFixed(2)}E` : "13.08N, 80.27E"} • {selectedArea?.id === "all" ? "Chennai" : selectedArea?.name}</div>
            <div style={{ color: "#8aa0b8" }}>Req #{debug?.requestId || "?"} • DEM 30m • WGS84</div>
            <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
              <span style={{ width: 30, height: 4, background: "#0ea5e9", borderRadius: 2 }} /> <span style={{ color: "#8aa0b8" }}>0-0.5m</span>
              <span style={{ width: 30, height: 4, background: "#f59e0b", borderRadius: 2 }} /> <span style={{ color: "#8aa0b8" }}>0.5-1.5m</span>
              <span style={{ width: 30, height: 4, background: "#ef4444", borderRadius: 2 }} /> <span style={{ color: "#8aa0b8" }}>&gt;1.5m</span>
            </div>
          </div>
        </div>

        <div className="sim-controls" style={{ background: "#12233a", border: "1px solid #1e3a5a", borderRadius: 16, padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => setShowBuildings(!showBuildings)} className={`flex-1 py-1.5 rounded-full text-xs border ${showBuildings ? "bg-cyan-500 text-black border-transparent" : "border-[#1e3a5a]"}`}>Buildings</button>
            <button onClick={() => setShowContours(!showContours)} className={`flex-1 py-1.5 rounded-full text-xs border ${showContours ? "bg-cyan-500 text-black border-transparent" : "border-[#1e3a5a]"}`}>Contours</button>
          </div>
          <div className="ctrl-group">
            <label style={{ display: "flex", justifyContent: "space-between", fontSize: ".78rem", fontWeight: 600 }}>Rainfall <span style={{ color: "#22d3ee", fontFamily: "JetBrains Mono" }}>{P} mm</span></label>
            <input type="range" min={0} max={300} value={P} onChange={(e) => setP(+e.target.value)} aria-label="Rainfall" style={{ width: "100%", accentColor: "#06b6d4", marginTop: 6 }} />
          </div>
          <div className="ctrl-group">
            <label style={{ display: "flex", justifyContent: "space-between", fontSize: ".78rem", fontWeight: 600 }}>Imperviousness <span style={{ color: "#22d3ee", fontFamily: "JetBrains Mono" }}>{CN}</span></label>
            <input type="range" min={30} max={98} value={CN} onChange={(e) => setCN(+e.target.value)} aria-label="Urban density" style={{ width: "100%", accentColor: "#06b6d4" }} />
          </div>
          <div className="ctrl-group">
            <label style={{ display: "flex", justifyContent: "space-between", fontSize: ".78rem", fontWeight: 600 }}>Time <span style={{ color: "#22d3ee", fontFamily: "JetBrains Mono" }}>{t}%</span></label>
            <input type="range" min={0} max={100} value={t} onChange={(e) => setT(+e.target.value)} aria-label="Time" style={{ width: "100%", accentColor: "#06b6d4" }} />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-primary flex1" onClick={() => setPlaying(!playing)} aria-pressed={playing} style={{ flex: 1, padding: "9px", borderRadius: 999, background: "linear-gradient(135deg,#06b6d4,#0ea5e9)", color: "#001018", fontWeight: 700, border: "none" }}>{playing ? "Pause" : "Play"}</button>
            <button className="btn btn-ghost flex1" onClick={() => { setP(120); setCN(78); setT(45); }} style={{ flex: 1, padding: "9px", borderRadius: 999, background: "rgba(255,255,255,0.06)", border: "1px solid #1e3a5a" }}>Reset</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div style={{ background: "#0b1d2f", border: "1px solid #1e3a5a", borderRadius: 10, padding: "8px 10px" }}><small style={{ color: "#8aa0b8", fontSize: ".62rem", display: "block" }}>Water Depth</small><b style={{ fontFamily: "JetBrains Mono", fontSize: ".85rem" }}>{stats.depth} m</b></div>
            <div style={{ background: "#0b1d2f", border: "1px solid #1e3a5a", borderRadius: 10, padding: "8px 10px" }}><small style={{ color: "#8aa0b8", fontSize: ".62rem", display: "block" }}>Affected</small><b style={{ fontFamily: "JetBrains Mono", fontSize: ".85rem" }}>{stats.buildings}</b></div>
            <div style={{ background: "#0b1d2f", border: "1px solid #1e3a5a", borderRadius: 10, padding: "8px 10px" }}><small style={{ color: "#8aa0b8", fontSize: ".62rem", display: "block" }}>Flow Speed</small><b style={{ fontFamily: "JetBrains Mono", fontSize: ".85rem" }}>{stats.velocity} m/s</b></div>
            <div style={{ background: "#0b1d2f", border: "1px solid #1e3a5a", borderRadius: 10, padding: "8px 10px" }}><small style={{ color: "#8aa0b8", fontSize: ".62rem", display: "block" }}>Runoff</small><b style={{ fontFamily: "JetBrains Mono", fontSize: ".85rem", color: "#22d3ee" }}>{Q.toFixed(1)} mm</b></div>
          </div>
          <button
            className="btn btn-outline wfull"
            onClick={() => {
              const gj = { type: "FeatureCollection", features: [{ type: "Feature", properties: { rainfall_mm: P, CN, runoff_mm: +Q.toFixed(2), flood_depth_m: +d.toFixed(2), aoi: selectedArea, requestId: debug?.requestId, timestamp: new Date().toISOString() }, geometry: { type: "Polygon", coordinates: [[[selectedArea.bounds.xmin, selectedArea.bounds.ymin], [selectedArea.bounds.xmax, selectedArea.bounds.ymin], [selectedArea.bounds.xmax, selectedArea.bounds.ymax], [selectedArea.bounds.xmin, selectedArea.bounds.ymax], [selectedArea.bounds.xmin, selectedArea.bounds.ymin]]] } }] };
              const blob = new Blob([JSON.stringify(gj, null, 2)], { type: "application/json" });
              const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `floin-${selectedArea.id}-${Date.now()}.geojson`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
            }}
            style={{ width: "100%", padding: "9px", borderRadius: 999, border: "1px solid #06b6d4", color: "#06b6d4", background: "transparent", fontSize: ".78rem" }}
          >
            Export AOI Snapshot
          </button>
        </div>
      </div>
    </>
  );
}

function generateTerrainForAOI(terrain: THREE.Mesh, aoi: any) {
  const geo: any = terrain.geometry;
  const pos: any = geo.attributes.position;
  const colors: number[] = [];
  const color = new THREE.Color();
  let minZ = Infinity, maxZ = -Infinity;
  const zVals: number[] = [];
  const seedX = aoi.center[0] * 3.7, seedY = aoi.center[1] * 3.7;
  const isCentral = aoi.id === "central";
  const isNorth = aoi.id === "ennore";
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i);
    const d = Math.hypot(x, y);
    let z = Math.sin((x + seedX) * 0.58) * 0.62 + Math.cos((y + seedY) * 0.68) * 0.52;
    z += Math.sin((x + seedX) * 1.35 + (y + seedY) * 0.92) * 0.26;
    z += Math.cos((x + seedX) * 2.1 - (y + seedY) * 1.3) * 0.12;
    z += Math.sin((x + seedX) * 0.22 + (y + seedY) * 0.18) * 0.35;
    if (isCentral) z -= 0.35;
    if (isNorth) z += 0.25;
    z -= clamp((d - 4.2) / 6, 0, 1) * 1.35;
    z += (Math.sin(x * 12 + y * 9 + seedX) * 0.02);
    pos.setZ(i, z);
    zVals.push(z);
    minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
  }
  for (let i = 0; i < zVals.length; i++) {
    const t = (zVals[i] - minZ) / (maxZ - minZ || 1);
    if (t < 0.25) color.setHSL(0.42, 0.35, 0.18 + t * 0.3);
    else if (t < 0.55) color.setHSL(0.32, 0.28, 0.24 + t * 0.15);
    else if (t < 0.8) color.setHSL(0.08, 0.22, 0.32 + t * 0.1);
    else color.setHSL(0.06, 0.12, 0.42);
    colors.push(color.r, color.g, color.b);
  }
  (geo as any).setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  (geo as any).computeVertexNormals();
  geo.attributes.position.needsUpdate = true;
  return { min: minZ, max: maxZ, grid: `${(geo as any).attributes.position.count} cells`, source: `DEM procedural seed ${seedX.toFixed(1)},${seedY.toFixed(1)}`, bounds: aoi.bounds };
}

function runLocalizedSimulation(terrainStats: any, counts: any, P: number, CN: number, t: number, aoi: any) {
  const { Q } = scs(P, CN);
  const norm = clamp(Q / 120, 0, 1);
  const aoiFactor = aoi.id === "ennore" ? 1.15 : aoi.id === "central" ? 0.95 : 1.0;
  const depth = norm * 2.2 * (0.3 + 0.7 * (t / 100)) * aoiFactor;
  const floodedBuildings = Math.round(counts.buildings * clamp(depth / 1.5, 0, 1) * 0.72);
  return { depth: depth.toFixed(2), floodedBuildings, Q: Q.toFixed(1) };
}

function applyCachedResult(ctx: any, cached: any, aoi: any) {
  generateTerrainForAOI(ctx.terrain, aoi);
  const b = aoi.bounds;
  const [ax1, az1] = lngLatToXZ(b.xmin, b.ymin, 14);
  const [ax2, az2] = lngLatToXZ(b.xmax, b.ymax, 14);
  const w = Math.abs(ax2 - ax1), h = Math.abs(az2 - az1);
  const cx = (ax1 + ax2) / 2, cz = (az1 + az2) / 2;
  ctx.water.scale.set(Math.max(0.35, w / 14), Math.max(0.35, h / 14), 1);
  ctx.water.position.set(cx * 0.08, -0.88, cz * 0.08);
}

function disposeScene(ctx: any) {
  try {
    ctx.terrain.geometry.dispose();
    (ctx.terrain.material as any).dispose();
    ctx.water.geometry.dispose();
    (ctx.water.material as any).dispose();
    ctx.buildingsGroup.children.forEach((m: any) => { m.geometry?.dispose(); m.material?.dispose(); });
    ctx.roadsGroup.children.forEach((m: any) => { m.geometry?.dispose(); m.material?.dispose(); });
    ctx.buildingsGroup.clear();
    ctx.roadsGroup.clear();
  } catch {}
}

function createProScene(canvas: HTMLCanvasElement, opts: { isHero?: boolean; showContours?: boolean; d?: number; aoi?: any }) {
  const w = canvas.clientWidth || 600, h = canvas.clientHeight || 520;
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x060d1a, 10, 28);
  scene.background = new THREE.Color(0x060d1a);
  const camera = new THREE.PerspectiveCamera(42, w / h, 0.1, 100);
  camera.position.set(opts.isHero ? 7 : 8.5, 6.5, 8.5);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(w, h, false);
  renderer.setClearColor(0x060d1a, 1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const hemi = new THREE.HemisphereLight(0xdbeafe, 0x0a1a2e, 0.9);
  scene.add(hemi);
  const dir = new THREE.DirectionalLight(0xffffff, 1.15);
  dir.position.set(8, 12, 6);
  dir.castShadow = true;
  dir.shadow.mapSize.set(2048, 2048);
  dir.shadow.camera.near = 0.5; dir.shadow.camera.far = 30;
  dir.shadow.camera.left = -12; dir.shadow.camera.right = 12; dir.shadow.camera.top = 10; dir.shadow.camera.bottom = -10;
  dir.shadow.bias = -0.0005;
  scene.add(dir);
  const fill = new THREE.DirectionalLight(0x7dd3fc, 0.35);
  fill.position.set(-6, 5, -4); scene.add(fill);
  const size = 14, seg = 120;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  const tmat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0.02 });
  const terrain = new THREE.Mesh(geo, tmat);
  terrain.rotation.x = -Math.PI / 2;
  terrain.position.y = -1.2;
  terrain.receiveShadow = true;
  scene.add(terrain);
  if (opts.aoi) generateTerrainForAOI(terrain, opts.aoi);
  else {
    const pos: any = (geo as any).attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i);
      let z = Math.sin(x * 0.58) * 0.62 + Math.cos(y * 0.68) * 0.52;
      z += Math.sin(x * 1.35 + y * 0.92) * 0.26;
      pos.setZ(i, z);
    }
    (geo as any).computeVertexNormals();
  }
  const grid = new THREE.GridHelper(size, 14, 0x1e3a5a, 0x0f1e2e);
  (grid as any).position.y = -1.19;
  (grid as any).material.opacity = 0.25; (grid as any).material.transparent = true;
  scene.add(grid);
  const wgeo = new THREE.PlaneGeometry(13.4, 13.4, 64, 64);
  const waterMat = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, depth: { value: opts.d ?? 0.5 }, opacity: { value: 0.52 } },
    vertexShader: `uniform float time; varying vec2 vUv; varying float vWave; void main(){ vUv=uv; vec3 p=position; float w=sin(p.x*1.1+time*3.0)*0.035+cos(p.y*0.95+time*2.2)*0.025; p.z+=w; vWave=w; gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0); }`,
    fragmentShader: `uniform float depth; uniform float opacity; varying vec2 vUv; varying float vWave;
      void main(){
        float d=clamp(depth/2.5,0.0,1.0);
        vec3 shallow=vec3(0.06,0.65,0.91);
        vec3 mid=vec3(0.96,0.62,0.07);
        vec3 deep=vec3(0.94,0.27,0.27);
        vec3 col=mix(shallow, mid, smoothstep(0.0,0.55,d));
        col=mix(col, deep, smoothstep(0.55,1.0,d));
        float ripple = sin(vUv.x*22.0+vWave*40.0)*0.04 + cos(vUv.y*18.0 - vWave*30.0)*0.04;
        col += ripple;
        float foam = smoothstep(0.48,0.52, fract(vUv.x*6.0+vWave*2.0)) * 0.12 * (1.0-d*0.5);
        col += foam;
        gl_FragColor=vec4(col, opacity + d*0.22);
      }`,
    transparent: true,
    side: THREE.DoubleSide,
  });
  const water = new THREE.Mesh(wgeo, waterMat as any);
  water.rotation.x = -Math.PI / 2;
  water.position.y = -0.88;
  scene.add(water);
  const buildingsGroup = new THREE.Group();
  const roadsGroup = new THREE.Group();
  scene.add(buildingsGroup); scene.add(roadsGroup);
  const controls = { update: () => {} } as any;
  try {
    const OrbitControls = (THREE as any).OrbitControls || null;
    if (OrbitControls) {
      const c = new OrbitControls(camera, renderer.domElement);
      c.enableDamping = true; c.dampingFactor = 0.065;
      c.minDistance = 5; c.maxDistance = 24;
      c.maxPolarAngle = Math.PI / 2.12;
      c.target.set(0, -0.2, 0);
      c.update();
      controls.update = () => c.update();
      (controls as any)._ctrl = c;
    } else throw new Error("fallback");
  } catch {
    let drag = false, lastX = 0, lastY = 0, yaw = 0.72, pitch = 0.88, dist = 14;
    const updateCam = () => {
      const x = Math.cos(yaw) * Math.sin(pitch) * dist;
      const y = Math.cos(pitch) * dist;
      const z = Math.sin(yaw) * Math.sin(pitch) * dist;
      camera.position.set(x, y, z); (camera as any).lookAt(0, -0.2, 0);
    };
    updateCam();
    canvas.addEventListener("pointerdown", (e) => { drag = true; lastX = e.clientX; lastY = e.clientY; (canvas as any).setPointerCapture(e.pointerId); });
    canvas.addEventListener("pointerup", () => { drag = false; });
    canvas.addEventListener("pointermove", (e) => {
      if (!drag) return;
      yaw += (e.clientX - lastX) * 0.005; pitch = clamp(pitch - (e.clientY - lastY) * 0.004, 0.25, 1.45);
      lastX = e.clientX; lastY = e.clientY; updateCam();
    });
    canvas.addEventListener("wheel", (e) => { e.preventDefault(); dist = clamp(dist + (e as WheelEvent).deltaY * 0.01, 6, 24); updateCam(); }, { passive: false } as any);
  }
  new ResizeObserver(() => {
    const W = canvas.clientWidth, H = canvas.clientHeight;
    if (!W || !H) return;
    camera.aspect = W / H; camera.updateProjectionMatrix(); renderer.setSize(W, H, false);
  }).observe(canvas);
  return { scene, camera, renderer, terrain, water, buildingsGroup, roadsGroup, controls };
}

function updateBuildingImpact(group: THREE.Group, depth: number) {
  const threshold = 0.35;
  const flooded = depth > threshold;
  group.children.forEach((m: any) => {
    if (!m.material) return;
    const mat = m.material;
    if (flooded) {
      const t = clamp((depth - threshold) / 1.2, 0, 1);
      if (!mat.userData.origColor) mat.userData.origColor = mat.color.clone();
      mat.color.copy(mat.userData.origColor).lerp(new THREE.Color(0xef4444), t * 0.35);
      mat.emissive = new THREE.Color(0x7f1d1d).multiplyScalar(t * 0.25);
    } else if (mat.userData.origColor) {
      mat.color.copy(mat.userData.origColor);
      mat.emissive = new THREE.Color(0x000000);
    }
  });
}

async function loadVectorsForAOI(buildingsGroup: THREE.Group, roadsGroup: THREE.Group, aoi: any, accurate: boolean, reqId: number) {
  const b = aoi.bounds;
  const inAOI = (lng: number, lat: number) => lng >= b.xmin && lng <= b.xmax && lat >= b.ymin && lat <= b.ymax;
  const counts = { buildings: 0, roads: 0, rivers: 0, hotspots: 0, floodedStreets: 0 };

  try {
    const [bRes, hRes, wRes, hotRes, floodRes] = await Promise.all([
      fetch("/buildings.geojson").then((r) => r.json()).catch(() => ({ features: [] })),
      fetch("/highway.geojson").then((r) => r.json()).catch(() => ({ features: [] })),
      fetch("/waterway.geojson").then((r) => r.json()).catch(() => ({ features: [] })),
      fetch("/chennai2015_hotspots.geojson").then((r) => r.json()).catch(() => ({ features: [] })),
      fetch("/chennai2015_flooded_streets.geojson").then((r) => r.json()).catch(() => ({ features: [] })),
    ]);
    const bFiltered = bRes.features.filter((f: any) => {
      const c = f.geometry.coordinates[0]?.[0] || f.geometry.coordinates[0];
      if (!c) return false;
      const lng = Array.isArray(c[0]) ? c[0][0] : c[0];
      const lat = Array.isArray(c[0]) ? c[0][1] : c[1];
      return typeof lng === "number" && inAOI(lng, lat);
    });
    const rFiltered = hRes.features.filter((f: any) => {
      const coords = f.geometry.coordinates;
      const pts = f.geometry.type === "LineString" ? coords : coords.flat();
      return pts.some((p: any) => inAOI(p[0], p[1]));
    });
    counts.buildings = bFiltered.length;
    counts.roads = rFiltered.length;
    counts.hotspots = hotRes.features.filter((f: any) => inAOI(f.geometry.coordinates[0], f.geometry.coordinates[1])).length;
    counts.floodedStreets = floodRes.features.filter((f: any) => f.geometry.coordinates.some((p: any) => inAOI(p[0], p[1]))).length;
    counts.rivers = wRes.features.filter((f: any) => {
      const coords = f.geometry.coordinates;
      if (!coords) return false;
      const pts = Array.isArray(coords[0][0]) ? coords.flat(1) : coords;
      return pts.some((p: any) => Array.isArray(p) && inAOI(p[0], p[1]));
    }).length;

    disposeGroup(buildingsGroup);
    disposeGroup(roadsGroup);
    if (bFiltered.length === 0) {
      // explicitly show no buildings for this AOI
    } else {
      buildBuildings(buildingsGroup, bFiltered.slice(0, 500), accurate);
    }
    if (rFiltered.length === 0) {
    } else {
      buildRoads(roadsGroup, rFiltered.slice(0, 200));
    }
  } catch {}
  return counts;
}

function disposeGroup(group: THREE.Group) {
  group.children.forEach((m: any) => {
    m.geometry?.dispose();
    m.material?.dispose?.();
  });
  group.clear();
}

function buildBuildings(group: THREE.Group, features: any[], accurate: boolean) {
  group.clear();
  const winTex = accurate ? createWindowTexture() : null;
  const matBase = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.78, metalness: 0.04, map: winTex as any });
  const matAlt = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.72, metalness: 0.06, map: winTex as any });
  const matDark = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.85, metalness: 0.02 });
  features.forEach((f: any) => {
    const geom = f.geometry; if (!geom) return;
    const polys = geom.type === "Polygon" ? [geom.coordinates] : geom.type === "MultiPolygon" ? geom.coordinates : [];
    polys.forEach((poly: any) => {
      const outer = poly[0]; if (!outer || outer.length < 3) return;
      const shape = new THREE.Shape();
      outer.forEach(([lng, lat]: any, i: number) => {
        const [x, z] = lngLatToXZ(lng, lat);
        if (i === 0) shape.moveTo(x, z); else shape.lineTo(x, z);
      });
      const levels = parseInt(f.properties?.["building:levels"]) || 2 + Math.floor(Math.random() * 3);
      const h = levels * 0.19 + (accurate ? Math.random() * 0.08 : 0);
      const g = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 1 } as any);
      (g as any).rotateX(Math.PI / 2);
      const mats = [matBase, matAlt, matDark];
      const m = mats[Math.floor(Math.random() * mats.length)].clone() as any;
      const mesh = new THREE.Mesh(g, m);
      mesh.position.y = -1.05;
      mesh.castShadow = accurate; mesh.receiveShadow = accurate;
      if (accurate) m.emissive = new THREE.Color(0x000000);
      let sumX = 0, sumZ = 0;
      outer.forEach(([lng, lat]: any) => { const [x, z] = lngLatToXZ(lng, lat); sumX += x; sumZ += z; });
      mesh.userData.centerX = sumX / outer.length;
      mesh.userData.centerZ = sumZ / outer.length;
      group.add(mesh);
    });
  });
}
function buildRoads(group: THREE.Group, features: any[]) {
  group.clear();
  features.forEach((f: any) => {
    const g = f.geometry; if (!g) return;
    const lines = g.type === "LineString" ? [g.coordinates] : g.type === "MultiLineString" ? g.coordinates : g.type === "Polygon" ? [g.coordinates[0]] : g.type === "MultiPolygon" ? g.coordinates.map((p: any) => p[0]) : [];
    lines.forEach((coords: any) => {
      if (!coords || coords.length < 2) return;
      const pts = coords.map(([lng, lat]: any) => { const [x, z] = lngLatToXZ(lng, lat); return new THREE.Vector3(x, -0.91, z); });
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const mat = new THREE.LineBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.62, linewidth: 1 });
      group.add(new THREE.Line(geo, mat));
    });
  });
}
