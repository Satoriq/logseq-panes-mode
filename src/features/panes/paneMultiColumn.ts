// AI slop
import { getPaneIdFromPane } from '../../core/domUtils';
import { getPluginSettings } from '../../core/pluginSettings';
import { globalState } from '../../core/pluginGlobalState';
import { getCurrentSidebarPanes } from './paneCache';

const DEFAULT_PANE_WIDTH = 1000;
const COLUMN_GAP_MULTIPLIER = 0.05;
const MULTICOLUMN_CLASS = 'panesMode-multicol';

const BULLET_CONTAINER_SELECTORS = [
  '.page-blocks-inner',
  '.page-blocks',
  '.blocks-container',
  '.block-children',
  '.custom-scrollbar',
] as const;

export const updateMultiColumnForPane = (pane: Element): void => {
  const paneElement = pane as HTMLElement;
  const { tracked } = isPaneTrackedForMultiColumn(paneElement);
  if (!tracked) {
    clearMultiColumnFromPane(paneElement);

    return;
  }
  const container = findBulletContainer(paneElement);
  if (!container) return;

  const width = paneElement.getBoundingClientRect().width;
  const paneBaseWidth = Math.max(100, getPluginSettings().paneInitialWidthPx || DEFAULT_PANE_WIDTH);
  const columnCount = Math.floor(width / paneBaseWidth);
  if (columnCount < 2) {
    clearMultiColumnFromPane(paneElement);

    return;
  }

  container.classList.add(MULTICOLUMN_CLASS);
  container.style.setProperty('--panesMode-column-count', columnCount.toString());
  container.style.setProperty(
    '--panesMode-column-gap',
    `${paneBaseWidth * COLUMN_GAP_MULTIPLIER}px`
  );
};

export const resetMultiColumnLayout = (): void => {
  globalState.multiColumnPageIds = [];
  const panes = getCurrentSidebarPanes();
  panes.forEach(pane => clearMultiColumnFromPane(pane as HTMLElement));
};

export const toggleMultiColumnForPane = (pane: HTMLElement): void => {
  const pageId = getPaneIdFromPane(pane);
  if (!pageId) return;
  const alreadyTrackedIndex = globalState.multiColumnPageIds.indexOf(pageId);
  if (alreadyTrackedIndex !== -1) {
    globalState.multiColumnPageIds.splice(alreadyTrackedIndex, 1);
    clearMultiColumnFromPane(pane);

    return;
  }
  globalState.multiColumnPageIds.push(pageId);
  updateMultiColumnForPane(pane);
};

const findBulletContainer = (pane: HTMLElement): HTMLElement | null => {
  for (const selector of BULLET_CONTAINER_SELECTORS) {
    const el = pane.querySelector(selector) as HTMLElement | null;
    if (el) return el;
  }

  return null;
};

const clearMultiColumnFromPane = (pane: HTMLElement): void => {
  const container = findBulletContainer(pane);
  if (!container) return;
  container.classList.remove(MULTICOLUMN_CLASS);
  container.style.removeProperty('--panesMode-column-count');
  container.style.removeProperty('--panesMode-column-gap');
};

const isPaneTrackedForMultiColumn = (
  pane: HTMLElement
): { tracked: boolean; pageId: string | null } => {
  const pageId = getPaneIdFromPane(pane);
  const tracked = pageId ? globalState.multiColumnPageIds.includes(pageId) : false;

  return { tracked, pageId };
};
