"use client";
import { useMemo, useState } from "react";

type Pt = { hour: number; depth: number; velocity: number; runoff: number };

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

function hydrographPoints(Q: number, t: number): Pt[] {
  const d0 = Math.min(Q / 120, 1) * 2.2 * (0.3 + 0.7 * (t / 100));
  return Array.from({ length: 7 }, (_, h) => {
    const tah = Math.tanh(h / 2.2) * Math.exp(-Math.max(0, h - 3) * 0.28);
    const depth = d0 * (0.15 + 0.85 * tah / 0.82);
    const vel = 0.18 + depth * 0.62 + Math.sin(h * 0.9) * 0.04;
    return { hour: h, depth: Math.max(0, depth), velocity: Math.max(0, vel), runoff: Q * tah / 0.82 };
  });
}

function Sparkline({ pts, highlight, onHover, accent }: { pts: Pt[]; highlight: number; onHover: (i: number) => void; accent: string }) {
  const W = 520, H = 96, pad = { l: 38, r: 12, t: 10, b: 22 };
  const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
  const maxD = Math.max(0.35, ...pts.map((p) => p.depth));
  const maxV = Math.max(0.8, ...pts.map((p) => p.velocity));
  const x = (i: number) => pad.l + (i / 6) * iw;
  const yD = (v: number) => pad.t + ih - (v / maxD) * ih;
  const yV = (v: number) => pad.t + ih - (v / maxV) * ih;
  const pathD = pts.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${yD(p.depth).toFixed(1)}`).join(" ");
  const pathV = pts.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${yV(p.velocity).toFixed(1)}`).join(" ");
  const areaD = `${pathD} L${x(6).toFixed(1)},${(pad.t + ih).toFixed(1)} L${x(0).toFixed(1)},${(pad.t + ih).toFixed(1)} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: 96, display: "block" }} role="img" aria-label="Hydrograph depth and velocity">
      <rect x={0} y={0} width={W} height={H} fill="var(--paper)" />
      {[0, 0.25, 0.5, 0.75, 1].map((t) => {
        const yy = pad.t + ih - t * ih;
        return <g key={t}><line x1={pad.l} x2={W - pad.r} y1={yy} y2={yy} stroke="var(--rule)" strokeWidth={t === 0 ? 1 : 0.7} strokeDasharray={t === 0 ? undefined : "3 4"} /><text x={pad.l - 6} y={yy + 3} textAnchor="end" fontFamily="var(--font-mono)" fontSize={8} fill="var(--muted)">{(maxD * t).toFixed(2)}</text></g>;
      })}
      {[0, 1, 2, 3, 4, 5, 6].map((h) => (
        <g key={h}>
          <line x1={x(h)} x2={x(h)} y1={pad.t} y2={pad.t + ih} stroke="var(--rule)" strokeWidth={0.6} strokeDasharray={h === highlight ? undefined : "2 4"} opacity={h === highlight ? 0.9 : 0.35} />
          <text x={x(h)} y={H - 6} textAnchor="middle" fontFamily="var(--font-mono)" fontSize={8} fill={h === highlight ? "var(--ink)" : "var(--muted)"} fontWeight={h === highlight ? 700 : 400}>{h}H</text>
        </g>
      ))}
      <path d={areaD} fill={accent} opacity={0.10} />
      <path d={pathD} fill="none" stroke={accent} strokeWidth={1.8} strokeLinejoin="round" />
      <path d={pathV} fill="none" stroke="var(--hydro)" strokeWidth={1.2} strokeDasharray="4 3" opacity={0.9} />
      {pts.map((p, i) => (
        <g key={i} onMouseEnter={() => onHover(i)} style={{ cursor: "pointer" }}>
          <circle cx={x(i)} cy={yD(p.depth)} r={i === highlight ? 4.5 : 3} fill={i === highlight ? "var(--ink)" : "var(--paper)"} stroke={accent} strokeWidth={1.6} />
          <circle cx={x(i)} cy={yV(p.velocity)} r={2.2} fill="var(--hydro)" opacity={0.95} />
          <rect x={x(i) - 14} y={pad.t - 2} width={28} height={ih + 4} fill="transparent" />
        </g>
      ))}
      <text x={W - pad.r} y={pad.t + 10} textAnchor="end" fontFamily="var(--font-mono)" fontSize={7} letterSpacing="0.08em" fill="var(--muted)">DEPTH m — solid</text>
      <text x={W - pad.r} y={pad.t + 18} textAnchor="end" fontFamily="var(--font-mono)" fontSize={7} letterSpacing="0.08em" fill="var(--hydro)">VELOCITY m/s — dashed</text>
    </svg>
  );
}

function WardBars({ rainfall, cn, selected, onSelect }: { rainfall: number; cn: number; selected: string | null; onSelect: (id: string) => void }) {
  const wards = [
    { id: "tondiarpet", name: "Tondiarpet", pop: 420000, base: 45, center: [80.286, 13.122] as const },
    { id: "anna_nagar", name: "Anna Nagar", pop: 560000, base: 78, center: [80.209, 13.085] as const },
    { id: "adyar", name: "Adyar", pop: 380000, base: 112, center: [80.257, 13.006] as const },
    { id: "velachery", name: "Velachery", pop: 310000, base: 145, center: [80.22, 12.975] as const },
    { id: "saidapet", name: "Saidapet", pop: 290000, base: 98, center: [80.224, 13.02] as const },
    { id: "ennore", name: "Ennore", pop: 180000, base: 67, center: [80.32, 13.214] as const },
    { id: "perungudi", name: "Perungudi", pop: 220000, base: 134, center: [80.24, 12.961] as const },
    { id: "thurai", name: "Thuraipakkam", pop: 200000, base: 89, center: [80.248, 12.942] as const },
  ];
  const rows = useMemo(() => {
    return wards.map((w) => {
      const S = 25400 / cn - 254; const Ia = 0.2 * S; const P = (w.base + rainfall) / 2;
      const Q = P <= Ia ? 0 : (P - Ia) ** 2 / (P + 0.8 * S);
      const prob = Math.min(1, Q / 80);
      const dmg = prob * w.pop * 0.004 * (1 + P / 200);
      return { ...w, prob, dmg: dmg / 1000, Q };
    }).sort((a, b) => b.dmg - a.dmg);
  }, [rainfall, cn]);
  const maxDmg = Math.max(1, ...rows.map((r) => r.dmg));
  return (
    <div>
      <div style={{ display: "grid", gap: 4 }}>
        {rows.map((r) => {
          const pct = (r.dmg / maxDmg) * 100;
          const isSel = selected === r.id;
          const col = r.prob > 0.6 ? "var(--vermillion)" : r.prob > 0.32 ? "#B45309" : "var(--hydro)";
          return (
            <button key={r.id} onClick={() => onSelect(r.id)} style={{ textAlign: "left", display: "grid", gridTemplateColumns: "92px 1fr 64px 56px", gap: 8, alignItems: "center", padding: "6px 8px", border: "1px solid", borderColor: isSel ? "var(--ink)" : "var(--rule)", background: isSel ? "var(--surface)" : "var(--paper)", borderLeftWidth: isSel ? 2 : 1, borderLeftColor: isSel ? "var(--vermillion)" : "var(--rule)" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</span>
              <span style={{ height: 8, background: "var(--rule)", position: "relative", overflow: "hidden" }}>
                <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${pct}%`, background: col }} />
              </span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, textAlign: "right", color: col }}>{r.prob.toFixed(2)}</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, textAlign: "right", color: "var(--muted)" }}>${r.dmg.toFixed(0)}k</span>
            </button>
          );
        })}
      </div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--muted)", marginTop: 6, display: "flex", justifyContent: "space-between" }}>
        <span>prob = Q/80 · damage = prob·pop·0.004·(1+P/200) · CN {cn}</span>
        <span>click to focus basin</span>
      </div>
    </div>
  );
}

export default function AnalyticsSuite({ rainfall, cn, duration, currentHour, onHourChange, selectedWard, onSelectWard }: { rainfall: number; cn: number; duration: number; currentHour: number; onHourChange: (h: number) => void; selectedWard: string | null; onSelectWard: (id: string) => void }) {
  const S = 25400 / cn - 254; const Ia = 0.2 * S; const Q = rainfall <= Ia ? 0 : (rainfall - Ia) ** 2 / (rainfall + 0.8 * S);
  const pts = useMemo(() => hydrographPoints(Q, duration), [Q, duration]);
  const cur = pts[currentHour] ?? pts[2];
  const [hoverHour, setHoverHour] = useState<number | null>(null);
  const h = hoverHour ?? currentHour;
  const accent = cur.depth > 0.8 ? "var(--vermillion)" : cur.depth > 0.35 ? "#B45309" : "var(--hydro)";
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ border: "1px solid var(--ink)", background: "var(--surface)" }}>
        <div style={{ height: 28, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 10px", borderBottom: "1px solid var(--rule)", background: "var(--paper)" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em" }}>02.3 // HYDROGRAPH — 0–6H TANK (tanh·exp)</span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--muted)", border: "1px solid var(--rule-strong)", padding: "2px 6px", background: "var(--paper)" }}>S {S.toFixed(1)} · Ia {Ia.toFixed(1)} · Q {Q.toFixed(1)}mm</span>
        </div>
        <div style={{ padding: "8px 8px 0" }}>
          <Sparkline pts={pts} highlight={h} onHover={setHoverHour} accent={accent} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6, padding: 8, borderTop: "1px solid var(--rule)", background: "var(--paper)" }}>
          {[
            { k: "HOUR", v: `${h}H`, sub: h === 3 ? "PEAK" : h < 3 ? "RISING" : "RECEDING", col: accent },
            { k: "DEPTH", v: `${(pts[h]?.depth ?? 0).toFixed(2)} m`, sub: (pts[h]?.depth ?? 0) > 0.8 ? "CRITICAL" : (pts[h]?.depth ?? 0) > 0.3 ? "MODERATE" : "LOW", col: accent },
            { k: "VELOCITY", v: `${(pts[h]?.velocity ?? 0).toFixed(2)} m/s`, sub: "Gerstner + slope", col: "var(--hydro)" },
            { k: "RUNOFF", v: `${(pts[h]?.runoff ?? 0).toFixed(1)} mm`, sub: "SCS-CN", col: "var(--ink)" },
          ].map((c) => (
            <div key={c.k} style={{ border: "1px solid var(--rule)", background: "var(--surface)", padding: "6px 8px", borderLeft: `2px solid ${c.col}` }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--muted)", letterSpacing: "0.08em" }}>{c.k}</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, color: c.col }}>{c.v}</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--muted)" }}>{c.sub}</div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 4, padding: "0 8px 8px", flexWrap: "wrap" }}>
          {[0, 1, 2, 3, 4, 5, 6].map((hh) => (
            <button key={hh} onClick={() => onHourChange(hh)} onMouseEnter={() => setHoverHour(hh)} onMouseLeave={() => setHoverHour(null)} style={{ flex: 1, minWidth: 36, padding: "5px 0", border: "1px solid", borderColor: currentHour === hh ? "var(--ink)" : "var(--rule-strong)", background: currentHour === hh ? "var(--ink)" : "var(--paper)", color: currentHour === hh ? "var(--paper)" : "var(--muted)", fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600 }}>{hh}H</button>
          ))}
        </div>
      </div>

      <div style={{ border: "1px solid var(--ink)", background: "var(--surface)" }}>
        <div style={{ height: 28, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 10px", borderBottom: "1px solid var(--rule)", background: "var(--paper)" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em" }}>04.2 // WARD DAMAGE — RANKED · LINKED TO 3D</span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--muted)" }}>tap bar to fly 3D → ward</span>
        </div>
        <div style={{ padding: 10 }}>
          <WardBars rainfall={rainfall} cn={cn} selected={selectedWard} onSelect={onSelectWard} />
        </div>
      </div>
    </div>
  );
}
