import { APP_SETTINGS_CONFIG } from '../../core/constants';
import { getPaneIdFromPane } from '../../core/domUtils';
import {
  PaneDimensions,
  readPanesDimensionsFromStorage,
  readPaneCollapseOrientationsFromStorage,
  readPaneFitContentHeightFromStorage,
  writePaneCollapseOrientationToStorage,
  writePaneFitContentHeightToStorage,
} from '../../core/storage';
import { getCurrentSidebarPanes } from './paneCache';
import { setActivePaneByIndex, focusNextVisiblePane } from './paneNavigation';
import { globalState } from '../../core/pluginGlobalState';
import { debounce } from '../../core/utils';
import { updateTabs } from '../tabs/tabs';
import type { CollapseOrientation, CollapsiblePane, FitContentToggleOptions } from './types';

const isFitContentEnabled = (pane: HTMLElement): boolean =>
  pane.dataset.panesModeFitContent === 'true';

const hasStoredPaneHeight = (storedDimensions: PaneDimensions | undefined): boolean =>
  Number.isFinite(storedDimensions?.height) && (storedDimensions?.height ?? 0) > 0;

const shouldUseFitContentHeight = (
  paneId: string,
  storedDimensions: PaneDimensions | undefined,
  storedFitContentHeight: Record<string, boolean>
): boolean => storedFitContentHeight?.[paneId] === true || !hasStoredPaneHeight(storedDimensions);

const shouldEnableFitContentForNewPane = (pane: HTMLElement): boolean => {
  if (isFitContentEnabled(pane)) return false;

  const paneId = getPaneIdFromPane(pane);
  if (!paneId) return true;

  const storedFitContentHeight = readPaneFitContentHeightFromStorage();
  if (typeof storedFitContentHeight?.[paneId] === 'boolean') {
    return storedFitContentHeight[paneId] === true;
  }

  const storedDimensions = readPanesDimensionsFromStorage();

  return !hasStoredPaneHeight(storedDimensions?.[paneId]);
};

const syncFitContentToggleState = (pane: HTMLElement): void => {
  const button = pane.querySelector('.panesMode-fit-content-toggle') as HTMLButtonElement | null;
  if (!button) return;
  const enabled = isFitContentEnabled(pane);
  button.dataset.enabled = enabled ? 'true' : 'false';
  button.setAttribute('aria-pressed', enabled ? 'true' : 'false');
};

const applyPaneWidth = (pane: Element): void => {
  if (pane.classList.contains('collapsed')) return;
  const pageId = getPaneIdFromPane(pane);
  if (!pageId) return;
  const storedDimensions = readPanesDimensionsFromStorage();
  const storedPaneDimensions = storedDimensions?.[pageId];
  if (!storedPaneDimensions) return;
  const paneElement = pane as HTMLElement;
  paneElement.style.width = `${storedPaneDimensions.width}px`;
};

export const enableFitContentForPane = (pane: Element): void => {
  const paneElement = pane as HTMLElement;
  if (!paneElement) return;
  const pageId = getPaneIdFromPane(paneElement);
  paneElement.dataset.panesModeFitContent = 'true';
  paneElement.dataset.panesModeFitContentInitialWidth = paneElement.style.width;
  paneElement.classList.add('panesMode-fit-content');
  if (pageId) {
    writePaneFitContentHeightToStorage(pageId, true);
  }
  if (!paneElement.classList.contains('collapsed')) {
    paneElement.style.height = 'auto';
    paneElement.dataset.panesModeFitContentBaselineHeightPx = Math.round(
      paneElement.getBoundingClientRect().height
    ).toString();
  }
  syncFitContentToggleState(paneElement);
};

export const disableFitContentForPane = (
  pane: Element,
  options?: FitContentToggleOptions
): void => {
  const paneElement = pane as HTMLElement;
  if (!paneElement) return;
  const pageId = getPaneIdFromPane(paneElement);
  delete paneElement.dataset.panesModeFitContent;
  delete paneElement.dataset.panesModeFitContentInitialWidth;
  delete paneElement.dataset.panesModeFitContentBaselineHeightPx;
  paneElement.classList.remove('panesMode-fit-content');
  if (pageId) {
    writePaneFitContentHeightToStorage(pageId, false);
  }
  if (options?.restoreStoredDimensions && !paneElement.classList.contains('collapsed')) {
    applyPaneDimensions(paneElement);
  }
  syncFitContentToggleState(paneElement);
};

export const enableFitContentForNewPane = (pane: Element): void => {
  const paneElement = pane as HTMLElement;
  if (!paneElement) return;
  if (!shouldEnableFitContentForNewPane(paneElement)) return;

  enableFitContentForPane(paneElement);
};

export function checkAndClickMoreButtonIfNear(pane: Element): void {
  if (!pane) return;
  const moreButtons = pane.querySelectorAll('.w-full.p-4');
  for (let i = 0; i < moreButtons.length; i++) {
    const button = moreButtons[i] as HTMLElement;
    if (button.textContent?.trim() === 'More') {
      const paneElement = pane as HTMLElement;
      const buttonRect = button.getBoundingClientRect();
      const paneRect = paneElement.getBoundingClientRect();
      const paneBottomInViewport = paneRect.bottom;
      const buttonTopInViewport = buttonRect.top;
      const distanceToMoreButton = buttonTopInViewport - paneBottomInViewport;
      if (distanceToMoreButton <= APP_SETTINGS_CONFIG.moreButtonActivationProximityPx) {
        const anchorElement = button.querySelector('a') as HTMLElement;
        anchorElement.click();
        break;
      }
    }
  }
}

export function createScrollHandler(pane: Element): (e: Event) => void {
  const debouncedHandler = debounce(() => {
    checkAndClickMoreButtonIfNear(pane);
  }, 200);

  return () => {
    debouncedHandler();
  };
}

export function addScrollListenerToPane(pane: Element): void {
  if (!pane || (pane as any)._hasScrollListener) return;
  const handler = createScrollHandler(pane);
  pane.addEventListener('scroll', handler, { passive: true });
  (pane as any)._scrollHandler = handler;
  (pane as any)._hasScrollListener = true;
}

export function removeScrollListenerFromPane(pane: Element): void {
  if (!pane || !(pane as any)._hasScrollListener) return;
  if ((pane as any)._scrollHandler) {
    pane.removeEventListener('scroll', (pane as any)._scrollHandler);
    delete (pane as any)._scrollHandler;
  }
  (pane as any)._hasScrollListener = false;
}

export function addScrollListenersToAllPanes(): void {
  const panes = getCurrentSidebarPanes();
  panes.forEach(pane => addScrollListenerToPane(pane));
}

export const applyInitialPaneSizes = (idToPaneMap: Map<string, Element>): void => {
  const storedPaneDimensions = readPanesDimensionsFromStorage();
  const storedFitContentHeight = readPaneFitContentHeightFromStorage();
  idToPaneMap.forEach((pane, paneId) => {
    const paneElement = pane as HTMLElement;
    const storedDimensions = storedPaneDimensions?.[paneId];
    const shouldFitContent = shouldUseFitContentHeight(
      paneId,
      storedDimensions,
      storedFitContentHeight
    );

    if (shouldFitContent) {
      paneElement.dataset.panesModeFitContent = 'true';
      paneElement.classList.add('panesMode-fit-content');
    } else {
      delete paneElement.dataset.panesModeFitContent;
      delete paneElement.dataset.panesModeFitContentInitialWidth;
      delete paneElement.dataset.panesModeFitContentBaselineHeightPx;
      paneElement.classList.remove('panesMode-fit-content');
    }

    if (paneElement.classList.contains('collapsed')) {
      clearPaneDimensions(paneElement);

      return;
    }

    if (storedDimensions) {
      paneElement.style.width = `${storedDimensions.width}px`;
      if (shouldFitContent) {
        paneElement.style.height = 'auto';
      } else if (hasStoredPaneHeight(storedDimensions)) {
        paneElement.style.height = `${storedDimensions.height}px`;
      }
    } else if (shouldFitContent) {
      paneElement.style.height = 'auto';
    }
  });
};

export const applyPaneDimensions = (pane: Element): void => {
  if (pane.classList.contains('collapsed')) return;
  const paneElement = pane as HTMLElement;
  if (isFitContentEnabled(paneElement)) {
    applyPaneWidth(pane);
    paneElement.style.height = 'auto';

    return;
  }
  const pageId = getPaneIdFromPane(pane);
  if (!pageId) return;
  const storedDimensions = readPanesDimensionsFromStorage();
  if (!storedDimensions) return;
  const storedPaneDimensions = storedDimensions[pageId];
  if (!storedPaneDimensions) return;
  const { width, height } = storedPaneDimensions;
  paneElement.style.width = `${width}px`;
  paneElement.style.height = hasStoredPaneHeight(storedPaneDimensions) ? `${height}px` : 'auto';
};

export const clearPaneDimensions = (pane: Element): void => {
  const paneElement = pane as HTMLElement;
  paneElement.style.width = '';
  paneElement.style.height = '';
};

const COLLAPSE_ORIENTATION_CLASSES = {
  vertical: 'panesMode-collapse-vertical',
  horizontal: 'panesMode-collapse-horizontal',
} as const;

const getStoredCollapseOrientation = (pane: HTMLElement): CollapseOrientation => {
  const pageId = getPaneIdFromPane(pane);
  const stored = readPaneCollapseOrientationsFromStorage();
  const storedOrientation = pageId
    ? (stored[pageId] as CollapseOrientation | undefined)
    : undefined;
  if (storedOrientation === 'horizontal' || storedOrientation === 'vertical') {
    return storedOrientation;
  }
  if (pageId && !storedOrientation) {
    writePaneCollapseOrientationToStorage(pageId, 'vertical');
  }

  return 'vertical';
};

const setCollapseOrientation = (pane: HTMLElement, orientation: CollapseOrientation): void => {
  const pageId = getPaneIdFromPane(pane);
  if (pageId) {
    writePaneCollapseOrientationToStorage(pageId, orientation);
  }
};

const applyCollapseOrientationClass = (
  pane: HTMLElement,
  nextOrientation?: CollapseOrientation
): CollapseOrientation => {
  const orientation = nextOrientation ?? getStoredCollapseOrientation(pane);
  if (!pane.classList.contains(COLLAPSE_ORIENTATION_CLASSES[orientation])) {
    pane.classList.remove(
      COLLAPSE_ORIENTATION_CLASSES.vertical,
      COLLAPSE_ORIENTATION_CLASSES.horizontal
    );
    pane.classList.add(COLLAPSE_ORIENTATION_CLASSES[orientation]);
  }

  return orientation;
};

const ensureFitContentToggle = (pane: CollapsiblePane, isCollapsed: boolean): void => {
  let container = pane.querySelector('.item-actions') as HTMLElement | null;
  if (!container) {
    container = pane.querySelector('.sidebar-item-header') as HTMLElement | null;
  }
  if (!container) {
    return;
  }

  const doc = pane.ownerDocument;

  let toggleButton = pane.querySelector(
    '.panesMode-fit-content-toggle'
  ) as HTMLButtonElement | null;

  if (!toggleButton) {
    toggleButton = doc.createElement('button');
    toggleButton.type = 'button';
    toggleButton.className = 'panesMode-fit-content-toggle';
    toggleButton.title = 'Auto resize';
    toggleButton.textContent = '↕';
    container.insertBefore(toggleButton, container.firstChild);
  }

  toggleButton.style.display = isCollapsed ? 'none' : '';
  syncFitContentToggleState(pane);

  const newClickHandler = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!globalState.isPanesModeModeActive) return;
    if (pane.classList.contains('collapsed')) return;
    if (isFitContentEnabled(pane)) {
      disableFitContentForPane(pane, { restoreStoredDimensions: true });

      return;
    }
    enableFitContentForPane(pane);
  };

  if ((toggleButton as any)._clickHandler) {
    toggleButton.removeEventListener('click', (toggleButton as any)._clickHandler);
  }
  (toggleButton as any)._clickHandler = newClickHandler;
  toggleButton.addEventListener('click', newClickHandler);
};

const ensureCollapseOrientationToggle = (
  pane: CollapsiblePane,
  isCollapsed: boolean,
  orientation: CollapseOrientation
): void => {
  let container = pane.querySelector('.item-actions') as HTMLElement | null;
  if (!container) {
    container = pane.querySelector('.sidebar-item-header') as HTMLElement | null;
  }
  if (!container) {
    return;
  }

  const doc = pane.ownerDocument;

  let toggleButton = pane.querySelector(
    '.panesMode-collapse-orientation-toggle'
  ) as HTMLButtonElement | null;

  if (!toggleButton) {
    toggleButton = doc.createElement('button');
    toggleButton.type = 'button';
    toggleButton.className = 'panesMode-collapse-orientation-toggle';
    toggleButton.title = 'Toggle collapse orientation';
    toggleButton.textContent = '⤻';
    container.insertBefore(toggleButton, container.firstChild);
  }

  toggleButton.dataset.orientation = orientation;
  toggleButton.style.display = isCollapsed ? '' : 'none';

  const newClickHandler = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const currentOrientation = toggleButton!.dataset.orientation as CollapseOrientation;
    const nextOrientation = currentOrientation === 'vertical' ? 'horizontal' : 'vertical';
    setCollapseOrientation(pane, nextOrientation);
    applyCollapseOrientationClass(pane, nextOrientation);
    toggleButton!.dataset.orientation = nextOrientation;
  };

  if ((toggleButton as any)._clickHandler) {
    toggleButton.removeEventListener('click', (toggleButton as any)._clickHandler);
  }
  (toggleButton as any)._clickHandler = newClickHandler;
  toggleButton.addEventListener('click', newClickHandler);
};

const syncCollapseOrientation = (
  paneElement: CollapsiblePane,
  isCollapsed: boolean
): CollapseOrientation => {
  const orientation = applyCollapseOrientationClass(paneElement);
  ensureCollapseOrientationToggle(paneElement, isCollapsed, orientation);

  return orientation;
};

const syncPaneDimensionsForCollapseState = (pane: HTMLElement): void => {
  if (pane.classList.contains('collapsed')) {
    clearPaneDimensions(pane);

    return;
  }
  if (isFitContentEnabled(pane)) {
    applyPaneWidth(pane);
    pane.style.height = 'auto';

    return;
  }
  applyPaneDimensions(pane);
};

export const observePaneCollapseState = (pane: Element): void => {
  if (!pane) return;
  const paneElement = pane as CollapsiblePane;
  if (paneElement._collapseObserver) return;

  const pageId = getPaneIdFromPane(paneElement);
  if (pageId) {
    const storedFitContent = readPaneFitContentHeightFromStorage();
    const storedDimensions = readPanesDimensionsFromStorage();
    const shouldFitContent = shouldUseFitContentHeight(
      pageId,
      storedDimensions?.[pageId],
      storedFitContent
    );
    if (shouldFitContent) {
      paneElement.dataset.panesModeFitContent = 'true';
      paneElement.classList.add('panesMode-fit-content');
    } else {
      delete paneElement.dataset.panesModeFitContent;
      delete paneElement.dataset.panesModeFitContentInitialWidth;
      delete paneElement.dataset.panesModeFitContentBaselineHeightPx;
      paneElement.classList.remove('panesMode-fit-content');
    }
  }

  syncPaneDimensionsForCollapseState(paneElement);
  const initialOrientation = applyCollapseOrientationClass(paneElement);
  const initiallyCollapsed = paneElement.classList.contains('collapsed');
  ensureFitContentToggle(paneElement, initiallyCollapsed);
  ensureCollapseOrientationToggle(paneElement, initiallyCollapsed, initialOrientation);
  paneElement._prevCollapsed = initiallyCollapsed;

  const observer = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
        syncPaneDimensionsForCollapseState(paneElement);
        const isCollapsed = paneElement.classList.contains('collapsed');
        const wasCollapsed = paneElement._prevCollapsed ?? isCollapsed;
        ensureFitContentToggle(paneElement, isCollapsed);
        syncCollapseOrientation(paneElement, isCollapsed);
        if (isCollapsed !== wasCollapsed) {
          updateTabs(globalState.cachedPanes);
          if (isCollapsed) {
            focusNextVisiblePane(paneElement, updateTabs);
          } else {
            const paneIndex = globalState.cachedPanes.indexOf(paneElement);
            if (paneIndex !== -1) {
              setActivePaneByIndex(paneIndex, globalState.cachedPanes);
            }
          }
          paneElement._prevCollapsed = isCollapsed;
        }
      }
    }
  });

  observer.observe(paneElement, { attributes: true, attributeFilter: ['class'] });
  paneElement._collapseObserver = observer;
};

export const disconnectPaneCollapseObserver = (pane: Element): void => {
  const paneElement = pane as CollapsiblePane;
  paneElement._collapseObserver?.disconnect();
  delete paneElement._collapseObserver;
};
