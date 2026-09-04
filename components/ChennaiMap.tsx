"use client";
import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import { CHENNAI_RELIEF_SHELTERS } from "./EvacuationRouting";

const CHENNAI_CRITICAL_INFRASTRUCTURE = [
  { name: "Ripon Building (GCC HQ)", lat: 13.0827, lng: 80.2755, type: "Command Center", basin: "Cooum Basin", risk: "Medium" },
  { name: "Tidel Park (OMR Tech Corridor)", lat: 12.9893, lng: 80.2483, type: "IT Infrastructure", basin: "Kovalam / Buckingham", risk: "High" },
  { name: "Chennai Central Railway Station", lat: 13.0823, lng: 80.2754, type: "Transit Terminal", basin: "Buckingham Canal", risk: "Medium" },
  { name: "Adyar River Estuary / Saidapet", lat: 13.0102, lng: 80.2645, type: "River Outfall", basin: "Adyar Basin", risk: "Critical" },
  { name: "Chembarambakkam Reservoir", lat: 13.0118, lng: 80.0578, type: "Water Storage / Sluice", basin: "Adyar Headwaters", risk: "Critical" },
  { name: "Poondi Reservoir (Sathyamurthy)", lat: 13.1912, lng: 79.8601, type: "Major Reservoir", basin: "Kosasthalaiyar", risk: "High" },
  { name: "Red Hills / Puzhal Lake", lat: 13.1856, lng: 80.1745, type: "Urban Drinking Storage", basin: "Puzhal Basin", risk: "Medium" },
  { name: "Ennore Creek & Port Channel", lat: 13.2312, lng: 80.3245, type: "Coastal Outfall", basin: "Kosasthalaiyar Delta", risk: "High" },
  { name: "Velachery Lowland Intersection", lat: 12.9785, lng: 80.2185, type: "Urban Marsh Area", basin: "Pallikaranai Marsh", risk: "Critical" },
];

const MAP_TILES: Record<string, { url: string; attr: string }> = {
  osm: { url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", attr: "© OpenStreetMap" },
  topo: { url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", attr: "© OpenTopoMap" },
  imagery: { url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", attr: "© Esri Imagery" },
  imageryClarity: { url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", attr: "© Esri Clarity" },
  dark: { url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", attr: "© CARTO Dark" },
};
export default function ChennaiMap({
  selectedArea,
  onSelectArea,
  onSelectFeature,
  aoiSizeKm = 1.5,
  onMapClick,
  activeLayer = "all",
  rainfall,
  cn,
  floodLevel=null,
  floodPalette="classic",
  mapStyle="osm",
  includeSeaDepth=false,
}: {
  selectedArea?: any;
  onSelectArea?: (a: any) => void;
  onSelectFeature?: (f: any) => void;
  aoiSizeKm?: number;
  onMapClick?: (lat: number, lng: number) => void;
  activeLayer?: string;
  rainfall?: number;
  cn?: number;
  floodLevel?: number | null;
  floodPalette?: "classic" | "rainbow";
  mapStyle?: string;
  includeSeaDepth?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const countRef = useRef<HTMLSpanElement>(null);
  const mapRef = useRef<any>(null);
  const rectRef = useRef<any>(null);
  const [currentLayerFilter, setCurrentLayerFilter] = useState("all");

  useEffect(() => {
    (async () => {
      const L = (await import("leaflet")).default;
      if (!ref.current) return;
      if ((ref.current as any)._leaflet_map) return;

      const map = L.map(ref.current, { zoomControl: true }).setView([13.08, 80.25], 11);
      (ref.current as any)._leaflet_map = map;

      const initialTiles = MAP_TILES[mapStyle as string] || MAP_TILES.osm;
      const tileLayer = L.tileLayer(initialTiles.url, {
        attribution: `${initialTiles.attr} • Chennai Flood Intelligence • FloodMap.net parity`,
        maxZoom: 18,
      }).addTo(map);
      (map as any)._tileLayer = tileLayer;

      const layers: Record<string, any> = {};
      (map as any)._floinLayers = layers;
      mapRef.current = map;

      // Click listener for AOI creation
      map.on("click", (e: any) => {
        const { lat, lng } = e.latlng;
        if (lng < 79.80 || lng > 80.45 || lat < 12.80 || lat > 13.35) return;

        if (onMapClick) {
          onMapClick(lat, lng);
        } else if (onSelectArea) {
          const delta = (aoiSizeKm || 1.5) / 111;
          onSelectArea({
            id: `click-${Date.now()}`,
            name: `AOI (${lat.toFixed(3)}°N, ${lng.toFixed(3)}°E)`,
            bounds: { xmin: lng - delta, xmax: lng + delta, ymin: lat - delta, ymax: lat + delta },
            center: [lng, lat],
            lat,
            lng,
          });
        }
      });

      const colors = {
        buildings: "#111210",
        highway: "#8B7355",
        water: "#0E7490",
        rainfall: "#111210",
        hotspots: "#E63946",
        inundation: "#991B1B",
        shelters: "#1A7F3D",
      };

      const geoCache = new Map<string, any>();
      async function loadGeoJson(name: string, file: string, style: any, pointHandler?: any) {
        try {
          if (geoCache.has(file)) {
            const j = geoCache.get(file);
            const l = L.geoJSON(j, { style, pointToLayer: pointHandler,
              onEachFeature: (f: any, ly: any) => {
                ly.on("click", (e: any) => {
                  L.DomEvent.stopPropagation(e);
                  const props = f.properties || {};
                  const nameStr = props.name || props.Location || props.station || props.highway || props.waterway || name;
                  onSelectFeature?.({ name: nameStr, type: f.geometry.type, properties: props, depth: props.rainfall_mm ? `${(props.rainfall_mm / 120).toFixed(2)}m` : "0.52m" });
                  const b = (ly as any).getBounds?.();
                  if (b && onSelectArea) { const c = b.getCenter(); onSelectArea({ id: `sel-${Date.now()}`, name: nameStr, bounds: { xmin: b.getWest(), xmax: b.getEast(), ymin: b.getSouth(), ymax: b.getNorth() }, center: [c.lng, c.lat] }); }
                });
                ly.bindPopup(`<b>${f.properties?.name || f.properties?.Location || f.properties?.station || "Chennai Asset"}</b><br><small>${name} • Click to focus</small>`);
              },
            }).addTo(map);
            layers[name] = l; return j.features.length;
          }
          const r = await fetch("/" + file);
          if (!r.ok) return 0;
          const j = await r.json();
          geoCache.set(file, j);
          const l = L.geoJSON(j, {
            style, pointToLayer: pointHandler,
            onEachFeature: (f: any, ly: any) => {
              ly.on("click", (e: any) => {
                L.DomEvent.stopPropagation(e);
                const props = f.properties || {};
                const nameStr = props.name || props.Location || props.station || props.highway || props.waterway || name;
                onSelectFeature?.({ name: nameStr, type: f.geometry.type, properties: props, depth: props.rainfall_mm ? `${(props.rainfall_mm / 120).toFixed(2)}m` : "0.52m" });
                const b = (ly as any).getBounds?.();
                if (b && onSelectArea) { const c = b.getCenter(); onSelectArea({ id: `sel-${Date.now()}`, name: nameStr, bounds: { xmin: b.getWest(), xmax: b.getEast(), ymin: b.getSouth(), ymax: b.getNorth() }, center: [c.lng, c.lat] }); }
              });
              ly.bindPopup(`<b>${f.properties?.name || f.properties?.Location || f.properties?.station || "Chennai Asset"}</b><br><small>${name} • Click to focus</small>`);
            },
          }).addTo(map);
          layers[name] = l; return j.features.length;
        } catch { return 0; }
      }

      const cBld = await loadGeoJson("buildings", "buildings.geojson", { color: colors.buildings, weight: 1, fillOpacity: 0.35 });
      const cRoad = await loadGeoJson("highway", "highway.geojson", { color: colors.highway, weight: 2, fillOpacity: 0.3 });
      const cWater = await loadGeoJson("water", "natural_water.geojson", { color: colors.water, weight: 1.5, fillOpacity: 0.5 });

      // Ward choropleth layer — prob-driven fill (heat) tied to rainfall/CN if provided
      try {
        const wj = await fetch("/chennai_wards_200.geojson").then((r) => r.json());
        const probForWard = (idx:number) => {
          const P = rainfall ?? 160; const CN = cn ?? 84;
          const base = [45,78,112,145,98,67,134,89][idx % 8] ?? 80;
          const S=25400/CN-254, Ia=0.2*S; const mix=(base+P)/2; const Q=mix<=Ia?0:(mix-Ia)**2/(mix+0.8*S);
          return Math.min(1, Q/80);
        };
        const wl = L.geoJSON(wj, {
          style: (f:any) => {
            const idx = (f.properties?.Ward_No ?? f.properties?.WARD_NO ?? 1) % 8;
            const prob = probForWard(idx);
            const col = prob>0.6?"#E63946": prob>0.32?"#E6B422":"#0E7490";
            return { color: col, weight: 1, fillColor: col, fillOpacity: 0.10 + prob*0.28, dashArray: "2 3" };
          },
          onEachFeature: (f:any, ly:any)=>{
            const p=f.properties||{}; const name=p.Ward_Name||p.WARD_NAME||`Ward ${p.Ward_No||p.WARD_NO||""}`;
            ly.bindTooltip(`${name} — prob ${probForWard((p.Ward_No||p.WARD_NO||1)%8).toFixed(2)}`, {sticky:true});
            ly.on("click",(e:any)=>{ L.DomEvent.stopPropagation(e); const b=(ly as any).getBounds?.(); if(b&&onSelectArea){ const c=b.getCenter(); const d=(aoiSizeKm||1.2)/111; onSelectArea({ id:`wardmap-${name.slice(0,8)}`, name, basin:"ward", bounds:{xmin:c.lng-d,xmax:c.lng+d,ymin:c.lat-d,ymax:c.lat+d}, center:[c.lng,c.lat]}); } });
          }
        }).addTo(map);
        layers.wards = wl;
      } catch {}

      try {
        const wj = await fetch("/waterway.geojson").then((r) => r.json());
        const wl = L.geoJSON(wj, { style: { color: colors.water, weight: 2.5 } }).addTo(map);
        layers.waterway = wl;
      } catch {}

      // 2015 Hotspots
      const cHot = await loadGeoJson("hotspots", "chennai2015_hotspots.geojson", {}, (f: any, latlng: any) =>
        L.circleMarker(latlng, {
          radius: 6.5,
          fillColor: colors.hotspots,
          color: "#fff",
          weight: 1.5,
          fillOpacity: 0.9,
        }).bindPopup(`<b>2015 GCC Flood Hotspot</b><br>${f.properties?.Location || "Severe Inundation Point"}`)
      );

      // Rainfall Stations
      const cRain = await loadGeoJson("rainfall", "rainfall_stations.geojson", {}, (f: any, latlng: any) =>
        L.circleMarker(latlng, {
          radius: 7.5,
          fillColor: colors.rainfall,
          color: "#0f172a",
          weight: 2,
          fillOpacity: 0.9,
        }).bindPopup(`<b>${f.properties?.station} Station</b><br>Rainfall: ${f.properties?.rainfall_mm} mm<br>CN Zone: ${f.properties?.cn_zone}`)
      );

      // Evacuation Shelters & Hospitals Layer (from CrisisFlow)
      const shelterGroup = L.layerGroup();
      CHENNAI_RELIEF_SHELTERS.forEach((sh) => {
        const marker = L.circleMarker([sh.lat, sh.lng], {
          radius: 8,
          fillColor: colors.shelters,
          color: "#ffffff",
          weight: 2,
          fillOpacity: 0.95,
        });
        marker.bindPopup(`
          <div style="font-family: sans-serif; font-size: 12px;">
            <b>🏥 ${sh.name}</b><br/>
            <span style="color:#64748b;">${sh.type}</span><br/>
            <span style="color:#10b981; font-weight:bold;">Available Beds: ${sh.bedsAvailable} / ${sh.capacity}</span><br/>
            <span style="color:${sh.dryAccess ? "#10b981" : "#f59e0b"}; font-size:11px;">Access: ${sh.dryAccess ? "High Ground Safe" : "Passable via Detour"}</span>
          </div>
        `);
        marker.addTo(shelterGroup);
      });
      shelterGroup.addTo(map);
      layers.shelters = shelterGroup;

      // Add Critical Infrastructure Markers Layer
      const landmarkGroup = L.layerGroup();
      CHENNAI_CRITICAL_INFRASTRUCTURE.forEach((lm) => {
        const marker = L.circleMarker([lm.lat, lm.lng], {
          radius: 8.5,
          fillColor: lm.risk === "Critical" ? "#dc2626" : lm.risk === "High" ? "#ea580c" : "#0284c7",
          color: "#ffffff",
          weight: 2,
          fillOpacity: 0.95,
        });
        marker.bindPopup(`
          <div style="font-family: sans-serif; font-size: 12px;">
            <b>${lm.name}</b><br>
            <span style="color:#64748b;">${lm.type} • Basin: ${lm.basin}</span><br>
            <span style="color:${lm.risk === "Critical" ? "#ef4444" : "#f59e0b"}; font-weight: bold;">Risk: ${lm.risk}</span><br>
            <button style="margin-top:6px; padding:3px 8px; border-radius:4px; background:#06b6d4; color:#000; font-weight:bold; border:none; cursor:pointer;">Simulate Catchment</button>
          </div>
        `);
        marker.on("click", () => {
          const delta = (aoiSizeKm || 1.5) / 111;
          onSelectArea?.({
            id: `landmark-${lm.name.toLowerCase().replace(/\s+/g, "-")}`,
            name: lm.name,
            bounds: { xmin: lm.lng - delta, xmax: lm.lng + delta, ymin: lm.lat - delta, ymax: lm.lat + delta },
            center: [lm.lng, lm.lat],
            lat: lm.lat,
            lng: lm.lng,
          });
        });
        marker.addTo(landmarkGroup);
      });
      landmarkGroup.addTo(map);
      layers.landmarks = landmarkGroup;

      const total = cBld + cRoad + cWater + cHot + cRain + CHENNAI_CRITICAL_INFRASTRUCTURE.length + CHENNAI_RELIEF_SHELTERS.length;
      if (countRef.current) countRef.current.textContent = `${total.toLocaleString()} features loaded`;

      setTimeout(() => map.invalidateSize(), 250);
    })();
  }, []);

  useEffect(()=>{
    if(!mapRef.current || !(mapRef.current as any)._tileLayer) return;
    (async()=>{
      const L=(await import("leaflet")).default;
      const map=mapRef.current;
      const tiles=MAP_TILES[mapStyle as string]||MAP_TILES.osm;
      try{ if((map as any)._tileLayer) map.removeLayer((map as any)._tileLayer); }catch{}
      const nl=L.tileLayer(tiles.url,{ attribution:`${tiles.attr} • Chennai Flood Intelligence • FloodMap.net parity`, maxZoom:18 }).addTo(map);
      (map as any)._tileLayer=nl;
    })();
  },[mapStyle]);

  const floodLayerRef=useRef<any>(null);
  useEffect(()=>{
    if(!mapRef.current) return;
    (async()=>{
      const L=(await import("leaflet")).default;
      const map=mapRef.current;
      try{ if(floodLayerRef.current) { map.removeLayer(floodLayerRef.current); floodLayerRef.current=null; } }catch{}
      if(floodLevel==null) return;
      const b=selectedArea?.bounds || { xmin:80.10, xmax:80.35, ymin:12.88, ymax:13.25 };
      try{
        const r=await fetch("/api/location/terrain",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({aoi:{bounds:b}})}).then(x=>x.json());
        const t=r?.terrain; if(!t?.elevations) return;
        const g=L.layerGroup(); const cols=t.gridWidth, rows=t.gridHeight;
        for(let row=0;row<rows;row++) for(let col=0;col<cols;col++){
          const elev=t.elevations[row*cols+col];
          if(elev==null||!isFinite(elev)) continue;
          if(!includeSeaDepth && elev<0) continue;
          if(elev < floodLevel){
            const depth=floodLevel - elev;
            const lng=b.xmin + (col/(cols-1))*(b.xmax-b.xmin);
            const lat=b.ymin + (row/(rows-1))*(b.ymax-b.ymin);
            const dLng=(b.xmax-b.xmin)/cols, dLat=(b.ymax-b.ymin)/rows;
            let color="#0E7490";
            if(floodPalette==="rainbow"){
              const hue= 220 - Math.min(1, depth/6)*200;
              color=`hsl(${hue},85%,50%)`;
            }
            const rect=L.rectangle([[lat-dLat/2,lng-dLng/2],[lat+dLat/2,lng+dLng/2]],{ stroke:false, fillColor:color, fillOpacity: 0.42 + Math.min(0.32, depth*0.05), interactive:false });
            g.addLayer(rect);
          }
        }
        g.addTo(map); floodLayerRef.current=g;
      }catch{}
    })();
  },[floodLevel,floodPalette,includeSeaDepth,selectedArea?.bounds?.xmin,selectedArea?.bounds?.xmax,selectedArea?.bounds?.ymin,selectedArea?.bounds?.ymax]);

  // Update AOI rectangle on map
  useEffect(() => {
    if (!mapRef.current || !selectedArea) return;
    (async () => {
      const L = (await import("leaflet")).default;
      try {
        if (rectRef.current) mapRef.current.removeLayer(rectRef.current);
        const b = selectedArea.bounds;
        if (!b) return;
        rectRef.current = L.rectangle(
          [[b.ymin, b.xmin],[b.ymax, b.xmax]],
          { color: "#111210", weight: 1.5, fillOpacity: 0.06, dashArray: "4 4", fillColor:"#E63946" }
        ).addTo(mapRef.current);
        rectRef.current.bindTooltip(selectedArea.name || "Selected AOI", { permanent: false });
        mapRef.current.fitBounds(
          [
            [b.ymin, b.xmin],
            [b.ymax, b.xmax],
          ],
          { padding: [24, 24], maxZoom: 14 }
        );
      } catch {}
    })();
  }, [selectedArea]);

  // Handle Layer filter switching
  const handleLayerToggle = (layerName: string) => {
    setCurrentLayerFilter(layerName);
    if (!mapRef.current || !(mapRef.current as any)._floinLayers) return;
    const map = mapRef.current;
    const layers = (map as any)._floinLayers;

    Object.entries(layers).forEach(([name, l]: [string, any]) => {
      if (layerName === "all" || layerName === name || (layerName === "2015" && (name === "hotspots" || name === "inundation"))) {
        if (!map.hasLayer(l)) map.addLayer(l);
      } else {
        if (map.hasLayer(l)) map.removeLayer(l);
      }
    });
  };

  return (
    <div style={{ minWidth:0 }}>
      <div style={{ display:"flex", gap:4, flexWrap:"wrap", marginBottom:8, alignItems:"center", border:"1px solid var(--rule)", background:"var(--paper)", padding:4 }}>
        <span style={{ fontFamily:"var(--font-mono)", fontSize:9, letterSpacing:"0.08em", color:"var(--muted)", padding:"4px 6px", fontWeight:600, flexShrink:0 }}>LAYERS</span>
        <div style={{ display:"flex", gap:4, flexWrap:"wrap", flex:1, minWidth:0 }}>
        {["all", "buildings", "highway", "water", "hotspots", "rainfall", "shelters", "landmarks", "wards"].map((key) => (
          <button
            key={key}
            onClick={() => handleLayerToggle(key)}
            aria-pressed={currentLayerFilter===key}
            style={{ padding:"4px 8px", border:"1px solid", borderColor: currentLayerFilter===key?"var(--ink)":"var(--rule-strong)", background: currentLayerFilter===key?"var(--ink)":"var(--surface)", color: currentLayerFilter===key?"var(--paper)":"var(--muted2)", fontFamily:"var(--font-mono)", fontSize:10, fontWeight:600, letterSpacing:"0.04em", whiteSpace:"nowrap" }}
          >
            {key==="highway"?"ROADS":key==="hotspots"?"2015 HOTSPOTS":key==="water"?"WATER":key==="shelters"?"HOSPITALS":key.toUpperCase()}
          </button>
        ))}
        </div>
        <span ref={countRef} style={{ fontFamily:"var(--font-mono)", fontSize:10, color:"var(--muted)", padding:"0 6px", whiteSpace:"nowrap", flexShrink:0 }}>READY</span>
      </div>
      <div ref={ref} style={{ height: 380, minHeight: 280, overflow:"hidden", border:"1px solid var(--ink)", background:"#F2F0EB" }} />
      <div style={{ display:"flex", justifyContent:"space-between", gap:8, flexWrap:"wrap", fontFamily:"var(--font-mono)", fontSize:9, color:"var(--muted)", marginTop:4, letterSpacing:"0.06em" }}>
        <span>LEAFLET · OSM · EPSG:4326</span><span>CLICK MAP TO RETARGET AOI</span>
      </div>
    </div>
  );
}
