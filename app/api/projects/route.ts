import { NextRequest, NextResponse } from 'next/server';
import {
  createProject,
  getProject,
  updateProject,
  deleteProject,
  listProjects,
  ProjectSchema,
} from '@/app/lib/db-schema';

/**
 * GET /api/projects
 * List all projects
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const projects = listProjects();
    return NextResponse.json({
      status: 'success',
      projects,
      count: projects.length,
    });
  } catch (error) {
    console.error('List projects error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list projects' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/projects
 * Create a new project
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { name, description, location } = body;

    if (!name || !location) {
      return NextResponse.json(
        { error: 'Missing required fields: name, location' },
        { status: 400 }
      );
    }

    const project = createProject({
      name,
      description,
      location,
      status: 'active',
      datasets: [],
    });

    return NextResponse.json({
      status: 'success',
      project,
      message: `Project "${name}" created successfully`,
    });
  } catch (error) {
    console.error('Create project error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create project' },
      { status: 500 }
    );
  }
}
