export const STORAGE_KEYS = {
  panesOrder: 'panesMode.panesOrder',
  lastActivePanes: 'panesMode.lastActivePanes',
  originalLeftSideWidth: 'panesMode.originalLeftSideWidth',
  paneDimensions: 'panesMode.paneDimensions',
  paneFitContentHeight: 'panesMode.paneFitContentHeight',
  paneCollapseOrientation: 'panesMode.paneCollapseOrientation',
  projects: 'panesMode.projects',
};

export const TABS_CONTAINER_CLASSES = {
  vertical: 'panesMode-tabs-container-vertical',
  horizontal: 'panesMode-tabs-container-horizontal',
};

export const LOGSEQ_UI_SELECTORS = {
  panesContainer: '.sidebar-item-list',
  tabTitle: '.sidebar-item-header div.ml-1:not(.text-sm)',
  paneContentWrapper: '.content',
  commandPalette: '.ui__modal-panel',
  commandPaletteDb: '.cp__cmdk__modal',
  rightSidebarContainer: '#right-sidebar-container',
  rightSidebar: '#right-sidebar',
  leftSidebar: '#left-sidebar',
  leftContainer: '#left-container',
  mainContent: '#main-content-container',
};

export const PLUGIN_UI_SELECTORS = {
  tabsVertical: '.panesMode-tabs-container-vertical',
  tabsHorizontal: '.panesMode-tabs-container-horizontal',
  paneSwitcherModal: '#panesMode-pane-switcher-modal',
  paneSwitcherModalId: 'panesMode-pane-switcher-modal',
  projectsModal: '#panesMode-projects-modal',
  projectsModalId: 'panesMode-projects-modal',
  customStylesKey: 'panesMode-styles',
};

export const APP_SETTINGS_CONFIG = {
  defaultMaxTabs: 5,
  isVerticalTabs: false,
  isDBVersion: false,
  activePaneScrollOverflowBuffer: 10,
  activeTabOverflowCoefficient: 0.35,
  moreButtonActivationProximityPx: 200,
  resizeStoreDebounceMs: 250,
};

export const LOCAL_STORAGE_SAVINGS_LIMITS = {
  maxEntries: 500,
  pruneBatchSize: 100,
};
