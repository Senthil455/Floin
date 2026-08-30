"use client";
import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";

const CHENNAI_LANDMARKS = [
  { name: "Ripon Building (GCC HQ)", lat: 13.0827, lng: 80.2755, type: "Government Building", risk: "Medium" },
  { name: "Tidel Park (IT Corridor)", lat: 12.9893, lng: 80.2483, type: "Tech Hub", risk: "High" },
  { name: "Chennai Central Station", lat: 13.0823, lng: 80.2754, type: "Transit Hub", risk: "Medium" },
  { name: "Adyar River Estuary", lat: 13.0102, lng: 80.2645, type: "Waterway / Basin", risk: "High" },
  { name: "Marina Beach / Cooum Mouth", lat: 13.0625, lng: 80.2825, type: "Coastal Outfall", risk: "Low" },
  { name: "Chembarambakkam Reservoir", lat: 13.0118, lng: 80.0578, type: "Reservoir Outflow", risk: "Critical" },
  { name: "Ennore Port & Creek", lat: 13.2312, lng: 80.3245, type: "Industrial Coastal", risk: "High" },
];

export default function ChennaiMap({
  selectedArea,
  onSelectArea,
  onSelectFeature,
  aoiSizeKm = 1,
  onMapClick,
  activeLayer = "all",
}: {
  selectedArea?: any;
  onSelectArea?: (a: any) => void;
  onSelectFeature?: (f: any) => void;
  aoiSizeKm?: number;
  onMapClick?: (lat: number, lng: number) => void;
  activeLayer?: string;
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

      const map = L.map(ref.current, { zoomControl: true }).setView([13.08, 80.26], 11);
      (ref.current as any)._leaflet_map = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
        maxZoom: 18,
      }).addTo(map);

      const layers: Record<string, any> = {};
      (map as any)._floinLayers = layers;
      mapRef.current = map;

      // Click listener for AOI creation
      map.on("click", (e: any) => {
        const { lat, lng } = e.latlng;
        if (lng < 80.05 || lng > 80.40 || lat < 12.85 || lat > 13.30) return;

        if (onMapClick) {
          onMapClick(lat, lng);
        } else if (onSelectArea) {
          const delta = (aoiSizeKm || 1) / 111;
          onSelectArea({
            id: `click-${Date.now()}`,
            name: `AOI ${lat.toFixed(3)}, ${lng.toFixed(3)}`,
            bounds: { xmin: lng - delta, xmax: lng + delta, ymin: lat - delta, ymax: lat + delta },
            center: [lng, lat],
            lat,
            lng,
          });
        }
      });

      const colors = {
        buildings: "#8b5cf6",
        highway: "#facc15",
        water: "#06b6d4",
        rainfall: "#38bdf8",
        hotspots: "#ef4444",
        inundation: "#dc2626",
      };

      async function loadGeoJson(name: string, file: string, style: any, pointHandler?: any) {
        try {
          const r = await fetch("/" + file);
          if (!r.ok) return 0;
          const j = await r.json();
          const l = L.geoJSON(j, {
            style,
            pointToLayer: pointHandler,
            onEachFeature: (f: any, ly: any) => {
              ly.on("click", (e: any) => {
                L.DomEvent.stopPropagation(e);
                const props = f.properties || {};
                const nameStr = props.name || props.Location || props.station || props.highway || props.waterway || name;
                onSelectFeature?.({
                  name: nameStr,
                  type: f.geometry.type,
                  properties: props,
                  depth: props.rainfall_mm ? `${(props.rainfall_mm / 120).toFixed(2)}m` : "0.45m",
                });
                const b = (ly as any).getBounds?.();
                if (b && onSelectArea) {
                  const c = b.getCenter();
                  onSelectArea({
                    id: `sel-${Date.now()}`,
                    name: nameStr,
                    bounds: { xmin: b.getWest(), xmax: b.getEast(), ymin: b.getSouth(), ymax: b.getNorth() },
                    center: [c.lng, c.lat],
                  });
                }
              });
              ly.bindPopup(`<b>${f.properties?.name || f.properties?.Location || f.properties?.station || "Chennai Feature"}</b><br><small>${name} • Click to focus</small>`);
            },
          }).addTo(map);
          layers[name] = l;
          return j.features.length;
        } catch {
          return 0;
        }
      }

      const cBld = await loadGeoJson("buildings", "buildings.geojson", { color: colors.buildings, weight: 1, fillOpacity: 0.35 });
      const cRoad = await loadGeoJson("highway", "highway.geojson", { color: colors.highway, weight: 2, fillOpacity: 0.3 });
      const cWater = await loadGeoJson("water", "natural_water.geojson", { color: colors.water, weight: 1.5, fillOpacity: 0.5 });
      
      try {
        const wj = await fetch("/waterway.geojson").then((r) => r.json());
        L.geoJSON(wj, { style: { color: colors.water, weight: 2 } }).addTo(map);
      } catch {}

      // 2015 Hotspots
      const cHot = await loadGeoJson("hotspots", "chennai2015_hotspots.geojson", {}, (f: any, latlng: any) =>
        L.circleMarker(latlng, {
          radius: 6,
          fillColor: colors.hotspots,
          color: "#fff",
          weight: 1.5,
          fillOpacity: 0.9,
        }).bindPopup(`<b>2015 GCC Flood Hotspot</b><br>${f.properties?.Location || "Severe Inundation Point"}`)
      );

      // Rainfall Stations
      const cRain = await loadGeoJson("rainfall", "rainfall_stations.geojson", {}, (f: any, latlng: any) =>
        L.circleMarker(latlng, {
          radius: 7,
          fillColor: colors.rainfall,
          color: "#0f172a",
          weight: 2,
          fillOpacity: 0.85,
        }).bindPopup(`<b>${f.properties?.station} Station</b><br>Rainfall: ${f.properties?.rainfall_mm} mm<br>CN Zone: ${f.properties?.cn_zone}`)
      );

      // Add Landmark Pins Layer
      const landmarkGroup = L.layerGroup();
      CHENNAI_LANDMARKS.forEach((lm) => {
        const marker = L.circleMarker([lm.lat, lm.lng], {
          radius: 8,
          fillColor: lm.risk === "Critical" ? "#dc2626" : lm.risk === "High" ? "#ea580c" : "#0284c7",
          color: "#ffffff",
          weight: 2,
          fillOpacity: 0.95,
        });
        marker.bindPopup(`<b>${lm.name}</b><br><small>${lm.type} • Risk: ${lm.risk}</small><br><button style="margin-top:4px;padding:2px 8px;border-radius:4px;background:#06b6d4;color:#000;border:none;cursor:pointer;font-size:11px">Simulate Here</button>`);
        marker.on("click", () => {
          const delta = (aoiSizeKm || 1) / 111;
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

      const total = cBld + cRoad + cWater + cHot + cRain + CHENNAI_LANDMARKS.length;
      if (countRef.current) countRef.current.textContent = `${total.toLocaleString()} features loaded`;

      setTimeout(() => map.invalidateSize(), 250);
    })();
  }, []);

  // Update AOI rectangle on map
  useEffect(() => {
    if (!mapRef.current || !selectedArea) return;
    (async () => {
      const L = (await import("leaflet")).default;
      try {
        if (rectRef.current) mapRef.current.removeLayer(rectRef.current);
        const b = selectedArea.bounds;
        rectRef.current = L.rectangle(
          [
            [b.ymin, b.xmin],
            [b.ymax, b.xmax],
          ],
          { color: "#06b6d4", weight: 2.5, fillOpacity: 0.12, dashArray: "6 4" }
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
    <div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10, alignItems: "center" }}>
        {["all", "buildings", "highway", "water", "hotspots", "rainfall", "landmarks"].map((key) => (
          <button
            key={key}
            onClick={() => handleLayerToggle(key)}
            className={`px-3 py-1 rounded-full text-xs transition capitalize ${
              currentLayerFilter === key ? "bg-cyan-500 text-black font-bold" : "bg-[#0f1e2e] text-[#8aa0b8] border border-[#1e3a5a] hover:text-white"
            }`}
          >
            {key === "highway" ? "Roads" : key === "hotspots" ? "2015 Hotspots" : key}
          </button>
        ))}
        <span ref={countRef} className="mono" style={{ marginLeft: "auto", fontSize: ".75rem", color: "#8aa0b8" }}>
          Ready
        </span>
      </div>
      <div ref={ref} style={{ height: 400, borderRadius: 14, overflow: "hidden", border: "1px solid #1e3a5a", background: "#08121f" }} />
    </div>
  );
}
