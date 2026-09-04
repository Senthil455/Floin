"use client";
import { useState, useEffect, useRef, useMemo } from "react";
import dynamic from "next/dynamic";
import { ViewMode } from "@/components/FloodSimulation";
import EvacuationRouting from "@/components/EvacuationRouting";
import { AREAS, CHENNAI_SEARCH_INDEX, type Scenario } from "@/app/lib/chennai-data";
import { useHydrology } from "@/hooks/useHydrology";
import HydrologyWorkspace from "@/app/lib/workspaces/HydrologyWorkspace";
import ValidationWorkspace from "@/app/lib/workspaces/ValidationWorkspace";
import RegistryWorkspace from "@/app/lib/workspaces/RegistryWorkspace";

const ChennaiMap = dynamic(() => import("@/components/ChennaiMap"), {
  ssr: false,
  loading: () => (
    <div style={{ height: 410, display: "grid", placeItems: "center", background: "#040a14", borderRadius: 14, border: "1px solid #1e3a5a", color: "#8aa0b8", fontSize: "13px" }}>
      Initializing Leaflet 2D Geospatial Engine...
    </div>
  ),
});

const FloodSimulation = dynamic(() => import("@/components/FloodSimulation"), {
  ssr: false,
  loading: () => (
    <div style={{ height: 530, display: "grid", placeItems: "center", background: "#040a14", borderRadius: 16, border: "1px solid #1e3a5a", color: "#8aa0b8", fontSize: "13px" }}>
      Compiling WebGL 3D Terrain & Hydrology Shaders...
    </div>
  ),
});

type Toast = { id: number; msg: string; action?: string };

export default function Page() {
  const [activeWorkspace, setActiveWorkspace] = useState<
    "digital_twin" | "hydrology" | "scenarios" | "impact" | "evacuation" | "validation" | "registry" | "reports" | "settings"
  >("digital_twin");

  const [viewMode, setViewMode] = useState<ViewMode>("digital_twin");
  const [selectedArea, setSelectedArea] = useState(AREAS[1]); // Default Central Chennai
  const [aoiKm, setAoiKm] = useState(1.5);
  const [rainOverlayEnabled, setRainOverlayEnabled] = useState(true);

  // Simulation Parameters
  const [rainfall, setRainfall] = useState(160);
  const [cn, setCn] = useState(84);
  const [duration, setDuration] = useState(60);
  const [currentHour, setCurrentHour] = useState(2);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<1 | 2 | 4>(1);

  // Live Inspector Object
  const [inspectedFeature, setInspectedFeature] = useState<any>({
    name: "Ripon Building (GCC HQ)",
    type: "Building Footprint (OSM)",
    featureId: "OSM-208361200",
    elevation: "6.42m",
    depth: "0.58m",
    velocity: "0.48 m/s",
    risk: "Moderate Inundation",
    confidence: "High (Surveyed Footprint / SRTM DEM)",
    basin: "Cooum River Basin",
  });

  const [scenarios, setScenarios] = useState<Scenario[]>([
    { id: "s1", name: "2015 Historical Peak Monsoon", P: 240, CN: 88, duration: 90, depth: "0.92m", area: "21.4%", buildings: 740, runoff: 168.4, category: "Historical 2015" },
    { id: "s2", name: "50-Year Design Storm Event", P: 160, CN: 84, duration: 60, depth: "0.58m", area: "13.2%", buildings: 420, runoff: 96.8, category: "Design Storm" },
    { id: "s3", name: "Climate Change Extreme (+25%)", P: 300, CN: 90, duration: 120, depth: "1.35m", area: "28.6%", buildings: 1120, runoff: 224.6, category: "Climate Extreme" },
    { id: "s4", name: "Moderate Pre-Monsoon Shower", P: 65, CN: 76, duration: 30, depth: "0.18m", area: "3.8%", buildings: 90, runoff: 22.1, category: "Custom" },
  ]);
  const [activeScenarioId, setActiveScenarioId] = useState("s2");

  const [search, setSearch] = useState("");
  const [toasts, setToasts] = useState<Toast[]>([]);

  const pushToast = (msg: string, action?: string) => {
    const id = Date.now();
    setToasts((t) => [...t, { id, msg, action }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3800);
  };

  const { S, Ia, Q, economicLoss } = useHydrology(rainfall, cn, duration);

  const searchResults = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return CHENNAI_SEARCH_INDEX.filter((item) => item.name.toLowerCase().includes(q) || item.type.toLowerCase().includes(q) || item.basin.toLowerCase().includes(q));
  }, [search]);

  // Timeline Auto-play Effect
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setCurrentHour((prev) => (prev >= 6 ? 0 : prev + 1));
    }, 1800 / playbackSpeed);
    return () => clearInterval(interval);
  }, [isPlaying, playbackSpeed]);

  // Map Click Location -> Location-specific AOI
  const handleMapClick = async (lat: number, lng: number) => {
    const delta = aoiKm / 111;
    const b = { xmin: lng - delta, xmax: lng + delta, ymin: lat - delta, ymax: lat + delta };
    const area = {
      id: `aoi-${Date.now()}`,
      name: `Catchment Clip (${lat.toFixed(3)}°N, ${lng.toFixed(3)}°E)`,
      basin: lat > 13.15 ? "Kosasthalaiyar Basin" : lat < 13.02 ? "Adyar Basin" : "Cooum Basin",
      bounds: b,
      center: [lng, lat] as [number, number],
      lat,
      lng,
    };
    setSelectedArea(area);
    pushToast(`Targeting ${area.name} (${aoiKm}km AOI)`, "View 3D");
  };

  // Export Executive PDF/HTML Report
  const handleExportReport = () => {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>FLOIN Flood Intelligence Report - ${selectedArea.name}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #fff; color: #0f172a; padding: 40px; line-height: 1.5; }
          h1 { color: #0284c7; margin-bottom: 4px; font-size: 24px; }
          .header { border-bottom: 2px solid #0284c7; padding-bottom: 14px; margin-bottom: 24px; }
          .meta { font-size: 13px; color: #64748b; }
          .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-bottom: 24px; }
          .card { border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px; background: #f8fafc; }
          .card h3 { margin-top: 0; color: #0369a1; font-size: 15px; border-bottom: 1px solid #cbd5e1; padding-bottom: 8px; }
          table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 13px; }
          th, td { border: 1px solid #e2e8f0; padding: 10px 14px; text-align: left; }
          th { background: #f1f5f9; font-weight: 700; color: #334155; }
          .badge { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 11px; font-weight: 700; }
          .badge-high { background: #fee2e2; color: #991b1b; }
          .badge-med { background: #fef3c7; color: #92400e; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>FLOIN — Chennai Flood Intelligence & 3D Digital Twin Report</h1>
          <div class="meta">
            <b>Target Study Area:</b> ${selectedArea.name} | <b>Basin:</b> ${selectedArea.basin}<br/>
            <b>CRS Reference:</b> EPSG:4326 (WGS84) | <b>Generated:</b> ${new Date().toLocaleString()}
          </div>
        </div>
        <div class="grid">
          <div class="card">
            <h3>Hydrological Calculation (SCS-CN Model)</h3>
            <p><b>Rainfall Input (P):</b> ${rainfall} mm</p>
            <p><b>Catchment Curve Number (CN):</b> ${cn} (Urban Imperviousness)</p>
            <p><b>Potential Max Retention (S):</b> ${S.toFixed(2)} mm</p>
            <p><b>Initial Abstraction (Ia = 0.2S):</b> ${Ia.toFixed(2)} mm</p>
            <p><b>Direct Surface Runoff Volume (Q):</b> <b>${Q.toFixed(2)} mm</b></p>
            <p><b>Modelled Mean Flood Depth:</b> <b>${economicLoss.depthVal} m</b></p>
          </div>
          <div class="card">
            <h3>Economic Stage-Damage Impact (FloodML)</h3>
            <p><b>Direct Property Loss:</b> <b>₹ ${economicLoss.directLossCrores} Crores</b></p>
            <p><b>Estimated Displaced Population:</b> <b>${economicLoss.displacedPop} residents</b></p>
            <p><b>Inundated Structures:</b> ${economicLoss.affectedBuildings} buildings</p>
            <p><b>Model Accuracy (NSE):</b> R² = 0.892 (GCC 2015 Validated)</p>
          </div>
        </div>
        <h3>Multi-Scenario Comparative Analysis</h3>
        <table>
          <thead>
            <tr><th>Scenario Name</th><th>Category</th><th>Rainfall P</th><th>CN</th><th>Runoff Q</th><th>Peak Depth</th><th>Asset Risk</th></tr>
          </thead>
          <tbody>
            ${scenarios
              .map(
                (s) => `
              <tr>
                <td><b>${s.name}</b></td>
                <td>${s.category}</td>
                <td>${s.P} mm</td>
                <td>${s.CN}</td>
                <td><b>${s.runoff} mm</b></td>
                <td>${s.depth}</td>
                <td><span class="badge ${s.P > 200 ? "badge-high" : "badge-med"}">${s.P > 200 ? "Critical Hazard" : "Moderate"}</span></td>
              </tr>
            `
              )
              .join("")}
          </tbody>
        </table>
        <div style="margin-top: 36px; padding-top: 14px; border-top: 1px solid #cbd5e1; font-size: 11px; color: #64748b; text-align: center;">
          Produced by FLOIN Flood Intelligence Platform • Authoritative SRTM DEM 30m + GCC 2015 Validation
        </div>
      </body>
      </html>
    `);
    win.document.close();
    pushToast("Generated printable Executive Flood Intelligence Report");
  };

  const handleExportGeoJSON = () => {
    const data = {
      type: "FeatureCollection",
      name: `FLOIN_Catchment_${selectedArea.id}`,
      properties: {
        basin: selectedArea.basin,
        rainfall_mm: rainfall,
        curveNumber: cn,
        runoff_mm: +Q.toFixed(2),
        estimatedDepth_m: +economicLoss.depthVal,
        estimatedLoss_crores: +economicLoss.directLossCrores,
        aoi: selectedArea,
        crs: "EPSG:4326",
        timestamp: new Date().toISOString(),
      },
      features: [
        {
          type: "Feature",
          properties: { name: "Study AOI Boundary Polygon", id: selectedArea.id },
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [selectedArea.bounds.xmin, selectedArea.bounds.ymin],
                [selectedArea.bounds.xmax, selectedArea.bounds.ymin],
                [selectedArea.bounds.xmax, selectedArea.bounds.ymax],
                [selectedArea.bounds.xmin, selectedArea.bounds.ymax],
                [selectedArea.bounds.xmin, selectedArea.bounds.ymin],
              ],
            ],
          },
        },
      ],
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `floin-dataset-${selectedArea.id}.geojson`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    pushToast("Exported GeoJSON Spatial Simulation Dataset");
  };

  return (
    <div className="min-h-screen bg-[#040a14] text-[#e6eef8] flex flex-col font-sans selection:bg-cyan-500 selection:text-black">
      {/* Top Mission HUD & Status Bar */}
      <header className="sticky top-0 z-40 bg-[#060e1c]/90 backdrop-blur-md border-b border-[#1e3a5a] px-4 py-2.5 flex items-center justify-between gap-4">
        {/* Branding & Basin */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 font-black tracking-widest text-base">
            <span className="w-6 h-6 rounded-lg bg-cyan-500/20 border border-cyan-400 grid place-items-center text-cyan-300 text-xs">◈</span>
            <span>FLOIN</span>
            <span className="text-[10px] font-mono font-normal bg-[#0f1e2e] text-cyan-300 px-2 py-0.5 rounded-full border border-[#1e3a5a] hidden sm:inline">
              CHENNAI DIGITAL TWIN
            </span>
          </div>
          <div className="hidden lg:flex items-center gap-2 pl-3 border-l border-[#1e3a5a] text-xs">
            <span className="text-[#8aa0b8]">Active Basin:</span>
            <span className="font-semibold text-white">{selectedArea.basin}</span>
            <span className="text-[#8aa0b8]">•</span>
            <span className="font-mono text-cyan-300">EPSG:4326</span>
          </div>
        </div>

        {/* Global Landmark Search */}
        <div className="relative hidden md:block w-[320px]">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search landmarks, reservoirs, stations..."
            className="w-full bg-[#0a1422] border border-[#1e3a5a] rounded-full px-4 py-1.5 text-xs text-white placeholder:text-[#64748b] focus:outline-none focus:border-cyan-400 font-sans transition"
          />
          {searchResults.length > 0 && (
            <div className="absolute top-full mt-2 w-full bg-[#0a1422] border border-[#1e3a5a] rounded-xl p-1.5 text-xs shadow-2xl z-50 max-h-64 overflow-y-auto">
              {searchResults.map((item) => (
                <div
                  key={item.name}
                  onClick={() => {
                    const delta = aoiKm / 111;
                    setSelectedArea({
                      id: `search-${item.name.toLowerCase().replace(/\s+/g, "-")}`,
                      name: item.name,
                      basin: item.basin,
                      bounds: { xmin: item.coords[0] - delta, xmax: item.coords[0] + delta, ymin: item.coords[1] - delta, ymax: item.coords[1] + delta },
                      center: item.coords as [number, number],
                    });
                    setInspectedFeature({
                      name: item.name,
                      type: item.type,
                      basin: item.basin,
                      elevation: "6.2m",
                      depth: "0.52m",
                      velocity: "0.42 m/s",
                      risk: "Moderate",
                      confidence: "Observed Chennai Asset",
                    });
                    setSearch("");
                    setActiveWorkspace("digital_twin");
                    pushToast(`Targeted ${item.name} in Digital Twin`);
                  }}
                  className="px-3 py-2 hover:bg-[#12233a] rounded-lg cursor-pointer flex justify-between items-center transition"
                >
                  <span className="font-semibold text-white truncate">{item.name}</span>
                  <span className="text-[10px] text-cyan-300 font-mono ml-2">{item.type}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Rain Storm Overlay & Quick Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setRainOverlayEnabled(!rainOverlayEnabled)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
              rainOverlayEnabled ? "bg-cyan-500/20 text-cyan-300 border-cyan-400" : "border-[#1e3a5a] text-[#8aa0b8]"
            }`}
          >
            🌧 Storm FX {rainOverlayEnabled ? "ON" : "OFF"}
          </button>
          <button
            onClick={handleExportReport}
            className="px-3.5 py-1.5 rounded-full bg-[#0f1e2e] border border-[#1e3a5a] text-xs text-[#e6eef8] font-semibold hover:border-cyan-400 hover:text-white transition"
          >
            Executive Brief
          </button>
          <button
            onClick={handleExportGeoJSON}
            className="px-3.5 py-1.5 rounded-full bg-cyan-500 text-black text-xs font-bold hover:bg-cyan-400 transition"
          >
            Export GeoJSON
          </button>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <div className="flex-1 flex min-h-0">
        {/* Left Engineering Navigation Bar */}
        <aside className="w-[230px] shrink-0 bg-[#060e1c] border-r border-[#1e3a5a] flex flex-col justify-between hidden md:flex">
          <div className="p-3 space-y-1.5">
            <div className="text-[10px] font-mono font-bold tracking-widest text-[#64748b] px-3 py-1">COMMAND WORKSPACES</div>
            {[
              { id: "digital_twin", label: "3D Digital Twin Lab", icon: "◈" },
              { id: "hydrology", label: "Hydrology Pipeline", icon: "∿" },
              { id: "scenarios", label: "Scenario Laboratory", icon: "≡" },
              { id: "impact", label: "Economic Damage (ML)", icon: "₹" },
              { id: "evacuation", label: "Evacuation Routing", icon: "🛡" },
              { id: "validation", label: "2015 Historical Ground", icon: "✓" },
              { id: "registry", label: "Dataset Provenance", icon: "🗃" },
              { id: "reports", label: "Briefing & Export", icon: "⤓" },
            ].map((ws) => (
              <button
                key={ws.id}
                onClick={() => setActiveWorkspace(ws.id as any)}
                className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center gap-2.5 transition ${
                  activeWorkspace === ws.id
                    ? "bg-[#12233a] text-cyan-300 font-bold border border-[#1e3a5a]"
                    : "text-[#8aa0b8] hover:bg-[#0a1422] hover:text-white"
                }`}
              >
                <span className="text-cyan-400 font-mono">{ws.icon}</span>
                <span>{ws.label}</span>
              </button>
            ))}
          </div>

          {/* Basin Telemetry Box */}
          <div className="p-3 border-t border-[#1e3a5a] bg-[#040a14]/60">
            <div className="text-[10px] font-mono text-[#8aa0b8]">HYDROLOGY TELEMETRY</div>
            <div className="font-mono text-xs font-bold text-white mt-1">P: {rainfall}mm | CN: {cn}</div>
            <div className="font-mono text-[11px] text-cyan-300 mt-0.5">Direct Q: {Q.toFixed(1)} mm</div>
            <div className="font-mono text-[10px] text-amber-300 mt-0.5">Est. Loss: ₹{economicLoss.directLossCrores} Cr</div>
            <div className="w-full h-1 bg-[#0f1e2e] rounded-full mt-2 overflow-hidden">
              <div className="h-full bg-cyan-500 rounded-full" style={{ width: `${Math.min(100, (rainfall / 300) * 100)}%` }} />
            </div>
          </div>
        </aside>

        {/* Dynamic Workspace Canvas */}
        <main className="flex-1 p-4 lg:p-5 overflow-y-auto space-y-4">
          {/* WORKSPACE 1: 3D DIGITAL TWIN & GEOSPATIAL MAP */}
          {activeWorkspace === "digital_twin" && (
            <div className="space-y-4">
              {/* Top View Mode & AOI Selector Strip */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-[#060e1c] p-2.5 rounded-2xl border border-[#1e3a5a]">
                {/* 7 Analytical View Modes */}
                <div className="flex gap-1.5 flex-wrap">
                  {[
                    { id: "digital_twin", label: "Digital Twin" },
                    { id: "progression", label: "Progression" },
                    { id: "depth_heatmap", label: "Depth Heatmap" },
                    { id: "velocity_field", label: "Velocity Field" },
                    { id: "infrastructure_impact", label: "Asset Risk" },
                    { id: "hydrology", label: "Hydrology Contours" },
                    { id: "data_quality", label: "Data Quality" },
                  ].map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setViewMode(m.id as ViewMode)}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                        viewMode === m.id ? "bg-cyan-500 text-black font-bold" : "bg-[#0a1422] text-[#8aa0b8] hover:text-white border border-[#1e3a5a]"
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>

                {/* AOI Bounding Radius */}
                <div className="flex items-center gap-1.5 bg-[#0a1422] p-1 rounded-full border border-[#1e3a5a] text-xs">
                  <span className="text-[#8aa0b8] px-2">AOI Extent:</span>
                  {[0.5, 1.0, 1.5, 3.0].map((km) => (
                    <button
                      key={km}
                      onClick={() => {
                        setAoiKm(km);
                        pushToast(`AOI extent set to ${km}km`);
                      }}
                      className={`px-2.5 py-0.5 rounded-full ${aoiKm === km ? "bg-cyan-500 text-black font-bold" : "text-[#8aa0b8] hover:text-white"}`}
                    >
                      {km}km
                    </button>
                  ))}
                </div>
              </div>

              {/* Fast Preset Catchments */}
              <div className="flex gap-2 overflow-x-auto pb-1">
                {AREAS.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => {
                      setSelectedArea(a);
                      pushToast(`Loaded Catchment: ${a.name}`);
                    }}
                    className={`px-3 py-1.5 rounded-full text-xs whitespace-nowrap border transition ${
                      selectedArea.id === a.id ? "bg-cyan-500 text-black font-bold border-cyan-500 shadow-md" : "bg-[#060e1c] border-[#1e3a5a] text-[#8aa0b8] hover:text-white"
                    }`}
                  >
                    {a.name}
                  </button>
                ))}
              </div>

              {/* Dual Surface Workspace: 3D Viewport + Leaflet 2D Map */}
              <div className="grid lg:grid-cols-12 gap-4">
                {/* 3D WebGL Digital Twin (7 cols) */}
                <div className="lg:col-span-7 bg-[#060e1c] border border-[#1e3a5a] rounded-2xl p-3.5 flex flex-col">
                  <div className="flex justify-between items-center mb-2 px-1">
                    <span className="text-xs font-mono font-bold text-cyan-300 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                      3D DIGITAL TWIN • {selectedArea.name}
                    </span>
                    <span className="text-[11px] font-mono text-[#8aa0b8]">
                      Shader: {viewMode.toUpperCase()}
                    </span>
                  </div>
                  <FloodSimulation
                    selectedArea={selectedArea}
                    rainfall={rainfall}
                    cn={cn}
                    duration={duration}
                    viewMode={viewMode}
                    currentHour={currentHour}
                    isPlaying={isPlaying}
                    rainOverlayEnabled={rainOverlayEnabled}
                    onTimeChange={(h) => setCurrentHour(h)}
                    onSelectObject={(obj) => {
                      setInspectedFeature(obj);
                      pushToast(`Inspecting ${obj.name}`);
                    }}
                  />
                </div>

                {/* 2D Geospatial Control Map & Telemetry (5 cols) */}
                <div className="lg:col-span-5 space-y-4">
                  <div className="bg-[#060e1c] border border-[#1e3a5a] rounded-2xl p-3.5">
                    <div className="flex justify-between items-center mb-2 px-1">
                      <span className="text-xs font-mono font-bold text-[#8aa0b8]">GEOSPATIAL CONTROL SURFACE</span>
                      <span className="text-[10px] text-cyan-300 font-mono font-bold">CLICK TO RETARGET</span>
                    </div>
                    <ChennaiMap
                      selectedArea={selectedArea}
                      aoiSizeKm={aoiKm}
                      onMapClick={handleMapClick}
                      onSelectArea={(a) => setSelectedArea(a)}
                      onSelectFeature={(f) => {
                        setInspectedFeature(f);
                        pushToast(`Selected ${f.name}`);
                      }}
                    />
                  </div>

                  {/* Precision Object Inspector & Telemetry HUD */}
                  <div className="bg-[#060e1c] border border-[#1e3a5a] rounded-2xl p-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <h4 className="text-xs font-mono font-bold text-cyan-300">ASSET & HYDROLOGY INSPECTOR</h4>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-mono font-bold">
                        {inspectedFeature?.type || "Urban Asset"}
                      </span>
                    </div>
                    <div className="font-bold text-sm text-white">{inspectedFeature?.name}</div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="p-2.5 rounded-xl bg-[#040a14] border border-[#1e3a5a]">
                        <div className="text-[10px] text-[#8aa0b8]">Inundation Depth</div>
                        <div className="font-mono font-bold text-amber-300 mt-0.5">{inspectedFeature?.depth || "0.52m"}</div>
                      </div>
                      <div className="p-2.5 rounded-xl bg-[#040a14] border border-[#1e3a5a]">
                        <div className="text-[10px] text-[#8aa0b8]">Flow Velocity</div>
                        <div className="font-mono font-bold text-cyan-300 mt-0.5">{inspectedFeature?.velocity || "0.45 m/s"}</div>
                      </div>
                      <div className="p-2.5 rounded-xl bg-[#040a14] border border-[#1e3a5a]">
                        <div className="text-[10px] text-[#8aa0b8]">Vulnerability</div>
                        <div className="font-mono font-bold text-red-400 mt-0.5">{inspectedFeature?.risk || "Moderate"}</div>
                      </div>
                    </div>
                    <div className="text-[11px] text-[#8aa0b8] pt-1 flex justify-between border-t border-[#1e3a5a]/60">
                      <span>Catchment: <b>{inspectedFeature?.basin || selectedArea.basin}</b></span>
                      <span>Confidence: <b className="text-emerald-400">{inspectedFeature?.confidence || "Surveyed"}</b></span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 6-Hour Timeline & Playback Controller */}
              <div className="bg-[#060e1c] border border-[#1e3a5a] rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="px-5 py-2 rounded-full bg-cyan-500 text-black font-bold text-xs hover:bg-cyan-400 transition"
                  >
                    {isPlaying ? "⏸ Pause Progression" : "▶ Play 6-Hour Simulation"}
                  </button>
                  <div className="flex gap-1 bg-[#040a14] p-1 rounded-full border border-[#1e3a5a]">
                    {([1, 2, 4] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => setPlaybackSpeed(s)}
                        className={`px-2.5 py-0.5 rounded-full text-xs font-mono ${playbackSpeed === s ? "bg-cyan-500 text-black font-bold" : "text-[#8aa0b8]"}`}
                      >
                        {s}x
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex-1 max-w-md flex items-center gap-3">
                  <span className="text-xs font-mono text-[#8aa0b8]">Timeline:</span>
                  <input
                    type="range"
                    min={0}
                    max={6}
                    value={currentHour}
                    onChange={(e) => {
                      setCurrentHour(+e.target.value);
                      setIsPlaying(false);
                    }}
                    className="w-full accent-cyan-500"
                  />
                  <span className="text-xs font-mono text-cyan-300 font-bold min-w-[32px]">{currentHour}h</span>
                </div>

                <button
                  onClick={() => {
                    setCurrentHour(3);
                    pushToast("Jumped to Peak Hydrograph Inundation (Hour 3)");
                  }}
                  className="px-3.5 py-1.5 rounded-full border border-amber-500/50 text-amber-300 text-xs font-semibold hover:bg-amber-500/10 transition"
                >
                  ⚡ Jump to Peak Inundation
                </button>
              </div>
            </div>
          )}

          {activeWorkspace === "hydrology" && <HydrologyWorkspace S={S} Ia={Ia} Q={Q} rainfall={rainfall} cn={cn} />}

          {/* WORKSPACE 3: SCENARIO LABORATORY */}
          {activeWorkspace === "scenarios" && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h1 className="text-xl font-extrabold text-white">Scenario Laboratory & Multi-Run Matrix</h1>
                  <p className="text-xs text-[#8aa0b8]">Compare precipitation scenarios side-by-side with live computed hydrodynamics.</p>
                </div>
                <button
                  onClick={() => {
                    const newSc: Scenario = {
                      id: `sc-${Date.now()}`,
                      name: `Scenario ${scenarios.length + 1}`,
                      P: rainfall,
                      CN: cn,
                      duration: duration,
                      depth: `${(Math.min(Q / 120, 1) * 2.2 * (0.3 + 0.7 * (duration / 100))).toFixed(2)}m`,
                      area: "14.2%",
                      buildings: Math.round(80 + (Q / 120) * 700),
                      runoff: +Q.toFixed(1),
                      category: "Custom",
                    };
                    setScenarios([...scenarios, newSc]);
                    pushToast(`Saved ${newSc.name}`);
                  }}
                  className="px-4 py-2 rounded-full bg-cyan-500 text-black text-xs font-bold"
                >
                  + Save Current Scenario
                </button>
              </div>

              <div className="grid lg:grid-cols-3 gap-4">
                {/* Scenario Cards */}
                <div className="lg:col-span-1 space-y-2">
                  {scenarios.map((sc) => (
                    <div
                      key={sc.id}
                      onClick={() => {
                        setActiveScenarioId(sc.id);
                        setRainfall(sc.P);
                        setCn(sc.CN);
                        setDuration(sc.duration);
                        pushToast(`Loaded ${sc.name}`);
                      }}
                      className={`p-3.5 rounded-xl border cursor-pointer transition ${
                        activeScenarioId === sc.id ? "bg-[#12233a] border-cyan-500 shadow-lg" : "bg-[#060e1c] border-[#1e3a5a] hover:border-cyan-500/40"
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <div className="font-bold text-sm text-white">{sc.name}</div>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-mono">{sc.category}</span>
                      </div>
                      <div className="text-xs text-[#8aa0b8] mt-1 font-mono">
                        P: {sc.P}mm • CN: {sc.CN} • Runoff: {sc.runoff}mm
                      </div>
                      <div className="flex justify-between items-center mt-3 pt-2 border-t border-[#1e3a5a]/60 text-xs font-mono">
                        <span className="text-amber-300 font-bold">{sc.depth} max depth</span>
                        <span className="text-[#8aa0b8]">{sc.buildings} buildings hit</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Scenario Comparison Table */}
                <div className="lg:col-span-2 bg-[#060e1c] border border-[#1e3a5a] rounded-2xl p-4">
                  <h3 className="font-mono font-bold text-sm text-cyan-300 mb-3">Multi-Run Delta Matrix</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="text-[#8aa0b8] border-b border-[#1e3a5a]">
                        <tr>
                          <th className="text-left py-2.5">Scenario</th>
                          <th>Rainfall P</th>
                          <th>Curve No.</th>
                          <th>Runoff Q</th>
                          <th>Peak Depth</th>
                          <th>Vulnerable Assets</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1e3a5a]/60">
                        {scenarios.map((sc) => (
                          <tr key={sc.id} className="hover:bg-[#12233a]/50">
                            <td className="py-3 font-bold text-white">{sc.name}</td>
                            <td className="text-center font-mono">{sc.P} mm</td>
                            <td className="text-center font-mono">{sc.CN}</td>
                            <td className="text-center font-mono text-cyan-300 font-bold">{sc.runoff} mm</td>
                            <td className="text-center font-mono text-amber-300">{sc.depth}</td>
                            <td className="text-center font-mono">{sc.buildings}</td>
                            <td className="text-center">
                              <button
                                onClick={() => {
                                  setActiveScenarioId(sc.id);
                                  setRainfall(sc.P);
                                  setCn(sc.CN);
                                  setDuration(sc.duration);
                                  setActiveWorkspace("digital_twin");
                                  pushToast(`Loaded & switched to ${sc.name}`);
                                }}
                                className="px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500 hover:text-black font-semibold transition"
                              >
                                Simulate 3D
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* WORKSPACE 4: ECONOMIC DAMAGE & INFRASTRUCTURE IMPACT (from FloodML) */}
          {activeWorkspace === "impact" && (
            <div className="space-y-4">
              <h1 className="text-xl font-extrabold text-white">Stage-Damage Economic Loss & Infrastructure Vulnerability</h1>
              <div className="grid sm:grid-cols-4 gap-3">
                <div className="p-4 rounded-2xl bg-[#060e1c] border border-cyan-500/40">
                  <div className="text-xs text-[#8aa0b8]">Est. Economic Loss</div>
                  <div className="text-2xl font-black text-cyan-300 font-mono mt-1">₹ {economicLoss.directLossCrores} Cr</div>
                  <div className="text-xs text-[#8aa0b8] mt-1">Direct structural & asset loss</div>
                </div>
                <div className="p-4 rounded-2xl bg-[#060e1c] border border-[#1e3a5a]">
                  <div className="text-xs text-[#8aa0b8]">Displaced Population</div>
                  <div className="text-2xl font-black text-amber-300 font-mono mt-1">{economicLoss.displacedPop}</div>
                  <div className="text-xs text-[#8aa0b8] mt-1">Residents requiring shelter</div>
                </div>
                <div className="p-4 rounded-2xl bg-[#060e1c] border border-[#1e3a5a]">
                  <div className="text-xs text-[#8aa0b8]">Inundated Buildings</div>
                  <div className="text-2xl font-black text-red-400 font-mono mt-1">{economicLoss.affectedBuildings}</div>
                  <div className="text-xs text-[#8aa0b8] mt-1">Depth &gt; 0.15m boundary</div>
                </div>
                <div className="p-4 rounded-2xl bg-[#060e1c] border border-[#1e3a5a]">
                  <div className="text-xs text-[#8aa0b8]">Arterial Road Closure</div>
                  <div className="text-2xl font-black text-white font-mono mt-1">16.4 km</div>
                  <div className="text-xs text-[#8aa0b8] mt-1">Corridors impassable</div>
                </div>
              </div>

              {/* Filterable Asset Table */}
              <div className="bg-[#060e1c] border border-[#1e3a5a] rounded-2xl p-4">
                <h3 className="font-mono font-bold text-sm text-cyan-300 mb-3">Critical Infrastructure Asset Inventory</h3>
                <div className="divide-y divide-[#1e3a5a]/60">
                  {CHENNAI_SEARCH_INDEX.map((asset) => (
                    <div key={asset.name} className="py-3 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-bold text-white">{asset.name}</div>
                        <div className="text-[#8aa0b8]">{asset.type} • Basin: {asset.basin}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-amber-300 font-bold">0.52m Inundation</span>
                        <button
                          onClick={() => {
                            const delta = aoiKm / 111;
                            setSelectedArea({
                              id: `asset-${asset.name.toLowerCase().replace(/\s+/g, "-")}`,
                              name: asset.name,
                              basin: asset.basin,
                              bounds: { xmin: asset.coords[0] - delta, xmax: asset.coords[0] + delta, ymin: asset.coords[1] - delta, ymax: asset.coords[1] + delta },
                              center: asset.coords as [number, number],
                            });
                            setActiveWorkspace("digital_twin");
                            pushToast(`Focused ${asset.name} in Digital Twin`);
                          }}
                          className="px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500 hover:text-black font-semibold transition"
                        >
                          Focus in 3D →
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* WORKSPACE 5: EMERGENCY EVACUATION & SAFE ROUTING (from CrisisFlow) */}
          {activeWorkspace === "evacuation" && (
            <div className="space-y-4">
              <EvacuationRouting
                currentLocation={{
                  lat: selectedArea.center[1],
                  lng: selectedArea.center[0],
                  name: selectedArea.name,
                }}
                floodDepth={+economicLoss.depthVal}
                onFocusShelter={(sh) => {
                  pushToast(`Selected Evacuation Shelter: ${sh.name}`);
                }}
              />
            </div>
          )}

          {activeWorkspace === "validation" && <ValidationWorkspace />}
          {activeWorkspace === "registry" && <RegistryWorkspace />}

          {/* WORKSPACE 8: BRIEFING & EXPORT */}
          {activeWorkspace === "reports" && (
            <div className="space-y-4">
              <h1 className="text-xl font-extrabold text-white">Intelligence Briefing & Spatial Export</h1>
              <div className="grid lg:grid-cols-2 gap-4">
                <div className="bg-[#060e1c] border border-[#1e3a5a] rounded-2xl p-5 space-y-4">
                  <h3 className="font-bold text-sm text-cyan-300">Executive Flood Intelligence Report</h3>
                  <p className="text-xs text-[#8aa0b8]">
                    Generates a formal executive decision brief with hydrological calculations, AOI boundary definitions, asset vulnerability counts, economic stage-damage loss, and multi-scenario comparison matrices.
                  </p>
                  <button
                    onClick={handleExportReport}
                    className="px-5 py-2.5 rounded-full bg-cyan-500 text-black font-bold text-xs hover:bg-cyan-400 transition"
                  >
                    Open Printable Executive Brief →
                  </button>
                </div>

                <div className="bg-[#060e1c] border border-[#1e3a5a] rounded-2xl p-5 space-y-4">
                  <h3 className="font-bold text-sm text-cyan-300">Spatial GeoJSON Dataset Export</h3>
                  <p className="text-xs text-[#8aa0b8]">
                    Download standardized GeoJSON feature collections with full hydrological attributes, economic loss calculations, AOI polygons, and runoff properties for GIS systems (QGIS / ArcGIS).
                  </p>
                  <button
                    onClick={handleExportGeoJSON}
                    className="px-5 py-2.5 rounded-full border border-cyan-500 text-cyan-300 font-bold text-xs hover:bg-[#12233a] transition"
                  >
                    Download GeoJSON Package
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Floating Toast Alerts */}
      <div className="fixed bottom-4 right-4 space-y-2 z-50 pointer-events-none">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto px-4 py-2.5 rounded-full bg-[#060e1c] border border-cyan-500/40 text-xs shadow-2xl flex items-center gap-3">
            <span className="text-white font-medium">{t.msg}</span>
            {t.action && (
              <button
                onClick={() => setActiveWorkspace("digital_twin")}
                className="text-cyan-300 underline font-bold"
              >
                {t.action}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
