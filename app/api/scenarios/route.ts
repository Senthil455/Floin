import { NextRequest, NextResponse } from 'next/server';
import {
  createScenario,
  getScenario,
  updateScenario,
  deleteScenario,
  listScenarios,
  ScenarioSchema,
} from '@/app/lib/db-schema';

/**
 * GET /api/scenarios?projectId=<id>
 * List scenarios, optionally filtered by project
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    const scenarios = listScenarios(projectId || undefined);
    return NextResponse.json({
      status: 'success',
      scenarios,
      count: scenarios.length,
      projectId: projectId || null,
    });
  } catch (error) {
    console.error('List scenarios error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list scenarios' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/scenarios
 * Create a new scenario
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { projectId, name, description, parameters, aoi, results } = body;

    if (!projectId || !name || !aoi || !parameters) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const scenario = createScenario({
      projectId,
      name,
      description,
      parameters: {
        rainfall: parameters.rainfall || 120,
        cn: parameters.cn || 78,
        duration: parameters.duration || 45,
        timestamp: new Date().toISOString(),
      },
      aoi,
      results: results || {
        requestId: `res-${Date.now()}`,
        hydrology: { runoff_mm: 0, s: 0, ia: 0, q: 0 },
        flood: {
          depth_m: 0,
          velocity_ms: 0,
          extent_percent: 0,
          affectedBuildings: 0,
          affectedRoads: 0,
        },
        timeSeries: [],
        datasetsUsed: [],
        generatedAt: new Date().toISOString(),
      },
      status: 'draft',
    });

    return NextResponse.json({
      status: 'success',
      scenario,
      message: `Scenario "${name}" created successfully`,
    });
  } catch (error) {
    console.error('Create scenario error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create scenario' },
      { status: 500 }
    );
  }
}
