import { APP_SETTINGS_CONFIG } from './constants';
import type { ProjectListItem } from '../features/projects/types';
import type { ExpectedMutation } from '../features/observers/types';
import type { PendingShiftClick } from '../features/panes/shiftActions/types';

export type GlobalState = {
  isPanesModeModeActive: boolean;
  multiColumnPageIds: string[];
  currentActivePaneIndex: number | null;
  tabsVisible: boolean;
  keyboardEventHandler: ((e: KeyboardEvent) => void) | null;
  keyupEventHandler: ((e: KeyboardEvent) => void) | null;
  draggedTabIndex: number | null;
  cachedPanes: Element[];
  alwaysOpenPanesAtBegining: boolean;
  maxTabs: number;
  isPaneSwitcherModalVisible: boolean;
  paneSwitcherSelectedIndex: number;
  paneSwitcherFilteredPanes: Element[];
  expectedMutations: ExpectedMutation[];
  pendingShiftClick: PendingShiftClick | null;
  lastPanesMutationAt: number;
  lastShiftClickHandledAt: number;
  isMacDesktop: boolean;
  isWindows: boolean;
  isLinux: boolean;
  isProjectsModalVisible: boolean;
  projectsSelectedIndex: number;
  projectsFilteredList: ProjectListItem[];
};

export const globalState: GlobalState = {
  isPanesModeModeActive: false,
  multiColumnPageIds: [],
  currentActivePaneIndex: 0,
  tabsVisible: true,
  keyboardEventHandler: null,
  keyupEventHandler: null,
  draggedTabIndex: null,
  cachedPanes: [],
  alwaysOpenPanesAtBegining: false,
  maxTabs: APP_SETTINGS_CONFIG.defaultMaxTabs,
  isPaneSwitcherModalVisible: false,
  paneSwitcherSelectedIndex: 0,
  paneSwitcherFilteredPanes: [],
  expectedMutations: [],
  pendingShiftClick: null,
  lastPanesMutationAt: 0,
  lastShiftClickHandledAt: 0,
  isMacDesktop: /Mac/.test(navigator.platform),
  isWindows: /Win/.test(navigator.platform),
  isLinux: /Linux/.test(navigator.platform),
  isProjectsModalVisible: false,
  projectsSelectedIndex: 0,
  projectsFilteredList: [],
};

export const isActivePaneIndexValid = (panes: Element[] = globalState.cachedPanes): boolean =>
  globalState.currentActivePaneIndex !== null &&
  globalState.currentActivePaneIndex >= 0 &&
  globalState.currentActivePaneIndex < panes.length;

export const resetState = (): void => {
  globalState.multiColumnPageIds = [];
  globalState.currentActivePaneIndex = 0;
  globalState.tabsVisible = true;
  globalState.keyboardEventHandler = null;
  globalState.keyupEventHandler = null;
  globalState.draggedTabIndex = null;
  globalState.cachedPanes = [];
  globalState.paneSwitcherFilteredPanes = [];
  globalState.paneSwitcherSelectedIndex = 0;
  globalState.isPaneSwitcherModalVisible = false;
  globalState.expectedMutations = [];
  globalState.pendingShiftClick = null;
  globalState.lastPanesMutationAt = 0;
  globalState.lastShiftClickHandledAt = 0;
  globalState.isProjectsModalVisible = false;
  globalState.projectsSelectedIndex = 0;
  globalState.projectsFilteredList = [];
};
