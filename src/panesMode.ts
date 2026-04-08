import '@logseq/libs';
import { APP_SETTINGS_CONFIG } from './core/constants';
import {
  applyPanesModeStyles,
  clearInjectedStyles,
  hideLeftSide,
  showLeftSide,
  manageActionButtonsPosition,
  restoreActionButtonsToHeader,
  initCustomSidebarResize,
  cleanupCustomSidebarResize,
} from './features/layout/layout';
import { globalState, resetState } from './core/pluginGlobalState';
import {
  initPluginSettings,
  onSettingsUpdated,
  resetSettingsToDefaults,
} from './core/pluginSettings';
import { showSuccess } from './core/utils';
import { applyInitialPanesOrder } from './features/panes/paneOrdering';
import {
  applyInitialPaneSizes,
  addScrollListenersToAllPanes,
  disconnectPaneCollapseObserver,
  removeScrollListenerFromPane,
} from './features/panes/paneLayout';
import { getCurrentSidebarPanes, refreshPanesElementsCache } from './features/panes/paneCache';
import { createPaneResizeObserver, addPanesResizeObserver } from './features/panes/paneResize';
import {
  createPanesMutationObserver,
  startPanesMutationObserver,
  stopContainerWatchdog,
} from './features/observers/paneMutations';
import { setupShiftClickPaneTracking } from './features/panes/shiftActions/paneShiftClick';
import { setActivePaneByIndex, resetActiveTabIndex } from './features/panes/paneNavigation';
import { preventNativeCloseShortcut, setupKeyboardShortcuts } from './features/keyboard/keyboard';
import { setupMousePaneFocus } from './features/panes/paneFocusListeners';
import { setupNativeDragDropListener } from './features/panes/paneNativeDnd';
import { createTabsContainer, resetTabsState, updateTabs } from './features/tabs/tabs';
import {
  cleanupPaneSwitcher,
  initPaneSwitcherModal,
} from './features/panes/paneSwitcher/paneSwitcher';
import { cleanupProjects, initProjectsModal } from './features/projects/projects';
import { cleanLeftPanes, cleanRightPanes, cleanUnusedPanes } from './features/panes/paneActions';
import { initLeftSidebarObserver } from './features/observers/leftSidebarObserver';
import {
  getMainContent,
  getPaneIdToElementMap,
  getRightSidebar,
  getRightSidebarContainer,
  getTabsContainer,
  isRightSidebarVisible,
} from './core/domUtils';
import { resetMultiColumnLayout } from './features/panes/paneMultiColumn';
import { registerToolbarUIItems } from './features/toolbar/toolbar';

let cleanupAutoPaneFocus: (() => void) | null = null;
let cleanupNativeDragDropListener: (() => void) | null = null;
let cleanupPreventNativeCloseShortcut: (() => void) | null = null;
let cleanupShiftClickTracking: (() => void) | null = null;
let resizeObserver: ResizeObserver | null = null;
let panesContainerMutationsObserver: MutationObserver | null = null;
let leftSidebarObserver: MutationObserver | null = null;
let pendingPanesModeModeSetupInterval: ReturnType<typeof setInterval> | null = null;
let reactivateAfterRightSidebarShown = false;
const RIGHT_WINDOW_CONTROLS_CLASS = 'panesMode-native-right-window-controls';

const main = async () => {
  await initPluginSettings();

  applyPanesModeStyles(false);

  await setupKeyboardShortcuts(togglePanesModeModeState);

  const resetSettings = createResetSettingsHandler();

  registerCommandPaletteItems(resetSettings);
  registerSettingsListeners();
  registerToolbarUIItems();
  registerAppEventHandlers();
  registerModelHandlers(resetSettings);
  registerBeforeUnload();

  console.info('PanesMode plugin fully loaded and ready.');
};

const createResetSettingsHandler = () => {
  return async () => {
    const wasActive = globalState.isPanesModeModeActive;

    await resetSettingsToDefaults();
    await setupKeyboardShortcuts(togglePanesModeModeState);

    if (wasActive) {
      applyPanesModeStyles();
    }

    showSuccess('PanesMode settings reset to defaults');
  };
};

const registerSettingsListeners = () => {
  onSettingsUpdated((settings, previous) => {
    setupKeyboardShortcuts(togglePanesModeModeState);
    if (globalState.isPanesModeModeActive) {
      applyPanesModeStyles(true);
      if (previous?.isVerticalTabs !== settings.isVerticalTabs) {
        rebuildTabsForOrientationChange();
      }
    }
  });
};

const registerAppEventHandlers = () => {
  logseq.App.onSidebarVisibleChanged(handleSidebarVisibilityChange);
  logseq.App.onThemeModeChanged(() => {
    const includeLayout = globalState.isPanesModeModeActive;
    applyPanesModeStyles(includeLayout);
  });
};

const registerModelHandlers = (resetSettings: () => Promise<void>) => {
  logseq.provideModel({
    async togglePanesModeMode() {
      await togglePanesModeModeState();
    },
    async resetPanesModeSettings() {
      await resetSettings();
    },
    async cleanLeftPanes() {
      if (!globalState.isPanesModeModeActive) return;
      cleanLeftPanes(updateTabs);
    },
    async cleanRightPanes() {
      if (!globalState.isPanesModeModeActive) return;
      cleanRightPanes(updateTabs);
    },
    async cleanUnusedPanes() {
      if (!globalState.isPanesModeModeActive) return;
      cleanUnusedPanes(updateTabs);
    },
    async hideLeftSide() {
      if (!globalState.isPanesModeModeActive) return;
      hideLeftSide();
    },
    async showLeftSide() {
      if (!globalState.isPanesModeModeActive) return;
      showLeftSide();
    },
    async syncPanesOrder() {
      if (!globalState.isPanesModeModeActive) return;
      const currentPanes = getCurrentSidebarPanes();
      refreshPanesElementsCache(currentPanes);
      setActivePaneByIndex(0, currentPanes);
      updateTabs(currentPanes);
      showSuccess('Panes order synced');
    },
  });
};

const registerBeforeUnload = () => {
  logseq.beforeunload(async () => {
    if (globalState.isPanesModeModeActive) {
      cleanupPanesModeMode();
    }
    clearInjectedStyles();
  });
};

const registerCommandPaletteItems = (resetSettings: () => Promise<void>) => {
  logseq.App.registerCommandPalette(
    {
      key: 'panesMode.reset_settings',
      label: 'Reset PanesMode settings',
    },
    resetSettings
  );
};

const togglePanesModeModeState = async (forceState?: boolean): Promise<void> => {
  const shouldEnable = forceState ?? !globalState.isPanesModeModeActive;
  globalState.isPanesModeModeActive = shouldEnable;

  if (!shouldEnable) {
    disablePanesModeMode();

    return;
  }

  await enablePanesModeMode();
};

const enablePanesModeMode = async (): Promise<void> => {
  if (!isRightSidebarVisible()) {
    await logseq.App.setRightSidebarVisible(true);
  }

  schedulePanesModeModeSetup();
};

const disablePanesModeMode = () => {
  cleanupPanesModeMode();
  showSuccess('PanesMode Deactivated');
};

const handleSidebarVisibilityChange = ({ visible: newVisibilityState }: { visible: boolean }) => {
  if (globalState.isPanesModeModeActive && !newVisibilityState) {
    reactivateAfterRightSidebarShown = true;
    togglePanesModeModeState(false);
  }
  if (reactivateAfterRightSidebarShown && newVisibilityState) {
    reactivateAfterRightSidebarShown = false;
    togglePanesModeModeState(true);
  }
};

const clearPendingPanesModeModeSetup = () => {
  if (pendingPanesModeModeSetupInterval) {
    clearInterval(pendingPanesModeModeSetupInterval);
    pendingPanesModeModeSetupInterval = null;
  }
};

const schedulePanesModeModeSetup = () => {
  if (!globalState.isPanesModeModeActive || pendingPanesModeModeSetupInterval) return;

  pendingPanesModeModeSetupInterval = setInterval(() => {
    activatePanesModeMode();
  }, 100);
};

const activatePanesModeMode = async () => {
  if (!globalState.isPanesModeModeActive) return;

  const currentPanes = getCurrentSidebarPanes();
  if (currentPanes.length === 0) return;

  applyPanesModeModeUi();
  initializeTabsState();
  initializeModalsAndInputs();
  applyInitialPaneState(currentPanes);
  setupPaneObservers(currentPanes);

  showSuccess('PanesMode Activated!');
  clearPendingPanesModeModeSetup();
};

const applyPanesModeModeUi = () => {
  applyPanesModeStyles(true);

  parent.document.body.classList.add('panesMode-active');
  parent.document.body.classList.toggle(
    RIGHT_WINDOW_CONTROLS_CLASS,
    globalState.isWindows || globalState.isLinux
  );
};

const initializeTabsState = () => {
  createTabsContainer();
  refreshPanesElementsCache();
  setActivePaneByIndex(0);
  updateTabs();
};

const initializeModalsAndInputs = () => {
  initPaneSwitcherModal();
  // TODO: Check project modal agentic slop
  initProjectsModal();
  initCustomSidebarResize();

  cleanupAutoPaneFocus = setupMousePaneFocus();
  cleanupNativeDragDropListener = setupNativeDragDropListener();
  cleanupShiftClickTracking = setupShiftClickPaneTracking();
  cleanupPreventNativeCloseShortcut = preventNativeCloseShortcut(updateTabs);
};

const applyInitialPaneState = (currentPanes: Element[]) => {
  const idToPaneMap = getPaneIdToElementMap(currentPanes);

  applyInitialPanesOrder(idToPaneMap, updateTabs, setActivePaneByIndex);
  applyInitialPaneSizes(idToPaneMap);
};

const setupPaneObservers = (currentPanes: Element[]) => {
  resizeObserver = createPaneResizeObserver();
  addPanesResizeObserver(resizeObserver, currentPanes);
  addScrollListenersToAllPanes();

  panesContainerMutationsObserver = createPanesMutationObserver(resizeObserver);
  startPanesMutationObserver(panesContainerMutationsObserver);

  leftSidebarObserver = initLeftSidebarObserver();
};

const cleanupPanesModeMode = () => {
  clearPendingPanesModeModeSetup();
  console.info('Cleaning up PanesMode...');

  resetMultiColumnLayout();
  applyPanesModeStyles(false);

  resetBodyClasses();
  resetPanesState();
  cleanupObservers();
  resetSidebarLayout();
  cleanupTabsUi();
  cleanupFeatureUi();
  cleanupGlobalHandlers();

  resetState();
  console.info('PanesMode cleanup complete.');
};

const resetBodyClasses = () => {
  parent.document.body.classList.remove('panesMode-active');
  parent.document.body.classList.remove('panesMode-sticky-headers');
  parent.document.body.classList.remove(RIGHT_WINDOW_CONTROLS_CLASS);
};

const resetPanesState = () => {
  getCurrentSidebarPanes().forEach(pane => {
    const paneElement = pane as HTMLElement;

    paneElement.style.width = '';
    paneElement.style.height = '';
    paneElement.classList.remove(
      'panesMode-fit-content',
      'panesMode-collapse-vertical',
      'panesMode-collapse-horizontal',
      'panesMode-pane-drag-target',
      'selectedPane'
    );

    delete paneElement.dataset.panesModeFitContent;
    delete paneElement.dataset.panesModeFitContentInitialWidth;
    delete paneElement.dataset.panesModeFitContentBaselineHeightPx;
    delete paneElement.dataset.currentIndex;

    paneElement
      .querySelectorAll('.panesMode-fit-content-toggle')
      .forEach(toggle => toggle.remove());
    paneElement
      .querySelectorAll('.panesMode-collapse-orientation-toggle')
      .forEach(toggle => toggle.remove());
    paneElement.querySelectorAll('.panesMode-pane-drop-zones').forEach(zones => zones.remove());

    delete (paneElement as any)._prevCollapsed;
    if ((pane as any)._isResizeObserved) {
      delete (pane as any)._isResizeObserved;
    }

    disconnectPaneCollapseObserver(pane);
    removeScrollListenerFromPane(pane);
  });
};

const resetSidebarLayout = () => {
  const rightSidebar = getRightSidebar();
  const mainContent = getMainContent();

  if (mainContent?.style.display === 'none') {
    showLeftSide();
  }

  rightSidebar?.classList.remove('fullRightSidebar', 'doubleRightSidebar');
  restoreActionButtonsToHeader();
};

const cleanupTabsUi = () => {
  const tabsContainer = getTabsContainer(APP_SETTINGS_CONFIG.isVerticalTabs);
  tabsContainer?.remove();

  const rightSideContainer = getRightSidebarContainer();
  rightSideContainer?.classList.remove('right-sidebar-vertical-tabs');

  resetTabsState();
  resetActiveTabIndex();
};

const cleanupFeatureUi = () => {
  cleanupPaneSwitcher();
  cleanupProjects();
  cleanupCustomSidebarResize();
};

const cleanupGlobalHandlers = () => {
  if (globalState.keyboardEventHandler) {
    parent.window.removeEventListener('keydown', globalState.keyboardEventHandler, true);
    globalState.keyboardEventHandler = null;
  }

  if (globalState.keyupEventHandler) {
    parent.window.removeEventListener('keyup', globalState.keyupEventHandler, true);
    globalState.keyupEventHandler = null;
  }

  if (cleanupPreventNativeCloseShortcut) {
    cleanupPreventNativeCloseShortcut();
    cleanupPreventNativeCloseShortcut = null;
  }

  if (cleanupAutoPaneFocus) {
    cleanupAutoPaneFocus();
    cleanupAutoPaneFocus = null;
  }

  if (cleanupShiftClickTracking) {
    cleanupShiftClickTracking();
    cleanupShiftClickTracking = null;
  }

  if (cleanupNativeDragDropListener) {
    cleanupNativeDragDropListener();
    cleanupNativeDragDropListener = null;
  }
};

const cleanupObservers = () => {
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }

  panesContainerMutationsObserver?.disconnect();
  panesContainerMutationsObserver = null;

  stopContainerWatchdog();

  leftSidebarObserver?.disconnect();
  leftSidebarObserver = null;
};

const rebuildTabsForOrientationChange = () => {
  const previousVerticalContainer = getTabsContainer(true);
  const previousHorizontalContainer = getTabsContainer(false);
  previousVerticalContainer?.remove();
  previousHorizontalContainer?.remove();

  const rightSideContainer = getRightSidebarContainer();
  rightSideContainer?.classList.toggle(
    'right-sidebar-vertical-tabs',
    APP_SETTINGS_CONFIG.isVerticalTabs
  );

  createTabsContainer();
  updateTabs(getCurrentSidebarPanes());
  manageActionButtonsPosition();
};

logseq.ready(main).catch(console.error);
