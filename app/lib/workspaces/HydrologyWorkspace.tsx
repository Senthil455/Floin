"use client";
import { RESERVOIRS } from "@/app/lib/chennai-data";
export default function HydrologyWorkspace({ S, Ia, Q, rainfall, cn }: { S: number; Ia: number; Q: number; rainfall: number; cn: number }) {
  return (
    <div>
      <div style={{ display:"flex", alignItems:"baseline", gap:12, borderBottom:"1px solid var(--ink)", paddingBottom:8, marginBottom:12 }}>
        <span style={{ fontFamily:"var(--font-mono)", fontSize:11, letterSpacing:"0.12em", fontWeight:600 }}>02 // HYDROLOGY</span>
        <span style={{ fontFamily:"var(--font-display)", fontSize:18 }}>SCS-CN Basin Ledger</span>
        <span style={{ marginLeft:"auto", fontFamily:"var(--font-mono)", fontSize:10, color:"var(--muted)" }}>SCS-CN + D8 · 30m</span>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }} className="max-[900px]:!grid-cols-1">
        <div style={{ border:"1px solid var(--ink)", background:"var(--surface)" }}>
          <div style={{ padding:"8px 12px", borderBottom:"1px solid var(--rule)", background:"var(--paper)", fontFamily:"var(--font-mono)", fontSize:10, fontWeight:600, letterSpacing:"0.08em" }}>02.1 // SCS-CN FORMULATION</div>
          <div style={{ padding:12, display:"grid", gap:8, fontFamily:"var(--font-mono)", fontSize:11 }}>
            <div style={{ border:"1px solid var(--rule)", background:"var(--paper)", padding:10, display:"grid", gap:4 }}>
              <div><span style={{ color:"var(--muted)" }}>01 RETENTION</span> <span style={{ float:"right", fontWeight:700 }}>S = 25400/CN − 254 = {S.toFixed(2)}mm</span></div>
              <div><span style={{ color:"var(--muted)" }}>02 ABSTRACTION</span> <span style={{ float:"right", fontWeight:700 }}>Ia = 0.2S = {Ia.toFixed(2)}mm</span></div>
              <div style={{ borderTop:"1px solid var(--ink)", paddingTop:6, marginTop:2 }}><span style={{ color:"var(--muted)" }}>03 RUNOFF</span> <span style={{ float:"right", fontWeight:700, color:"var(--hydro)" }}>Q = (P−Ia)²/(P+0.8S) = {Q.toFixed(2)}mm</span></div>
            </div>
            <div style={{ fontFamily:"var(--font-body)", fontSize:12, color:"var(--muted2)", lineHeight:1.5 }}>USDA SCS Curve Number. Excess precipitation for P {rainfall}mm, CN {cn} (urban imperviousness). Printed mono, right-aligned, hairline rules.</div>
          </div>
        </div>
        <div style={{ border:"1px solid var(--ink)", background:"var(--surface)" }}>
          <div style={{ padding:"8px 12px", borderBottom:"1px solid var(--rule)", background:"var(--paper)", fontFamily:"var(--font-mono)", fontSize:10, fontWeight:600, letterSpacing:"0.08em" }}>02.2 // RESERVOIR REGISTER</div>
          <table style={{ width:"100%", borderCollapse:"collapse", fontFamily:"var(--font-mono)", fontSize:11 }}>
            <thead><tr style={{ background:"var(--paper)", color:"var(--muted)", fontSize:10 }}><th style={{ textAlign:"left", padding:"6px 12px", borderBottom:"1px solid var(--rule-strong)" }}>RESERVOIR</th><th style={{ textAlign:"right", padding:"6px 12px", borderBottom:"1px solid var(--rule-strong)" }}>STATUS</th></tr></thead>
            <tbody>
              {RESERVOIRS.map((r)=> (
                <tr key={r.name} style={{ borderBottom:"1px solid var(--rule)" }}>
                  <td style={{ padding:"8px 12px" }}><div style={{ fontWeight:600, fontFamily:"var(--font-body)", fontSize:12 }}>{r.name}</div><div style={{ color:"var(--muted)", fontSize:10 }}>{r.basin} · {r.cap}</div></td>
                  <td style={{ padding:"8px 12px", textAlign:"right" }}><div style={{ fontWeight:700, color:"var(--ink)" }}>{r.status}</div><div style={{ color:"var(--muted)", fontSize:10 }}>{r.outflow}</div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
