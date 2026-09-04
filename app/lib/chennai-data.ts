export type ScenarioCategory = "Historical 2015" | "Design Storm" | "Climate Extreme" | "Custom";
export type Scenario = { id: string; name: string; P: number; CN: number; duration: number; depth: string; area: string; buildings: number; runoff: number; category: ScenarioCategory; };
export type Area = { id: string; name: string; basin: string; bounds: { xmin: number; xmax: number; ymin: number; ymax: number }; center: [number, number]; lat?: number; lng?: number; };

export const AREAS: Area[] = [
  { id: "all", name: "All Chennai Catchment", basin: "Greater Chennai Basin", bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, center: [80.225, 13.065] },
  { id: "central", name: "Central Chennai (Ripon/Egmore)", basin: "Cooum River Basin", bounds: { xmin: 80.24, xmax: 80.28, ymin: 13.05, ymax: 13.09 }, center: [80.26, 13.07] },
  { id: "adyar", name: "Adyar River Basin (Saidapet)", basin: "Adyar Catchment", bounds: { xmin: 80.18, xmax: 80.28, ymin: 12.98, ymax: 13.03 }, center: [80.23, 13.01] },
  { id: "ennore", name: "Ennore Industrial North", basin: "Kosasthalaiyar Basin", bounds: { xmin: 80.28, xmax: 80.33, ymin: 13.18, ymax: 13.24 }, center: [80.305, 13.21] },
  { id: "velachery", name: "Velachery & Pallikaranai Lowlands", basin: "Kovalam / Marsh Catchment", bounds: { xmin: 80.20, xmax: 80.24, ymin: 12.96, ymax: 13.00 }, center: [80.22, 12.98] },
  { id: "chembarambakkam", name: "Chembarambakkam Reservoir Headwaters", basin: "Upper Adyar Outflow", bounds: { xmin: 80.03, xmax: 80.08, ymin: 12.99, ymax: 13.04 }, center: [80.055, 13.015] },
];

export const CHENNAI_SEARCH_INDEX = [
  { name: "Ripon Building (GCC HQ)", type: "Command Center", basin: "Cooum Basin", coords: [80.2755, 13.0827] as [number, number] },
  { name: "Tidel Park (OMR Tech Corridor)", type: "IT Infrastructure", basin: "Buckingham Canal", coords: [80.2483, 12.9893] as [number, number] },
  { name: "Chennai Central Station", type: "Transit Terminal", basin: "Buckingham Canal", coords: [80.2754, 13.0823] as [number, number] },
  { name: "Saidapet Adyar Crossing", type: "Historical Hotspot", basin: "Adyar Basin", coords: [80.2215, 13.0182] as [number, number] },
  { name: "Anna Salai Arterial Corridor", type: "Road Network", basin: "Cooum Basin", coords: [80.258, 13.055] as [number, number] },
  { name: "Chembarambakkam Reservoir Sluice", type: "Reservoir Outflow", basin: "Upper Adyar", coords: [80.0578, 13.0118] as [number, number] },
  { name: "Poondi Reservoir (Sathyamurthy)", type: "Major Reservoir", basin: "Kosasthalaiyar", coords: [79.8601, 13.1912] as [number, number] },
  { name: "Red Hills / Puzhal Lake", type: "Water Storage", basin: "Puzhal Basin", coords: [80.1745, 13.1856] as [number, number] },
  { name: "Ennore Port & Creek Channel", type: "Coastal Outfall", basin: "Kosasthalaiyar", coords: [80.3245, 13.2312] as [number, number] },
  { name: "Nungambakkam IMD Station", type: "Rainfall Monitoring", basin: "Central Chennai", coords: [80.243, 13.063] as [number, number] },
  { name: "Meenambakkam IMD Station", type: "Rainfall Monitoring", basin: "Adyar Basin", coords: [80.181, 12.994] as [number, number] },
];

export const DATASET_REGISTRY = [
  { id: "buildings", name: "Building Footprints", type: "Vector Polygon", count: "1,811", crs: "EPSG:4326", source: "OpenStreetMap / GCC Survey", confidence: "High" },
  { id: "highway", name: "Road Network", type: "Vector LineString", count: "64", crs: "EPSG:4326", source: "OpenStreetMap Highway", confidence: "High" },
  { id: "waterway", name: "Waterways & Canals", type: "Vector LineString", count: "12", crs: "EPSG:4326", source: "Chennai River Authority", confidence: "High" },
  { id: "hotspots", name: "2015 Flood Hotspots", type: "Vector Points", count: "327", crs: "EPSG:4326", source: "Greater Chennai Corporation (GCC)", confidence: "High (Observed)" },
  { id: "flooded_streets", name: "2015 Flooded Streets", type: "Vector LineString", count: "7,894", crs: "EPSG:4326", source: "GCC 2015 Disaster Assessment", confidence: "High (Observed)" },
  { id: "dem_cop30", name: "Digital Elevation Model (DEM)", type: "Raster 30m", count: "30m Grid", crs: "EPSG:4326", source: "Copernicus / SRTM DEM 30m", confidence: "High" },
  { id: "rainfall_stations", name: "IMD Rainfall Monitoring", type: "Vector Points", count: "8 Stations", crs: "EPSG:4326", source: "India Meteorological Department", confidence: "High" },
];

export const RESERVOIRS = [
  { name: "Chembarambakkam Reservoir", cap: "3,645 Mcft", status: "88% Full", basin: "Adyar Headwaters", outflow: "4,500 cusecs" },
  { name: "Poondi Reservoir (Sathyamurthy)", cap: "3,231 Mcft", status: "76% Full", basin: "Kosasthalaiyar", outflow: "1,200 cusecs" },
  { name: "Red Hills / Puzhal Lake", cap: "3,300 Mcft", status: "82% Full", basin: "Central Drainage", outflow: "Controlled" },
  { name: "Cholavaram Lake", cap: "1,081 Mcft", status: "64% Full", basin: "North Drainage", outflow: "Safe" },
];
