"use client";
import { useState, useMemo } from "react";
export const CHENNAI_RELIEF_SHELTERS = [
  { id: "h1", name: "Rajiv Gandhi Govt General Hospital", lat: 13.0818, lng: 80.2778, type: "Tertiary Trauma Hospital", capacity: 1800, bedsAvailable: 340, dryAccess: true },
  { id: "h2", name: "Govt Stanley Medical College Hospital", lat: 13.1075, lng: 80.2872, type: "North Chennai Trauma Center", capacity: 1200, bedsAvailable: 210, dryAccess: true },
  { id: "h3", name: "Omandurar Multi Super Speciality Hospital", lat: 13.0682, lng: 80.2745, type: "State Emergency Hub", capacity: 800, bedsAvailable: 190, dryAccess: true },
  { id: "h4", name: "Saidapet Government District Hospital", lat: 13.0182, lng: 80.2245, type: "Adyar Basin Relief Center", capacity: 500, bedsAvailable: 95, dryAccess: false },
  { id: "s1", name: "Jawaharlal Nehru Indoor Stadium Relief Camp", lat: 13.0845, lng: 80.2735, type: "Major Evacuation Shelter", capacity: 4500, bedsAvailable: 2800, dryAccess: true },
  { id: "s2", name: "Velachery Community Evacuation Center", lat: 12.9812, lng: 80.2215, type: "South Chennai Sump Shelter", capacity: 1500, bedsAvailable: 420, dryAccess: false },
  { id: "s3", name: "Anna University Relief & Food Logistics Hub", lat: 13.0125, lng: 80.2355, type: "High-Ground Logistics Center", capacity: 3000, bedsAvailable: 1950, dryAccess: true },
];
interface EvacuationRoutingProps { currentLocation?: { lat: number; lng: number; name: string }; floodDepth?: number; onFocusShelter?: (shelter: any) => void; }
export default function EvacuationRouting({ currentLocation, floodDepth = 0.5, onFocusShelter }: EvacuationRoutingProps) {
  const [selectedShelterId, setSelectedShelterId] = useState("h1");
  const startPt = useMemo(() => currentLocation || { lat: 13.08, lng: 80.27, name: "Current Location" }, [currentLocation]);
  const nearestShelters = useMemo(() => {
    return CHENNAI_RELIEF_SHELTERS.map((s) => {
      const dLat = (s.lat - startPt.lat) * 111;
      const dLng = (s.lng - startPt.lng) * 111 * Math.cos((startPt.lat * Math.PI) / 180);
      const distanceKm = Math.hypot(dLat, dLng);
      const detourFactor = floodDepth > 0.8 ? 1.45 : floodDepth > 0.3 ? 1.2 : 1.05;
      const routeKm = distanceKm * detourFactor;
      const estTimeMin = Math.round((routeKm / 18) * 60);
      const routeStatus = floodDepth > 0.8 && !s.dryAccess ? "DETOUR — INUNDATED" : s.dryAccess ? "CLEAR — HIGH GROUND" : "PASSABLE — RESCUE VEHICLE";
      return { ...s, distanceKm: distanceKm.toFixed(2), routeKm: routeKm.toFixed(2), estTimeMin, routeStatus };
    }).sort((a, b) => +a.routeKm - +b.routeKm);
  }, [startPt, floodDepth]);
  const activeShelter = nearestShelters.find((s) => s.id === selectedShelterId) || nearestShelters[0];
  return (
    <div style={{ border:"1px solid var(--ink)", background:"var(--surface)" }}>
      <div style={{ height:28, display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 10px", borderBottom:"1px solid var(--rule)", background:"var(--paper)" }}>
        <span style={{ fontFamily:"var(--font-mono)", fontSize:10, fontWeight:600, letterSpacing:"0.08em" }}>05.1 // SAFE CORRIDOR</span>
        <span style={{ fontFamily:"var(--font-mono)", fontSize:9, border:"1px solid var(--ink)", padding:"2px 6px", background:"var(--surface)", fontWeight:600 }}>DEPTH {floodDepth.toFixed(2)}m · 18 KM/H</span>
      </div>
      <div style={{ padding:10, borderBottom:"1px solid var(--rule)", background:"var(--paper)", fontFamily:"var(--font-mono)", fontSize:10, color:"var(--muted)", lineHeight:1.5 }}>
        Avoid inundated links &gt;0.30m. Detour factor 1.05–1.45 by depth. Beds right-aligned, mono, tabular.
      </div>
      {activeShelter && (
        <div style={{ margin:10, border:"1px solid var(--ink)", background:"var(--paper)", borderLeft:"2px solid var(--vermillion)" }}>
          <div style={{ display:"flex", justifyContent:"space-between", gap:8, padding:"10px 12px", borderBottom:"1px solid var(--rule)" }}>
            <div><div style={{ fontFamily:"var(--font-body)", fontSize:13, fontWeight:600 }}>{activeShelter.name}</div><div style={{ fontFamily:"var(--font-mono)", fontSize:10, color:"var(--muted)" }}>{activeShelter.type}</div></div>
            <span style={{ fontFamily:"var(--font-mono)", fontSize:9, fontWeight:700, letterSpacing:"0.06em", border:"1px solid var(--rule-strong)", padding:"2px 6px", background: activeShelter.dryAccess?"var(--surface)":"#FFF1F1", color: activeShelter.dryAccess?"var(--signal)":"var(--vermillion)", height:"fit-content" }}>{activeShelter.routeStatus}</span>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", fontFamily:"var(--font-mono)", fontSize:11, textAlign:"center" }}>
            {[
              { k:"DIRECT", v:`${activeShelter.distanceKm} km` },
              { k:"DETOUR", v:`${activeShelter.routeKm} km` },
              { k:"TIME", v:`${activeShelter.estTimeMin} min` },
              { k:"BEDS", v:`${activeShelter.bedsAvailable}` },
            ].map((c)=> (
              <div key={c.k} style={{ padding:"8px 6px", borderRight:"1px solid var(--rule)" }}>
                <div style={{ fontSize:9, letterSpacing:"0.08em", color:"var(--muted)" }}>{c.k}</div>
                <div style={{ fontWeight:700, marginTop:2 }}>{c.v}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      <div style={{ padding:"0 10px 10px" }}>
        <div style={{ fontFamily:"var(--font-mono)", fontSize:9, letterSpacing:"0.08em", color:"var(--muted)", fontWeight:600, padding:"6px 0", borderBottom:"1px solid var(--rule)" }}>05.2 // DESTINATIONS — SORTED BY DETOUR</div>
        <div style={{ maxHeight: 280, overflowY:"auto", border:"1px solid var(--rule)", background:"var(--paper)", marginTop:6 }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontFamily:"var(--font-mono)", fontSize:11 }}>
            <thead><tr style={{ background:"var(--paper)", color:"var(--muted)", fontSize:9 }}><th style={{ textAlign:"left", padding:"6px 10px", borderBottom:"1px solid var(--rule-strong)" }}>FACILITY</th><th style={{ textAlign:"right", padding:"6px 10px", borderBottom:"1px solid var(--rule-strong)" }}>KM</th><th style={{ textAlign:"right", padding:"6px 10px", borderBottom:"1px solid var(--rule-strong)" }}>MIN</th><th style={{ textAlign:"right", padding:"6px 10px", borderBottom:"1px solid var(--rule-strong)" }}>BEDS</th></tr></thead>
            <tbody>
              {nearestShelters.map((s)=> (
                <tr key={s.id} onClick={()=>{setSelectedShelterId(s.id); onFocusShelter?.(s);}} style={{ cursor:"pointer", background: selectedShelterId===s.id?"var(--surface)":"transparent", borderLeft: selectedShelterId===s.id?"2px solid var(--vermillion)":"2px solid transparent", borderBottom:"1px solid var(--rule)" }}>
                  <td style={{ padding:"8px 10px" }}><div style={{ fontWeight:600, fontFamily:"var(--font-body)", fontSize:12 }}>{s.name}</div><div style={{ color:"var(--muted)", fontSize:10 }}>{s.type} · {s.distanceKm} km</div></td>
                  <td style={{ padding:"8px 10px", textAlign:"right", fontWeight:600 }}>{s.routeKm}</td>
                  <td style={{ padding:"8px 10px", textAlign:"right" }}>{s.estTimeMin}</td>
                  <td style={{ padding:"8px 10px", textAlign:"right", color: s.bedsAvailable>1000?"var(--signal)":"var(--ink)", fontWeight:700 }}>{s.bedsAvailable}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
