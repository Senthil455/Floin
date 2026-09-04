"use client";
import { RESERVOIRS } from "@/app/lib/chennai-data";

export default function HydrologyWorkspace({ S, Ia, Q, rainfall, cn }: { S: number; Ia: number; Q: number; rainfall: number; cn: number }) {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center"><h1 className="text-xl font-extrabold text-white">Hydrological Modelling & Basin Catchment Engine</h1><span className="text-xs text-cyan-300 font-mono">SCS-CN + D8 Hydrodynamics</span></div>
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="bg-[#060e1c] border border-[#1e3a5a] rounded-2xl p-5 space-y-4">
          <h3 className="font-mono font-bold text-sm text-cyan-300">SCS-CN Mathematical Formulation</h3>
          <div className="p-3.5 rounded-xl bg-[#040a14] border border-[#1e3a5a] font-mono text-xs space-y-2 text-[#cbd5e1]">
            <div><b>1. Maximum Potential Retention:</b> S = (25400 / CN) - 254 = <b>{S.toFixed(2)} mm</b></div>
            <div><b>2. Initial Abstraction:</b> Ia = 0.2 × S = <b>{Ia.toFixed(2)} mm</b></div>
            <div><b>3. Direct Surface Runoff:</b> Q = (P - Ia)² / (P + 0.8S) = <b className="text-cyan-300">{Q.toFixed(2)} mm</b></div>
          </div>
          <div className="text-xs text-[#8aa0b8] leading-relaxed">The USDA Soil Conservation Service (SCS) Curve Number model calculates excess precipitation from total rainfall P={rainfall}mm and urban imperviousness CN={cn}.</div>
        </div>
        <div className="bg-[#060e1c] border border-[#1e3a5a] rounded-2xl p-5 space-y-3">
          <h3 className="font-mono font-bold text-sm text-cyan-300">Chennai Reservoir & Sluice Context</h3>
          <div className="space-y-2 text-xs">
            {RESERVOIRS.map((res) => (
              <div key={res.name} className="p-2.5 rounded-xl bg-[#040a14] border border-[#1e3a5a] flex justify-between items-center">
                <div><div className="font-bold text-white">{res.name}</div><div className="text-[10px] text-[#8aa0b8]">{res.basin} • Capacity: {res.cap}</div></div>
                <div className="text-right font-mono"><div className="text-cyan-300 font-bold">{res.status}</div><div className="text-[10px] text-amber-300">{res.outflow}</div></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
