"use client";
import { useEffect, useState } from "react";
export default function UnifiedPredictionPanel({ aoi, rainfall, cn, duration }: { aoi: any; rainfall: number; cn: number; duration: number }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    let abort = new AbortController();
    setLoading(true);
    fetch("/api/predict", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ aoi, rainfall, cn, duration }), signal: abort.signal })
      .then((r) => r.json())
      .then((j) => { if (j.status === "success") setData(j); setLoading(false); })
      .catch(() => setLoading(false));
    return () => abort.abort();
  }, [aoi?.id, aoi?.bounds?.xmin, aoi?.bounds?.xmax, aoi?.bounds?.ymin, aoi?.bounds?.ymax, rainfall, cn, duration]);
  if (loading && !data) return <div style={{ border: "1px solid var(--ink)", background: "var(--surface)", padding: 12, fontFamily: "var(--font-mono)", fontSize: 11 }}>UNIFIED PREDICTION — COMPUTING 300 DATASETS…</div>;
  if (!data) return null;
  const top = (data.contributions || []).slice(0, 12);
  return (
    <div style={{ border: "1px solid var(--ink)", background: "var(--surface)", overflow: "hidden" }}>
      <div style={{ height: 28, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 10px", borderBottom: "1px solid var(--rule)", background: "var(--paper)", fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em" }}>
        <span>UNIFIED PREDICTION — EVERY FILE CONTRIBUTES (310)</span>
        <span style={{ color: "var(--hydro)" }}>RISK {data.composite?.riskScore} · {data.composite?.depthM}m · {data.composite?.floodedPct}%</span>
      </div>
      <div style={{ padding: 10, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8, fontFamily: "var(--font-mono)", fontSize: 10 }}>
        <div><div style={{ color: "var(--muted)", fontSize: 9 }}>DEM</div><div style={{ fontWeight: 700 }}>{data.dem?.meanElev}m mean · {data.dem?.source?.slice(0, 28)}</div></div>
        <div><div style={{ color: "var(--muted)", fontSize: 9 }}>SCS</div><div style={{ fontWeight: 700 }}>Q {data.scs?.Q?.toFixed(1)}mm S {data.scs?.S?.toFixed(1)}</div></div>
        <div><div style={{ color: "var(--muted)", fontSize: 9 }}>COMPOSITE</div><div style={{ fontWeight: 700, color: data.composite?.riskScore > 0.6 ? "var(--vermillion)" : "var(--ink)" }}>{data.composite?.depthM}m · {data.composite?.velocityMs}m/s · ₹{data.composite?.lossCr}Cr</div></div>
      </div>
      <div style={{ borderTop: "1px solid var(--rule)", padding: "8px 10px" }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 700, letterSpacing: "0.06em" }}>TOP CONTRIBUTIONS (per-dataset weight × value)</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
          {top.map((c: any) => (
            <span key={c.id} title={`${c.note} — value ${c.value} × weight ${c.weight} = ${c.contribution}`} style={{ border: "1px solid var(--rule-strong)", background: c.contribution > 0.05 ? "var(--vermillion)" : c.contribution < -0.03 ? "var(--hydro)" : "var(--paper)", color: Math.abs(c.contribution) > 0.04 ? "white" : "var(--ink)", padding: "3px 7px", fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 600 }}>
              {c.id.slice(0, 20)} {c.contribution > 0 ? "+" : ""}{c.contribution.toFixed(3)}
            </span>
          ))}
        </div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--muted)", marginTop: 6 }}>{data.contributions?.length} datasets weighted — hazard + exposure + live + soil/LULC → riskAdj {(data.provenance?.[3]||"").slice(-22)}</div>
      </div>
      <div style={{ borderTop: "1px solid var(--rule)", maxHeight: 180, overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-mono)", fontSize: 10 }}>
          <thead><tr style={{ background: "var(--paper)", color: "var(--muted)", fontSize: 9 }}><th style={{ textAlign: "left", padding: "4px 8px", borderBottom: "1px solid var(--rule-strong)" }}>DATASET</th><th style={{ textAlign: "right", padding: "4px 8px", borderBottom: "1px solid var(--rule-strong)" }}>VALUE</th><th style={{ textAlign: "right", padding: "4px 8px", borderBottom: "1px solid var(--rule-strong)" }}>W</th><th style={{ textAlign: "right", padding: "4px 8px", borderBottom: "1px solid var(--rule-strong)" }}>CONTRIB</th></tr></thead>
          <tbody>
            {(data.contributions||[]).slice(0,30).map((c:any)=>(
              <tr key={c.id} style={{ borderBottom:"1px solid var(--rule)" }}><td style={{ padding:"4px 8px", maxWidth:180, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{c.id}</td><td style={{ textAlign:"right", padding:"4px 8px" }}>{c.value}</td><td style={{ textAlign:"right", padding:"4px 8px", color:"var(--muted)" }}>{c.weight}</td><td style={{ textAlign:"right", padding:"4px 8px", fontWeight:700, color: c.contribution>0.04?"var(--vermillion)": c.contribution<-0.02?"var(--hydro)":"var(--ink)" }}>{c.contribution>0?"+":""}{c.contribution.toFixed(3)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ fontFamily:"var(--font-mono)", fontSize:8, color:"var(--muted)", padding:"6px 10px", borderTop:"1px solid var(--rule)", display:"flex", justifyContent:"space-between" }}>
        <span>{(data.provenance||[]).join(" · ").slice(0,90)}</span><span>POST /api/predict — every file contributes</span>
      </div>
    </div>
  );
}
