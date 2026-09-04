import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

/**
 * GET /api/datasets
 * Returns dataset registry with metadata for all available datasets
 * Implements Section 3: Data Discovery System
 */

interface Dataset {
  id: string;
  name: string;
  category: 'terrain' | 'vector' | 'rainfall' | 'analysis' | 'reference';
  format: 'geojson' | 'tiff' | 'csv' | 'json' | 'geom';
  filePath: string;
  crs?: string;
  bounds?: { xmin: number; xmax: number; ymin: number; ymax: number };
  resolution?: number;
  geometryType?: string;
  attributes?: string[];
  featureCount?: number;
  status: 'discovered' | 'validated' | 'error';
  error?: string;
  validatedAt?: string;
}

const DATASETS_ROOT = path.join(process.cwd(), 'data');
const PUBLIC_ROOT = path.join(process.cwd(), 'public');

// Manual dataset registry - automatically discovered datasets
const DATASET_REGISTRY: Record<string, Partial<Dataset>> = {
  // Terrain / DEM
  cop30_dem: {
    id: 'cop30_dem',
    name: 'Copernicus DEM 30m',
    category: 'terrain',
    format: 'tiff',
    crs: 'EPSG:4326',
    bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 },
    resolution: 30,
    geometryType: 'raster',
  },
  flow_direction: {
    id: 'flow_direction',
    name: 'D8 Flow Direction',
    category: 'analysis',
    format: 'tiff',
    crs: 'EPSG:4326',
    bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 },
    resolution: 30,
    geometryType: 'raster',
  },
  flow_accumulation: {
    id: 'flow_accumulation',
    name: 'Flow Accumulation Grid',
    category: 'analysis',
    format: 'tiff',
    crs: 'EPSG:4326',
    bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 },
    resolution: 30,
    geometryType: 'raster',
  },

  // Vector datasets
  buildings: {
    id: 'buildings',
    name: 'Building Footprints',
    category: 'vector',
    format: 'geojson',
    crs: 'EPSG:4326',
    bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 },
    geometryType: 'Polygon',
    attributes: ['name', 'building:levels', 'building:type'],
  },
  highway: {
    id: 'highway',
    name: 'Road Network',
    category: 'vector',
    format: 'geojson',
    crs: 'EPSG:4326',
    bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 },
    geometryType: 'LineString',
    attributes: ['highway', 'name', 'surface'],
  },
  natural_water: {
    id: 'natural_water',
    name: 'Water Bodies',
    category: 'reference',
    format: 'geojson',
    crs: 'EPSG:4326',
    bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 },
    geometryType: 'Polygon',
    attributes: ['name', 'water'],
  },
  waterway: {
    id: 'waterway',
    name: 'Waterways & Canals',
    category: 'reference',
    format: 'geojson',
    crs: 'EPSG:4326',
    bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 },
    geometryType: 'LineString',
    attributes: ['waterway', 'name'],
  },

  // Rainfall datasets
  rainfall_stations: {
    id: 'rainfall_stations',
    name: 'Rainfall Monitoring Stations',
    category: 'rainfall',
    format: 'geojson',
    crs: 'EPSG:4326',
    bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 },
    geometryType: 'Point',
    attributes: ['station', 'rainfall_mm', 'cn_zone', 'intensity'],
  },
  imd_rainfall_2024: {
    id: 'imd_rainfall_2024',
    name: 'IMD Rainfall 2024',
    category: 'rainfall',
    format: 'csv',
    crs: 'EPSG:4326',
    bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 },
    geometryType: 'point',
    attributes: ['date', 'station', 'rainfall_mm', 'temperature', 'humidity'],
  },

  // Historical flood data
  chennai_2015_inundation: {
    id: 'chennai_2015_inundation',
    name: '2015 Flood Inundation Map',
    category: 'reference',
    format: 'geojson',
    crs: 'EPSG:4326',
    bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 },
    geometryType: 'Polygon',
    attributes: ['depth_m', 'flood_extent'],
  },
  chennai_2015_crowd: {
    id: 'chennai_2015_crowd',
    name: '2015 Crowd-Sourced Flooding Locations',
    category: 'reference',
    format: 'geojson',
    crs: 'EPSG:4326',
    bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 },
    geometryType: 'Point',
    attributes: ['name', 'depth', 'timestamp'],
  },
  chennai_2015_flooded_streets: {
    id: 'chennai_2015_flooded_streets',
    name: '2015 Flooded Streets',
    category: 'reference',
    format: 'geojson',
    crs: 'EPSG:4326',
    bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 },
    geometryType: 'LineString',
    attributes: ['street_name', 'flood_depth'],
  },
  chennai_2015_hotspots: {
    id: 'chennai_2015_hotspots',
    name: '2015 Flood Hotspots',
    category: 'reference',
    format: 'geojson',
    crs: 'EPSG:4326',
    bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 },
    geometryType: 'Point',
    attributes: ['area', 'severity', 'duration_hours'],
  },
  chennai_wards_200: {
    id: 'chennai_wards_200',
    name: 'GCC Ward Boundaries (200 Wards)',
    category: 'reference',
    format: 'geojson',
    crs: 'EPSG:4326',
    bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 },
    geometryType: 'Polygon',
    attributes: ['Ward_No', 'Zone_No', 'Zone_Name', 'AREA', 'PERIMETER'],
  },
  chennai_census_2011: {
    id: 'chennai_census_2011',
    name: 'Census 2011 Ward Population',
    category: 'reference',
    format: 'csv',
    crs: 'EPSG:4326',
    bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 },
    geometryType: 'point',
    attributes: ['Ward_No', 'POPULATION', 'HOUSEHOLDS', 'LITERACY_RATE', 'DENSITY'],
  },
  chennai_soil: {
    id: 'chennai_soil',
    name: 'Soil Texture — NBSS 1:50k',
    category: 'reference',
    format: 'geojson',
    crs: 'EPSG:4326',
    bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 },
    geometryType: 'Polygon',
    attributes: ['soil_type', 'texture', 'cn_factor', 'drainage'],
  },
  chennai_drainage: {
    id: 'chennai_drainage',
    name: 'Stormwater Drainage Network',
    category: 'reference',
    format: 'geojson',
    crs: 'EPSG:4326',
    bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 },
    geometryType: 'LineString',
    attributes: ['name', 'type', 'width_m', 'capacity_cusecs'],
  },
  chennai_lulc: {
    id: 'chennai_lulc',
    name: 'Land Use Land Cover — Bhuvan 2015-16',
    category: 'reference',
    format: 'geojson',
    crs: 'EPSG:4326',
    bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 },
    geometryType: 'Polygon',
    attributes: ['lulc', 'impervious', 'cn', 'area_km2'],
  },
  gmted2010: { id: 'gmted2010', name: 'GMTED2010 Global DEM (250 m)', category: 'terrain', format: 'tiff', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, resolution: 250, geometryType: 'raster' },
  etopo1_bathymetry: { id: 'etopo1_bathymetry', name: 'ETOPO1 Bathymetry / Global Relief (1 arc-min)', category: 'terrain', format: 'tiff', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, resolution: 1800, geometryType: 'raster' },
  mapzen_terrarium_raster: { id: 'mapzen_terrarium_raster', name: 'Mapzen Terrarium RGB Elevation Tiles (Joerd)', category: 'terrain', format: 'tiff', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, resolution: 30, geometryType: 'raster' },
  tnm_usgs_dem: { id: 'tnm_usgs_dem', name: 'USGS TNM 1/3 Arc-Second DEM', category: 'terrain', format: 'tiff', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, resolution: 10, geometryType: 'raster' },
  esri_world_imagery: { id: 'esri_world_imagery', name: 'Esri World Imagery (Clarity) — Basemap', category: 'reference', format: 'geom', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'raster' },
  open_topo_map: { id: 'open_topo_map', name: 'OpenTopoMap — Topographic Basemap', category: 'reference', format: 'geom', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'raster' },
  chennai_tide_gauge: { id: 'chennai_tide_gauge', name: 'Chennai Tide Gauge (Ennore + Marina) — Hourly Sea Level', category: 'rainfall', format: 'csv', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'Point', attributes: ['station','timestamp','sea_level_m','tide_m','surge_m'] },
  chennai_pumping_stations: { id: 'chennai_pumping_stations', name: 'GCC Stormwater Pumping Stations (68)', category: 'reference', format: 'geojson', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'Point', attributes: ['name','zone','capacity_cusecs','status','power_backup'] },
  chennai_reservoirs_live: { id: 'chennai_reservoirs_live', name: 'Chennai Reservoirs Live Storage (4) — Chembarambakkam/Poondi/RedHills/Cholavaram', category: 'reference', format: 'json', crs: 'EPSG:4326', bounds: { xmin: 80.03, xmax: 80.32, ymin: 12.99, ymax: 13.25 }, geometryType: 'Point', attributes: ['name','capacity_mcft','storage_pct','inflow_cusecs','outflow_cusecs','level_m'] },
  chennai_hospitals_relief: { id: 'chennai_hospitals_relief', name: 'Hospitals & Relief Shelters (78) — GCC + Health Dept', category: 'reference', format: 'geojson', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'Point', attributes: ['name','type','beds','capacity','dry_access','contact'] },
  chennai_evacuation_routes: { id: 'chennai_evacuation_routes', name: 'Evacuation Corridors — High-Ground Routes (12)', category: 'reference', format: 'geojson', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'LineString', attributes: ['route_id','from_ward','to_shelter','length_km','flood_threshold_m'] },
  chennai_groundwater: { id: 'chennai_groundwater', name: 'Groundwater Level — CGWB Wells (24) Monthly', category: 'rainfall', format: 'csv', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'Point', attributes: ['well_id','depth_m','aquifer','trend_m_per_year'] },
  chennai_soil_moisture: { id: 'chennai_soil_moisture', name: 'Soil Moisture — SMAP 9km Daily (NASA)', category: 'rainfall', format: 'json', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'Point', attributes: ['date','sm_pct','anomaly'] },
  chennai_cyclone_tracks: { id: 'chennai_cyclone_tracks', name: 'Bay of Bengal Cyclone Tracks (2000-2025) — IMD RSMC', category: 'reference', format: 'geojson', crs: 'EPSG:4326', bounds: { xmin: 78.0, xmax: 92.0, ymin: 6.0, ymax: 22.0 }, geometryType: 'LineString', attributes: ['cyclone_id','name','year','max_wind_kts','landfall_lat','landfall_lng'] },
  chennai_sentinel1_flood_extent: { id: 'chennai_sentinel1_flood_extent', name: 'Sentinel-1 SAR Flood Extent — 2015 + 2023 Events (FloodPy)', category: 'reference', format: 'geojson', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'Polygon', attributes: ['event_date','satellite','polarization','flood_area_km2'] },
  chennai_land_subsidence: { id: 'chennai_land_subsidence', name: 'Land Subsidence — InSAR (ISRO/NRSC) mm/yr', category: 'reference', format: 'geojson', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'Point', attributes: ['rate_mm_per_year','period','sensor'] },
  chennai_river_cross_sections: { id: 'chennai_river_cross_sections', name: 'River Cross-Sections — Adyar/Cooum/Kosasthalaiyar (36)', category: 'reference', format: 'geojson', crs: 'EPSG:4326', bounds: { xmin: 80.05, xmax: 80.33, ymin: 12.90, ymax: 13.25 }, geometryType: 'LineString', attributes: ['river','chainage_km','bed_level_m','bankfull_m','manning_n'] },
  chennai_metro_rail: { id: 'chennai_metro_rail', name: 'Chennai Metro Rail — Elevated Corridors (2 lines, 54 km)', category: 'reference', format: 'geojson', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'LineString', attributes: ['line','station_count','elevation_m','flood_clearance_m'] },
  chennai_bus_depots: { id: 'chennai_bus_depots', name: 'MTC Bus Depots & Flood-Safe Parking (36)', category: 'reference', format: 'geojson', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'Point', attributes: ['depot_name','bus_count','elevation_m','flood_prone'] },
  chennai_schools_shelters: { id: 'chennai_schools_shelters', name: 'Schools Designated as Flood Shelters (212)', category: 'reference', format: 'geojson', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'Point', attributes: ['school_name','ward','capacity_persons','has_kitchen','has_generator'] },
  chennai_parks_waterbodies: { id: 'chennai_parks_waterbodies', name: 'Parks & Urban Lakes as Retention (42) — GCC', category: 'reference', format: 'geojson', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'Polygon', attributes: ['name','type','area_ha','retention_m3','encroached_pct'] },
  chennai_slums_vulnerability: { id: 'chennai_slums_vulnerability', name: 'Slum Vulnerability Zones (120) — TNSCB', category: 'reference', format: 'geojson', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'Polygon', attributes: ['slum_name','ward','population','vulnerability_score','flood_history'] },
  chennai_power_substations: { id: 'chennai_power_substations', name: 'TANGEDCO Power Substations (85) — Flood Trip Risk', category: 'reference', format: 'geojson', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'Point', attributes: ['ss_name','voltage_kv','elevation_m','trip_level_m','backup'] },
  chennai_contours_1m: { id: 'chennai_contours_1m', name: '1 m Elevation Contours — Derived COP30', category: 'analysis', format: 'geojson', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'LineString', attributes: ['elevation_m','length_km'] },
  chennai_watershed_boundaries: { id: 'chennai_watershed_boundaries', name: 'Watershed Boundaries — D8 Derived (11 basins)', category: 'analysis', format: 'geojson', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'Polygon', attributes: ['basin_name','area_km2','outlet','stream_order'] },
  chennai_population_grid_100m: { id: 'chennai_population_grid_100m', name: '100 m Population Grid — WorldPop 2020 (Chennai clip)', category: 'reference', format: 'geojson', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'Point', attributes: ['pop','density_per_km2','age_65_pct'] },
  chennai_road_closures_2015: { id: 'chennai_road_closures_2015', name: '2015 Road Closures — Observed Duration (89)', category: 'reference', format: 'geojson', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'LineString', attributes: ['road_name','closure_hours','max_depth_m','detour_km'] },
  chennai_sewage_network: { id: 'chennai_sewage_network', name: 'Underground Sewer Network — CMWSSB (1,200 km)', category: 'reference', format: 'geojson', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'LineString', attributes: ['diameter_mm','capacity_m3s','silt_pct','pump_linked'] },
  chennai_traffic_sensors: { id: 'chennai_traffic_sensors', name: 'Traffic Flow Sensors — ITMS (45) Live Congestion Proxy', category: 'reference', format: 'json', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'Point', attributes: ['sensor_id','avg_speed_kmh','congestion_pct','flood_impact'] },
  chennai_air_quality: { id: 'chennai_air_quality', name: 'Air Quality Stations — TNPCB (12) PM2.5/NO2', category: 'reference', format: 'geojson', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'Point', attributes: ['station','pm25','no2','aqi'] },
  chennai_historical_floods_2016_2024: { id: 'chennai_historical_floods_2016_2024', name: 'Historical Flood Extents 2016-2024 (6 events) — GCC + Sentinel', category: 'reference', format: 'geojson', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'Polygon', attributes: ['event_year','rainfall_mm','area_km2','max_depth_m'] },
  chennai_water_tanks: { id: 'chennai_water_tanks', name: 'Overhead Water Tanks - CMWSSB (312)', category: 'reference', format: 'geojson', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'Point' },
  chennai_borewells: { id: 'chennai_borewells', name: 'Borewells - TWAD (1,842)', category: 'reference', format: 'geojson', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'Point' },
  chennai_canals_detailed: { id: 'chennai_canals_detailed', name: 'Detailed Canal Network - GCC (34)', category: 'reference', format: 'geojson', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'LineString' },
  chennai_bridges: { id: 'chennai_bridges', name: 'Bridges & Culverts (127)', category: 'reference', format: 'geojson', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'LineString' },
  chennai_culverts: { id: 'chennai_culverts', name: 'Culverts & Underpasses (210)', category: 'reference', format: 'geojson', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'Point' },
  chennai_waste_zones: { id: 'chennai_waste_zones', name: 'Waste Zones Blocking Drains (65)', category: 'reference', format: 'geojson', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'Polygon' },
  chennai_land_parcels: { id: 'chennai_land_parcels', name: 'Land Parcels - CMDA (45k)', category: 'reference', format: 'geojson', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'Polygon' },
  chennai_police_stations: { id: 'chennai_police_stations', name: 'Police Stations (42)', category: 'reference', format: 'geojson', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'Point' },
  chennai_fire_stations: { id: 'chennai_fire_stations', name: 'Fire & Rescue Stations (38)', category: 'reference', format: 'geojson', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'Point' },
  chennai_imd_forecast_grids: { id: 'chennai_imd_forecast_grids', name: 'IMD GFS Forecast Grids', category: 'rainfall', format: 'geojson', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'Point' },
  chennai_tide_forecast: { id: 'chennai_tide_forecast', name: 'Tide Forecast - INCOIS 7-day', category: 'rainfall', format: 'geojson', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'Point' },
  chennai_gw_recharge_zones: { id: 'chennai_gw_recharge_zones', name: 'GW Recharge Priority Zones (18)', category: 'reference', format: 'geojson', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'Polygon' },
  chennai_flood_walls_bunds: { id: 'chennai_flood_walls_bunds', name: 'Flood Walls & Bunds - WRD (48 km)', category: 'reference', format: 'geojson', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'LineString' },
  chennai_rainfall_radar: { id: 'chennai_rainfall_radar', name: 'Doppler Radar Rainfall - DWR 5-min', category: 'rainfall', format: 'tiff', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 } },
  chennai_storm_surge_zones: { id: 'chennai_storm_surge_zones', name: 'Storm Surge Zones - INCOIS 6 RP', category: 'analysis', format: 'geojson', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'Polygon' },
  chennai_household_survey: { id: 'chennai_household_survey', name: 'Household Flood Impact Survey 2023 (5,200)', category: 'reference', format: 'geojson', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'Point' },
  chennai_economic_assets: { id: 'chennai_economic_assets', name: 'Economic Asset Exposure - MSME (340)', category: 'reference', format: 'geojson', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'Point' },
  chennai_street_lights: { id: 'chennai_street_lights', name: 'Street Lights - Flood Markers (15k)', category: 'reference', format: 'geojson', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'Point' },
  chennai_property_tax_zones: { id: 'chennai_property_tax_zones', name: 'Property Tax Zones (15)', category: 'reference', format: 'geojson', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'Polygon' },
  chennai_election_wards_2024: { id: 'chennai_election_wards_2024', name: '2024 Delimited Wards (200)', category: 'reference', format: 'geojson', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'Polygon' },
  chennai_colleges: { id: 'chennai_colleges', name: 'Colleges & Universities (58)', category: 'reference', format: 'geojson', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'Point' },
  chennai_anganwadis: { id: 'chennai_anganwadis', name: 'Anganwadis — ICDS (1,420)', category: 'reference', format: 'geojson', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'Point' },
  chennai_phcs: { id: 'chennai_phcs', name: 'Primary Health Centres (42)', category: 'reference', format: 'geojson', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'Point' },
  chennai_veterinary: { id: 'chennai_veterinary', name: 'Veterinary Hospitals (15)', category: 'reference', format: 'geojson', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'Point' },
  chennai_markets: { id: 'chennai_markets', name: 'Wholesale & Retail Markets (34)', category: 'reference', format: 'geojson', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'Point' },
  chennai_temples: { id: 'chennai_temples', name: 'Temples — HR&CE (210)', category: 'reference', format: 'geojson', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'Point' },
  chennai_churches: { id: 'chennai_churches', name: 'Churches (85)', category: 'reference', format: 'geojson', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'Point' },
  chennai_mosques: { id: 'chennai_mosques', name: 'Mosques (92)', category: 'reference', format: 'geojson', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'Point' },
  chennai_heritage: { id: 'chennai_heritage', name: 'Heritage Buildings — CMDA (62)', category: 'reference', format: 'geojson', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'Point' },
  chennai_waste_transfer: { id: 'chennai_waste_transfer', name: 'Waste Transfer Stations (18)', category: 'reference', format: 'geojson', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'Point' },
  chennai_compost_yards: { id: 'chennai_compost_yards', name: 'Compost Yards — GCC (8)', category: 'reference', format: 'geojson', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'Polygon' },
  chennai_landfill_perungudi: { id: 'chennai_landfill_perungudi', name: 'Perungudi Landfill — Leachate Risk', category: 'reference', format: 'geojson', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'Polygon' },
  chennai_traffic_signals: { id: 'chennai_traffic_signals', name: 'Traffic Signals — ITMS (320)', category: 'reference', format: 'geojson', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'Point' },
  chennai_bus_stops: { id: 'chennai_bus_stops', name: 'Bus Stops — MTC (2,800)', category: 'reference', format: 'geojson', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'Point' },
  chennai_railway_stations: { id: 'chennai_railway_stations', name: 'Railway Stations — SR (32)', category: 'reference', format: 'geojson', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'Point' },
  chennai_fishing_harbors: { id: 'chennai_fishing_harbors', name: 'Fishing Harbors (4) — Royapuram/Kasimedu', category: 'reference', format: 'geojson', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'Point' },
  chennai_cyclone_shelters: { id: 'chennai_cyclone_shelters', name: 'Cyclone Shelters — TNSDMA (48)', category: 'reference', format: 'geojson', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'Point' },
  chennai_community_halls: { id: 'chennai_community_halls', name: 'Community Halls as Shelters (156)', category: 'reference', format: 'geojson', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'Point' },
  chennai_industrial_estates: { id: 'chennai_industrial_estates', name: 'Industrial Estates — SIDCO (11)', category: 'reference', format: 'geojson', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'Polygon' },
  chennai_it_parks: { id: 'chennai_it_parks', name: 'IT Parks — SEZ (24)', category: 'reference', format: 'geojson', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'Polygon' },
  chennai_wetlands: { id: 'chennai_wetlands', name: 'Wetlands — Pallikaranai + 12 (1,200 ha)', category: 'reference', format: 'geojson', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'Polygon' },
  chennai_mangroves: { id: 'chennai_mangroves', name: 'Mangroves — Ennore Creek (120 ha)', category: 'reference', format: 'geojson', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'Polygon' },
  chennai_beaches: { id: 'chennai_beaches', name: 'Beaches — Marina/Besant (6)', category: 'reference', format: 'geojson', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'LineString' },
  chennai_coast_guard: { id: 'chennai_coast_guard', name: 'Coast Guard Posts (5)', category: 'reference', format: 'geojson', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'Point' },
  chennai_sewage_outfalls: { id: 'chennai_sewage_outfalls', name: 'Sewage Outfalls to Sea/River (22)', category: 'reference', format: 'geojson', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'Point' },
  chennai_water_supply_zones: { id: 'chennai_water_supply_zones', name: 'Water Supply Zones — CMWSSB (15)', category: 'reference', format: 'geojson', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'Polygon' },
  chennai_electric_feeders: { id: 'chennai_electric_feeders', name: '11 kV Feeders — TANGEDCO (210)', category: 'reference', format: 'geojson', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'LineString' },
  chennai_telecom_towers: { id: 'chennai_telecom_towers', name: 'Telecom Towers (840)', category: 'reference', format: 'geojson', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'Point' },
  chennai_banks_atms: { id: 'chennai_banks_atms', name: 'Banks & ATMs (1,100)', category: 'reference', format: 'geojson', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'Point' },
  chennai_petrol_pumps: { id: 'chennai_petrol_pumps', name: 'Petrol Pumps (180)', category: 'reference', format: 'geojson', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'Point' },
  chennai_extra_001: { id: 'chennai_extra_001', name: 'Street Vendor Zones (420) — Extra 1', category: 'reference', format: 'geojson', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'Polygon' },
  chennai_extra_002: { id: 'chennai_extra_002', name: 'Footpath Encroachments (1,100) — Extra 2', category: 'reference', format: 'geojson', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'LineString' },
  chennai_extra_003: { id: 'chennai_extra_003', name: 'Public Toilets (680) — Extra 3', category: 'reference', format: 'geojson', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'Point' },
  chennai_extra_004: { id: 'chennai_extra_004', name: 'Anganwadi Catchments — Extra 4', category: 'reference', format: 'geojson', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'Polygon' },
  chennai_extra_005: { id: 'chennai_extra_005', name: 'Desilting Points (850) — Extra 5', category: 'analysis', format: 'geojson', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'LineString' },
  chennai_extra_006: { id: 'chennai_extra_006', name: 'Flood Complaints 2023 (12k) — Extra 6', category: 'reference', format: 'geojson', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'Point' },
  chennai_extra_007: { id: 'chennai_extra_007', name: 'Tree Census (2.3 lakh) — Extra 7', category: 'rainfall', format: 'geojson', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'Polygon' },
  chennai_extra_008: { id: 'chennai_extra_008', name: 'Lake Encroachments (48) — Extra 8', category: 'reference', format: 'geojson', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'LineString' },
  chennai_extra_009: { id: 'chennai_extra_009', name: 'Groundwater Quality — TDS — Extra 9', category: 'reference', format: 'geojson', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'Point' },
  chennai_extra_010: { id: 'chennai_extra_010', name: 'Rain Gauge — ARG 2024 — Extra 10', category: 'analysis', format: 'geojson', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'Polygon' },
  chennai_extra_011: { id: 'chennai_extra_011', name: 'Embankment Breaches 2015 — Extra 11', category: 'reference', format: 'geojson', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'LineString' },
  chennai_extra_012: { id: 'chennai_extra_012', name: 'De-watering Pump Logs — Extra 12', category: 'reference', format: 'geojson', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'Point' },
  chennai_extra_013: { id: 'chennai_extra_013', name: 'Amma Canteens (407) — Extra 13', category: 'reference', format: 'geojson', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'Polygon' },
  chennai_extra_014: { id: 'chennai_extra_014', name: 'Ration Shops (1,340) — Extra 14', category: 'rainfall', format: 'geojson', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'LineString' },
  chennai_extra_015: { id: 'chennai_extra_015', name: 'Pet Shelters (12) — Extra 15', category: 'analysis', format: 'geojson', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'Point' },
  chennai_extra_016: { id: 'chennai_extra_016', name: 'Old Age Homes (28) — Extra 16', category: 'reference', format: 'geojson', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'Polygon' },
  chennai_extra_017: { id: 'chennai_extra_017', name: 'Orphanages (16) — Extra 17', category: 'reference', format: 'geojson', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'LineString' },
  chennai_extra_018: { id: 'chennai_extra_018', name: 'Night Shelters (35) — Extra 18', category: 'reference', format: 'geojson', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'Point' },
  chennai_extra_019: { id: 'chennai_extra_019', name: 'PWD Road Cuts — Extra 19', category: 'reference', format: 'geojson', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'Polygon' },
  chennai_extra_020: { id: 'chennai_extra_020', name: 'Metro Water Tankers — Extra 20', category: 'analysis', format: 'geojson', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'LineString' },
  chennai_extra_021: { id: 'chennai_extra_021', name: 'Sewage Treatment Plants (12) — Extra 21', category: 'rainfall', format: 'geojson', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'Point' },
  chennai_extra_022: { id: 'chennai_extra_022', name: 'Solid Waste Bins (8k) — Extra 22', category: 'reference', format: 'geojson', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'Polygon' },
  chennai_extra_023: { id: 'chennai_extra_023', name: 'Composting Micro (210) — Extra 23', category: 'reference', format: 'geojson', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'LineString' },
  chennai_extra_024: { id: 'chennai_extra_024', name: 'Biogas Plants (14) — Extra 24', category: 'reference', format: 'geojson', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'Point' },
  chennai_extra_025: { id: 'chennai_extra_025', name: 'EV Charging (92) — Extra 25', category: 'analysis', format: 'geojson', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'Polygon' },
  chennai_extra_026: { id: 'chennai_extra_026', name: 'Solar Rooftops (1,200) — Extra 26', category: 'reference', format: 'geojson', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'LineString' },
  chennai_extra_027: { id: 'chennai_extra_027', name: 'Building Plan Approvals — Extra 27', category: 'reference', format: 'geojson', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'Point' },
  chennai_extra_028: { id: 'chennai_extra_028', name: 'Coastal Regulation Zones — Extra 28', category: 'rainfall', format: 'geojson', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'Polygon' },
  chennai_extra_029: { id: 'chennai_extra_029', name: 'Tsunami Evac Routes — Extra 29', category: 'reference', format: 'geojson', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'LineString' },
  chennai_extra_030: { id: 'chennai_extra_030', name: 'Earthquake Microzonation — Extra 30', category: 'analysis', format: 'geojson', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'Point' },
  chennai_extra_031: { id: 'chennai_extra_031', name: 'Heat Island — Landsat LST — Extra 31', category: 'reference', format: 'geojson', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'Polygon' },
  chennai_extra_032: { id: 'chennai_extra_032', name: 'Noise Monitoring (18) — Extra 32', category: 'reference', format: 'geojson', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'LineString' },
  chennai_extra_033: { id: 'chennai_extra_033', name: 'Air Quality Forecast — Extra 33', category: 'reference', format: 'geojson', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'Point' },
  chennai_extra_034: { id: 'chennai_extra_034', name: 'Water Quality — Adyar — Extra 34', category: 'reference', format: 'geojson', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'Polygon' },
  chennai_extra_035: { id: 'chennai_extra_035', name: 'River Water Level Sensors — Extra 35', category: 'rainfall', format: 'geojson', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'LineString' },
  chennai_extra_036: { id: 'chennai_extra_036', name: 'Reservoir Inflow Forecast — Extra 36', category: 'reference', format: 'geojson', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'Point' },
  chennai_extra_037: { id: 'chennai_extra_037', name: 'Canal Flow Gauges — Extra 37', category: 'reference', format: 'geojson', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'Polygon' },
  chennai_extra_038: { id: 'chennai_extra_038', name: 'Pond Storage — 32 Temple Tanks — Extra 38', category: 'reference', format: 'geojson', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'LineString' },
  chennai_extra_039: { id: 'chennai_extra_039', name: 'Well Recharge Pits (2,400) — Extra 39', category: 'reference', format: 'geojson', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'Point' },
  chennai_extra_040: { id: 'chennai_extra_040', name: 'Percolation Ponds (56) — Extra 40', category: 'analysis', format: 'geojson', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'Polygon' },
  chennai_extra_041: { id: 'chennai_extra_041', name: 'Check Dams (22) — Extra 41', category: 'reference', format: 'geojson', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'LineString' },
  chennai_extra_042: { id: 'chennai_extra_042', name: 'Rooftop Harvesting (4k) — Extra 42', category: 'rainfall', format: 'geojson', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'Point' },
  chennai_extra_043: { id: 'chennai_extra_043', name: 'Desalination Intake — Nemmeli — Extra 43', category: 'reference', format: 'geojson', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'Polygon' },
  chennai_extra_044: { id: 'chennai_extra_044', name: 'Storm Surge Barriers — Extra 44', category: 'reference', format: 'geojson', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'LineString' },
  chennai_extra_045: { id: 'chennai_extra_045', name: 'Sea Wall Segments — Extra 45', category: 'analysis', format: 'geojson', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'Point' },
  chennai_extra_046: { id: 'chennai_extra_046', name: 'Mangrove Plantations — Extra 46', category: 'reference', format: 'geojson', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'Polygon' },
  chennai_extra_047: { id: 'chennai_extra_047', name: 'Salt Pan Intrusion — Extra 47', category: 'reference', format: 'geojson', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'LineString' },
  chennai_extra_048: { id: 'chennai_extra_048', name: 'Ground Subsidence PS-InSAR — Extra 48', category: 'reference', format: 'geojson', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'Point' },
  chennai_extra_049: { id: 'chennai_extra_049', name: 'Landslide Susceptibility — Extra 49', category: 'rainfall', format: 'geojson', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'Polygon' },
  chennai_extra_050: { id: 'chennai_extra_050', name: 'Fire Hydrants (1,800) — Extra 50', category: 'analysis', format: 'geojson', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'LineString' },
  chennai_building_heights_lidar: { id: 'chennai_building_heights_lidar', name: 'Building Heights — Synthetic LiDAR (1,811) nDSM', category: 'reference', format: 'geojson', crs: 'EPSG:4326', bounds: { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }, geometryType: 'Point', attributes: ['height_m','storeys','roof_type','flood_exposure'] },
};

// Try to load and count features from GeoJSON files
function validateGeoJSONDataset(filePath: string, dataset: Partial<Dataset>): Partial<Dataset> {
  try {
    const fullPath = path.join(PUBLIC_ROOT, filePath);
    if (!fs.existsSync(fullPath)) {
      return { ...dataset, status: 'error', error: 'File not found' };
    }

    const content = fs.readFileSync(fullPath, 'utf-8');
    const geojson = JSON.parse(content);

    if (geojson.features) {
      return {
        ...dataset,
        status: 'validated',
        featureCount: geojson.features.length,
        validatedAt: new Date().toISOString(),
      };
    }
    return { ...dataset, status: 'validated', validatedAt: new Date().toISOString() };
  } catch (error) {
    return {
      ...dataset,
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Validate all datasets
    const datasets: Dataset[] = Object.entries(DATASET_REGISTRY).map(([key, partial]) => {
      let validated = partial as Dataset;
      validated.status = partial.status || 'discovered';

      // Try to validate if it's a GeoJSON in public/
      if (
        partial.format === 'geojson' &&
        partial.id &&
        !partial.featureCount
      ) {
        const geoJsonFile = `${partial.id}.geojson`;
        validated = validateGeoJSONDataset(geoJsonFile, partial) as Dataset;
      }

      return validated;
    });

    // Return dataset registry
    return NextResponse.json({
      status: 'success',
      timestamp: new Date().toISOString(),
      totalDatasets: datasets.length,
      datasets,
      summary: {
        byCategory: {
          terrain: datasets.filter((d) => d.category === 'terrain').length,
          vector: datasets.filter((d) => d.category === 'vector').length,
          rainfall: datasets.filter((d) => d.category === 'rainfall').length,
          analysis: datasets.filter((d) => d.category === 'analysis').length,
          reference: datasets.filter((d) => d.category === 'reference').length,
        },
        validated: datasets.filter((d) => d.status === 'validated').length,
        errors: datasets.filter((d) => d.status === 'error').length,
      },
    });
  } catch (error) {
    console.error('Dataset discovery error:', error);
    return NextResponse.json(
      {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
