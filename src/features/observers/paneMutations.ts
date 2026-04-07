import { APP_SETTINGS_CONFIG } from '../../core/constants';
import { globalState } from '../../core/pluginGlobalState';
import { PendingShiftClick } from '../../core/PendingShiftClick';
import { waitForDomChanges } from '../../core/utils';
import {
  arePanesDifferent,
  getPaneIdFromPane,
  getScrollablePanesContainer,
  getTabsContainer,
} from '../../core/domUtils';
import { getCurrentSidebarPanes, refreshPanesElementsCache } from '../panes/paneCache';
import { setActivePaneByIndex } from '../panes/paneNavigation';
import { observePaneForResize } from '../panes/paneResize';
import { updateTabs } from '../tabs/tabs';
import { enforceMaxTabsLimit } from '../panes/paneActions';
import { applyPaneDimensions, enableFitContentForNewPane } from '../panes/paneLayout';
import { updatePanesOrderInStorage } from '../panes/panePersistence';
import {
  getActivePaneElement,
  getNewPaneCandidate,
  reorderPaneNextToActive,
  resolveActivePaneFromPending,
  resolveShiftClickTargetPane,
} from '../panes/shiftActions/paneShiftReorder';
import { EXPECTED_MUTATIONS } from './types';
import { getPluginSettings } from '../../core/pluginSettings';

const SHIFT_CLICK_TIMEOUT_MS = 2000;
const SHIFT_CLICK_NATIVE_IGNORE_MS = 800;
const PANE_SYNC_INTERVAL_MS = 100;
const SHIFT_CLICK_WATCHER_INTERVAL_MS = 50;
const TAB_SELECTOR = '.panesMode-tab';

let paneOrderSyncInterval: ReturnType<typeof setInterval> | null = null;
let paneOrderSyncTarget: Element[] | null = null;
let moduleResizeObserver: ResizeObserver | null = null;
let shiftClickWatcherInterval: ReturnType<typeof setInterval> | null = null;

const stopPaneOrderSync = (): void => {
  if (paneOrderSyncInterval !== null) {
    clearInterval(paneOrderSyncInterval);
    paneOrderSyncInterval = null;
  }
  paneOrderSyncTarget = null;
};

export const stopShiftClickPaneWatcher = (): void => {
  if (shiftClickWatcherInterval !== null) {
    clearInterval(shiftClickWatcherInterval);
    shiftClickWatcherInterval = null;
  }
};

export const startShiftClickPaneWatcher = (): void => {
  stopShiftClickPaneWatcher();

  const pending = globalState.pendingShiftClick;
  if (!pending || !moduleResizeObserver) return;

  const watcherTimestamp = pending.timestamp;

  shiftClickWatcherInterval = setInterval(() => {
    const currentPending = globalState.pendingShiftClick;

    // pendingShiftClick was consumed (handled by mutation observer) — final sync check
    if (!currentPending || currentPending.timestamp !== watcherTimestamp) {
      const container = getScrollablePanesContainer();
      if (container) {
        const panes = getCurrentSidebarPanes(container);
        if (!areTabsSyncedWithPanes(panes)) {
          refreshPanesElementsCache(panes);
          updateTabs(panes);
        }
      }
      stopShiftClickPaneWatcher();

      return;
    }

    // Timeout — do a final tabs sync and give up
    if (Date.now() - currentPending.timestamp > SHIFT_CLICK_TIMEOUT_MS) {
      const container = getScrollablePanesContainer();
      if (container) {
        const panes = getCurrentSidebarPanes(container);
        if (!areTabsSyncedWithPanes(panes)) {
          refreshPanesElementsCache(panes);
          updateTabs(panes);
        }
      }
      globalState.pendingShiftClick = null;
      stopShiftClickPaneWatcher();

      return;
    }

    if (!globalState.isPanesModeModeActive || !moduleResizeObserver) {
      stopShiftClickPaneWatcher();

      return;
    }

    const container = getScrollablePanesContainer();
    if (!container) return;

    const currentPanes = getCurrentSidebarPanes(container);
    if (currentPanes.length === 0) return;

    // Try to handle the shift-click pane open (reorder + tabs)
    const handled = handleShiftClickPaneOpen(
      currentPending,
      currentPanes,
      moduleResizeObserver
    );

    if (handled) {
      refreshPanesElementsCache();
      stopShiftClickPaneWatcher();

      return;
    }

    // Not handled yet — at least ensure tabs reflect current DOM state
    if (!areTabsSyncedWithPanes(currentPanes)) {
      refreshPanesElementsCache(currentPanes);
      updateTabs(currentPanes);
    }
  }, SHIFT_CLICK_WATCHER_INTERVAL_MS);
};

const areTabsSyncedWithPanes = (panes: Element[]): boolean => {
  const tabsContainer = getTabsContainer(APP_SETTINGS_CONFIG.isVerticalTabs);
  if (!tabsContainer) return false;
  const tabs = Array.from(tabsContainer.querySelectorAll<HTMLElement>(`:scope > ${TAB_SELECTOR}`));
  if (tabs.length !== panes.length) return false;

  return tabs.every((tab, index) => {
    const paneId = getPaneIdFromPane(panes[index]) || `pane-${index}`;

    return tab.dataset.paneId === paneId;
  });
};

const ensurePaneOrderAndTabsSync = (newPanesOrder: Element[]): void => {
  paneOrderSyncTarget = newPanesOrder.slice();
  if (paneOrderSyncInterval !== null) return;

  paneOrderSyncInterval = setInterval(() => {
    if (!globalState.isPanesModeModeActive) {
      stopPaneOrderSync();

      return;
    }

    const container = getScrollablePanesContainer();
    if (!container) return;

    if (!paneOrderSyncTarget || paneOrderSyncTarget.length === 0) {
      stopPaneOrderSync();

      return;
    }

    const existingPanesFromOrder = paneOrderSyncTarget.filter(
      pane => pane.isConnected && container.contains(pane)
    );

    if (existingPanesFromOrder.length === 0) {
      stopPaneOrderSync();

      return;
    }
    paneOrderSyncTarget = existingPanesFromOrder;

    const currentDomPanes = getCurrentSidebarPanes(container);
    const panesInPlace = !arePanesDifferent(existingPanesFromOrder, currentDomPanes);

    if (!panesInPlace) {
      existingPanesFromOrder.forEach((pane, index) => {
        if (container.children[index] === pane) return;
        const referenceNode = container.children[index] ?? null;
        container.insertBefore(pane, referenceNode);
      });
    }

    const updatedPanes = getCurrentSidebarPanes(container);
    const tabsSynced = areTabsSyncedWithPanes(updatedPanes);
    if (!panesInPlace || !tabsSynced) {
      refreshPanesElementsCache(updatedPanes);
      updatePanesOrderInStorage(updatedPanes);
      updateTabs(updatedPanes);
    }

    if (!arePanesDifferent(existingPanesFromOrder, updatedPanes) && tabsSynced) {
      stopPaneOrderSync();
    }
  }, PANE_SYNC_INTERVAL_MS);
};

const restoreCachedPaneOrder = (container: HTMLElement): void => {
  let didMutate = false;
  globalState.cachedPanes.forEach((pane, index) => {
    const currentPanes = getCurrentSidebarPanes(container);
    if (currentPanes[index] === pane) return;
    if (!didMutate) {
      globalState.expectedMutations.push(EXPECTED_MUTATIONS.newSidebarItemsReordering);
      didMutate = true;
    }
    const referenceNode = currentPanes[index] ?? null;
    container.insertBefore(pane, referenceNode);
  });
  updatePanesOrderInStorage(getCurrentSidebarPanes(container));
};

const isLogseqReorderingMutation = (mutations: MutationRecord[]) => {
  const addedPanes: HTMLElement[] = [];

  mutations.forEach(mutation => {
    if (mutation.type !== 'childList') return;

    mutation.addedNodes.forEach((node: HTMLElement) => {
      console.log('Added node in mutation:', node);
      if (node.classList?.contains('sidebar-item')) {
        addedPanes.push(node);
      }
    });
  });

  if (addedPanes.length === 0) return false;

  const isReorderingMutation = addedPanes.every(pane => globalState.cachedPanes.includes(pane));

  return isReorderingMutation;
};

const checkIfNativeCloseMutation = (
  mutations: MutationRecord[],
  currentSidebarPanes: Element[]
): Element | null => {
  const panesCountDiff = globalState.cachedPanes.length - currentSidebarPanes.length;
  if (panesCountDiff !== 1) return null;

  let removedPaneIndex = -1;
  let currentIndex = 0;
  for (let cachedIndex = 0; cachedIndex < globalState.cachedPanes.length; cachedIndex++) {
    const cachedPane = globalState.cachedPanes[cachedIndex];
    if (
      currentIndex < currentSidebarPanes.length &&
      currentSidebarPanes[currentIndex] === cachedPane
    ) {
      currentIndex++;
    } else if (removedPaneIndex === -1) {
      removedPaneIndex = cachedIndex;
    } else {
      return null;
    }
  }

  if (removedPaneIndex === -1 && currentIndex === currentSidebarPanes.length) {
    removedPaneIndex = globalState.cachedPanes.length - 1;
  }

  if (currentIndex !== currentSidebarPanes.length || removedPaneIndex === -1) {
    return null;
  }

  let removedPane: Element | null = null;
  let addedNodesCount = 0;

  mutations.forEach(mutation => {
    if (mutation.type !== 'childList') return;
    addedNodesCount += mutation.addedNodes.length;
    mutation.removedNodes.forEach((node: any) => {
      if (node.classList?.contains('sidebar-item')) {
        removedPane = node;
      }
    });
  });

  const isValidMutationCount = mutations.length >= 1 && mutations.length <= 2;
  const hasNoAddedNodes = addedNodesCount === 0;
  const hasOneRemovedPane = removedPane !== null;

  if (isValidMutationCount && hasNoAddedNodes && hasOneRemovedPane) {
    return removedPane;
  }

  return null;
};

const getFreshPendingShiftClick = (): PendingShiftClick | null => {
  const pending = globalState.pendingShiftClick;
  if (!pending) return null;
  if (Date.now() - pending.timestamp > SHIFT_CLICK_TIMEOUT_MS) {
    globalState.pendingShiftClick = null;

    return null;
  }

  return pending;
};

const handleShiftClickPaneOpen = (
  pending: PendingShiftClick,
  currentSidebarPanes: Element[],
  resizeObserver: ResizeObserver
): boolean => {
  const container = getScrollablePanesContainer();
  if (!container) return false;
  // Allow new pane detection for blocks (they open as page panes)
  const allowNewPane = !pending.searchSection || pending.searchSection === 'block';
  const targetPane =
    (allowNewPane ? getNewPaneCandidate(currentSidebarPanes) : null) ??
    resolveShiftClickTargetPane(pending, currentSidebarPanes);
  if (!targetPane) return false;

  const isNewPane = !globalState.cachedPanes.includes(targetPane);
  if (isNewPane) {
    const newPaneId = getPaneIdFromPane(targetPane);
    enforceMaxTabsLimit(newPaneId || undefined);
    observePaneForResize(resizeObserver, targetPane);
    enableFitContentForNewPane(targetPane);
    applyPaneDimensions(targetPane as HTMLElement);
  }

  const activePane = resolveActivePaneFromPending(pending, currentSidebarPanes);
  const updatedPanes = reorderPaneNextToActive(targetPane, activePane, container);
  if (!updatedPanes) {
    globalState.pendingShiftClick = null;

    return false;
  }

  const indexToFocus = updatedPanes.indexOf(targetPane);
  if (indexToFocus !== -1) {
    setActivePaneByIndex(indexToFocus, updatedPanes, isNewPane);
  }
  updatePanesOrderInStorage(updatedPanes);
  updateTabs(updatedPanes);
  ensurePaneOrderAndTabsSync(updatedPanes);
  globalState.lastShiftClickHandledAt = Date.now();
  globalState.pendingShiftClick = null;

  return true;
};

const handleNativeReopenExistingPane = (reorderedPaneIndex: number): boolean => {
  if (globalState.currentActivePaneIndex === null) return false;
  const container = getScrollablePanesContainer();
  if (!container) return false;
  const reorderedPane = globalState.cachedPanes[reorderedPaneIndex] as HTMLElement | undefined;
  if (!reorderedPane) return false;
  const activePane = globalState.cachedPanes[globalState.currentActivePaneIndex];
  if (!activePane) return false;
  if (activePane === reorderedPane) return false;

  const updatedPanes = reorderPaneNextToActive(reorderedPane, activePane, container);
  if (!updatedPanes) return false;

  const indexToFocus = updatedPanes.indexOf(reorderedPane);
  if (indexToFocus !== -1) {
    setActivePaneByIndex(indexToFocus, updatedPanes);
  }
  updatePanesOrderInStorage(updatedPanes);
  updateTabs(updatedPanes);
  ensurePaneOrderAndTabsSync(updatedPanes);

  return true;
};

// One day i will refactor it, but not today
export const createPanesMutationObserver = (resizeObserver: ResizeObserver): MutationObserver => {
  moduleResizeObserver = resizeObserver;
  const panesContainerMutationsObserver = new MutationObserver(mutations => {
    console.log('Panes mutations detected:', mutations);
    globalState.lastPanesMutationAt = Date.now();
    const pluginSettings = getPluginSettings();

    console.log('Cached panes before mutation handling:', globalState.cachedPanes);
    const currentSidebarPanes = getCurrentSidebarPanes();
    console.log('Current sidebar panes start of mutation handling:', currentSidebarPanes);
    console.log('Global state before mutation handling:', globalState);

    const hasSidebarPanesChanged =
      currentSidebarPanes.length !== globalState.cachedPanes.length ||
      currentSidebarPanes.some((pane, index) => pane !== globalState.cachedPanes[index]);

    const isNativeReorderingMutation = isLogseqReorderingMutation(mutations);
    const nativelyClosedPane = hasSidebarPanesChanged
      ? checkIfNativeCloseMutation(mutations, currentSidebarPanes)
      : null;

    if (hasSidebarPanesChanged) {
      updatePanesOrderInStorage(currentSidebarPanes);
    }

    if (globalState.expectedMutations.length > 0) {
      const expectedMutation = globalState.expectedMutations.shift();
      console.log('Expected mutation detected:', expectedMutation);
      refreshPanesElementsCache(currentSidebarPanes);
      if (expectedMutation === EXPECTED_MUTATIONS.dragAndDropItemReordering) {
        updateTabs(currentSidebarPanes);
        ensurePaneOrderAndTabsSync(currentSidebarPanes);
      }

      return;
    }

    if (nativelyClosedPane) {
      const closedPaneIndex = globalState.cachedPanes.indexOf(nativelyClosedPane);
      const activeIndex = globalState.currentActivePaneIndex;

      if (activeIndex !== null && currentSidebarPanes.length > 0) {
        if (closedPaneIndex === activeIndex) {
          const newFocusIndex =
            closedPaneIndex >= currentSidebarPanes.length
              ? currentSidebarPanes.length - 1
              : closedPaneIndex;
          setActivePaneByIndex(newFocusIndex, currentSidebarPanes);
        } else {
          const adjustedIndex =
            activeIndex > closedPaneIndex ? activeIndex - 1 : activeIndex;
          setActivePaneByIndex(adjustedIndex, currentSidebarPanes);
        }
      }
      ensurePaneOrderAndTabsSync(currentSidebarPanes);
      updateTabs(currentSidebarPanes);
      refreshPanesElementsCache(currentSidebarPanes);

      return;
    }

    const pendingShiftClick = getFreshPendingShiftClick();
    if (pendingShiftClick) {
      const handledShiftClick = handleShiftClickPaneOpen(
        pendingShiftClick,
        currentSidebarPanes,
        resizeObserver
      );
      if (handledShiftClick) {
        // handleShiftClickPaneOpen already called ensurePaneOrderAndTabsSync
        // with the correct reordered panes — do NOT call it again with the
        // stale currentSidebarPanes snapshot, as that would overwrite the
        // sync target and reverse the reorder on the next interval tick.
        refreshPanesElementsCache();
        stopShiftClickPaneWatcher();

        return;
      }
    }

    if (isNativeReorderingMutation) {
      const timeSinceShiftClick = Date.now() - globalState.lastShiftClickHandledAt;
      if (
        globalState.lastShiftClickHandledAt &&
        timeSinceShiftClick < SHIFT_CLICK_NATIVE_IGNORE_MS
      ) {
        const container = getScrollablePanesContainer();
        if (container) {
          console.log('Ignoring native reordering after shift click');
          restoreCachedPaneOrder(container);
          ensurePaneOrderAndTabsSync(getCurrentSidebarPanes(container));
        }
        refreshPanesElementsCache();

        return;
      }
      console.log('mutations', mutations);
      const reorderedPane = mutations
        .flatMap(mutation => Array.from(mutation.addedNodes))
        .find(node => {
          const el = node as HTMLElement | null;

          return Boolean(
            el?.classList?.contains('sidebar-item') && globalState.cachedPanes.includes(el)
          );
        }) as HTMLElement | undefined;

      console.log('reorderedPane', reorderedPane);
      const reorderedPaneIndex = globalState.cachedPanes.indexOf(reorderedPane);

      const handled = handleNativeReopenExistingPane(reorderedPaneIndex);
      if (!handled) {
        const container = getScrollablePanesContainer();
        if (container) {
          restoreCachedPaneOrder(container);
          const restoredPanes = getCurrentSidebarPanes(container);
          updateTabs(restoredPanes);
          ensurePaneOrderAndTabsSync(restoredPanes);
        }
      }
      refreshPanesElementsCache();

      return;
    }

    const unwantedLogseqRearrangements: Element[] = [];
    let didPushExpectedMutationForNewPane = false;

    mutations.forEach(mutation => {
      mutation.addedNodes.forEach(node => {
        const addedNode = node as Element;
        if (addedNode.classList && addedNode.classList.contains('sidebar-item')) {
          const addedPane = addedNode as HTMLElement;
          if (globalState.cachedPanes.includes(addedPane)) {
            unwantedLogseqRearrangements.push(addedPane);

            return;
          }
          const newPaneId = getPaneIdFromPane(addedPane);

          if (pluginSettings.autoCloseOldestTab) {
            const isReopenedPane = Boolean(
              newPaneId &&
              globalState.cachedPanes.some(pane => getPaneIdFromPane(pane) === newPaneId)
            );
            if (isReopenedPane) return;

            enforceMaxTabsLimit(newPaneId || undefined);
          }

          if (!didPushExpectedMutationForNewPane) {
            globalState.expectedMutations.push(EXPECTED_MUTATIONS.newSidebarItemsReordering);
            didPushExpectedMutationForNewPane = true;
          }
          const panesContainer = getScrollablePanesContainer();
          if (!panesContainer) return;
          const sidebarPanesAfterAddedNode = getCurrentSidebarPanes(panesContainer);

          const activePane = getActivePaneElement(sidebarPanesAfterAddedNode);
          const activePaneNewPosition = activePane
            ? sidebarPanesAfterAddedNode.indexOf(activePane)
            : -1;
          observePaneForResize(resizeObserver, addedPane);
          enableFitContentForNewPane(addedPane);
          applyPaneDimensions(addedPane);
          if (globalState.alwaysOpenPanesAtBegining) {
            panesContainer.insertBefore(addedPane, panesContainer.firstChild);
          } else if (activePaneNewPosition !== -1) {
            panesContainer.insertBefore(
              addedPane,
              sidebarPanesAfterAddedNode[activePaneNewPosition + 1]
            );
          }
          const updatedPanes = getCurrentSidebarPanes(panesContainer);
          const newPaneIndex = updatedPanes.indexOf(addedPane);
          setActivePaneByIndex(newPaneIndex, updatedPanes, true);
          updatePanesOrderInStorage(updatedPanes);
          updateTabs(updatedPanes);
          ensurePaneOrderAndTabsSync(updatedPanes);
        }
      });
    });

    if (unwantedLogseqRearrangements.length > 0) {
      const container = getScrollablePanesContainer();
      if (container) {
        restoreCachedPaneOrder(container);
      }
    }

    refreshPanesElementsCache();
  });

  return panesContainerMutationsObserver;
};

export const startPanesMutationObserver = (observer: MutationObserver): void => {
  void waitForDomChanges(() => {
    const tabsContainer = getScrollablePanesContainer();
    if (!tabsContainer) {
      console.warn('Panes container not found, skipping mutation observer setup.');

      return;
    }
    observer.observe(tabsContainer, { childList: true });
  }, 3);
};
