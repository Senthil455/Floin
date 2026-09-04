"use client";
import { DATASET_REGISTRY } from "@/app/lib/chennai-data";
const PROV = [
  { what:"Buildings 1,811", kind:"Real · OSM extract + GCC survey", use:"Extruded BatchedMesh · height = levels×0.19 · wardProb tint", license:"ODbL" },
  { what:"DEM + d8 derivatives", kind:"Real · Copernicus GLO-30 30m (5.8 MB) + QGIS D8", use:"Terrain 72–140 seg · bilinear cache · hill/marsh per BASIN_PROFILE", license:"Copernicus" },
  { what:"IMD stations 8", kind:"Real · India Met Dept", use:"Rainfall CN blending: blendedP = P×0.6 + live×0.4 · SCS-CN", license:"Public" },
  { what:"Live Open-Meteo 13.08,80.27", kind:"Real · 30s poll · fallback to prop", use:"Blended into runoff, hydrograph, ward bars", license:"CC-BY" },
  { what:"GCC 2015 hotspots 327", kind:"Real · observed inundation points", use:"Cylinder pins · emissive pulse · 2015 validation (NSE 0.892)", license:"GCC" },
  { what:"Wards 200 + soil NBSS + LULC Bhuvan", kind:"Real · polygons (3–5 coarse, honest small)", use:"Choropleth fill when heat mode · CN lookup · transparency", license:"Gov open" },
  { what:"SCS-CN derived Q/depth/damage", kind:"Derived · Q=(P−Ia)²/(P+0.8S) · prob=Q/80", use:"Depth, velocity, loss, ward bars, insights — labelled derived", license:"—" },
  { what:"Hydrograph tanh·exp", kind:"Simulated · 7-point 0–6H model", use:"Sparkline + water uniform · clearly labelled simulated", license:"—" },
];
export default function RegistryWorkspace() {
  return (
    <div>
      <div style={{ display:"flex", alignItems:"baseline", gap:12, borderBottom:"1px solid var(--ink)", paddingBottom:8, marginBottom:12 }}>
        <span style={{ fontFamily:"var(--font-mono)", fontSize:11, letterSpacing:"0.12em", fontWeight:600 }}>07 // REGISTRY</span>
        <span style={{ fontFamily:"var(--font-display)", fontSize:18 }}>Dataset Provenance Audit</span>
        <span style={{ marginLeft:"auto", fontFamily:"var(--font-mono)", fontSize:10, color:"var(--muted)" }}>EPSG:4326 · OKLCH</span>
      </div>
      <div style={{ border:"1px solid var(--ink)", background:"var(--surface)", overflow:"hidden" }}>
        <div style={{ padding:"8px 12px", borderBottom:"1px solid var(--rule)", background:"var(--paper)", fontFamily:"var(--font-mono)", fontSize:10, fontWeight:600, letterSpacing:"0.08em" }}>07.1 // LEDGER TABLE — NO CARDS, ONLY RULES</div>
        <div className="table-wrap"><table style={{ width:"100%", borderCollapse:"collapse", fontFamily:"var(--font-mono)", fontSize:11 }}>
          <thead><tr style={{ background:"var(--paper)", color:"var(--muted)", fontSize:10, textAlign:"left" }}><th style={{ padding:"8px 12px", borderBottom:"1px solid var(--rule-strong)" }}>DATASET</th><th style={{ padding:"8px 12px", borderBottom:"1px solid var(--rule-strong)" }}>TYPE · COUNT</th><th style={{ padding:"8px 12px", borderBottom:"1px solid var(--rule-strong)", textAlign:"right" }}>SOURCE</th></tr></thead>
          <tbody>
            {DATASET_REGISTRY.map((ds)=> (
              <tr key={ds.id} style={{ borderBottom:"1px solid var(--rule)" }}>
                <td style={{ padding:"8px 12px", fontWeight:600, fontFamily:"var(--font-body)", fontSize:12 }}>{ds.name}</td>
                <td style={{ padding:"8px 12px", color:"var(--muted)" }}>{ds.type} · {ds.count} · {ds.crs}</td>
                <td style={{ padding:"8px 12px", textAlign:"right" }}><span style={{ border:"1px solid var(--rule-strong)", padding:"2px 6px", background:"var(--paper)", fontSize:10, color:"var(--signal)", fontWeight:600 }}>{ds.confidence}</span><div style={{ color:"var(--muted)", fontSize:10, marginTop:2 }}>{ds.source}</div></td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </div>
      <div style={{ marginTop:12, border:"1px solid var(--ink)", background:"var(--surface)", overflow:"hidden" }}>
        <div style={{ padding:"8px 12px", borderBottom:"1px solid var(--rule)", background:"var(--paper)", fontFamily:"var(--font-mono)", fontSize:10, fontWeight:600, letterSpacing:"0.08em" }}>07.2 // PROVENANCE & HONESTY — REAL / DERIVED / SIMULATED</div>
        <div className="table-wrap"><table style={{ width:"100%", borderCollapse:"collapse", fontFamily:"var(--font-mono)", fontSize:10 }}>
          <thead><tr style={{ background:"var(--paper)", color:"var(--muted)", fontSize:9 }}><th style={{ textAlign:"left", padding:"6px 12px", borderBottom:"1px solid var(--rule-strong)" }}>DATASET</th><th style={{ textAlign:"left", padding:"6px 12px", borderBottom:"1px solid var(--rule-strong)" }}>KIND</th><th style={{ textAlign:"left", padding:"6px 12px", borderBottom:"1px solid var(--rule-strong)" }}>HOW USED</th><th style={{ textAlign:"right", padding:"6px 12px", borderBottom:"1px solid var(--rule-strong)" }}>LICENSE</th></tr></thead>
          <tbody>
            {PROV.map((r)=>(
              <tr key={r.what} style={{ borderBottom:"1px solid var(--rule)" }}>
                <td style={{ padding:"6px 12px", fontWeight:600 }}>{r.what}</td>
                <td style={{ padding:"6px 12px", color: r.kind.startsWith("Real")?"var(--signal)": r.kind.startsWith("Derived")?"var(--hydro)":"var(--muted)" }}>{r.kind}</td>
                <td style={{ padding:"6px 12px", color:"var(--muted2)" }}>{r.use}</td>
                <td style={{ padding:"6px 12px", textAlign:"right", color:"var(--muted)" }}>{r.license}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
        <div style={{ padding:"8px 12px", fontFamily:"var(--font-mono)", fontSize:9, color:"var(--muted)", borderTop:"1px solid var(--rule)", lineHeight:1.5 }}>Never present simulated hydrograph as observed. Every insight tag says <span style={{ color:"var(--hydro)", fontWeight:600 }}>derived</span> or <span style={{ color:"var(--muted)", fontWeight:600 }}>simulated</span>. Soil/LULC coarse (3–5 polys) is shown small and transparent — honest, not hidden.</div>
      </div>
    </div>
  );
}
