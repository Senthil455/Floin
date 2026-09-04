import fs from "fs";
import path from "path";

export interface ProjectSchema {
  id: string;
  name: string;
  description?: string;
  location: { name: string; center: [number, number]; bounds: { xmin: number; xmax: number; ymin: number; ymax: number } };
  createdAt: string;
  updatedAt: string;
  status: "active" | "archived" | "draft";
  owner?: string;
  datasets: DatasetReference[];
  scenarios: string[];
  savedLocations: SavedLocationReference[];
  metadata?: Record<string, any>;
}
export interface ScenarioSchema {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  parameters: { rainfall: number; cn: number; duration: number; timestamp: string };
  aoi: { id: string; center: [number, number]; bounds: { xmin: number; xmax: number; ymin: number; ymax: number } };
  results: SimulationResult;
  createdAt: string;
  updatedAt: string;
  status: "draft" | "running" | "completed" | "error";
  tags?: string[];
}
export interface SimulationResult {
  requestId: string;
  hydrology: { runoff_mm: number; s: number; ia: number; q: number };
  flood: { depth_m: number; velocity_ms: number; extent_percent: number; affectedBuildings: number; affectedRoads: number };
  timeSeries: TimeSeriesPoint[];
  datasetsUsed: DatasetUsed[];
  generatedAt: string;
}
export interface TimeSeriesPoint { time: number; depth: number; velocity: number; extent: number; }
export interface DatasetUsed { id: string; name: string; covers: boolean; featureCount: number; }
export interface DatasetReference { id: string; name: string; category: string; version?: string; includedAt: string; }
export interface SavedLocationReference { id: string; name: string; center: [number, number]; bounds: { xmin: number; xmax: number; ymin: number; ymax: number }; savedAt: string; scenarioId?: string; }

const DATA_DIR = path.join(process.cwd(), "data", "processed");
const PROJECTS_FILE = path.join(DATA_DIR, "projects.json");
const SCENARIOS_FILE = path.join(DATA_DIR, "scenarios.json");

function loadMap<T>(file: string): Map<string, T> {
  try {
    if (!fs.existsSync(file)) return new Map();
    const raw = fs.readFileSync(file, "utf-8");
    const arr: T[] = JSON.parse(raw);
    const m = new Map<string, T>();
    for (const item of arr as any[]) if (item?.id) m.set(item.id, item);
    return m;
  } catch { return new Map(); }
}
function saveMap<T>(file: string, map: Map<string, T>) {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = file + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(Array.from(map.values()), null, 2), "utf-8");
    fs.renameSync(tmp, file);
  } catch (e) { console.error(`Failed to persist ${file}:`, e); }
}

export const projectsStorage: Map<string, ProjectSchema> = loadMap<ProjectSchema>(PROJECTS_FILE);
export const scenariosStorage: Map<string, ScenarioSchema> = loadMap<ScenarioSchema>(SCENARIOS_FILE);
export const savedLocationsStorage = new Map<string, SavedLocationReference>();

function persistProjects() { saveMap(PROJECTS_FILE, projectsStorage); }
function persistScenarios() { saveMap(SCENARIOS_FILE, scenariosStorage); }

export function createProject(project: Omit<ProjectSchema, "id" | "createdAt" | "updatedAt">): ProjectSchema {
  const id = `proj-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const now = new Date().toISOString();
  const full: ProjectSchema = { id, ...project, createdAt: now, updatedAt: now, scenarios: [], savedLocations: [] };
  projectsStorage.set(id, full);
  persistProjects();
  return full;
}
export function getProject(id: string): ProjectSchema | null { return projectsStorage.get(id) || null; }
export function updateProject(id: string, updates: Partial<ProjectSchema>): ProjectSchema | null {
  const ex = projectsStorage.get(id); if (!ex) return null;
  const upd: ProjectSchema = { ...ex, ...updates, updatedAt: new Date().toISOString() };
  projectsStorage.set(id, upd); persistProjects(); return upd;
}
export function deleteProject(id: string): boolean {
  const ok = projectsStorage.delete(id);
  if (ok) persistProjects();
  return ok;
}
export function listProjects(): ProjectSchema[] { return Array.from(projectsStorage.values()); }

export function createScenario(scenario: Omit<ScenarioSchema, "id" | "createdAt" | "updatedAt">): ScenarioSchema {
  const id = `scn-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const now = new Date().toISOString();
  const full: ScenarioSchema = { id, ...scenario, createdAt: now, updatedAt: now };
  scenariosStorage.set(id, full);
  const proj = projectsStorage.get(scenario.projectId);
  if (proj) { proj.scenarios.push(id); proj.updatedAt = now; persistProjects(); }
  persistScenarios();
  return full;
}
export function getScenario(id: string): ScenarioSchema | null { return scenariosStorage.get(id) || null; }
export function updateScenario(id: string, updates: Partial<ScenarioSchema>): ScenarioSchema | null {
  const ex = scenariosStorage.get(id); if (!ex) return null;
  const upd: ScenarioSchema = { ...ex, ...updates, updatedAt: new Date().toISOString() };
  scenariosStorage.set(id, upd); persistScenarios(); return upd;
}
export function listScenarios(projectId?: string): ScenarioSchema[] {
  const all = Array.from(scenariosStorage.values());
  return projectId ? all.filter((s) => s.projectId === projectId) : all;
}
export function deleteScenario(id: string): boolean {
  const sc = scenariosStorage.get(id);
  if (sc) {
    const proj = projectsStorage.get(sc.projectId);
    if (proj) { proj.scenarios = proj.scenarios.filter((s) => s !== id); persistProjects(); }
  }
  const ok = scenariosStorage.delete(id);
  if (ok) persistScenarios();
  return ok;
}
