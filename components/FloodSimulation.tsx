"use client";
import { useEffect, useRef, useState } from "react";
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

export default function FloodSimulation() {
  const heroRef = useRef<HTMLDivElement>(null);
  const simRef = useRef<HTMLCanvasElement>(null);
  const [P, setP] = useState(120);
  const [CN, setCN] = useState(78);
  const [t, setT] = useState(45);
  const [playing, setPlaying] = useState(true);

  const { S, Ia, Q } = scs(P, CN);
  const d = depthFrom(Q, t);

  useEffect(() => {
    if (!heroRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = 560; canvas.height = 280;
    canvas.setAttribute("aria-label", "Hero preview");
    heroRef.current.innerHTML = "";
    heroRef.current.appendChild(canvas);
    const ctx = createScene(canvas);
    loadVectors(ctx.buildingsGroup, ctx.roadsGroup);
    let raf = 0;
    let phase = 0.45;
    function animate() {
      raf = requestAnimationFrame(animate);
      phase = (phase + 0.0007) % 1;
      const p = ctx.water.geometry.attributes.position as any;
      for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 1.2 + phase * 6) * 0.04);
      p.needsUpdate = true;
      ctx.renderer.render(ctx.scene, ctx.camera);
    }
    animate();
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (!simRef.current) return;
    const canvas = simRef.current;
    const ctx = createScene(canvas);
    loadVectors(ctx.buildingsGroup, ctx.roadsGroup);
    (ctx as any).statusEl = document.getElementById("sim-status");
    if ((ctx as any).statusEl) (ctx as any).statusEl.textContent = "3D ready - drag to orbit";
    setTimeout(() => { const el = document.getElementById("sim-status"); if (el) el.style.display = "none"; }, 1500);

    let raf = 0;
    let phase = t / 100;
    function animate() {
      raf = requestAnimationFrame(animate);
      if (document.activeElement?.tagName !== "INPUT") {
        // time auto is handled via React state in a simpler way - keep static here
      }
      const water = ctx.water;
      const p = water.geometry.attributes.position as any;
      for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 1.2 + phase * 6) * 0.04);
      p.needsUpdate = true;
      water.position.y = -0.9 + d * 0.9;
      const mat: any = water.material;
      if (d < 0.5) mat.color.set(0x0ea5e9);
      else if (d < 1.5) mat.color.set(0xf59e0b);
      else mat.color.set(0xef4444);
      mat.opacity = 0.35 + clamp(d / 2.5, 0, 1) * 0.35;
      ctx.renderer.render(ctx.scene, ctx.camera);
    }
    animate();
    return () => cancelAnimationFrame(raf);
  }, [d]);

  return (
    <>
      <div className="hero-card" style={{ display: "none" }}>
        <div ref={heroRef} id="hero-preview" />
        <span id="hero-depth" style={{ display: "none" }}>{d.toFixed(2)}</span>
        <span id="hero-runoff" style={{ display: "none" }}>{Q.toFixed(0)}</span>
      </div>

      <div className="sim-layout">
        <div className="sim-canvas-wrap">
          <div id="sim-status" className="sim-status">Loading 3D terrain...</div>
          <canvas ref={simRef} id="sim" aria-label="3D flood terrain" style={{ width: "100%", height: 520, display: "block" }} />
          <div className="sim-legend">
            <span><i className="swatch" style={{ background: "#0ea5e9" }} /> Shallow</span>
            <span><i className="swatch" style={{ background: "#f59e0b" }} /> Moderate</span>
            <span><i className="swatch" style={{ background: "#ef4444" }} /> Deep</span>
          </div>
          <div className="sim-hint">Drag to orbit - Scroll to zoom</div>
        </div>
        <div className="sim-controls">
          <div className="ctrl-group">
            <label>Rainfall <span>{P}</span> mm</label>
            <input type="range" min={0} max={300} value={P} onChange={(e) => setP(+e.target.value)} aria-label="Rainfall" />
          </div>
          <div className="ctrl-group">
            <label>Urban Density <span>{CN}</span></label>
            <input type="range" min={30} max={98} value={CN} onChange={(e) => setCN(+e.target.value)} aria-label="Urban density" />
          </div>
          <div className="ctrl-group">
            <label>Time <span>{t}</span>%</label>
            <input type="range" min={0} max={100} value={t} onChange={(e) => setT(+e.target.value)} aria-label="Time" />
          </div>
          <div className="ctrl-row" style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-primary flex1" onClick={() => setPlaying(!playing)} aria-pressed={playing}>{playing ? "Pause" : "Play"}</button>
            <button className="btn btn-ghost flex1" onClick={() => { setP(120); setCN(78); setT(45); }}>Reset</button>
          </div>
          <div className="metrics" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div className="metric"><small>Water Depth</small><b>{d.toFixed(2)} m</b></div>
            <div className="metric"><small>Affected</small><b>~{Math.round(80 + d * 900 + Q * 3).toLocaleString()} buildings</b></div>
            <div className="metric"><small>Flow Speed</small><b>{(0.2 + d * 0.5).toFixed(1)} m/s</b></div>
            <div className="metric"><small>Runoff</small><b className="accent-text">{Q.toFixed(1)} mm</b></div>
          </div>
          <div style={{ display: "none" }}><span id="vP">{P}</span><span id="vCN">{CN}</span><span id="vT">{t}</span><span id="mS">{S.toFixed(2)}</span><span id="mIa">{Ia.toFixed(2)}</span><span id="mQ">{Q.toFixed(1)}</span><span id="mD">{d.toFixed(2)}</span><span id="mB">{Math.round(80 + d * 900 + Q * 3)}</span><span id="mV">{(0.2 + d * 0.5).toFixed(1)}</span></div>
          <button
            className="btn btn-outline wfull"
            onClick={() => {
              const gj = { type: "FeatureCollection", features: [{ type: "Feature", properties: { rainfall_mm: P, CN, runoff_mm: +Q.toFixed(2), flood_depth_m: +d.toFixed(2), timestamp: new Date().toISOString() }, geometry: { type: "Polygon", coordinates: [[[CHENNAI_BOUNDS.xmin, 13.0], [CHENNAI_BOUNDS.xmax, 13.0], [CHENNAI_BOUNDS.xmax, 13.15], [CHENNAI_BOUNDS.xmin, 13.15], [CHENNAI_BOUNDS.xmin, 13.0]]] } }] };
              const blob = new Blob([JSON.stringify(gj, null, 2)], { type: "application/json" });
              const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "floin-snapshot.geojson"; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
            }}
          >
            Export Snapshot
          </button>
          <button id="btnPlay" style={{ display: "none" }}>{playing ? "Pause" : "Play"}</button>
          <button id="btnReset" style={{ display: "none" }}>Reset</button>
          <button id="btnExport" style={{ display: "none" }}>Export</button>
          <input id="sP" type="range" min={0} max={300} value={P} onChange={(e) => setP(+e.target.value)} style={{ display: "none" }} />
          <input id="sCN" type="range" min={30} max={98} value={CN} onChange={(e) => setCN(+e.target.value)} style={{ display: "none" }} />
          <input id="sT" type="range" min={0} max={100} value={t} onChange={(e) => setT(+e.target.value)} style={{ display: "none" }} />
        </div>
      </div>
    </>
  );
}

function createScene(canvas: HTMLCanvasElement) {
  const w = canvas.clientWidth || 600, h = canvas.clientHeight || 520;
  const scene = new THREE.Scene();
  (scene as any).fog = new THREE.Fog(0x071220, 12, 30);
  const camera = new THREE.PerspectiveCamera(42, w / h, 0.1, 100);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(w, h, false);
  (renderer as any).setClearColor(0x071220, 1);
  scene.add(new THREE.HemisphereLight(0xcde9ff, 0x0a1a2e, 0.9));
  const dir = new THREE.DirectionalLight(0xffffff, 1.0);
  dir.position.set(6, 10, 4); scene.add(dir);
  const geo = new THREE.PlaneGeometry(14, 14, 90, 90);
  const pos: any = (geo as any).attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i);
    const d = Math.hypot(x, y);
    let z = Math.sin(x * 0.6) * 0.6 + Math.cos(y * 0.7) * 0.5;
    z += Math.sin(x * 1.3 + y * 0.9) * 0.25;
    z -= clamp((d - 4) / 6, 0, 1) * 1.2;
    z += (Math.random() - 0.5) * 0.06;
    pos.setZ(i, z);
  }
  (geo as any).computeVertexNormals();
  const terrain = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x1a3a2a, roughness: 0.95 }));
  terrain.rotation.x = -Math.PI / 2; terrain.position.y = -1.2; scene.add(terrain);
  const wgeo = new THREE.PlaneGeometry(13.3, 13.3, 40, 40);
  const water = new THREE.Mesh(wgeo, new THREE.MeshStandardMaterial({ color: 0x0ea5e9, transparent: true, opacity: 0.45, roughness: 0.2, side: THREE.DoubleSide }));
  water.rotation.x = -Math.PI / 2; water.position.y = -0.4; scene.add(water);
  const buildingsGroup = new THREE.Group();
  const roadsGroup = new THREE.Group();
  scene.add(buildingsGroup); scene.add(roadsGroup);
  let drag = false, lastX = 0, lastY = 0, yaw = 0.7, pitch = 0.9, dist = 14;
  function updateCam() {
    const x = Math.cos(yaw) * Math.sin(pitch) * dist;
    const y = Math.cos(pitch) * dist;
    const z = Math.sin(yaw) * Math.sin(pitch) * dist;
    camera.position.set(x, y, z); (camera as any).lookAt(0, -0.2, 0);
  }
  updateCam();
  canvas.addEventListener("pointerdown", (e) => { drag = true; lastX = e.clientX; lastY = e.clientY; (canvas as any).setPointerCapture(e.pointerId); });
  canvas.addEventListener("pointerup", () => { drag = false; });
  canvas.addEventListener("pointermove", (e) => {
    if (!drag) return;
    yaw += (e.clientX - lastX) * 0.005;
    pitch = clamp(pitch - (e.clientY - lastY) * 0.004, 0.25, 1.45);
    lastX = e.clientX; lastY = e.clientY; updateCam();
  });
  canvas.addEventListener("wheel", (e) => { e.preventDefault(); dist = clamp(dist + (e as WheelEvent).deltaY * 0.01, 6, 24); updateCam(); }, { passive: false } as any);
  new ResizeObserver(() => {
    const W = canvas.clientWidth, H = canvas.clientHeight;
    if (!W || !H) return;
    camera.aspect = W / H; camera.updateProjectionMatrix(); renderer.setSize(W, H, false);
  }).observe(canvas);
  return { scene, camera, renderer, terrain, water, buildingsGroup, roadsGroup };
}

async function loadVectors(buildingsGroup: THREE.Group, roadsGroup: THREE.Group) {
  try {
    const [bRes, hRes, wRes] = await Promise.all([
      fetch("/buildings.geojson").then((r) => { if (!r.ok) throw new Error(); return r.json(); }),
      fetch("/highway.geojson").then((r) => { if (!r.ok) throw new Error(); return r.json(); }),
      fetch("/waterway.geojson").then((r) => (r.ok ? r.json() : { features: [] })).catch(() => ({ features: [] })),
    ]);
    buildBuildings(buildingsGroup, bRes.features.slice(0, 400));
    buildRoads(roadsGroup, hRes.features.slice(0, 300).concat(wRes.features.slice(0, 80)));
  } catch {
    buildProcedural(buildingsGroup);
  }
}
function buildBuildings(group: THREE.Group, features: any[]) {
  group.clear();
  const mat = new THREE.MeshStandardMaterial({ color: 0x8aa0b8, roughness: 0.8 });
  const matHi = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.7 });
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
      const h = levels * 0.18 + Math.random() * 0.12;
      const g = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false } as any);
      (g as any).rotateX(Math.PI / 2);
      const mesh = new THREE.Mesh(g, Math.random() > 0.7 ? matHi : mat);
      mesh.position.y = -1.05; group.add(mesh);
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
      const pts = coords.map(([lng, lat]: any) => { const [x, z] = lngLatToXZ(lng, lat); return new THREE.Vector3(x, -0.92, z); });
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      group.add(new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.55 })));
    });
  });
}
function buildProcedural(group: THREE.Group) {
  group.clear();
  for (let i = 0; i < 80; i++) {
    const x = (Math.random() - 0.5) * 11, z = (Math.random() - 0.5) * 11;
    const w = 0.15 + Math.random() * 0.25, d = 0.15 + Math.random() * 0.25, h = 0.25 + Math.random() * 0.7;
    const g = new THREE.BoxGeometry(w, h, d);
    const m = new THREE.Mesh(new THREE.MeshStandardMaterial({ color: 0x94a3b8 }) as any);
    const mesh = new THREE.Mesh(g, m as any);
    mesh.position.set(x, -0.9 + h / 2, z); group.add(mesh);
  }
}
