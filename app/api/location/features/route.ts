import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

/**
 * POST /api/location/features
 * Fetches actual GeoJSON features for an AOI
 * Used by 3D visualization to load buildings, roads, etc.
 */

interface AOI {
  bounds: {
    xmin: number;
    xmax: number;
    ymin: number;
    ymax: number;
  };
}

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

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { aoi, datasets, limit = 500 } = body;

    if (!aoi || !aoi.bounds || !datasets) {
      return NextResponse.json(
        { error: 'Invalid request format' },
        { status: 400 }
      );
    }

    const results: Record<string, any> = {};

    // Fetch each requested dataset
    for (const datasetId of datasets) {
      try {
        const filePath = path.join(
          process.cwd(),
          'public',
          `${datasetId}.geojson`
        );
        if (!fs.existsSync(filePath)) {
          results[datasetId] = {
            type: 'FeatureCollection',
            features: [],
            count: 0,
          };
          continue;
        }

        const content = fs.readFileSync(filePath, 'utf-8');
        const geojson = JSON.parse(content);
        const features = geojson.features || [];

        const filtered = features
          .filter((f: any) => {
            const geom = f.geometry;
            if (!geom) return false;
            return geometryIntersectsBounds(
              geom.coordinates,
              geom.type,
              aoi.bounds
            );
          })
          .slice(0, limit);

        results[datasetId] = {
          type: 'FeatureCollection',
          features: filtered,
          count: filtered.length,
        };
      } catch (error) {
        console.error(`Error fetching ${datasetId}:`, error);
        results[datasetId] = {
          type: 'FeatureCollection',
          features: [],
          count: 0,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }

    return NextResponse.json({
      requestId: body.requestId || `feat-${Date.now()}`,
      aoi,
      timestamp: new Date().toISOString(),
      features: results,
    });
  } catch (error) {
    console.error('Features fetch error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
