"use client";
import { useState, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import { ViewMode } from "@/components/FloodSimulation";
import EvacuationRouting from "@/components/EvacuationRouting";
import { AREAS, CHENNAI_SEARCH_INDEX, type Scenario } from "@/app/lib/chennai-data";
import { useHydrology } from "@/hooks/useHydrology";
import { useChennaiLive } from "@/hooks/useChennaiLive";
import HydrologyWorkspace from "@/app/lib/workspaces/HydrologyWorkspace";
import ValidationWorkspace from "@/app/lib/workspaces/ValidationWorkspace";
import RegistryWorkspace from "@/app/lib/workspaces/RegistryWorkspace";
import CrisisCommandCenter from "@/components/CrisisCommandCenter";
import FloodMLAnalytics from "@/components/FloodMLAnalytics";
import WebFloodEngine from "@/components/WebFloodEngine";
import AnalyticsSuite from "@/components/AnalyticsSuite";
import InsightStrip from "@/components/InsightStrip";

const ChennaiMap = dynamic(() => import("@/components/ChennaiMap"), {
  ssr: false,
  loading: () => <div style={{ height: 380, border: "1px solid #E6E1D8", background: "#FFFFFF", display: "grid", placeItems: "center", fontFamily: "var(--font-mono)", fontSize: 11, color: "#6B6B63" }}>MAP ENGINE — LOADING TILES…</div>,
});
const FloodSimulation = dynamic(() => import("@/components/FloodSimulation"), {
  ssr: false,
  loading: () => <div style={{ height: 420, border: "1px solid #E6E1D8", background: "#0F1110", display: "grid", placeItems: "center", fontFamily: "var(--font-mono)", fontSize: 11, color: "#8B7355" }}>WEBGL TERRAIN — COMPILING SHADERS…</div>,
});

type Toast = { id: number; msg: string };

export default function Page() {
  const [activeWorkspace, setActiveWorkspace] = useState<"digital_twin" | "hydrology" | "scenarios" | "impact" | "evacuation" | "validation" | "registry" | "reports">("digital_twin");
  const [viewMode, setViewMode] = useState<ViewMode>("digital_twin");
  const [selectedArea, setSelectedArea] = useState(AREAS[1]);
  const [aoiKm, setAoiKm] = useState(1.5);
  const [rainOverlayEnabled, setRainOverlayEnabled] = useState(true);
  const [rainfall, setRainfall] = useState(160);
  const [cn, setCn] = useState(84);
  const [duration, setDuration] = useState(60);
  const [currentHour, setCurrentHour] = useState(2);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<1 | 2 | 4>(1);
  const [inspectedFeature, setInspectedFeature] = useState<any>({
    name: "Ripon Building (GCC HQ)", type: "Building Footprint · OSM 208361200", elevation: "6.42 m", depth: "0.58 m", velocity: "0.48 m/s", risk: "MODERATE", confidence: "SURVEYED / SRTM 30m", basin: "Cooum River Basin",
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
  const [selectedWard, setSelectedWard] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [showOnboard, setShowOnboard] = useState(false);
  const pushToast = (msg: string) => { const id = Date.now()+Math.floor(Math.random()*1000); setToasts((t) => [...t, { id, msg }]); setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3000); };
  const live = useChennaiLive(rainfall);
  const blendedP = useMemo(()=> Math.round((rainfall*0.6 + live.precipitation*0.4)*10)/10, [rainfall, live.precipitation]);
  const { S, Ia, Q, economicLoss } = useHydrology(blendedP, cn, duration);
  const searchResults = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return CHENNAI_SEARCH_INDEX.filter((i) => i.name.toLowerCase().includes(q) || i.type.toLowerCase().includes(q) || i.basin.toLowerCase().includes(q));
  }, [search]);

  useEffect(() => {
    if (!isPlaying) return;
    const id = setInterval(() => setCurrentHour((p) => (p >= 6 ? 0 : p + 1)), 1800 / playbackSpeed);
    return () => clearInterval(id);
  }, [isPlaying, playbackSpeed]);
  useEffect(() => {
    try { if(!localStorage.getItem("floin_onboard_v2")) { setShowOnboard(true); localStorage.setItem("floin_onboard_v2","1"); } } catch {}
    const h = (e: KeyboardEvent) => { if(e.key==="?" || (e.key==="/" && e.shiftKey)) setShowHelp(v=>!v); if(e.key==="Escape") { setShowHelp(false); setShowOnboard(false); } };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  }, []);

  const handleMapClick = (lat: number, lng: number) => {
    const d = aoiKm / 111;
    setSelectedArea({ id: `aoi-${Date.now()}`, name: `CLIP ${lat.toFixed(3)}°N ${lng.toFixed(3)}°E`, basin: lat > 13.15 ? "Kosasthalaiyar" : lat < 13.02 ? "Adyar" : "Cooum", bounds: { xmin: lng - d, xmax: lng + d, ymin: lat - d, ymax: lat + d }, center: [lng, lat] as [number, number], lat, lng });
    pushToast(`CLIP ${lat.toFixed(3)},${lng.toFixed(3)} · ${aoiKm}KM`);
  };

  const handleExportReport = () => {
    const w = window.open("", "_blank"); if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><title>FLOIN Ledger — ${selectedArea.name}</title><style>body{font-family:IBM Plex Sans,system-ui;padding:32px;color:#111210}h1{font-family:Instrument Serif,Georgia;font-size:22px;border-bottom:1px solid #111210;padding-bottom:8px}table{border-collapse:collapse;width:100%;font-size:12px}th,td{border:1px solid #E6E1D8;padding:6px 8px;text-align:left}th{background:#F8F6F1;font-family:IBM Plex Mono}</style></head><body><h1>01 // FLOIN LEDGER — ${selectedArea.name}</h1><p style="font:11px IBM Plex Mono">${selectedArea.basin} · P ${rainfall}mm · CN ${cn} · Q ${Q.toFixed(1)}mm · Depth ${economicLoss.depthVal}m · Loss ₹${economicLoss.directLossCrores}Cr</p><table><tr><th>Scenario</th><th>P</th><th>CN</th><th>Q</th><th>Depth</th></tr>${scenarios.map(s=>`<tr><td>${s.name}</td><td>${s.P}</td><td>${s.CN}</td><td>${s.runoff}</td><td>${s.depth}</td></tr>`).join("")}</table><p style="font:10px IBM Plex Mono;color:#6B6B63;margin-top:24px;border-top:1px solid #E6E1D8;padding-top:8px">FLOIN REV 06D9C60 · 2026-09-04 · EPSG:4326 · NSE 0.892</p></body></html>`);
    w.document.close(); pushToast("LEDGER EXPORTED");
  };
  const handleExportGeoJSON = () => {
    const data = { type: "FeatureCollection", name: selectedArea.id, properties: { basin: selectedArea.basin, P: rainfall, CN: cn, Q: +Q.toFixed(2), depth: +economicLoss.depthVal, loss: +economicLoss.directLossCrores, aoi: selectedArea, crs: "EPSG:4326" }, features: [{ type: "Feature", properties: { id: selectedArea.id }, geometry: { type: "Polygon", coordinates: [[[selectedArea.bounds.xmin, selectedArea.bounds.ymin],[selectedArea.bounds.xmax, selectedArea.bounds.ymin],[selectedArea.bounds.xmax, selectedArea.bounds.ymax],[selectedArea.bounds.xmin, selectedArea.bounds.ymax],[selectedArea.bounds.xmin, selectedArea.bounds.ymin]]] } }] };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href=url; a.download=`floin-${selectedArea.id}.geojson`; a.click(); setTimeout(()=>URL.revokeObjectURL(url),800); pushToast("GEOJSON EXPORTED");
  };

  const workspaces: { id: typeof activeWorkspace; label: string; mono: string }[] = [
    { id: "digital_twin", label: "Digital Twin", mono: "01" },
    { id: "hydrology", label: "Hydrology", mono: "02" },
    { id: "scenarios", label: "Scenarios", mono: "03" },
    { id: "impact", label: "Impact", mono: "04" },
    { id: "evacuation", label: "Evacuation", mono: "05" },
    { id: "validation", label: "Validation", mono: "06" },
    { id: "registry", label: "Registry", mono: "07" },
    { id: "reports", label: "Export", mono: "08" },
  ];

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--paper)", color: "var(--ink)" }}>
      <header className="sticky top-0 z-40 flex items-center gap-0" style={{ minHeight: 40, borderBottom: "1px solid var(--rule-strong)", background: "var(--paper)", flexWrap:"wrap" }}>
        <div className="flex items-center gap-3 px-3 md:px-4 shrink-0" style={{ borderRight: "1px solid var(--rule)", height: 40 }}>
          <div className="w-[18px] h-[18px] grid place-items-center shrink-0" style={{ background: "var(--ink)", color: "var(--paper)", fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600 }}>◈</div>
          <span style={{ fontFamily: "var(--font-display)", fontSize: 16, letterSpacing: "-0.02em", lineHeight: 1, whiteSpace:"nowrap" }}>FLOIN</span>
          <span className="hidden sm:inline" style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.12em", border: "1px solid var(--rule-strong)", padding: "2px 6px", background: "var(--surface)", whiteSpace:"nowrap" }}>LEDGER · CHENNAI</span>
        </div>
        <div className="hidden lg:flex items-center gap-2 px-4 text-[11px] shrink-0" style={{ fontFamily: "var(--font-mono)" }}>
          <span style={{ color: "var(--muted)" }}>BASIN</span><span style={{ fontWeight: 600 }}>{selectedArea.basin}</span>
          <span style={{ width: 1, height: 12, background: "var(--rule-strong)" }} />
          <span style={{ color: "var(--muted)" }}>P</span><span style={{ fontWeight: 600 }}>{rainfall}mm</span>
          <span style={{ color: "var(--hydro)", fontWeight: 600 }}>Q {Q.toFixed(1)}mm</span>
          <span style={{ color: "var(--vermillion)", fontWeight: 600 }}>₹{economicLoss.directLossCrores}Cr</span>
          <span style={{ width: 1, height: 12, background: "var(--rule-strong)" }} />
          <span style={{ color: "var(--muted)" }}>EPSG:4326</span>
        </div>
        <div className="relative hidden md:block ml-2 md:ml-4 flex-1 max-w-[320px] min-w-[180px]">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="SEARCH LANDMARK / RESERVOIR / IMD…" aria-label="Search landmarks" style={{ width: "100%", height: 28, border: "1px solid var(--rule-strong)", background: "var(--surface)", padding: "0 10px", fontFamily: "var(--font-mono)", fontSize: 11, outline: "none" }} />
          {searchResults.length > 0 && (
            <div style={{ position: "absolute", top: 32, left: 0, right: 0, background: "var(--surface)", border: "1px solid var(--ink)", zIndex: 50, maxHeight: 260, overflowY:"auto" }}>
              {searchResults.map((it) => (
                <button key={it.name} onClick={() => { const d=aoiKm/111; setSelectedArea({ id:`search-${it.name.slice(0,8)}`, name: it.name, basin: it.basin, bounds:{xmin:it.coords[0]-d,xmax:it.coords[0]+d,ymin:it.coords[1]-d,ymax:it.coords[1]+d}, center: it.coords as any}); setSearch(""); pushToast(it.name); }} style={{ display:"flex", justifyContent:"space-between", gap:8, width:"100%", padding:"8px 10px", fontFamily:"var(--font-mono)", fontSize:11, borderBottom:"1px solid var(--rule)", textAlign:"left" }}>
                  <span style={{ fontWeight:600, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{it.name}</span><span style={{ color:"var(--muted)", fontSize:10, shrink:0 }}>{it.type}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="header-actions px-2 md:px-3 py-1">
          <button onClick={()=>setShowHelp(!showHelp)} title="Keyboard help (?)" aria-label="Help" style={{ height:28, width:28, display:"grid", placeItems:"center", border:"1px solid var(--rule-strong)", background:"var(--surface)", fontFamily:"var(--font-mono)", fontSize:12, fontWeight:600, flexShrink:0 }}>?</button>
          <button onClick={() => setRainOverlayEnabled(!rainOverlayEnabled)} aria-pressed={rainOverlayEnabled} style={{ height: 28, padding:"0 10px", border:`1px solid ${rainOverlayEnabled?"var(--ink)":"var(--rule-strong)"}`, background: rainOverlayEnabled?"var(--ink)":"var(--surface)", color: rainOverlayEnabled?"var(--paper)":"var(--muted2)", fontFamily:"var(--font-mono)", fontSize:10, letterSpacing:"0.08em", fontWeight:600, whiteSpace:"nowrap" }}>STORM {rainOverlayEnabled?"ON":"OFF"}</button>
          <button onClick={handleExportReport} style={{ height:28, padding:"0 10px", border:"1px solid var(--ink)", background:"var(--surface)", fontFamily:"var(--font-mono)", fontSize:10, fontWeight:600, letterSpacing:"0.08em", whiteSpace:"nowrap" }} className="hidden sm:inline-flex items-center justify-center">BRIEF</button>
          <button onClick={handleExportGeoJSON} style={{ height:28, padding:"0 10px", background:"var(--ink)", color:"var(--paper)", border:"1px solid var(--ink)", fontFamily:"var(--font-mono)", fontSize:10, fontWeight:600, letterSpacing:"0.08em", whiteSpace:"nowrap" }}>EXPORT</button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0 flex-col">
      <div className="md:hidden flex gap-1 overflow-x-auto px-2 py-2" style={{ borderBottom:"1px solid var(--rule)", background:"var(--paper)" }}>
        {workspaces.map((w)=> (
          <button key={w.id} onClick={()=>setActiveWorkspace(w.id)} style={{ whiteSpace:"nowrap", padding:"6px 10px", border:"1px solid", borderColor: activeWorkspace===w.id?"var(--ink)":"var(--rule)", background: activeWorkspace===w.id?"var(--ink)":"var(--surface)", color: activeWorkspace===w.id?"var(--paper)":"var(--muted)", fontFamily:"var(--font-mono)", fontSize:10, fontWeight:600 }}>{w.mono} {w.label.toUpperCase()}</button>
        ))}
      </div>
      <div className="flex flex-1 min-h-0">
        <aside className="hidden md:flex flex-col shrink-0" style={{ width: 220, borderRight:"1px solid var(--rule-strong)", background:"var(--paper)" }}>
          <div style={{ padding:"12px 12px 8px", borderBottom:"1px solid var(--rule)", fontFamily:"var(--font-mono)", fontSize:10, letterSpacing:"0.14em", color:"var(--muted)", fontWeight:600 }}>INDEX</div>
          <nav style={{ padding: 8, display:"grid", gap:2 }}>
            {workspaces.map((w) => (
              <button key={w.id} onClick={() => setActiveWorkspace(w.id)} style={{ textAlign:"left", display:"flex", gap:10, alignItems:"center", padding:"8px 10px", border:"1px solid", borderColor: activeWorkspace===w.id?"var(--ink)":"transparent", background: activeWorkspace===w.id?"var(--surface)":"transparent", borderLeftWidth: activeWorkspace===w.id?2:1, borderLeftColor: activeWorkspace===w.id?"var(--vermillion)":"transparent" }}>
                <span style={{ fontFamily:"var(--font-mono)", fontSize:10, color: activeWorkspace===w.id?"var(--ink)":"var(--muted)", fontWeight:600 }}>{w.mono}</span>
                <span style={{ fontFamily:"var(--font-body)", fontSize:13, fontWeight: activeWorkspace===w.id?600:400, color: activeWorkspace===w.id?"var(--ink)":"var(--muted2)" }}>{w.label}</span>
              </button>
            ))}
          </nav>
          <div style={{ marginTop:"auto", borderTop:"1px solid var(--rule-strong)", padding:12, background:"var(--surface)" }}>
            <div style={{ fontFamily:"var(--font-mono)", fontSize:9, letterSpacing:"0.12em", color:"var(--muted)", fontWeight:600 }}>TELEMETRY</div>
            <div style={{ fontFamily:"var(--font-mono)", fontSize:11, marginTop:6, lineHeight:1.5 }}>
              <div>P <span style={{ fontWeight:600 }}>{rainfall}mm</span> · CN <span style={{ fontWeight:600 }}>{cn}</span> · t <span style={{ fontWeight:600 }}>{duration}m</span></div>
              <div style={{ color:"var(--hydro)", fontWeight:600 }}>Q {Q.toFixed(1)}mm · {economicLoss.depthVal}m</div>
              <div style={{ color:"var(--vermillion)", fontWeight:600 }}>LOSS ₹{economicLoss.directLossCrores}Cr · {economicLoss.displacedPop}</div>
            </div>
            <div style={{ marginTop:8, height:2, background:"var(--rule)", position:"relative" }}><div style={{ position:"absolute", left:0, top:0, bottom:0, width:`${Math.min(100, rainfall/300*100)}%`, background:"var(--ink)" }} /></div>
            <div style={{ marginTop:8, fontFamily:"var(--font-mono)", fontSize:9, color:"var(--muted)" }}>REV 06D9C60 · 2026-09-04 · NSE 0.892</div>
          </div>
        </aside>

        <main className="flex-1 min-w-0" style={{ background:"var(--paper)", padding: 16 }}>
          {activeWorkspace === "digital_twin" && (
            <div>
              <div style={{ display:"flex", alignItems:"baseline", gap:12, borderBottom:"1px solid var(--ink)", paddingBottom:8, marginBottom:12 }}>
                <span style={{ fontFamily:"var(--font-mono)", fontSize:11, letterSpacing:"0.12em", fontWeight:600 }}>01 // DIGITAL TWIN</span>
                <span style={{ fontFamily:"var(--font-display)", fontSize:18 }}>{selectedArea.name}</span>
                <span style={{ marginLeft:"auto", fontFamily:"var(--font-mono)", fontSize:10, color:"var(--muted)" }}>SHADER {viewMode.toUpperCase()} · {selectedArea.center[1].toFixed(3)}°N {selectedArea.center[0].toFixed(3)}°E</span>
              </div>

              <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:10, border:"1px solid var(--rule)", background:"var(--surface)", padding:6 }}>
                <span style={{ fontFamily:"var(--font-mono)", fontSize:10, letterSpacing:"0.08em", color:"var(--muted)", padding:"4px 6px" }}>VIEW</span>
                {(["digital_twin","progression","depth_heatmap","velocity_field","infrastructure_impact","hydrology","data_quality"] as ViewMode[]).map((m) => (
                  <button key={m} onClick={() => setViewMode(m)} style={{ padding:"4px 8px", border:"1px solid", borderColor: viewMode===m?"var(--ink)":"var(--rule)", background: viewMode===m?"var(--ink)":"var(--surface)", color: viewMode===m?"var(--paper)":"var(--muted2)", fontFamily:"var(--font-mono)", fontSize:10, fontWeight:600, letterSpacing:"0.06em" }}>{m.toUpperCase().replace("_"," ")}</button>
                ))}
                <span style={{ marginLeft:"auto", display:"flex", gap:4, alignItems:"center", fontFamily:"var(--font-mono)", fontSize:10 }}>
                  <span style={{ color:"var(--muted)" }}>AOI</span>
                  {[0.5,1,1.5,3].map((k)=> <button key={k} onClick={()=>{setAoiKm(k); pushToast(`${k}KM`);}} style={{ padding:"2px 6px", border:"1px solid var(--rule-strong)", background: aoiKm===k?"var(--ink)":"var(--paper)", color: aoiKm===k?"var(--paper)":"var(--ink)", fontWeight:600 }}>{k}KM</button>)}
                </span>
              </div>

              <div style={{ display:"flex", gap:6, overflowX:"auto", paddingBottom:6, marginBottom:10 }}>
                {AREAS.map((a)=> (
                  <button key={a.id} onClick={()=>{setSelectedArea(a); pushToast(a.name);}} style={{ whiteSpace:"nowrap", padding:"5px 10px", border:"1px solid", borderColor: selectedArea.id===a.id?"var(--ink)":"var(--rule-strong)", background: selectedArea.id===a.id?"var(--ink)":"var(--surface)", color: selectedArea.id===a.id?"var(--paper)":"var(--ink)", fontFamily:"var(--font-mono)", fontSize:10, fontWeight:600 }}>
                    {a.name.toUpperCase()}
                  </button>
                ))}
              </div>

              <div className="twin-grid">
                <div style={{ display:"grid", gap:12 }}>
                  <div style={{ border:"1px solid var(--ink)", background:"var(--surface)" }}>
                    <div style={{ height:28, display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 10px", borderBottom:"1px solid var(--rule)", background:"var(--paper)", fontFamily:"var(--font-mono)", fontSize:10, fontWeight:600, letterSpacing:"0.08em" }}>
                      <span>03 // WEBGL DIGITAL TWIN — LEFT</span><span style={{ color:"var(--muted)" }}>{selectedArea.name}</span>
                    </div>
                    <div style={{ padding:8, background:"#0F1110" }}>
                      <FloodSimulation selectedArea={selectedArea} rainfall={rainfall} cn={cn} duration={duration} viewMode={viewMode} currentHour={currentHour} isPlaying={isPlaying} rainOverlayEnabled={rainOverlayEnabled} onTimeChange={setCurrentHour} onSelectObject={(o:any)=>{setInspectedFeature(o); pushToast(o.name);}} />
                    </div>
                    <div style={{ display:"flex", gap:12, padding:"6px 10px", borderTop:"1px solid var(--rule)", fontFamily:"var(--font-mono)", fontSize:10 }}>
                      <span><span style={{ display:"inline-block", width:14, height:6, background:"var(--hydro)", verticalAlign:"middle", marginRight:4 }} />&lt;0.3 LOW</span>
                      <span><span style={{ display:"inline-block", width:14, height:6, background:"#E6B422", verticalAlign:"middle", marginRight:4 }} />0.3-0.8 MED</span>
                      <span><span style={{ display:"inline-block", width:14, height:6, background:"var(--vermillion)", verticalAlign:"middle", marginRight:4 }} />&gt;0.8 HIGH</span>
                      <span style={{ marginLeft:"auto", color:"var(--muted)" }}>EPSG:4326 · SCS-CN · ward choropleth</span>
                    </div>
                  </div>
                  <InsightStrip rainfall={rainfall} cn={cn} duration={duration} currentHour={currentHour} selectedArea={selectedArea} />
                </div>

                <div style={{ display:"grid", gap:12 }}>
                  <div style={{ border:"1px solid var(--ink)", background:"var(--surface)" }}>
                    <div style={{ height:28, display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 10px", borderBottom:"1px solid var(--rule)", background:"var(--paper)", fontFamily:"var(--font-mono)", fontSize:10, fontWeight:600, letterSpacing:"0.08em" }}>
                      <span>02 // GEOSPATIAL CONTROL — RIGHT</span><span style={{ color:"var(--hydro)", fontWeight:700 }}>CLICK TO RETARGET</span>
                    </div>
                    <div style={{ padding:8 }}><ChennaiMap selectedArea={selectedArea} aoiSizeKm={aoiKm} rainfall={rainfall} cn={cn} onMapClick={handleMapClick} onSelectArea={setSelectedArea} onSelectFeature={(f:any)=>{setInspectedFeature(f); pushToast(f.name);}} /></div>
                  </div>

                  <div style={{ border:"1px solid var(--ink)", background:"var(--surface)" }}>
                    <div style={{ height:28, display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 10px", borderBottom:"1px solid var(--rule)", background:"var(--paper)" }}>
                      <span style={{ fontFamily:"var(--font-mono)", fontSize:10, fontWeight:600, letterSpacing:"0.08em" }}>04 // INSPECTOR</span>
                      <span style={{ fontFamily:"var(--font-mono)", fontSize:9, border:"1px solid var(--rule-strong)", padding:"2px 6px", background:"var(--paper)" }}>{inspectedFeature?.type || "ASSET"}</span>
                    </div>
                    <div style={{ padding:12 }}>
                      <div style={{ fontFamily:"var(--font-display)", fontSize:15, lineHeight:1.2 }}>{inspectedFeature?.name}</div>
                      <table style={{ width:"100%", marginTop:10, borderCollapse:"collapse", fontFamily:"var(--font-mono)", fontSize:11 }}>
                        <tbody>
                          <tr style={{ borderTop:"1px solid var(--rule)" }}><td style={{ padding:"6px 0", color:"var(--muted)" }}>DEPTH</td><td style={{ textAlign:"right", fontWeight:600, color: inspectedFeature?.depth?.includes("0.8")||inspectedFeature?.depth?.includes("0.9")?"var(--vermillion)":"var(--ink)" }}>{inspectedFeature?.depth || "0.58m"}</td></tr>
                          <tr style={{ borderTop:"1px solid var(--rule)" }}><td style={{ padding:"6px 0", color:"var(--muted)" }}>VELOCITY</td><td style={{ textAlign:"right", fontWeight:600, color:"var(--hydro)" }}>{inspectedFeature?.velocity || "0.48 m/s"}</td></tr>
                          <tr style={{ borderTop:"1px solid var(--rule)" }}><td style={{ padding:"6px 0", color:"var(--muted)" }}>RISK</td><td style={{ textAlign:"right", fontWeight:600 }}>{inspectedFeature?.risk || "MODERATE"}</td></tr>
                          <tr style={{ borderTop:"1px solid var(--rule)", borderBottom:"1px solid var(--rule)" }}><td style={{ padding:"6px 0", color:"var(--muted)" }}>BASIN</td><td style={{ textAlign:"right" }}>{inspectedFeature?.basin || selectedArea.basin}</td></tr>
                        </tbody>
                      </table>
                      <div style={{ marginTop:8, fontFamily:"var(--font-mono)", fontSize:10, color:"var(--muted)", display:"flex", justifyContent:"space-between" }}>
                        <span>ELEV {inspectedFeature?.elevation || "6.42m"}</span><span style={{ color:"var(--signal)", fontWeight:600 }}>{inspectedFeature?.confidence || "SURVEYED"}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ marginTop:12, border:"1px solid var(--ink)", background:"var(--surface)", padding:10, display:"flex", gap:12, alignItems:"center", flexWrap:"wrap" }}>
                <button onClick={()=>setIsPlaying(!isPlaying)} style={{ height:28, padding:"0 14px", background: isPlaying?"var(--vermillion)":"var(--ink)", color:"var(--paper)", border:"1px solid var(--ink)", fontFamily:"var(--font-mono)", fontSize:10, fontWeight:700, letterSpacing:"0.08em" }}>{isPlaying?"■ PAUSE":"▶ PLAY 6H"}</button>
                <div style={{ display:"flex", gap:2, border:"1px solid var(--rule-strong)", padding:2 }}>
                  {([1,2,4] as const).map((s)=> <button key={s} onClick={()=>setPlaybackSpeed(s)} style={{ padding:"2px 8px", background: playbackSpeed===s?"var(--ink)":"var(--paper)", color: playbackSpeed===s?"var(--paper)":"var(--muted)", fontFamily:"var(--font-mono)", fontSize:10, fontWeight:600 }}>{s}×</button>)}
                </div>
                <div style={{ flex:1, minWidth:160, display:"flex", alignItems:"center", gap:8 }}>
                  <span style={{ fontFamily:"var(--font-mono)", fontSize:10, color:"var(--muted)" }}>{currentHour}H</span>
                  <input type="range" min={0} max={6} value={currentHour} onChange={(e)=>{setCurrentHour(+e.target.value); setIsPlaying(false);}} style={{ flex:1, accentColor:"var(--ink)" }} />
                  <span style={{ fontFamily:"var(--font-mono)", fontSize:10, color:"var(--muted)" }}>6H</span>
                </div>
                <div style={{ display:"flex", gap:2 }}>
                  {[0,1,2,3,4,5,6].map((h)=> <button key={h} onClick={()=>setCurrentHour(h)} style={{ width:28, height:28, border:"1px solid", borderColor: currentHour===h?"var(--ink)":"var(--rule)", background: currentHour===h?"var(--ink)":"var(--paper)", color: currentHour===h?"var(--paper)":"var(--muted)", fontFamily:"var(--font-mono)", fontSize:10, fontWeight:600 }}>{h}</button>)}
                </div>
                <button onClick={()=>{setCurrentHour(3); pushToast("PEAK 3H");}} style={{ height:28, padding:"0 10px", border:"1px solid var(--vermillion)", color:"var(--vermillion)", background:"var(--surface)", fontFamily:"var(--font-mono)", fontSize:10, fontWeight:700 }}>PEAK 3H</button>
              </div>

              <div className="kpi-grid" style={{ marginTop:12 }}>
                {[
                  { k:"P / CN", v:`${rainfall}mm / ${cn}`, sub:`S ${S.toFixed(1)} · Ia ${Ia.toFixed(1)}` },
                  { k:"RUNOFF Q", v:`${Q.toFixed(1)} mm`, sub:"SCS-CN", accent:"var(--hydro)" },
                  { k:"MEAN DEPTH", v:`${economicLoss.depthVal} m`, sub:`${economicLoss.affectedBuildings} bldgs`, accent: +economicLoss.depthVal>0.8?"var(--vermillion)":"var(--ink)" },
                  { k:"LOSS / POP", v:`₹${economicLoss.directLossCrores}Cr`, sub: economicLoss.displacedPop, accent:"var(--vermillion)" },
                ].map((s)=> (
                  <div key={s.k} style={{ border:"1px solid var(--rule)", background:"var(--surface)", padding:"10px 12px", borderLeft:`2px solid ${s.accent||"var(--rule-strong)"}` }}>
                    <div style={{ fontFamily:"var(--font-mono)", fontSize:9, letterSpacing:"0.1em", color:"var(--muted)" }}>{s.k}</div>
                    <div style={{ fontFamily:"var(--font-mono)", fontSize:14, fontWeight:700, marginTop:4, color: s.accent||"var(--ink)" }}>{s.v}</div>
                    <div style={{ fontFamily:"var(--font-mono)", fontSize:10, color:"var(--muted)", marginTop:2 }}>{s.sub}</div>
                  </div>
                ))}
              </div>

              <div style={{ marginTop:8, fontFamily:"var(--font-mono)", fontSize:9, color:"var(--muted)", borderTop:"1px solid var(--rule)", paddingTop:8, display:"flex", justifyContent:"space-between" }}>
                <span>REV 06D9C60 · 2026-09-04 · EPSG:4326</span><span>CHENNAI LEDGER · NSE 0.892 · SRTM 30m</span>
              </div>
            </div>
          )}

          {activeWorkspace === "hydrology" && <div style={{ display:"grid", gap:12 }}><HydrologyWorkspace S={S} Ia={Ia} Q={Q} rainfall={rainfall} cn={cn} /><AnalyticsSuite rainfall={rainfall} cn={cn} duration={duration} currentHour={currentHour} onHourChange={setCurrentHour} selectedWard={selectedWard} onSelectWard={(id)=>{ setSelectedWard(id); const w={ tondiarpet:[80.286,13.122], anna_nagar:[80.209,13.085], adyar:[80.257,13.006], velachery:[80.22,12.975], saidapet:[80.224,13.02], ennore:[80.32,13.214], perungudi:[80.24,12.961], thurai:[80.248,12.942] } as any; const c=w[id]; if(c){ const d=1.2/111; setSelectedArea({ id:`ward-${id}`, name: id.toUpperCase(), basin: id, bounds:{ xmin:c[0]-d, xmax:c[0]+d, ymin:c[1]-d, ymax:c[1]+d }, center:c }); setActiveWorkspace("digital_twin"); pushToast(id.toUpperCase()+" → 3D FLY"); } }} /><InsightStrip rainfall={rainfall} cn={cn} duration={duration} currentHour={currentHour} selectedArea={selectedArea} /><WebFloodEngine rainfall={rainfall} cn={cn} aoi={selectedArea} viewMode={viewMode} /></div>}
          {activeWorkspace === "impact" && (
            <div>
              <div style={{ display:"flex", alignItems:"baseline", gap:12, borderBottom:"1px solid var(--ink)", paddingBottom:8, marginBottom:12 }}>
                <span style={{ fontFamily:"var(--font-mono)", fontSize:11, letterSpacing:"0.12em", fontWeight:600 }}>04 // IMPACT</span>
                <span style={{ fontFamily:"var(--font-display)", fontSize:18 }}>Stage-Damage Ledger</span>
                <span style={{ marginLeft:"auto", fontFamily:"var(--font-mono)", fontSize:10, color:"var(--muted)" }}>FloodML · Lc 75+</span>
              </div>
              <div className="impact-grid">
                <div style={{ border:"1px solid var(--ink)", background:"var(--surface)", padding:12, borderLeft:"2px solid var(--vermillion)" }}><div style={{ fontFamily:"var(--font-mono)", fontSize:9, letterSpacing:"0.1em", color:"var(--muted)" }}>LOSS</div><div style={{ fontFamily:"var(--font-mono)", fontSize:18, fontWeight:700, color:"var(--vermillion)" }}>₹{economicLoss.directLossCrores}Cr</div><div style={{ fontFamily:"var(--font-mono)", fontSize:10, color:"var(--muted)" }}>direct · stage-damage</div></div>
                <div style={{ border:"1px solid var(--rule)", background:"var(--surface)", padding:12 }}><div style={{ fontFamily:"var(--font-mono)", fontSize:9, letterSpacing:"0.1em", color:"var(--muted)" }}>DISPLACED</div><div style={{ fontFamily:"var(--font-mono)", fontSize:18, fontWeight:700 }}>{economicLoss.displacedPop}</div><div style={{ fontFamily:"var(--font-mono)", fontSize:10, color:"var(--muted)" }}>residents</div></div>
                <div style={{ border:"1px solid var(--rule)", background:"var(--surface)", padding:12 }}><div style={{ fontFamily:"var(--font-mono)", fontSize:9, letterSpacing:"0.1em", color:"var(--muted)" }}>BLDGS &gt;0.15m</div><div style={{ fontFamily:"var(--font-mono)", fontSize:18, fontWeight:700 }}>{economicLoss.affectedBuildings}</div><div style={{ fontFamily:"var(--font-mono)", fontSize:10, color:"var(--muted)" }}>footprints</div></div>
                <div style={{ border:"1px solid var(--rule)", background:"var(--surface)", padding:12 }}><div style={{ fontFamily:"var(--font-mono)", fontSize:9, letterSpacing:"0.1em", color:"var(--muted)" }}>ROAD CLOSURE</div><div style={{ fontFamily:"var(--font-mono)", fontSize:18, fontWeight:700 }}>16.4 km</div><div style={{ fontFamily:"var(--font-mono)", fontSize:10, color:"var(--muted)" }}>impassable</div></div>
              </div>
              <div style={{ marginTop:12 }}><FloodMLAnalytics rainfall={rainfall} cn={cn} /></div>
              <div style={{ marginTop:12, border:"1px solid var(--ink)", background:"var(--surface)" }}>
                <div style={{ padding:"8px 12px", borderBottom:"1px solid var(--rule)", background:"var(--paper)", fontFamily:"var(--font-mono)", fontSize:10, fontWeight:600, letterSpacing:"0.08em" }}>04.1 // ASSET INVENTORY — RIGHT-ALIGNED MONO</div>
                <table style={{ width:"100%", borderCollapse:"collapse", fontFamily:"var(--font-mono)", fontSize:11 }}>
                  <thead><tr style={{ background:"var(--paper)", color:"var(--muted)", fontSize:10 }}><th style={{ textAlign:"left", padding:"6px 12px" }}>ASSET</th><th style={{ textAlign:"right", padding:"6px 12px" }}>INUND</th><th style={{ textAlign:"right", padding:"6px 12px" }}></th></tr></thead>
                  <tbody>
                    {CHENNAI_SEARCH_INDEX.map((a)=> (
                      <tr key={a.name} style={{ borderTop:"1px solid var(--rule)" }}>
                        <td style={{ padding:"8px 12px" }}><div style={{ fontWeight:600, fontFamily:"var(--font-body)", fontSize:12 }}>{a.name}</div><div style={{ color:"var(--muted)", fontSize:10 }}>{a.type} · {a.basin}</div></td>
                        <td style={{ padding:"8px 12px", textAlign:"right", color:"var(--vermillion)", fontWeight:600 }}>0.52m</td>
                        <td style={{ padding:"8px 12px", textAlign:"right" }}><button onClick={()=>{ const d=aoiKm/111; setSelectedArea({ id:`asset-${a.name.slice(0,6)}`, name:a.name, basin:a.basin, bounds:{xmin:a.coords[0]-d,xmax:a.coords[0]+d,ymin:a.coords[1]-d,ymax:a.coords[1]+d}, center: a.coords as any}); setActiveWorkspace("digital_twin"); pushToast(a.name);}} style={{ padding:"4px 8px", border:"1px solid var(--ink)", background:"var(--paper)", fontFamily:"var(--font-mono)", fontSize:10, fontWeight:600 }}>FOCUS →</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {activeWorkspace === "validation" && <ValidationWorkspace />}
          {activeWorkspace === "registry" && <RegistryWorkspace />}

          {activeWorkspace === "scenarios" && (
            <div>
              <div style={{ display:"flex", alignItems:"baseline", gap:12, borderBottom:"1px solid var(--ink)", paddingBottom:8, marginBottom:12 }}>
                <span style={{ fontFamily:"var(--font-mono)", fontSize:11, letterSpacing:"0.12em", fontWeight:600 }}>03 // SCENARIOS</span>
                <span style={{ fontFamily:"var(--font-display)", fontSize:18 }}>Laboratory Matrix</span>
                <button onClick={()=>{ const sc:Scenario={ id:`sc-${Date.now()}`, name:`Scenario ${scenarios.length+1}`, P:rainfall, CN:cn, duration, depth:`${(Math.min(Q/120,1)*2.2*(0.3+0.7*duration/100)).toFixed(2)}m`, area:"14.2%", buildings: Math.round(80+(Q/120)*700), runoff:+Q.toFixed(1), category:"Custom"}; setScenarios([...scenarios, sc]); pushToast(sc.name);}} style={{ marginLeft:"auto", height:28, padding:"0 12px", background:"var(--ink)", color:"var(--paper)", border:"1px solid var(--ink)", fontFamily:"var(--font-mono)", fontSize:10, fontWeight:700 }}>+ SAVE CURRENT</button>
              </div>
              <div className="scenario-grid">
                <div style={{ display:"grid", gap:6, alignContent:"start" }}>
                  {scenarios.map((sc)=> (
                    <button key={sc.id} onClick={()=>{setActiveScenarioId(sc.id); setRainfall(sc.P); setCn(sc.CN); setDuration(sc.duration); pushToast(sc.name);}} style={{ textAlign:"left", padding:"10px 12px", border:"1px solid", borderColor: activeScenarioId===sc.id?"var(--ink)":"var(--rule)", background: activeScenarioId===sc.id?"var(--surface)":"var(--paper)", borderLeftWidth:2, borderLeftColor: activeScenarioId===sc.id?"var(--vermillion)":"transparent" }}>
                      <div style={{ display:"flex", justifyContent:"space-between", gap:8 }}><span style={{ fontFamily:"var(--font-body)", fontSize:13, fontWeight:600 }}>{sc.name}</span><span style={{ fontFamily:"var(--font-mono)", fontSize:9, border:"1px solid var(--rule)", padding:"2px 4px", background:"var(--paper)" }}>{sc.category}</span></div>
                      <div style={{ fontFamily:"var(--font-mono)", fontSize:10, color:"var(--muted)", marginTop:4 }}>P {sc.P} · CN {sc.CN} · Q {sc.runoff}mm</div>
                      <div style={{ display:"flex", justifyContent:"space-between", marginTop:6, paddingTop:6, borderTop:"1px solid var(--rule)", fontFamily:"var(--font-mono)", fontSize:10 }}><span style={{ fontWeight:700, color:"var(--vermillion)" }}>{sc.depth}</span><span style={{ color:"var(--muted)" }}>{sc.buildings} bldgs</span></div>
                    </button>
                  ))}
                </div>
                <div style={{ border:"1px solid var(--ink)", background:"var(--surface)", overflow:"auto" }}>
                  <div style={{ padding:"8px 12px", borderBottom:"1px solid var(--rule)", background:"var(--paper)", fontFamily:"var(--font-mono)", fontSize:10, fontWeight:600, letterSpacing:"0.08em" }}>03.1 // DELTA MATRIX</div>
                  <table style={{ width:"100%", borderCollapse:"collapse", fontFamily:"var(--font-mono)", fontSize:11 }}>
                    <thead><tr style={{ background:"var(--paper)", borderBottom:"1px solid var(--rule-strong)", color:"var(--muted)", fontSize:10 }}><th style={{ textAlign:"left", padding:"8px 10px" }}>SCENARIO</th><th>P</th><th>CN</th><th>Q</th><th>DEPTH</th><th></th></tr></thead>
                    <tbody>
                      {scenarios.map((sc)=> (
                        <tr key={sc.id} style={{ borderBottom:"1px solid var(--rule)" }}>
                          <td style={{ padding:"8px 10px", fontWeight:600 }}>{sc.name}</td><td style={{ textAlign:"right", padding:"8px 6px" }}>{sc.P}</td><td style={{ textAlign:"right", padding:"8px 6px" }}>{sc.CN}</td><td style={{ textAlign:"right", padding:"8px 6px", color:"var(--hydro)", fontWeight:700 }}>{sc.runoff}</td><td style={{ textAlign:"right", padding:"8px 6px", color:"var(--vermillion)" }}>{sc.depth}</td>
                          <td style={{ padding:"6px 10px" }}><button onClick={()=>{setActiveScenarioId(sc.id); setRainfall(sc.P); setCn(sc.CN); setDuration(sc.duration); setActiveWorkspace("digital_twin"); pushToast(sc.name);}} style={{ padding:"4px 8px", border:"1px solid var(--ink)", background:"var(--ink)", color:"var(--paper)", fontFamily:"var(--font-mono)", fontSize:10, fontWeight:600 }}>SIM 3D</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeWorkspace === "evacuation" && (
            <div style={{ display:"grid", gap:12 }}>
              <CrisisCommandCenter selectedArea={selectedArea} rainfall={rainfall} />
              <div>
                <div style={{ display:"flex", alignItems:"baseline", gap:12, borderBottom:"1px solid var(--ink)", paddingBottom:8, marginBottom:12 }}>
                  <span style={{ fontFamily:"var(--font-mono)", fontSize:11, letterSpacing:"0.12em", fontWeight:600 }}>05 // EVACUATION</span>
                  <span style={{ fontFamily:"var(--font-display)", fontSize:18 }}>Safe Corridor Routing</span>
                  <span style={{ marginLeft:"auto", fontFamily:"var(--font-mono)", fontSize:10, color:"var(--muted)" }}>&gt;0.3m detour · 18 km/h</span>
                </div>
                <EvacuationRouting currentLocation={{ lat: selectedArea.center[1], lng: selectedArea.center[0], name: selectedArea.name }} floodDepth={+economicLoss.depthVal} onFocusShelter={(sh:any)=>pushToast(sh.name)} />
              </div>
            </div>
          )}

          {activeWorkspace === "reports" && (
            <div>
              <div style={{ display:"flex", alignItems:"baseline", gap:12, borderBottom:"1px solid var(--ink)", paddingBottom:8, marginBottom:12 }}>
                <span style={{ fontFamily:"var(--font-mono)", fontSize:11, letterSpacing:"0.12em", fontWeight:600 }}>08 // EXPORT</span>
                <span style={{ fontFamily:"var(--font-display)", fontSize:18 }}>Ledger & Spatial Package</span>
              </div>
              <div className="hydro-grid">
                <div style={{ border:"1px solid var(--ink)", background:"var(--surface)", padding:16 }}>
                  <div style={{ fontFamily:"var(--font-mono)", fontSize:10, letterSpacing:"0.1em", fontWeight:600 }}>08.1 // EXECUTIVE BRIEF</div>
                  <div style={{ fontFamily:"var(--font-body)", fontSize:13, marginTop:6, color:"var(--muted2)" }}>Printable ledger with hydrology, AOI, loss, and matrix. Ink on paper, 1px rules.</div>
                  <button onClick={handleExportReport} style={{ marginTop:12, height:32, padding:"0 14px", background:"var(--ink)", color:"var(--paper)", border:"1px solid var(--ink)", fontFamily:"var(--font-mono)", fontSize:11, fontWeight:600 }}>OPEN LEDGER →</button>
                </div>
                <div style={{ border:"1px solid var(--ink)", background:"var(--surface)", padding:16 }}>
                  <div style={{ fontFamily:"var(--font-mono)", fontSize:10, letterSpacing:"0.1em", fontWeight:600 }}>08.2 // GEOJSON PACKAGE</div>
                  <div style={{ fontFamily:"var(--font-body)", fontSize:13, marginTop:6, color:"var(--muted2)" }}>EPSG:4326 feature collection with runoff, depth, loss. QGIS/ArcGIS ready.</div>
                  <button onClick={handleExportGeoJSON} style={{ marginTop:12, height:32, padding:"0 14px", background:"var(--paper)", color:"var(--ink)", border:"1px solid var(--ink)", fontFamily:"var(--font-mono)", fontSize:11, fontWeight:600 }}>DOWNLOAD GEOJSON</button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
      </div>

      <footer style={{ borderTop:"1px solid var(--rule-strong)", background:"var(--paper)", padding:"8px 16px", display:"flex", justifyContent:"space-between", fontFamily:"var(--font-mono)", fontSize:9, color:"var(--muted)", letterSpacing:"0.06em" }}>
        <span>FLOIN · CHENNAI FLOOD LEDGER · REV 06D9C60 · 2026-09-04</span><span>OKLCH · IBM PLEX · ZERO RADIUS · RULES NOT SHADOWS</span>
      </footer>

      {showHelp && (
        <div style={{ position:"fixed", inset:0, background:"oklch(0.15 0.01 100 / 0.42)", zIndex:60, display:"grid", placeItems:"center", padding:16 }} onClick={()=>setShowHelp(false)}>
          <div onClick={(e)=>e.stopPropagation()} style={{ width:"min(560px, 96vw)", background:"var(--paper)", border:"1px solid var(--ink)", boxShadow:"var(--shadow)" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"12px 14px", borderBottom:"1px solid var(--ink)", background:"var(--surface)" }}>
              <span style={{ fontFamily:"var(--font-mono)", fontSize:11, fontWeight:700, letterSpacing:"0.08em" }}>SHORTCUTS — PRESS ? TO TOGGLE · ESC TO CLOSE</span>
              <button onClick={()=>setShowHelp(false)} style={{ border:"1px solid var(--ink)", background:"var(--paper)", padding:"4px 8px", fontFamily:"var(--font-mono)", fontSize:10, fontWeight:600 }}>✕</button>
            </div>
            <div className="help-grid" style={{ padding:14, fontFamily:"var(--font-mono)", fontSize:11 }}>
              <div><div style={{ fontWeight:700, borderBottom:"1px solid var(--rule)", paddingBottom:4 }}>3D VIEW</div><div style={{ marginTop:6, display:"grid", gap:4, color:"var(--muted2)" }}><div><span className="kbd">DRAG</span> orbit · <span className="kbd">WHEEL</span> zoom · <span className="kbd">SHIFT+DRAG</span> pan</div><div><span className="kbd">DBL-CLICK</span> focus terrain · <span className="kbd">M</span> measure · <span className="kbd">R</span> reset · <span className="kbd">F</span> AOI</div><div><span className="kbd">⛶ FULL</span> fullscreen · <span className="kbd">◰ PNG</span> screenshot</div></div></div>
              <div><div style={{ fontWeight:700, borderBottom:"1px solid var(--rule)", paddingBottom:4 }}>TIME & DATA</div><div style={{ marginTop:6, display:"grid", gap:4, color:"var(--muted2)" }}><div><span className="kbd">SPACE</span> +1H · <span className="kbd">←</span><span className="kbd">→</span> scrub · 6H hydrograph linked to water</div><div><span className="kbd">CLICK</span> building/terrain → inspector · water ripple</div><div>Ward bars ↔ 3D fly · Hydrograph ↔ velocity</div></div></div>
            </div>
            <div style={{ padding:"8px 14px", borderTop:"1px solid var(--rule)", fontFamily:"var(--font-mono)", fontSize:9, color:"var(--muted)", display:"flex", justifyContent:"space-between" }}><span>REV 06D9C60 · EPSG:4326 · NSE 0.892</span><span>press ? again to close</span></div>
          </div>
        </div>
      )}
      {showOnboard && (
        <div style={{ position:"fixed", inset:0, background:"oklch(0.15 0.01 100 / 0.38)", zIndex:61, display:"grid", placeItems:"center", padding:16 }} onClick={()=>setShowOnboard(false)}>
          <div onClick={(e)=>e.stopPropagation()} style={{ width:"min(520px,96vw)", background:"var(--paper)", border:"1px solid var(--ink)", boxShadow:"var(--shadow)" }}>
            <div style={{ padding:"14px 16px", borderBottom:"1px solid var(--ink)", background:"var(--surface)" }}>
              <div style={{ fontFamily:"var(--font-display)", fontSize:18 }}>FLOIN — Field Instrument</div>
              <div style={{ fontFamily:"var(--font-mono)", fontSize:10, color:"var(--muted)", marginTop:4 }}>01 click map to retarget AOI · 02 scrub hydrograph · 03 inspect building</div>
            </div>
            <div style={{ padding:14, display:"grid", gap:10, fontFamily:"var(--font-mono)", fontSize:11, lineHeight:1.5 }}>
              <div style={{ border:"1px solid var(--rule)", background:"var(--paper)", padding:10 }}><span style={{ fontWeight:700 }}>01 // DIGITAL TWIN</span> — 3D terrain + shader water + BatchedMesh buildings. Hover emissive, click ripple + inspector. Depth legend bottom-left, cross-section on measure.</div>
              <div style={{ border:"1px solid var(--rule)", background:"var(--paper)", padding:10 }}><span style={{ fontWeight:700 }}>02 // HYDROLOGY</span> — SCS-CN + ward damage bars + hydrograph. Tap a ward bar to fly 3D there. Scrub 0–6H updates water + velocity together.</div>
              <div style={{ border:"1px solid var(--rule)", background:"var(--paper)", padding:10 }}><span style={{ fontWeight:700 }}>05 // EVACUATION</span> — detour-sorted shelters, dry-access flag, 0.3m road closure logic.</div>
            </div>
            <div style={{ padding:"10px 14px", display:"flex", justifyContent:"flex-end", gap:8, borderTop:"1px solid var(--rule)" }}>
              <button onClick={()=>setShowOnboard(false)} style={{ padding:"8px 14px", border:"1px solid var(--ink)", background:"var(--ink)", color:"var(--paper)", fontFamily:"var(--font-mono)", fontSize:11, fontWeight:600 }}>ENTER LEDGER →</button>
            </div>
          </div>
        </div>
      )}
      <div style={{ position:"fixed", bottom:12, right:12, display:"grid", gap:6, zIndex:50, pointerEvents:"none" }}>
        {toasts.map((t)=> <div key={t.id} style={{ pointerEvents:"auto", background:"var(--ink)", color:"var(--paper)", border:"1px solid var(--ink)", padding:"8px 12px", fontFamily:"var(--font-mono)", fontSize:11, fontWeight:600 }}>{t.msg}</div>)}
      </div>
    </div>
  );
}
