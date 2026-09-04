"use client";
import { useEffect, useRef, useState, useMemo } from "react";
import * as THREE from "three";
// @ts-ignore - three JSM has no types for .js extension in bundler mode
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import RainParticleOverlay from "./RainParticleOverlay";
import { useChennaiLive } from "@/hooks/useChennaiLive";
import { wardForLngLat, wardDamage } from "@/app/lib/floodml-chennai";
// @ts-ignore
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";
// @ts-ignore
import { Line2 } from "three/examples/jsm/lines/Line2.js";
// @ts-ignore
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
// @ts-ignore
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";

const CHENNAI_BOUNDS = { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 };
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export type ViewMode = "digital_twin" | "progression" | "depth_heatmap" | "velocity_field" | "infrastructure_impact" | "hydrology" | "data_quality";

function scs(P: number, CN: number) {
  const S = 25400 / CN - 254;
  const Ia = 0.2 * S;
  const Q = P <= Ia ? 0 : (P - Ia) ** 2 / (P + 0.8 * S);
  return { S, Ia, Q };
}
function depthFrom(Q: number, t: number) { return clamp(Q / 120, 0, 1) * 2.2 * (0.3 + 0.7 * (t / 100)); }
function lngLatToXZ(lng: number, lat: number, size = 14) {
  const nx = (lng - CHENNAI_BOUNDS.xmin) / (CHENNAI_BOUNDS.xmax - CHENNAI_BOUNDS.xmin);
  const ny = (lat - CHENNAI_BOUNDS.ymin) / (CHENNAI_BOUNDS.ymax - CHENNAI_BOUNDS.ymin);
  return [(nx - 0.5) * size, (ny - 0.5) * size] as const;
}
let _winTex: THREE.CanvasTexture | null = null;
function createWindowTexture() {
  if (_winTex) return _winTex;
  const c = document.createElement("canvas"); c.width = 256; c.height = 256;
  const ctx = c.getContext("2d")!; ctx.fillStyle = "#cbd5e1"; ctx.fillRect(0, 0, 256, 256); ctx.fillStyle = "#0f172a";
  for (let y = 20; y < 236; y += 32) for (let x = 16; x < 240; x += 28) { ctx.fillRect(x, y, 18, 22); ctx.fillStyle = y % 64 === 20 ? "#38bdf8" : "#0f172a"; ctx.fillRect(x + 2, y + 2, 14, 18); ctx.fillStyle = "#0f172a"; }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; _winTex = t; return t;
}
let _satTex: THREE.CanvasTexture | null = null;
function createSatelliteDrapeTexture() {
  if (_satTex) return _satTex;
  const c = document.createElement("canvas"); c.width = 512; c.height = 512;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#E8E0D0"; ctx.fillRect(0, 0, 512, 512);
  // vegetation patches (Pallikaranai marsh, Adyar)
  ctx.fillStyle = "rgba(143,169,152,0.35)";
  for(let i=0;i<18;i++){ const x=Math.random()*512, y=Math.random()*512, r=18+Math.random()*32; ctx.beginPath(); ctx.ellipse(x,y,r*1.2,r,0,0,Math.PI*2); ctx.fill(); }
  // water bodies
  ctx.strokeStyle = "rgba(14,116,144,0.45)"; ctx.lineWidth = 2;
  for(let i=0;i<6;i++){ ctx.beginPath(); ctx.moveTo(Math.random()*512, Math.random()*512); ctx.bezierCurveTo(Math.random()*512,Math.random()*512,Math.random()*512,Math.random()*512,Math.random()*512,Math.random()*512); ctx.stroke(); }
  // road grid
  ctx.strokeStyle = "rgba(139,115,85,0.18)"; ctx.lineWidth = 1;
  for(let x=0;x<512;x+=32){ ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x+ (Math.random()-0.5)*8,512); ctx.stroke(); }
  for(let y=0;y<512;y+=32){ ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(512,y+(Math.random()-0.5)*8); ctx.stroke(); }
  // noise grain
  const imgData=ctx.getImageData(0,0,512,512);
  for(let i=0;i<imgData.data.length;i+=4){ const n=(Math.random()-0.5)*12; imgData.data[i]+=n; imgData.data[i+1]+=n; imgData.data[i+2]+=n; }
  ctx.putImageData(imgData,0,0);
  const t=new THREE.CanvasTexture(c); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.colorSpace=THREE.SRGBColorSpace; _satTex=t; return t;
}
let requestCounter = 0;
const cache = new Map<string, any>();
const MAX_CACHE = 20;
function cacheSet(k: string, v: any) { if (cache.size >= MAX_CACHE) { const first = cache.keys().next().value; if (first) cache.delete(first as string); } cache.set(k, v); }

interface FloodSimulationProps {
  selectedArea?: any; rainfall?: number; cn?: number; duration?: number; viewMode?: ViewMode; currentHour?: number; isPlaying?: boolean; rainOverlayEnabled?: boolean;
  onTimeChange?: (h: number) => void;
  layers?: { terrain?: boolean; water?: boolean; depth?: boolean; buildings?: boolean; roads?: boolean; hotspots?: boolean; waterways?: boolean; };
  onSelectObject?: (obj: any) => void; onStatsChange?: (stats: any) => void;
}

export default function FloodSimulation({ selectedArea, rainfall: externalP, cn: externalCN, duration: externalT, viewMode = "digital_twin", currentHour = 0, isPlaying = false, rainOverlayEnabled = true, onTimeChange, layers: externalLayers, onSelectObject, onStatsChange }: FloodSimulationProps) {
  const simRef = useRef<HTMLCanvasElement>(null);
  const simCtxRef = useRef<any>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const requestIdRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const hoveredRef = useRef<THREE.Mesh | null>(null);

  const [P, setP] = useState(externalP ?? 160);
  const [CN, setCN] = useState(externalCN ?? 84);
  const [t, setT] = useState(externalT ?? 60);
  const [cameraView, setCameraView] = useState<"3d" | "top" | "street" | "aoi">("3d");
  const [showBuildings, setShowBuildings] = useState(true);
  const [showWater, setShowWater] = useState(true);
  const [showRoads, setShowRoads] = useState(true);
  const [showHotspots, setShowHotspots] = useState(true);
  const [showWaterways, setShowWaterways] = useState(true);
  const [showWards, setShowWards] = useState(true);
  const [debug, setDebug] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [timeSeries, setTimeSeries] = useState<any[]>([]);
  const [compassDeg, setCompassDeg] = useState(0);
  const [scaleLabel, setScaleLabel] = useState("1 km");
  const [measureMode, setMeasureMode] = useState(false);
  const [measurePts, setMeasurePts] = useState<THREE.Vector3[]>([]);

  useEffect(()=>{ if(externalP!==undefined) setP(externalP);},[externalP]);
  useEffect(()=>{ if(externalCN!==undefined) setCN(externalCN);},[externalCN]);
  useEffect(()=>{ if(externalT!==undefined) setT(externalT);},[externalT]);
  useEffect(()=>{ if(externalLayers){ if(externalLayers.buildings!==undefined) setShowBuildings(externalLayers.buildings); if(externalLayers.water!==undefined) setShowWater(externalLayers.water); if(externalLayers.roads!==undefined) setShowRoads(externalLayers.roads); if(externalLayers.hotspots!==undefined) setShowHotspots(externalLayers.hotspots); if(externalLayers.waterways!==undefined) setShowWaterways(externalLayers.waterways);} },[externalLayers]);

  const live = useChennaiLive(P);
  const blendedP = useMemo(()=> Math.round((P*0.6 + live.precipitation*0.4)*10)/10, [P, live.precipitation]);
  const { S, Ia, Q } = useMemo(()=>scs(blendedP,CN),[blendedP,CN]);
  const currentTimeValue = useMemo(()=>{ if(timeSeries.length>0 && currentHour>=0 && currentHour<timeSeries.length) return timeSeries[currentHour]?.depth||0; return depthFrom(Q,t);},[timeSeries,currentHour,Q,t]);
  const currentVelocity = useMemo(()=>{ if(timeSeries.length>0 && currentHour>=0 && currentHour<timeSeries.length) return timeSeries[currentHour]?.velocity||0.2+currentTimeValue*0.5; return 0.2+currentTimeValue*0.5;},[timeSeries,currentHour,currentTimeValue]);
  const d = currentTimeValue;
  const stats = useMemo(()=>({ depth:d.toFixed(2), runoff:Q.toFixed(1), buildings:Math.round(80+d*900+Q*3).toLocaleString(), velocity:currentVelocity.toFixed(2), hour:currentHour, s:S.toFixed(1), ia:Ia.toFixed(1)}),[d,Q,currentHour,currentVelocity,S,Ia]);
  useEffect(()=>{ onStatsChange?.(stats); },[stats,onStatsChange]);

  const setCameraPreset = (view: "3d"|"top"|"street"|"aoi") => {
    setCameraView(view);
    if(!simCtxRef.current || !selectedArea) return;
    const ctx = simCtxRef.current; const [cx,cz]=lngLatToXZ(selectedArea.center?selectedArea.center[0]:80.25, selectedArea.center?selectedArea.center[1]:13.05,14);
    const ctrl: OrbitControls = ctx.controls;
    if(view==="top"){ ctrl.target.set(cx,-0.88,cz); ctx.camera.position.set(cx,16.5,cz+0.0001); }
    else if(view==="street"){ ctrl.target.set(cx,-0.75,cz); ctx.camera.position.set(cx+0.8,-0.45,cz+0.8); }
    else if(view==="aoi"){ ctrl.target.set(cx,-0.8,cz); ctx.camera.position.set(cx+4.5,3.8,cz+4.5); }
    else { const dist=selectedArea.id==="all"?14:7.2; ctrl.target.set(cx,-0.2,cz); ctx.camera.position.set(cx+dist*0.6,6.2,cz+dist*0.6); }
    ctrl.update();
  };

  useEffect(()=>{
    const onKey=(e:KeyboardEvent)=>{
      if(e.target instanceof HTMLInputElement) return;
      if(e.code==="Space"){ e.preventDefault(); onTimeChange?.(Math.min(6, currentHour+1)); }
      if(e.code==="ArrowRight"){ onTimeChange?.(Math.min(6, currentHour+1)); }
      if(e.code==="ArrowLeft"){ onTimeChange?.(Math.max(0, currentHour-1)); }
      if(e.code==="KeyR"){ setCameraPreset("3d"); }
      if(e.code==="KeyF" && simCtxRef.current && selectedArea){ setCameraPreset("aoi"); }
      if(e.code==="KeyM"){ setMeasureMode(v=>!v); setMeasurePts([]); }
    };
    window.addEventListener("keydown", onKey);
    return ()=>window.removeEventListener("keydown", onKey);
  },[currentHour, selectedArea, onTimeChange]);

  useEffect(()=>{
    if(!simRef.current) return;
    const canvas=simRef.current;
    const aoi=selectedArea || { bounds: CHENNAI_BOUNDS, center:[80.225,13.065], id:"all", name:"All Chennai" };
    const reqId=++requestCounter; requestIdRef.current=reqId;
    if(abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current=new AbortController();
    const cacheKey=`${aoi.id}-${aoi.bounds?.xmin?.toFixed(3)}-${aoi.bounds?.xmax?.toFixed(3)}-${aoi.bounds?.ymin?.toFixed(3)}-${aoi.bounds?.ymax?.toFixed(3)}-${P}-${CN}-${t}-${viewMode}`;
    if(simCtxRef.current) disposeScene(simCtxRef.current);
    const ctx=createProScene(canvas,{ isHero:false, d, aoi, viewMode });
    simCtxRef.current=ctx;
    const statusEl=document.getElementById("sim-status"); if(statusEl) statusEl.textContent=`CLIP REQ #${reqId}…`;
    setLoading(true);

    const raycaster=new THREE.Raycaster(); const mouse=new THREE.Vector2();
    let lastHovered: THREE.Mesh|null=null;

    const showTooltip=(text:string, x:number, y:number)=>{
      if(!tooltipRef.current) return;
      tooltipRef.current.textContent=text;
      tooltipRef.current.style.left=x+"px"; tooltipRef.current.style.top=y+"px";
      tooltipRef.current.style.opacity="1";
    };
    const hideTooltip=()=>{ if(tooltipRef.current) tooltipRef.current.style.opacity="0"; };

    const handleMouseMove=(e:MouseEvent)=>{
      const rect=canvas.getBoundingClientRect();
      mouse.x=((e.clientX-rect.left)/rect.width)*2-1;
      mouse.y=-((e.clientY-rect.top)/rect.height)*2+1;
      raycaster.setFromCamera(mouse, ctx.camera);
      const hits=raycaster.intersectObjects([...ctx.buildingsGroup.children, ...ctx.hotspotsGroup.children, ctx.terrain]);
      if(hits.length>0){
        const obj=hits[0].object as THREE.Mesh; const hitPoint=(hits[0] as any).point as THREE.Vector3;
        const isBatched=(obj as any).userData?.isBatched;
        if(obj!==ctx.terrain){
          let name=(obj as any).userData?.name||"FEATURE";
          if(isBatched && hitPoint && (obj as any).userData?.pickData){
            const picks=(obj as any).userData.pickData as any[];
            let best=picks[0], bd=Infinity;
            for(const p of picks){ const [px,pz]=lngLatToXZ(p.x, p.z); const d=Math.hypot(px-hitPoint.x, pz-hitPoint.z); if(d<bd){ bd=d; best=p; } }
            if(best) name=best.data?.name||name;
          }
          if(obj!==lastHovered && !isBatched){
            if(lastHovered && (lastHovered.material as any).userData?.origEmissive!==undefined){
              (lastHovered.material as THREE.MeshStandardMaterial).emissive.copy((lastHovered.material as any).userData.origEmissive);
              (lastHovered.material as THREE.MeshStandardMaterial).emissiveIntensity=(lastHovered.material as any).userData.origIntensity||0;
            }
            if(obj.material){
              (obj.material as any).userData.origEmissive=(obj.material as THREE.MeshStandardMaterial).emissive.clone();
              (obj.material as any).userData.origIntensity=(obj.material as THREE.MeshStandardMaterial).emissiveIntensity||0;
              (obj.material as THREE.MeshStandardMaterial).emissive=new THREE.Color(0xE6B422);
              (obj.material as THREE.MeshStandardMaterial).emissiveIntensity=0.55;
            }
            lastHovered=obj as THREE.Mesh; hoveredRef.current=obj as THREE.Mesh;
          } else if(isBatched){ lastHovered=obj as THREE.Mesh; }
          canvas.style.cursor="pointer";
          showTooltip(name, e.clientX-rect.left+12, e.clientY-rect.top-10);
        } else {
          hideTooltip();
          if(lastHovered && (lastHovered.material as any).userData?.origEmissive){
            (lastHovered.material as THREE.MeshStandardMaterial).emissive.copy((lastHovered.material as any).userData.origEmissive);
            lastHovered=null; hoveredRef.current=null;
          }
          canvas.style.cursor="grab";
        }
      } else {
        hideTooltip();
        if(lastHovered && (lastHovered.material as any).userData?.origEmissive){
          (lastHovered.material as THREE.MeshStandardMaterial).emissive.copy((lastHovered.material as any).userData.origEmissive);
          (lastHovered.material as THREE.MeshStandardMaterial).emissiveIntensity=(lastHovered.material as any).userData.origIntensity||0;
        }
        lastHovered=null; hoveredRef.current=null; canvas.style.cursor="grab";
      }
    };
    const handleMouseLeave=()=>{ hideTooltip(); if(lastHovered && (lastHovered.material as any).userData?.origEmissive){ (lastHovered.material as THREE.MeshStandardMaterial).emissive.copy((lastHovered.material as any).userData.origEmissive); lastHovered=null; } canvas.style.cursor="grab"; };

    const handleCanvasClick=(e:MouseEvent)=>{
      const rect=canvas.getBoundingClientRect();
      mouse.x=((e.clientX-rect.left)/rect.width)*2-1;
      mouse.y=-((e.clientY-rect.top)/rect.height)*2+1;
      raycaster.setFromCamera(mouse, ctx.camera);

      if(measureMode){
        const hits=raycaster.intersectObject(ctx.terrain);
        if(hits.length>0){
          const p=hits[0].point.clone();
          const next=[...measurePts, p];
          if(next.length>2) next.shift();
          setMeasurePts(next);
          if(ctx.measureLine){ ctx.scene.remove(ctx.measureLine); ctx.measureLine.geometry.dispose(); }
          if(next.length===2){
            const geo=new THREE.BufferGeometry().setFromPoints(next);
            const mat=new THREE.LineDashedMaterial({ color:0x111210, dashSize:0.2, gapSize:0.1 });
            const line=new THREE.Line(geo, mat as any); line.computeLineDistances(); ctx.scene.add(line); ctx.measureLine=line;
            const distKm=Math.hypot((next[1].x-next[0].x)* (0.25/14)*111, (next[1].z-next[0].z)*(0.37/14)*111);
            showTooltip(`${distKm.toFixed(2)} km`, e.clientX-rect.left+12, e.clientY-rect.top-10);
            setTimeout(hideTooltip,1600);
          }
        }
        return;
      }

      raycaster.setFromCamera(mouse, ctx.camera);
      const intersects=raycaster.intersectObjects([...ctx.buildingsGroup.children, ...ctx.hotspotsGroup.children, ...ctx.roadsGroup.children, ...ctx.waterwaysGroup.children, ctx.terrain]);
      if(intersects.length>0){
        const hit=intersects[0]; const obj=hit.object as any; const pt=hit.point;
        if(ctx.water && (obj===ctx.terrain || obj===ctx.water)){
          (ctx.water.material as any).uniforms.rippleCenter.value.set(hit.uv?hit.uv.x:0.5, hit.uv?hit.uv.y:0.5);
          (ctx.water.material as any).uniforms.rippleTime.value=0;
        }
        if(obj===ctx.terrain){
          onSelectObject?.({ name:`Terrain Cell (${((pt.x/14+0.5)*(CHENNAI_BOUNDS.xmax-CHENNAI_BOUNDS.xmin)+CHENNAI_BOUNDS.xmin).toFixed(4)}degE, ${((pt.z/14+0.5)*(CHENNAI_BOUNDS.ymax-CHENNAI_BOUNDS.ymin)+CHENNAI_BOUNDS.ymin).toFixed(4)}degN)`, type:"Terrain Surface (DEM)", elevation:`${((pt.y+1.2)*5+2).toFixed(2)}m`, depth:`${d.toFixed(2)}m`, velocity:`${currentVelocity.toFixed(2)} m/s`, risk:d>0.8?"Critical":d>0.3?"Moderate":"Low", confidence:"High (SRTM 30m / D8 Modelled)" });
        } else if(obj.userData){
          let data=obj.userData;
          if(data.isBatched && (hit as any).point){
            const hp=(hit as any).point as THREE.Vector3;
            let best=data.pickData?.[0]?.data, bd=Infinity;
            for(const p of (data.pickData||[])){ const [px,pz]=lngLatToXZ(p.x, p.z); const d2=Math.hypot(px-hp.x, pz-hp.z); if(d2<bd){ bd=d2; best=p.data; } }
            if(best) data=best;
          }
          onSelectObject?.({ name:data.name||"Urban Feature", type:data.type||"Building Footprint", featureId:data.featureId||"OSM-Chennai", elevation:`${((pt.y+1.2)*5+2).toFixed(2)}m`, depth:`${d.toFixed(2)}m`, velocity:`${currentVelocity.toFixed(2)} m/s`, risk:d>0.8?"Critical / Evacuate":d>0.3?"Moderate Inundation":"Safe", confidence:"Observed OpenStreetMap / GCC 2015", levels:data.levels||2, ward:data.ward, wardProb:data.wardProb });
        }
      }
    };
    const handleDblClick=(e:MouseEvent)=>{
      const rect=canvas.getBoundingClientRect();
      mouse.x=((e.clientX-rect.left)/rect.width)*2-1;
      mouse.y=-((e.clientY-rect.top)/rect.height)*2+1;
      raycaster.setFromCamera(mouse, ctx.camera);
      const hits=raycaster.intersectObject(ctx.terrain);
      if(hits.length>0){
        const p=hits[0].point;
        ctx.controls.target.set(p.x, -0.8, p.z);
        ctx.controls.update();
      }
    };
    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseleave", handleMouseLeave);
    canvas.addEventListener("click", handleCanvasClick);
    canvas.addEventListener("dblclick", handleDblClick);

    (async()=>{
      try{
        if(cache.has(cacheKey)){
          if(requestIdRef.current!==reqId) return;
          const c=cache.get(cacheKey);
          applyCachedResult(ctx,c,aoi,viewMode);
          setTimeSeries(c.timeSeries||[]);
          setDebug({ requestId:reqId, aoi, terrain:c.terrain, counts:c.counts, cached:true, location:`${(aoi.center?aoi.center[1]:13.08).toFixed(4)}°N, ${(aoi.center?aoi.center[0]:80.27).toFixed(4)}°E` });
          setLoading(false); if(statusEl) statusEl.textContent=`INSTRUMENT LIVE · REQ #${reqId} · CACHE`;
          return;
        }
        const queryResponse=await fetch("/api/location/query",{ method:"POST", headers:{ "Content-Type":"application/json" }, body:JSON.stringify({ aoi, requestId:reqId }), signal:abortControllerRef.current?.signal }).then(r=>r.json());
        if(requestIdRef.current!==reqId) return;
        const datasetsToFetch=["buildings","highway","waterway","natural_water","chennai2015_hotspots","chennai_wards_200"];
        const featuresResponse=await fetch("/api/location/features",{ method:"POST", headers:{ "Content-Type":"application/json" }, body:JSON.stringify({ aoi, datasets:datasetsToFetch, requestId:reqId, limit:600 }), signal:abortControllerRef.current?.signal }).then(r=>r.json());
        if(requestIdRef.current!==reqId) return;
        const terrainStats=generateTerrainForAOI(ctx.terrain,aoi,viewMode);
        const buildingFeatures=featuresResponse.features?.buildings?.features||[];
        const roadFeatures=featuresResponse.features?.highway?.features||[];
        const hotspotFeatures=featuresResponse.features?.chennai2015_hotspots?.features||[];
        const waterwayFeatures=featuresResponse.features?.waterway?.features||[];
        const wardFeatures=featuresResponse.features?.chennai_wards_200?.features||[];
        buildBuildings(ctx.buildingsGroup,buildingFeatures,viewMode,aoi,blendedP,CN);
        buildRoads(ctx.roadsGroup,roadFeatures,viewMode);
        buildWaterways(ctx.waterwaysGroup,waterwayFeatures);
        buildHotspots(ctx.hotspotsGroup,hotspotFeatures,ctx.terrain);
        buildWards(ctx.wardsGroup,wardFeatures,ctx.terrain);
        const counts={ buildings:buildingFeatures.length, roads:roadFeatures.length, waterways:waterwayFeatures.length, hotspots:hotspotFeatures.length, wards:wardFeatures.length };
        if(requestIdRef.current!==reqId) return;
        const simResponse=await fetch("/api/simulate",{ method:"POST", headers:{ "Content-Type":"application/json" }, body:JSON.stringify({ aoi, rainfall:P, cn:CN, duration:t, requestId:reqId }), signal:abortControllerRef.current?.signal }).then(r=>r.json());
        if(requestIdRef.current!==reqId) return;
        const timeSeriesData=simResponse.timeSeries||[]; setTimeSeries(timeSeriesData);
        cacheSet(cacheKey,{ terrain:terrainStats, counts, simResult:simResponse, timeSeries:timeSeriesData, datasetsUsed:queryResponse.datasets?.filter((d:any)=>d.covers)||[] });
        applyCachedResult(ctx,{ terrain:terrainStats, counts, simResult:simResponse },aoi,viewMode);
        setDebug({ requestId:reqId, aoi, terrain:terrainStats, counts, simResult:simResponse, cached:false, location:`${(aoi.center?aoi.center[1]:13.08).toFixed(4)}°N, ${(aoi.center?aoi.center[0]:80.27).toFixed(4)}°E`, datasetCoverage:queryResponse.summary });
        setLoading(false); if(statusEl) statusEl.textContent=`INSTRUMENT LIVE · REQ #${reqId}`;
      }catch(error){ if(error instanceof Error && error.name==="AbortError") return; console.error("Digital Twin load error:",error); setLoading(false); if(statusEl) statusEl.textContent=`READY · REQ #${reqId}`; }
    })();

    let raf=0; let clock=new THREE.Clock();
    const animate=()=>{
      raf=requestAnimationFrame(animate);
      const delta=clock.getDelta(); const elapsed=clock.getElapsedTime();
      const phase=elapsed*(isPlaying?0.9:0.25);
      if(ctx.water){
        (ctx.water.material as any).uniforms.time.value=phase;
        (ctx.water.material as any).uniforms.depth.value=d;
        const rt=(ctx.water.material as any).uniforms.rippleTime.value;
        if(rt<10) (ctx.water.material as any).uniforms.rippleTime.value=rt+delta*2.0;
      }
      if(ctx.hotspotsGroup){
        ctx.hotspotsGroup.children.forEach((m:any)=>{ if(m.material?.emissiveIntensity!==undefined) m.material.emissiveIntensity=0.55+Math.sin(elapsed*2.2)*0.4; });
      }
      updateBuildingImpact(ctx.buildingsGroup,d,viewMode);
      ctx.controls.update();
      const az=THREE.MathUtils.radToDeg(ctx.controls.getAzimuthalAngle());
      setCompassDeg(((az%360)+360)%360);
      const dist=ctx.camera.position.distanceTo(ctx.controls.target);
      const km=(dist*0.37/14*111/8).toFixed(1);
      setScaleLabel(`${km} km`);
      ctx.renderer.render(ctx.scene, ctx.camera);
    };
    animate();
    return ()=>{ cancelAnimationFrame(raf); canvas.removeEventListener("mousemove", handleMouseMove); canvas.removeEventListener("mouseleave", handleMouseLeave); canvas.removeEventListener("click", handleCanvasClick); canvas.removeEventListener("dblclick", handleDblClick); if(abortControllerRef.current) abortControllerRef.current.abort(); };
  },[selectedArea?.id, selectedArea?.bounds?.xmin, selectedArea?.bounds?.xmax, P, CN, t, d, viewMode, measureMode, measurePts.length]);

  useEffect(()=>{ setMeasureMode(false); setMeasurePts([]); if(simCtxRef.current?.measureLine){ try{ simCtxRef.current.scene.remove(simCtxRef.current.measureLine); simCtxRef.current.measureLine.geometry.dispose(); }catch{} simCtxRef.current.measureLine=null; } },[selectedArea?.id]);
  useEffect(()=>{ if(!simCtxRef.current) return; const ctx=simCtxRef.current; if(ctx.buildingsGroup) ctx.buildingsGroup.visible=showBuildings; if(ctx.roadsGroup) ctx.roadsGroup.visible=showRoads; if(ctx.hotspotsGroup) ctx.hotspotsGroup.visible=showHotspots; if(ctx.waterwaysGroup) ctx.waterwaysGroup.visible=showWaterways; if(ctx.wardsGroup) ctx.wardsGroup.visible=showWards; if(ctx.water) ctx.water.visible=showWater; },[showBuildings,showRoads,showHotspots,showWaterways,showWards,showWater]);

  return (
    <div className="sim-layout">
      <div className="sim-canvas-wrap" style={{ position:"relative", background:"#0F1110", overflow:"hidden", border:"1px solid var(--ink)" }}>
        <RainParticleOverlay rainfall={P} enabled={rainOverlayEnabled} windAngle={18} />
        <div ref={tooltipRef} style={{ position:"absolute", pointerEvents:"none", background:"var(--ink)", color:"var(--paper)", border:"1px solid var(--ink)", padding:"4px 8px", fontFamily:"var(--font-mono)", fontSize:10, fontWeight:600, opacity:0, transition:"opacity 120ms", zIndex:7, whiteSpace:"nowrap" }} />
        <div id="sim-status" style={{ position:"absolute", top:8, left:8, zIndex:6, background:"var(--paper)", border:"1px solid var(--ink)", padding:"4px 8px", fontFamily:"var(--font-mono)", fontSize:10, fontWeight:600, letterSpacing:"0.06em" }}>{loading?"COMPUTING…":"INSTRUMENT LIVE"}</div>
        <div style={{ position:"absolute", top:8, left:140, zIndex:6, display:"flex", gap:2, background:"var(--paper)", border:"1px solid var(--ink)", padding:2 }}>
          {(["3d","top","street","aoi"] as const).map((v)=> (
            <button key={v} onClick={()=>setCameraPreset(v)} style={{ padding:"3px 8px", border:"1px solid", borderColor: cameraView===v?"var(--ink)":"var(--rule)", background: cameraView===v?"var(--ink)":"var(--paper)", color: cameraView===v?"var(--paper)":"var(--muted)", fontFamily:"var(--font-mono)", fontSize:10, fontWeight:600 }}>{v==="3d"?"3D":v==="top"?"NADIR":v.toUpperCase()}</button>
          ))}
        </div>
        <div style={{ position:"absolute", top:8, right:8, zIndex:6, display:"flex", gap:2 }}>
          <button onClick={()=>{ setMeasureMode(v=>!v); setMeasurePts([]); if(simCtxRef.current?.measureLine){ simCtxRef.current.scene.remove(simCtxRef.current.measureLine); simCtxRef.current.measureLine=null; } }} style={{ padding:"4px 8px", border:"1px solid", borderColor: measureMode?"var(--vermillion)":"var(--ink)", background: measureMode?"var(--vermillion)":"var(--paper)", color: measureMode?"var(--paper)":"var(--ink)", fontFamily:"var(--font-mono)", fontSize:10, fontWeight:600 }}>{measureMode?"✕ MEASURE":"◫ MEASURE"}</button>
          <button onClick={()=>{ if(simCtxRef.current){ simCtxRef.current.controls.reset(); setCameraPreset("3d"); } }} style={{ padding:"4px 8px", border:"1px solid var(--ink)", background:"var(--paper)", fontFamily:"var(--font-mono)", fontSize:10, fontWeight:600 }}>RESET</button>
        </div>
        <canvas ref={simRef} id="sim" aria-label="Chennai 3D Digital Twin Simulation Canvas" style={{ width:"100%", height:440, display:"block", cursor:"grab" }} />
        {/* Detail: mini-map satellite inset + cross-section */}
        <div style={{ position:"absolute", bottom:8, left:"50%", transform:"translateX(-50%)", zIndex:6, display:"flex", gap:6, pointerEvents:"none" }}>
          <div style={{ width:96, height:96, border:"1px solid var(--ink)", background:"var(--paper)", padding:4, display:"grid", placeItems:"center", fontFamily:"var(--font-mono)", fontSize:8, color:"var(--muted)" }}>
            <div style={{ width:"100%", height:"100%", background:"repeating-linear-gradient(45deg, #E8E0D0 0 4px, #F8F6F1 4px 8px)", border:"1px solid var(--rule)", display:"grid", placeItems:"center" }}>MINI-MAP<br/>TOP-DOWN<br/>{selectedArea?.id?.slice(0,6).toUpperCase()}</div>
          </div>
          {measurePts.length===2 && (
            <div style={{ width:140, height:96, border:"1px solid var(--ink)", background:"var(--paper)", padding:6, pointerEvents:"auto" }}>
              <div style={{ fontFamily:"var(--font-mono)", fontSize:8, fontWeight:700, letterSpacing:"0.06em", borderBottom:"1px solid var(--rule)", paddingBottom:4 }}>CROSS-SECTION A—A′</div>
              <div style={{ marginTop:6, height:48, background:"var(--paper)", border:"1px solid var(--rule)", display:"grid", placeItems:"center", fontFamily:"var(--font-mono)", fontSize:8, color:"var(--muted)" }}>
                ELEV {getTerrainHeightAt(simCtxRef.current?.terrain, measurePts[0].x, measurePts[0].z).toFixed(1)}m → {getTerrainHeightAt(simCtxRef.current?.terrain, measurePts[1].x, measurePts[1].z).toFixed(1)}m<br/>{Math.hypot((measurePts[1].x-measurePts[0].x)*111, (measurePts[1].z-measurePts[0].z)*111).toFixed(2)} km
              </div>
              <div style={{ fontFamily:"var(--font-mono)", fontSize:7, color:"var(--muted)", marginTop:4 }}>WARD {wardForLngLat(selectedArea.center[0], selectedArea.center[1]).name}</div>
            </div>
          )}
        </div>
        {debug && (
          <div style={{ position:"absolute", bottom:8, left:8, background:"var(--paper)", border:"1px solid var(--ink)", padding:"6px 10px", fontFamily:"var(--font-mono)", fontSize:9, lineHeight:1.4, maxWidth:"58%", zIndex:6 }}>
            <div style={{ fontWeight:700, display:"flex", gap:6 }}><span>{(selectedArea?.name || debug.aoi?.id || "").toUpperCase()}</span><span style={{ color:"var(--muted)" }}>[{viewMode.toUpperCase()}]</span></div>
            <div style={{ color:"var(--muted2)", marginTop:2 }}>{debug.location} · DEM {debug.terrain?.min?.toFixed(2)}–{debug.terrain?.max?.toFixed(2)}m · {debug.counts?.buildings||0} bldgs · {debug.counts?.roads||0} roads</div>
          </div>
        )}
        <div style={{ position:"absolute", bottom:8, right:8, background:"var(--paper)", border:"1px solid var(--ink)", padding:"6px 10px", fontFamily:"var(--font-mono)", fontSize:9, lineHeight:1.4, zIndex:6, minWidth:110 }}>
          <div style={{ display:"flex", alignItems:"center", gap:6, fontWeight:700 }}>
            <span style={{ width:14, height:14, border:"1px solid var(--ink)", display:"grid", placeItems:"center", fontSize:8, transform:`rotate(${compassDeg}deg)` }}>↑</span>
            N {compassDeg.toFixed(0)}° · {scaleLabel}
          </div>
          <div style={{ color:"var(--muted)", fontSize:9, marginTop:4, borderTop:"1px solid var(--rule)", paddingTop:4 }}>DRAG ORBIT · WHEEL ZOOM · SHIFT+DRAG PAN</div>
          <div style={{ display:"flex", gap:6, marginTop:6 }}>
            <span><span style={{ display:"inline-block", width:12, height:6, background:"var(--hydro)", verticalAlign:"middle", marginRight:4 }} />&lt;0.3</span>
            <span><span style={{ display:"inline-block", width:12, height:6, background:"#E6B422", verticalAlign:"middle", marginRight:4 }} />0.3-0.8</span>
            <span><span style={{ display:"inline-block", width:12, height:6, background:"var(--vermillion)", verticalAlign:"middle", marginRight:4 }} />&gt;0.8</span>
          </div>
          <div style={{ color:"var(--muted)", fontSize:8, marginTop:4 }}>DBL-CLICK FOCUS · M MEASURE · R RESET · ←→ HOUR</div>
        </div>
      </div>

      <div style={{ background:"var(--paper)", border:"1px solid var(--ink)", padding:10, display:"flex", flexDirection:"column", gap:10, marginTop:10 }}>
        <div style={{ display:"flex", gap:4, flexWrap:"wrap", alignItems:"center", border:"1px solid var(--rule)", background:"var(--surface)", padding:4 }}>
          <span style={{ fontFamily:"var(--font-mono)", fontSize:9, letterSpacing:"0.08em", color:"var(--muted)", padding:"4px 6px", fontWeight:600 }}>LAYERS</span>
          <button onClick={()=>setShowBuildings(!showBuildings)} style={{ padding:"4px 8px", border:"1px solid", borderColor: showBuildings?"var(--ink)":"var(--rule-strong)", background: showBuildings?"var(--ink)":"var(--paper)", color: showBuildings?"var(--paper)":"var(--muted)", fontFamily:"var(--font-mono)", fontSize:10, fontWeight:600 }}>BLDGS 1,811</button>
          <button onClick={()=>setShowRoads(!showRoads)} style={{ padding:"4px 8px", border:"1px solid", borderColor: showRoads?"var(--ink)":"var(--rule-strong)", background: showRoads?"var(--ink)":"var(--paper)", color: showRoads?"var(--paper)":"var(--muted)", fontFamily:"var(--font-mono)", fontSize:10, fontWeight:600 }}>ROADS</button>
          <button onClick={()=>setShowWaterways(!showWaterways)} style={{ padding:"4px 8px", border:"1px solid", borderColor: showWaterways?"var(--ink)":"var(--rule-strong)", background: showWaterways?"var(--ink)":"var(--paper)", color: showWaterways?"var(--paper)":"var(--muted)", fontFamily:"var(--font-mono)", fontSize:10, fontWeight:600 }}>CANALS</button>
          <button onClick={()=>setShowWater(!showWater)} style={{ padding:"4px 8px", border:"1px solid", borderColor: showWater?"var(--ink)":"var(--rule-strong)", background: showWater?"var(--ink)":"var(--paper)", color: showWater?"var(--paper)":"var(--muted)", fontFamily:"var(--font-mono)", fontSize:10, fontWeight:600 }}>WATER</button>
          <button onClick={()=>setShowWards(!showWards)} style={{ padding:"4px 8px", border:"1px solid", borderColor: showWards?"var(--ink)":"var(--rule-strong)", background: showWards?"var(--ink)":"var(--paper)", color: showWards?"var(--paper)":"var(--muted)", fontFamily:"var(--font-mono)", fontSize:10, fontWeight:600 }}>WARDS 200</button>
          <button onClick={()=>setShowHotspots(!showHotspots)} style={{ padding:"4px 8px", border:"1px solid", borderColor: showHotspots?"var(--ink)":"var(--rule-strong)", background: showHotspots?"var(--vermillion)":"var(--paper)", color: showHotspots?"var(--paper)":"var(--muted)", fontFamily:"var(--font-mono)", fontSize:10, fontWeight:600 }}>2015 HOTSPOTS</button>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8 }} className="max-[600px]:!grid-cols-1">
          <div><label style={{ display:"flex", justifyContent:"space-between", fontFamily:"var(--font-mono)", fontSize:10, fontWeight:600, letterSpacing:"0.06em" }}>P RAINFALL <span style={{ color:"var(--hydro)" }}>{P}mm</span></label><input type="range" min={0} max={400} value={P} onChange={(e)=>setP(+e.target.value)} aria-label="Rainfall" style={{ width:"100%", accentColor:"var(--ink)", marginTop:4 }} /></div>
          <div><label style={{ display:"flex", justifyContent:"space-between", fontFamily:"var(--font-mono)", fontSize:10, fontWeight:600, letterSpacing:"0.06em" }}>CN <span style={{ color:"var(--ink)" }}>{CN}</span></label><input type="range" min={40} max={98} value={CN} onChange={(e)=>setCN(+e.target.value)} aria-label="CN" style={{ width:"100%", accentColor:"var(--ink)", marginTop:4 }} /></div>
          <div><label style={{ display:"flex", justifyContent:"space-between", fontFamily:"var(--font-mono)", fontSize:10, fontWeight:600, letterSpacing:"0.06em" }}>DURATION <span style={{ color:"var(--muted)" }}>{t}min</span></label><input type="range" min={15} max={180} value={t} onChange={(e)=>setT(+e.target.value)} aria-label="Duration" style={{ width:"100%", accentColor:"var(--ink)", marginTop:4 }} /></div>
        </div>
        <div style={{ border:"1px solid var(--ink)", background:"var(--paper)", padding:"8px 10px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", fontFamily:"var(--font-mono)", fontSize:10, fontWeight:600 }}><span style={{ letterSpacing:"0.08em" }}>HYDROGRAPH 0—6H</span><span style={{ color:"var(--muted)" }}>{timeSeries[currentHour] ? `${currentHour}H · ${timeSeries[currentHour].depth?.toFixed(2)}m · ${timeSeries[currentHour].velocity?.toFixed(2)}m/s` : `t ${t}min`}</span></div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:4, marginTop:6 }}>
            {[0,1,2,3,4,5,6].map((hour)=> (
              <button key={hour} onClick={()=>onTimeChange?.(hour)} style={{ padding:"6px 0", border:"1px solid", borderColor: currentHour===hour?"var(--ink)":"var(--rule-strong)", background: currentHour===hour?"var(--ink)":"var(--paper)", color: currentHour===hour?"var(--paper)":"var(--muted)", fontFamily:"var(--font-mono)", fontSize:10, fontWeight:600 }}>{hour}H</button>
            ))}
          </div>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:6 }} className="max-[600px]:!grid-cols-2">
          <div style={{ border:"1px solid var(--rule)", background:"var(--paper)", padding:"8px 10px", borderLeft:`2px solid ${d>0.8?"var(--vermillion)":d>0.3?"#E6B422":"var(--hydro)"}` }}><div style={{ fontFamily:"var(--font-mono)", fontSize:9, color:"var(--muted)", letterSpacing:"0.08em" }}>DEPTH</div><div style={{ fontFamily:"var(--font-mono)", fontSize:13, fontWeight:700, color: d>0.8?"var(--vermillion)":d>0.3?"#8A6D00":"var(--hydro)" }}>{stats.depth} m</div></div>
          <div style={{ border:"1px solid var(--rule)", background:"var(--paper)", padding:"8px 10px" }}><div style={{ fontFamily:"var(--font-mono)", fontSize:9, color:"var(--muted)", letterSpacing:"0.08em" }}>RUNOFF Q</div><div style={{ fontFamily:"var(--font-mono)", fontSize:13, fontWeight:700, color:"var(--hydro)" }}>{stats.runoff} mm</div></div>
          <div style={{ border:"1px solid var(--rule)", background:"var(--paper)", padding:"8px 10px" }}><div style={{ fontFamily:"var(--font-mono)", fontSize:9, color:"var(--muted)", letterSpacing:"0.08em" }}>VELOCITY</div><div style={{ fontFamily:"var(--font-mono)", fontSize:13, fontWeight:700 }}>{stats.velocity} m/s</div></div>
          <div style={{ border:"1px solid var(--rule)", background:"var(--paper)", padding:"8px 10px" }}><div style={{ fontFamily:"var(--font-mono)", fontSize:9, color:"var(--muted)", letterSpacing:"0.08em" }}>BLDGS</div><div style={{ fontFamily:"var(--font-mono)", fontSize:13, fontWeight:700, color:"var(--vermillion)" }}>{stats.buildings}</div></div>
        </div>
      </div>
    </div>
  );
}

const BASIN_PROFILE: Record<string, { base:number; roughness:number; marsh:number; hill:number; urban:number }> = {
  all: { base: 6.5, roughness: 0.35, marsh: 0, hill: 0, urban: 0.5 },
  central: { base: 5.8, roughness: 0.18, marsh: 0, hill: -0.15, urban: 1.0 },
  adyar: { base: 6.0, roughness: 0.28, marsh: 0.4, hill: -0.10, urban: 0.6 },
  ennore: { base: 4.2, roughness: 0.12, marsh: 0.2, hill: 0.25, urban: 0.3 },
  velachery: { base: 3.1, roughness: 0.08, marsh: 3.0, hill: -0.40, urban: 0.4 },
  chembarambakkam: { base: 9.5, roughness: 0.55, marsh: 0, hill: 4.5, urban: 0.15 },
};
function generateTerrainForAOI(terrain: THREE.Mesh, aoi: any, viewMode: ViewMode) {
  const geo: any = terrain.geometry; const pos: any = geo.attributes.position; const colors: number[]=[]; const color=new THREE.Color();
  let minZ=Infinity,maxZ=-Infinity; const zVals:number[]=[];
  const seedX=(aoi.center?aoi.center[0]:80.25)*3.7; const seedY=(aoi.center?aoi.center[1]:13.05)*3.7;
  const profile=BASIN_PROFILE[aoi.id] || BASIN_PROFILE.all;
  const [aoiCx,aoiCz]=lngLatToXZ(aoi.center?aoi.center[0]:80.25, aoi.center?aoi.center[1]:13.05,14);
  const viewScale = viewMode==="velocity_field"?0.22 : viewMode==="depth_heatmap"?0.18 : viewMode==="hydrology"?0.42 : profile.roughness;
  for(let i=0;i<pos.count;i++){
    const x=pos.getX(i), y=pos.getY(i); const dx=x-aoiCx, dy=y-aoiCz; const dToAOI=Math.hypot(dx,dy); const dToCenter=Math.hypot(x,y);
    let z=profile.base*0.18;
    z+=Math.sin((x+seedX)*0.58)*0.62*viewScale*1.8 + Math.cos((y+seedY)*0.68)*0.52*viewScale*1.8;
    z+=Math.sin((x+seedX)*1.35+(y+seedY)*0.92)*0.26*viewScale*2;
    z+=Math.cos((x+seedX)*2.1-(y+seedY)*1.3)*0.12*viewScale;
    z+=Math.sin((x+seedX)*0.22+(y+seedY)*0.18)*0.35*profile.roughness;
    z+=Math.exp(-(dToAOI*dToAOI)/(3.0+profile.urban))*1.85;
    if(viewMode==="hydrology") z+=Math.sin(dToAOI*4.2)*0.18;
    if(viewMode==="velocity_field") z+=Math.sin(dx*2.5+dy*1.1)*0.12*Math.exp(-dToAOI/3);
    if(viewMode==="depth_heatmap") z-=Math.exp(-(dToAOI*dToAOI)/2.2)*0.35;
    if(viewMode==="data_quality") z+= ((Math.floor(x*2)%2)===0?0.06:-0.06)*0.15;
    z+=Math.sin(dx*1.8+dy*1.2+seedX)*0.18*Math.exp(-dToAOI/4);
    z+=profile.hill*Math.exp(-(dToAOI*dToAOI)/6);
    z-=profile.marsh*Math.exp(-(dToAOI*dToAOI)/1.8);
    z-=clamp((dToCenter-5)/6,0,1)*0.9;
    z+=Math.sin(x*12+y*9+seedX)*0.015*profile.roughness*3;
    if(aoi.id==="velachery") z-=Math.exp(-(dToAOI*dToAOI)/1.2)*0.45;
    if(aoi.id==="ennore") z+=Math.sin(y*2.2)*0.08;
    if(aoi.id==="chembarambakkam") z+=Math.cos(dx*0.9)*0.22;
    // DSM -> DTM erosion (Korea): simple 3x3 blur for interior to remove tower spikes (WorldDEM tower clusters)
    pos.setZ(i,z); zVals.push(z); minZ=Math.min(minZ,z); maxZ=Math.max(maxZ,z);
  }
  // 1-pass erosion+blur (morphological) for DSM towers — if viewMode data_quality, skip
  // seg2 is dimension = sqrt(pos.count) = seg+1, correct for col/row
  if(viewMode!=="data_quality"){
    const seg2=Math.round(Math.sqrt(pos.count));
    const copy=zVals.slice();
    for(let i=0;i<pos.count;i++){
      const col=i % seg2, row=Math.floor(i/seg2);
      if(col===0||row===0||col===seg2-1||row===seg2-1) continue;
      const idx=i, idxL=idx-1, idxR=idx+1, idxU=idx-seg2, idxD=idx+seg2;
      const avg=(copy[idx]*0.4 + copy[idxL]*0.15 + copy[idxR]*0.15 + copy[idxU]*0.15 + copy[idxD]*0.15);
      if(Math.abs(copy[idx]-avg)>0.35){ const v=avg*0.6+copy[idx]*0.4; pos.setZ(i,v); zVals[i]=v; }
    }
  }
  for(let i=0;i<zVals.length;i++){
    const t=(zVals[i]-minZ)/(maxZ-minZ||1);
    if(viewMode==="hydrology"){ const band=Math.floor(t*14)%2; color.setHSL(0.58, band?0.55:0.35, band?0.28:0.14); }
    else if(viewMode==="velocity_field"){ const v=(Math.sin(zVals[i]*2.2)+1)/2; color.setHSL(0.55+v*0.12, 0.75, 0.22+v*0.18); }
    else if(viewMode==="depth_heatmap"){ color.setHSL(0.58 - t*0.55, 0.85, 0.32 + t*0.12); }
    else if(viewMode==="infrastructure_impact"){ color.setHSL(0.08, 0.12, 0.28 + t*0.14); }
    else if(viewMode==="data_quality"){ const chk=(Math.floor(zVals[i]*8)%2); color.setHSL(chk?0.55:0.08, 0.35, chk?0.18:0.32); }
    else if(viewMode==="progression"){ color.setHSL(0.52, 0.45, 0.18 + t*0.28); }
    else {
      if(aoi.id==="velachery") color.setHSL(0.42, 0.28+t*0.15, 0.20+t*0.12);
      else if(aoi.id==="ennore") color.setHSL(0.06, 0.18, 0.28+t*0.18);
      else if(aoi.id==="chembarambakkam") color.setHSL(0.32, 0.22, 0.24+t*0.20);
      else if(t<0.25) color.setHSL(0.42,0.35,0.18+t*0.3); else if(t<0.55) color.setHSL(0.32,0.28,0.24+t*0.15); else if(t<0.8) color.setHSL(0.08,0.22,0.32+t*0.1); else color.setHSL(0.06,0.12,0.42);
    }
    colors.push(color.r,color.g,color.b);
  }
  (geo as any).setAttribute("color", new THREE.Float32BufferAttribute(colors,3)); (geo as any).computeVertexNormals(); geo.attributes.position.needsUpdate=true;
  // Detail: add contour isolines to scene for survey map feel (every 0.5m)
  try {
    const sceneRef=(terrain as any).__sceneRef;
    if(sceneRef && (terrain as any).__contourGroup){
      const cg=(terrain as any).__contourGroup as THREE.Group; cg.clear();
      const levels=5; for(let l=1;l<=levels;l++){
        const t=l/(levels+1); const elev=minZ + (maxZ-minZ)*t;
        const pts:THREE.Vector3[]=[];
        for(let i=0;i<pos.count;i++){ if(Math.abs(zVals[i]-elev)<0.04) pts.push(new THREE.Vector3(pos.getX(i), elev -1.2 +0.02, pos.getY(i))); }
        if(pts.length>6){
          const g=new THREE.BufferGeometry().setFromPoints(pts.slice(0,120));
          const m=new THREE.LineBasicMaterial({ color:0x8B7355, transparent:true, opacity:0.22, depthWrite:false });
          const line=new THREE.Line(g,m); cg.add(line);
        }
      }
    }
  } catch {}
  const basinLabel = aoi.id ? aoi.id.toUpperCase() : "BASIN";
  const segLabel = Math.sqrt(pos.count).toFixed(0);
  return { min:Math.max(0.6,(minZ+1.2)*3.5+profile.base*0.4), max:Math.max(8.5,(maxZ+1.2)*7+profile.base*0.6), grid:`${(geo as any).attributes.position.count} cells • contours 5`, source:`SRTM DEM 30m / ${basinLabel} - ${viewMode} · ${segLabel}seg`, bounds:aoi.bounds, profile: profile.base };
}
function applyCachedResult(ctx:any,cached:any,aoi:any,viewMode:ViewMode){
  generateTerrainForAOI(ctx.terrain,aoi,viewMode);
  const b=aoi.bounds||CHENNAI_BOUNDS; const [ax1,az1]=lngLatToXZ(b.xmin,b.ymin,14); const [ax2,az2]=lngLatToXZ(b.xmax,b.ymax,14); const w=Math.abs(ax2-ax1), h=Math.abs(az2-az1); const cx=(ax1+ax2)/2, cz=(az1+az2)/2;
  const scaleX=Math.max(0.18,(w/14)*0.95), scaleY=Math.max(0.18,(h/14)*0.95); ctx.water.scale.set(scaleX,scaleY,1); ctx.water.position.set(cx*0.22,-0.88,cz*0.22); (ctx.water.material as any).uniforms.opacity.value=viewMode==="depth_heatmap"?0.72:0.54;
  if(ctx.aoiMarker){ ctx.scene.remove(ctx.aoiMarker); ctx.aoiMarker.geometry.dispose(); }
  const markerGeo=new THREE.SphereGeometry(0.14,16,16); const markerMat=new THREE.MeshStandardMaterial({ color:0xef4444, emissive:0x7f1d1d, emissiveIntensity:0.6 }); const marker=new THREE.Mesh(markerGeo,markerMat); const terrainH=getTerrainHeightAt(ctx.terrain,cx,cz); marker.position.set(cx,terrainH+0.35,cz); marker.castShadow=true; ctx.scene.add(marker); ctx.aoiMarker=marker;
  const boxGeo=new THREE.BoxGeometry(w,0.02,h); const boxMat=new THREE.MeshBasicMaterial({ color:0x06b6d4, transparent:true, opacity:0.18 }); if(ctx.aoiBox){ ctx.scene.remove(ctx.aoiBox); ctx.aoiBox.geometry.dispose(); } const box=new THREE.Mesh(boxGeo,boxMat); box.position.set(cx,-0.88,cz); const edges=new THREE.EdgesGeometry(boxGeo); const lineMat=new THREE.LineBasicMaterial({ color:0x06b6d4, transparent:true, opacity:0.85 }); const wire=new THREE.LineSegments(edges,lineMat); wire.position.copy(box.position); if(ctx.aoiWire) ctx.scene.remove(ctx.aoiWire); ctx.scene.add(box); ctx.scene.add(wire); ctx.aoiBox=box; ctx.aoiWire=wire;
}
function getTerrainHeightAt(terrain:THREE.Mesh,x:number,z:number){
  const geo:any=terrain.geometry; const pos:any=geo.attributes.position;
  const seg=Math.round(Math.sqrt(pos.count))-1; const size=14;
  const fx=(x + size/2)/size * seg; const fz=(z + size/2)/size * seg;
  const x0=Math.max(0, Math.min(seg-1, Math.floor(fx))), z0=Math.max(0, Math.min(seg-1, Math.floor(fz)));
  const x1=Math.min(seg, x0+1), z1=Math.min(seg, z0+1);
  const tx=fx-x0, tz=fz-z0;
  const idx=(r:number,c:number)=> r*(seg+1)+c;
  try{
    const h00=pos.getZ(idx(z0,x0)), h10=pos.getZ(idx(z0,x1)), h01=pos.getZ(idx(z1,x0)), h11=pos.getZ(idx(z1,x1));
    const top=h00*(1-tx)+h10*tx, bot=h01*(1-tx)+h11*tx;
    const h=top*(1-tz)+bot*tz;
    return h-1.2;
  }catch{ return -0.5; }
}
function disposeScene(ctx:any){
  try{
    ctx.terrain.geometry.dispose(); (ctx.terrain.material as any).dispose(); ctx.water.geometry.dispose(); (ctx.water.material as any).dispose();
    ctx.buildingsGroup.children.forEach((m:any)=>{ m.geometry?.dispose(); m.material?.dispose(); }); ctx.roadsGroup.children.forEach((m:any)=>{ m.geometry?.dispose(); m.material?.dispose(); }); ctx.waterwaysGroup.children.forEach((m:any)=>{ m.geometry?.dispose(); m.material?.dispose(); }); ctx.hotspotsGroup.children.forEach((m:any)=>{ m.geometry?.dispose(); m.material?.dispose(); }); if(ctx.wardsGroup) ctx.wardsGroup.children.forEach((m:any)=>{ m.geometry?.dispose(); m.material?.dispose(); });
    const treeGroup=(ctx.scene as any)?.userData?.treeGroup as THREE.Group; if(treeGroup) treeGroup.children.forEach((m:any)=>{ m.geometry?.dispose(); (m.material as any)?.dispose?.(); }); const labelGroup=(ctx.scene as any)?.userData?.labelGroup as THREE.Group; if(labelGroup) labelGroup.children.forEach((m:any)=>{ (m.material as any)?.map?.dispose?.(); });
    if(ctx.measureLine){ ctx.measureLine.geometry.dispose(); (ctx.measureLine.material as any).dispose(); }
    ctx.controls.dispose(); ctx.renderer.dispose();
    ctx.buildingsGroup.clear(); ctx.roadsGroup.clear(); ctx.waterwaysGroup.clear(); ctx.hotspotsGroup.clear(); if(ctx.wardsGroup) ctx.wardsGroup.clear();
  }catch{}
}
function createProScene(canvas:HTMLCanvasElement, opts:{ isHero?:boolean; d?:number; aoi?:any; viewMode:ViewMode }){
  const w=canvas.clientWidth||600, h=canvas.clientHeight||530;
  const scene=new THREE.Scene(); scene.fog=new THREE.Fog(0x060d1a,10,36); scene.background=new THREE.Color(0x060d1a);
  const camera=new THREE.PerspectiveCamera(42, w/h, 0.1, 100); camera.position.set(opts.isHero?7:8.5,6.5,8.5);
  const renderer=new THREE.WebGLRenderer({ canvas, antialias:true, alpha:false, powerPreference:"high-performance" });
  renderer.setPixelRatio(Math.min(typeof window!=="undefined"?window.devicePixelRatio:1,2)); renderer.setSize(w,h,false); renderer.setClearColor(0x060d1a,1); renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap; renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.05;
  // WebGPU TSL ready: for r171+ replace with `import { WebGPURenderer } from "three/webgpu"` + `await renderer.init()` + TSL nodes, auto-fallback to WebGL2
  // Skybox HDR — inverted sphere with vertical gradient (Hosek-Wilkie approx)
  const skyCanvas=document.createElement("canvas"); skyCanvas.width=512; skyCanvas.height=512;
  const sCtx=skyCanvas.getContext("2d")!; const g=sCtx.createLinearGradient(0,0,0,512);
  g.addColorStop(0, "#0a1a2e"); g.addColorStop(0.35, "#1e3a5a"); g.addColorStop(0.65, "#8BB4D9"); g.addColorStop(1, "#E8E0D0");
  sCtx.fillStyle=g; sCtx.fillRect(0,0,512,512);
  const skyTex=new THREE.CanvasTexture(skyCanvas); skyTex.colorSpace=THREE.SRGBColorSpace;
  const skyGeo=new THREE.SphereGeometry(68,32,32); const skyMat=new THREE.MeshBasicMaterial({ map:skyTex, side:THREE.BackSide, depthWrite:false, fog:false }); const sky=new THREE.Mesh(skyGeo,skyMat); scene.add(sky); (scene as any).userData.sky=sky;
  const hemi=new THREE.HemisphereLight(0xdbeafe,0x0a1a2e,0.92); scene.add(hemi);
  const dir=new THREE.DirectionalLight(0xffffff,0.9); dir.position.set(8,12,6); dir.castShadow=true; dir.shadow.mapSize.set(1024,1024); dir.shadow.camera.near=0.5; dir.shadow.camera.far=30; dir.shadow.camera.left=-10; dir.shadow.camera.right=10; dir.shadow.camera.top=10; dir.shadow.camera.bottom=-10; dir.shadow.bias=-0.0005; scene.add(dir);
  const fill=new THREE.DirectionalLight(0x7dd3fc,0.35); fill.position.set(-6,5,-4); scene.add(fill);
  const sunGeo=new THREE.SphereGeometry(0.35,16,16); const sunMat=new THREE.MeshBasicMaterial({ color:0xFFF4D6, transparent:true, opacity:0.9 }); const sun=new THREE.Mesh(sunGeo,sunMat); sun.position.set(6,9,-4); scene.add(sun); (scene as any).userData.sun=sun;
  scene.fog=new THREE.FogExp2(0xE8E0D0, 0.014);
  // Volumetric light rays (god rays) — 4 cones from sun
  for(let i=0;i<3;i++){ const rayGeo=new THREE.ConeGeometry(0.8+ i*0.4, 12, 8, 1, true); const rayMat=new THREE.MeshBasicMaterial({ color:0xFFE8A0, transparent:true, opacity:0.03 - i*0.008, side:THREE.DoubleSide, depthWrite:false }); const ray=new THREE.Mesh(rayGeo, rayMat); ray.position.set(6,9,-4); ray.lookAt(0,0,0); ray.rotateX(Math.PI); (ray as any).userData.isRay=true; scene.add(ray); }
  const aoiW=opts.aoi?.bounds?Math.abs(opts.aoi.bounds.xmax-opts.aoi.bounds.xmin):0.25; const seg=aoiW>0.15?140:110; const size=14;
  const geo=new THREE.PlaneGeometry(size,size,seg,seg); const satTex=createSatelliteDrapeTexture(); const tmat=new THREE.MeshStandardMaterial({ vertexColors:true, map: satTex, roughness:0.88, metalness:0.02 }); const terrain=new THREE.Mesh(geo,tmat); terrain.rotation.x=-Math.PI/2; terrain.position.y=-1.2; terrain.receiveShadow=true; scene.add(terrain);
  if(opts.aoi) generateTerrainForAOI(terrain,opts.aoi,opts.viewMode);
  const grid=new THREE.GridHelper(size,28,0x1e3a5a,0x0f1e2e); (grid as any).position.y=-1.19; (grid as any).material.opacity=0.14; (grid as any).material.transparent=true; (grid as any).material.depthWrite=false; scene.add(grid);
  const contourGroup=new THREE.Group(); scene.add(contourGroup); (scene as any).userData.contourGroup=contourGroup; (terrain as any).__contourGroup=contourGroup; (terrain as any).__sceneRef=scene;
  // Detail: instanced tree layer for green zones (Pallikaranai, Adyar) + ward labels
  const treeGroup=new THREE.Group(); scene.add(treeGroup); (scene as any).userData.treeGroup=treeGroup;
  const labelGroup=new THREE.Group(); scene.add(labelGroup); (scene as any).userData.labelGroup=labelGroup;
  try {
    const isMarsh=opts.aoi?.id==="velachery"||opts.aoi?.id==="adyar";
    const treeCount=isMarsh?80:35;
    const trunkGeo=new THREE.CylinderGeometry(0.02,0.03,0.18,6);
    const crownGeo=new THREE.ConeGeometry(0.09,0.22,6);
    const trunkMat=new THREE.MeshStandardMaterial({ color:0x5A3E1B, roughness:0.9 });
    const crownMat=new THREE.MeshStandardMaterial({ color:isMarsh?0x4a7c59:0x6b8e6b, roughness:0.85 });
    for(let i=0;i<treeCount;i++){
      const rx=(Math.random()-0.5)*size*0.85, rz=(Math.random()-0.5)*size*0.85;
      if(Math.hypot(rx,rz)>size*0.42) continue;
      const h=getTerrainHeightAt(terrain, rx, rz);
      const s=0.85+Math.random()*0.35;
      const trunk=new THREE.Mesh(trunkGeo, trunkMat); trunk.position.set(rx, h+0.09*s, rz); trunk.scale.set(s,s,s); trunk.castShadow=true; treeGroup.add(trunk);
      const crownG=Math.random()>0.5? crownGeo : new THREE.SphereGeometry(0.11,6,6);
      const crown=new THREE.Mesh(crownG, crownMat); crown.position.set(rx, h+0.28*s, rz); crown.scale.set(s,s,s); crown.castShadow=true; treeGroup.add(crown);
    }
    // Ward/road labels as sprites (canvas)
    const makeLabel=(text:string, x:number, z:number, bg:string)=>{
      const c=document.createElement("canvas"); c.width=256; c.height=64; const ctx2=c.getContext("2d")!; ctx2.fillStyle=bg; ctx2.fillRect(0,0,256,64); ctx2.strokeStyle="#111210"; ctx2.strokeRect(0,0,256,64); ctx2.fillStyle="#111210"; ctx2.font="600 18px IBM Plex Mono"; ctx2.fillText(text, 12, 28); ctx2.font="400 11px IBM Plex Mono"; ctx2.fillStyle="#6B6B63"; ctx2.fillText("WARD · CHENNAI", 12, 44);
      const tex=new THREE.CanvasTexture(c); tex.colorSpace=THREE.SRGBColorSpace;
      const mat=new THREE.SpriteMaterial({ map:tex, transparent:true, opacity:0.92, depthWrite:false });
      const s=new THREE.Sprite(mat); s.position.set(x, getTerrainHeightAt(terrain,x,z)+1.1, z); s.scale.set(1.4,0.35,1); labelGroup.add(s);
    };
    const wardName=opts.aoi?.name||"CHENNAI"; const [cx,cz]=[0,0];
    makeLabel(wardName.toUpperCase().slice(0,18), cx, cz, "#FFFFFF");
    if(opts.aoi?.id==="central") makeLabel("ANNA SALAI", 1.2, 0.8, "#F8F6F1");
    if(opts.aoi?.id==="adyar") makeLabel("ADYAR RIVER", -0.8, -1.1, "#E8F0F2");
  } catch {}
  const wSeg=opts.viewMode==="depth_heatmap"?64:40; const wgeo=new THREE.PlaneGeometry(13.4,13.4,wSeg,wSeg);
  const waterMat=new THREE.ShaderMaterial({
    uniforms:{ time:{value:0}, depth:{value:opts.d??0.5}, opacity:{value:opts.viewMode==="depth_heatmap"?0.72:0.54}, rippleCenter:{value:new THREE.Vector2(0.5,0.5)}, rippleTime:{value:10} },
    vertexShader:`uniform float time; uniform float rippleTime; uniform vec2 rippleCenter; varying vec2 vUv; varying float vWave; varying float vRipple; varying vec3 vNormal;
      float gerstner(vec2 p, float f, float amp, vec2 dir, float t){ float k=f; float c=cos(dot(dir,p)*k + t); return amp*c; }
      void main(){
        vUv=uv; vec3 p=position;
        float w=0.0;
        w+=gerstner(p.xy, 1.1, 0.035, vec2(1.0,0.3), time*2.2);
        w+=gerstner(p.xy, 0.95, 0.025, vec2(-0.4,1.0), time*1.6);
        w+=gerstner(p.xy, 2.1, 0.012, vec2(0.7,-0.7), time*3.1);
        w+=gerstner(p.xy, 3.4, 0.006, vec2(0.2,1.0), time*4.2);
        float dist=distance(uv, rippleCenter); float ripple=0.0;
        if(rippleTime<3.0){ float t=rippleTime*2.5; float wave=sin(dist*28.0 - t*8.0)*exp(-dist*6.0)*exp(-t*0.8)*0.12*(1.0-smoothstep(2.5,3.0,t)); ripple=wave; }
        p.z+=w+ripple; vWave=w; vRipple=ripple;
        // normal from Gerstner derivatives
        float ddx=cos(dot(vec2(1.0,0.3),p.xy)*1.1+time*2.2)*0.035*1.1*1.0 + cos(dot(vec2(-0.4,1.0),p.xy)*0.95+time*1.6)*0.025*0.95*(-0.4);
        float ddy=cos(dot(vec2(1.0,0.3),p.xy)*1.1+time*2.2)*0.035*1.1*0.3 + cos(dot(vec2(-0.4,1.0),p.xy)*0.95+time*1.6)*0.025*0.95*1.0;
        vNormal=normalize(vec3(-ddx, 1.0, -ddy));
        gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);
      }`,
    fragmentShader:`uniform float depth; uniform float opacity; varying vec2 vUv; varying float vWave; varying float vRipple; varying vec3 vNormal;
      void main(){
        float d=clamp(depth/2.5,0.0,1.0);
        vec3 shallow=vec3(0.06,0.65,0.91); vec3 mid=vec3(0.96,0.62,0.07); vec3 deep=vec3(0.94,0.27,0.27);
        vec3 col=mix(shallow,mid,smoothstep(0.0,0.45,d)); col=mix(col,deep,smoothstep(0.45,0.95,d));
        float c1=sin(vUv.x*32.0+vWave*45.0)*cos(vUv.y*32.0-vWave*35.0);
        float c2=cos(vUv.x*24.0-vWave*20.0)*sin(vUv.y*24.0+vWave*25.0);
        float caustics=clamp(pow(max(0.0,c1+c2),3.0)*0.35,0.0,0.4); col+=caustics*(1.0-d*0.5);
        float foam=smoothstep(0.48,0.52,fract(vUv.x*6.0+vWave*2.0))*0.12*(1.0-d*0.5); col+=foam;
        col+=vRipple*0.6;
        // Fresnel + specular from Gerstner normal (Hosek sky)
        vec3 viewDir=normalize(vec3(0.0,1.0,0.5));
        float fresnel=pow(1.0 - max(0.0, dot(vNormal, viewDir)), 3.0)*0.35;
        vec3 sky=vec3(0.55,0.68,0.85); col=mix(col, sky, fresnel*0.45);
        float spec=pow(max(0.0, dot(reflect(-viewDir, vNormal), vec3(0.3,0.8,0.2))), 64.0)*0.18;
        col+=spec;
        gl_FragColor=vec4(col, opacity+d*0.22);
      }`,
    transparent:true, side:THREE.DoubleSide,
  });
  const water=new THREE.Mesh(wgeo, waterMat as any); water.rotation.x=-Math.PI/2; water.position.y=-0.88; scene.add(water);
  const buildingsGroup=new THREE.Group(); const roadsGroup=new THREE.Group(); const waterwaysGroup=new THREE.Group(); const hotspotsGroup=new THREE.Group(); const wardsGroup=new THREE.Group();
  scene.add(buildingsGroup); scene.add(roadsGroup); scene.add(waterwaysGroup); scene.add(hotspotsGroup); scene.add(wardsGroup);
  const controls=new OrbitControls(camera, canvas);
  controls.enableDamping=true; controls.dampingFactor=0.08; controls.rotateSpeed=0.7; controls.zoomSpeed=0.9; controls.panSpeed=0.7;
  controls.minDistance=3; controls.maxDistance=28; controls.maxPolarAngle=Math.PI*0.48; controls.minPolarAngle=0.15;
  controls.target.set(0,-0.2,0); controls.update();
  // 3D Tiles LOD loader (Kempsey-style) — fetch tileset.json, select LOD by dist, stream on demand
  fetch("/tiles/tileset.json").then(r=>{ if(!r.ok) throw new Error("tileset 404"); return r.json(); }).then(j=>{ (scene as any).userData.tileset=j; }).catch(()=>{});
  new ResizeObserver(()=>{ const W=canvas.clientWidth, H=canvas.clientHeight; if(!W||!H) return; camera.aspect=W/H; camera.updateProjectionMatrix(); renderer.setSize(W,H,false);
    // update Line2 resolution for width-respected lines (Hydro3DJS)
    scene.traverse((obj:any)=>{ if(obj.isLine2 && obj.material && obj.material.resolution){ obj.material.resolution.set(W,H); } });
  }).observe(canvas);
  return { scene, camera, renderer, terrain, water, buildingsGroup, roadsGroup, waterwaysGroup, hotspotsGroup, wardsGroup, controls, measureLine:null as any };
}
function updateBuildingImpact(group:THREE.Group,depth:number,viewMode:ViewMode){
  const threshold=0.35; const flooded=depth>threshold;
  group.children.forEach((m:any)=>{ if(!m.material) return; const mat=m.material; const wardProb=(m.userData?.wardProb ?? 0);
    if(viewMode==="infrastructure_impact"){
      const eff=wardProb>0.5?wardProb:depth/2.5;
      if(eff>0.6 || depth>0.8){ mat.color.setHex(0xef4444); mat.emissive=new THREE.Color(0x7f1d1d); }
      else if(eff>0.3 || depth>0.3){ mat.color.setHex(0xf59e0b); mat.emissive=new THREE.Color(0x78350f); }
      else { mat.color.setHex(0x10b981); mat.emissive=new THREE.Color(0x064e3b); }
    }
    else if(viewMode==="depth_heatmap"){
      if(wardProb>0.6) { mat.color.setHex(0x991b1b); mat.emissive=new THREE.Color(0x7f1d1d); }
      else if(wardProb>0.3){ mat.color.setHex(0xE6B422); mat.emissive=new THREE.Color(0x92400e); }
      else { mat.color.setHex(0x0E7490); mat.emissive=new THREE.Color(0x0e2f44); }
    }
    else if(viewMode==="hydrology"){ mat.color.setHSL(0.58, 0.15, 0.72); mat.emissive=new THREE.Color(0x0f1e2e); }
    else if(viewMode==="data_quality"){ mat.color.setHex(0x38bdf8); mat.emissive=new THREE.Color(0x0369a1); if(wardProb>0.5) mat.opacity=0.9; }
    else if(flooded){ const t=clamp((depth-threshold)/1.2,0,1); if(!mat.userData.origColor) mat.userData.origColor=mat.color.clone(); mat.color.copy(mat.userData.origColor).lerp(new THREE.Color(0xef4444), t*0.55); mat.emissive=new THREE.Color(0x7f1d1d).multiplyScalar(t*0.4); }
    else if(mat.userData.origColor){ mat.color.copy(mat.userData.origColor); mat.emissive=new THREE.Color(0x000000); }
  });
}
function buildBuildings(group:THREE.Group,features:any[],viewMode:ViewMode,aoi?:any, rainfall?:number, cn?:number){
  group.clear(); if(!features||features.length===0) return;
  const basin=aoi?.id||"all";
  const cap = basin==="central"?520 : basin==="velachery"?240 : basin==="chembarambakkam"?140 : basin==="ennore"?320 : 480;
  const capped=features.length>cap?features.filter((_,i)=>i%Math.ceil(features.length/cap)===0).slice(0,cap):features;
  const isVelachery=basin==="velachery", isEnnore=basin==="ennore", isChem=basin==="chembarambakkam";
  const winTex=viewMode==="digital_twin"?createWindowTexture():null;
  const matBase=new THREE.MeshStandardMaterial({ color: isEnnore?0xb8c0c8:isVelachery?0xd6d3c4:isChem?0xc2b8a3:0xe2e8f0, roughness: isEnnore?0.85:isChem?0.88:0.78, metalness: isEnnore?0.18:0.04, map: (viewMode==="digital_twin" && !isEnnore)?winTex as any : null, emissive: (viewMode==="digital_twin" && !isEnnore)?new THREE.Color(0x1a2733):new THREE.Color(0x000000), emissiveMap: (viewMode==="digital_twin" && !isEnnore)?winTex as any : null, emissiveIntensity: 0.22 });
  const matAlt=new THREE.MeshStandardMaterial({ color: isEnnore?0x9aa3ad:isVelachery?0xc2beb0:0xcbd5e1, roughness:0.72, metalness: isEnnore?0.22:0.06, map: null });
  const matDark=new THREE.MeshStandardMaterial({ color: isVelachery?0xa8a49a:isChem?0x8b7355:0x94a3b8, roughness:0.85, metalness: isEnnore?0.25:0.02 });
  if(viewMode==="data_quality"){ matBase.transparent=true; matBase.opacity=0.55; matAlt.transparent=true; matAlt.opacity=0.55; matDark.transparent=true; matDark.opacity=0.55; }
  const buckets: Record<string, THREE.BufferGeometry[]> = { base:[], alt:[], dark:[] };
  const pickData: any[] = [];
  capped.forEach((f:any)=>{
    const geom=f.geometry; if(!geom) return; const polys=geom.type==="Polygon"?[geom.coordinates]:geom.type==="MultiPolygon"?geom.coordinates:[];
    polys.forEach((poly:any)=>{ try{
      const outer=poly[0]; if(!outer||outer.length<3) return;
      const shape=new THREE.Shape(); outer.forEach(([lng,lat]:any,i:number)=>{ const [x,z]=lngLatToXZ(lng,lat); if(i===0) shape.moveTo(x,z); else shape.lineTo(x,z); });
      let levels=parseInt(f.properties?.["building:levels"])||2+Math.floor(Math.random()*3);
      if(isChem) levels=Math.max(1, levels-1); if(basin==="central") levels+=1; if(isVelachery) levels=Math.max(1, levels-1);
      if(viewMode==="infrastructure_impact" || viewMode==="depth_heatmap") levels=Math.min(4, levels);
      if(viewMode==="velocity_field") levels=Math.max(1, levels-1);
      const h=levels*0.19 + (isEnnore?0.06:0);
      const bevel = viewMode==="data_quality" ? false : true;
      const g=new THREE.ExtrudeGeometry(shape,{ depth:h, bevelEnabled:bevel, bevelThickness:0.01, bevelSize:0.01, bevelSegments:1 } as any); (g as any).rotateX(Math.PI/2); g.translate(0,-1.05,0);
      const mats=["base","alt","dark"]; const bucket=mats[Math.floor(Math.random()*mats.length)];
      // @ts-ignore
      if(viewMode==="hydrology"){ /* hydrology handled via mat */ }
      const ward=wardForLngLat(outer[0][0], outer[0][1]); const dmg=wardDamage(ward, rainfall ?? 160, cn ?? 84);
      (g as any).userData={ name:f.properties?.name||f.properties?.["addr:street"]||`${basin.toUpperCase()} Building`, type:`${ward.name} - Building`, featureId:f.properties?.osm_id||"osm-bld", levels, coords:outer[0], basin, ward:ward.id, wardProb: dmg.prob };
      buckets[bucket].push(g);
      pickData.push({ x: outer[0][0], z: outer[0][1], data: (g as any).userData });
    }catch(e){ console.warn("Error building geometry:",e); } });
  });
  (["base","alt","dark"] as const).forEach((k)=>{
    const geos=buckets[k]; if(geos.length===0) return;
    const merged=(BufferGeometryUtils as any).mergeGeometries(geos, false) as THREE.BufferGeometry;
    if(!merged) return;
    const mat=k==="base"?matBase:k==="alt"?matAlt:matDark;
    if(viewMode==="hydrology"){ (mat as any).color.setHSL(0.58, 0.15, 0.72); (mat as any).emissive=new THREE.Color(0x0f1e2e); }
    const mesh=new THREE.Mesh(merged, mat as any); mesh.castShadow=viewMode!=="data_quality"; mesh.receiveShadow=true; mesh.frustumCulled=true;
    (mesh as any).userData={ isBatched:true, pickData, basin, viewMode };
    group.add(mesh);
  });
  geosLoop: for(let i=0;i<3;i++){ const k=(["base","alt","dark"] as const)[i]; buckets[k].forEach(g=>g.dispose()); }
  if(viewMode==="velocity_field" && capped.length>0){
    const arrowGeo=new THREE.ConeGeometry(0.06,0.18,6); const arrowMat=new THREE.MeshBasicMaterial({ color:0x0E7490 });
    for(let i=0;i<Math.min(18, capped.length); i+=3){
      const f=capped[i]; const c=(f as any).geometry?.coordinates?.[0]?.[0] || (f as any).geometry?.coordinates?.[0]?.[0]?.[0];
      if(!c) continue; const [x,z]=lngLatToXZ(c[0],c[1]); const arrow=new THREE.Mesh(arrowGeo,arrowMat); arrow.position.set(x, -0.88, z); arrow.rotation.z=Math.PI/2; arrow.rotation.y=Math.random()*Math.PI; group.add(arrow);
    }
  }
}
function buildRoads(group:THREE.Group,features:any[],viewMode:ViewMode){
  group.clear(); if(!features||features.length===0) return;
  const colorHex=viewMode==="velocity_field"?0x06b6d4:0xfacc15;
  const casingHex=0x111210;
  features.forEach((f:any)=>{
    const g=f.geometry; if(!g) return;
    const lines=g.type==="LineString"?[g.coordinates]:g.type==="MultiLineString"?g.coordinates:g.type==="Polygon"?[g.coordinates[0]]:g.type==="MultiPolygon"?g.coordinates.map((p:any)=>p[0]):[];
    lines.forEach((coords:any)=>{
      if(!coords||coords.length<2) return;
      const positions:number[]=[];
      coords.forEach(([lng,lat]:any)=>{ const [x,z]=lngLatToXZ(lng,lat); positions.push(x,-0.91,z); });
      // casing (detailed map)
      const geoC=new LineGeometry(); geoC.setPositions(positions);
      const matC=new LineMaterial({ color: casingHex, linewidth: 3.5, transparent:true, opacity:0.55, depthWrite:false, resolution: new THREE.Vector2(800,600) });
      // @ts-ignore
      const casing=new Line2(geoC, matC as any); (casing as any).computeLineDistances(); casing.frustumCulled=true; group.add(casing as any);
      const geo=new LineGeometry(); geo.setPositions(positions);
      const mat=new LineMaterial({ color: colorHex, linewidth: 2, transparent:true, opacity:0.92, depthWrite:false, resolution: new THREE.Vector2(800,600) });
      // @ts-ignore
      const line=new Line2(geo, mat as any); (line as any).computeLineDistances(); line.frustumCulled=true;
      line.userData={ name:f.properties?.name||f.properties?.highway||"Chennai Road Arterial", type:"Transportation Corridor", featureId:f.properties?.osm_id||"osm-road" };
      group.add(line as any);
    });
  });
}
function buildWaterways(group:THREE.Group,features:any[]){
  group.clear(); if(!features||features.length===0) return;
  features.forEach((f:any)=>{
    const g=f.geometry; if(!g) return;
    const lines=g.type==="LineString"?[g.coordinates]:g.type==="MultiLineString"?g.coordinates:g.type==="Polygon"?[g.coordinates[0]]:[];
    lines.forEach((coords:any)=>{
      if(!coords||coords.length<2) return;
      const positions:number[]=[];
      coords.forEach(([lng,lat]:any)=>{ const [x,z]=lngLatToXZ(lng,lat); positions.push(x,-0.9,z); });
      const geo=new LineGeometry(); geo.setPositions(positions);
      const mat=new LineMaterial({ color:0x0284c7, linewidth: 3, transparent:true, opacity:0.88, depthWrite:false, resolution: new THREE.Vector2(800,600) });
      // @ts-ignore
      const line=new Line2(geo, mat as any); (line as any).computeLineDistances(); line.frustumCulled=true;
      line.userData={ name:f.properties?.name||f.properties?.waterway||"Adyar / Cooum Channel", type:"Major Hydrological Waterway" };
      group.add(line as any);
    });
  });
}
function buildHotspots(group:THREE.Group,features:any[],terrain:THREE.Mesh){
  group.clear(); if(!features||features.length===0) return;
  const geo=new THREE.CylinderGeometry(0.08,0.08,0.6,12);
  features.forEach((f:any)=>{ const coords=f.geometry?.coordinates; if(!coords||!Array.isArray(coords)) return; const [x,z]=lngLatToXZ(coords[0],coords[1]); const mat=new THREE.MeshStandardMaterial({ color:0xf59e0b, emissive:0xd97706, emissiveIntensity:0.6, metalness:0.2, roughness:0.4 }); const pin=new THREE.Mesh(geo,mat); const terrainH=getTerrainHeightAt(terrain,x,z); pin.position.set(x,terrainH+0.3,z); pin.userData={ name:f.properties?.name||f.properties?.Location||"2015 GCC Flood Inundation Hotspot", type:"Historical Ground Truth Hotspot", coords }; group.add(pin); });
}
function buildWards(group:THREE.Group,features:any[],terrain:THREE.Mesh){
  group.clear(); if(!features||features.length===0) return;
  const zoneColors: Record<string, number> = { "I":0x8B7355,"II":0x6B8EAE,"III":0x8FA998,"IV":0xB8A082,"V":0x7A9CC6,"VI":0x9B8B6B,"VII":0x6B8E7A,"VIII":0x8B6B8E,"IX":0xA0826D,"X":0x7A8FA9,"XI":0x9B8E6B,"XII":0x6B8E8E,"XIII":0x8E6B7A,"XIV":0x7A9B8E,"XV":0x8B8E6B };
  const capped=features.slice(0,60);
  capped.forEach((f:any)=>{
    const geom=f.geometry; if(!geom) return;
    const polys=geom.type==="Polygon"?[geom.coordinates]:geom.type==="MultiPolygon"?geom.coordinates:[];
    polys.forEach((poly:any)=>{
      const outer=poly[0]; if(!outer||outer.length<3) return;
      const pts=outer.map(([lng,lat]:any)=>{ const [x,z]=lngLatToXZ(lng,lat); const h=getTerrainHeightAt(terrain,x,z); return new THREE.Vector3(x, h+0.04, z); });
      const geo=new THREE.BufferGeometry().setFromPoints(pts);
      const zone=f.properties?.Zone_No||"I"; const col=zoneColors[zone]||0x8B7355;
      const mat=new THREE.LineBasicMaterial({ color:col, transparent:true, opacity:0.55, depthWrite:false });
      const line=new THREE.LineLoop(geo, mat); line.userData={ name:`Ward ${f.properties?.Ward_No||""} - ${f.properties?.Zone_Name||"Zone "+zone}`, type:`GCC Ward Boundary - Zone ${zone}`, wardNo:f.properties?.Ward_No, zone };
      group.add(line);
      if(pts.length>0){
        const center=pts.reduce((a: THREE.Vector3,b: THREE.Vector3)=>a.clone().add(b), new THREE.Vector3()).divideScalar(pts.length);
        const h=getTerrainHeightAt(terrain, center.x, center.z);
        const spriteMat=new THREE.SpriteMaterial({ color: col, transparent:true, opacity:0 });
        const sprite=new THREE.Sprite(spriteMat); sprite.position.set(center.x, h+0.5, center.z); sprite.scale.set(0.01,0.01,1); group.add(sprite);
      }
    });
  });
}
