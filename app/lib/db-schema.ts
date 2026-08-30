/**
 * FLOIN Database Schema Definitions
 * Implements project/scenario/simulation persistence
 */

export interface ProjectSchema {
  id: string;
  name: string;
  description?: string;
  location: {
    name: string;
    center: [number, number];
    bounds: { xmin: number; xmax: number; ymin: number; ymax: number };
  };
  createdAt: string;
  updatedAt: string;
  status: 'active' | 'archived' | 'draft';
  owner?: string;
  datasets: DatasetReference[];
  scenarios: string[]; // scenario IDs
  savedLocations: SavedLocationReference[];
  metadata?: Record<string, any>;
}

export interface ScenarioSchema {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  parameters: {
    rainfall: number; // mm
    cn: number; // Curve Number
    duration: number; // minutes
    timestamp: string;
  };
  aoi: {
    id: string;
    center: [number, number];
    bounds: { xmin: number; xmax: number; ymin: number; ymax: number };
  };
  results: SimulationResult;
  createdAt: string;
  updatedAt: string;
  status: 'draft' | 'running' | 'completed' | 'error';
  tags?: string[];
}

export interface SimulationResult {
  requestId: string;
  hydrology: {
    runoff_mm: number;
    s: number;
    ia: number;
    q: number;
  };
  flood: {
    depth_m: number;
    velocity_ms: number;
    extent_percent: number;
    affectedBuildings: number;
    affectedRoads: number;
  };
  timeSeries: TimeSeriesPoint[];
  datasetsUsed: DatasetUsed[];
  generatedAt: string;
}

export interface TimeSeriesPoint {
  time: number; // hours
  depth: number;
  velocity: number;
  extent: number;
}

export interface DatasetUsed {
  id: string;
  name: string;
  covers: boolean;
  featureCount: number;
}

export interface DatasetReference {
  id: string;
  name: string;
  category: string;
  version?: string;
  includedAt: string;
}

export interface SavedLocationReference {
  id: string;
  name: string;
  center: [number, number];
  bounds: { xmin: number; xmax: number; ymin: number; ymax: number };
  savedAt: string;
  scenarioId?: string;
}

/**
 * In-memory storage (for now - would use database in production)
 * Production would use PostgreSQL + PostGIS
 */

export const projectsStorage = new Map<string, ProjectSchema>();
export const scenariosStorage = new Map<string, ScenarioSchema>();
export const savedLocationsStorage = new Map<string, SavedLocationReference>();

/**
 * Helper functions for storage management
 */

export function createProject(project: Omit<ProjectSchema, 'id' | 'createdAt' | 'updatedAt'>): ProjectSchema {
  const id = `proj-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const now = new Date().toISOString();
  const full: ProjectSchema = {
    id,
    ...project,
    createdAt: now,
    updatedAt: now,
    scenarios: [],
    savedLocations: [],
  };
  projectsStorage.set(id, full);
  return full;
}

export function getProject(id: string): ProjectSchema | null {
  return projectsStorage.get(id) || null;
}

export function updateProject(id: string, updates: Partial<ProjectSchema>): ProjectSchema | null {
  const existing = projectsStorage.get(id);
  if (!existing) return null;
  const updated: ProjectSchema = {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  projectsStorage.set(id, updated);
  return updated;
}

export function deleteProject(id: string): boolean {
  return projectsStorage.delete(id);
}

export function listProjects(): ProjectSchema[] {
  return Array.from(projectsStorage.values());
}

export function createScenario(scenario: Omit<ScenarioSchema, 'id' | 'createdAt' | 'updatedAt'>): ScenarioSchema {
  const id = `scn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const now = new Date().toISOString();
  const full: ScenarioSchema = {
    id,
    ...scenario,
    createdAt: now,
    updatedAt: now,
  };
  scenariosStorage.set(id, full);

  // Add to project's scenarios list
  const project = projectsStorage.get(scenario.projectId);
  if (project) {
    project.scenarios.push(id);
    project.updatedAt = now;
  }

  return full;
}

export function getScenario(id: string): ScenarioSchema | null {
  return scenariosStorage.get(id) || null;
}

export function updateScenario(id: string, updates: Partial<ScenarioSchema>): ScenarioSchema | null {
  const existing = scenariosStorage.get(id);
  if (!existing) return null;
  const updated: ScenarioSchema = {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  scenariosStorage.set(id, updated);
  return updated;
}

export function listScenarios(projectId?: string): ScenarioSchema[] {
  const all = Array.from(scenariosStorage.values());
  if (projectId) {
    return all.filter((s) => s.projectId === projectId);
  }
  return all;
}

export function deleteScenario(id: string): boolean {
  const scenario = scenariosStorage.get(id);
  if (scenario) {
    // Remove from project
    const project = projectsStorage.get(scenario.projectId);
    if (project) {
      project.scenarios = project.scenarios.filter((s) => s !== id);
    }
  }
  return scenariosStorage.delete(id);
}
