import { LOGSEQ_UI_SELECTORS, PLUGIN_UI_SELECTORS } from '../../../core/constants';
import { getPaneTitle } from '../../../core/domUtils';
import { globalState } from '../../../core/pluginGlobalState';
import {
  debounce,
  isPrimaryShortcutModifierPressed,
  waitForDomChanges,
} from '../../../core/utils';
import { setActivePaneByIndex } from '../paneNavigation';
import { createPaneSwitcherModalHTML, PANE_SWITCHER_CLASSES } from './paneSwitcherView';

let modalKeydownHandler: ((e: KeyboardEvent) => void) | null = null;
let escapeKeydownHandler: ((e: KeyboardEvent) => void) | null = null;

// Approved
export const initPaneSwitcherModal = (): HTMLElement => {
  const existingModal = parent.document.getElementById(
    PLUGIN_UI_SELECTORS.paneSwitcherModalId
  ) as HTMLElement | null;
  if (existingModal) {
    existingModal.remove();
  }
  const modalElement = parent.document.createElement('div');
  modalElement.innerHTML = createPaneSwitcherModalHTML();
  const modal = modalElement.firstElementChild as HTMLElement;
  const rightSidebarContainer = parent.document.querySelector(
    LOGSEQ_UI_SELECTORS.rightSidebarContainer
  ) as HTMLElement | null;
  if (rightSidebarContainer) {
    rightSidebarContainer.appendChild(modal);
  } else {
    parent.document.body.appendChild(modal);
  }

  // Approved
  const addInputEventListener = () => {
    const searchInput = modal.querySelector(`.${PANE_SWITCHER_CLASSES.search}`) as HTMLInputElement;
    if (searchInput) {
      searchInput.tabIndex = -1;
    }
    searchInput.addEventListener('input', e => {
      const query = (e.target as HTMLInputElement).value.toLowerCase();
      const debouncedUpdatePanesList = debounce((query: string) => {
        updatePaneSwitcherListImmediate(query);
      }, 50);

      debouncedUpdatePanesList(query);
    });
  };

  const addContainerEventListeners = () => {
    const container = modal.querySelector(`.${PANE_SWITCHER_CLASSES.container}`) as HTMLElement;
    const preventLogseqBackgroundNavigation = () => {
      container.addEventListener('keydown', (e: KeyboardEvent) => {
        const isMod = isPrimaryShortcutModifierPressed(e);
        if (
          ['ArrowUp', 'ArrowDown', 'Enter', 'Escape'].includes(e.key) ||
          (isMod && (e.key === 'j' || e.key === 'k'))
        ) {
          e.stopPropagation();
        }
      });
    };
    preventLogseqBackgroundNavigation();

    modal.addEventListener('click', e => {
      if ((e.target as HTMLElement).classList.contains(PANE_SWITCHER_CLASSES.modal)) {
        hidePaneSwitcherModal();
      }
    });
    container.addEventListener('click', e => e.stopPropagation());
  };

  addInputEventListener();
  addContainerEventListeners();

  if (!modalKeydownHandler) {
    modalKeydownHandler = (e: KeyboardEvent) => {
      if (!globalState.isPaneSwitcherModalVisible) return;
      const isArrowUp = e.key === 'ArrowUp';
      const isArrowDown = e.key === 'ArrowDown';
      const isMod = isPrimaryShortcutModifierPressed(e);
      const isMetaK = isMod && e.key === 'k';
      const isMetaJ = isMod && e.key === 'j';
      const isEscape = e.key === 'Escape';
      const isEnter = e.key === 'Enter';

      if (isEscape) {
        e.preventDefault();
        e.stopPropagation();
        hidePaneSwitcherModal();

        return;
      }

      if (isEnter) {
        e.preventDefault();
        e.stopPropagation();
        selectPaneFromSwitcher(globalState.paneSwitcherSelectedIndex);

        return;
      }

      if (isArrowUp || isArrowDown || isMetaK || isMetaJ) {
        e.preventDefault();
        e.stopPropagation();
        if ((isArrowUp || isMetaK) && globalState.paneSwitcherSelectedIndex > 0) {
          globalState.paneSwitcherSelectedIndex--;
          updatePaneSwitcherSelection();
        } else if (
          (isArrowDown || isMetaJ) &&
          globalState.paneSwitcherSelectedIndex < globalState.paneSwitcherFilteredPanes.length - 1
        ) {
          globalState.paneSwitcherSelectedIndex++;
          updatePaneSwitcherSelection();
        }
      }
    };
  }
  modal.addEventListener('keydown', modalKeydownHandler, true);

  if (!escapeKeydownHandler) {
    escapeKeydownHandler = (e: KeyboardEvent) => {
      if (!globalState.isPaneSwitcherModalVisible) return;
      const activeModal = parent.document.getElementById(PLUGIN_UI_SELECTORS.paneSwitcherModalId);
      if (!activeModal || !activeModal.classList.contains('visible')) return;
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      hidePaneSwitcherModal();
    };
    parent.document.addEventListener('keydown', escapeKeydownHandler, true);
  }

  return modal;
};

// Approved
export const showPaneSwitcherModal = (): void => {
  if (!globalState.isPanesModeModeActive) return;

  const modal =
    (parent.document.getElementById(
      PLUGIN_UI_SELECTORS.paneSwitcherModalId
    ) as HTMLElement | null) || initPaneSwitcherModal();
  if (!modal) return;

  const searchInput = modal.querySelector(
    `.${PANE_SWITCHER_CLASSES.search}`
  ) as HTMLInputElement | null;
  if (searchInput) {
    searchInput.value = '';
    searchInput.tabIndex = 0;
  }

  globalState.isPaneSwitcherModalVisible = true;
  globalState.paneSwitcherSelectedIndex = 0;
  updatePaneSwitcherListImmediate('');

  // Show with animation: display first, then fade in
  modal.style.display = 'flex';
  modal.offsetHeight; // Force reflow to enable transition
  modal.classList.add('visible');
  modal.setAttribute('aria-hidden', 'false');
  searchInput?.focus();
};

const MODAL_TRANSITION_MS = 200;

// Approved
export const hidePaneSwitcherModal = (): void => {
  const modal = parent.document.getElementById(
    PLUGIN_UI_SELECTORS.paneSwitcherModalId
  ) as HTMLElement | null;
  if (modal) {
    globalState.isPaneSwitcherModalVisible = false;
    const searchInput = modal.querySelector(
      `.${PANE_SWITCHER_CLASSES.search}`
    ) as HTMLInputElement | null;
    if (searchInput) {
      searchInput.blur();
      searchInput.tabIndex = -1;
    }

    modal.classList.remove('visible');
    modal.setAttribute('aria-hidden', 'true');
    void waitForDomChanges(() => {
      if (!globalState.isPaneSwitcherModalVisible) {
        modal.style.display = 'none';
      }
    }, MODAL_TRANSITION_MS / 1000);
  }
};

// Approved
export const updatePaneSwitcherSelection = (): void => {
  const modal = parent.document.getElementById(
    PLUGIN_UI_SELECTORS.paneSwitcherModalId
  ) as HTMLElement | null;
  if (!modal) return;

  const prevSelected = modal.querySelector(`.${PANE_SWITCHER_CLASSES.item}.selected`);
  prevSelected?.classList.remove('selected');

  const newSelected = modal.querySelector(
    `.${PANE_SWITCHER_CLASSES.item}[data-pane-index="${globalState.paneSwitcherSelectedIndex}"]`
  ) as HTMLElement | null;
  if (newSelected) {
    newSelected.classList.add('selected');
    newSelected.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
};

// Approved
const updatePaneSwitcherListImmediate = (query: string): void => {
  const modal = parent.document.getElementById(
    PLUGIN_UI_SELECTORS.paneSwitcherModalId
  ) as HTMLElement | null;
  if (!modal) return;

  const listContainer = modal.querySelector(`.${PANE_SWITCHER_CLASSES.list}`) as HTMLElement;
  const container = modal.querySelector(
    `.${PANE_SWITCHER_CLASSES.container}`
  ) as HTMLElement | null;

  const titleCache = new Map<Element, { original: string; lower: string }>();
  const getTitles = (pane: Element) => {
    let cached = titleCache.get(pane);
    if (!cached) {
      const original = getPaneTitle(pane);
      cached = { original, lower: original.toLowerCase() };
      titleCache.set(pane, cached);
    }

    return cached;
  };

  const queryLower = query.toLowerCase();

  globalState.paneSwitcherFilteredPanes = globalState.cachedPanes
    .filter(pane => getTitles(pane).lower.includes(queryLower))
    .sort((a, b) => {
      const titleA = getTitles(a).lower;
      const titleB = getTitles(b).lower;
      const scoreA = titleA === queryLower ? 3 : titleA.startsWith(queryLower) ? 2 : 1;
      const scoreB = titleB === queryLower ? 3 : titleB.startsWith(queryLower) ? 2 : 1;

      return scoreA !== scoreB ? scoreB - scoreA : titleA.localeCompare(titleB);
    });

  const fragment = parent.document.createDocumentFragment();

  if (globalState.paneSwitcherFilteredPanes.length > 0) {
    globalState.paneSwitcherFilteredPanes.forEach((pane, index) => {
      const item = parent.document.createElement('div');
      item.className =
        index === 0 ? `${PANE_SWITCHER_CLASSES.item} selected` : PANE_SWITCHER_CLASSES.item;
      item.dataset.paneIndex = index.toString();
      item.innerHTML = `<span class="pane-icon">📄</span><span class="pane-title">${getTitles(pane).original}</span>`;
      item.onclick = () => selectPaneFromSwitcher(index);
      fragment.appendChild(item);
    });
  } else {
    const noResults = parent.document.createElement('div');
    noResults.className = `${PANE_SWITCHER_CLASSES.item} ${PANE_SWITCHER_CLASSES.noResults}`;
    noResults.textContent = query ? `No panes matching "${query}"` : 'No panes available';
    fragment.appendChild(noResults);
  }

  listContainer.innerHTML = '';
  listContainer.appendChild(fragment);

  container?.classList.toggle(
    PANE_SWITCHER_CLASSES.hasResults,
    globalState.paneSwitcherFilteredPanes.length > 0
  );
  globalState.paneSwitcherSelectedIndex = globalState.paneSwitcherFilteredPanes.length > 0 ? 0 : -1;
};

// Approved
export const selectPaneFromSwitcher = (index: number): void => {
  if (index >= 0 && index < globalState.paneSwitcherFilteredPanes.length) {
    const selectedPane = globalState.paneSwitcherFilteredPanes[index];
    const originalPaneIndex = globalState.cachedPanes.indexOf(selectedPane);
    if (originalPaneIndex >= 0) {
      setActivePaneByIndex(originalPaneIndex, globalState.cachedPanes);
    }
  }
  hidePaneSwitcherModal();
};

// Approved
export const cleanupPaneSwitcher = (): void => {
  const paneSwitcherModal = parent.document.getElementById(
    PLUGIN_UI_SELECTORS.paneSwitcherModalId
  ) as HTMLElement | null;
  if (paneSwitcherModal) {
    if (modalKeydownHandler) {
      paneSwitcherModal.removeEventListener('keydown', modalKeydownHandler, true);
      modalKeydownHandler = null;
    }
    if (escapeKeydownHandler) {
      parent.document.removeEventListener('keydown', escapeKeydownHandler, true);
      escapeKeydownHandler = null;
    }
    paneSwitcherModal.remove();
  }
  globalState.isPaneSwitcherModalVisible = false;
};
