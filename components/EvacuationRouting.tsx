"use client";
import React, { useState, useMemo } from "react";

export const CHENNAI_RELIEF_SHELTERS = [
  { id: "h1", name: "Rajiv Gandhi Govt General Hospital", lat: 13.0818, lng: 80.2778, type: "Tertiary Trauma Hospital", capacity: 1800, bedsAvailable: 340, dryAccess: true },
  { id: "h2", name: "Govt Stanley Medical College Hospital", lat: 13.1075, lng: 80.2872, type: "North Chennai Trauma Center", capacity: 1200, bedsAvailable: 210, dryAccess: true },
  { id: "h3", name: "Omandurar Multi Super Speciality Hospital", lat: 13.0682, lng: 80.2745, type: "State Emergency Hub", capacity: 800, bedsAvailable: 190, dryAccess: true },
  { id: "h4", name: "Saidapet Government District Hospital", lat: 13.0182, lng: 80.2245, type: "Adyar Basin Relief Center", capacity: 500, bedsAvailable: 95, dryAccess: false },
  { id: "s1", name: "Jawaharlal Nehru Indoor Stadium Relief Camp", lat: 13.0845, lng: 80.2735, type: "Major Evacuation Shelter", capacity: 4500, bedsAvailable: 2800, dryAccess: true },
  { id: "s2", name: "Velachery Community Evacuation Center", lat: 12.9812, lng: 80.2215, type: "South Chennai Sump Shelter", capacity: 1500, bedsAvailable: 420, dryAccess: false },
  { id: "s3", name: "Anna University Relief & Food Logistics Hub", lat: 13.0125, lng: 80.2355, type: "High-Ground Logistics Center", capacity: 3000, bedsAvailable: 1950, dryAccess: true },
];

interface EvacuationRoutingProps {
  currentLocation?: { lat: number; lng: number; name: string };
  floodDepth?: number;
  onFocusShelter?: (shelter: any) => void;
}

export default function EvacuationRouting({
  currentLocation,
  floodDepth = 0.5,
  onFocusShelter,
}: EvacuationRoutingProps) {
  const [selectedShelterId, setSelectedShelterId] = useState<string>("h1");

  const startPt = useMemo(() => {
    return currentLocation || { lat: 13.08, lng: 80.27, name: "Current Location" };
  }, [currentLocation]);

  const nearestShelters = useMemo(() => {
    return CHENNAI_RELIEF_SHELTERS.map((s) => {
      const dLat = (s.lat - startPt.lat) * 111;
      const dLng = (s.lng - startPt.lng) * 111 * Math.cos((startPt.lat * Math.PI) / 180);
      const distanceKm = Math.hypot(dLat, dLng);
      // If flood depth is high, detour factor increases
      const detourFactor = floodDepth > 0.8 ? 1.45 : floodDepth > 0.3 ? 1.2 : 1.05;
      const routeKm = distanceKm * detourFactor;
      const estTimeMin = Math.round((routeKm / 18) * 60); // 18 km/h emergency speed
      const routeStatus = floodDepth > 0.8 && !s.dryAccess ? "High Inundation Detour" : s.dryAccess ? "Clear High-Ground Corridor" : "Passable with Rescue Vehicle";
      return {
        ...s,
        distanceKm: distanceKm.toFixed(2),
        routeKm: routeKm.toFixed(2),
        estTimeMin,
        routeStatus,
      };
    }).sort((a, b) => +a.routeKm - +b.routeKm);
  }, [startPt, floodDepth]);

  const activeShelter = nearestShelters.find((s) => s.id === selectedShelterId) || nearestShelters[0];

  return (
    <div className="bg-[#060e1c] border border-[#1e3a5a] rounded-2xl p-4 space-y-4">
      <div className="flex justify-between items-center border-b border-[#1e3a5a]/60 pb-2.5">
        <div>
          <h3 className="font-mono font-bold text-sm text-cyan-300 flex items-center gap-2">
            <span>🛡</span> EMERGENCY EVACUATION & SAFE CORRIDOR ROUTING
          </h3>
          <p className="text-[11px] text-[#8aa0b8] mt-0.5">
            Real-time safe corridor routing avoiding inundated roads (&gt;0.3m depth) to Chennai hospitals & relief camps.
          </p>
        </div>
        <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
          ALGORITHM ACTIVE
        </span>
      </div>

      {/* Active Route Telemetry Card */}
      {activeShelter && (
        <div className="p-3.5 rounded-xl bg-[#040a14] border border-cyan-500/40 space-y-2">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-xs font-bold text-white flex items-center gap-2">
                <span>📍</span> Route to: <span className="text-cyan-300">{activeShelter.name}</span>
              </div>
              <div className="text-[10px] text-[#8aa0b8] mt-0.5">{activeShelter.type}</div>
            </div>
            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${activeShelter.dryAccess ? "bg-emerald-500/20 text-emerald-300" : "bg-amber-500/20 text-amber-300"}`}>
              {activeShelter.routeStatus}
            </span>
          </div>

          <div className="grid grid-cols-4 gap-2 text-center text-xs font-mono pt-2 border-t border-[#1e3a5a]/60">
            <div>
              <div className="text-[#8aa0b8] text-[9px]">Direct Dist</div>
              <div className="font-bold text-white">{activeShelter.distanceKm} km</div>
            </div>
            <div>
              <div className="text-[#8aa0b8] text-[9px]">Safe Detour</div>
              <div className="font-bold text-cyan-300">{activeShelter.routeKm} km</div>
            </div>
            <div>
              <div className="text-[#8aa0b8] text-[9px]">Travel Time</div>
              <div className="font-bold text-amber-300">{activeShelter.estTimeMin} min</div>
            </div>
            <div>
              <div className="text-[#8aa0b8] text-[9px]">Available Beds</div>
              <div className="font-bold text-emerald-400">{activeShelter.bedsAvailable}</div>
            </div>
          </div>
        </div>
      )}

      {/* Shelter List */}
      <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
        <div className="text-[10px] font-mono font-bold text-[#8aa0b8] mb-1">DESIGNATED RELIEF DESTINATIONS</div>
        {nearestShelters.map((s) => (
          <div
            key={s.id}
            onClick={() => {
              setSelectedShelterId(s.id);
              onFocusShelter?.(s);
            }}
            className={`p-2.5 rounded-xl border cursor-pointer transition flex items-center justify-between text-xs ${
              selectedShelterId === s.id
                ? "bg-[#12233a] border-cyan-500 text-white font-semibold"
                : "bg-[#040a14] border-[#1e3a5a] text-[#8aa0b8] hover:border-cyan-500/40 hover:text-white"
            }`}
          >
            <div>
              <div className="font-bold truncate max-w-[280px]">{s.name}</div>
              <div className="text-[10px] text-[#64748b]">{s.type} • {s.distanceKm} km</div>
            </div>
            <div className="text-right font-mono text-[11px]">
              <div className="text-cyan-300 font-bold">{s.estTimeMin} min</div>
              <div className="text-[9px] text-emerald-400">{s.bedsAvailable} beds</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
