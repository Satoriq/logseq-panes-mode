// AI slop
import {
  getPaneTitle,
  getPaneIdFromPane,
  isElementVerticallyInViewport,
} from '../../../core/domUtils';
import { debugLog } from '../../../core/logger';
import { globalState } from '../../../core/pluginGlobalState';
import type { PendingShiftClick } from './types';
import { getCurrentSidebarPanes } from '../paneCache';
import { EXPECTED_MUTATIONS } from '../../observers/types';

const DEBUG_PREFIX = '[PanesMode][ShiftClick]';

const escapeSelector = (value: string): string => {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(value);
  }

  return value.replace(/["\\]/g, '\\$&');
};

const normalizeId = (value: string): string => value.trim().toLowerCase();

const normalizeSearchText = (value: string): string =>
  value
    .toLowerCase()
    .replace(/\[\[|\]\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const normalizePageKey = (value: string): string => {
  const trimmed = value.trim().replace(/^\[\[|\]\]$/g, '');
  if (!trimmed) return '';
  const isUuidLike = /^[0-9a-f-]{16,}$/i.test(trimmed) && trimmed.includes('-');
  if (isUuidLike) return trimmed.toLowerCase();

  return trimmed.toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
};

const getPageMatchCandidates = (pane: Element): string[] => {
  const candidates: string[] = [];
  const paneId = getPaneIdFromPane(pane);
  if (paneId) candidates.push(paneId);
  const paneTitle = getPaneTitle(pane);
  if (paneTitle) candidates.push(paneTitle);
  const paneElement = pane as HTMLElement;
  const dataPage =
    paneElement.getAttribute('data-page') ??
    paneElement.getAttribute('data-page-name') ??
    paneElement.getAttribute('data-refs-self');
  if (dataPage) candidates.push(dataPage);

  return Array.from(new Set(candidates));
};

const BLOCK_TEXT_SELECTORS = [
  '.block-content',
  '.block-content-wrapper',
  '.block-content-inner',
  '.block-content-inline',
].join(', ');

const getBlockText = (blockElement: Element): string => {
  const contentElement = blockElement.querySelector(BLOCK_TEXT_SELECTORS) as HTMLElement | null;
  const text = (contentElement ?? blockElement).textContent ?? '';

  return text.trim();
};

const findPaneByFirstBlockText = (panes: Element[], queries: string[]): Element | null => {
  const normalizedQueries = queries
    .map(query => normalizeSearchText(query))
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  if (normalizedQueries.length === 0) return null;

  const paneFirstBlocks: Array<{ pane: Element; text: string; normalized: string }> = [];

  for (const pane of panes) {
    const firstBlock = pane.querySelector('[blockid]');
    if (!firstBlock) continue;
    const blockText = getBlockText(firstBlock);
    if (!blockText) continue;
    const normalizedBlock = normalizeSearchText(blockText);
    if (!normalizedBlock) continue;
    paneFirstBlocks.push({ pane, text: blockText, normalized: normalizedBlock });
    const matches = normalizedQueries.some(
      query => normalizedBlock.includes(query) || query.includes(normalizedBlock)
    );
    if (matches) {
      return pane;
    }
  }

  debugLog(DEBUG_PREFIX, 'search block no match', {
    queries,
    normalizedQueries,
    paneFirstBlocks: paneFirstBlocks.map(item => ({
      title: getPaneTitle(item.pane),
      text: item.text,
      normalized: item.normalized,
    })),
  });

  return null;
};

const getFocusedPane = (): HTMLElement | null => {
  const activeElement = parent.document.activeElement as HTMLElement | null;
  if (!activeElement) return null;

  return activeElement.closest('.sidebar-item') as HTMLElement | null;
};

export const getActivePaneElement = (currentSidebarPanes: Element[]): Element | null => {
  if (currentSidebarPanes.length === 0) return null;

  const selectedPane = currentSidebarPanes.find(pane =>
    (pane as HTMLElement).classList.contains('selectedPane')
  );
  if (selectedPane) return selectedPane;

  const activeIndex = globalState.currentActivePaneIndex;
  if (activeIndex === null) return currentSidebarPanes[0];

  const cachedActivePane = globalState.cachedPanes[activeIndex];
  if (cachedActivePane && currentSidebarPanes.includes(cachedActivePane)) {
    return cachedActivePane;
  }

  const cachedActivePaneId = cachedActivePane ? getPaneIdFromPane(cachedActivePane) : null;
  if (cachedActivePaneId) {
    const byId = currentSidebarPanes.find(pane => getPaneIdFromPane(pane) === cachedActivePaneId);
    if (byId) return byId;
  }

  return currentSidebarPanes[activeIndex] ?? currentSidebarPanes[0];
};

export const resolveShiftClickTargetPane = (
  pending: PendingShiftClick,
  panes: Element[]
): Element | null => {
  const rawTargetCandidates =
    pending.targetCandidates && pending.targetCandidates.length > 0
      ? pending.targetCandidates
      : [pending.targetId];
  const escapedId = escapeSelector(pending.targetId);
  if (pending.targetType === 'page') {
    if (pending.searchSection) {
      const normalizedCandidates = rawTargetCandidates
        .map(candidate => normalizeSearchText(candidate))
        .filter(Boolean);
      for (const pane of panes) {
        const title = getPaneTitle(pane);
        if (!title) continue;
        const normalizedTitle = normalizeSearchText(title);
        if (normalizedCandidates.some(candidate => candidate === normalizedTitle)) {
          return pane;
        }
      }

      return null;
    }
    const targetKeys = new Set(
      rawTargetCandidates.map(candidate => normalizePageKey(candidate)).filter(Boolean)
    );
    const matches = panes.filter(pane => {
      const paneCandidates = getPageMatchCandidates(pane)
        .map(candidate => normalizePageKey(candidate))
        .filter(Boolean);

      return paneCandidates.some(candidate => targetKeys.has(candidate));
    });
    if (matches.length === 0) return null;
    if (matches.length === 1) return matches[0];
    const focusedPane = getFocusedPane();
    if (focusedPane && matches.includes(focusedPane)) return focusedPane;
    const selectedMatch = matches.find(pane =>
      (pane as HTMLElement).classList.contains('selectedPane')
    );
    if (selectedMatch) return selectedMatch;

    return matches[0];
  }

  const normalizedTargetId = normalizeId(pending.targetId);
  const byId = panes.find(pane => {
    const paneId = getPaneIdFromPane(pane);

    return paneId ? normalizeId(paneId) === normalizedTargetId : false;
  });
  if (byId) return byId;
  if (pending.targetType === 'block') {
    if (pending.searchSection) {
      return findPaneByFirstBlockText(panes, rawTargetCandidates);
    }
    const candidates = panes
      .map(pane => {
        const blockElement = pane.querySelector(
          `[blockid="${escapedId}"], .block-ref[data-uuid="${escapedId}"]`
        ) as HTMLElement | null;

        return blockElement ? { pane, blockElement } : null;
      })
      .filter(Boolean) as Array<{ pane: Element; blockElement: HTMLElement }>;

    if (candidates.length === 0) return null;
    if (candidates.length === 1) return candidates[0].pane;

    const focusedPane = getFocusedPane();
    if (focusedPane) {
      const focusedMatch = candidates.find(candidate => candidate.pane === focusedPane);
      if (focusedMatch) return focusedMatch.pane;
    }

    const visibleMatch = candidates.find(candidate =>
      isElementVerticallyInViewport(candidate.blockElement, candidate.pane as HTMLElement, 0.1)
    );
    if (visibleMatch) return visibleMatch.pane;

    const selectedMatch = candidates.find(candidate =>
      (candidate.pane as HTMLElement).classList.contains('selectedPane')
    );
    if (selectedMatch) return selectedMatch.pane;

    return candidates[0].pane;
  }

  return panes.find(pane => pane.querySelector(`[data-ref="${escapedId}"]`)) ?? null;
};

export const resolveActivePaneFromPending = (
  pending: PendingShiftClick,
  currentSidebarPanes: Element[]
): Element | null => {
  if (pending.activePaneId) {
    const byId = globalState.cachedPanes.find(
      pane => getPaneIdFromPane(pane) === pending.activePaneId
    );
    if (byId) return byId;
  }

  if (pending.activePaneIndex !== null) {
    const byIndex = globalState.cachedPanes[pending.activePaneIndex];
    if (byIndex) return byIndex;
  }

  const activeNow = getActivePaneElement(currentSidebarPanes);
  if (!activeNow) return null;
  if (globalState.cachedPanes.includes(activeNow)) return activeNow;
  const activeNowId = getPaneIdFromPane(activeNow);
  if (!activeNowId) return null;

  return globalState.cachedPanes.find(pane => getPaneIdFromPane(pane) === activeNowId) ?? null;
};

const buildDesiredOrder = (
  targetPane: Element,
  activePane: Element | null,
  baseOrder: Element[] = globalState.cachedPanes
): Element[] | null => {
  const desiredOrder = baseOrder.filter(pane => pane !== targetPane);
  if (globalState.alwaysOpenPanesAtBegining) {
    desiredOrder.unshift(targetPane);

    return desiredOrder;
  }
  if (!activePane || targetPane === activePane) return null;
  const activeIndex = desiredOrder.indexOf(activePane);
  if (activeIndex === -1) return null;
  desiredOrder.splice(activeIndex + 1, 0, targetPane);

  return desiredOrder;
};

export const getDesiredOrder = (
  targetPane: Element,
  activePane: Element | null,
  baseOrder: Element[] = globalState.cachedPanes
): Element[] | null => buildDesiredOrder(targetPane, activePane, baseOrder);

const applyDesiredOrder = (container: HTMLElement, desiredOrder: Element[]): Element[] => {
  let didMutate = false;
  desiredOrder.forEach((pane, index) => {
    const currentPanes = getCurrentSidebarPanes(container);
    if (currentPanes[index] === pane) return;
    if (!didMutate) {
      globalState.expectedMutations.push(EXPECTED_MUTATIONS.newSidebarItemsReordering);
      didMutate = true;
    }
    const referenceNode = currentPanes[index] ?? null;
    container.insertBefore(pane, referenceNode);
  });

  return getCurrentSidebarPanes(container);
};

export const reorderPaneNextToActive = (
  targetPane: Element,
  activePane: Element | null,
  container: HTMLElement
): Element[] | null => {
  const desiredOrder = buildDesiredOrder(targetPane, activePane);
  if (!desiredOrder) return null;

  return applyDesiredOrder(container, desiredOrder);
};

export const getNewPaneCandidate = (currentSidebarPanes: Element[]): Element | null => {
  const newPanes = currentSidebarPanes.filter(pane => !globalState.cachedPanes.includes(pane));

  return newPanes.length === 1 ? newPanes[0] : null;
};
