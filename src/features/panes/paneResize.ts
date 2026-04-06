import { APP_SETTINGS_CONFIG } from '../../core/constants';
import { getPaneIdFromPane } from '../../core/domUtils';
import { globalState } from '../../core/pluginGlobalState';
import {
  PaneDimensions,
  readPanesDimensionsFromStorage,
  writePaneDimensionsToStorage,
} from '../../core/storage';
import { debounce } from '../../core/utils';
import {
  addScrollListenerToPane,
  disableFitContentForPane,
  observePaneCollapseState,
} from './paneLayout';
import { updateMultiColumnForPane } from './paneMultiColumn';

export const createPaneResizeObserver = (): ResizeObserver => {

  return new ResizeObserver(entries => handleResize(entries));
};

export const observePaneForResize = (resizeObserver: ResizeObserver, pane: Element): void => {
  if (!pane) return;
  observePaneCollapseState(pane);
  if ((pane as any)._isResizeObserved) return;
  resizeObserver.observe(pane);
  (pane as any)._isResizeObserved = true;
  addScrollListenerToPane(pane);
  updateMultiColumnForPane(pane);
};

export const addPanesResizeObserver = (resizeObserver: ResizeObserver, panes: Element[]): void =>
  panes.forEach(pane => observePaneForResize(resizeObserver, pane));

const pendingResizeSaves = new Map<string, PaneDimensions>();

const FIT_CONTENT_HEIGHT_CHANGE_THRESHOLD_PX = 2;

const pendingMultiColumnUpdates = new Set<HTMLElement>();
let multiColumnRAF: number | null = null;

const flushMultiColumnUpdates = () => {
  if (multiColumnRAF) return;
  multiColumnRAF = requestAnimationFrame(() => {
    multiColumnRAF = null;
    pendingMultiColumnUpdates.forEach(pane => updateMultiColumnForPane(pane));
    pendingMultiColumnUpdates.clear();
  });
};

const queueMultiColumnUpdate = (pane: HTMLElement) => {
  pendingMultiColumnUpdates.add(pane);
  flushMultiColumnUpdates();
};

const flushPendingResizeSaves = debounce(() => {
  pendingResizeSaves.forEach((dimensions, pageId) => {
    writePaneDimensionsToStorage(pageId, dimensions);
  });
  pendingResizeSaves.clear();
}, APP_SETTINGS_CONFIG.resizeStoreDebounceMs);

const queuePaneResizeSave = (pane: HTMLElement, entry: ResizeObserverEntry): void => {
  const pageId = getPaneIdFromPane(pane);
  if (!pageId) return;
  const borderBox = Array.isArray(entry.borderBoxSize)
    ? entry.borderBoxSize[0]
    : entry.borderBoxSize;
  const width = Math.round(borderBox?.inlineSize ?? entry.target.getBoundingClientRect().width);
  const height = Math.round(borderBox?.blockSize ?? entry.target.getBoundingClientRect().height);
  if (width === 0 || height === 0) return;
  pendingResizeSaves.set(pageId, { width, height });
  flushPendingResizeSaves();
};

const queuePaneWidthSave = (pane: HTMLElement, entry: ResizeObserverEntry): void => {
  const pageId = getPaneIdFromPane(pane);
  if (!pageId) return;
  const borderBox = Array.isArray(entry.borderBoxSize)
    ? entry.borderBoxSize[0]
    : entry.borderBoxSize;
  const width = Math.round(borderBox?.inlineSize ?? entry.target.getBoundingClientRect().width);
  if (width === 0) return;

  const stored = readPanesDimensionsFromStorage();
  const storedDimensions = stored?.[pageId];
  if (
    storedDimensions?.width === width &&
    typeof storedDimensions?.height !== 'number' &&
    !pendingResizeSaves.has(pageId)
  ) {

    return;
  }

  pendingResizeSaves.set(pageId, { width });
  flushPendingResizeSaves();
};

const handleResize = (entries: ResizeObserverEntry[]) => {
  if (!globalState.isPanesModeModeActive) return;
  const isBatchResize = entries.length > 1;
  entries.forEach(entry => {
    const pane = entry.target as HTMLElement;
    if (pane.id === 'right-sidebar-container') return;
    queueMultiColumnUpdate(pane);
    if (pane.classList.contains('collapsed')) return;
    if (isBatchResize) return;
    if (pane.dataset.panesModeFitContent === 'true') {
      const borderBox = Array.isArray(entry.borderBoxSize)
        ? entry.borderBoxSize[0]
        : entry.borderBoxSize;
      const height = Math.round(
        borderBox?.blockSize ?? entry.target.getBoundingClientRect().height
      );
      const baselineHeight = parseInt(pane.dataset.panesModeFitContentBaselineHeightPx ?? '', 10);
      const baseline = Number.isFinite(baselineHeight) ? baselineHeight : height;
      const hasExplicitHeight = Boolean(pane.style.height && pane.style.height !== 'auto');

      if (hasExplicitHeight) {
        const heightDiff = Math.abs(height - baseline);
        if (heightDiff >= FIT_CONTENT_HEIGHT_CHANGE_THRESHOLD_PX) {
          disableFitContentForPane(pane, { restoreStoredDimensions: false });
        } else {
          pane.style.height = 'auto';
          queuePaneWidthSave(pane, entry);

          return;
        }
      } else {
        pane.dataset.panesModeFitContentBaselineHeightPx = height.toString();
        queuePaneWidthSave(pane, entry);

        return;
      }
    }
    queuePaneResizeSave(pane, entry);
  });
};
