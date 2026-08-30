import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/simulate
 * Runs flood simulation for a location with given parameters
 * Uses SCS runoff model and produces flood depth estimates
 */

interface SimulationRequest {
  requestId: string;
  aoi: {
    center: [number, number];
    bounds: { xmin: number; xmax: number; ymin: number; ymax: number };
  };
  rainfall: number; // mm
  cn: number; // Curve Number (0-100)
  duration: number; // minutes
}

// SCS Runoff calculation (from Python version in scripts/simulate.py)
function scsRunoff(P: number, CN: number): { S: number; Ia: number; Q: number } {
  if (CN <= 0 || CN > 100) {
    throw new Error(`CN must be 0-100, got ${CN}`);
  }
  if (P < 0) {
    throw new Error(`P must be >= 0, got ${P}`);
  }

  const S = 25400 / CN - 254;
  const Ia = 0.2 * S;
  const Q = P <= Ia ? 0 : ((P - Ia) ** 2) / (P + 0.8 * S);

  return { S, Ia, Q };
}

// Calculate flood depth based on runoff and duration
function calculateFloodDepth(
  Q: number,
  duration: number,
  locationId: string
): number {
  const norm = Math.min(Q / 120, 1.0);
  // Base depth calculation
  const baseFactor = norm * 2.2;
  const timeFactor = 0.3 + 0.7 * (duration / 100);
  let depth = baseFactor * timeFactor;

  // Slight adjustment based on location characteristics
  if (locationId === 'central') depth *= 0.95;
  if (locationId === 'ennore') depth *= 1.15;
  if (locationId === 'adyar') depth *= 1.05;

  return Math.max(0, depth);
}

// Estimate buildings affected
function estimateAffectedBuildings(
  buildingCount: number,
  floodDepth: number
): number {
  if (buildingCount === 0) return 0;
  const affectionFactor = Math.min(floodDepth / 1.5, 1.0) * 0.72;
  return Math.round(buildingCount * affectionFactor);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body: SimulationRequest = await request.json();
    const { requestId, aoi, rainfall, cn, duration } = body;

    if (!aoi || rainfall === undefined || cn === undefined) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // Validate parameters
    if (rainfall < 0 || rainfall > 500) {
      return NextResponse.json(
        { error: 'Rainfall must be 0-500 mm' },
        { status: 400 }
      );
    }

    if (cn < 30 || cn > 98) {
      return NextResponse.json(
        { error: 'CN must be 30-98' },
        { status: 400 }
      );
    }

    // Calculate runoff using SCS model
    const { S, Ia, Q } = scsRunoff(rainfall, cn);

    // Calculate flood characteristics
    const floodDepth = calculateFloodDepth(Q, duration || 45, aoi.id || 'default');

    // Simulate affected infrastructure
    // (would use actual building/road counts in real scenario)
    const estimatedBuildingCount = 200; // placeholder
    const affectedBuildings = estimateAffectedBuildings(
      estimatedBuildingCount,
      floodDepth
    );

    // Calculate flow velocity (simplified)
    const flowVelocity = 0.2 + floodDepth * 0.5;

    // Generate flood progression time series (hourly for 6 hours)
    const timeSeriesSteps = [];
    for (let hour = 0; hour <= 6; hour++) {
      const t = hour * 60; // convert to minutes
      const progDepth =
        floodDepth *
        Math.tanh((t + 1) / (duration + 30)) *
        Math.exp(-t / (duration * 4));
      timeSeriesSteps.push({
        time: hour,
        depth: Math.max(0, progDepth),
        velocity: Math.max(0, flowVelocity * (1 - Math.exp(-t / 120))),
        extent: Math.min(1.0, Math.tanh(t / (duration + 30))),
      });
    }

    return NextResponse.json({
      requestId: requestId || `sim-${Date.now()}`,
      aoi,
      timestamp: new Date().toISOString(),
      parameters: {
        rainfall,
        cn,
        duration: duration || 45,
      },
      hydrology: {
        s: S.toFixed(2),
        ia: Ia.toFixed(2),
        q: Q.toFixed(2),
        runoff_mm: Q,
      },
      results: {
        floodDepth: floodDepth.toFixed(2),
        flowVelocity: flowVelocity.toFixed(2),
        affectedBuildings,
        floodExtent: Math.min(
          (floodDepth / 1.5) * 100,
          100
        ).toFixed(1) + '%',
      },
      timeSeries: timeSeriesSteps,
    });
  } catch (error) {
    console.error('Simulation error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Simulation failed',
      },
      { status: 500 }
    );
  }
}
