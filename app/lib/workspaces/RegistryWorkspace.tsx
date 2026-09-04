"use client";
import { DATASET_REGISTRY } from "@/app/lib/chennai-data";
export default function RegistryWorkspace() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-extrabold text-white">Dataset Registry & Provenance Audit</h1>
      <div className="bg-[#060e1c] border border-[#1e3a5a] rounded-2xl p-4">
        <div className="divide-y divide-[#1e3a5a]/60 text-xs">
          {DATASET_REGISTRY.map((ds) => (
            <div key={ds.id} className="py-3 flex items-center justify-between">
              <div><div className="font-bold text-white">{ds.name}</div><div className="text-[#8aa0b8]">{ds.type} • {ds.count} • {ds.source}</div></div>
              <div className="text-right font-mono"><span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 font-bold">{ds.confidence}</span></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
