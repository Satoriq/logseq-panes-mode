// AI generated file, dont overthink
import { APP_SETTINGS_CONFIG, LOGSEQ_UI_SELECTORS } from '../../core/constants';
import {
  getPaneIdFromPane,
  getScrollablePanesContainer,
  getTabsContainer,
} from '../../core/domUtils';
import { globalState, isActivePaneIndexValid } from '../../core/pluginGlobalState';
import { EXPECTED_MUTATIONS } from '../observers/types';
import { closePaneByIndex, togglePaneCollapse } from '../panes/paneActions';
import { getCurrentSidebarPanes, getSidebarPanes } from '../panes/paneCache';
import { setActivePaneByIndex } from '../panes/paneNavigation';
import { updatePanesOrderInStorage } from '../panes/panePersistence';
import { hidePaneSwitcherModal, showPaneSwitcherModal } from '../panes/paneSwitcher/paneSwitcher';
import { hideProjectsModal, showProjectsModal } from '../projects/projects';
import { updateTabs } from '../tabs/tabs';
import { toggleMultiColumnForPane } from '../panes/paneMultiColumn';
import { exitIfEditing, waitForDomChanges } from '../../core/utils';
import { getPluginSettings } from '../../core/pluginSettings';

// --- Module state ---

let cleanupPaletteHotkeys: (() => void) | null = null;
let cleanupPaneArrowHotkeys: (() => void) | null = null;

// --- Shortcut registration helpers ---

const isBindingAlreadyRegistered = (
  commandKey: string,
  binding: string,
  existingShortcuts: Record<string, string | string[] | undefined>
) => {
  const pluginId = logseq.baseInfo?.id ? `plugin.${logseq.baseInfo.id}/${commandKey}` : commandKey;
  const existing = existingShortcuts[pluginId] ?? existingShortcuts[commandKey];
  const normalizedTarget = binding.toLowerCase();
  if (existing) {
    const bindings = Array.isArray(existing) ? existing : [existing];
    if (bindings.some(b => b?.toLowerCase() === normalizedTarget)) return true;
  }

  return Object.values(existingShortcuts).some(value => {
    if (!value) return false;
    const list = Array.isArray(value) ? value : [value];

    return list.some(b => b?.toLowerCase() === normalizedTarget);
  });
};

const createShortcutRegistrar = (
  usedBindings: Set<string>,
  existingShortcuts: Record<string, string | string[] | undefined>
) => {
  return (
    key: string,
    label: string,
    binding: string,
    handler: () => Promise<void> | void,
    requiresPanesMode: boolean = true
  ) => {
    const wrappedHandler = async () => {
      if (requiresPanesMode && !globalState.isPanesModeModeActive) return;
      await handler();
    };

    logseq.App.registerCommandPalette({ key, label }, wrappedHandler);

    if (!binding) return;

    const normalizedBinding = binding.trim().toLowerCase();
    if (!normalizedBinding || usedBindings.has(normalizedBinding)) return;

    usedBindings.add(normalizedBinding);

    try {
      if (!isBindingAlreadyRegistered(key, normalizedBinding, existingShortcuts)) {
        logseq.App.registerCommandShortcut({ binding }, wrappedHandler, {
          key,
          label,
          desc: label,
        });
      }
    } catch (err: any) {
      console.info(`[PanesMode] Skipping duplicate shortcut ${binding}:`, err?.message ?? err);
    }
  };
};

const getExistingShortcuts = async (): Promise<Record<string, string | string[] | undefined>> => {
  const userConfigs = await logseq.App.getUserConfigs().catch(() => null);

  return (userConfigs as any)?.shortcuts ?? {};
};

// --- Command palette ---

const getCommandPaletteRoot = (): HTMLElement | null => {
  const paletteRoot = parent.document.querySelector(
    LOGSEQ_UI_SELECTORS.commandPalette
  ) as HTMLElement | null;
  if (!paletteRoot) return null;
  const isHidden =
    paletteRoot.getAttribute('aria-hidden') === 'true' ||
    paletteRoot.style.display === 'none' ||
    paletteRoot.clientHeight === 0 ||
    !paletteRoot.offsetParent;

  return isHidden ? null : paletteRoot;
};

const moveCommandPaletteSelection = (direction: 'up' | 'down'): boolean => {
  const paletteRoot = getCommandPaletteRoot();
  if (!paletteRoot) return false;

  const paletteInput = paletteRoot.querySelector('input') as HTMLElement | null;
  const activeElement = parent.document.activeElement as HTMLElement | null;
  const target =
    (activeElement && paletteRoot.contains(activeElement) && activeElement) ||
    paletteInput ||
    paletteRoot;

  const key = direction === 'down' ? 'ArrowDown' : 'ArrowUp';
  const syntheticEvent = new KeyboardEvent('keydown', {
    key,
    code: key,
    keyCode: direction === 'down' ? 40 : 38,
    which: direction === 'down' ? 40 : 38,
    bubbles: true,
    cancelable: true,
  });
  target.dispatchEvent(syntheticEvent);

  return true;
};

// --- Pane navigation ---

const moveActivePaneByOffset = async (offset: number) => {
  await exitIfEditing();
  if (globalState.cachedPanes.length === 0 || !isActivePaneIndexValid()) return;

  const total = globalState.cachedPanes.length;
  const currentIndex = globalState.currentActivePaneIndex as number;
  const nextIndex = (currentIndex + offset + total) % total;

  setActivePaneByIndex(nextIndex, globalState.cachedPanes, true);
};

const handleNextPane = async () => {
  await moveActivePaneByOffset(1);
};

const handlePrevPane = async () => {
  await moveActivePaneByOffset(-1);
};

const handleFocusActivePane = async () => {
  await exitIfEditing();
  const panes = getCurrentSidebarPanes();
  if (!isActivePaneIndexValid(panes)) return;

  globalState.cachedPanes = panes;

  const activeIndex = globalState.currentActivePaneIndex as number;
  setActivePaneByIndex(activeIndex, panes, false, 1, undefined, false, true);
};

const focusPaneByIndex = async (targetIndex: number) => {
  await exitIfEditing();
  if (targetIndex >= 0 && targetIndex < globalState.cachedPanes.length) {
    setActivePaneByIndex(targetIndex, globalState.cachedPanes, true);
  }
};

const focusPageEdge = async (position: 'top' | 'bottom') => {
  if (!isActivePaneIndexValid()) return;
  const activePane = globalState.cachedPanes[
    globalState.currentActivePaneIndex as number
  ] as HTMLElement;
  if (!activePane) return;

  const blockElements = activePane.querySelectorAll<HTMLElement>('[blockid]');
  if (blockElements.length === 0) return;

  const targetBlock =
    position === 'top' ? blockElements[0] : blockElements[blockElements.length - 1];
  if (!targetBlock.getAttribute('blockid')) return;

  targetBlock.scrollIntoView({ behavior: 'smooth', block: 'center' });
};

const handleFocusTextOnEnter = async () => {
  if (!isActivePaneIndexValid()) return;
  const activePane = globalState.cachedPanes[globalState.currentActivePaneIndex as number];
  if (!activePane) return;
  const blockElements = Array.from(activePane.querySelectorAll<HTMLElement>('[blockid]'));
  if (blockElements.length === 0) return;
  const targetBlock =
    blockElements.find(block => (block.getAttribute('data-refs-self') ?? '').trim() === '') ??
    blockElements[0];
  if (!targetBlock) return;
  const blockId = targetBlock.getAttribute('blockid');
  if (!blockId) return;
  await logseq.Editor.editBlock(blockId, { pos: 0 });
  requestAnimationFrame(() => {
    const active = parent.document.activeElement as HTMLElement | null;
    const editable =
      targetBlock.querySelector<HTMLElement>('[contenteditable="true"], textarea, input') ?? active;
    if (!editable) return;
    if (editable instanceof HTMLInputElement || editable instanceof HTMLTextAreaElement) {
      editable.setSelectionRange(0, 0);

      return;
    }
    if (!editable.isContentEditable) return;
    const selection = parent.window.getSelection();
    if (!selection) return;
    const range = parent.document.createRange();
    range.selectNodeContents(editable);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
  });
};

// --- Pane resize / scroll (arrow keys) ---

const applyPaneArrowKey = (key: string, pane: HTMLElement) => {
  const widthStep = parent.window.innerWidth / 100;
  const scrollStep = pane.offsetHeight * 0.1;
  const MIN_WIDTH = 100;
  switch (key) {
    case 'ArrowUp':
      pane.scrollTop -= scrollStep;
      break;
    case 'ArrowDown':
      pane.scrollTop += scrollStep;
      break;
    case 'ArrowLeft':
      pane.style.width = `${Math.max(MIN_WIDTH, pane.offsetWidth - widthStep)}px`;
      break;
    case 'ArrowRight':
      pane.style.width = `${pane.offsetWidth + widthStep}px`;
      break;
  }
};

const handlePaneArrowShortcut = (
  key: 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight'
): boolean => {
  const panes = globalState.cachedPanes.length > 0 ? globalState.cachedPanes : getSidebarPanes();
  if (!isActivePaneIndexValid(panes)) return false;
  const pane = panes[globalState.currentActivePaneIndex as number] as HTMLElement;
  if (!pane) return false;
  requestAnimationFrame(() => applyPaneArrowKey(key, pane));

  return true;
};

const getEventTargetElement = (target: EventTarget | null): HTMLElement | null => {
  if (!target || typeof (target as Node).nodeType !== 'number') return null;
  const node = target as Node;

  return node.nodeType === Node.ELEMENT_NODE ? (node as HTMLElement) : node.parentElement;
};

const isEditableTarget = (target: EventTarget | null): boolean => {
  const element = getEventTargetElement(target);
  if (!element) return false;

  return Boolean(element.closest('[contenteditable="true"], textarea, input, select'));
};

const getPaneArrowHotkey = (
  e: KeyboardEvent
): 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight' | null => {
  const isMod = e.metaKey || e.ctrlKey;
  if (!isMod || e.altKey) return null;

  switch (e.key) {
    case 'ArrowUp':
    case 'ArrowDown':
      return e.shiftKey ? null : e.key;
    case 'ArrowLeft':
    case 'ArrowRight':
      return e.shiftKey ? e.key : null;
    default:
      return null;
  }
};

// --- Pane management ---

const scrollActiveTabIntoView = () => {
  void waitForDomChanges().then(() => {
    const tabsContainer = getTabsContainer(APP_SETTINGS_CONFIG.isVerticalTabs);
    const activeTab = tabsContainer?.querySelector('.panesMode-tab.active-tab') as HTMLElement;
    if (tabsContainer && activeTab) {
      tabsContainer.scrollTo({ left: activeTab.offsetLeft, behavior: 'smooth' });
    }
  });
};

const handleMoveCurrentPane = async (direction: 'left' | 'right') => {
  await exitIfEditing();

  const panes = getSidebarPanes();
  if (!isActivePaneIndexValid(panes)) return;

  const scrollableContainer = getScrollablePanesContainer();
  if (!scrollableContainer || panes.length === 1) return;

  const currentIndex = globalState.currentActivePaneIndex as number;
  const currentPane = panes[currentIndex];
  const targetIndex =
    direction === 'left'
      ? (currentIndex - 1 + panes.length) % panes.length
      : (currentIndex + 1) % panes.length;
  const targetPane = panes[targetIndex];

  globalState.expectedMutations.push(
    direction === 'left'
      ? EXPECTED_MUTATIONS.movePaneLeftKeyboard
      : EXPECTED_MUTATIONS.movePaneRightKeyboard
  );

  if (direction === 'left') {
    if (currentIndex >= 1) {
      scrollableContainer.insertBefore(currentPane, targetPane);
    } else {
      targetPane.after(currentPane);
    }
  } else if (targetIndex === 0) {
    scrollableContainer.insertBefore(currentPane, panes[0]);
  } else {
    targetPane.after(currentPane);
  }

  const updatedPanes = getCurrentSidebarPanes();
  const newIndex = updatedPanes.indexOf(currentPane);
  setActivePaneByIndex(newIndex, updatedPanes, false, 300);
  updateTabs(updatedPanes);
  updatePanesOrderInStorage(updatedPanes);
  scrollActiveTabIntoView();
};

const handleCloseCurrentPane = async () => {
  await exitIfEditing();

  const panes = getSidebarPanes();
  if (panes.length === 0 || !isActivePaneIndexValid(panes)) return;

  globalState.cachedPanes = panes;
  closePaneByIndex(globalState.currentActivePaneIndex as number, updateTabs);
};

const handleToggleCollapse = async () => {
  await exitIfEditing();
  const panes = getSidebarPanes();
  if (panes.length > 0 && isActivePaneIndexValid(panes)) {
    togglePaneCollapse(globalState.currentActivePaneIndex as number, updateTabs);
  }
};

const handleToggleTabs = async () => {
  globalState.tabsVisible = !globalState.tabsVisible;
  const tabsContainer = getTabsContainer(APP_SETTINGS_CONFIG.isVerticalTabs);
  if (tabsContainer) {
    tabsContainer.classList.toggle('hidden', !globalState.tabsVisible);
  }
};

const toggleMultiColumnForActivePane = async (): Promise<void> => {
  await exitIfEditing();
  const panes = getSidebarPanes(true);
  if (!isActivePaneIndexValid(panes)) {
    globalState.currentActivePaneIndex = panes.length > 0 ? 0 : null;
  }
  if (!isActivePaneIndexValid(panes)) return;
  const activePane =
    globalState.currentActivePaneIndex !== null
      ? (panes[globalState.currentActivePaneIndex] as HTMLElement)
      : null;
  if (activePane) {
    globalState.cachedPanes = panes;
    toggleMultiColumnForPane(activePane);
  }
};

// --- Modal toggles ---

const togglePaneSwitcher = (): void => {
  if (!globalState.isPanesModeModeActive) return;
  if (globalState.isPaneSwitcherModalVisible) {
    hidePaneSwitcherModal();
  } else {
    showPaneSwitcherModal();
  }
};

const toggleProjects = (): void => {
  if (!globalState.isPanesModeModeActive) return;
  if (globalState.isProjectsModalVisible) {
    hideProjectsModal();
  } else {
    showProjectsModal();
  }
};

// --- Debug (dev shortcuts, useful for Github Issues) ---

const logDebugStateAndPanes = () => {
  const panes = getCurrentSidebarPanes();
  const paneSummaries = panes.map(pane => ({
    id: getPaneIdFromPane(pane),
    selected: pane.classList.contains('selectedPane'),
    collapsed: pane.classList.contains('collapsed'),
    className: (pane as HTMLElement).className,
  }));
  console.info('[PanesMode] Debug state', {
    globalState: { ...globalState },
    panes: paneSummaries,
    rawPanes: panes,
  });
};

const logLocalStorage = () => {
  const storage = parent?.localStorage ?? window.localStorage;
  const keys = Object.keys(storage).sort();
  const entries = keys.reduce<Record<string, any>>((acc, key) => {
    const value = storage.getItem(key);
    if (value === null) {
      acc[key] = null;
    } else {
      try {
        acc[key] = JSON.parse(value);
      } catch {
        acc[key] = value;
      }
    }

    return acc;
  }, {});
  console.info(`[PanesMode] Local storage (${keys.length})`, entries);
};

// --- Shortcut group registrations ---

const registerModeShortcuts = (
  registerShortcut: ReturnType<typeof createShortcutRegistrar>,
  togglePanesModeMode: () => Promise<void>
) => {
  registerShortcut(
    'panesMode.toggle',
    'Toggle panesMode mode',
    'mod+shift+y',
    togglePanesModeMode,
    false
  );
};

const registerPaneNavigationShortcuts = (
  registerShortcut: ReturnType<typeof createShortcutRegistrar>
) => {
  registerShortcut('panesMode.nextPane', 'Move active to next pane', 'mod+e', handleNextPane);
  registerShortcut('panesMode.prevPane', 'Move active to previous pane', 'mod+q', handlePrevPane);
  registerShortcut('panesMode.focusBottom', 'Focus bottom of pane', 'mod+g', () =>
    focusPageEdge('bottom')
  );
  registerShortcut('panesMode.focusTop', 'Focus top of pane', 'mod+u', () => focusPageEdge('top'));
  registerShortcut('panesMode.focusActivePane', 'Focus active pane', '', handleFocusActivePane);
};

const registerPaneManagementShortcuts = (
  registerShortcut: ReturnType<typeof createShortcutRegistrar>
) => {
  const { movePaneLeftShortcut, movePaneRightShortcut } = getPluginSettings();

  registerShortcut(
    'panesMode.closePane',
    'Close pane (Cmd/Ctrl+W always works)',
    'mod+w',
    handleCloseCurrentPane
  );
  registerShortcut('panesMode.moveLeft', 'Move pane left in order', movePaneLeftShortcut, () =>
    handleMoveCurrentPane('left')
  );
  registerShortcut('panesMode.moveRight', 'Move pane right in order', movePaneRightShortcut, () =>
    handleMoveCurrentPane('right')
  );
  registerShortcut(
    'panesMode.toggleTabs',
    'Toggle tabs visibility',
    'mod+shift+b',
    handleToggleTabs
  );
  registerShortcut(
    'panesMode.toggleCollapse',
    'Toggle pane collapse',
    'mod+shift+c',
    handleToggleCollapse
  );
  registerShortcut(
    'panesMode.multiColumn',
    'Toggle multi-column for pane',
    'mod+shift+m',
    toggleMultiColumnForActivePane
  );
  registerShortcut('panesMode.resizeUp', 'Scroll active pane up', 'mod+ArrowUp', () => {
    handlePaneArrowShortcut('ArrowUp');
  });
  registerShortcut('panesMode.resizeDown', 'Scroll active pane down', 'mod+ArrowDown', () => {
    handlePaneArrowShortcut('ArrowDown');
  });
  registerShortcut('panesMode.resizeLeft', 'Shrink active pane width', 'mod+shift+ArrowLeft', () => {
    handlePaneArrowShortcut('ArrowLeft');
  });
  registerShortcut('panesMode.resizeRight', 'Grow active pane width', 'mod+shift+ArrowRight', () => {
    handlePaneArrowShortcut('ArrowRight');
  });
  registerShortcut(
    'panesMode.focusTextOnEnter',
    'Focus text in active pane',
    'mod+shift+f',
    handleFocusTextOnEnter
  );
};

const registerModalShortcuts = (registerShortcut: ReturnType<typeof createShortcutRegistrar>) => {
  registerShortcut('panesMode.paneSwitcher', 'Toggle pane search', 'mod+s', togglePaneSwitcher);
  registerShortcut('panesMode.projects', 'Toggle projects', 'mod+shift+s', toggleProjects);
};

const registerDebugShortcuts = (registerShortcut: ReturnType<typeof createShortcutRegistrar>) => {
  registerShortcut(
    'panesMode.debugLogState',
    'Log global state and panes',
    'mod+shift+u',
    logDebugStateAndPanes
  );
  registerShortcut(
    'panesMode.logLocalStorage',
    'Log local storage',
    'mod+shift+o',
    logLocalStorage
  );
};

const registerPaletteShortcuts = (registerShortcut: ReturnType<typeof createShortcutRegistrar>) => {
  registerShortcut(
    'panesMode.paletteDown',
    'Command palette go one item down',
    'mod+j',
    () => {
      moveCommandPaletteSelection('down');
    },
    false
  );
  registerShortcut(
    'panesMode.paletteUp',
    'Command palette go one item up',
    'mod+k',
    () => {
      moveCommandPaletteSelection('up');
    },
    false
  );
};

const registerNumericTabShortcuts = (
  registerShortcut: ReturnType<typeof createShortcutRegistrar>
) => {
  for (let index = 1; index <= 9; index++) {
    registerShortcut(`panesMode.tab.${index}`, `Focus tab ${index}`, `mod+${index}`, () =>
      focusPaneByIndex(index - 1)
    );
  }
};

const ensurePaletteNavigationHotkeys = (): void => {
  if (cleanupPaletteHotkeys) return;

  const paletteHotkeyHandler = (e: KeyboardEvent) => {
    const isMod = e.metaKey || e.ctrlKey;
    const key = e.key?.toLowerCase();
    if (!isMod || !key) return;

    const noModifiers = !e.altKey && !e.shiftKey;
    if (!noModifiers) return;
    if (key !== 'j' && key !== 'k') return;
    const handled = moveCommandPaletteSelection(key === 'j' ? 'down' : 'up');
    if (handled) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const attach = (target: Window) => target.addEventListener('keydown', paletteHotkeyHandler, true);
  attach(window);
  attach(parent.window);
  cleanupPaletteHotkeys = () => {
    window.removeEventListener('keydown', paletteHotkeyHandler, true);
    parent.window.removeEventListener('keydown', paletteHotkeyHandler, true);
  };
};

const ensurePaneArrowHotkeys = (): void => {
  if (cleanupPaneArrowHotkeys) return;

  const paneArrowHotkeyHandler = (e: KeyboardEvent) => {
    if (!globalState.isPanesModeModeActive) return;
    if (globalState.isPaneSwitcherModalVisible || globalState.isProjectsModalVisible) return;
    if (getCommandPaletteRoot()) return;
    if (isEditableTarget(e.target)) return;

    const key = getPaneArrowHotkey(e);
    if (!key) return;

    const handled = handlePaneArrowShortcut(key);
    if (!handled) return;

    e.preventDefault();
    e.stopPropagation();
  };

  const attach = (target: Window) => target.addEventListener('keydown', paneArrowHotkeyHandler, true);
  attach(window);
  attach(parent.window);
  cleanupPaneArrowHotkeys = () => {
    window.removeEventListener('keydown', paneArrowHotkeyHandler, true);
    parent.window.removeEventListener('keydown', paneArrowHotkeyHandler, true);
  };
};

// --- Entry points ---

export const setupKeyboardShortcuts = async (togglePanesModeMode: () => Promise<void>) => {
  if ((setupKeyboardShortcuts as any)._alreadyRegistered) {
    return;
  }
  (setupKeyboardShortcuts as any)._alreadyRegistered = true;

  const existingShortcuts = await getExistingShortcuts();
  const usedBindings = new Set<string>();
  const registerShortcut = createShortcutRegistrar(usedBindings, existingShortcuts);

  registerModeShortcuts(registerShortcut, togglePanesModeMode);
  registerPaneNavigationShortcuts(registerShortcut);
  registerPaneManagementShortcuts(registerShortcut);
  registerModalShortcuts(registerShortcut);
  registerDebugShortcuts(registerShortcut);
  registerPaletteShortcuts(registerShortcut);
  registerNumericTabShortcuts(registerShortcut);

  ensurePaletteNavigationHotkeys();
  ensurePaneArrowHotkeys();
};

export const preventNativeCloseShortcut = (
  updateTabs: (currentPanes?: Element[]) => void
): (() => void) => {
  const handler = (e: KeyboardEvent) => {
    const isMod = e.metaKey || e.ctrlKey;
    if (isMod && e.key === 'w') {
      e.preventDefault();
      e.stopPropagation();
      if (globalState.isPanesModeModeActive && isActivePaneIndexValid()) {
        closePaneByIndex(globalState.currentActivePaneIndex as number, updateTabs);
      }
    }
  };
  parent.window.addEventListener('keydown', handler, true);

  return () => {
    parent.window.removeEventListener('keydown', handler, true);
  };
};
