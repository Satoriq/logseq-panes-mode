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
  const currentPanes = globalState.cachedPanes.length
    ? globalState.cachedPanes
    : getCurrentSidebarPanes();
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
  const currentPaneIndex = isActivePaneIndexValid() ? globalState.currentActivePaneIndex : null;
  const currentPane = currentPaneIndex !== null ? globalState.cachedPanes[currentPaneIndex] : null;
  let closedCount = 0;
  sortedIndexes.forEach(index => {
    const pane = globalState.cachedPanes[index];
    const closeButton = pane?.querySelector('[title="Close"]') as HTMLElement | null;
    if (!pane || !closeButton) return;
    cleanupPaneListeners(pane);
    globalState.expectedMutations.push(EXPECTED_MUTATIONS.paneClosingBatch);
    closeButton.click();
    closedCount++;
  });
  if (closedCount === 0) return;

  void waitForDomChanges(() => {
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
  }, 0.5);
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
  const currentPanes =
    globalState.cachedPanes.length > 0 ? globalState.cachedPanes : getCurrentSidebarPanes();
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
  if (globalState.cachedPanes.length <= globalState.maxTabs) {
    refreshTabsFromCurrentPanes(updateTabs);

    return;
  }

  const panesToClose: number[] = [];
  const numberOfPanesToClose = globalState.cachedPanes.length - globalState.maxTabs;
  if (direction === 'left') {
    for (
      let i = 0;
      i < globalState.currentActivePaneIndex && panesToClose.length < numberOfPanesToClose;
      i++
    ) {
      panesToClose.push(i);
    }
  } else {
    for (
      let i = globalState.cachedPanes.length - 1;
      i > globalState.currentActivePaneIndex && panesToClose.length < numberOfPanesToClose;
      i--
    ) {
      panesToClose.push(i);
    }
  }

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
