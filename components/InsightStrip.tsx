"use client";
import { useMemo } from "react";
import { CHENNAI_WARDS } from "@/app/lib/floodml-chennai";

function scs(P:number, CN:number){ const S=25400/CN-254; const Ia=0.2*S; const Q=P<=Ia?0:(P-Ia)**2/(P+0.8*S); return {S,Ia,Q}; }

export default function InsightStrip({ rainfall, cn, duration, currentHour, selectedArea }: { rainfall:number; cn:number; duration:number; currentHour:number; selectedArea:any }){
  const insights = useMemo(()=>{
    const {Q}=scs(rainfall, cn);
    const depth=Math.min(Q/120,1)*2.2*(0.3+0.7*(duration/100));
    const rows=CHENNAI_WARDS.map(w=>{
      const p=(w.basePrecip+rainfall)/2; const {Q:qw}=scs(p,cn); const prob=Math.min(1,qw/80);
      return {...w, p, qw, prob};
    }).sort((a,b)=>b.prob-a.prob);
    const top=rows[0], low=rows[rows.length-1];
    const avgProb=rows.reduce((s,r)=>s+r.prob,0)/rows.length;
    const spread=top.prob - low.prob;
    const list:string[]=[];
    if(Q>150) list.push(`Extreme runoff Q ${Q.toFixed(1)} mm — exceeds 2015 peak window; expect Velachery–Perungudi corridor to pond first.`);
    else if(Q>80) list.push(`High runoff Q ${Q.toFixed(1)} mm — above SCS 50-yr design storm; 3-hour peak depth ~${(depth*0.92).toFixed(2)} m.`);
    else if(Q<12) list.push(`Low runoff Q ${Q.toFixed(1)} mm — abstraction Ia absorbs most of P ${rainfall} mm at CN ${cn}.`);
    else list.push(`Moderate runoff Q ${Q.toFixed(1)} mm — depth ${depth.toFixed(2)} m at t ${duration} min; ward spread ${(spread*100).toFixed(0)} pp.`);

    if(top.prob>0.62) list.push(`Hotspot ward ${top.name} prob ${(top.prob*100).toFixed(0)}% (P ${top.p.toFixed(0)} mm) — ${((top.prob-avgProb)*100).toFixed(0)} pp above basin mean; prioritize pump deployment.`);
    if(spread>0.45) list.push(`Spatial heterogeneity ${(spread*100).toFixed(0)} pp between ${top.name} and ${low.name} — rainfall gradient, not CN, dominates at this P.`);
    const tTop=Math.tanh(currentHour/2.2)*Math.exp(-Math.max(0,currentHour-3)*0.28);
    if(currentHour===3) list.push(`Hydrograph peak at 3H (tanh·exp model) — velocity ${ (0.18+depth*0.62).toFixed(2)} m/s; Cooum outfall most stressed.`);
    else if(currentHour<3) list.push(`Rising limb ${currentHour}H → 3H — depth ${(depth*tTop/0.82).toFixed(2)} m now, +${(((depth*0.82 - depth*tTop/0.82)/Math.max(0.01,depth*tTop/0.82))*100).toFixed(0)}% to peak.`);
    else list.push(`Recession ${currentHour}H — depth decaying by exp −0.28·(H−3); residual ponding in lowlands (Velachery −0.40 m base).`);

    if(selectedArea?.id==="velachery" && depth>0.45) list.push(`Velachery AOI: marsh base −0.40 m + roughness 0.08 — bowl traps ${depth.toFixed(2)} m even at moderate Q.`);
    if(selectedArea?.id==="chembarambakkam" && rainfall>180) list.push(`Chembarambakkam headwaters hill +4.5 m — reservoir release risk; track sluice 4,500 cusecs.`);
    list.push(`CN ${cn}: S ${(25400/cn-254).toFixed(1)} mm, Ia ${(0.2*(25400/cn-254)).toFixed(1)} mm — ${cn>=88?"near-impervious (urban D soil)":cn>=80?"mixed urban C/D":"permeable, higher abstraction"}.`);
    return {rows, list: list.slice(0,4), top, low, avgProb, depth, Q};
  },[rainfall,cn,duration,currentHour,selectedArea?.id]);

  return (
    <div style={{ border:"1px solid var(--ink)", background:"var(--surface)" }}>
      <div style={{ height:28, display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 10px", borderBottom:"1px solid var(--rule)", background:"var(--paper)" }}>
        <span style={{ fontFamily:"var(--font-mono)", fontSize:10, fontWeight:700, letterSpacing:"0.08em" }}>INSIGHTS — AUTO (SCS-CN · WARD · HYDRO)</span>
        <span style={{ fontFamily:"var(--font-mono)", fontSize:9, color:"var(--muted)", border:"1px solid var(--rule-strong)", padding:"2px 6px", background:"var(--paper)" }}>Q {insights.Q.toFixed(1)} · {insights.depth.toFixed(2)}m · {insights.top.name.toUpperCase()}</span>
      </div>
      <div style={{ padding:10, display:"grid", gap:8 }}>
        {insights.list.map((t,i)=>(
          <div key={i} style={{ border:"1px solid var(--rule)", background:"var(--paper)", padding:"8px 10px", borderLeft:`2px solid ${i===0? (insights.depth>0.8?"var(--vermillion)": insights.depth>0.32?"#B45309":"var(--hydro)"): "var(--rule-strong)"}`, fontFamily:"var(--font-mono)", fontSize:11, lineHeight:1.45 }}>
            <span style={{ fontWeight:700, color:"var(--ink)", marginRight:6 }}>{String(i+1).padStart(2,"0")}</span>{t}
            <span style={{ color:"var(--muted)", fontSize:9, marginLeft:6 }}>· derived, not observed</span>
          </div>
        ))}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:6 }}>
          {[
            {k:"HIGHEST RISK", v:insights.top.name, sub:`${(insights.top.prob*100).toFixed(0)}% · P ${insights.top.p.toFixed(0)}mm`},
            {k:"LOWEST RISK", v:insights.low.name, sub:`${(insights.low.prob*100).toFixed(0)}% · ${(insights.avgProb*100).toFixed(0)}% mean`},
            {k:"BASIN SPREAD", v:`${((insights.top.prob-insights.low.prob)*100).toFixed(0)} pp`, sub:`${insights.rows.length} wards · CN ${cn}`},
          ].map(s=>(
            <div key={s.k} style={{ border:"1px solid var(--rule)", background:"var(--paper)", padding:"8px 10px" }}>
              <div style={{ fontFamily:"var(--font-mono)", fontSize:9, color:"var(--muted)", letterSpacing:"0.08em" }}>{s.k}</div>
              <div style={{ fontFamily:"var(--font-mono)", fontSize:11, fontWeight:700 }}>{s.v}</div>
              <div style={{ fontFamily:"var(--font-mono)", fontSize:9, color:"var(--muted)" }}>{s.sub}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ fontFamily:"var(--font-mono)", fontSize:9, color:"var(--muted)", borderTop:"1px solid var(--rule)", padding:"6px 10px", display:"flex", justifyContent:"space-between" }}>
        <span>Ward prob = Q/80 · derived from SCS-CN; not ML prediction</span><span>{currentHour}H · {selectedArea?.name||"—"}</span>
      </div>
    </div>
  );
}
