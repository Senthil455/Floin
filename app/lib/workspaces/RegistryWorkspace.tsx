"use client";
import { useEffect, useMemo, useState } from "react";

type Ds = { id:string; name:string; category:string; format:string; geometryType?:string; featureCount?:number; filePath?:string; crs?:string; status?:string; };
const EXTERN = [
  { id:"COP30_SRTM_TNM_N13E080_30m.tif", name:"Copernicus COP30 DSM 30 m — SRTM/TNM lineage (REAL)", category:"terrain", badge:"REAL COP30", col:"var(--hydro)" },
  { id:"MAPZEN_terrarium_z14_12230_7714.png", name:"Mapzen Terrarium RGB z14 — live PNJS decode (REAL)", category:"terrain", badge:"LIVE", col:"var(--hydro)" },
  { id:"ETOPO1_GMTED_bathymetry_chennai_coast.csv", name:"ETOPO1 1′ + GMTED2010 250 m bathymetry (REAL)", category:"terrain", badge:"REAL", col:"var(--hydro)" },
];

const CAT_META: Record<string,{label:string; col:string; icon:string}> = {
  terrain:{label:"Terrain", col:"var(--hydro)", icon:"⛰"},
  vector:{label:"Vector", col:"var(--ink)", icon:"◈"},
  rainfall:{label:"Rainfall", col:"var(--vermillion)", icon:"☂"},
  analysis:{label:"Analysis", col:"var(--brass)", icon:"◆"},
  reference:{label:"Reference", col:"var(--muted2)", icon:"◎"},
};

export default function RegistryWorkspace({ activeDatasets=[], onToggleDataset }: { activeDatasets?: string[]; onToggleDataset?: (id:string)=>void }){
  const [datasets,setDatasets]=useState<Ds[]>([]);
  const [meta,setMeta]=useState<any>(null);
  const [q,setQ]=useState("");
  const [cat,setCat]=useState("all");
  const [format,setFormat]=useState("all");
  const [page,setPage]=useState(0);
  const PAGE=24;

  useEffect(()=>{
    fetch("/api/datasets").then(r=>r.json()).then(j=>{
      setDatasets(j.datasets||[]);
      setMeta({ total:j.total, byCategory:j.byCategory, totalFeatures:j.totalFeatures, totalSizeKB:j.totalSizeKB, publicFiles:j.publicFiles });
    }).catch(()=>{});
  },[]);

  const filtered=useMemo(()=>{
    const l=q.toLowerCase();
    return datasets.filter(d=>{
      if(cat!=="all" && d.category!==cat) return false;
      if(format!=="all" && d.format!==format) return false;
      if(!l) return true;
      return d.name.toLowerCase().includes(l) || d.id.toLowerCase().includes(l) || (d.geometryType||"").toLowerCase().includes(l);
    });
  },[datasets,q,cat,format]);

  const paged=useMemo(()=> filtered.slice(0,(page+1)*PAGE),[filtered,page]);
  const cats=useMemo(()=>{ const m:Record<string,number>={}; datasets.forEach(d=>m[d.category]=(m[d.category]||0)+1); return m;},[datasets]);

  return (
    <div>
      <div style={{ display:"flex", alignItems:"baseline", gap:12, borderBottom:"1px solid var(--ink)", paddingBottom:8, marginBottom:12, flexWrap:"wrap" }}>
        <span style={{ fontFamily:"var(--font-mono)", fontSize:11, letterSpacing:"0.12em", fontWeight:600 }}>07 // DATA ATLAS</span>
        <span style={{ fontFamily:"var(--font-display)", fontSize:18 }}>Chennai Flood Corpus — {meta?.total||datasets.length} Datasets</span>
        <span style={{ marginLeft:"auto", fontFamily:"var(--font-mono)", fontSize:10, color:"var(--muted)", border:"1px solid var(--rule-strong)", padding:"2px 8px", background:"var(--paper)" }}>{meta?.publicFiles||0} public files · {meta?.totalFeatures?.toLocaleString()||""} features · {meta?.totalSizeKB?Math.round(meta.totalSizeKB/1024)+" MB":""}</span>
      </div>

      <div className="kpi-grid" style={{ marginBottom:12 }}>
        {[
          {k:"TOTAL", v: String(meta?.total||datasets.length), sub:"GeoJSON+CSV+TIFF", col:"var(--ink)"},
          {k:"FEATURES", v: (meta?.totalFeatures||0).toLocaleString(), sub:"points+lines+polys", col:"var(--hydro)"},
          {k:"SIZE", v: meta?.totalSizeKB?`${Math.round(meta.totalSizeKB/1024)} MB`:"—", sub:"public folder", col:"var(--brass)"},
          {k:"TERRAIN", v: String(cats.terrain||0), sub:"DEM·ETOPO·GMTED", col:"var(--hydro)"},
        ].map(s=>(
          <div key={s.k} style={{ border:"1px solid var(--rule)", background:"var(--surface)", padding:"10px 12px", borderLeft:`3px solid ${s.col}` }}>
            <div style={{ fontFamily:"var(--font-mono)", fontSize:9, letterSpacing:"0.1em", color:"var(--muted)" }}>{s.k}</div>
            <div style={{ fontFamily:"var(--font-mono)", fontSize:18, fontWeight:700 }}>{s.v}</div>
            <div style={{ fontFamily:"var(--font-mono)", fontSize:10, color:"var(--muted)" }}>{s.sub}</div>
          </div>
        ))}
      </div>
      <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:8, alignItems:"center" }}>
        {Object.entries(cats).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([c,n])=>(
          <span key={c} style={{ fontFamily:"var(--font-mono)", fontSize:9, padding:"3px 8px", border:"1px solid var(--rule)", background:"var(--paper)", color:"var(--muted)" }}>{CAT_META[c]?.icon||""} {c.toUpperCase()} {n}</span>
        ))}
        <span style={{ marginLeft:"auto", fontFamily:"var(--font-mono)", fontSize:9, color:"var(--muted)" }}>FloodMap.net parity SRTM/GMTED/ETOPO1+TNM+Mapzen + ISRO/NRSC + GCC 2015</span>
      </div>
      <div style={{ border:"1px solid var(--ink)", background:"var(--surface)", padding:8, marginBottom:10 }}>
        <div style={{ fontFamily:"var(--font-mono)", fontSize:9, fontWeight:700, letterSpacing:"0.08em", marginBottom:6, borderBottom:"1px solid var(--rule)", paddingBottom:4 }}>REAL-WORLD TERRAIN STACK — USED IN 3D (COP30 bilinear → Mapzen PNGJS live → ETOPO/GMTED)</div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))", gap:6 }}>
          {EXTERN.map(e=>(
            <div key={e.id} style={{ border:"1px solid var(--ink)", background:"var(--paper)", padding:"8px 10px", display:"flex", gap:8, alignItems:"center" }}>
              <span style={{ width:26, height:26, display:"grid", placeItems:"center", background:e.col, color:"var(--paper)", fontSize:12 }}>⛰</span>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontFamily:"var(--font-mono)", fontSize:10, fontWeight:700, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{e.name}</div>
                <div style={{ fontFamily:"var(--font-mono)", fontSize:9, color:"var(--muted)" }}>{e.id} · data/datasets/floodmap-net/</div>
              </div>
              <span style={{ fontFamily:"var(--font-mono)", fontSize:8, fontWeight:700, border:"1px solid var(--signal)", padding:"2px 6px", background:"#E8F5E9", color:"var(--signal)" }}>{e.badge}</span>
            </div>
          ))}
        </div>
        <div style={{ fontFamily:"var(--font-mono)", fontSize:9, color:"var(--muted)", marginTop:6, lineHeight:1.4 }}>3D terrain `generateTerrainForAOI` samples COP30 `DEM.tif` 30 m bilinear per-vertex; outside bbox or miss → live Mapzen Terrarium PNG decode (`pngjs`, `(R*256+G+B/256)-32768`), then ETOPO1/GMTED bathymetry for sea-depth. No synthetic sine-wave fallback when DEM present. All 300+ public GeoJSON below are auto-discovered via <code>/api/datasets</code> scan and toggleable on the 2D map.</div>
      </div>

      <div style={{ border:"1px solid var(--ink)", background:"var(--surface)", padding:8, display:"flex", gap:6, flexWrap:"wrap", alignItems:"center", marginBottom:10, position:"sticky", top:0, zIndex:5 }}>
        <input value={q} onChange={e=>{setQ(e.target.value); setPage(0);}} placeholder="SEARCH 300+ DATASETS — flood, ward, rain, soil, metro…" style={{ flex:"1 1 240px", height:32, border:"1px solid var(--ink)", background:"var(--paper)", padding:"0 10px", fontFamily:"var(--font-mono)", fontSize:11, outline:"none" }} />
        <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
          {["all","terrain","vector","rainfall","analysis","reference"].map(c=>(
            <button key={c} onClick={()=>{setCat(c); setPage(0);}} style={{ padding:"6px 10px", border:"1px solid", borderColor:cat===c?"var(--ink)":"var(--rule-strong)", background:cat===c?"var(--ink)":"var(--paper)", color:cat===c?"var(--paper)":"var(--muted)", fontFamily:"var(--font-mono)", fontSize:10, fontWeight:600 }}>{c.toUpperCase()}</button>
          ))}
        </div>
        <select value={format} onChange={e=>{setFormat(e.target.value); setPage(0);}} style={{ height:32, border:"1px solid var(--rule-strong)", background:"var(--paper)", fontFamily:"var(--font-mono)", fontSize:10, padding:"0 6px" }}>
          <option value="all">ALL FORMATS</option><option value="geojson">GeoJSON</option><option value="csv">CSV</option><option value="tiff">TIFF</option><option value="json">JSON</option>
        </select>
        <span style={{ fontFamily:"var(--font-mono)", fontSize:10, color:"var(--muted)", marginLeft:"auto" }}>{filtered.length} / {datasets.length} matched · page {page+1}</span>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))", gap:8 }}>
        {paged.map(d=>{
          const cm=CAT_META[d.category]||CAT_META.reference;
          return (
            <div key={d.id} style={{ border:"1px solid var(--ink)", background:"var(--paper)", display:"flex", flexDirection:"column", minHeight:112 }}>
              <div style={{ height:26, display:"flex", alignItems:"center", gap:6, padding:"0 8px", borderBottom:"1px solid var(--rule)", background:"var(--surface)", fontFamily:"var(--font-mono)", fontSize:9, fontWeight:700 }}>
                <span style={{ width:22, height:22, display:"grid", placeItems:"center", background:cm.col, color:"var(--paper)", fontSize:11 }}>{cm.icon}</span>
                <span style={{ color:cm.col }}>{d.category.toUpperCase()}</span>
                <span style={{ marginLeft:"auto", border:"1px solid var(--rule-strong)", padding:"1px 5px", background:"var(--paper)", color:"var(--muted)", fontSize:8 }}>{d.format.toUpperCase()} · {d.geometryType||"—"}</span>
              </div>
              <div style={{ padding:"8px 10px", flex:1 }}>
                <div style={{ fontFamily:"var(--font-body)", fontSize:12, fontWeight:600, lineHeight:1.25, display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical", overflow:"hidden" }}>{d.name}</div>
                <div style={{ fontFamily:"var(--font-mono)", fontSize:9, color:"var(--muted)", marginTop:3 }}>{d.id}</div>
                <div style={{ display:"flex", gap:6, marginTop:6, flexWrap:"wrap" }}>
                  <span style={{ fontFamily:"var(--font-mono)", fontSize:10, fontWeight:700, border:"1px solid var(--ink)", padding:"2px 6px", background:"var(--surface)" }}>{d.featureCount!=null?`${d.featureCount.toLocaleString()} feats`:"—"}</span>
                  <span style={{ fontFamily:"var(--font-mono)", fontSize:9, color:"var(--muted)", border:"1px solid var(--rule)", padding:"2px 6px", background:"var(--paper)" }}>{d.crs||"EPSG:4326"}</span>
                  <span style={{ fontFamily:"var(--font-mono)", fontSize:8, color:"var(--signal)", border:"1px solid var(--signal)", padding:"2px 5px", background:"#E8F5E9" }}>{d.status||"discovered"}</span>
                </div>
              </div>
              <div style={{ display:"flex", gap:4, padding:"6px 8px", borderTop:"1px solid var(--rule)", background:"var(--surface)" }}>
                {onToggleDataset ? (
                  <button onClick={()=>onToggleDataset(d.id)} style={{ flex:1, padding:"4px 0", border:"1px solid", borderColor: activeDatasets.includes(d.id)?"var(--ink)":"var(--rule-strong)", background: activeDatasets.includes(d.id)?"var(--ink)":"var(--paper)", color: activeDatasets.includes(d.id)?"var(--paper)":"var(--ink)", fontFamily:"var(--font-mono)", fontSize:9, fontWeight:700 }}>{activeDatasets.includes(d.id)?"ON MAP ✓":"ADD TO MAP"}</button>
                ) : (
                  <a href={`/${d.id}.${d.format||'geojson'}`} target="_blank" rel="noreferrer" style={{ flex:1, textAlign:"center", padding:"4px 0", border:"1px solid var(--ink)", background:"var(--paper)", fontFamily:"var(--font-mono)", fontSize:9, fontWeight:700, textDecoration:"none", color:"var(--ink)" }}>VIEW</a>
                )}
                <a href={`/${d.id}.${d.format||'geojson'}`} download style={{ flex:1, textAlign:"center", padding:"4px 0", background:"var(--ink)", color:"var(--paper)", border:"1px solid var(--ink)", fontFamily:"var(--font-mono)", fontSize:9, fontWeight:700, textDecoration:"none" }}>DL</a>
              </div>
            </div>
          );
        })}
      </div>

      {paged.length < filtered.length && (
        <div style={{ display:"grid", placeItems:"center", marginTop:12 }}>
          <button onClick={()=>setPage(p=>p+1)} style={{ padding:"8px 16px", border:"1px solid var(--ink)", background:"var(--ink)", color:"var(--paper)", fontFamily:"var(--font-mono)", fontSize:11, fontWeight:700 }}>LOAD MORE — {filtered.length - paged.length} remaining</button>
        </div>
      )}
      {filtered.length===0 && <div className="empty-state" style={{ marginTop:12 }}>No datasets match "{q}" in {cat}</div>}

      <div style={{ marginTop:12, border:"1px solid var(--ink)", background:"var(--surface)", overflow:"hidden" }}>
        <div style={{ padding:"8px 12px", borderBottom:"1px solid var(--rule)", background:"var(--paper)", fontFamily:"var(--font-mono)", fontSize:10, fontWeight:600, letterSpacing:"0.08em" }}>ATTRIBUTION — FLOODMAP.NET PARITY + CHENNAI CORPUS</div>
        <div style={{ padding:"10px 12px", fontFamily:"var(--font-mono)", fontSize:9, color:"var(--muted)", lineHeight:1.5 }}>All 300+ public GeoJSON in <code>public/</code> are discoverable via <code>/api/datasets</code> (auto-scan + hardcoded registry). Sources: Mapzen/TNM/SRTM/GMTED/ETOPO1 (FloodMap.net footer) → COP30 DSM 30 m (primary), Mapzen Terrarium RGB, GMTED 250 m, ETOPO1 bathymetry stored in <code>data/datasets/floodmap-net/</code> with bathy CSV. Chennai corpus: GCC 2015, IMD, OSM, NRSC, ISRO, WRD, TNSDMA, CMDA, TANGEDCO etc. Click VIEW to preview on Leaflet, DL for QGIS.</div>
      </div>
    </div>
  );
}
