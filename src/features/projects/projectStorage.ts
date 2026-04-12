import { STORAGE_KEYS, LOCAL_STORAGE_SAVINGS_LIMITS } from '../../core/constants';
import { debugError, debugWarn } from '../../core/logger';
import type { ProjectData } from './types';
import {
  PaneDimensions,
  readPanesOrderFromStorage,
  readPanesDimensionsFromStorage,
  readPaneFitContentHeightFromStorage,
  readPaneCollapseOrientationsFromStorage,
} from '../../core/storage';

export type ProjectsRecord = Record<string, ProjectData>;

const FILE_STORAGE_KEY = 'panesMode-projects';

export const generateProjectId = (): string => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);

  return `proj_${timestamp}_${random}`;
};

export const readProjectsFromLocalStorage = (): ProjectsRecord => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.projects);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || Array.isArray(parsed)) return {};

    return parsed as ProjectsRecord;
  } catch {
    return {};
  }
};

export const writeProjectsToLocalStorage = (projects: ProjectsRecord): void => {
  try {
    const trimmed = trimProjectsRecord(projects);
    localStorage.setItem(STORAGE_KEYS.projects, JSON.stringify(trimmed));
  } catch (error) {
    debugError('[PanesMode][Projects] Failed to write to localStorage:', error);
  }
};

export const readProjectsFromFileStorage = async (): Promise<ProjectsRecord> => {
  try {
    if (!logseq?.FileStorage?.getItem) return {};
    const raw = await logseq.FileStorage.getItem(FILE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || Array.isArray(parsed)) return {};

    return parsed as ProjectsRecord;
  } catch {
    return {};
  }
};

export const writeProjectsToFileStorage = async (projects: ProjectsRecord): Promise<void> => {
  try {
    if (!logseq?.FileStorage?.setItem) return;
    const trimmed = trimProjectsRecord(projects);
    await logseq.FileStorage.setItem(FILE_STORAGE_KEY, JSON.stringify(trimmed));
  } catch (error) {
    debugError('[PanesMode][Projects] Failed to write to FileStorage:', error);
  }
};

export const readProjects = async (): Promise<ProjectsRecord> => {
  const localProjects = readProjectsFromLocalStorage();
  if (Object.keys(localProjects).length > 0) {
    return localProjects;
  }

  return readProjectsFromFileStorage();
};

export const writeProjects = async (projects: ProjectsRecord): Promise<void> => {
  writeProjectsToLocalStorage(projects);
  await writeProjectsToFileStorage(projects);
};

export const captureCurrentPaneState = (): Omit<
  ProjectData,
  'name' | 'createdAt' | 'updatedAt'
> => {
  const panesOrder = readPanesOrderFromStorage();
  const allDimensions = readPanesDimensionsFromStorage();
  const allFitContent = readPaneFitContentHeightFromStorage();
  const allCollapseOrientation = readPaneCollapseOrientationsFromStorage();

  const paneDimensions: Record<string, PaneDimensions> = {};
  const paneFitContentHeight: Record<string, boolean> = {};
  const paneCollapseOrientation: Record<string, 'vertical' | 'horizontal'> = {};

  panesOrder.forEach(pageId => {
    if (allDimensions[pageId]) {
      paneDimensions[pageId] = allDimensions[pageId];
    }
    if (allFitContent[pageId]) {
      paneFitContentHeight[pageId] = allFitContent[pageId];
    }
    if (allCollapseOrientation[pageId]) {
      paneCollapseOrientation[pageId] = allCollapseOrientation[pageId];
    }
  });

  return {
    panesOrder,
    paneDimensions,
    paneFitContentHeight,
    paneCollapseOrientation,
  };
};

export const saveProject = async (name: string): Promise<string | null> => {
  const paneState = captureCurrentPaneState();
  if (paneState.panesOrder.length === 0) {
    debugWarn('[PanesMode][Projects] Cannot save empty project');

    return null;
  }

  const projectId = generateProjectId();
  const now = Date.now();
  const project: ProjectData = {
    name,
    ...paneState,
    createdAt: now,
    updatedAt: now,
  };

  const projects = await readProjects();
  projects[projectId] = project;
  await writeProjects(projects);

  return projectId;
};

export const deleteProject = async (projectId: string): Promise<void> => {
  const projects = await readProjects();
  if (!projects[projectId]) return;
  delete projects[projectId];
  await writeProjects(projects);
};

export const getProjectById = async (projectId: string): Promise<ProjectData | null> => {
  const projects = await readProjects();

  return projects[projectId] ?? null;
};

export const getAllProjectsList = async (): Promise<Array<{ id: string; data: ProjectData }>> => {
  const projects = await readProjects();

  return Object.entries(projects)
    .map(([id, data]) => ({ id, data }))
    .sort((a, b) => (b.data.updatedAt ?? 0) - (a.data.updatedAt ?? 0));
};

const trimProjectsRecord = (record: ProjectsRecord): ProjectsRecord => {
  const keys = Object.keys(record);
  if (keys.length <= LOCAL_STORAGE_SAVINGS_LIMITS.maxEntries) return record;
  const sortedKeys = keys.sort((a, b) => {
    const aTime = record[a]?.updatedAt ?? 0;
    const bTime = record[b]?.updatedAt ?? 0;

    return aTime - bTime;
  });
  const keysToRemove = sortedKeys.slice(0, keys.length - LOCAL_STORAGE_SAVINGS_LIMITS.maxEntries);
  const trimmed = { ...record };
  keysToRemove.forEach(key => delete trimmed[key]);

  return trimmed;
};
