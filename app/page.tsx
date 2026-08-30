"use client";
import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";

const ChennaiMap = dynamic(() => import("@/components/ChennaiMap"), { ssr: false, loading: () => <div style={{ height: 360, display: "grid", placeItems: "center", background: "#08121f", borderRadius: 12, border: "1px solid #1e3a5a" }}>Loading map...</div> });
const FloodSimulation = dynamic(() => import("@/components/FloodSimulation"), { ssr: false, loading: () => <div style={{ height: 480, display: "grid", placeItems: "center", background: "#08121f", borderRadius: 12 }}>Loading 3D...</div> });

type Project = { id: string; name: string; location: string; area: string; updated: string; status: string; scenario: string; runs: number; scenarios: number };
type Toast = { id: number; msg: string; action?: string };

export default function Page() {
  const [active, setActive] = useState("home");
  const [project, setProject] = useState<Project>({ id: "p1", name: "Chennai South Flood Study", location: "Chennai, TN", area: "80.10-80.35 / 12.88-13.25", updated: "Today, 09:24", status: "Ready to simulate", scenario: "Monsoon Peak", runs: 3, scenarios: 2 });
  const [projects, setProjects] = useState<Project[]>([
    { id: "p1", name: "Chennai South Flood Study", location: "Chennai, TN", area: "80.10-80.35", updated: "Today", status: "Ready", scenario: "Monsoon Peak", runs: 3, scenarios: 2 },
    { id: "p2", name: "Adyar Basin Analysis", location: "Adyar", area: "80.18-80.28", updated: "Yesterday", status: "Processing M2", scenario: "Base", runs: 1, scenarios: 1 },
    { id: "p3", name: "North Chennai Drainage", location: "Ennore", area: "80.28-80.35", updated: "2 days ago", status: "Draft", scenario: "-", runs: 0, scenarios: 0 },
  ]);
  const [rainfall, setRainfall] = useState(120);
  const [cn, setCn] = useState(78);
  const [t, setT] = useState(45);
  const [simRunning, setSimRunning] = useState(false);
  const [simProgress, setSimProgress] = useState(45);
  const [layers, setLayers] = useState({ terrain: true, water: true, depth: true, buildings: true, roads: true, flowDir: false, flowAcc: false });
  const [timeSpeed, setTimeSpeed] = useState(1);
  const [selected, setSelected] = useState<any>({ type: "terrain", elevation: "6.2m", slope: "1.4%", depth: "0.42m", velocity: "0.4 m/s", status: "Flooded" });
  const AREAS = [
    { id: "all", name: "All Chennai", bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, center: [80.225, 13.065] as [number,number] },
    { id: "central", name: "Central", bounds: { xmin: 80.24, xmax: 80.28, ymin: 13.05, ymax: 13.09 }, center: [80.26, 13.07] as [number,number] },
    { id: "adyar", name: "Adyar Basin", bounds: { xmin: 80.18, xmax: 80.28, ymin: 12.98, ymax: 13.03 }, center: [80.23, 13.01] as [number,number] },
    { id: "ennore", name: "Ennore North", bounds: { xmin: 80.28, xmax: 80.33, ymin: 13.18, ymax: 13.24 }, center: [80.305, 13.21] as [number,number] },
  ];
  const [selectedArea, setSelectedArea] = useState(AREAS[0]);
  const [scenarios, setScenarios] = useState([{ id: "s1", name: "Monsoon Peak", P: 210, CN: 85, depth: "0.75m", area: "16.1%" }, { id: "s2", name: "Base Case", P: 120, CN: 78, depth: "0.42m", area: "8.4%" }]);
  const [activeScenario, setActiveScenario] = useState("s1");
  const [search, setSearch] = useState("");
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [bookmarks, setBookmarks] = useState([{ name: "Ripon Building", type: "Building" }, { name: "Tidel Park Junction", type: "Road" }]);
  const pushToast = (msg: string, action?: string) => { const id = Date.now(); setToasts((t) => [...t, { id, msg, action }]); setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3000); };

  useEffect(() => {
    if (!simRunning) return;
    const iv = setInterval(() => setSimProgress((p) => (p >= 100 ? 0 : p + 1)), 800 / timeSpeed);
    return () => clearInterval(iv);
  }, [simRunning, timeSpeed]);

  const NavItem = ({ id, label, icon, badge }: any) => (
    <button onClick={() => setActive(id)} className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center gap-3 text-sm transition ${active === id ? "bg-[#12233a] text-cyan-300 border border-[#1e3a5a]" : "text-[#8aa0b8] hover:bg-[#0f1e2e] hover:text-white"}`}>
      <span className="w-5 text-center">{icon}</span> {label} {badge && <span className="ml-auto text-xs bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded-full">{badge}</span>}
    </button>
  );

  return (
    <div className="min-h-screen bg-[#0a1018] text-[#e6eef8] flex">
      <aside className="w-[280px] shrink-0 border-r border-[#1e3a5a] bg-[#0a1018] sticky top-0 h-screen flex flex-col hidden lg:flex">
        <div className="p-4 border-b border-[#1e3a5a]">
          <div className="flex items-center gap-2 font-black tracking-widest"><span className="text-cyan-400">◈</span> FLOIN</div>
          <div className="text-xs text-[#8aa0b8] mt-1">Chennai Flood Intelligence • 2026</div>
          <div className="mt-3 p-2.5 rounded-lg bg-[#0f1e2e] border border-[#1e3a5a]">
            <div className="text-xs text-[#8aa0b8]">Active Project</div>
            <div className="font-semibold text-sm truncate">{project.name}</div>
            <div className="text-xs text-[#8aa0b8]">{project.location} • {project.updated}</div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          <div>
            <div className="text-xs font-bold tracking-widest text-[#8aa0b8] px-2 mb-2">WORKSPACE</div>
            <div className="space-y-1">
              <NavItem id="home" label="Project Home" icon="▦" />
              <NavItem id="data" label="Data Management" icon="🗃" badge="9" />
              <NavItem id="modules" label="Modules 1-4" icon="◈" />
            </div>
          </div>
          <div>
            <div className="text-xs font-bold tracking-widest text-[#8aa0b8] px-2 mb-2">SIMULATION</div>
            <div className="space-y-1">
              <NavItem id="simulate" label="Control Center" icon="▶" />
              <NavItem id="visualize" label="2D / 3D Map" icon="🗺" />
              <NavItem id="impact" label="Impact Analysis" icon="◉" />
            </div>
          </div>
          <div>
            <div className="text-xs font-bold tracking-widest text-[#8aa0b8] px-2 mb-2">ANALYSIS</div>
            <div className="space-y-1">
              <NavItem id="scenarios" label="Scenarios" icon="≡" badge={`${scenarios.length}`} />
              <NavItem id="reports" label="Reports & Export" icon="⤓" />
            </div>
          </div>
          <div>
            <div className="text-xs font-bold tracking-widest text-[#8aa0b8] px-2 mb-2">WORKSPACE</div>
            <div className="space-y-1">
              <NavItem id="bookmarks" label="Bookmarks" icon="☆" badge={`${bookmarks.length}`} />
              <NavItem id="settings" label="Settings" icon="⚙" />
            </div>
          </div>
        </div>
        <div className="p-3 border-t border-[#1e3a5a]">
          <div className="text-xs text-[#8aa0b8]">Storage • 1,811 buildings • 8 stations</div>
          <div className="w-full h-1.5 bg-[#0f1e2e] rounded-full mt-1"><div className="h-1.5 bg-cyan-500 rounded-full" style={{ width: "68%" }} /></div>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 backdrop-blur bg-[#0a1018]/80 border-b border-[#1e3a5a]">
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="lg:hidden font-black"><span className="text-cyan-400">◈</span> FLOIN</div>
            <div className="hidden sm:flex items-center gap-2 text-sm">
              <span className="px-2.5 py-1 rounded-full bg-[#0f1e2e] border border-[#1e3a5a] text-xs">{project.scenario}</span>
              <span className="text-[#8aa0b8]">•</span>
              <span className={`text-xs px-2 py-1 rounded-full ${simRunning ? "bg-amber-500/20 text-amber-300" : "bg-emerald-500/20 text-emerald-300"}`}>{simRunning ? `Simulating ${simProgress}%` : project.status}</span>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <div className="relative hidden md:block">
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search buildings, roads, coordinates..." className="w-[280px] bg-[#0f1e2e] border border-[#1e3a5a] rounded-full px-4 py-2 text-sm placeholder:text-[#8aa0b8] focus:outline-none focus:border-cyan-500" />
                {search && (
                  <div className="absolute top-full mt-2 w-full bg-[#0f1e2e] border border-[#1e3a5a] rounded-xl p-2 text-sm">
                    <div className="px-2 py-1.5 hover:bg-[#12233a] rounded cursor-pointer" onClick={() => { setSelected({ type: "building", name: "Ripon Building", depth: "0.42m", status: "Flooded" }); setSearch(""); pushToast("Focused Ripon Building", "View"); }}>Ripon Building • Building</div>
                    <div className="px-2 py-1.5 hover:bg-[#12233a] rounded cursor-pointer">Anna Salai • Road</div>
                    <div className="px-2 py-1.5 text-xs text-[#8aa0b8]">Press Enter to search all</div>
                  </div>
                )}
              </div>
              <button onClick={() => pushToast("Project saved")} className="hidden sm:inline-flex px-3 py-2 rounded-full bg-cyan-500 text-[#001018] text-sm font-semibold">Save</button>
              <button onClick={() => pushToast("Export started", "Open")} className="px-3 py-2 rounded-full border border-[#1e3a5a] text-sm">Export</button>
            </div>
          </div>
          <div className="flex lg:hidden gap-1 px-2 pb-2 overflow-x-auto">
            {["home", "data", "modules", "simulate", "visualize", "impact", "scenarios"].map((k) => (
              <button key={k} onClick={() => setActive(k)} className={`px-3 py-1.5 rounded-full text-xs whitespace-nowrap ${active === k ? "bg-cyan-500 text-black" : "bg-[#0f1e2e] border border-[#1e3a5a]"}`}>{k}</button>
            ))}
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-6 space-y-6">
          {active === "home" && (
            <>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-extrabold">Project Workspace</h1>
                  <p className="text-sm text-[#8aa0b8]">Create, open and manage flood studies. Your progress is saved automatically.</p>
                </div>
                <button onClick={() => pushToast("New project created")} className="px-4 py-2 rounded-full bg-cyan-500 text-black font-semibold text-sm">+ New Project</button>
              </div>

              <div className="grid lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 bg-[#0f1e2e] border border-[#1e3a5a] rounded-2xl p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold">Recent Projects</h3>
                    <span className="text-xs text-[#8aa0b8]">{projects.length} projects</span>
                  </div>
                  <div className="mt-3 grid sm:grid-cols-2 gap-3">
                    {projects.map((p) => (
                      <div key={p.id} onClick={() => setProject(p)} className={`p-3 rounded-xl border cursor-pointer transition ${project.id === p.id ? "bg-[#12233a] border-cyan-500/50" : "bg-[#0a1018] border-[#1e3a5a] hover:border-cyan-500/30"}`}>
                        <div className="font-semibold text-sm truncate">{p.name}</div>
                        <div className="text-xs text-[#8aa0b8]">{p.location} • {p.area}</div>
                        <div className="flex gap-2 mt-2">
                          <span className="text-xs px-2 py-0.5 rounded-full bg-[#0f1e2e] border border-[#1e3a5a]">{p.status}</span>
                          <span className="text-xs text-[#8aa0b8]">{p.scenarios} scenarios • {p.runs} runs</span>
                        </div>
                        <div className="flex gap-2 mt-3">
                          <button onClick={(e) => { e.stopPropagation(); pushToast(`Duplicated ${p.name}`); }} className="text-xs px-2 py-1 rounded-full border border-[#1e3a5a]">Duplicate</button>
                          <button onClick={(e) => { e.stopPropagation(); if (confirm(`Delete ${p.name}?`)) setProjects((x) => x.filter((y) => y.id !== p.id)); }} className="text-xs px-2 py-1 rounded-full border border-red-900 text-red-300">Delete</button>
                        </div>
                      </div>
                    ))}
                    {projects.length === 0 && <div className="col-span-2 py-10 text-center border border-dashed border-[#1e3a5a] rounded-xl text-[#8aa0b8]">No projects yet — create your first flood study to begin.</div>}
                  </div>
                </div>

                <div className="bg-[#0f1e2e] border border-[#1e3a5a] rounded-2xl p-4">
                  <h3 className="font-bold">Current Project</h3>
                  <div className="mt-3 space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-[#8aa0b8]">Name</span><span className="font-medium">{project.name}</span></div>
                    <div className="flex justify-between"><span className="text-[#8aa0b8]">Location</span><span>{project.location}</span></div>
                    <div className="flex justify-between"><span className="text-[#8aa0b8]">Area</span><span className="text-xs">{project.area}</span></div>
                    <div className="flex justify-between"><span className="text-[#8aa0b8]">Scenario</span><span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 text-xs">{project.scenario}</span></div>
                    <div className="flex justify-between"><span className="text-[#8aa0b8]">Updated</span><span>{project.updated}</span></div>
                  </div>
                  <div className="mt-4">
                    <div className="text-xs text-[#8aa0b8] mb-1">Workflow Progress</div>
                    <div className="grid grid-cols-4 gap-1 text-xs">
                      {["Collect", "Preprocess", "Store", "Simulate"].map((s, i) => (
                        <div key={s} className={`p-2 rounded-lg text-center ${i < 3 ? "bg-emerald-500/20 text-emerald-300" : "bg-amber-500/20 text-amber-300"}`}>{s}<div className="text-[10px]">{i < 3 ? "Done" : "Active"}</div></div>
                      ))}
                    </div>
                  </div>
                  <button onClick={() => setActive("visualize")} className="w-full mt-4 py-2 rounded-full bg-cyan-500 text-black font-semibold text-sm">Continue in 3D →</button>
                </div>
              </div>

              <div className="bg-[#0f1e2e] border border-[#1e3a5a] rounded-2xl p-4">
                <h3 className="font-bold">Quick Actions</h3>
                <div className="grid sm:grid-cols-4 gap-3 mt-3">
                  {[
                    { t: "Upload Data", d: "Terrain, rainfall, OSM", a: "data" },
                    { t: "Run Simulation", d: "SCS-CN + D8", a: "simulate" },
                    { t: "Visualize Flood", d: "2D / 3D + layers", a: "visualize" },
                    { t: "Generate Report", d: "PDF + export", a: "reports" },
                  ].map((x) => (
                    <button key={x.t} onClick={() => setActive(x.a)} className="p-3 rounded-xl bg-[#0a1018] border border-[#1e3a5a] text-left hover:border-cyan-500/40">
                      <div className="font-semibold text-sm">{x.t}</div>
                      <div className="text-xs text-[#8aa0b8]">{x.d}</div>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {active === "data" && (
            <div className="space-y-4">
              <div>
                <h1 className="text-2xl font-extrabold">Data Management</h1>
                <p className="text-sm text-[#8aa0b8]">Import, validate and manage all layers for this project.</p>
              </div>

              <div className="grid lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 space-y-4">
                  <div className="bg-[#0f1e2e] border-2 border-dashed border-[#1e3a5a] rounded-2xl p-6 text-center">
                    <div className="text-3xl">⬆</div>
                    <div className="font-semibold mt-2">Drag & drop files here</div>
                    <div className="text-xs text-[#8aa0b8]">GeoTIFF, GeoJSON, CSV, SHP • 9 files already loaded</div>
                    <div className="flex gap-2 justify-center mt-3">
                      <label className="px-4 py-2 rounded-full bg-cyan-500 text-black text-sm font-semibold cursor-pointer">
                        Browse Files<input type="file" className="hidden" multiple onChange={(e) => pushToast(`${e.target.files?.length || 0} files selected for upload`)} />
                      </label>
                      <button onClick={() => pushToast("Connected sample Chennai data")} className="px-4 py-2 rounded-full border border-[#1e3a5a] text-sm">Use Sample Data</button>
                    </div>
                  </div>

                  <div className="bg-[#0f1e2e] border border-[#1e3a5a] rounded-2xl overflow-hidden">
                    <div className="p-3 font-bold border-b border-[#1e3a5a]">Datasets • 9 files</div>
                    <div className="divide-y divide-[#1e3a5a]">
                      {[
                        { name: "DEM.tif", type: "GeoTIFF", size: "5.94 MB", crs: "EPSG:4326", status: "Valid" },
                        { name: "buildings.geojson", type: "GeoJSON", size: "2.8 MB", crs: "CRS84", status: "Valid" },
                        { name: "rainfall_stations.geojson", type: "GeoJSON", size: "2 KB", crs: "CRS84", status: "Valid" },
                        { name: "highway.geojson", type: "GeoJSON", size: "26 KB", crs: "CRS84", status: "Valid" },
                        { name: "custom_upload.shp", type: "SHP", size: "—", crs: "—", status: "Missing CRS" },
                      ].map((f) => (
                        <div key={f.name} className="p-3 flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-[#0a1018] border border-[#1e3a5a] grid place-items-center text-xs">{f.type[0]}</div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate">{f.name}</div>
                            <div className="text-xs text-[#8aa0b8]">{f.type} • {f.size} • {f.crs}</div>
                          </div>
                          <span className={`text-xs px-2 py-1 rounded-full border ${f.status === "Valid" ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" : "bg-amber-500/20 text-amber-300 border-amber-500/30"}`}>{f.status}</span>
                          <button onClick={() => pushToast(`Previewing ${f.name}`)} className="text-xs px-2 py-1 rounded-full border border-[#1e3a5a]">Preview</button>
                          <button onClick={() => pushToast(`Removed ${f.name}`)} className="text-xs px-2 py-1 rounded-full border border-red-900 text-red-300">Remove</button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="bg-[#0f1e2e] border border-[#1e3a5a] rounded-2xl p-4">
                    <h4 className="font-bold">Validation</h4>
                    <div className="mt-2 space-y-2 text-sm">
                      <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30">✓ 4 rasters valid • 9 vectors valid</div>
                      <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30">⚠ custom_upload.shp — Missing CRS. <button onClick={() => pushToast("Set CRS to EPSG:4326")} className="underline">Fix</button>: assign EPSG:4326.</div>
                      <div className="p-2 rounded-lg bg-[#0a1018] border border-[#1e3a5a]">Bounds 80.10/12.88 — 80.35/13.25 • All layers overlap.</div>
                    </div>
                  </div>
                  <div className="bg-[#0f1e2e] border border-[#1e3a5a] rounded-2xl p-4">
                    <h4 className="font-bold">Quick Preview</h4>
                    <div className="flex gap-1.5 mb-2 flex-wrap">
                      {AREAS.map((a) => (
                        <button key={a.id} onClick={() => { setSelectedArea(a); pushToast(`Focus: ${a.name}`, "View 3D"); setActive("visualize"); }} className={`px-2.5 py-1 rounded-full text-xs border ${selectedArea.id === a.id ? "bg-cyan-500 text-black border-transparent" : "bg-[#0a1018] border-[#1e3a5a] text-[#8aa0b8]"}`}>{a.name}</button>
                      ))}
                    </div>
                    <div className="mt-2 h-[220px] rounded-xl overflow-hidden border border-[#1e3a5a]"><ChennaiMap selectedArea={selectedArea} onSelectArea={(a:any)=>{ const found=AREAS.find(x=>x.id===a.id); if(found) setSelectedArea(found); }} onSelectFeature={(f:any)=>{ setSelected(f); pushToast(`Selected ${f.name||f.type}`); }} /></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {active === "modules" && (
            <div className="space-y-4">
              <h1 className="text-2xl font-extrabold">Modules 1-4</h1>
              <p className="text-sm text-[#8aa0b8]">Each module has its own inputs, parameters and outputs. Run them in order.</p>
              <div className="grid lg:grid-cols-2 gap-4">
                {[
                  { id: "m1", name: "Module 1: Collect", desc: "SRTM DEM, IMD rainfall, OSM", inputs: "9 vectors + 5 rasters", status: "Done • 1811 buildings", action: "Re-validate" },
                  { id: "m2", name: "Module 2: Preprocess", desc: "CRS align, clean, terrain", inputs: "QGIS-equivalent", status: "Done • 8/8 stations", action: "Re-run" },
                  { id: "m3", name: "Module 3: Store", desc: "PostGIS geometry + raster", inputs: "docker-compose.yml", status: "Ready • 10 tables", action: "Load" },
                  { id: "m4", name: "Module 4: Simulate", desc: "SCS-CN + D8 + depth", inputs: "P, CN, t", status: "Ready • Q 63mm", action: "Simulate" },
                ].map((m) => (
                  <div key={m.id} className="bg-[#0f1e2e] border border-[#1e3a5a] rounded-2xl p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-bold">{m.name}</div>
                        <div className="text-xs text-[#8aa0b8]">{m.desc} • {m.inputs}</div>
                      </div>
                      <span className="text-xs px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-300">{m.status}</span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                      <label className="space-y-1"><span className="text-[#8aa0b8]">Parameter A</span><input defaultValue="78" className="w-full bg-[#0a1018] border border-[#1e3a5a] rounded px-2 py-1" /><span className="text-[10px] text-[#8aa0b8]">Range 30-98 • Default 78</span></label>
                      <label className="space-y-1"><span className="text-[#8aa0b8]">Threshold</span><input defaultValue="0.15" className="w-full bg-[#0a1018] border border-[#1e3a5a] rounded px-2 py-1" /><span className="text-[10px] text-[#8aa0b8]">Depth &gt; 0.15m = flooded</span></label>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button onClick={() => pushToast(`${m.name} started`)} className="px-3 py-1.5 rounded-full bg-cyan-500 text-black text-xs font-semibold">{m.action}</button>
                      <button onClick={() => pushToast("Parameters reset")} className="px-3 py-1.5 rounded-full border border-[#1e3a5a] text-xs">Reset</button>
                      <button onClick={() => pushToast("Preset saved")} className="px-3 py-1.5 rounded-full border border-[#1e3a5a] text-xs">Save Preset</button>
                    </div>
                    <div className="mt-3 text-xs text-[#8aa0b8]">History: 3 runs • Last run Today 09:24 • <button onClick={() => pushToast("History opened")} className="underline">View</button></div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {active === "simulate" && (
            <div className="space-y-4">
              <h1 className="text-2xl font-extrabold">Simulation Control Center</h1>
              <div className="grid lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 space-y-4">
                  <div className="bg-[#0f1e2e] border border-[#1e3a5a] rounded-2xl p-4">
                    <h3 className="font-bold">Rainfall Input</h3>
                    <div className="grid sm:grid-cols-3 gap-3 mt-3">
                      <label className="space-y-1 text-sm"><span className="text-[#8aa0b8]">Rainfall P (mm)</span><input type="number" value={rainfall} onChange={(e) => setRainfall(+e.target.value)} className="w-full bg-[#0a1018] border border-[#1e3a5a] rounded px-2 py-1.5" /></label>
                      <label className="space-y-1 text-sm"><span className="text-[#8aa0b8]">CN (Urban Density)</span><input type="number" value={cn} onChange={(e) => setCn(+e.target.value)} className="w-full bg-[#0a1018] border border-[#1e3a5a] rounded px-2 py-1.5" /></label>
                      <label className="space-y-1 text-sm"><span className="text-[#8aa0b8]">Duration</span><select className="w-full bg-[#0a1018] border border-[#1e3a5a] rounded px-2 py-1.5"><option>3h Peak</option><option>6h</option><option>24h</option></select></label>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button onClick={() => pushToast("Historical 2015 event loaded")} className="text-xs px-3 py-1.5 rounded-full border border-[#1e3a5a]">Load Historical 2015</button>
                      <button onClick={() => pushToast("Custom rainfall uploaded")} className="text-xs px-3 py-1.5 rounded-full border border-[#1e3a5a]">Upload CSV</button>
                      <span className="text-xs text-[#8aa0b8] self-center">Runoff Q ~ {(rainfall > 14 ? ((rainfall - 14) ** 2 / (rainfall + 56)).toFixed(1) : 0)} mm</span>
                    </div>
                  </div>

                  <div className="bg-[#0f1e2e] border border-[#1e3a5a] rounded-2xl p-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold">Simulation</h3>
                      <span className={`text-xs px-2 py-1 rounded-full ${simRunning ? "bg-amber-500/20 text-amber-300" : "bg-emerald-500/20 text-emerald-300"}`}>{simRunning ? "Running" : "Idle"}</span>
                    </div>
                    <div className="mt-3 space-y-2">
                      <div className="flex gap-2">
                        <button onClick={() => setSimRunning(true)} className="px-4 py-2 rounded-full bg-cyan-500 text-black text-sm font-semibold">Start</button>
                        <button onClick={() => setSimRunning(false)} className="px-4 py-2 rounded-full border border-[#1e3a5a] text-sm">Pause</button>
                        <button onClick={() => { setSimRunning(false); setSimProgress(0); }} className="px-4 py-2 rounded-full border border-[#1e3a5a] text-sm">Stop</button>
                        <button onClick={() => { setSimProgress(0); setSimRunning(true); }} className="px-4 py-2 rounded-full border border-[#1e3a5a] text-sm">Restart</button>
                      </div>
                      <div>
                        <div className="flex justify-between text-xs text-[#8aa0b8]"><span>Progress</span><span>{simProgress}%</span></div>
                        <div className="w-full h-2 bg-[#0a1018] rounded-full mt-1"><div className="h-2 bg-cyan-500 rounded-full transition-all" style={{ width: `${simProgress}%` }} /></div>
                        <div className="flex justify-between text-xs text-[#8aa0b8] mt-1"><span>Stage: Routing</span><span>~{Math.max(0, 60 - simProgress)}s left • 2,340 cells</span></div>
                      </div>
                      {!simRunning && simProgress === 45 && <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs">No simulation running — click Start to begin.</div>}
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-3 gap-3">
                    {[
                      { k: "Flow Direction", v: "D8 enabled", on: layers.flowDir },
                      { k: "Flow Accumulation", v: "Convergence visible", on: layers.flowAcc },
                      { k: "Flood Depth", v: "0.42m mean", on: layers.depth },
                    ].map((x) => (
                      <div key={x.k} className="bg-[#0f1e2e] border border-[#1e3a5a] rounded-xl p-3">
                        <div className="font-semibold text-sm">{x.k}</div>
                        <div className="text-xs text-[#8aa0b8]">{x.v}</div>
                        <button onClick={() => setLayers((l) => ({ ...l, [x.k === "Flow Direction" ? "flowDir" : x.k === "Flow Accumulation" ? "flowAcc" : "depth"]: !x.on }))} className={`mt-2 text-xs px-2 py-1 rounded-full border ${x.on ? "bg-cyan-500 text-black" : "border-[#1e3a5a]"}`}>{x.on ? "Disable" : "Enable"} layer</button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="bg-[#0f1e2e] border border-[#1e3a5a] rounded-2xl p-4">
                    <h4 className="font-bold">Time Control</h4>
                    <div className="flex items-center gap-2 mt-3">
                      <button onClick={() => setT((t) => Math.max(0, t - 5))} className="w-8 h-8 rounded-full border border-[#1e3a5a]">◀</button>
                      <button onClick={() => setSimRunning(!simRunning)} className="flex-1 py-2 rounded-full bg-cyan-500 text-black font-semibold">{simRunning ? "Pause" : "Play"}</button>
                      <button onClick={() => setT((t) => Math.min(100, t + 5))} className="w-8 h-8 rounded-full border border-[#1e3a5a]">▶</button>
                    </div>
                    <input type="range" min={0} max={100} value={t} onChange={(e) => setT(+e.target.value)} className="w-full mt-3" />
                    <div className="flex justify-between text-xs text-[#8aa0b8]"><span>Start</span><span>Peak</span><span>End</span></div>
                    <div className="flex gap-1 mt-2">
                      {["1x", "2x", "4x"].map((s) => (
                        <button key={s} onClick={() => setTimeSpeed(s === "1x" ? 1 : s === "2x" ? 2 : 4)} className={`flex-1 py-1 rounded-full text-xs ${timeSpeed === (s === "1x" ? 1 : s === "2x" ? 2 : 4) ? "bg-cyan-500 text-black" : "border border-[#1e3a5a]"}`}>{s}</button>
                      ))}
                    </div>
                  </div>
                  <div className="bg-[#0f1e2e] border border-[#1e3a5a] rounded-2xl p-4">
                    <h4 className="font-bold">Current Location</h4>
                    <div className="text-sm mt-2 space-y-1">
                      <div className="flex justify-between"><span className="text-[#8aa0b8]">Type</span><span>{selected.type}</span></div>
                      <div className="flex justify-between"><span className="text-[#8aa0b8]">Elevation</span><span>{selected.elevation || "-"}</span></div>
                      <div className="flex justify-between"><span className="text-[#8aa0b8]">Depth</span><span className="text-amber-300">{selected.depth || "0.00m"}</span></div>
                      <div className="flex justify-between"><span className="text-[#8aa0b8]">Velocity</span><span>{selected.velocity || "-"}</span></div>
                      <div className="flex justify-between"><span className="text-[#8aa0b8]">Status</span><span className={`px-2 py-0.5 rounded-full text-xs ${selected.status === "Flooded" ? "bg-red-500/20 text-red-300" : "bg-emerald-500/20 text-emerald-300"}`}>{selected.status}</span></div>
                    </div>
                    <button onClick={() => setBookmarks((b) => [...b, { name: `Point ${b.length + 1}`, type: selected.type }])} className="w-full mt-3 py-1.5 rounded-full border border-[#1e3a5a] text-sm">Bookmark Location</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {active === "visualize" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h1 className="text-2xl font-extrabold">2D / 3D Visualization</h1>
                <div className="flex gap-2">
                  <button onClick={() => pushToast("Reset camera")} className="px-3 py-1.5 rounded-full border border-[#1e3a5a] text-sm">Reset View</button>
                  <button onClick={() => pushToast("Focused full area")} className="px-3 py-1.5 rounded-full border border-[#1e3a5a] text-sm">Full Area</button>
                </div>
              </div>

              <div className="flex gap-1.5 flex-wrap">
                {AREAS.map((a) => (
                  <button key={a.id} onClick={() => setSelectedArea(a)} className={`px-3 py-1.5 rounded-full text-xs border ${selectedArea.id === a.id ? "bg-cyan-500 text-black border-transparent" : "bg-[#0f1e2e] border-[#1e3a5a] text-[#8aa0b8]"}`}>{a.name}</button>
                ))}
                <span className="ml-auto text-xs text-[#8aa0b8] self-center">3D shows: <b className="text-white">{selectedArea.name}</b> • {selectedArea.bounds.xmin.toFixed(2)}-{selectedArea.bounds.xmax.toFixed(2)}</span>
              </div>
              <div className="grid lg:grid-cols-4 gap-4">
                <div className="lg:col-span-1 bg-[#0f1e2e] border border-[#1e3a5a] rounded-2xl p-3 space-y-3">
                  <h4 className="font-bold">Layers</h4>
                  {Object.entries({ Terrain: "terrain", Water: "water", "Flood Depth": "depth", Buildings: "buildings", Roads: "roads", "Flow Dir": "flowDir", "Flow Acc": "flowAcc" }).map(([label, key]) => (
                    <label key={key} className="flex items-center justify-between p-2 rounded-lg bg-[#0a1018] border border-[#1e3a5a] text-sm">
                      <span>{label}</span>
                      <input type="checkbox" checked={(layers as any)[key]} onChange={(e) => setLayers((l) => ({ ...l, [key]: e.target.checked }))} className="accent-cyan-500" />
                    </label>
                  ))}
                  <div className="space-y-2">
                    <label className="text-xs text-[#8aa0b8]">Water Opacity <input type="range" min={0} max={100} defaultValue={45} className="w-full" /></label>
                    <label className="text-xs text-[#8aa0b8]">Depth Filter &gt; <input defaultValue="0.15" className="w-full bg-[#0a1018] border border-[#1e3a5a] rounded px-2 py-1 text-xs" /></label>
                  </div>
                  <button onClick={() => pushToast("Layer preset saved")} className="w-full py-1.5 rounded-full border border-[#1e3a5a] text-sm">Save Preset</button>
                </div>

                <div className="lg:col-span-3 space-y-4">
                  <div className="bg-[#0f1e2e] border border-[#1e3a5a] rounded-2xl p-2">
                    <FloodSimulation selectedArea={selectedArea} />
                  </div>
                  <div className="bg-[#0f1e2e] border border-[#1e3a5a] rounded-2xl p-3">
                    <div className="text-xs text-[#8aa0b8] mb-2">2D Map synced to 3D selection • {selectedArea.name} highlighted</div>
                    <div className="h-[360px] rounded-xl overflow-hidden border border-[#1e3a5a]"><ChennaiMap selectedArea={selectedArea} onSelectArea={(a:any)=>setSelectedArea(AREAS.find(x=>x.id===a.id)||AREAS[0])} onSelectFeature={(f:any)=>setSelected(f)} /></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {active === "impact" && (
            <div className="space-y-4">
              <h1 className="text-2xl font-extrabold">Impact Analysis</h1>
              <div className="grid sm:grid-cols-4 gap-3">
                {[
                  { k: "Flooded Area", v: "4.2 km²", sub: "16.1% of study", action: () => setActive("visualize") },
                  { k: "Max Depth", v: "0.75 m", sub: "Ennore lowland", action: () => pushToast("Highlighted max depth") },
                  { k: "Buildings Hit", v: "581", sub: "Click to list", action: () => pushToast("580 buildings - open in map") },
                  { k: "Roads Affected", v: "12.4 km", sub: "8 segments", action: () => pushToast("Roads highlighted") },
                ].map((m) => (
                  <button key={m.k} onClick={m.action} className="p-4 rounded-2xl bg-[#0f1e2e] border border-[#1e3a5a] text-left hover:border-cyan-500/40">
                    <div className="text-xs text-[#8aa0b8]">{m.k}</div>
                    <div className="text-xl font-extrabold">{m.v}</div>
                    <div className="text-xs text-[#8aa0b8]">{m.sub}</div>
                  </button>
                ))}
              </div>
              <div className="grid lg:grid-cols-2 gap-4">
                <div className="bg-[#0f1e2e] border border-[#1e3a5a] rounded-2xl p-4">
                  <h4 className="font-bold">Risk Zones</h4>
                  <div className="grid grid-cols-3 gap-2 mt-3 text-center text-sm">
                    <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30"><div className="font-bold text-emerald-300">Low</div><div className="text-xs">62%</div></div>
                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30"><div className="font-bold text-amber-300">Medium</div><div className="text-xs">22%</div></div>
                    <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30"><div className="font-bold text-red-300">High</div><div className="text-xs">16%</div></div>
                  </div>
                  <div className="mt-3 text-xs text-[#8aa0b8]">Risk = depth &gt;0.5m + velocity &gt;0.4m/s + accumulation. Click a zone to filter map.</div>
                </div>
                <div className="bg-[#0f1e2e] border border-[#1e3a5a] rounded-2xl p-4">
                  <h4 className="font-bold">Filter Analysis</h4>
                  <div className="grid grid-cols-2 gap-2 mt-3">
                    <select className="bg-[#0a1018] border border-[#1e3a5a] rounded px-2 py-1.5 text-sm"><option>All Time</option><option>Peak (t=90)</option><option>Final</option></select>
                    <select className="bg-[#0a1018] border border-[#1e3a5a] rounded px-2 py-1.5 text-sm"><option>Depth &gt;0.15m</option><option>&gt;0.5m</option><option>&gt;1.5m</option></select>
                    <select className="bg-[#0a1018] border border-[#1e3a5a] rounded px-2 py-1.5 text-sm"><option>All Assets</option><option>Buildings</option><option>Roads</option></select>
                    <button onClick={() => pushToast("Filters applied")} className="py-1.5 rounded-full bg-cyan-500 text-black text-sm font-semibold">Apply</button>
                  </div>
                  <div className="mt-3 p-3 rounded-xl bg-[#0a1018] border border-[#1e3a5a] text-sm">Selected: Ripon Building • Depth 0.42m • <span className="text-amber-300">Medium Risk</span> • Velocity 0.38 m/s</div>
                </div>
              </div>
            </div>
          )}

          {active === "scenarios" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h1 className="text-2xl font-extrabold">Scenarios</h1>
                <button onClick={() => { const id = `s${Date.now()}`; setScenarios((s) => [...s, { id, name: `Scenario ${s.length + 1}`, P: rainfall, CN: cn, depth: "0.42m", area: "8.1%" }]); pushToast("Scenario created"); }} className="px-4 py-2 rounded-full bg-cyan-500 text-black text-sm font-semibold">+ New Scenario</button>
              </div>
              <div className="grid lg:grid-cols-3 gap-4">
                <div className="lg:col-span-1 bg-[#0f1e2e] border border-[#1e3a5a] rounded-2xl p-3 space-y-2">
                  {scenarios.map((s) => (
                    <div key={s.id} onClick={() => setActiveScenario(s.id)} className={`p-3 rounded-xl border cursor-pointer ${activeScenario === s.id ? "bg-[#12233a] border-cyan-500/50" : "bg-[#0a1018] border-[#1e3a5a]"}`}>
                      <div className="font-semibold text-sm">{s.name}</div>
                      <div className="text-xs text-[#8aa0b8]">P {s.P} • CN {s.CN} • Depth {s.depth} • {s.area}</div>
                      <div className="flex gap-2 mt-2">
                        <button onClick={(e) => { e.stopPropagation(); const n = prompt("Rename", s.name); if (n) setScenarios((x) => x.map((y) => (y.id === s.id ? { ...y, name: n } : y))); }} className="text-xs px-2 py-1 rounded-full border border-[#1e3a5a]">Rename</button>
                        <button onClick={(e) => { e.stopPropagation(); setScenarios((x) => x.filter((y) => y.id !== s.id)); }} className="text-xs px-2 py-1 rounded-full border border-red-900 text-red-300">Archive</button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="lg:col-span-2 bg-[#0f1e2e] border border-[#1e3a5a] rounded-2xl p-4">
                  <h3 className="font-bold">Compare</h3>
                  <div className="grid sm:grid-cols-2 gap-3 mt-3">
                    {scenarios.slice(0, 2).map((s) => (
                      <div key={s.id} className="p-3 rounded-xl bg-[#0a1018] border border-[#1e3a5a]">
                        <div className="font-semibold">{s.name}</div>
                        <div className="text-xs text-[#8aa0b8]">Flood extent {s.area} • Max {s.depth}</div>
                        <div className="mt-2 h-24 rounded-lg bg-[#12233a] grid place-items-center text-xs text-[#8aa0b8]">Map sync preview</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-xs text-[#8aa0b8]"><tr><th className="text-left py-1">Metric</th><th>Monsoon Peak</th><th>Base</th><th>Delta</th></tr></thead>
                      <tbody>
                        <tr><td>Flooded area</td><td>16.1%</td><td>8.4%</td><td className="text-amber-300">+7.7%</td></tr>
                        <tr><td>Max depth</td><td>0.75m</td><td>0.42m</td><td className="text-red-300">+0.33m</td></tr>
                        <tr><td>Buildings</td><td>581</td><td>312</td><td>+269</td></tr>
                      </tbody>
                    </table>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => pushToast("Timelines synchronized")} className="px-3 py-1.5 rounded-full border border-[#1e3a5a] text-sm">Sync Timelines</button>
                    <button onClick={() => pushToast("Comparison exported")} className="px-3 py-1.5 rounded-full bg-cyan-500 text-black text-sm">Export Compare</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {active === "reports" && (
            <div className="space-y-4">
              <h1 className="text-2xl font-extrabold">Reports & Export</h1>
              <div className="grid lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 bg-[#0f1e2e] border border-[#1e3a5a] rounded-2xl p-4">
                  <h3 className="font-bold">Report Builder</h3>
                  <div className="grid sm:grid-cols-2 gap-2 mt-3 text-sm">
                    {["Project info", "Rainfall", "Flood extent", "Flood depth", "Buildings", "Roads", "Risk", "Maps", "Charts", "Comparison"].map((k) => (
                      <label key={k} className="flex items-center gap-2 p-2 rounded-lg bg-[#0a1018] border border-[#1e3a5a]"><input type="checkbox" defaultChecked className="accent-cyan-500" /> {k}</label>
                    ))}
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => pushToast("Report preview opened")} className="px-4 py-2 rounded-full border border-[#1e3a5a] text-sm">Preview</button>
                    <button onClick={() => pushToast("Report exported as PDF", "Open")} className="px-4 py-2 rounded-full bg-cyan-500 text-black text-sm font-semibold">Export PDF</button>
                  </div>
                </div>
                <div className="bg-[#0f1e2e] border border-[#1e3a5a] rounded-2xl p-4">
                  <h4 className="font-bold">Export</h4>
                  <div className="space-y-2 mt-2 text-sm">
                    <select className="w-full bg-[#0a1018] border border-[#1e3a5a] rounded px-2 py-1.5"><option>GeoJSON</option><option>GeoTIFF</option><option>CSV</option><option>PNG</option></select>
                    <select className="w-full bg-[#0a1018] border border-[#1e3a5a] rounded px-2 py-1.5"><option>Current time</option><option>Full timeline</option><option>Peak only</option></select>
                    <button onClick={() => pushToast("Export started • simulation.geojson")} className="w-full py-2 rounded-full bg-cyan-500 text-black font-semibold">Export Data</button>
                    <div className="text-xs text-[#8aa0b8]">Includes: flood depth, extent, affected assets for active scenario.</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {active === "bookmarks" && (
            <div className="bg-[#0f1e2e] border border-[#1e3a5a] rounded-2xl p-4">
              <h3 className="font-bold">Bookmarks</h3>
              <div className="space-y-2 mt-3">
                {bookmarks.map((b, i) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-[#0a1018] border border-[#1e3a5a] text-sm">
                    <span>{b.name} • <span className="text-[#8aa0b8]">{b.type}</span></span>
                    <div className="flex gap-2">
                      <button onClick={() => pushToast(`Focused ${b.name}`)} className="text-xs px-2 py-1 rounded-full border border-[#1e3a5a]">Go</button>
                      <button onClick={() => setBookmarks((x) => x.filter((_, j) => j !== i))} className="text-xs px-2 py-1 rounded-full border border-red-900 text-red-300">Remove</button>
                    </div>
                  </div>
                ))}
                {bookmarks.length === 0 && <div className="py-8 text-center border border-dashed border-[#1e3a5a] rounded-xl text-[#8aa0b8] text-sm">No bookmarks yet — inspect a building or road and save it.</div>}
              </div>
            </div>
          )}

          {active === "settings" && (
            <div className="bg-[#0f1e2e] border border-[#1e3a5a] rounded-2xl p-4">
              <h3 className="font-bold">Settings & Customization</h3>
              <div className="grid sm:grid-cols-2 gap-4 mt-3 text-sm">
                <label className="space-y-1"><span className="text-[#8aa0b8]">Units</span><select className="w-full bg-[#0a1018] border border-[#1e3a5a] rounded px-2 py-1.5"><option>Metric (m, mm)</option><option>Imperial</option></select></label>
                <label className="space-y-1"><span className="text-[#8aa0b8]">Default Speed</span><select value={timeSpeed} onChange={(e) => setTimeSpeed(+e.target.value)} className="w-full bg-[#0a1018] border border-[#1e3a5a] rounded px-2 py-1.5"><option value={1}>1x</option><option value={2}>2x</option><option value={4}>4x</option></select></label>
                <label className="flex items-center gap-2"><input type="checkbox" defaultChecked /> Show depth legend</label>
                <label className="flex items-center gap-2"><input type="checkbox" /> Reduce motion</label>
              </div>
              <button onClick={() => pushToast("Settings saved")} className="mt-4 px-4 py-2 rounded-full bg-cyan-500 text-black text-sm font-semibold">Save Preferences</button>
            </div>
          )}
        </main>

        <div className="fixed bottom-4 right-4 space-y-2 z-50">
          {toasts.map((t) => (
            <div key={t.id} className="px-4 py-2 rounded-full bg-[#12233a] border border-cyan-500/30 text-sm shadow-lg flex items-center gap-3">
              <span>{t.msg}</span>
              {t.action && <button onClick={() => pushToast(`${t.action} opened`)} className="text-cyan-300 underline text-xs">{t.action}</button>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
