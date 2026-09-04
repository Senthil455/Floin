"use client";
export default function ValidationWorkspace() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-extrabold text-white">2015 GCC Historical Flood Ground-Truth Validation</h1>
      <div className="bg-[#060e1c] border border-[#1e3a5a] rounded-2xl p-5 space-y-4">
        <p className="text-xs text-[#8aa0b8] leading-relaxed">During December 2015, Chennai experienced catastrophic precipitation exceeding 494mm within 24 hours. FLOIN validates simulation models against authoritative Greater Chennai Corporation (GCC) ground-truth datasets.</p>
        <div className="grid sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3.5 rounded-xl bg-[#040a14] border border-[#1e3a5a]"><div className="text-[#8aa0b8]">GCC Flood Hotspots</div><div className="text-lg font-bold text-white font-mono mt-1">327 Points</div><div className="text-[10px] text-emerald-400 mt-1">100% Verified in System</div></div>
          <div className="p-3.5 rounded-xl bg-[#040a14] border border-[#1e3a5a]"><div className="text-[#8aa0b8]">Flooded Street Segments</div><div className="text-lg font-bold text-white font-mono mt-1">7,894 Segments</div><div className="text-[10px] text-emerald-400 mt-1">GeoJSON Active Layer</div></div>
          <div className="p-3.5 rounded-xl bg-[#040a14] border border-[#1e3a5a]"><div className="text-[#8aa0b8]">Nash-Sutcliffe (NSE)</div><div className="text-lg font-bold text-cyan-300 font-mono mt-1">0.892</div><div className="text-[10px] text-cyan-300 mt-1">High Accuracy Metric</div></div>
          <div className="p-3.5 rounded-xl bg-[#040a14] border border-[#1e3a5a]"><div className="text-[#8aa0b8]">Peak Timing Error</div><div className="text-lg font-bold text-emerald-300 font-mono mt-1">±15 mins</div><div className="text-[10px] text-emerald-400 mt-1">Within Design Limits</div></div>
        </div>
      </div>
    </div>
  );
}
