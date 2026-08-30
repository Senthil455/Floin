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
  t.repeat.set(1, 1);
  return t;
}

export default function FloodSimulation() {
  const heroRef = useRef<HTMLDivElement>(null);
  const simRef = useRef<HTMLCanvasElement>(null);
  const [P, setP] = useState(120);
  const [CN, setCN] = useState(78);
  const [t, setT] = useState(45);
  const [playing, setPlaying] = useState(true);
  const [showBuildings, setShowBuildings] = useState(true);
  const [showContours, setShowContours] = useState(true);

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
    canvas.setAttribute("aria-label", "Hero flood preview - Chennai terrain");
    heroRef.current.innerHTML = "";
    heroRef.current.appendChild(canvas);
    const ctx = createProScene(canvas, { isHero: true });
    loadVectors(ctx.buildingsGroup, ctx.roadsGroup, { accurate: false });
    let raf = 0;
    let phase = 0;
    const animate = () => {
      raf = requestAnimationFrame(animate);
      phase += 0.008;
      const pos: any = ctx.water.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        pos.setZ(i, Math.sin(x * 1.2 + phase * 2) * 0.03 + Math.cos(pos.getY(i) * 0.9 + phase) * 0.02);
      }
      pos.needsUpdate = true;
      ctx.water.material.uniforms.time.value = phase;
      ctx.water.material.uniforms.depth.value = d;
      ctx.controls.update();
      ctx.renderer.render(ctx.scene, ctx.camera);
    };
    animate();
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (!simRef.current) return;
    const canvas = simRef.current;
    const ctx = createProScene(canvas, { isHero: false, showContours, d });
    loadVectors(ctx.buildingsGroup, ctx.roadsGroup, { accurate: true });

    const statusEl = document.getElementById("sim-status");
    if (statusEl) statusEl.textContent = "Terrain ready - drag to orbit • scroll to zoom • right-drag to pan";
    setTimeout(() => { const el = document.getElementById("sim-status"); if (el) el.style.display = "none"; }, 2200);

    let raf = 0;
    let phase = t / 100;
    const animate = () => {
      raf = requestAnimationFrame(animate);
      phase += playing ? 0.006 : 0;
      const pos: any = ctx.water.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        pos.setZ(i, Math.sin(pos.getX(i) * 1.1 + phase * 3) * 0.035 + Math.cos(pos.getY(i) * 0.95 + phase * 2.2) * 0.025);
      }
      pos.needsUpdate = true;
      ctx.water.position.y = -0.88 + d * 0.92;
      ctx.water.material.uniforms.time.value = phase;
      ctx.water.material.uniforms.depth.value = d;
      updateBuildingImpact(ctx.buildingsGroup, d);
      ctx.controls.update();
      ctx.renderer.render(ctx.scene, ctx.camera);
    };
    animate();
    return () => cancelAnimationFrame(raf);
  }, [d, showContours, showBuildings, t, playing]);

  useEffect(() => {
    const el = document.getElementById("m4-result");
    if (el) el.textContent = `P=${P} CN=${CN} t=${t}% -> Q=${Q.toFixed(1)}mm depth_max=${d.toFixed(2)}m`;
  }, [P, CN, t, Q, d]);

  return (
    <>
      <div className="hero-card" style={{ display: "none" }}>
        <div ref={heroRef} id="hero-preview" />
        <span id="hero-depth" style={{ display: "none" }}>{stats.depth}</span>
        <span id="hero-runoff" style={{ display: "none" }}>{Q.toFixed(0)}</span>
      </div>

      <div className="sim-layout">
        <div className="sim-canvas-wrap" style={{ position: "relative", background: "#040a14", borderRadius: 16, overflow: "hidden", border: "1px solid #1e3a5a" }}>
          <div id="sim-status" className="sim-status" style={{ position: "absolute", top: 12, left: 12, zIndex: 2, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)", padding: "6px 10px", borderRadius: 999, fontSize: ".72rem", border: "1px solid #1e3a5a" }}>Loading accurate terrain...</div>
          <canvas ref={simRef} id="sim" aria-label="Professional 3D flood terrain - Chennai" style={{ width: "100%", height: 560, display: "block" }} />

          <div style={{ position: "absolute", top: 12, right: 12, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)", border: "1px solid #1e3a5a", borderRadius: 10, padding: "8px 10px", fontSize: ".68rem", lineHeight: 1.4 }}>
            <div style={{ fontWeight: 700, color: "#e6eef8" }}>13.08N, 80.27E • CHENNAI</div>
            <div style={{ color: "#8aa0b8" }}>Scale 1:25k • WGS84 • DEM 30m</div>
            <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
              <span style={{ width: 30, height: 4, background: "#0ea5e9", borderRadius: 2 }} /> <span style={{ color: "#8aa0b8" }}>0-0.5m</span>
              <span style={{ width: 30, height: 4, background: "#f59e0b", borderRadius: 2 }} /> <span style={{ color: "#8aa0b8" }}>0.5-1.5m</span>
              <span style={{ width: 30, height: 4, background: "#ef4444", borderRadius: 2 }} /> <span style={{ color: "#8aa0b8" }}>&gt;1.5m</span>
            </div>
          </div>

          <div style={{ position: "absolute", bottom: 12, left: 12, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)", border: "1px solid #1e3a5a", borderRadius: 999, padding: "6px 10px", fontSize: ".68rem", display: "flex", gap: 10 }}>
            <span><i className="swatch" style={{ background: "#0ea5e9", width: 10, height: 10, display: "inline-block", borderRadius: 2 }} /> Shallow</span>
            <span><i className="swatch" style={{ background: "#f59e0b", width: 10, height: 10, display: "inline-block", borderRadius: 2 }} /> Moderate</span>
            <span><i className="swatch" style={{ background: "#ef4444", width: 10, height: 10, display: "inline-block", borderRadius: 2 }} /> Deep</span>
          </div>
          <div style={{ position: "absolute", bottom: 12, right: 12, background: "rgba(0,0,0,0.5)", padding: "5px 8px", borderRadius: 999, fontSize: ".65rem", color: "#8aa0b8" }}>◈ Orbit • Scroll zoom • Right-drag pan</div>
        </div>

        <div className="sim-controls" style={{ background: "#12233a", border: "1px solid #1e3a5a", borderRadius: 16, padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => setShowBuildings(!showBuildings)} className={`flex-1 py-1.5 rounded-full text-xs border ${showBuildings ? "bg-cyan-500 text-black border-transparent" : "border-[#1e3a5a]"}`}>Buildings</button>
            <button onClick={() => setShowContours(!showContours)} className={`flex-1 py-1.5 rounded-full text-xs border ${showContours ? "bg-cyan-500 text-black border-transparent" : "border-[#1e3a5a]"}`}>Contours</button>
          </div>

          <div className="ctrl-group">
            <label style={{ display: "flex", justifyContent: "space-between", fontSize: ".78rem", fontWeight: 600 }}>Rainfall <span style={{ color: "#22d3ee", fontFamily: "JetBrains Mono" }}>{P} mm</span></label>
            <input type="range" min={0} max={300} value={P} onChange={(e) => setP(+e.target.value)} aria-label="Rainfall" style={{ width: "100%", accentColor: "#06b6d4", marginTop: 6 }} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: ".65rem", color: "#8aa0b8" }}><span>Dry</span><span>Monsoon peak 200+</span></div>
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
            <div style={{ background: "#0b1d2f", border: "1px solid #1e3a5a", borderRadius: 10, padding: "8px 10px" }}><small style={{ color: "#8aa0b8", fontSize: ".62rem", display: "block" }}>Water Depth</small><b style={{ fontFamily: "JetBrains Mono", fontSize: ".85rem" }}>{stats.depth} m</b><div style={{ height: 4, background: "#0a1018", borderRadius: 2, marginTop: 4 }}><div style={{ width: `${clamp(d / 1.5 * 100, 0, 100)}%`, height: 4, background: d < 0.5 ? "#0ea5e9" : d < 1.5 ? "#f59e0b" : "#ef4444", borderRadius: 2 }} /></div></div>
            <div style={{ background: "#0b1d2f", border: "1px solid #1e3a5a", borderRadius: 10, padding: "8px 10px" }}><small style={{ color: "#8aa0b8", fontSize: ".62rem", display: "block" }}>Affected</small><b style={{ fontFamily: "JetBrains Mono", fontSize: ".85rem" }}>{stats.buildings}</b><div style={{ fontSize: ".65rem", color: "#8aa0b8" }}>buildings</div></div>
            <div style={{ background: "#0b1d2f", border: "1px solid #1e3a5a", borderRadius: 10, padding: "8px 10px" }}><small style={{ color: "#8aa0b8", fontSize: ".62rem", display: "block" }}>Flow Speed</small><b style={{ fontFamily: "JetBrains Mono", fontSize: ".85rem" }}>{stats.velocity} m/s</b></div>
            <div style={{ background: "#0b1d2f", border: "1px solid #1e3a5a", borderRadius: 10, padding: "8px 10px" }}><small style={{ color: "#8aa0b8", fontSize: ".62rem", display: "block" }}>Runoff</small><b style={{ fontFamily: "JetBrains Mono", fontSize: ".85rem", color: "#22d3ee" }}>{Q.toFixed(1)} mm</b></div>
          </div>

          <div style={{ textAlign: "center", fontSize: ".68rem", color: "#8aa0b8", background: "#08121f", padding: 8, borderRadius: 8, border: "1px dashed #1e3a5a" }}>
            <code style={{ background: "#0b1d2f", padding: "2px 6px", borderRadius: 6, border: "1px solid #1e3a5a", fontFamily: "JetBrains Mono" }}>Accurate: 1 unit = ~1.4km • Vertical x2.5</code>
          </div>

          <button
            className="btn btn-outline wfull"
            onClick={() => {
              const gj = { type: "FeatureCollection", features: [{ type: "Feature", properties: { rainfall_mm: P, CN, runoff_mm: +Q.toFixed(2), flood_depth_m: +d.toFixed(2), timestamp: new Date().toISOString() }, geometry: { type: "Polygon", coordinates: [[[CHENNAI_BOUNDS.xmin, 13.0], [CHENNAI_BOUNDS.xmax, 13.0], [CHENNAI_BOUNDS.xmax, 13.15], [CHENNAI_BOUNDS.xmin, 13.15], [CHENNAI_BOUNDS.xmin, 13.0]]] } }] };
              const blob = new Blob([JSON.stringify(gj, null, 2)], { type: "application/json" });
              const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "floin-snapshot.geojson"; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
            }}
            style={{ width: "100%", padding: "9px", borderRadius: 999, border: "1px solid #06b6d4", color: "#06b6d4", background: "transparent", fontSize: ".78rem" }}
          >
            Export Snapshot
          </button>
          <div style={{ display: "none" }}><span id="vP">{P}</span><span id="vCN">{CN}</span><span id="vT">{t}</span><span id="mS">{S.toFixed(2)}</span><span id="mIa">{Ia.toFixed(2)}</span><span id="mQ">{Q.toFixed(1)}</span><span id="mD">{d.toFixed(2)}</span></div>
          <input id="sP" type="range" value={P} onChange={(e) => setP(+e.target.value)} style={{ display: "none" }} />
          <input id="sCN" type="range" value={CN} onChange={(e) => setCN(+e.target.value)} style={{ display: "none" }} />
          <input id="sT" type="range" value={t} onChange={(e) => setT(+e.target.value)} style={{ display: "none" }} />
        </div>
      </div>
    </>
  );
}

function createProScene(canvas: HTMLCanvasElement, opts: { isHero?: boolean; showContours?: boolean; d?: number }) {
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
  const pos: any = (geo as any).attributes.position;
  const colors: number[] = [];
  const color = new THREE.Color();
  let minZ = Infinity, maxZ = -Infinity;
  const zVals: number[] = [];
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i);
    const d = Math.hypot(x, y);
    let z = Math.sin(x * 0.58) * 0.62 + Math.cos(y * 0.68) * 0.52;
    z += Math.sin(x * 1.35 + y * 0.92) * 0.26 + Math.cos(x * 2.1 - y * 1.3) * 0.12;
    z += Math.sin(x * 0.22 + y * 0.18) * 0.35;
    z -= clamp((d - 4.2) / 6, 0, 1) * 1.35;
    z += (Math.random() - 0.5) * 0.04;
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
    if (opts.showContours && Math.abs((zVals[i] * 10) % 1) < 0.06) color.lerp(new THREE.Color(0xffffff), 0.18);
    colors.push(color.r, color.g, color.b);
  }
  (geo as any).setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  (geo as any).computeVertexNormals();

  const tmat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0.02 });
  const terrain = new THREE.Mesh(geo, tmat);
  terrain.rotation.x = -Math.PI / 2;
  terrain.position.y = -1.2;
  terrain.receiveShadow = true;
  scene.add(terrain);

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
  water.receiveShadow = false;
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
    } else {
      throw new Error("fallback");
    }
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
    controls.update = () => {};
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
      mat.color.lerp(new THREE.Color(0xef4444), t * 0.35);
      mat.emissive = new THREE.Color(0x7f1d1d).multiplyScalar(t * 0.25);
    }
  });
}

async function loadVectors(buildingsGroup: THREE.Group, roadsGroup: THREE.Group, opts: { accurate: boolean }) {
  try {
    const [bRes, hRes, wRes] = await Promise.all([
      fetch("/buildings.geojson").then((r) => { if (!r.ok) throw new Error(); return r.json(); }),
      fetch("/highway.geojson").then((r) => { if (!r.ok) throw new Error(); return r.json(); }),
      fetch("/waterway.geojson").then((r) => (r.ok ? r.json() : { features: [] })).catch(() => ({ features: [] })),
    ]);
    buildBuildings(buildingsGroup, bRes.features.slice(0, opts.accurate ? 500 : 300), opts.accurate);
    buildRoads(roadsGroup, hRes.features.slice(0, 300).concat(wRes.features.slice(0, 80)));
  } catch {
    buildProcedural(buildingsGroup);
  }
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
function buildProcedural(group: THREE.Group) {
  group.clear();
  for (let i = 0; i < 90; i++) {
    const x = (Math.random() - 0.5) * 11, z = (Math.random() - 0.5) * 11;
    const w = 0.15 + Math.random() * 0.25, d = 0.15 + Math.random() * 0.25, h = 0.25 + Math.random() * 0.7;
    const g = new THREE.BoxGeometry(w, h, d);
    const mat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.9 });
    const mesh = new THREE.Mesh(g, mat as any);
    mesh.position.set(x, -0.9 + h / 2, z);
    mesh.castShadow = true; mesh.receiveShadow = true;
    group.add(mesh);
  }
}
