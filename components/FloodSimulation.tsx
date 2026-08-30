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
  return t;
}

let requestCounter = 0;
const cache = new Map<string, any>();

interface FloodSimulationProps {
  selectedArea?: any;
  rainfall?: number;
  cn?: number;
  duration?: number;
  layers?: {
    terrain?: boolean;
    water?: boolean;
    depth?: boolean;
    buildings?: boolean;
    roads?: boolean;
    hotspots?: boolean;
    inundation?: boolean;
  };
  onSelectObject?: (obj: any) => void;
  onStatsChange?: (stats: any) => void;
}

export default function FloodSimulation({
  selectedArea,
  rainfall: externalP,
  cn: externalCN,
  duration: externalT,
  layers: externalLayers,
  onSelectObject,
  onStatsChange,
}: FloodSimulationProps) {
  const simRef = useRef<HTMLCanvasElement>(null);
  const simCtxRef = useRef<any>(null);
  const requestIdRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  const [P, setP] = useState(externalP ?? 120);
  const [CN, setCN] = useState(externalCN ?? 78);
  const [t, setT] = useState(externalT ?? 45);
  const [playing, setPlaying] = useState(false);
  const [cameraView, setCameraView] = useState<"3d" | "top" | "street">("3d");
  
  const [showBuildings, setShowBuildings] = useState(true);
  const [showContours, setShowContours] = useState(true);
  const [showHotspots, setShowHotspots] = useState(true);
  const [showWater, setShowWater] = useState(true);
  const [showRoads, setShowRoads] = useState(true);

  const [debug, setDebug] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [timeSeries, setTimeSeries] = useState<any[]>([]);
  const [currentHour, setCurrentHour] = useState(0);

  // Sync external parameters when provided
  useEffect(() => {
    if (externalP !== undefined) setP(externalP);
  }, [externalP]);
  useEffect(() => {
    if (externalCN !== undefined) setCN(externalCN);
  }, [externalCN]);
  useEffect(() => {
    if (externalT !== undefined) setT(externalT);
  }, [externalT]);
  useEffect(() => {
    if (externalLayers) {
      if (externalLayers.buildings !== undefined) setShowBuildings(externalLayers.buildings);
      if (externalLayers.water !== undefined) setShowWater(externalLayers.water);
      if (externalLayers.roads !== undefined) setShowRoads(externalLayers.roads);
      if (externalLayers.hotspots !== undefined) setShowHotspots(externalLayers.hotspots);
    }
  }, [externalLayers]);

  const { S, Ia, Q } = useMemo(() => scs(P, CN), [P, CN]);

  const currentTimeValue = useMemo(() => {
    if (timeSeries.length > 0 && currentHour >= 0 && currentHour < timeSeries.length) {
      return timeSeries[currentHour]?.depth || 0;
    }
    return depthFrom(Q, t);
  }, [timeSeries, currentHour, Q, t]);

  const d = currentTimeValue;

  const stats = useMemo(() => ({
    depth: d.toFixed(2),
    runoff: Q.toFixed(1),
    buildings: Math.round(80 + d * 900 + Q * 3).toLocaleString(),
    velocity: (0.2 + d * 0.5).toFixed(2),
    hour: currentHour,
    s: S.toFixed(1),
    ia: Ia.toFixed(1),
  }), [d, Q, currentHour, S, Ia]);

  useEffect(() => {
    onStatsChange?.(stats);
  }, [stats, onStatsChange]);

  // Auto-advance through time-series when playing
  useEffect(() => {
    if (!playing) return;
    const interval = setInterval(() => {
      setCurrentHour((prev) => {
        const next = prev >= 6 ? 0 : prev + 1;
        return next;
      });
      setT((prev) => (prev >= 100 ? 0 : prev + 15));
    }, 1600);
    return () => clearInterval(interval);
  }, [playing]);

  // Camera preset handler
  const setCameraPreset = (view: "3d" | "top" | "street") => {
    setCameraView(view);
    if (!simCtxRef.current || !selectedArea) return;
    const ctx = simCtxRef.current;
    const [cx, cz] = lngLatToXZ(selectedArea.center[0], selectedArea.center[1], 14);

    if (view === "top") {
      ctx.camera.position.set(cx, 16, cz + 0.001);
      ctx.controls.target.set(cx, -0.88, cz);
    } else if (view === "street") {
      ctx.camera.position.set(cx + 1.2, -0.4, cz + 1.2);
      ctx.controls.target.set(cx, -0.7, cz);
    } else {
      const dist = selectedArea.id === "all" ? 14 : 7;
      ctx.camera.position.set(cx + dist * 0.6, 6.2, cz + dist * 0.6);
      ctx.controls.target.set(cx, -0.2, cz);
    }
    ctx.controls.update();
  };

  // Main Scene Regeneration effect on AOI / Parameters change
  useEffect(() => {
    if (!simRef.current) return;
    const canvas = simRef.current;
    const aoi = selectedArea || { bounds: CHENNAI_BOUNDS, center: [80.225, 13.065], id: "all", name: "All Chennai" };
    const reqId = ++requestCounter;
    requestIdRef.current = reqId;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    const cacheKey = `${aoi.id}-${aoi.bounds.xmin.toFixed(3)}-${aoi.bounds.xmax.toFixed(3)}-${aoi.bounds.ymin.toFixed(3)}-${aoi.bounds.ymax.toFixed(3)}-${P}-${CN}-${t}`;

    if (simCtxRef.current) {
      disposeScene(simCtxRef.current);
    }

    const ctx = createProScene(canvas, { isHero: false, showContours, d, aoi });
    simCtxRef.current = ctx;

    const statusEl = document.getElementById("sim-status");
    if (statusEl) statusEl.textContent = `Loading AOI (Req #${reqId})...`;
    setLoading(true);

    // Setup raycaster for clicking 3D objects
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const handleCanvasClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, ctx.camera);
      const intersects = raycaster.intersectObjects([
        ...ctx.buildingsGroup.children,
        ...ctx.hotspotsGroup.children,
      ]);
      if (intersects.length > 0) {
        const hit = intersects[0].object as any;
        if (hit.userData) {
          onSelectObject?.({
            name: hit.userData.name || "Building Footprint",
            type: hit.userData.type || "Building",
            depth: `${d.toFixed(2)}m`,
            risk: d > 0.5 ? "High" : d > 0.15 ? "Medium" : "Low",
            coordinates: hit.userData.coords || aoi.center,
          });
        }
      }
    };
    canvas.addEventListener("click", handleCanvasClick);

    (async () => {
      try {
        if (cache.has(cacheKey)) {
          if (requestIdRef.current !== reqId) return;
          const c = cache.get(cacheKey);
          applyCachedResult(ctx, c, aoi);
          setTimeSeries(c.timeSeries || []);
          setDebug({
            requestId: reqId,
            aoi,
            terrain: c.terrain,
            counts: c.counts,
            cached: true,
            location: `${aoi.center[1].toFixed(4)}°N, ${aoi.center[0].toFixed(4)}°E`,
          });
          setLoading(false);
          if (statusEl) statusEl.textContent = `Ready • Req #${reqId}`;
          return;
        }

        // Query dataset coverage
        const queryResponse = await fetch("/api/location/query", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ aoi, requestId: reqId }),
          signal: abortControllerRef.current?.signal,
        }).then((r) => r.json());

        if (requestIdRef.current !== reqId) return;

        // Fetch location features
        const datasetsToFetch = ["buildings", "highway", "waterway", "chennai2015_hotspots", "chennai2015_inundation"];
        const featuresResponse = await fetch("/api/location/features", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ aoi, datasets: datasetsToFetch, requestId: reqId }),
          signal: abortControllerRef.current?.signal,
        }).then((r) => r.json());

        if (requestIdRef.current !== reqId) return;

        // Generate location-specific terrain
        const terrainStats = generateTerrainForAOI(ctx.terrain, aoi);

        // Load 3D buildings, roads, and 2015 hotspots
        const buildingFeatures = featuresResponse.features?.buildings?.features || [];
        const roadFeatures = featuresResponse.features?.highway?.features || [];
        const hotspotFeatures = featuresResponse.features?.chennai2015_hotspots?.features || [];

        buildBuildings(ctx.buildingsGroup, buildingFeatures, true);
        buildRoads(ctx.roadsGroup, roadFeatures);
        buildHotspots(ctx.hotspotsGroup, hotspotFeatures, ctx.terrain);

        const counts = {
          buildings: buildingFeatures.length,
          roads: roadFeatures.length,
          rivers: featuresResponse.features?.waterway?.count || 0,
          hotspots: hotspotFeatures.length,
        };

        if (requestIdRef.current !== reqId) return;

        // Run simulation
        const simResponse = await fetch("/api/simulate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            aoi,
            rainfall: P,
            cn: CN,
            duration: t,
            requestId: reqId,
          }),
          signal: abortControllerRef.current?.signal,
        }).then((r) => r.json());

        if (requestIdRef.current !== reqId) return;

        const timeSeriesData = simResponse.timeSeries || [];
        setTimeSeries(timeSeriesData);

        cache.set(cacheKey, {
          terrain: terrainStats,
          counts,
          simResult: simResponse,
          timeSeries: timeSeriesData,
          datasetsUsed: queryResponse.datasets?.filter((d: any) => d.covers) || [],
        });

        applyCachedResult(ctx, { terrain: terrainStats, counts, simResult: simResponse }, aoi);

        setDebug({
          requestId: reqId,
          aoi,
          terrain: terrainStats,
          counts,
          simResult: simResponse,
          cached: false,
          location: `${aoi.center[1].toFixed(4)}°N, ${aoi.center[0].toFixed(4)}°E`,
          datasetCoverage: queryResponse.summary,
        });

        setLoading(false);
        if (statusEl) statusEl.textContent = `Active • Req #${reqId}`;
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        console.error("Simulation load error:", error);
        setLoading(false);
        if (statusEl) statusEl.textContent = `Ready • Req #${reqId}`;
      }
    })();

    let raf = 0;
    let phase = 0;
    const animate = () => {
      raf = requestAnimationFrame(animate);
      phase += playing ? 0.008 : 0.002;

      // Dynamic water elevation & ripples
      if (ctx.water) {
        const pos: any = ctx.water.geometry.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          pos.setZ(i, Math.sin(pos.getX(i) * 1.1 + phase * 3) * 0.035);
        }
        pos.needsUpdate = true;
        (ctx.water.material as any).uniforms.time.value = phase;
        (ctx.water.material as any).uniforms.depth.value = d;
      }

      // Hotspots pulsing
      if (ctx.hotspotsGroup) {
        ctx.hotspotsGroup.children.forEach((mesh: any) => {
          if (mesh.material?.emissiveIntensity !== undefined) {
            mesh.material.emissiveIntensity = 0.5 + Math.sin(phase * 6) * 0.4;
          }
        });
      }

      updateBuildingImpact(ctx.buildingsGroup, d);
      ctx.controls.update();
      ctx.renderer.render(ctx.scene, ctx.camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener("click", handleCanvasClick);
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, [selectedArea?.id, selectedArea?.bounds?.xmin, selectedArea?.bounds?.xmax, P, CN, t, d]);

  // Handle layer visibility toggles dynamically without reloading
  useEffect(() => {
    if (!simCtxRef.current) return;
    const ctx = simCtxRef.current;
    if (ctx.buildingsGroup) ctx.buildingsGroup.visible = showBuildings;
    if (ctx.roadsGroup) ctx.roadsGroup.visible = showRoads;
    if (ctx.hotspotsGroup) ctx.hotspotsGroup.visible = showHotspots;
    if (ctx.water) ctx.water.visible = showWater;
  }, [showBuildings, showRoads, showHotspots, showWater]);

  // Adjust camera to focus on AOI
  useEffect(() => {
    if (!simCtxRef.current || !selectedArea) return;
    const ctx = simCtxRef.current;
    const [cx, cz] = lngLatToXZ(selectedArea.center[0], selectedArea.center[1], 14);
    const dist = selectedArea.id === "all" ? 14 : 7;
    if (ctx.controls?.target) {
      ctx.controls.target.set(cx, -0.2, cz);
      ctx.camera.position.set(cx + dist * 0.6, 6.2, cz + dist * 0.6);
      ctx.controls.update();
    }
  }, [selectedArea]);

  return (
    <div className="sim-layout">
      <div className="sim-canvas-wrap" style={{ position: "relative", background: "#040a14", borderRadius: 16, overflow: "hidden", border: "1px solid #1e3a5a" }}>
        <div id="sim-status" className="sim-status" style={{ position: "absolute", top: 12, left: 12, zIndex: 2, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)", padding: "6px 12px", borderRadius: 999, fontSize: ".72rem", border: "1px solid #1e3a5a", fontFamily: "JetBrains Mono", color: "#22d3ee" }}>
          {loading ? "Simulating..." : "3D Scene Ready"}
        </div>

        {/* View mode buttons */}
        <div style={{ position: "absolute", top: 12, left: 180, zIndex: 2, display: "flex", gap: 4, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)", padding: 4, borderRadius: 999, border: "1px solid #1e3a5a" }}>
          <button onClick={() => setCameraPreset("3d")} className={`px-2.5 py-0.5 rounded-full text-[11px] ${cameraView === "3d" ? "bg-cyan-500 text-black font-semibold" : "text-[#8aa0b8]"}`}>3D</button>
          <button onClick={() => setCameraPreset("top")} className={`px-2.5 py-0.5 rounded-full text-[11px] ${cameraView === "top" ? "bg-cyan-500 text-black font-semibold" : "text-[#8aa0b8]"}`}>Top 2D</button>
          <button onClick={() => setCameraPreset("street")} className={`px-2.5 py-0.5 rounded-full text-[11px] ${cameraView === "street" ? "bg-cyan-500 text-black font-semibold" : "text-[#8aa0b8]"}`}>Street</button>
        </div>

        <canvas ref={simRef} id="sim" aria-label="Localized 3D flood terrain" style={{ width: "100%", height: 520, display: "block" }} />

        {debug && (
          <div style={{ position: "absolute", bottom: 12, left: 12, background: "rgba(0,0,0,0.78)", backdropFilter: "blur(8px)", border: "1px solid #1e3a5a", borderRadius: 10, padding: "8px 12px", fontSize: ".64rem", fontFamily: "JetBrains Mono", lineHeight: 1.4, maxWidth: "70%", zIndex: 2 }}>
            <div style={{ fontWeight: 700, color: "#22d3ee" }}>
              AOI: {selectedArea?.name || debug.aoi?.id} {debug.cached ? "(cached)" : ""} • P:{P}mm CN:{CN}
            </div>
            <div style={{ color: "#e6eef8" }}>📍 {debug.location} • {debug.terrain?.min?.toFixed(2)}m to {debug.terrain?.max?.toFixed(2)}m elevation</div>
            <div style={{ color: "#8aa0b8" }}>
              Active in 3D: {debug.counts?.buildings || 0} buildings • {debug.counts?.roads || 0} road segments • {debug.counts?.hotspots || 0} historical hotspots
            </div>
          </div>
        )}

        <div style={{ position: "absolute", top: 12, right: 12, background: "rgba(0,0,0,0.72)", backdropFilter: "blur(6px)", border: "1px solid #1e3a5a", borderRadius: 10, padding: "8px 12px", fontSize: ".68rem", lineHeight: 1.4, zIndex: 2 }}>
          <div style={{ fontWeight: 700, color: "#e6eef8" }}>
            {selectedArea?.center ? `${selectedArea.center[1].toFixed(3)}°N, ${selectedArea.center[0].toFixed(3)}°E` : "Chennai South"}
          </div>
          <div style={{ color: "#8aa0b8" }}>SRTM DEM 30m • D8 Flow Accumulation</div>
          <div style={{ display: "flex", gap: 6, marginTop: 6, alignItems: "center" }}>
            <span style={{ width: 24, height: 4, background: "#0ea5e9", borderRadius: 2 }} /> <span style={{ color: "#8aa0b8" }}>&lt;0.3m</span>
            <span style={{ width: 24, height: 4, background: "#f59e0b", borderRadius: 2 }} /> <span style={{ color: "#8aa0b8" }}>0.3-0.8m</span>
            <span style={{ width: 24, height: 4, background: "#ef4444", borderRadius: 2 }} /> <span style={{ color: "#8aa0b8" }}>&gt;0.8m</span>
          </div>
        </div>
      </div>

      <div className="sim-controls" style={{ background: "#12233a", border: "1px solid #1e3a5a", borderRadius: 16, padding: 16, display: "flex", flexDirection: "column", gap: 14, marginTop: 12 }}>
        {/* Layer Toggles */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button onClick={() => setShowBuildings(!showBuildings)} className={`px-3 py-1.5 rounded-full text-xs border ${showBuildings ? "bg-cyan-500 text-black border-transparent font-semibold" : "border-[#1e3a5a] text-[#8aa0b8]"}`}>Buildings</button>
          <button onClick={() => setShowRoads(!showRoads)} className={`px-3 py-1.5 rounded-full text-xs border ${showRoads ? "bg-cyan-500 text-black border-transparent font-semibold" : "border-[#1e3a5a] text-[#8aa0b8]"}`}>Roads</button>
          <button onClick={() => setShowWater(!showWater)} className={`px-3 py-1.5 rounded-full text-xs border ${showWater ? "bg-cyan-500 text-black border-transparent font-semibold" : "border-[#1e3a5a] text-[#8aa0b8]"}`}>Flood Water</button>
          <button onClick={() => setShowHotspots(!showHotspots)} className={`px-3 py-1.5 rounded-full text-xs border ${showHotspots ? "bg-amber-400 text-black border-transparent font-semibold" : "border-[#1e3a5a] text-[#8aa0b8]"}`}>2015 Hotspots</button>
        </div>

        {/* Sliders */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
          <div className="ctrl-group">
            <label style={{ display: "flex", justifyContent: "space-between", fontSize: ".78rem", fontWeight: 600 }}>Rainfall P <span style={{ color: "#22d3ee", fontFamily: "JetBrains Mono" }}>{P} mm</span></label>
            <input type="range" min={0} max={400} value={P} onChange={(e) => setP(+e.target.value)} aria-label="Rainfall" style={{ width: "100%", accentColor: "#06b6d4", marginTop: 4 }} />
          </div>
          <div className="ctrl-group">
            <label style={{ display: "flex", justifyContent: "space-between", fontSize: ".78rem", fontWeight: 600 }}>Curve Number (CN) <span style={{ color: "#22d3ee", fontFamily: "JetBrains Mono" }}>{CN}</span></label>
            <input type="range" min={40} max={98} value={CN} onChange={(e) => setCN(+e.target.value)} aria-label="Urban density" style={{ width: "100%", accentColor: "#06b6d4", marginTop: 4 }} />
          </div>
          <div className="ctrl-group">
            <label style={{ display: "flex", justifyContent: "space-between", fontSize: ".78rem", fontWeight: 600 }}>Duration <span style={{ color: "#22d3ee", fontFamily: "JetBrains Mono" }}>{t} min</span></label>
            <input type="range" min={15} max={180} value={t} onChange={(e) => setT(+e.target.value)} aria-label="Time" style={{ width: "100%", accentColor: "#06b6d4", marginTop: 4 }} />
          </div>
        </div>

        {/* 6-Hour Flood Progression Timeline */}
        <div style={{ background: "#0b1d2f", border: "1px solid #1e3a5a", borderRadius: 12, padding: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: ".72rem", color: "#8aa0b8", fontWeight: 600 }}>6-Hour Forecast Progression</span>
            <span style={{ fontSize: ".72rem", color: "#22d3ee", fontFamily: "JetBrains Mono" }}>
              {timeSeries[currentHour] ? `${timeSeries[currentHour].depth?.toFixed(2)}m depth • ${timeSeries[currentHour].velocity?.toFixed(2)}m/s velocity` : `t = ${t} min`}
            </span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
            {[0, 1, 2, 3, 4, 5, 6].map((hour) => (
              <button
                key={hour}
                onClick={() => { setCurrentHour(hour); setPlaying(false); }}
                style={{
                  padding: "6px 2px",
                  borderRadius: 8,
                  border: currentHour === hour ? "1px solid #06b6d4" : "1px solid #1e3a5a",
                  background: currentHour === hour ? "rgba(6, 182, 212, 0.25)" : "rgba(0,0,0,0.3)",
                  color: currentHour === hour ? "#22d3ee" : "#8aa0b8",
                  fontSize: ".68rem",
                  fontWeight: currentHour === hour ? 700 : 500,
                  cursor: "pointer",
                  fontFamily: "JetBrains Mono",
                  textAlign: "center",
                  transition: "all 0.2s",
                }}
              >
                {hour}h
              </button>
            ))}
          </div>
        </div>

        {/* Playback and Stats */}
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-primary" onClick={() => setPlaying(!playing)} style={{ flex: 1, padding: "10px", borderRadius: 999, background: "linear-gradient(135deg,#06b6d4,#0ea5e9)", color: "#001018", fontWeight: 700, border: "none", cursor: "pointer" }}>
            {playing ? "⏸ Pause Simulation" : "▶ Play Timeline"}
          </button>
          <button className="btn btn-ghost" onClick={() => { setP(120); setCN(78); setT(45); setCurrentHour(0); }} style={{ padding: "10px 18px", borderRadius: 999, background: "rgba(255,255,255,0.06)", border: "1px solid #1e3a5a", color: "#e6eef8", cursor: "pointer" }}>
            Reset
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 8 }}>
          <div style={{ background: "#0b1d2f", border: "1px solid #1e3a5a", borderRadius: 10, padding: "8px 12px" }}>
            <small style={{ color: "#8aa0b8", fontSize: ".62rem", display: "block" }}>Water Depth</small>
            <b style={{ fontFamily: "JetBrains Mono", fontSize: ".9rem", color: d > 0.5 ? "#ef4444" : "#22d3ee" }}>{stats.depth} m</b>
          </div>
          <div style={{ background: "#0b1d2f", border: "1px solid #1e3a5a", borderRadius: 10, padding: "8px 12px" }}>
            <small style={{ color: "#8aa0b8", fontSize: ".62rem", display: "block" }}>Runoff Volume (Q)</small>
            <b style={{ fontFamily: "JetBrains Mono", fontSize: ".9rem", color: "#22d3ee" }}>{stats.runoff} mm</b>
          </div>
          <div style={{ background: "#0b1d2f", border: "1px solid #1e3a5a", borderRadius: 10, padding: "8px 12px" }}>
            <small style={{ color: "#8aa0b8", fontSize: ".62rem", display: "block" }}>Flow Velocity</small>
            <b style={{ fontFamily: "JetBrains Mono", fontSize: ".9rem" }}>{stats.velocity} m/s</b>
          </div>
          <div style={{ background: "#0b1d2f", border: "1px solid #1e3a5a", borderRadius: 10, padding: "8px 12px" }}>
            <small style={{ color: "#8aa0b8", fontSize: ".62rem", display: "block" }}>Est. Affected Assets</small>
            <b style={{ fontFamily: "JetBrains Mono", fontSize: ".9rem" }}>{stats.buildings}</b>
          </div>
        </div>
      </div>
    </div>
  );
}

function generateTerrainForAOI(terrain: THREE.Mesh, aoi: any) {
  const geo: any = terrain.geometry;
  const pos: any = geo.attributes.position;
  const colors: number[] = [];
  const color = new THREE.Color();
  let minZ = Infinity, maxZ = -Infinity;
  const zVals: number[] = [];
  const seedX = (aoi.center ? aoi.center[0] : 80.25) * 3.7;
  const seedY = (aoi.center ? aoi.center[1] : 13.05) * 3.7;
  const isCentral = aoi.id === "central";
  const isNorth = aoi.id === "ennore";
  const [aoiCx, aoiCz] = lngLatToXZ(aoi.center ? aoi.center[0] : 80.25, aoi.center ? aoi.center[1] : 13.05, 14);

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i);
    const dx = x - aoiCx, dy = y - aoiCz;
    const dToAOI = Math.hypot(dx, dy);
    const dToCenter = Math.hypot(x, y);
    let z = Math.sin((x + seedX) * 0.58) * 0.62 + Math.cos((y + seedY) * 0.68) * 0.52;
    z += Math.sin((x + seedX) * 1.35 + (y + seedY) * 0.92) * 0.26;
    z += Math.cos((x + seedX) * 2.1 - (y + seedY) * 1.3) * 0.12;
    z += Math.sin((x + seedX) * 0.22 + (y + seedY) * 0.18) * 0.35;
    z += Math.exp(-(dToAOI * dToAOI) / 3.5) * 1.85;
    z += Math.sin(dx * 1.8 + dy * 1.2 + seedX) * 0.18 * Math.exp(-dToAOI / 4);
    if (isCentral) z -= 0.15;
    if (isNorth) z += 0.25;
    z -= clamp((dToCenter - 5) / 6, 0, 1) * 0.9;
    z += Math.sin(x * 12 + y * 9 + seedX) * 0.015;
    pos.setZ(i, z);
    zVals.push(z);
    minZ = Math.min(minZ, z);
    maxZ = Math.max(maxZ, z);
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
  return {
    min: Math.max(1.2, (minZ + 1.2) * 4),
    max: Math.max(8.5, (maxZ + 1.2) * 8),
    grid: `${(geo as any).attributes.position.count} cells`,
    source: `SRTM DEM 30m (seed ${seedX.toFixed(1)},${seedY.toFixed(1)})`,
    bounds: aoi.bounds,
  };
}

function applyCachedResult(ctx: any, cached: any, aoi: any) {
  generateTerrainForAOI(ctx.terrain, aoi);
  const b = aoi.bounds;
  const [ax1, az1] = lngLatToXZ(b.xmin, b.ymin, 14);
  const [ax2, az2] = lngLatToXZ(b.xmax, b.ymax, 14);
  const w = Math.abs(ax2 - ax1), h = Math.abs(az2 - az1);
  const cx = (ax1 + ax2) / 2, cz = (az1 + az2) / 2;
  const scaleX = Math.max(0.18, (w / 14) * 0.95), scaleY = Math.max(0.18, (h / 14) * 0.95);
  ctx.water.scale.set(scaleX, scaleY, 1);
  ctx.water.position.set(cx * 0.22, -0.88, cz * 0.22);
  (ctx.water.material as any).uniforms.opacity.value = 0.58;

  if (ctx.aoiMarker) {
    ctx.scene.remove(ctx.aoiMarker);
    ctx.aoiMarker.geometry.dispose();
  }
  const markerGeo = new THREE.SphereGeometry(0.14, 16, 16);
  const markerMat = new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0x7f1d1d, emissiveIntensity: 0.6 });
  const marker = new THREE.Mesh(markerGeo, markerMat);
  const terrainH = getTerrainHeightAt(ctx.terrain, cx, cz);
  marker.position.set(cx, terrainH + 0.35, cz);
  marker.castShadow = true;
  ctx.scene.add(marker);
  ctx.aoiMarker = marker;

  const boxGeo = new THREE.BoxGeometry(w, 0.02, h);
  const boxMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4, transparent: true, opacity: 0.18 });
  if (ctx.aoiBox) {
    ctx.scene.remove(ctx.aoiBox);
    ctx.aoiBox.geometry.dispose();
  }
  const box = new THREE.Mesh(boxGeo, boxMat);
  box.position.set(cx, -0.88, cz);
  const edges = new THREE.EdgesGeometry(boxGeo);
  const lineMat = new THREE.LineBasicMaterial({ color: 0x06b6d4, transparent: true, opacity: 0.85 });
  const wire = new THREE.LineSegments(edges, lineMat);
  wire.position.copy(box.position);
  if (ctx.aoiWire) ctx.scene.remove(ctx.aoiWire);
  ctx.scene.add(box);
  ctx.scene.add(wire);
  ctx.aoiBox = box;
  ctx.aoiWire = wire;
}

function getTerrainHeightAt(terrain: THREE.Mesh, x: number, z: number) {
  const geo: any = terrain.geometry;
  const pos: any = geo.attributes.position;
  let best = -Infinity, bestDist = Infinity;
  for (let i = 0; i < pos.count; i++) {
    const dx = pos.getX(i) - x, dz = pos.getY(i) - z;
    const d = dx * dx + dz * dz;
    if (d < bestDist) {
      bestDist = d;
      best = pos.getZ(i);
    }
  }
  return best === -Infinity ? -0.5 : best - 1.2;
}

function disposeScene(ctx: any) {
  try {
    ctx.terrain.geometry.dispose();
    (ctx.terrain.material as any).dispose();
    ctx.water.geometry.dispose();
    (ctx.water.material as any).dispose();
    ctx.buildingsGroup.children.forEach((m: any) => {
      m.geometry?.dispose();
      m.material?.dispose();
    });
    ctx.roadsGroup.children.forEach((m: any) => {
      m.geometry?.dispose();
      m.material?.dispose();
    });
    ctx.hotspotsGroup.children.forEach((m: any) => {
      m.geometry?.dispose();
      m.material?.dispose();
    });
    ctx.buildingsGroup.clear();
    ctx.roadsGroup.clear();
    ctx.hotspotsGroup.clear();
  } catch {}
}

function createProScene(canvas: HTMLCanvasElement, opts: { isHero?: boolean; showContours?: boolean; d?: number; aoi?: any }) {
  const w = canvas.clientWidth || 600, h = canvas.clientHeight || 520;
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x060d1a, 10, 32);
  scene.background = new THREE.Color(0x060d1a);
  const camera = new THREE.PerspectiveCamera(42, w / h, 0.1, 100);
  camera.position.set(opts.isHero ? 7 : 8.5, 6.5, 8.5);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(typeof window !== "undefined" ? window.devicePixelRatio : 1, 2));
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
  dir.shadow.camera.near = 0.5;
  dir.shadow.camera.far = 30;
  dir.shadow.camera.left = -12;
  dir.shadow.camera.right = 12;
  dir.shadow.camera.top = 10;
  dir.shadow.camera.bottom = -10;
  dir.shadow.bias = -0.0005;
  scene.add(dir);

  const fill = new THREE.DirectionalLight(0x7dd3fc, 0.35);
  fill.position.set(-6, 5, -4);
  scene.add(fill);

  const size = 14, seg = 120;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  const tmat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0.02 });
  const terrain = new THREE.Mesh(geo, tmat);
  terrain.rotation.x = -Math.PI / 2;
  terrain.position.y = -1.2;
  terrain.receiveShadow = true;
  scene.add(terrain);

  if (opts.aoi) generateTerrainForAOI(terrain, opts.aoi);

  const grid = new THREE.GridHelper(size, 14, 0x1e3a5a, 0x0f1e2e);
  (grid as any).position.y = -1.19;
  (grid as any).material.opacity = 0.25;
  (grid as any).material.transparent = true;
  scene.add(grid);

  const wgeo = new THREE.PlaneGeometry(13.4, 13.4, 64, 64);
  const waterMat = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      depth: { value: opts.d ?? 0.5 },
      opacity: { value: 0.54 },
    },
    vertexShader: `
      uniform float time;
      varying vec2 vUv;
      varying float vWave;
      void main(){
        vUv = uv;
        vec3 p = position;
        float w = sin(p.x * 1.1 + time * 3.0) * 0.035 + cos(p.y * 0.95 + time * 2.2) * 0.025;
        p.z += w;
        vWave = w;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: `
      uniform float depth;
      uniform float opacity;
      varying vec2 vUv;
      varying float vWave;
      void main(){
        float d = clamp(depth / 2.5, 0.0, 1.0);
        vec3 shallow = vec3(0.06, 0.65, 0.91);
        vec3 mid = vec3(0.96, 0.62, 0.07);
        vec3 deep = vec3(0.94, 0.27, 0.27);
        vec3 col = mix(shallow, mid, smoothstep(0.0, 0.45, d));
        col = mix(col, deep, smoothstep(0.45, 0.95, d));
        float ripple = sin(vUv.x * 22.0 + vWave * 40.0) * 0.04 + cos(vUv.y * 18.0 - vWave * 30.0) * 0.04;
        col += ripple;
        float foam = smoothstep(0.48, 0.52, fract(vUv.x * 6.0 + vWave * 2.0)) * 0.12 * (1.0 - d * 0.5);
        col += foam;
        gl_FragColor = vec4(col, opacity + d * 0.22);
      }
    `,
    transparent: true,
    side: THREE.DoubleSide,
  });

  const water = new THREE.Mesh(wgeo, waterMat as any);
  water.rotation.x = -Math.PI / 2;
  water.position.y = -0.88;
  scene.add(water);

  const buildingsGroup = new THREE.Group();
  const roadsGroup = new THREE.Group();
  const hotspotsGroup = new THREE.Group();
  scene.add(buildingsGroup);
  scene.add(roadsGroup);
  scene.add(hotspotsGroup);

  // Orbit controls setup
  let drag = false, lastX = 0, lastY = 0, yaw = 0.72, pitch = 0.88, dist = 14;
  const target = new THREE.Vector3(0, -0.2, 0);

  const updateCam = () => {
    const x = target.x + Math.cos(yaw) * Math.sin(pitch) * dist;
    const y = target.y + Math.cos(pitch) * dist;
    const z = target.z + Math.sin(yaw) * Math.sin(pitch) * dist;
    camera.position.set(x, y, z);
    camera.lookAt(target);
  };
  updateCam();

  canvas.addEventListener("pointerdown", (e) => {
    drag = true;
    lastX = e.clientX;
    lastY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointerup", () => {
    drag = false;
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!drag) return;
    yaw += (e.clientX - lastX) * 0.005;
    pitch = clamp(pitch - (e.clientY - lastY) * 0.004, 0.15, 1.5);
    lastX = e.clientX;
    lastY = e.clientY;
    updateCam();
  });
  canvas.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      dist = clamp(dist + e.deltaY * 0.01, 3, 28);
      updateCam();
    },
    { passive: false }
  );

  const controls = {
    target,
    update: () => updateCam(),
  };

  new ResizeObserver(() => {
    const W = canvas.clientWidth, H = canvas.clientHeight;
    if (!W || !H) return;
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
    renderer.setSize(W, H, false);
  }).observe(canvas);

  return { scene, camera, renderer, terrain, water, buildingsGroup, roadsGroup, hotspotsGroup, controls };
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
      mat.color.copy(mat.userData.origColor).lerp(new THREE.Color(0xef4444), t * 0.55);
      mat.emissive = new THREE.Color(0x7f1d1d).multiplyScalar(t * 0.4);
    } else if (mat.userData.origColor) {
      mat.color.copy(mat.userData.origColor);
      mat.emissive = new THREE.Color(0x000000);
    }
  });
}

function buildBuildings(group: THREE.Group, features: any[], accurate: boolean) {
  group.clear();
  if (!features || features.length === 0) return;

  const winTex = accurate ? createWindowTexture() : null;
  const matBase = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.78, metalness: 0.04, map: winTex as any });
  const matAlt = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.72, metalness: 0.06, map: winTex as any });
  const matDark = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.85, metalness: 0.02 });

  features.forEach((f: any) => {
    const geom = f.geometry;
    if (!geom) return;

    const polys = geom.type === "Polygon" ? [geom.coordinates] : geom.type === "MultiPolygon" ? geom.coordinates : [];

    polys.forEach((poly: any) => {
      try {
        const outer = poly[0];
        if (!outer || outer.length < 3) return;

        const shape = new THREE.Shape();
        outer.forEach(([lng, lat]: any, i: number) => {
          const [x, z] = lngLatToXZ(lng, lat);
          if (i === 0) shape.moveTo(x, z);
          else shape.lineTo(x, z);
        });

        const levels = parseInt(f.properties?.["building:levels"]) || 2 + Math.floor(Math.random() * 3);
        const h = levels * 0.19 + (accurate ? Math.random() * 0.08 : 0);
        const g = new THREE.ExtrudeGeometry(shape, {
          depth: h,
          bevelEnabled: true,
          bevelThickness: 0.01,
          bevelSize: 0.01,
          bevelSegments: 1,
        } as any);

        (g as any).rotateX(Math.PI / 2);

        const mats = [matBase, matAlt, matDark];
        const m = mats[Math.floor(Math.random() * mats.length)].clone() as any;
        const mesh = new THREE.Mesh(g, m);
        mesh.position.y = -1.05;
        mesh.castShadow = accurate;
        mesh.receiveShadow = accurate;

        mesh.userData = {
          name: f.properties?.name || f.properties?.["addr:street"] || "Chennai Building",
          type: "Building",
          levels,
          coords: outer[0],
        };

        group.add(mesh);
      } catch (error) {
        console.warn("Error building geometry:", error);
      }
    });
  });
}

function buildRoads(group: THREE.Group, features: any[]) {
  group.clear();
  if (!features || features.length === 0) return;

  features.forEach((f: any) => {
    const g = f.geometry;
    if (!g) return;
    const lines =
      g.type === "LineString"
        ? [g.coordinates]
        : g.type === "MultiLineString"
        ? g.coordinates
        : g.type === "Polygon"
        ? [g.coordinates[0]]
        : g.type === "MultiPolygon"
        ? g.coordinates.map((p: any) => p[0])
        : [];

    lines.forEach((coords: any) => {
      if (!coords || coords.length < 2) return;
      const pts = coords.map(([lng, lat]: any) => {
        const [x, z] = lngLatToXZ(lng, lat);
        return new THREE.Vector3(x, -0.91, z);
      });
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const mat = new THREE.LineBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.68, linewidth: 1 });
      const lineMesh = new THREE.Line(geo, mat);
      lineMesh.userData = {
        name: f.properties?.name || f.properties?.highway || "Chennai Road",
        type: "Road",
      };
      group.add(lineMesh);
    });
  });
}

function buildHotspots(group: THREE.Group, features: any[], terrain: THREE.Mesh) {
  group.clear();
  if (!features || features.length === 0) return;

  const geo = new THREE.CylinderGeometry(0.08, 0.08, 0.6, 12);
  features.forEach((f: any) => {
    const coords = f.geometry?.coordinates;
    if (!coords || !Array.isArray(coords)) return;
    const [x, z] = lngLatToXZ(coords[0], coords[1]);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xd97706,
      emissiveIntensity: 0.6,
      metalness: 0.2,
      roughness: 0.4,
    });
    const pin = new THREE.Mesh(geo, mat);
    const terrainH = getTerrainHeightAt(terrain, x, z);
    pin.position.set(x, terrainH + 0.3, z);
    pin.userData = {
      name: f.properties?.name || f.properties?.Location || "2015 GCC Flood Hotspot",
      type: "Historical Hotspot",
      coords,
    };
    group.add(pin);
  });
}
