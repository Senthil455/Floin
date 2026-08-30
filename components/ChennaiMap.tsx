"use client";
import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

export default function ChennaiMap() {
  const ref = useRef<HTMLDivElement>(null);
  const countRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    if ((ref.current as any)._leaflet_map) return;

    const map = L.map(ref.current, { zoomControl: true }).setView([13.08, 80.27], 11);
    (ref.current as any)._leaflet_map = map;
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "OpenStreetMap",
      maxZoom: 18,
    }).addTo(map);

    const layers: Record<string, L.Layer> = {};
    const colors = { buildings: "#8b5cf6", highway: "#facc15", water: "#06b6d4", rainfall: "#ef4444" };

    async function load(name: string, file: string, style: any) {
      try {
        const r = await fetch("/" + file);
        if (!r.ok) throw new Error(file);
        const j = await r.json();
        const l = L.geoJSON(j, {
          style,
          onEachFeature: (f: any, ly: any) =>
            ly.bindPopup(
              `<b>${f.properties?.name || f.properties?.highway || f.properties?.waterway || f.properties?.station || "feature"}</b><br><small>${f.geometry.type}</small>`
            ),
        }).addTo(map);
        layers[name] = l;
        return j.features.length;
      } catch {
        return 0;
      }
    }

    (async () => {
      const c1 = await load("buildings", "buildings.geojson", { color: colors.buildings, weight: 1, fillOpacity: 0.35 });
      const c2 = await load("highway", "highway.geojson", { color: colors.highway, weight: 2, fillOpacity: 0.2 });
      const c3 = await load("water", "natural_water.geojson", { color: colors.water, weight: 1, fillOpacity: 0.4 });
      try {
        const w = await fetch("/waterway.geojson").then((r) => r.json());
        L.geoJSON(w, { style: { color: colors.water, weight: 2 } }).addTo(map);
      } catch {}
      let c4 = 0;
      try {
        const rj = await fetch("/rainfall_stations.geojson").then((r) => r.json());
        const rl = L.geoJSON(rj, {
          pointToLayer: (f: any, latlng: any) =>
            L.circleMarker(latlng, {
              radius: 6 + f.properties.rainfall_mm / 40,
              fillColor: colors.rainfall,
              color: "#fff",
              weight: 1,
              fillOpacity: 0.85,
            }).bindPopup(`<b>${f.properties.station}</b><br>${f.properties.rainfall_mm} mm - CN ${f.properties.cn_zone}<br><small>${f.properties.intensity}</small>`),
        }).addTo(map);
        layers.rainfall = rl;
        c4 = rj.features.length;
      } catch {}
      const total = c1 + c2 + c3 + c4;
      if (countRef.current) countRef.current.textContent = total.toLocaleString() + " features";
      setTimeout(() => map.invalidateSize(), 200);

      document.querySelectorAll("[data-layer]").forEach((btn) => {
        btn.addEventListener("click", () => {
          document.querySelectorAll("[data-layer]").forEach((b) => {
            b.className = "btn btn-ghost";
            b.setAttribute("aria-pressed", "false");
          });
          btn.className = "btn btn-primary";
          btn.setAttribute("aria-pressed", "true");
          const k = (btn as HTMLElement).dataset.layer!;
          Object.entries(layers).forEach(([name, l]) => {
            if (k === "all" || k === name) {
              if (!(map as any).hasLayer(l)) map.addLayer(l as any);
            } else if ((map as any).hasLayer(l)) map.removeLayer(l as any);
          });
          const counts: any = { buildings: c1, highway: c2, water: c3, rainfall: c4, all: total };
          if (countRef.current) countRef.current.textContent = (counts[k] ?? total).toLocaleString() + " features";
        });
      });
    })();
  }, []);

  return (
    <>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
        <button className="btn btn-primary" data-layer="buildings" style={{ padding: "7px 12px", fontSize: ".78rem" }} aria-pressed="true">Buildings</button>
        <button className="btn btn-ghost" data-layer="highway" style={{ padding: "7px 12px", fontSize: ".78rem" }} aria-pressed="false">Roads</button>
        <button className="btn btn-ghost" data-layer="water" style={{ padding: "7px 12px", fontSize: ".78rem" }} aria-pressed="false">Water</button>
        <button className="btn btn-ghost" data-layer="rainfall" style={{ padding: "7px 12px", fontSize: ".78rem" }} aria-pressed="false">Rainfall</button>
        <button className="btn btn-ghost" data-layer="all" style={{ padding: "7px 12px", fontSize: ".78rem" }} aria-pressed="false">All</button>
        <span ref={countRef} className="mono" style={{ marginLeft: "auto", alignSelf: "center" }}>1,811 features</span>
      </div>
      <div ref={ref} style={{ height: 380, borderRadius: 12, overflow: "hidden", border: "1px solid #1e3a5a", background: "#08121f" }} />
    </>
  );
}
