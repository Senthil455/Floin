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
