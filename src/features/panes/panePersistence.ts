import { getPaneIdFromPane } from '../../core/domUtils';
import { globalState } from '../../core/pluginGlobalState';
import {
  readLastActivePanesFromStorage,
  readPanesOrderFromStorage,
  writeLastActiveToStorage,
  writePanesOrderToStorage,
} from '../../core/storage';
import { debounce } from '../../core/utils';
import { getCurrentSidebarPanes } from './paneCache';

export const updatePanesOrderInStorage = (currentSidebarPanes?: Element[]): void => {
  const currentPanes = currentSidebarPanes || getCurrentSidebarPanes();
  const newPanesOrder = currentPanes.map(pane => getPaneIdFromPane(pane));
  if (!Array.isArray(newPanesOrder)) return;
  writePanesOrderToStorage(newPanesOrder);
};

export const updateLastActivePanesInStorage = (
  activePaneIndex?: number,
  currentSidebarPanes?: Element[]
): void => {
  const paneIndex = activePaneIndex ?? globalState.currentActivePaneIndex;
  if (paneIndex === null) return;

  const currentPane = currentSidebarPanes?.[paneIndex];
  if (!currentPane) return;

  const currentPaneId = getPaneIdFromPane(currentPane);
  if (!currentPaneId) return;

  const currentLastActivePanes = getLastActivePanesFromCache();

  if (currentLastActivePanes[currentLastActivePanes.length - 1] === currentPaneId) return;

  const panesToStore = currentLastActivePanes.filter(paneId => paneId !== currentPaneId);
  if (panesToStore.length >= globalState.maxTabs) {
    panesToStore.shift();
  }
  panesToStore.push(currentPaneId);

  lastActivePanesCache = panesToStore;
  debouncedWriteLastActive(panesToStore);
};

export const invalidateLastActivePanesCache = (): void => {
  lastActivePanesCache = null;
};

export const initialPanesOrder = readPanesOrderFromStorage();

let lastActivePanesCache: string[] | null = null;

const getLastActivePanesFromCache = (): string[] => {
  if (lastActivePanesCache === null) {
    lastActivePanesCache = readLastActivePanesFromStorage();
  }

  return lastActivePanesCache;
};

const writeLastActivePanesWithCache = (panes: string[]): void => {
  lastActivePanesCache = panes;
  writeLastActiveToStorage(panes);
};

const debouncedWriteLastActive = debounce((panes: string[]) => {
  writeLastActivePanesWithCache(panes);
}, 300);
