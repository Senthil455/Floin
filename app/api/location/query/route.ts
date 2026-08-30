import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

/**
 * POST /api/location/query
 * Queries location-specific data for an Area of Interest
 * Implements Sections 11-14: Location-Specific Data Queries
 */

interface AOI {
  id: string;
  center: [number, number]; // [lng, lat]
  bounds: {
    xmin: number;
    xmax: number;
    ymin: number;
    ymax: number;
  };
}

interface LocationQueryResponse {
  requestId: string;
  aoi: AOI;
  timestamp: string;
  datasets: {
    id: string;
    name: string;
    covers: boolean;
    featureCount: number;
  }[];
  summary: {
    buildings: number;
    roads: number;
    waterways: number;
    rainStations: number;
    flooded2015: number;
    hotspots: number;
  };
}

// Helper: check if point/geometry is within AOI bounds
function isInBounds(
  lng: number,
  lat: number,
  bounds: AOI['bounds']
): boolean {
  return (
    lng >= bounds.xmin &&
    lng <= bounds.xmax &&
    lat >= bounds.ymin &&
    lat <= bounds.ymax
  );
}

// Helper: check if geometry coordinates intersect AOI bounds
function geometryIntersectsBounds(
  coordinates: any,
  geometryType: string,
  bounds: AOI['bounds']
): boolean {
  if (geometryType === 'Point') {
    return isInBounds(coordinates[0], coordinates[1], bounds);
  }

  if (geometryType === 'LineString' || geometryType === 'MultiLineString') {
    const coords =
      geometryType === 'LineString' ? coordinates : coordinates.flat(1);
    return coords.some(
      (c: any) =>
        Array.isArray(c) && c.length >= 2 && isInBounds(c[0], c[1], bounds)
    );
  }

  if (geometryType === 'Polygon' || geometryType === 'MultiPolygon') {
    const rings =
      geometryType === 'Polygon'
        ? [coordinates[0]]
        : coordinates.map((p: any) => p[0]);
    return rings.some((ring: any) =>
      ring.some(
        (c: any) =>
          Array.isArray(c) && c.length >= 2 && isInBounds(c[0], c[1], bounds)
      )
    );
  }

  return false;
}

// Load and filter GeoJSON features for AOI
async function queryGeoJSONForAOI(
  filename: string,
  aoi: AOI
): Promise<{ count: number; features: any[] }> {
  try {
    const filePath = path.join(process.cwd(), 'public', `${filename}.geojson`);
    if (!fs.existsSync(filePath)) {
      return { count: 0, features: [] };
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const geojson = JSON.parse(content);
    const features = geojson.features || [];

    const filtered = features.filter((f: any) => {
      const geom = f.geometry;
      if (!geom) return false;
      return geometryIntersectsBounds(
        geom.coordinates,
        geom.type,
        aoi.bounds
      );
    });

    return {
      count: filtered.length,
      features: filtered.slice(0, 500), // Limit to 500 features for performance
    };
  } catch (error) {
    console.error(`Error querying ${filename}:`, error);
    return { count: 0, features: [] };
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { aoi, requestId } = body;

    if (!aoi || !aoi.bounds || !aoi.center) {
      return NextResponse.json(
        { error: 'Invalid AOI format' },
        { status: 400 }
      );
    }

    // Request ID for race condition prevention
    const reqId = requestId || `loc-${Date.now()}`;

    // Query all relevant datasets for this AOI
    const [
      buildingsResult,
      roadsResult,
      waterwaysResult,
      rainStationsResult,
      flooded2015Result,
      hotspotsResult,
      floodedStreetsResult,
    ] = await Promise.all([
      queryGeoJSONForAOI('buildings', aoi),
      queryGeoJSONForAOI('highway', aoi),
      queryGeoJSONForAOI('waterway', aoi),
      queryGeoJSONForAOI('rainfall_stations', aoi),
      queryGeoJSONForAOI('chennai2015_inundation', aoi),
      queryGeoJSONForAOI('chennai2015_hotspots', aoi),
      queryGeoJSONForAOI('chennai2015_flooded_streets', aoi),
    ]);

    // Compile response
    const response: LocationQueryResponse = {
      requestId: reqId,
      aoi,
      timestamp: new Date().toISOString(),
      datasets: [
        {
          id: 'buildings',
          name: 'Building Footprints',
          covers: buildingsResult.count > 0,
          featureCount: buildingsResult.count,
        },
        {
          id: 'highway',
          name: 'Road Network',
          covers: roadsResult.count > 0,
          featureCount: roadsResult.count,
        },
        {
          id: 'waterway',
          name: 'Waterways & Canals',
          covers: waterwaysResult.count > 0,
          featureCount: waterwaysResult.count,
        },
        {
          id: 'rainfall_stations',
          name: 'Rainfall Monitoring Stations',
          covers: rainStationsResult.count > 0,
          featureCount: rainStationsResult.count,
        },
        {
          id: 'chennai2015_inundation',
          name: '2015 Flood Inundation Map',
          covers: flooded2015Result.count > 0,
          featureCount: flooded2015Result.count,
        },
        {
          id: 'chennai2015_hotspots',
          name: '2015 Flood Hotspots',
          covers: hotspotsResult.count > 0,
          featureCount: hotspotsResult.count,
        },
        {
          id: 'chennai2015_flooded_streets',
          name: '2015 Flooded Streets',
          covers: floodedStreetsResult.count > 0,
          featureCount: floodedStreetsResult.count,
        },
      ],
      summary: {
        buildings: buildingsResult.count,
        roads: roadsResult.count,
        waterways: waterwaysResult.count,
        rainStations: rainStationsResult.count,
        flooded2015: flooded2015Result.count,
        hotspots: hotspotsResult.count,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Location query error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
