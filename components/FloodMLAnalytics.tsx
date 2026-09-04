"use client";
import { useMemo } from "react";

const CHENNAI_WARDS = [
  { name: "Tondiarpet", pop: 420000, precip: 45, lat: 13.122, lng: 80.286 },
  { name: "Anna Nagar", pop: 560000, precip: 78, lat: 13.085, lng: 80.209 },
  { name: "Adyar", pop: 380000, precip: 112, lat: 13.006, lng: 80.257 },
  { name: "Velachery", pop: 310000, precip: 145, lat: 12.975, lng: 80.22 },
  { name: "Saidapet", pop: 290000, precip: 98, lat: 13.02, lng: 80.224 },
  { name: "Ennore", pop: 180000, precip: 67, lat: 13.214, lng: 80.32 },
  { name: "Perungudi", pop: 220000, precip: 134, lat: 12.961, lng: 80.24 },
  { name: "Thuraipakam", pop: 200000, precip: 89, lat: 12.942, lng: 80.248 },
];

function floodProb(precip: number, cn: number) {
  const S = 25400 / cn - 254; const Ia = 0.2 * S; const Q = precip <= Ia ? 0 : (precip - Ia) ** 2 / (precip + 0.8 * S);
  return Math.min(1, Q / 80);
}

export default function FloodMLAnalytics({ rainfall, cn }: { rainfall: number; cn: number }) {
  const rows = useMemo(() => CHENNAI_WARDS.map((w) => {
    const p = (w.precip + rainfall) / 2;
    const prob = floodProb(p, cn);
    const damage = prob * w.pop * 0.004 * (1 + p / 200);
    return { ...w, prob, damage, bubble: 8 + prob * 28, color: prob > 0.6 ? "var(--vermillion)" : prob > 0.3 ? "#E6B422" : "var(--hydro)" };
  }), [rainfall, cn]);

  return (
    <div style={{ border: "1px solid var(--ink)", background: "var(--surface)" }}>
      <div style={{ height: 28, display: "flex", alignItems: "center", padding: "0 10px", borderBottom: "1px solid var(--rule)", background: "var(--paper)", justifyContent: "space-between" }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em" }}>FLOODML · CHENNAI WARDS — BUBBLE & HEATMAP (Plotly移植)</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--muted)" }}>RandomForest 98.7% → RF Chennai · pop×prob</span>
      </div>
      <div className="hydro-grid" style={{ gap:0 }}>
        <div style={{ padding: 10, borderRight: "1px solid var(--rule)" }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600, letterSpacing: "0.06em" }}>BUBBLE — FLOOD PROBABILITY</div>
          <div style={{ height: 220, position: "relative", border: "1px solid var(--rule)", background: "var(--paper)", marginTop: 6, overflow: "hidden" }}>
            {rows.map((r) => (
              <div key={r.name} title={`${r.name} prob ${r.prob.toFixed(2)} damage $${r.damage.toFixed(1)}k`} style={{ position: "absolute", left: `${15 + ((r.lng - 80.2) / 0.18) * 70}%`, top: `${10 + ((13.25 - r.lat) / 0.35) * 70}%`, width: r.bubble * 2, height: r.bubble * 2, borderRadius: 999, background: r.color, opacity: 0.72, border: "1px solid var(--ink)", display: "grid", placeItems: "center", fontFamily: "var(--font-mono)", fontSize: 8, color: "white", fontWeight: 700 }}>{r.prob > 0.5 ? "!" : ""}</div>
            ))}
            <div style={{ position: "absolute", bottom: 4, left: 6, fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--muted)" }}>X lng · Y lat · r=prob · red=high</div>
          </div>
        </div>
        <div style={{ padding: 10 }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600, letterSpacing: "0.06em" }}>HEATMAP — DAMAGE (USD)</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 4, marginTop: 6 }}>
            {rows.map((r) => {
              const intensity = Math.min(1, r.damage / 800);
              const bg = `color-mix(in oklch, var(--paper) ${100 - intensity * 70}%, var(--vermillion))`;
              return (
                <div key={r.name} style={{ border: "1px solid var(--rule)", background: bg, padding: "8px 6px", textAlign: "center" }}>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 700 }}>{r.name}</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink)", fontWeight: 600 }}>${r.damage.toFixed(0)}k</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--muted)" }}>{r.prob.toFixed(2)} prob</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div style={{ borderTop: "1px solid var(--ink)", overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-mono)", fontSize: 11 }}>
          <thead><tr style={{ background: "var(--paper)", color: "var(--muted)", fontSize: 9 }}><th style={{ textAlign: "left", padding: "6px 10px", borderBottom: "1px solid var(--rule-strong)" }}>WARD</th><th style={{ textAlign: "right", padding: "6px 10px", borderBottom: "1px solid var(--rule-strong)" }}>PRECIP</th><th style={{ textAlign: "right", padding: "6px 10px", borderBottom: "1px solid var(--rule-strong)" }}>PROB</th><th style={{ textAlign: "right", padding: "6px 10px", borderBottom: "1px solid var(--rule-strong)" }}>DAMAGE</th></tr></thead>
          <tbody>
            {rows.sort((a,b)=>b.damage-a.damage).map((r)=> (
              <tr key={r.name} style={{ borderBottom: "1px solid var(--rule)" }}><td style={{ padding: "6px 10px", fontWeight: 600 }}>{r.name}</td><td style={{ textAlign: "right", padding: "6px 10px" }}>{r.precip.toFixed(0)}mm</td><td style={{ textAlign: "right", padding: "6px 10px", color: r.color as any, fontWeight: 700 }}>{r.prob.toFixed(2)}</td><td style={{ textAlign: "right", padding: "6px 10px" }}>${r.damage.toFixed(0)}k</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--muted)", padding: "6px 10px", borderTop: "1px solid var(--rule)", display: "flex", justifyContent: "space-between" }}>
        <span>Bubble r=8+prob*28 · Heat intensity damage/800 · CN {cn} · P {rainfall}mm</span><span>Source: FloodML 200-city + Chennai 8-ward adapt</span>
      </div>
    </div>
  );
}
