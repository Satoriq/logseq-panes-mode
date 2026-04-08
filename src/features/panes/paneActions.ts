import { getPaneIdFromPane } from '../../core/domUtils';
import { isActivePaneIndexValid, globalState } from '../../core/pluginGlobalState';
import { readLastActivePanesFromStorage } from '../../core/storage';
import { EXPECTED_MUTATIONS } from '../observers/types';
import { getCurrentSidebarPanes, refreshPanesElementsCache } from './paneCache';
import {
  applyPaneDimensions,
  clearPaneDimensions,
  disconnectPaneCollapseObserver,
  removeScrollListenerFromPane,
} from './paneLayout';
import { setActivePaneByIndex, focusNextVisiblePane } from './paneNavigation';
import { getPluginSettings } from '../../core/pluginSettings';
import { waitForDomChanges } from '../../core/utils';
import { updateTabs } from '../tabs/tabs';

type CurrentPaneState = {
  panes: Element[];
  activePane: Element | null;
  activeIndex: number | null;
};

type PendingPaneCloseTarget = {
  pane: Element;
  paneId: string | null;
};

export const togglePaneCollapse = (index: number, updateTabs: (panes?: Element[]) => void) => {
  if (index < 0 || index >= globalState.cachedPanes.length) return;
  const pane = globalState.cachedPanes[index];
  const collapseButton = pane.querySelector('.rotating-arrow') as HTMLElement;
  if (!collapseButton) return;
  const isCurrentlyCollapsed = pane.classList.contains('collapsed');
  collapseButton.click();
  void waitForDomChanges(() => {
    const isCollapsedNow = pane.classList.contains('collapsed');
    if (isCurrentlyCollapsed && !isCollapsedNow) {
      applyPaneDimensions(pane);
      const paneElement = pane as HTMLElement;
      if (paneElement.dataset.panesModeFitContent === 'true') {
        paneElement.style.height = 'auto';
      }
    } else if (isCollapsedNow) {
      clearPaneDimensions(pane);
    }
    updateTabs(globalState.cachedPanes);
    if (index === globalState.currentActivePaneIndex && pane.classList.contains('collapsed')) {
      focusNextVisiblePane(pane as HTMLElement, updateTabs);
    } else if (globalState.currentActivePaneIndex !== null) {
      setActivePaneByIndex(globalState.currentActivePaneIndex, globalState.cachedPanes);
    }
  }, 0.15);
};

export const closePaneByIndex = (paneIndex: number, updateTabs: (panes?: Element[]) => void) => {
  const { panes: currentPanes } = getResolvedCurrentPaneState();
  const isOnlyPane = currentPanes.length === 1;
  const pane = currentPanes[paneIndex];
  if (!pane) return;
  const closeButton = pane.querySelector('[title="Close"]') as HTMLElement | null;
  if (!closeButton) return;

  cleanupPaneListeners(pane);
  globalState.expectedMutations.push(EXPECTED_MUTATIONS.paneClosing);
  closeButton.click();
  void waitForDomChanges().then(() => {
    if (isOnlyPane) {
      handleLastPaneClose(updateTabs);

      return;
    }

    const updatedPanes = getCurrentSidebarPanes();
    refreshPanesElementsCache(updatedPanes);
    if (updatedPanes.length === 0) {
      globalState.currentActivePaneIndex = null;
      updateTabs(updatedPanes);

      return;
    }

    setNextActivePaneAfterClose(paneIndex, updatedPanes);
    updateTabs(updatedPanes);
  });
};

export const closePaneByIndexes = (
  paneIndexes: number[],
  updateTabs: (panes?: Element[]) => void
) => {
  const sortedIndexes = [...paneIndexes].sort((a, b) => a - b);
  const {
    panes: currentPanes,
    activeIndex: currentPaneIndex,
    activePane: currentPane,
  } = getResolvedCurrentPaneState();
  const panesToClose = buildPendingPaneCloseTargets(paneIndexes, currentPanes);
  if (panesToClose.length === 0) return;

  void closePaneTargetsSequentially(panesToClose).then(closedCount => {
    if (closedCount === 0) return;

    const updatedPanes = getCurrentSidebarPanes();
    refreshPanesElementsCache(updatedPanes);
    if (updatedPanes.length === 0) {
      globalState.currentActivePaneIndex = null;
      updateTabs(updatedPanes);

      return;
    }

    const paneIndexToSelect = resolveBatchCloseActiveIndex(
      sortedIndexes,
      currentPaneIndex,
      currentPane,
      updatedPanes
    );
    setActivePaneByIndex(paneIndexToSelect, updatedPanes);
    updateTabs(updatedPanes);
  });
};

export const cleanLeftPanes = (updateTabs: (panes?: Element[]) => void) => {
  cleanPanesByDirection('left', updateTabs);
};

export const cleanRightPanes = (updateTabs: (panes?: Element[]) => void) => {
  cleanPanesByDirection('right', updateTabs);
};

export const enforceMaxTabsLimit = (excludePageId?: string): void => {
  const settings = getPluginSettings();
  if (!settings.autoCloseOldestTab) return;
  const panes = getCurrentSidebarPanes();
  if (panes.length <= globalState.maxTabs) return;
  const lastActivePanesIds = readLastActivePanesFromStorage();
  const oldestPaneId = lastActivePanesIds[0];
  const indexToClose =
    oldestPaneId !== undefined
      ? panes.findIndex(pane => {
          const paneId = getPaneIdFromPane(pane);
          if (excludePageId && paneId === excludePageId) return false;

          return paneId === oldestPaneId;
        })
      : -1;
  const fallbackIndex = panes.findIndex(pane => getPaneIdFromPane(pane) !== excludePageId);
  const safeIndex = indexToClose >= 0 ? indexToClose : fallbackIndex;
  if (safeIndex >= 0 && safeIndex < panes.length) {
    closePaneByIndex(safeIndex, updateTabs);
  }
};

export const cleanUnusedPanes = (updateTabs: (panes?: Element[]) => void) => {
  const lastActivePanesIds = readLastActivePanesFromStorage();
  if (!lastActivePanesIds || lastActivePanesIds.length === 0) {
    refreshTabsFromCurrentPanes(updateTabs);

    return;
  }
  const { panes: currentPanes } = getResolvedCurrentPaneState();
  const panesToClose: number[] = [];
  currentPanes.forEach((pane, index) => {
    const paneId = getPaneIdFromPane(pane);
    if (paneId && !lastActivePanesIds.includes(paneId)) {
      panesToClose.push(index);
    }
  });
  if (panesToClose.length > 0) {
    closePaneByIndexes(panesToClose, updateTabs);
  } else {
    refreshTabsFromCurrentPanes(updateTabs);
  }
};

const cleanupPaneListeners = (pane: Element): void => {
  removeScrollListenerFromPane(pane);
  disconnectPaneCollapseObserver(pane);
};

const handleLastPaneClose = (updateTabs: (panes?: Element[]) => void) => {
  logseq.App.setRightSidebarVisible(false);
  globalState.currentActivePaneIndex = null;
  refreshPanesElementsCache([]);
  updateTabs([]);
};

const setNextActivePaneAfterClose = (paneIndex: number, updatedPanes: Element[]) => {
  const wasActive = paneIndex === globalState.currentActivePaneIndex;
  let nextActiveIndex =
    globalState.currentActivePaneIndex === null ? 0 : globalState.currentActivePaneIndex;
  if (wasActive) {
    nextActiveIndex = Math.min(paneIndex, updatedPanes.length - 1);
  } else if (paneIndex < nextActiveIndex) {
    nextActiveIndex = Math.max(0, nextActiveIndex - 1);
  }

  setActivePaneByIndex(nextActiveIndex, updatedPanes);
};

const resolveBatchCloseActiveIndex = (
  sortedIndexes: number[],
  currentPaneIndex: number | null,
  currentPane: Element | null,
  updatedPanes: Element[]
): number => {
  const updatedActivePaneIndex = currentPane ? updatedPanes.indexOf(currentPane) : -1;
  const panesClosedBeforeActive =
    currentPaneIndex !== null
      ? sortedIndexes.filter(index => index < (currentPaneIndex as number)).length
      : 0;
  let paneIndexToSelect =
    updatedActivePaneIndex === -1
      ? Math.max(0, (currentPaneIndex ?? 0) - panesClosedBeforeActive)
      : updatedActivePaneIndex;
  paneIndexToSelect = Math.min(paneIndexToSelect, updatedPanes.length - 1);

  return paneIndexToSelect;
};

const cleanPanesByDirection = (
  direction: 'left' | 'right',
  updateTabs: (panes?: Element[]) => void
) => {
  const { panes: currentPanes, activeIndex } = getResolvedCurrentPaneState();

  if (currentPanes.length <= globalState.maxTabs || activeIndex === null) {
    refreshTabsFromCurrentPanes(updateTabs);

    return;
  }

  const panesToClose = getPaneIndexesToClose(
    currentPanes.length,
    activeIndex,
    globalState.maxTabs,
    direction
  );

  if (panesToClose.length > 0) {
    closePaneByIndexes(panesToClose, updateTabs);
  } else {
    refreshTabsFromCurrentPanes(updateTabs);
  }
};

const refreshTabsFromCurrentPanes = (updateTabs: (panes?: Element[]) => void) => {
  const currentPanes = getCurrentSidebarPanes();
  refreshPanesElementsCache(currentPanes);
  updateTabs(currentPanes);
};

const buildPendingPaneCloseTargets = (
  paneIndexes: number[],
  currentPanes: Element[]
): PendingPaneCloseTarget[] =>
  paneIndexes
    .map(index => currentPanes[index])
    .filter((pane): pane is Element => Boolean(pane))
    .map(pane => ({
      pane,
      paneId: getPaneIdFromPane(pane),
    }));

const resolvePendingPaneCloseTarget = (
  target: PendingPaneCloseTarget,
  currentPanes: Element[]
): Element | null => {
  if (currentPanes.includes(target.pane)) {
    return target.pane;
  }

  if (!target.paneId) return null;

  return currentPanes.find(pane => getPaneIdFromPane(pane) === target.paneId) ?? null;
};

const closePaneTargetsSequentially = async (targets: PendingPaneCloseTarget[]): Promise<number> => {
  let closedCount = 0;

  for (const target of targets) {
    const currentPanes = getCurrentSidebarPanes();
    const pane = resolvePendingPaneCloseTarget(target, currentPanes);
    if (!pane) continue;

    const closeButton = pane.querySelector('[title="Close"]') as HTMLElement | null;
    if (!closeButton) continue;

    cleanupPaneListeners(pane);
    globalState.expectedMutations.push(EXPECTED_MUTATIONS.paneClosingBatch);
    closeButton.click();
    closedCount++;

    await waitForDomChanges();
  }

  return closedCount;
};

const getResolvedCurrentPaneState = (): CurrentPaneState => {
  const previousCachedPanes =
    globalState.cachedPanes.length > 0 ? [...globalState.cachedPanes] : getCurrentSidebarPanes();
  const previousActivePane =
    globalState.currentActivePaneIndex !== null
      ? previousCachedPanes[globalState.currentActivePaneIndex] ?? null
      : null;
  const previousActivePaneId = previousActivePane ? getPaneIdFromPane(previousActivePane) : null;

  const panes = getCurrentSidebarPanes();
  refreshPanesElementsCache(panes);

  if (panes.length === 0) {
    globalState.currentActivePaneIndex = null;

    return { panes, activePane: null, activeIndex: null };
  }

  const selectedPane =
    panes.find(pane => (pane as HTMLElement).classList.contains('selectedPane')) ?? null;
  const matchedPreviousPane =
    previousActivePane && panes.includes(previousActivePane) ? previousActivePane : null;
  const matchedPaneById =
    !matchedPreviousPane && previousActivePaneId
      ? panes.find(pane => getPaneIdFromPane(pane) === previousActivePaneId) ?? null
      : null;
  const matchedPaneByIndex = isActivePaneIndexValid(panes)
    ? panes[globalState.currentActivePaneIndex as number] ?? null
    : null;
  const activePane =
    selectedPane ?? matchedPreviousPane ?? matchedPaneById ?? matchedPaneByIndex ?? panes[0];
  const activeIndex = panes.indexOf(activePane);

  globalState.currentActivePaneIndex = activeIndex === -1 ? 0 : activeIndex;

  return {
    panes,
    activePane,
    activeIndex: globalState.currentActivePaneIndex,
  };
};

const getPaneIndexesToClose = (
  paneCount: number,
  activeIndex: number,
  maxTabs: number,
  direction: 'left' | 'right'
): number[] => {
  const numberOfPanesToClose = Math.max(0, paneCount - maxTabs);
  if (numberOfPanesToClose === 0) return [];

  const leftIndexes = Array.from({ length: activeIndex }, (_, index) => index);
  const rightIndexes = Array.from(
    { length: Math.max(0, paneCount - activeIndex - 1) },
    (_, offset) => paneCount - 1 - offset
  );
  const indexesForDirection = direction === 'left' ? leftIndexes : rightIndexes;

  return indexesForDirection.slice(0, numberOfPanesToClose);
};
