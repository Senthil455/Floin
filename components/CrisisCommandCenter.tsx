"use client";
import { useEffect, useState } from "react";

type Role = "government" | "police" | "hospital" | "fire" | "citizen";
const ROLES: { id: Role; label: string; mono: string; desc: string }[] = [
  { id: "government", label: "BBMP Government", mono: "GOV-01", desc: "City-wide control · 12 active incidents" },
  { id: "police", label: "Police", mono: "POL-02", desc: "Traffic blocks · 8 evacuation kops" },
  { id: "hospital", label: "Hospitals", mono: "HOS-03", desc: "7 hospitals · 340 beds avail" },
  { id: "fire", label: "Fire", mono: "FIR-04", desc: "14 engines · 6 flood pumps" },
  { id: "citizen", label: "Citizens", mono: "CIT-05", desc: "23 crowd reports · 2015 hotspots" },
];

export default function CrisisCommandCenter({ selectedArea, rainfall }: { selectedArea: any; rainfall: number }) {
  const [live, setLive] = useState<any>(null);
  const [role, setRole] = useState<Role>("government");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let t: any;
    async function fetchWeather() {
      try {
        const r = await fetch("https://api.open-meteo.com/v1/forecast?latitude=13.0827&longitude=80.2707&current=precipitation,rain,temperature_2m,relative_humidity_2m,wind_speed_10m&daily=precipitation_sum,temperature_2m_max,temperature_2m_min&timezone=Asia%2FKolkata");
        const j = await r.json();
        setLive(j);
      } catch { setLive({ current: { precipitation: rainfall, temperature_2m: 31, relative_humidity_2m: 78, wind_speed_10m: 12 } }); }
    }
    fetchWeather();
    t = setInterval(() => { fetchWeather(); setTick((x) => x + 1); }, 30000);
    return () => clearInterval(t);
  }, [rainfall]);

  const current = live?.current || { precipitation: rainfall, temperature_2m: 31, relative_humidity_2m: 78, wind_speed_10m: 11 };
  const daily = live?.daily?.precipitation_sum?.[0] ?? rainfall;

  return (
    <div style={{ border: "1px solid var(--ink)", background: "var(--surface)" }}>
      <div style={{ height: 28, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 10px", borderBottom: "1px solid var(--rule)", background: "var(--paper)" }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em" }}>CRISISFLOW · CHENNAI TWIN — LIVE WEATHER (Open-Meteo 30s)</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--signal)", border: "1px solid var(--signal)", padding: "2px 6px", background: "#E8F5E9" }}>LIVE tick {tick} · {new Date().toLocaleTimeString()}</span>
      </div>
      <div style={{ display: "flex", gap: 4, padding: 6, borderBottom: "1px solid var(--rule)", background: "var(--paper)", overflowX: "auto" }}>
        {ROLES.map((r) => (
          <button key={r.id} onClick={() => setRole(r.id)} style={{ whiteSpace: "nowrap", padding: "6px 10px", border: "1px solid", borderColor: role === r.id ? "var(--ink)" : "var(--rule)", background: role === r.id ? "var(--ink)" : "var(--surface)", color: role === r.id ? "var(--paper)" : "var(--muted)", fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600 }}>
            {r.mono} {r.label.toUpperCase()}
          </button>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6, padding: 10, background: "var(--paper)" }} className="max-[700px]:!grid-cols-2">
        <div style={{ border: "1px solid var(--rule)", background: "var(--surface)", padding: "8px 10px" }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--muted)", letterSpacing: "0.08em" }}>PRECIP NOW</div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 16, fontWeight: 700, color: current.precipitation > 20 ? "var(--vermillion)" : "var(--hydro)" }}>{current.precipitation?.toFixed ? current.precipitation.toFixed(1) : current.precipitation} mm</div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)" }}>daily {daily} mm</div>
        </div>
        <div style={{ border: "1px solid var(--rule)", background: "var(--surface)", padding: "8px 10px" }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--muted)" }}>TEMP / HUMID</div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 16, fontWeight: 700 }}>{current.temperature_2m}°C / {current.relative_humidity_2m}%</div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)" }}>wind {current.wind_speed_10m} km/h</div>
        </div>
        <div style={{ border: "1px solid var(--rule)", background: "var(--surface)", padding: "8px 10px" }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--muted)" }}>AOI</div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700 }}>{selectedArea?.name || "CENTRAL"}</div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)" }}>{selectedArea?.center?.[1]?.toFixed(3)}°N {selectedArea?.center?.[0]?.toFixed(3)}°E</div>
        </div>
        <div style={{ border: "1px solid var(--ink)", background: "var(--surface)", padding: "8px 10px", borderLeft: "2px solid var(--vermillion)" }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--muted)" }}>ALERT</div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color: "var(--vermillion)" }}>{rainfall > 200 ? "RED FLOOD" : rainfall > 100 ? "ORANGE" : "GREEN"}</div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)" }}>P {rainfall}mm</div>
        </div>
      </div>
      <div style={{ borderTop: "1px solid var(--ink)", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0 }} className="max-[700px]:!grid-cols-1">
        <div style={{ padding: 10, borderRight: "1px solid var(--rule)" }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", borderBottom: "1px solid var(--rule)", paddingBottom: 6 }}>{ROLES.find((r) => r.id === role)?.mono} — {ROLES.find((r) => r.id === role)?.label.toUpperCase()} VIEW</div>
          <div style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--muted2)", marginTop: 6 }}>
            {role === "government" && "BBMP control room: approve evacuations, allocate pumps, broadcast alerts."}
            {role === "police" && "Traffic blocks on Anna Salai, redirect to high-ground corridors, enforce 2015 hotspots."}
            {role === "hospital" && "Bed capacity live: Stanley 210, GH 340, Omandurar 190. Ambulance routing via detour factor."}
            {role === "fire" && "Deploy 14 engines to Adyar/Cooum outfalls, monitor Chembarambakkam sluice 4,500 cusecs."}
            {role === "citizen" && "23 crowd reports + 327 GCC hotspots. Submit geo-tagged flood photo → triage."}
          </div>
          <div style={{ marginTop: 8, fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)" }}>{ROLES.find((r) => r.id === role)?.desc}</div>
        </div>
        <div style={{ padding: 10 }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", borderBottom: "1px solid var(--rule)", paddingBottom: 6 }}>RESOURCE LEDGER</div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-mono)", fontSize: 11, marginTop: 6 }}>
            <thead><tr style={{ color: "var(--muted)", fontSize: 9 }}><th style={{ textAlign: "left", padding: "4px 0" }}>RESOURCE</th><th style={{ textAlign: "right" }}>COUNT</th><th style={{ textAlign: "right" }}>STATUS</th></tr></thead>
            <tbody>
              {[
                ["Ambulances", "12", "6 dispatched"],
                ["Fire trucks", "14", "2 flood"],
                ["Pumps", "6", "Chembarambakkam"],
                ["Citizen reports", "23", "live"],
              ].map(([k, v, s]) => (
                <tr key={k} style={{ borderTop: "1px solid var(--rule)" }}><td style={{ padding: "6px 0" }}>{k}</td><td style={{ textAlign: "right", fontWeight: 600 }}>{v}</td><td style={{ textAlign: "right", color: "var(--muted)" }}>{s}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--muted)", borderTop: "1px solid var(--rule)", padding: "6px 10px", display: "flex", justifyContent: "space-between" }}>
        <span>SOURCE Open-Meteo 13.0827,80.2707 · 30s poll · IMD fallback</span><span>DECK.GL + STGCN twin (CrisisFlow Chennai)</span>
      </div>
    </div>
  );
}
