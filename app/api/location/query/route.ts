import { NextRequest, NextResponse } from 'next/server';
import { fileFallbackQuery, tryPostGISQuery } from '@/app/lib/postgis';

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

const TABLE_MAP: Record<string, string> = { buildings:"buildings", highway:"highway", waterway:"waterway", rainfall_stations:"rainfall_stations", chennai2015_inundation:"chennai2015_inundation", chennai2015_hotspots:"chennai2015_hotspots", chennai2015_flooded_streets:"chennai2015_flooded_streets" };
async function queryGeoJSONForAOI(filename: string, aoi: AOI): Promise<{ count:number; features:any[] }>{
  const table=TABLE_MAP[filename];
  if(table && process.env.DATABASE_URL){
    const sql=`SELECT ST_AsGeoJSON(geom)::json as geometry, row_to_json(t) - 'geom' as props FROM ${table} t WHERE ST_Intersects(geom, ST_MakeEnvelope($1,$2,$3,$4,4326)) LIMIT 500`;
    const rows=await tryPostGISQuery(sql,[aoi.bounds.xmin, aoi.bounds.ymin, aoi.bounds.xmax, aoi.bounds.ymax]);
    if(rows && rows.length>=0){
      const features=rows.map((r:any)=>({ type:"Feature", geometry:r.geometry, properties:r.props }));
      return { count: features.length, features };
    }
  }
  return fileFallbackQuery(aoi as any, filename, 500);
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
