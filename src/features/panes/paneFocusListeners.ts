import { globalState, isActivePaneIndexValid } from '../../core/pluginGlobalState';
import { setActivePaneByIndex } from './paneNavigation';

const PANE_FOCUS_SELECTORS = {
  panesContainer: '.sidebar-item-list.flex-1.scrollbar-spacing',
  paneItem: '.sidebar-item.content',
} as const;

export const setupMousePaneFocus = (): (() => void) => {
  const panesContainer = parent.document.querySelector(
    PANE_FOCUS_SELECTORS.panesContainer
  ) as HTMLElement | null;
  if (!panesContainer) {
    console.error('Could not find panes container for mousedown listener.');

    return () => {};
  }
  const documentMouseDownHandler = (e: MouseEvent) => {
    if (!globalState.isPanesModeModeActive) return;
    const target = e.target as HTMLElement;
    if (!target) return;
    if (!isActivePaneIndexValid()) return;
    const activePane =
      globalState.currentActivePaneIndex !== null
        ? globalState.cachedPanes[globalState.currentActivePaneIndex]
        : null;
    if (activePane && activePane.contains(target)) return;
    const clickedPaneElement = target.closest(PANE_FOCUS_SELECTORS.paneItem) as HTMLElement | null;
    if (!clickedPaneElement) return;
    const clickedIndexString = clickedPaneElement.dataset.currentIndex;
    const clickedIndex = parseInt(clickedIndexString ?? '-1', 10);
    if (Number.isNaN(clickedIndex)) return;
    setActivePaneByIndex(clickedIndex, globalState.cachedPanes, true);
  };
  panesContainer.addEventListener('mousedown', documentMouseDownHandler, {
    capture: true,
    passive: true,
  });

  return () => {
    panesContainer.removeEventListener('mousedown', documentMouseDownHandler, true);
  };
};
