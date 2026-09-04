"use client";
import { DATASET_REGISTRY } from "@/app/lib/chennai-data";
export default function RegistryWorkspace() {
  return (
    <div>
      <div style={{ display:"flex", alignItems:"baseline", gap:12, borderBottom:"1px solid var(--ink)", paddingBottom:8, marginBottom:12 }}>
        <span style={{ fontFamily:"var(--font-mono)", fontSize:11, letterSpacing:"0.12em", fontWeight:600 }}>07 // REGISTRY</span>
        <span style={{ fontFamily:"var(--font-display)", fontSize:18 }}>Dataset Provenance Audit</span>
        <span style={{ marginLeft:"auto", fontFamily:"var(--font-mono)", fontSize:10, color:"var(--muted)" }}>EPSG:4326 · OKLCH</span>
      </div>
      <div style={{ border:"1px solid var(--ink)", background:"var(--surface)" }}>
        <div style={{ padding:"8px 12px", borderBottom:"1px solid var(--rule)", background:"var(--paper)", fontFamily:"var(--font-mono)", fontSize:10, fontWeight:600, letterSpacing:"0.08em" }}>07.1 // LEDGER TABLE — NO CARDS, ONLY RULES</div>
        <table style={{ width:"100%", borderCollapse:"collapse", fontFamily:"var(--font-mono)", fontSize:11 }}>
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
        </table>
      </div>
    </div>
  );
}
