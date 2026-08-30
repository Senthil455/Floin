"use client";
import { useState, useEffect, useRef, useMemo } from "react";
import dynamic from "next/dynamic";

const ChennaiMap = dynamic(() => import("@/components/ChennaiMap"), {
  ssr: false,
  loading: () => (
    <div style={{ height: 380, display: "grid", placeItems: "center", background: "#08121f", borderRadius: 12, border: "1px solid #1e3a5a" }}>
      Loading Chennai Leaflet Map...
    </div>
  ),
});

const FloodSimulation = dynamic(() => import("@/components/FloodSimulation"), {
  ssr: false,
  loading: () => (
    <div style={{ height: 480, display: "grid", placeItems: "center", background: "#08121f", borderRadius: 12 }}>
      Loading 3D Terrain Engine...
    </div>
  ),
});

type Project = {
  id: string;
  name: string;
  location: string;
  area: string;
  updated: string;
  status: string;
  scenario: string;
  runs: number;
  scenarios: number;
  center: [number, number];
};

type Scenario = {
  id: string;
  name: string;
  P: number;
  CN: number;
  duration: number;
  depth: string;
  area: string;
  buildings: number;
  runoff: number;
};

type Toast = { id: number; msg: string; action?: string };

const AREAS = [
  { id: "all", name: "All Chennai", bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, center: [80.225, 13.065] as [number, number] },
  { id: "central", name: "Central Chennai (Ripon/Egmore)", bounds: { xmin: 80.24, xmax: 80.28, ymin: 13.05, ymax: 13.09 }, center: [80.26, 13.07] as [number, number] },
  { id: "adyar", name: "Adyar River Basin", bounds: { xmin: 80.18, xmax: 80.28, ymin: 12.98, ymax: 13.03 }, center: [80.23, 13.01] as [number, number] },
  { id: "ennore", name: "Ennore Industrial North", bounds: { xmin: 80.28, xmax: 80.33, ymin: 13.18, ymax: 13.24 }, center: [80.305, 13.21] as [number, number] },
  { id: "velachery", name: "Velachery - South Lowlands", bounds: { xmin: 80.20, xmax: 80.24, ymin: 12.96, ymax: 13.00 }, center: [80.22, 12.98] as [number, number] },
];

const CHENNAI_SEARCH_INDEX = [
  { name: "Ripon Building (GCC HQ)", type: "Building", coords: [80.2755, 13.0827] },
  { name: "Tidel Park (OMR)", type: "Tech Hub", coords: [80.2483, 12.9893] },
  { name: "Chennai Central Station", type: "Transit", coords: [80.2754, 13.0823] },
  { name: "Anna Salai (Mount Road)", type: "Road", coords: [80.258, 13.055] },
  { name: "Adyar Bridge & Estuary", type: "Waterway", coords: [80.2645, 13.0102] },
  { name: "Marina Beach", type: "Coastal", coords: [80.2825, 13.0625] },
  { name: "Nungambakkam Weather Station", type: "Rain Station", coords: [80.243, 13.063] },
  { name: "Meenambakkam IMD Station", type: "Rain Station", coords: [80.181, 12.994] },
  { name: "Chembarambakkam Lake", type: "Waterway", coords: [80.0578, 13.0118] },
  { name: "Ennore Port", type: "Industrial", coords: [80.3245, 13.2312] },
];

function calcScsRunoff(P: number, CN: number) {
  const S = 25400 / CN - 254;
  const Ia = 0.2 * S;
  const Q = P <= Ia ? 0 : ((P - Ia) ** 2) / (P + 0.8 * S);
  return { S, Ia, Q };
}

export default function Page() {
  const [active, setActive] = useState("home");
  const [project, setProject] = useState<Project>({
    id: "p1",
    name: "Chennai South Flood Study",
    location: "Chennai, TN",
    area: "80.10-80.35 / 12.88-13.25",
    updated: "Live Session",
    status: "Ready to simulate",
    scenario: "Monsoon Peak (2015 Ref)",
    runs: 6,
    scenarios: 3,
    center: [80.225, 13.065],
  });

  const [projects, setProjects] = useState<Project[]>([
    { id: "p1", name: "Chennai South Flood Study", location: "Chennai, TN", area: "80.10-80.35", updated: "Today", status: "Ready", scenario: "Monsoon Peak", runs: 6, scenarios: 3, center: [80.225, 13.065] },
    { id: "p2", name: "Adyar Basin Analysis", location: "Adyar", area: "80.18-80.28", updated: "Yesterday", status: "Validated", scenario: "Base", runs: 2, scenarios: 2, center: [80.23, 13.01] },
    { id: "p3", name: "Ennore North Industrial Drainage", location: "Ennore", area: "80.28-80.33", updated: "2 days ago", status: "Draft", scenario: "Cyclonic Storm", runs: 1, scenarios: 1, center: [80.305, 13.21] },
  ]);

  // Simulation Parameters
  const [rainfall, setRainfall] = useState(140);
  const [cn, setCn] = useState(82);
  const [duration, setDuration] = useState(45);
  const [timeSpeed, setTimeSpeed] = useState(1);
  const [simRunning, setSimRunning] = useState(false);
  const [simProgress, setSimProgress] = useState(45);

  const [selectedArea, setSelectedArea] = useState(AREAS[0]);
  const [clicked, setClicked] = useState<{ lat: number; lng: number } | null>(null);
  const [aoiKm, setAoiKm] = useState(1.5);
  const [workflow, setWorkflow] = useState<"idle" | "analyzing" | "preview" | "simulating" | "done">("idle");
  const [analysis, setAnalysis] = useState<any>(null);

  const [layers, setLayers] = useState({
    terrain: true,
    water: true,
    depth: true,
    buildings: true,
    roads: true,
    hotspots: true,
    inundation: true,
  });

  const [selectedObject, setSelectedObject] = useState<any>({
    name: "Ripon Building (GCC HQ)",
    type: "Building",
    elevation: "6.4m",
    depth: "0.52m",
    velocity: "0.45 m/s",
    status: "Medium Risk",
  });

  const [scenarios, setScenarios] = useState<Scenario[]>([
    { id: "s1", name: "Monsoon Peak (2015 Ref)", P: 240, CN: 86, duration: 60, depth: "0.85m", area: "18.4%", buildings: 680, runoff: 156.2 },
    { id: "s2", name: "Standard 50-Yr Storm", P: 140, CN: 82, duration: 45, depth: "0.48m", area: "10.2%", buildings: 340, runoff: 78.4 },
    { id: "s3", name: "Base Moderate Rain", P: 75, CN: 74, duration: 30, depth: "0.22m", area: "4.1%", buildings: 110, runoff: 26.8 },
  ]);
  const [activeScenarioId, setActiveScenarioId] = useState("s1");

  const [search, setSearch] = useState("");
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [bookmarks, setBookmarks] = useState([
    { name: "Ripon Building (GCC HQ)", type: "Government Building", coords: [80.2755, 13.0827] },
    { name: "Tidel Park Junction", type: "Road Intersection", coords: [80.2483, 12.9893] },
    { name: "Saidapet Adyar Crossing", type: "Historical Hotspot", coords: [80.2215, 13.0182] },
  ]);

  const pushToast = (msg: string, action?: string) => {
    const id = Date.now();
    setToasts((t) => [...t, { id, msg, action }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  };

  const { S, Ia, Q } = useMemo(() => calcScsRunoff(rainfall, cn), [rainfall, cn]);

  const searchResults = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return CHENNAI_SEARCH_INDEX.filter((item) => item.name.toLowerCase().includes(q) || item.type.toLowerCase().includes(q));
  }, [search]);

  // Execute Click-to-AOI Discovery via real APIs
  const handleMapClickLocation = async (lat: number, lng: number) => {
    const delta = aoiKm / 111;
    const b = { xmin: lng - delta, xmax: lng + delta, ymin: lat - delta, ymax: lat + delta };
    const area = {
      id: `loc-${Date.now()}`,
      name: `AOI (${lat.toFixed(3)}°N, ${lng.toFixed(3)}°E) • ${aoiKm}km`,
      bounds: b,
      center: [lng, lat] as [number, number],
      lat,
      lng,
    };
    setSelectedArea(area);
    setClicked({ lat, lng });
    setWorkflow("analyzing");
    setAnalysis(null);

    try {
      // 1. Query location dataset counts
      const queryRes = await fetch("/api/location/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aoi: area, requestId: `ui-${Date.now()}` }),
      }).then((r) => r.json());

      // 2. Fetch location features summary
      const featRes = await fetch("/api/location/features", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aoi: area, datasets: ["buildings", "highway", "waterway", "chennai2015_hotspots"], limit: 500 }),
      }).then((r) => r.json());

      const bldCount = featRes.features?.buildings?.count ?? queryRes.summary?.buildings ?? 0;
      const roadCount = featRes.features?.highway?.count ?? queryRes.summary?.roads ?? 0;
      const hotCount = featRes.features?.chennai2015_hotspots?.count ?? queryRes.summary?.hotspots ?? 0;

      setAnalysis({
        buildings: bldCount,
        roads: roadCount,
        hotspots: hotCount,
        elevMin: "1.8m",
        elevMax: "14.2m",
        coverage: hotCount > 0 ? "2015 GCC Flood Hotspots Detected" : "Standard Chennai Drainage Zone",
      });
      setWorkflow("preview");
      pushToast(`Discovered ${bldCount} buildings and ${roadCount} roads in AOI`, "View 3D");
    } catch (e) {
      console.error(e);
      setAnalysis({ buildings: 24, roads: 8, hotspots: 1, elevMin: "2m", elevMax: "12m", coverage: "Sample AOI" });
      setWorkflow("preview");
    }
  };

  // Switch active scenario
  const handleLoadScenario = (sc: Scenario) => {
    setActiveScenarioId(sc.id);
    setRainfall(sc.P);
    setCn(sc.CN);
    setDuration(sc.duration);
    setProject((p) => ({ ...p, scenario: sc.name }));
    pushToast(`Loaded Scenario: ${sc.name} (P=${sc.P}mm, CN=${sc.CN})`);
  };

  // Export GeoJSON snapshot
  const handleExportGeoJSON = () => {
    const data = {
      type: "FeatureCollection",
      name: `FLOIN_${selectedArea.name.replace(/\s+/g, "_")}`,
      properties: {
        projectName: project.name,
        rainfall_mm: rainfall,
        curveNumber: cn,
        runoff_mm: +Q.toFixed(2),
        estimatedDepth_m: (Math.min(Q / 120, 1) * 2.2 * (0.3 + 0.7 * (duration / 100))).toFixed(2),
        aoi: selectedArea,
        timestamp: new Date().toISOString(),
      },
      features: [
        {
          type: "Feature",
          properties: { name: "Study AOI Boundary", id: selectedArea.id },
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
    a.download = `floin-simulation-${selectedArea.id || "chennai"}.geojson`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    pushToast("Exported GeoJSON flood simulation dataset");
  };

  // Export printable HTML report
  const handleExportReport = () => {
    const win = window.open("", "_blank");
    if (!win) return;
    const estDepth = (Math.min(Q / 120, 1) * 2.2 * (0.3 + 0.7 * (duration / 100))).toFixed(2);
    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>FLOIN Flood Intelligence Report - ${project.name}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #fff; color: #111; padding: 32px; line-height: 1.5; }
          h1 { color: #0284c7; margin-bottom: 4px; }
          .header { border-bottom: 2px solid #0284c7; padding-bottom: 12px; margin-bottom: 24px; }
          .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 24px; }
          .card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; }
          table { width: 100%; border-collapse: collapse; margin-top: 16px; }
          th, td { border: 1px solid #e2e8f0; padding: 8px 12px; text-align: left; }
          th { background: #f8fafc; font-weight: 600; }
          .badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: 600; }
          .badge-high { background: #fee2e2; color: #991b1b; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>FLOIN - Chennai Flood Intelligence Report</h1>
          <div><b>Project:</b> ${project.name} | <b>Location:</b> ${selectedArea.name}</div>
          <div><b>Generated:</b> ${new Date().toLocaleString()}</div>
        </div>
        <div class="grid">
          <div class="card">
            <h3>Hydrological Simulation Summary</h3>
            <p><b>Rainfall (P):</b> ${rainfall} mm</p>
            <p><b>Curve Number (CN):</b> ${cn} (Soil/Imperviousness)</p>
            <p><b>Duration:</b> ${duration} minutes</p>
            <p><b>SCS Runoff Volume (Q):</b> ${Q.toFixed(2)} mm</p>
            <p><b>Mean Flood Depth:</b> ${estDepth} m</p>
          </div>
          <div class="card">
            <h3>Area of Interest Metrics</h3>
            <p><b>Center:</b> ${selectedArea.center[1].toFixed(4)}°N, ${selectedArea.center[0].toFixed(4)}°E</p>
            <p><b>Bounds:</b> ${selectedArea.bounds.xmin.toFixed(3)} - ${selectedArea.bounds.xmax.toFixed(3)}°E, ${selectedArea.bounds.ymin.toFixed(3)} - ${selectedArea.bounds.ymax.toFixed(3)}°N</p>
            <p><b>Est. Affected Buildings:</b> ${Math.round(80 + +estDepth * 900)}</p>
            <p><b>Historical Risk:</b> ${analysis?.coverage || "2015 GCC Flood Zone"}</p>
          </div>
        </div>
        <h3>Comparative Scenario Table</h3>
        <table>
          <thead>
            <tr><th>Scenario</th><th>Rainfall (mm)</th><th>CN</th><th>Runoff Q (mm)</th><th>Peak Depth</th><th>Risk</th></tr>
          </thead>
          <tbody>
            ${scenarios
              .map(
                (s) => `
              <tr>
                <td><b>${s.name}</b></td>
                <td>${s.P}</td>
                <td>${s.CN}</td>
                <td>${s.runoff}</td>
                <td>${s.depth}</td>
                <td><span class="badge ${s.P > 150 ? "badge-high" : ""}">${s.P > 150 ? "Severe" : "Moderate"}</span></td>
              </tr>
            `
              )
              .join("")}
          </tbody>
        </table>
        <div style="margin-top: 32px; text-align: center; color: #64748b; font-size: 12px;">
          Generated by FLOIN Flood Intelligence Platform • Powered by SRTM DEM + SCS-CN Hydrology
        </div>
      </body>
      </html>
    `);
    win.document.close();
    pushToast("Generated printable Flood Intelligence Report");
  };

  const NavItem = ({ id, label, icon, badge }: any) => (
    <button
      onClick={() => setActive(id)}
      className={`w-full text-left px-3 py-2.5 rounded-xl flex items-center gap-3 text-sm transition ${
        active === id ? "bg-[#12233a] text-cyan-300 border border-[#1e3a5a] font-semibold" : "text-[#8aa0b8] hover:bg-[#0f1e2e] hover:text-white"
      }`}
    >
      <span className="w-5 text-center text-cyan-400">{icon}</span>
      <span>{label}</span>
      {badge && <span className="ml-auto text-xs bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded-full">{badge}</span>}
    </button>
  );

  return (
    <div className="min-h-screen bg-[#0a1018] text-[#e6eef8] flex">
      {/* Left Navigation Sidebar */}
      <aside className="w-[280px] shrink-0 border-r border-[#1e3a5a] bg-[#0a1018] sticky top-0 h-screen flex flex-col hidden lg:flex">
        <div className="p-4 border-b border-[#1e3a5a]">
          <div className="flex items-center gap-2 font-black tracking-widest text-lg">
            <span className="text-cyan-400">◈</span> FLOIN
          </div>
          <div className="text-xs text-[#8aa0b8] mt-1">Chennai Flood Intelligence System</div>
          <div className="mt-3 p-2.5 rounded-xl bg-[#0f1e2e] border border-[#1e3a5a]">
            <div className="text-[11px] text-[#8aa0b8]">Active Project</div>
            <div className="font-semibold text-sm truncate text-cyan-300">{project.name}</div>
            <div className="text-xs text-[#8aa0b8] mt-0.5">{selectedArea.name}</div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          <div>
            <div className="text-[10px] font-bold tracking-wider text-[#8aa0b8] px-2 mb-2">WORKSPACE</div>
            <div className="space-y-1">
              <NavItem id="home" label="Project Home" icon="▦" />
              <NavItem id="data" label="Data Management" icon="🗃" badge="13" />
              <NavItem id="modules" label="Hydrology Pipeline" icon="◈" />
            </div>
          </div>

          <div>
            <div className="text-[10px] font-bold tracking-wider text-[#8aa0b8] px-2 mb-2">SIMULATION & MAPS</div>
            <div className="space-y-1">
              <NavItem id="visualize" label="3D Flood Lab & Map" icon="🗺" badge="Live" />
              <NavItem id="simulate" label="Control Center" icon="▶" />
              <NavItem id="impact" label="Impact Analysis" icon="◉" />
            </div>
          </div>

          <div>
            <div className="text-[10px] font-bold tracking-wider text-[#8aa0b8] px-2 mb-2">ANALYSIS & OUTPUT</div>
            <div className="space-y-1">
              <NavItem id="scenarios" label="Scenarios & Compare" icon="≡" badge={`${scenarios.length}`} />
              <NavItem id="reports" label="Reports & Export" icon="⤓" />
              <NavItem id="bookmarks" label="Bookmarks" icon="☆" badge={`${bookmarks.length}`} />
              <NavItem id="settings" label="Settings" icon="⚙" />
            </div>
          </div>
        </div>

        <div className="p-3 border-t border-[#1e3a5a]">
          <div className="flex justify-between text-xs text-[#8aa0b8]">
            <span>SRTM DEM + 2015 GCC</span>
            <span className="text-emerald-400">Validated</span>
          </div>
          <div className="w-full h-1.5 bg-[#0f1e2e] rounded-full mt-1.5 overflow-hidden">
            <div className="h-1.5 bg-cyan-500 rounded-full" style={{ width: "88%" }} />
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Header */}
        <header className="sticky top-0 z-30 backdrop-blur bg-[#0a1018]/85 border-b border-[#1e3a5a]">
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="lg:hidden font-black text-cyan-400">◈ FLOIN</div>
            <div className="hidden sm:flex items-center gap-2 text-sm">
              <span className="px-2.5 py-1 rounded-full bg-[#0f1e2e] border border-[#1e3a5a] text-xs text-cyan-300 font-mono">
                {project.scenario}
              </span>
              <span className="text-[#8aa0b8]">•</span>
              <span className="text-xs text-[#8aa0b8]">
                P: <b className="text-white">{rainfall}mm</b> | CN: <b className="text-white">{cn}</b> | Runoff Q:{" "}
                <b className="text-cyan-300">{Q.toFixed(1)}mm</b>
              </span>
            </div>

            <div className="ml-auto flex items-center gap-2">
              {/* Search Bar */}
              <div className="relative hidden md:block">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search landmarks, stations, roads..."
                  className="w-[280px] bg-[#0f1e2e] border border-[#1e3a5a] rounded-full px-4 py-1.5 text-xs placeholder:text-[#8aa0b8] focus:outline-none focus:border-cyan-500"
                />
                {searchResults.length > 0 && (
                  <div className="absolute top-full mt-2 w-full bg-[#0f1e2e] border border-[#1e3a5a] rounded-xl p-2 text-xs shadow-2xl z-50 max-h-60 overflow-y-auto">
                    {searchResults.map((item) => (
                      <div
                        key={item.name}
                        onClick={() => {
                          const delta = aoiKm / 111;
                          setSelectedArea({
                            id: `search-${item.name.toLowerCase().replace(/\s+/g, "-")}`,
                            name: item.name,
                            bounds: { xmin: item.coords[0] - delta, xmax: item.coords[0] + delta, ymin: item.coords[1] - delta, ymax: item.coords[1] + delta },
                            center: item.coords as [number, number],
                          });
                          setSelectedObject({ name: item.name, type: item.type, depth: "0.48m", status: "Medium" });
                          setSearch("");
                          setActive("visualize");
                          pushToast(`Focused ${item.name} in 3D`);
                        }}
                        className="px-2.5 py-1.5 hover:bg-[#12233a] rounded-lg cursor-pointer flex justify-between items-center"
                      >
                        <span className="font-semibold text-white truncate">{item.name}</span>
                        <span className="text-[10px] text-[#8aa0b8] ml-2">{item.type}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button onClick={() => pushToast("Project checkpoint saved")} className="hidden sm:inline-flex px-3.5 py-1.5 rounded-full bg-cyan-500 text-black text-xs font-bold hover:bg-cyan-400">
                Save
              </button>
              <button onClick={handleExportGeoJSON} className="px-3.5 py-1.5 rounded-full border border-[#1e3a5a] text-xs hover:bg-[#12233a]">
                Export GeoJSON
              </button>
            </div>
          </div>

          {/* Mobile Tab Bar */}
          <div className="flex lg:hidden gap-1 px-2 pb-2 overflow-x-auto border-t border-[#1e3a5a]/50 pt-2">
            {["home", "visualize", "simulate", "impact", "scenarios", "data", "reports"].map((k) => (
              <button
                key={k}
                onClick={() => setActive(k)}
                className={`px-3 py-1 rounded-full text-xs capitalize whitespace-nowrap ${
                  active === k ? "bg-cyan-500 text-black font-semibold" : "bg-[#0f1e2e] border border-[#1e3a5a]"
                }`}
              >
                {k === "visualize" ? "3D & Map" : k}
              </button>
            ))}
          </div>
        </header>

        {/* Content Body */}
        <main className="flex-1 p-4 lg:p-6 space-y-6">
          {/* 1. PROJECT HOME */}
          {active === "home" && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-extrabold tracking-tight">Chennai Flood Intelligence Workspace</h1>
                  <p className="text-sm text-[#8aa0b8] mt-1">
                    Integrated high-resolution flood simulation platform combining SRTM DEM, 2015 GCC historical inundation data, and SCS-CN hydrology.
                  </p>
                </div>
                <button
                  onClick={() => {
                    const newProj: Project = {
                      id: `p${Date.now()}`,
                      name: `New Flood Study ${projects.length + 1}`,
                      location: "Chennai, TN",
                      area: "80.10-80.35 / 12.88-13.25",
                      updated: "Just now",
                      status: "Ready",
                      scenario: "Monsoon Base",
                      runs: 0,
                      scenarios: 1,
                      center: [80.225, 13.065],
                    };
                    setProjects([newProj, ...projects]);
                    setProject(newProj);
                    pushToast("Created new flood study project");
                  }}
                  className="px-4 py-2 rounded-full bg-cyan-500 text-black font-semibold text-xs"
                >
                  + New Study
                </button>
              </div>

              <div className="grid lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 bg-[#0f1e2e] border border-[#1e3a5a] rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-sm text-cyan-300">Recent Projects</h3>
                    <span className="text-xs text-[#8aa0b8]">{projects.length} projects</span>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {projects.map((p) => (
                      <div
                        key={p.id}
                        onClick={() => {
                          setProject(p);
                          pushToast(`Switched active project to ${p.name}`);
                        }}
                        className={`p-3.5 rounded-xl border cursor-pointer transition ${
                          project.id === p.id ? "bg-[#12233a] border-cyan-500/60 shadow-lg" : "bg-[#0a1018] border-[#1e3a5a] hover:border-cyan-500/40"
                        }`}
                      >
                        <div className="font-bold text-sm truncate text-white">{p.name}</div>
                        <div className="text-xs text-[#8aa0b8] mt-1">{p.location} • {p.area}</div>
                        <div className="flex gap-2 mt-3 items-center">
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#0f1e2e] border border-[#1e3a5a] text-cyan-300">{p.scenario}</span>
                          <span className="text-[11px] text-[#8aa0b8]">{p.runs} simulation runs</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-[#0f1e2e] border border-[#1e3a5a] rounded-2xl p-4 flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-sm text-cyan-300">Active Study Parameters</h3>
                    <div className="mt-3 space-y-2 text-xs">
                      <div className="flex justify-between py-1 border-b border-[#1e3a5a]/60">
                        <span className="text-[#8aa0b8]">Rainfall Input</span>
                        <span className="font-mono font-bold text-white">{rainfall} mm</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-[#1e3a5a]/60">
                        <span className="text-[#8aa0b8]">Curve Number (CN)</span>
                        <span className="font-mono font-bold text-white">{cn}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-[#1e3a5a]/60">
                        <span className="text-[#8aa0b8]">Runoff Volume (Q)</span>
                        <span className="font-mono font-bold text-cyan-300">{Q.toFixed(1)} mm</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-[#1e3a5a]/60">
                        <span className="text-[#8aa0b8]">Target Area</span>
                        <span className="font-semibold text-white">{selectedArea.name}</span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setActive("visualize")}
                    className="w-full mt-4 py-2.5 rounded-full bg-cyan-500 text-black font-bold text-xs hover:bg-cyan-400 transition"
                  >
                    Open in 3D Flood Lab →
                  </button>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="grid sm:grid-cols-4 gap-3">
                {[
                  { t: "3D Click-to-Simulate", d: "Interactive terrain & 2015 hotspots", a: "visualize" },
                  { t: "Simulation Control", d: "SCS runoff & 6-hr progression", a: "simulate" },
                  { t: "Impact Analysis", d: "Asset vulnerability & risk zones", a: "impact" },
                  { t: "Export & Reports", d: "GeoJSON, CSV & printable PDF", a: "reports" },
                ].map((x) => (
                  <button
                    key={x.t}
                    onClick={() => setActive(x.a)}
                    className="p-3.5 rounded-xl bg-[#0f1e2e] border border-[#1e3a5a] text-left hover:border-cyan-500/40 transition group"
                  >
                    <div className="font-bold text-sm text-white group-hover:text-cyan-300">{x.t}</div>
                    <div className="text-xs text-[#8aa0b8] mt-1">{x.d}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 2. VISUALIZE & CLICK-TO-SIMULATE (3D + MAP) */}
          {active === "visualize" && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h1 className="text-2xl font-extrabold">3D Flood Lab & Click-to-Simulate</h1>
                  <p className="text-xs text-[#8aa0b8]">
                    Click anywhere in Chennai to generate a localized 3D simulation with accurate DEM elevation, buildings, roads, and 2015 flood overlays.
                  </p>
                </div>
                <div className="flex gap-1.5 items-center bg-[#0f1e2e] p-1 rounded-full border border-[#1e3a5a]">
                  <span className="text-xs text-[#8aa0b8] px-2">AOI Box:</span>
                  {[0.5, 1, 1.5, 2.5].map((km) => (
                    <button
                      key={km}
                      onClick={() => {
                        setAoiKm(km);
                        pushToast(`AOI Size set to ${km}km`);
                      }}
                      className={`px-2.5 py-1 rounded-full text-xs ${
                        aoiKm === km ? "bg-cyan-500 text-black font-bold" : "text-[#8aa0b8] hover:text-white"
                      }`}
                    >
                      {km}km
                    </button>
                  ))}
                </div>
              </div>

              {/* Preset Area Fast-Switch Bar */}
              <div className="flex gap-2 overflow-x-auto pb-1">
                {AREAS.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => {
                      setSelectedArea(a);
                      setClicked({ lat: a.center[1], lng: a.center[0] });
                      pushToast(`Selected ${a.name}`);
                    }}
                    className={`px-3 py-1.5 rounded-full text-xs whitespace-nowrap border transition ${
                      selectedArea.id === a.id ? "bg-cyan-500 text-black font-bold border-cyan-500" : "bg-[#0f1e2e] border-[#1e3a5a] text-[#8aa0b8] hover:text-white"
                    }`}
                  >
                    {a.name}
                  </button>
                ))}
              </div>

              {/* Main 3D & 2D Layout */}
              <div className="grid lg:grid-cols-12 gap-4">
                {/* 3D Scene (7 cols) */}
                <div className="lg:col-span-7 bg-[#0f1e2e] border border-[#1e3a5a] rounded-2xl p-3 flex flex-col">
                  <div className="flex justify-between items-center mb-2 px-1">
                    <span className="text-xs font-bold tracking-wider text-cyan-300">
                      3D SIMULATION ENGINE • {selectedArea.name}
                    </span>
                    <span className="text-[11px] font-mono text-[#8aa0b8]">
                      Rain: {rainfall}mm | CN: {cn}
                    </span>
                  </div>
                  <FloodSimulation
                    selectedArea={selectedArea}
                    rainfall={rainfall}
                    cn={cn}
                    duration={duration}
                    layers={layers}
                    onSelectObject={(obj) => {
                      setSelectedObject(obj);
                      pushToast(`Inspecting: ${obj.name}`);
                    }}
                  />
                </div>

                {/* 2D Leaflet Map & Info (5 cols) */}
                <div className="lg:col-span-5 space-y-4">
                  <div className="bg-[#0f1e2e] border border-[#1e3a5a] rounded-2xl p-3">
                    <div className="flex justify-between items-center mb-2 px-1">
                      <span className="text-xs font-bold tracking-wider text-[#8aa0b8]">
                        INTERACTIVE CHENNAI MAP (CLICK TO FOCUS)
                      </span>
                      <span className="text-[11px] text-cyan-300">Leaflet 2D</span>
                    </div>
                    <ChennaiMap
                      selectedArea={selectedArea}
                      aoiSizeKm={aoiKm}
                      onMapClick={handleMapClickLocation}
                      onSelectArea={(a) => setSelectedArea(a)}
                      onSelectFeature={(f) => {
                        setSelectedObject(f);
                        pushToast(`Selected ${f.name}`);
                      }}
                    />
                  </div>

                  {/* Selected Object Inspector */}
                  <div className="bg-[#0f1e2e] border border-[#1e3a5a] rounded-2xl p-4">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="text-xs font-bold tracking-wider text-cyan-300">FEATURE INSPECTOR</h4>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-mono">
                        {selectedObject?.type || "Asset"}
                      </span>
                    </div>
                    <div className="text-sm font-bold text-white mb-2">{selectedObject?.name}</div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="p-2 rounded-lg bg-[#0a1018] border border-[#1e3a5a]">
                        <div className="text-[#8aa0b8] text-[10px]">Est. Water Depth</div>
                        <div className="font-bold text-amber-300 font-mono mt-0.5">{selectedObject?.depth || "0.45m"}</div>
                      </div>
                      <div className="p-2 rounded-lg bg-[#0a1018] border border-[#1e3a5a]">
                        <div className="text-[#8aa0b8] text-[10px]">Flow Velocity</div>
                        <div className="font-bold text-cyan-300 font-mono mt-0.5">{selectedObject?.velocity || "0.4 m/s"}</div>
                      </div>
                      <div className="p-2 rounded-lg bg-[#0a1018] border border-[#1e3a5a]">
                        <div className="text-[#8aa0b8] text-[10px]">Risk Tier</div>
                        <div className="font-bold text-red-400 font-mono mt-0.5">{selectedObject?.risk || "Moderate"}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setBookmarks((b) => [...b, { name: selectedObject.name, type: selectedObject.type, coords: selectedArea.center }]);
                        pushToast(`Bookmarked ${selectedObject.name}`);
                      }}
                      className="w-full mt-3 py-1.5 rounded-full border border-[#1e3a5a] text-xs hover:bg-[#12233a] transition"
                    >
                      ★ Bookmark this Asset
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 3. SIMULATION CONTROL CENTER */}
          {active === "simulate" && (
            <div className="space-y-4">
              <h1 className="text-2xl font-extrabold">Simulation Control Center</h1>
              <div className="grid lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 space-y-4">
                  {/* Parameter Sliders */}
                  <div className="bg-[#0f1e2e] border border-[#1e3a5a] rounded-2xl p-4">
                    <h3 className="font-bold text-sm text-cyan-300 mb-3">Hydrology Model Parameters (SCS-CN)</h3>
                    <div className="grid sm:grid-cols-3 gap-4">
                      <div>
                        <label className="text-xs text-[#8aa0b8] flex justify-between">
                          <span>Rainfall P</span>
                          <span className="font-mono text-cyan-300 font-bold">{rainfall} mm</span>
                        </label>
                        <input
                          type="range"
                          min={20}
                          max={350}
                          value={rainfall}
                          onChange={(e) => setRainfall(+e.target.value)}
                          className="w-full accent-cyan-500 mt-2"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-[#8aa0b8] flex justify-between">
                          <span>Curve Number (CN)</span>
                          <span className="font-mono text-cyan-300 font-bold">{cn}</span>
                        </label>
                        <input
                          type="range"
                          min={45}
                          max={98}
                          value={cn}
                          onChange={(e) => setCn(+e.target.value)}
                          className="w-full accent-cyan-500 mt-2"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-[#8aa0b8] flex justify-between">
                          <span>Storm Duration</span>
                          <span className="font-mono text-cyan-300 font-bold">{duration} min</span>
                        </label>
                        <input
                          type="range"
                          min={15}
                          max={180}
                          value={duration}
                          onChange={(e) => setDuration(+e.target.value)}
                          className="w-full accent-cyan-500 mt-2"
                        />
                      </div>
                    </div>

                    <div className="mt-4 p-3 rounded-xl bg-[#0a1018] border border-[#1e3a5a] grid sm:grid-cols-3 gap-3 text-xs">
                      <div>
                        <span className="text-[#8aa0b8]">Storage Potential S:</span>
                        <div className="font-mono font-bold text-white mt-0.5">{S.toFixed(1)} mm</div>
                      </div>
                      <div>
                        <span className="text-[#8aa0b8]">Initial Abstraction Ia:</span>
                        <div className="font-mono font-bold text-white mt-0.5">{Ia.toFixed(1)} mm</div>
                      </div>
                      <div>
                        <span className="text-[#8aa0b8]">Direct Runoff Q:</span>
                        <div className="font-mono font-bold text-cyan-300 mt-0.5">{Q.toFixed(1)} mm</div>
                      </div>
                    </div>
                  </div>

                  {/* Simulation Execution & Presets */}
                  <div className="bg-[#0f1e2e] border border-[#1e3a5a] rounded-2xl p-4">
                    <h3 className="font-bold text-sm text-cyan-300 mb-3">Historical Calibration Presets</h3>
                    <div className="grid sm:grid-cols-3 gap-3">
                      <button
                        onClick={() => {
                          setRainfall(240);
                          setCn(86);
                          setDuration(90);
                          pushToast("Loaded 2015 Historical Chennai Extreme Monsoon Event");
                        }}
                        className="p-3 rounded-xl bg-[#0a1018] border border-[#1e3a5a] text-left hover:border-cyan-500/50 transition"
                      >
                        <div className="font-bold text-xs text-white">2015 GCC Extreme (Peak)</div>
                        <div className="text-[11px] text-[#8aa0b8] mt-1">240mm • CN 86 • Severe Flood</div>
                      </button>
                      <button
                        onClick={() => {
                          setRainfall(140);
                          setCn(80);
                          setDuration(45);
                          pushToast("Loaded 50-Year Design Storm");
                        }}
                        className="p-3 rounded-xl bg-[#0a1018] border border-[#1e3a5a] text-left hover:border-cyan-500/50 transition"
                      >
                        <div className="font-bold text-xs text-white">50-Year Design Storm</div>
                        <div className="text-[11px] text-[#8aa0b8] mt-1">140mm • CN 80 • High Inundation</div>
                      </button>
                      <button
                        onClick={() => {
                          setRainfall(65);
                          setCn(75);
                          setDuration(30);
                          pushToast("Loaded Moderate Monsoon Scenario");
                        }}
                        className="p-3 rounded-xl bg-[#0a1018] border border-[#1e3a5a] text-left hover:border-cyan-500/50 transition"
                      >
                        <div className="font-bold text-xs text-white">Moderate Monsoon Shower</div>
                        <div className="text-[11px] text-[#8aa0b8] mt-1">65mm • CN 75 • Low Risk</div>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Simulation Summary Card */}
                <div className="bg-[#0f1e2e] border border-[#1e3a5a] rounded-2xl p-4 space-y-4">
                  <h3 className="font-bold text-sm text-cyan-300">Active Study Area</h3>
                  <div className="p-3 rounded-xl bg-[#0a1018] border border-[#1e3a5a] text-xs space-y-1.5">
                    <div className="font-bold text-white">{selectedArea.name}</div>
                    <div className="text-[#8aa0b8]">Center: {selectedArea.center[1].toFixed(3)}°N, {selectedArea.center[0].toFixed(3)}°E</div>
                    <div className="text-[#8aa0b8]">Bounds: {selectedArea.bounds.xmin.toFixed(3)} - {selectedArea.bounds.xmax.toFixed(3)}°E</div>
                  </div>
                  <button
                    onClick={() => setActive("visualize")}
                    className="w-full py-2.5 rounded-full bg-cyan-500 text-black font-bold text-xs hover:bg-cyan-400 transition"
                  >
                    View in 3D Simulator →
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 4. IMPACT ANALYSIS */}
          {active === "impact" && (
            <div className="space-y-4">
              <h1 className="text-2xl font-extrabold">Impact Analysis & Risk Zones</h1>
              <div className="grid sm:grid-cols-4 gap-3">
                {[
                  { k: "Direct Runoff (Q)", v: `${Q.toFixed(1)} mm`, sub: `SCS Volume for ${rainfall}mm rain` },
                  { k: "Mean Inundation", v: `${(Math.min(Q / 120, 1) * 2.2 * (0.3 + 0.7 * (duration / 100))).toFixed(2)} m`, sub: "Peak flood level" },
                  { k: "Vulnerable Assets", v: `${Math.round(80 + (Q / 120) * 800)}`, sub: "Buildings in risk boundary" },
                  { k: "Affected Streets", v: "14.8 km", sub: "GCC arterial roads" },
                ].map((m) => (
                  <div key={m.k} className="p-4 rounded-2xl bg-[#0f1e2e] border border-[#1e3a5a]">
                    <div className="text-xs text-[#8aa0b8]">{m.k}</div>
                    <div className="text-xl font-black text-cyan-300 mt-1">{m.v}</div>
                    <div className="text-xs text-[#8aa0b8] mt-1">{m.sub}</div>
                  </div>
                ))}
              </div>

              {/* Risk Zone Matrix & Asset Inspector */}
              <div className="grid lg:grid-cols-2 gap-4">
                <div className="bg-[#0f1e2e] border border-[#1e3a5a] rounded-2xl p-4">
                  <h4 className="font-bold text-sm text-cyan-300 mb-3">Zonal Vulnerability Distribution</h4>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                      <div className="font-bold text-emerald-300">Low Risk</div>
                      <div className="text-xs text-[#8aa0b8] mt-1">&lt;0.3m depth</div>
                      <div className="text-lg font-mono font-bold text-white mt-1">54%</div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30">
                      <div className="font-bold text-amber-300">Medium Risk</div>
                      <div className="text-xs text-[#8aa0b8] mt-1">0.3 - 0.8m</div>
                      <div className="text-lg font-mono font-bold text-white mt-1">28%</div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30">
                      <div className="font-bold text-red-400">High / Critical</div>
                      <div className="text-xs text-[#8aa0b8] mt-1">&gt;0.8m depth</div>
                      <div className="text-lg font-mono font-bold text-white mt-1">18%</div>
                    </div>
                  </div>
                </div>

                <div className="bg-[#0f1e2e] border border-[#1e3a5a] rounded-2xl p-4">
                  <h4 className="font-bold text-sm text-cyan-300 mb-3">Key Infrastructure Assets in Study Area</h4>
                  <div className="space-y-2">
                    {CHENNAI_SEARCH_INDEX.slice(0, 4).map((asset) => (
                      <div
                        key={asset.name}
                        onClick={() => {
                          setSelectedObject({ name: asset.name, type: asset.type, depth: "0.52m", risk: "Medium" });
                          setActive("visualize");
                          pushToast(`Focusing ${asset.name} in 3D viewer`);
                        }}
                        className="p-2.5 rounded-xl bg-[#0a1018] border border-[#1e3a5a] flex items-center justify-between hover:border-cyan-500/40 cursor-pointer transition text-xs"
                      >
                        <div>
                          <div className="font-bold text-white">{asset.name}</div>
                          <div className="text-[11px] text-[#8aa0b8]">{asset.type}</div>
                        </div>
                        <button className="px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-300 font-semibold hover:bg-cyan-500 hover:text-black transition">
                          Inspect 3D →
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 5. SCENARIOS & COMPARISON */}
          {active === "scenarios" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-extrabold">Flood Scenarios & Multi-Run Comparison</h1>
                  <p className="text-xs text-[#8aa0b8]">Compare multiple rainfall & Curve Number scenarios side-by-side with live computed runoff deltas.</p>
                </div>
                <button
                  onClick={() => {
                    const newSc: Scenario = {
                      id: `s${Date.now()}`,
                      name: `Scenario ${scenarios.length + 1}`,
                      P: rainfall,
                      CN: cn,
                      duration: duration,
                      depth: `${(Math.min(Q / 120, 1) * 2.2 * (0.3 + 0.7 * (duration / 100))).toFixed(2)}m`,
                      area: "12.4%",
                      buildings: Math.round(80 + (Q / 120) * 600),
                      runoff: +Q.toFixed(1),
                    };
                    setScenarios([...scenarios, newSc]);
                    pushToast(`Saved ${newSc.name}`);
                  }}
                  className="px-4 py-2 rounded-full bg-cyan-500 text-black text-xs font-bold hover:bg-cyan-400"
                >
                  + Save Current as Scenario
                </button>
              </div>

              <div className="grid lg:grid-cols-3 gap-4">
                {/* Scenario List */}
                <div className="lg:col-span-1 space-y-2">
                  {scenarios.map((sc) => (
                    <div
                      key={sc.id}
                      onClick={() => handleLoadScenario(sc)}
                      className={`p-3.5 rounded-xl border cursor-pointer transition ${
                        activeScenarioId === sc.id ? "bg-[#12233a] border-cyan-500 shadow-md" : "bg-[#0f1e2e] border-[#1e3a5a] hover:border-cyan-500/40"
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <div className="font-bold text-sm text-white">{sc.name}</div>
                        {activeScenarioId === sc.id && (
                          <span className="text-[10px] bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded-full font-semibold">Active</span>
                        )}
                      </div>
                      <div className="text-xs text-[#8aa0b8] mt-1">
                        Rainfall: {sc.P}mm | CN: {sc.CN} | Runoff: {sc.runoff}mm
                      </div>
                      <div className="flex justify-between items-center mt-3 pt-2 border-t border-[#1e3a5a]/60 text-xs">
                        <span className="text-amber-300 font-mono">{sc.depth} depth</span>
                        <span className="text-[#8aa0b8]">{sc.buildings} buildings</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Scenario Comparison Table */}
                <div className="lg:col-span-2 bg-[#0f1e2e] border border-[#1e3a5a] rounded-2xl p-4">
                  <h3 className="font-bold text-sm text-cyan-300 mb-3">Scenario Comparison Matrix</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="text-[#8aa0b8] border-b border-[#1e3a5a]">
                        <tr>
                          <th className="text-left py-2">Scenario</th>
                          <th>Rainfall (P)</th>
                          <th>Curve No. (CN)</th>
                          <th>Runoff (Q)</th>
                          <th>Peak Depth</th>
                          <th>Vulnerable Assets</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1e3a5a]/60">
                        {scenarios.map((sc) => (
                          <tr key={sc.id} className="hover:bg-[#12233a]/50">
                            <td className="py-2.5 font-bold text-white">{sc.name}</td>
                            <td className="text-center font-mono">{sc.P} mm</td>
                            <td className="text-center font-mono">{sc.CN}</td>
                            <td className="text-center font-mono text-cyan-300">{sc.runoff} mm</td>
                            <td className="text-center font-mono text-amber-300">{sc.depth}</td>
                            <td className="text-center font-mono">{sc.buildings}</td>
                            <td className="text-center">
                              <button
                                onClick={() => handleLoadScenario(sc)}
                                className="px-2.5 py-1 rounded-full bg-[#0a1018] border border-[#1e3a5a] hover:border-cyan-500 text-cyan-300 font-semibold"
                              >
                                Load
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

          {/* 6. DATA MANAGEMENT */}
          {active === "data" && (
            <div className="space-y-4">
              <h1 className="text-2xl font-extrabold">Data Management & Discovery</h1>
              <p className="text-xs text-[#8aa0b8]">Discovered and validated spatial datasets for Chennai regional flood intelligence.</p>

              <div className="bg-[#0f1e2e] border border-[#1e3a5a] rounded-2xl p-4">
                <div className="divide-y divide-[#1e3a5a]">
                  {[
                    { name: "buildings.geojson", type: "Vector Footprints", features: "1,811", crs: "EPSG:4326 (WGS84)", status: "Validated" },
                    { name: "highway.geojson", type: "Road Network", features: "64", crs: "EPSG:4326 (WGS84)", status: "Validated" },
                    { name: "waterway.geojson", type: "Canals & Rivers", features: "12", crs: "EPSG:4326 (WGS84)", status: "Validated" },
                    { name: "rainfall_stations.geojson", type: "IMD Rain Stations", features: "8", crs: "EPSG:4326 (WGS84)", status: "Validated" },
                    { name: "chennai2015_hotspots.geojson", type: "2015 GCC Flood Hotspots", features: "327", crs: "EPSG:4326 (WGS84)", status: "Validated" },
                    { name: "chennai2015_flooded_streets.geojson", type: "2015 Inundated Streets", features: "7,894", crs: "EPSG:4326 (WGS84)", status: "Validated" },
                    { name: "SRTM_DEM_30m.tif", type: "Elevation Raster (DEM)", features: "30m grid", crs: "EPSG:4326", status: "Active" },
                  ].map((ds) => (
                    <div key={ds.name} className="py-3 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-bold text-white">{ds.name}</div>
                        <div className="text-[#8aa0b8]">{ds.type} • {ds.features} features • {ds.crs}</div>
                      </div>
                      <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold">{ds.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 7. REPORTS & EXPORT */}
          {active === "reports" && (
            <div className="space-y-4">
              <h1 className="text-2xl font-extrabold">Reports & Dataset Export</h1>
              <div className="grid lg:grid-cols-2 gap-4">
                <div className="bg-[#0f1e2e] border border-[#1e3a5a] rounded-2xl p-5 space-y-4">
                  <h3 className="font-bold text-sm text-cyan-300">Generate Executive Flood Intelligence Report</h3>
                  <p className="text-xs text-[#8aa0b8]">
                    Generates a formatted report with hydrological calculations, AOI boundary data, asset vulnerability tables, and comparative scenarios.
                  </p>
                  <button
                    onClick={handleExportReport}
                    className="px-5 py-2.5 rounded-full bg-cyan-500 text-black font-bold text-xs hover:bg-cyan-400 transition"
                  >
                    Open Printable Report →
                  </button>
                </div>

                <div className="bg-[#0f1e2e] border border-[#1e3a5a] rounded-2xl p-5 space-y-4">
                  <h3 className="font-bold text-sm text-cyan-300">Export Spatial Simulation Datasets</h3>
                  <p className="text-xs text-[#8aa0b8]">
                    Download GeoJSON feature collections containing simulation attributes, AOI polygons, and runoff properties.
                  </p>
                  <button
                    onClick={handleExportGeoJSON}
                    className="px-5 py-2.5 rounded-full border border-cyan-500 text-cyan-300 font-bold text-xs hover:bg-[#12233a] transition"
                  >
                    Download Simulation GeoJSON
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 8. BOOKMARKS */}
          {active === "bookmarks" && (
            <div className="bg-[#0f1e2e] border border-[#1e3a5a] rounded-2xl p-4 space-y-3">
              <h3 className="font-bold text-sm text-cyan-300">Saved Study Bookmarks</h3>
              <div className="space-y-2">
                {bookmarks.map((b, i) => (
                  <div key={i} className="p-3 rounded-xl bg-[#0a1018] border border-[#1e3a5a] flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-white">{b.name}</div>
                      <div className="text-[#8aa0b8]">{b.type}</div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          const delta = aoiKm / 111;
                          setSelectedArea({
                            id: `bm-${i}`,
                            name: b.name,
                            bounds: { xmin: b.coords[0] - delta, xmax: b.coords[0] + delta, ymin: b.coords[1] - delta, ymax: b.coords[1] + delta },
                            center: b.coords as [number, number],
                          });
                          setActive("visualize");
                          pushToast(`Navigated to ${b.name}`);
                        }}
                        className="px-3 py-1 rounded-full bg-cyan-500 text-black font-semibold"
                      >
                        Inspect in 3D
                      </button>
                      <button
                        onClick={() => setBookmarks((prev) => prev.filter((_, idx) => idx !== i))}
                        className="px-2 py-1 rounded-full border border-red-900 text-red-300"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 9. SETTINGS */}
          {active === "settings" && (
            <div className="bg-[#0f1e2e] border border-[#1e3a5a] rounded-2xl p-5 max-w-xl space-y-4 text-xs">
              <h3 className="font-bold text-sm text-cyan-300">Platform Settings</h3>
              <div>
                <label className="text-[#8aa0b8] block mb-1">Units of Measurement</label>
                <select className="w-full bg-[#0a1018] border border-[#1e3a5a] rounded-lg p-2 text-white">
                  <option>Metric (mm rainfall, meters depth, km/h velocity)</option>
                  <option>Imperial</option>
                </select>
              </div>
              <div>
                <label className="text-[#8aa0b8] block mb-1">Coordinate Reference System (CRS)</label>
                <input readOnly value="EPSG:4326 (WGS84 Lat/Long)" className="w-full bg-[#0a1018] border border-[#1e3a5a] rounded-lg p-2 text-white font-mono" />
              </div>
              <button onClick={() => pushToast("Settings saved")} className="px-4 py-2 rounded-full bg-cyan-500 text-black font-bold">
                Save Preferences
              </button>
            </div>
          )}
        </main>

        {/* Floating Toast Notifications */}
        <div className="fixed bottom-4 right-4 space-y-2 z-50 pointer-events-none">
          {toasts.map((t) => (
            <div key={t.id} className="pointer-events-auto px-4 py-2.5 rounded-full bg-[#12233a] border border-cyan-500/40 text-xs shadow-2xl flex items-center gap-3">
              <span className="text-white font-medium">{t.msg}</span>
              {t.action && (
                <button onClick={() => setActive("visualize")} className="text-cyan-300 underline font-bold">
                  {t.action}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
