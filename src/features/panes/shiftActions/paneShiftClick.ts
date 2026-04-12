// AI slop
import { APP_SETTINGS_CONFIG } from '../../../core/constants';
import {
  arePanesDifferent,
  getPaneIdFromPane,
  getScrollablePanesContainer,
} from '../../../core/domUtils';
import { debugLog, debugWarn } from '../../../core/logger';
import { globalState, isActivePaneIndexValid } from '../../../core/pluginGlobalState';
import type { PendingShiftClick } from './types';
import { waitForDomChanges } from '../../../core/utils';
import { getCurrentSidebarPanes } from '../paneCache';
import { setActivePaneByIndex } from '../paneNavigation';
import { applyPaneDimensions, notifyVirtuosoScroll } from '../paneLayout';
import { updateTabs } from '../../tabs/tabs';
import { updatePanesOrderInStorage } from '../panePersistence';
import { enforceMaxTabsLimit } from '../paneActions';
import {
  startShiftClickPaneWatcher,
  stopShiftClickPaneWatcher,
} from '../../observers/paneMutations';
import {
  getActivePaneElement,
  getDesiredOrder,
  getNewPaneCandidate,
  reorderPaneNextToActive,
  resolveActivePaneFromPending,
  resolveShiftClickTargetPane,
} from './paneShiftReorder';

const SHIFT_CLICK_SELECTORS = {
  page: '[data-ref]',
  block: '.bullet-container[blockid], .block-control[blockid], .block-ref[data-uuid]',
} as const;

const DB_SHIFT_CLICK_SELECTORS = {
  pageLink: 'a.page-ref[data-ref], a.tag[data-ref], .preview-ref-link a[data-ref]',
  pageContainer: '.preview-ref-link, .page-reference, .inline-wrap, .full.inline-wrap',
} as const;

const DEBUG_PREFIX = '[PanesMode][ShiftClick]';

const SEARCH_HIGHLIGHTED_SPAN_SELECTOR = '.ui__list-item-highlighted-span, mark';

const SEARCH_SECTION_LABELS = ['pages', 'blocks', 'recents'] as const;

const getSearchContainerSelector = (): string =>
  APP_SETTINGS_CONFIG.isDBVersion ? '.cp__cmdk__modal, .search-results' : '.search-results';

const getSearchItemSelector = (): string =>
  APP_SETTINGS_CONFIG.isDBVersion
    ? '[data-cmdk-item="true"], .transition-opacity'
    : '.transition-opacity';

type ShiftClickTarget = {
  type: PendingShiftClick['targetType'];
  id: string;
  candidates?: string[];
  searchSection?: PendingShiftClick['searchSection'];
};

type PendingSearchFocus = Pick<
  PendingShiftClick,
  'targetType' | 'targetId' | 'targetCandidates' | 'searchSection' | 'timestamp'
>;

const buildPageCandidates = (
  pageName: string | null,
  pageInfo?: any,
  fallback?: string
): string[] => {
  const candidates = new Set<string>();
  const addCandidate = (value: unknown) => {
    if (typeof value === 'string' && value.trim()) {
      candidates.add(value.trim());
    } else if (typeof value === 'number') {
      candidates.add(String(value));
    }
  };
  addCandidate(pageName);
  addCandidate(pageInfo?.originalName);
  addCandidate(pageInfo?.name);
  addCandidate(pageInfo?.id);
  addCandidate(pageInfo?.uuid);
  addCandidate(fallback);

  return Array.from(candidates);
};

const getSearchSectionLabel = (node: HTMLElement): string | null => {
  const text = node.textContent?.trim();
  if (!text) return null;
  const normalized = text.toLowerCase();
  const match = SEARCH_SECTION_LABELS.find(label => normalized.startsWith(label));

  return match ? text : null;
};

const getSearchSectionType = (
  item: HTMLElement,
  container: HTMLElement
): 'page' | 'block' | 'recent' | null => {
  if (item.querySelector('.breadcrumb, .block-parents')) {
    return 'block';
  }
  let current: HTMLElement | null = item;
  while (current && current !== container) {
    let sibling = current.previousElementSibling as HTMLElement | null;
    while (sibling) {
      const label = getSearchSectionLabel(sibling);
      if (label) {
        const normalized = label.toLowerCase();
        if (normalized.startsWith('blocks')) return 'block';
        if (normalized.startsWith('pages')) return 'page';
        if (normalized.startsWith('recents')) return 'recent';

        return null;
      }
      sibling = sibling.previousElementSibling as HTMLElement | null;
    }
    current = current.parentElement as HTMLElement | null;
  }

  return null;
};

const extractPageNameFromText = (text: string): string => {
  const bracketMatch = text.match(/\[\[([^\]]+)\]\]/);
  if (bracketMatch && bracketMatch[1]) {
    return bracketMatch[1].trim();
  }

  return text;
};

const getSearchItemText = (item: HTMLElement): string => {
  const rawText = (item.innerText || item.textContent || '').trim();
  if (rawText) {
    const firstLine =
      rawText
        .split('\n')
        .map(line => line.trim())
        .find(Boolean) ?? '';
    if (firstLine) {
      return extractPageNameFromText(firstLine);
    }
  }
  const highlighted = Array.from(item.querySelectorAll(SEARCH_HIGHLIGHTED_SPAN_SELECTOR));
  if (highlighted.length > 0) {
    const joined = highlighted
      .map(el => el.textContent?.trim() ?? '')
      .filter(Boolean)
      .join(' ');
    if (joined) return joined;
  }

  return '';
};

const getSearchBlockText = (item: HTMLElement): string => {
  const breadcrumb = item.querySelector('.breadcrumb, .block-parents') as HTMLElement | null;
  const rawText = (item.innerText || item.textContent || '').trim();
  if (!rawText) return '';
  let sanitized = rawText;
  if (breadcrumb?.textContent) {
    sanitized = sanitized.replace(breadcrumb.textContent, '');
  }
  const lines = sanitized
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return '';
  const candidate = lines[lines.length - 1];
  if (candidate) return candidate;

  const highlights = Array.from(item.querySelectorAll(SEARCH_HIGHLIGHTED_SPAN_SELECTOR)).filter(
    span =>
      !span.closest('.breadcrumb') &&
      !span.closest('.block-parents') &&
      !span.closest('.page-ref') &&
      !span.closest('.ls-icon')
  );
  if (highlights.length > 0) {
    const joined = highlights
      .map(el => el.textContent?.trim() ?? '')
      .filter(Boolean)
      .join(' ');
    if (joined) return joined;
  }

  return '';
};
const findSearchContainer = (target?: HTMLElement | null): HTMLElement | null => {
  const containerSelector = getSearchContainerSelector();
  const direct = target?.closest(containerSelector) as HTMLElement | null;
  if (direct) return direct;
  const containers = Array.from(parent.document.querySelectorAll<HTMLElement>(containerSelector));

  return (
    containers.find(container => container.offsetParent !== null || container.offsetHeight > 0) ??
    null
  );
};

const isEnterKey = (event: KeyboardEvent): boolean =>
  event.key === 'Enter' ||
  event.key === 'NumpadEnter' ||
  event.code === 'Enter' ||
  event.code === 'NumpadEnter' ||
  event.key === 'Return';

const getSearchItems = (container: HTMLElement): { all: HTMLElement[]; leaf: HTMLElement[] } => {
  const itemSelector = getSearchItemSelector();
  const allItems = Array.from(container.querySelectorAll<HTMLElement>(itemSelector));
  if (allItems.length === 0) return { all: [], leaf: [] };
  const itemsWithText = allItems.filter(item => (item.innerText || item.textContent || '').trim());
  const baseItems = itemsWithText.length > 0 ? itemsWithText : allItems;
  const leafItems = baseItems.filter(
    item => !baseItems.some(other => other !== item && item.contains(other))
  );

  return {
    all: baseItems,
    leaf: leafItems.length > 0 ? leafItems : baseItems,
  };
};

const findInlineOpacitySearchItem = (container?: HTMLElement | null): HTMLElement | null => {
  const containerSelector = getSearchContainerSelector();
  const itemSelector = getSearchItemSelector();
  const containers = container
    ? [container]
    : Array.from(parent.document.querySelectorAll<HTMLElement>(containerSelector));
  for (const searchContainer of containers) {
    const direct = searchContainer.querySelector<HTMLElement>(
      `${itemSelector}[style*="opacity: 1"], ${itemSelector}[style*="opacity:1"]`
    );
    if (direct) return direct;
    const inlineElement = searchContainer.querySelector<HTMLElement>(
      '[style*="opacity: 1"], [style*="opacity:1"]'
    );
    if (inlineElement) {
      const closestItem = inlineElement.closest(itemSelector) as HTMLElement | null;
      if (closestItem && searchContainer.contains(closestItem)) return closestItem;
    }
  }

  return null;
};

const findSearchItemForElement = (
  element: HTMLElement | null,
  container: HTMLElement,
  items: HTMLElement[]
): HTMLElement | null => {
  if (!element) return null;

  return items.find(item => item.contains(element)) ?? null;
};

const getOpacityValue = (element: HTMLElement): number => {
  const opacity = parent.window.getComputedStyle(element).opacity;
  const value = parseFloat(opacity);

  return Number.isNaN(value) ? 0 : value;
};

const getSearchSelectedItem = (container: HTMLElement): HTMLElement | null => {
  const inlineSelected = findInlineOpacitySearchItem(container) ?? findInlineOpacitySearchItem();
  if (inlineSelected) {
    const inlineContainer = findSearchContainer(inlineSelected) ?? container;
    debugLog(DEBUG_PREFIX, 'search selection from inline opacity', {
      opacity: getOpacityValue(inlineSelected),
      sectionType: getSearchSectionType(inlineSelected, inlineContainer),
    });

    return inlineSelected;
  }

  const { all, leaf } = getSearchItems(container);
  if (leaf.length === 0) return null;

  const activeElement = parent.document.activeElement as HTMLElement | null;
  const fromActive = findSearchItemForElement(activeElement, container, leaf);
  if (fromActive) {
    debugLog(DEBUG_PREFIX, 'search selection from active element', {
      opacity: getOpacityValue(fromActive),
      sectionType: getSearchSectionType(fromActive, container),
    });

    return fromActive;
  }

  const classOpacityItem = all.find(item => item.classList.contains('opacity-100'));
  if (classOpacityItem) {
    const resolvedItem = leaf.find(item => classOpacityItem.contains(item)) ?? classOpacityItem;
    debugLog(DEBUG_PREFIX, 'search selection from opacity-100 class', {
      opacity: getOpacityValue(resolvedItem),
      sectionType: getSearchSectionType(resolvedItem, container),
    });

    return resolvedItem;
  }

  let maxOpacityItem = leaf[0];
  let maxOpacityValue = getOpacityValue(maxOpacityItem);
  leaf.slice(1).forEach(item => {
    const value = getOpacityValue(item);
    if (value > maxOpacityValue) {
      maxOpacityValue = value;
      maxOpacityItem = item;
    }
  });
  if (maxOpacityItem) {
    debugLog(DEBUG_PREFIX, 'search selection from max opacity', {
      opacity: maxOpacityValue,
      sectionType: getSearchSectionType(maxOpacityItem, container),
    });

    return maxOpacityItem;
  }

  const highlightedItems = Array.from(
    container.querySelectorAll<HTMLElement>(SEARCH_HIGHLIGHTED_SPAN_SELECTOR)
  )
    .map(span => findSearchItemForElement(span, container, leaf))
    .filter(Boolean) as HTMLElement[];
  const highlightedSelected = highlightedItems[0];
  if (highlightedSelected) {
    debugLog(DEBUG_PREFIX, 'search selection from highlights', {
      opacity: getOpacityValue(highlightedSelected),
      sectionType: getSearchSectionType(highlightedSelected, container),
    });

    return highlightedSelected;
  }

  debugLog(DEBUG_PREFIX, 'search selection fallback', {
    opacity: getOpacityValue(leaf[0]),
    sectionType: getSearchSectionType(leaf[0], container),
  });

  return leaf[0];
};

const findSearchItem = (target: HTMLElement, container: HTMLElement): HTMLElement | null => {
  const { leaf } = getSearchItems(container);
  const normalized = findSearchItemForElement(target, container, leaf);
  if (normalized) return normalized;

  if (container.contains(target) && target.querySelector(SEARCH_HIGHLIGHTED_SPAN_SELECTOR)) {
    return findSearchItemForElement(target, container, leaf);
  }

  const highlight = target.closest(SEARCH_HIGHLIGHTED_SPAN_SELECTOR) as HTMLElement | null;
  if (highlight) {
    const fromHighlight = findSearchItemForElement(highlight, container, leaf);
    if (fromHighlight) return fromHighlight;
  }

  return null;
};

const getSearchPaneTarget = (target: HTMLElement): ShiftClickTarget | null => {
  const container = findSearchContainer(target);
  if (!container) return null;
  const item = findSearchItem(target, container);
  if (!item) return null;
  const sectionType = getSearchSectionType(item, container);
  const preferPage = sectionType === 'page' || sectionType === 'recent';

  if (sectionType === 'block') {
    const blockText = getSearchBlockText(item);
    if (!blockText) return null;

    return {
      type: 'block',
      id: blockText,
      candidates: [blockText],
      searchSection: 'block',
    };
  }

  const text = getSearchItemText(item);
  if (!text) return null;

  return {
    type: 'page',
    id: text,
    candidates: [text],
    searchSection: preferPage ? (sectionType ?? 'page') : (sectionType ?? 'page'),
  };
};

const getPageCandidatesFromElement = (element: HTMLElement | null): string[] => {
  if (!element) return [];

  const candidates = new Set<string>();
  const addCandidate = (value: string | null | undefined) => {
    const trimmedValue = value?.trim();
    if (trimmedValue) {
      candidates.add(extractPageNameFromText(trimmedValue));
    }
  };

  addCandidate(element.getAttribute('data-ref'));
  addCandidate(element.getAttribute('data-page'));
  addCandidate(element.getAttribute('data-page-name'));
  addCandidate(element.textContent);

  return Array.from(candidates);
};

const getDbPageTargetElement = (target: HTMLElement): HTMLElement | null => {
  const directPageLink = target.closest(DB_SHIFT_CLICK_SELECTORS.pageLink) as HTMLElement | null;
  if (directPageLink) return directPageLink;

  let currentElement: HTMLElement | null = target;
  while (currentElement && currentElement !== parent.document.body) {
    if (currentElement.matches(DB_SHIFT_CLICK_SELECTORS.pageContainer)) {
      const descendantPageLink = currentElement.querySelector(
        DB_SHIFT_CLICK_SELECTORS.pageLink
      ) as HTMLElement | null;
      if (descendantPageLink) return descendantPageLink;

      const siblingPageLink = currentElement.parentElement?.querySelector(
        DB_SHIFT_CLICK_SELECTORS.pageLink
      ) as HTMLElement | null;
      if (siblingPageLink) return siblingPageLink;
    }

    currentElement = currentElement.parentElement;
  }

  return null;
};

const getShiftClickTarget = (target: HTMLElement): ShiftClickTarget | null => {
  const searchTarget = getSearchPaneTarget(target);
  if (searchTarget) {
    debugLog(DEBUG_PREFIX, 'search target', searchTarget);

    return searchTarget;
  }

  if (APP_SETTINGS_CONFIG.isDBVersion) {
    const dbPageElement = getDbPageTargetElement(target);
    const pageCandidates = getPageCandidatesFromElement(dbPageElement);
    if (pageCandidates.length > 0) {
      return { type: 'page', id: pageCandidates[0], candidates: pageCandidates };
    }
  }

  const pageElement = target.closest(SHIFT_CLICK_SELECTORS.page) as HTMLElement | null;
  const pageCandidates = getPageCandidatesFromElement(pageElement);
  if (pageCandidates.length > 0) {
    return { type: 'page', id: pageCandidates[0], candidates: pageCandidates };
  }

  const blockElement = target.closest(SHIFT_CLICK_SELECTORS.block) as HTMLElement | null;
  const blockId = blockElement?.getAttribute('blockid') ?? blockElement?.getAttribute('data-uuid');
  if (blockId) {
    debugLog(DEBUG_PREFIX, 'block target', blockId);

    return { type: 'block', id: blockId, candidates: [blockId] };
  }

  debugLog(DEBUG_PREFIX, 'no target match', {
    tag: target.tagName,
    className: target.className,
  });

  return null;
};

const getActivePaneContextFromState = (): Pick<
  PendingShiftClick,
  'activePaneId' | 'activePaneIndex'
> => {
  if (isActivePaneIndexValid()) {
    const activePaneIndex = globalState.currentActivePaneIndex as number;
    const activePane = globalState.cachedPanes[activePaneIndex];
    const activePaneId = activePane ? getPaneIdFromPane(activePane) : null;

    return { activePaneId, activePaneIndex };
  }

  const panes = getCurrentSidebarPanes();
  if (panes.length === 0) {
    return { activePaneId: null, activePaneIndex: null };
  }

  const selectedPane =
    panes.find(pane => (pane as HTMLElement).classList.contains('selectedPane')) ?? panes[0];
  const activePaneIndex = panes.indexOf(selectedPane);
  const activePaneId = getPaneIdFromPane(selectedPane);

  return {
    activePaneId,
    activePaneIndex: activePaneIndex >= 0 ? activePaneIndex : null,
  };
};

const getActivePaneContext = (
  target: HTMLElement
): Pick<PendingShiftClick, 'activePaneId' | 'activePaneIndex'> => {
  const panesContainer = getScrollablePanesContainer();
  const paneElement = target.closest('.sidebar-item') as HTMLElement | null;
  if (panesContainer && paneElement && panesContainer.contains(paneElement)) {
    const activePaneId = getPaneIdFromPane(paneElement);
    const indexValue = parseInt(paneElement.dataset.currentIndex ?? '-1', 10);
    const activePaneIndex = Number.isNaN(indexValue) ? null : indexValue;
    if (activePaneId || activePaneIndex !== null) {
      return { activePaneId: activePaneId ?? null, activePaneIndex };
    }
  }

  return getActivePaneContextFromState();
};

let pendingShiftClickTimer: ReturnType<typeof setTimeout> | null = null;
let pendingShiftClickRetryTimer: ReturnType<typeof setTimeout> | null = null;
let pendingSearchFocusTimer: ReturnType<typeof setTimeout> | null = null;
let pendingSearchFocusRetryTimer: ReturnType<typeof setTimeout> | null = null;
const SHIFT_CLICK_FALLBACK_DELAY_MS = 0;
const SHIFT_CLICK_RETRY_DELAY_MS = 200;

const createPendingSearchFocus = (target: ShiftClickTarget): PendingSearchFocus => ({
  targetType: target.type,
  targetId: target.id,
  targetCandidates: target.candidates ?? [target.id],
  searchSection: target.searchSection ?? null,
  timestamp: Date.now(),
});

const areCurrentPanesSynced = (panes: Element[]): boolean =>
  panes.length === globalState.cachedPanes.length &&
  panes.every((pane, index) => pane === globalState.cachedPanes[index]);

const getFocusedPaneFromDocument = (panes: Element[]): Element | null => {
  const activeElement = parent.document.activeElement as HTMLElement | null;
  if (!activeElement) return null;
  const paneElement = activeElement.closest('.sidebar-item') as HTMLElement | null;
  if (!paneElement) return null;

  return panes.find(pane => pane === paneElement) ?? null;
};

const focusPaneForSearchTarget = (pending: PendingSearchFocus): boolean => {
  const container = getScrollablePanesContainer();
  if (!container) return false;
  const currentPanes = getCurrentSidebarPanes(container);
  if (!areCurrentPanesSynced(currentPanes)) {
    debugLog(DEBUG_PREFIX, 'skip search focus while panes are mutating', {
      targetType: pending.targetType,
      targetId: pending.targetId,
      paneCount: currentPanes.length,
      cachedPaneCount: globalState.cachedPanes.length,
    });

    return false;
  }

  const targetPane =
    resolveShiftClickTargetPane(
      {
        ...pending,
        activePaneId: null,
        activePaneIndex: null,
      },
      currentPanes
    ) ?? getFocusedPaneFromDocument(currentPanes);
  if (!targetPane) {
    debugLog(DEBUG_PREFIX, 'search focus target pane not found', {
      targetType: pending.targetType,
      targetId: pending.targetId,
      targetCandidates: pending.targetCandidates,
      searchSection: pending.searchSection,
    });

    return false;
  }

  const targetIndex = currentPanes.indexOf(targetPane);
  if (targetIndex === -1) return false;

  debugLog(DEBUG_PREFIX, 'focus pane from search', {
    targetType: pending.targetType,
    targetId: pending.targetId,
    targetPaneId: getPaneIdFromPane(targetPane),
    targetIndex,
  });
  setActivePaneByIndex(targetIndex, currentPanes, true);

  return true;
};

const finalizePaneReorder = (
  targetPane: Element,
  activePane: Element | null,
  container: HTMLElement,
  options: { baseOrder?: Element[]; isNewPane?: boolean; targetInCache?: boolean } = {}
): void => {
  const currentPanes = getCurrentSidebarPanes(container);
  const targetInCache = options.targetInCache ?? globalState.cachedPanes.includes(targetPane);
  const activeInCache = activePane ? globalState.cachedPanes.includes(activePane) : false;
  const shouldUseCachedOrder = !options.baseOrder && targetInCache && activeInCache;
  const baseOrder =
    options.baseOrder ?? (shouldUseCachedOrder ? globalState.cachedPanes : currentPanes);
  const desiredOrder = getDesiredOrder(targetPane, activePane, baseOrder);
  if (!desiredOrder) {
    debugLog(DEBUG_PREFIX, 'desired order not found', {
      targetPaneId: getPaneIdFromPane(targetPane),
    });
    globalState.pendingShiftClick = null;

    return;
  }
  if (!arePanesDifferent(desiredOrder, currentPanes)) {
    debugLog(DEBUG_PREFIX, 'pane already in desired position');
    globalState.pendingShiftClick = null;

    return;
  }
  if (options.isNewPane) {
    applyPaneDimensions(targetPane as HTMLElement);
  }
  const updatedPanes = reorderPaneNextToActive(targetPane, activePane, container);
  if (!updatedPanes) {
    debugLog(DEBUG_PREFIX, 'reorder failed', {
      targetPaneId: getPaneIdFromPane(targetPane),
    });
    globalState.pendingShiftClick = null;

    return;
  }

  const indexToFocus = updatedPanes.indexOf(targetPane);
  if (indexToFocus !== -1) {
    setActivePaneByIndex(indexToFocus, updatedPanes);
  }
  updatePanesOrderInStorage(updatedPanes);
  updateTabs(updatedPanes);
  notifyVirtuosoScroll();
  globalState.lastShiftClickHandledAt = Date.now();
  globalState.pendingShiftClick = null;
};

const tryReorderByActivePane = (
  pending: PendingShiftClick,
  currentPanes: Element[],
  container: HTMLElement
): boolean => {
  const activePaneNow = getActivePaneElement(currentPanes);
  const previousActive = resolveActivePaneFromPending(pending, currentPanes);
  if (!activePaneNow || !previousActive || activePaneNow === previousActive) return false;
  if (!globalState.cachedPanes.includes(activePaneNow)) return false;
  debugLog(DEBUG_PREFIX, 'fallback reorder by active pane', {
    activePaneId: getPaneIdFromPane(activePaneNow),
    previousActiveId: getPaneIdFromPane(previousActive),
  });
  finalizePaneReorder(activePaneNow, previousActive, container, { targetInCache: true });

  return true;
};

const resolveBlockTargetViaLogseq = async (pending: PendingShiftClick): Promise<boolean> => {
  if (!logseq?.Editor?.getBlock) {
    debugLog(DEBUG_PREFIX, 'logseq Editor API unavailable for block resolve');

    return false;
  }
  try {
    const block = await logseq.Editor.getBlock(pending.targetId);
    const pageInfo: any = (block as any)?.page;
    let pageName: string | null =
      typeof pageInfo === 'string' ? pageInfo : (pageInfo?.originalName ?? pageInfo?.name ?? null);
    if (!pageName && pageInfo?.id && logseq?.Editor?.getPage) {
      const page = await logseq.Editor.getPage(pageInfo.id);
      pageName = typeof page === 'string' ? page : (page?.originalName ?? page?.name ?? pageName);
    }
    if (!pageName) {
      debugLog(DEBUG_PREFIX, 'block resolve missing page name', { blockId: pending.targetId });

      return false;
    }
    const currentPending = globalState.pendingShiftClick;
    if (!currentPending || currentPending.timestamp !== pending.timestamp) return false;
    const pageCandidates = buildPageCandidates(pageName, pageInfo);
    const updatedPending: PendingShiftClick = {
      ...currentPending,
      targetType: 'page',
      targetId: String(pageName),
      targetCandidates: pageCandidates,
    };
    globalState.pendingShiftClick = updatedPending;
    debugLog(DEBUG_PREFIX, 'block resolved to page', {
      blockId: pending.targetId,
      pageName,
    });

    const container = getScrollablePanesContainer();
    if (!container) return false;
    const currentPanes = getCurrentSidebarPanes(container);
    const targetPane = resolveShiftClickTargetPane(updatedPending, currentPanes);
    if (targetPane && globalState.cachedPanes.includes(targetPane)) {
      const activePane = resolveActivePaneFromPending(updatedPending, currentPanes);
      finalizePaneReorder(targetPane, activePane, container, { targetInCache: true });

      return true;
    }

    return tryReorderByActivePane(updatedPending, currentPanes, container);
  } catch (error) {
    debugWarn(DEBUG_PREFIX, 'block resolve failed', error);

    return false;
  }
};

const resolvePageTargetViaLogseq = async (pending: PendingShiftClick): Promise<boolean> => {
  if (!logseq?.Editor?.getPage) {
    debugLog(DEBUG_PREFIX, 'logseq Editor API unavailable for page resolve');

    return false;
  }
  try {
    const page = await logseq.Editor.getPage(pending.targetId);
    if (!page) {
      debugLog(DEBUG_PREFIX, 'page resolve returned empty', { targetId: pending.targetId });

      return false;
    }
    const pageInfo: any = page;
    const pageName =
      typeof pageInfo === 'string' ? pageInfo : (pageInfo?.originalName ?? pageInfo?.name ?? null);
    const pageCandidates = buildPageCandidates(pageName, pageInfo, pending.targetId);
    const currentPending = globalState.pendingShiftClick;
    if (!currentPending || currentPending.timestamp !== pending.timestamp) return false;
    const updatedPending: PendingShiftClick = {
      ...currentPending,
      targetType: 'page',
      targetId: pageName ?? pending.targetId,
      targetCandidates: pageCandidates,
    };
    globalState.pendingShiftClick = updatedPending;
    debugLog(DEBUG_PREFIX, 'page resolved via logseq', {
      targetId: pending.targetId,
      pageName,
      pageCandidates,
    });

    const container = getScrollablePanesContainer();
    if (!container) return false;
    const currentPanes = getCurrentSidebarPanes(container);
    const targetPane = resolveShiftClickTargetPane(updatedPending, currentPanes);
    if (targetPane && globalState.cachedPanes.includes(targetPane)) {
      const activePane = resolveActivePaneFromPending(updatedPending, currentPanes);
      finalizePaneReorder(targetPane, activePane, container, { targetInCache: true });

      return true;
    }

    return tryReorderByActivePane(updatedPending, currentPanes, container);
  } catch (error) {
    debugWarn(DEBUG_PREFIX, 'page resolve failed', error);

    return false;
  }
};

const attemptShiftClickReorder = (
  currentPending: PendingShiftClick,
  currentPanes: Element[],
  container: HTMLElement,
  options: { allowLogseqResolve: boolean }
): boolean => {
  // Allow new pane detection for blocks (they open as page panes)
  const shouldCheckNewPane =
    !currentPending.searchSection || currentPending.searchSection === 'block';
  if (shouldCheckNewPane) {
    const newPaneCandidate = getNewPaneCandidate(currentPanes);
    if (newPaneCandidate) {
      debugLog(DEBUG_PREFIX, 'new pane candidate detected', {
        targetPaneId: getPaneIdFromPane(newPaneCandidate),
      });
      const newPaneId = getPaneIdFromPane(newPaneCandidate);
      enforceMaxTabsLimit(newPaneId || undefined);
      const activePane = resolveActivePaneFromPending(currentPending, currentPanes);
      finalizePaneReorder(newPaneCandidate, activePane, container, {
        baseOrder: currentPanes,
        isNewPane: true,
      });

      return true;
    }
  }

  const targetPane = resolveShiftClickTargetPane(currentPending, currentPanes);
  if (targetPane) {
    const inCache = globalState.cachedPanes.includes(targetPane);
    debugLog(DEBUG_PREFIX, 'resolved target pane', {
      targetType: currentPending.targetType,
      targetId: currentPending.targetId,
      targetCandidates: currentPending.targetCandidates,
      searchSection: currentPending.searchSection,
      targetPaneId: getPaneIdFromPane(targetPane),
      inCache,
    });
    if (inCache) {
      debugLog(DEBUG_PREFIX, 'fallback reorder target pane', {
        targetPaneId: getPaneIdFromPane(targetPane),
      });
      const activePane = resolveActivePaneFromPending(currentPending, currentPanes);
      finalizePaneReorder(targetPane, activePane, container, { targetInCache: true });

      return true;
    }
    debugLog(DEBUG_PREFIX, 'target pane not in cache, skipping reorder');
  } else {
    debugLog(DEBUG_PREFIX, 'no target pane match', {
      targetType: currentPending.targetType,
      targetId: currentPending.targetId,
      targetCandidates: currentPending.targetCandidates,
      searchSection: currentPending.searchSection,
      paneCount: currentPanes.length,
    });
  }

  if (!currentPending.searchSection) {
    const reordered = tryReorderByActivePane(currentPending, currentPanes, container);
    if (reordered) return true;
  }

  // Allow Logseq API resolution for blocks (even from search) and pages without searchSection
  const allowResolve =
    options.allowLogseqResolve &&
    (!currentPending.searchSection || currentPending.searchSection === 'block');
  if (allowResolve) {
    if (currentPending.targetType === 'block') {
      void resolveBlockTargetViaLogseq(currentPending);
    } else if (currentPending.targetType === 'page') {
      const candidateCount = currentPending.targetCandidates?.length ?? 0;
      if (candidateCount <= 1) {
        void resolvePageTargetViaLogseq(currentPending);
      }
    }
  }

  return false;
};

const scheduleExistingPaneReorder = (pending: PendingShiftClick): void => {
  if (pendingShiftClickTimer) {
    clearTimeout(pendingShiftClickTimer);
    pendingShiftClickTimer = null;
  }
  if (pendingShiftClickRetryTimer) {
    clearTimeout(pendingShiftClickRetryTimer);
    pendingShiftClickRetryTimer = null;
  }
  pendingShiftClickTimer = waitForDomChanges(() => {
    const currentPending = globalState.pendingShiftClick;
    if (!currentPending || currentPending.timestamp !== pending.timestamp) return;
    const container = getScrollablePanesContainer();
    if (!container) return;
    const currentPanes = getCurrentSidebarPanes(container);
    const handled = attemptShiftClickReorder(currentPending, currentPanes, container, {
      allowLogseqResolve: true,
    });
    if (handled) return;

    pendingShiftClickRetryTimer = waitForDomChanges(() => {
      const retryPending = globalState.pendingShiftClick;
      if (!retryPending || retryPending.timestamp !== pending.timestamp) return;
      if (globalState.lastPanesMutationAt > retryPending.timestamp) {
        debugLog(DEBUG_PREFIX, 'skip fallback after mutation', {
          lastMutationAt: globalState.lastPanesMutationAt,
          pendingAt: retryPending.timestamp,
        });

        return;
      }
      const retryContainer = getScrollablePanesContainer();
      if (!retryContainer) return;
      const retryPanes = getCurrentSidebarPanes(retryContainer);
      attemptShiftClickReorder(retryPending, retryPanes, retryContainer, {
        allowLogseqResolve: true,
      });
    }, SHIFT_CLICK_RETRY_DELAY_MS / 1000).timeoutId;
  }, SHIFT_CLICK_FALLBACK_DELAY_MS / 1000).timeoutId;
};

const scheduleSearchPaneFocus = (pending: PendingSearchFocus): void => {
  if (pendingSearchFocusTimer) {
    clearTimeout(pendingSearchFocusTimer);
    pendingSearchFocusTimer = null;
  }
  if (pendingSearchFocusRetryTimer) {
    clearTimeout(pendingSearchFocusRetryTimer);
    pendingSearchFocusRetryTimer = null;
  }

  pendingSearchFocusTimer = waitForDomChanges(() => {
    const handled = focusPaneForSearchTarget(pending);
    if (handled) return;

    pendingSearchFocusRetryTimer = waitForDomChanges(() => {
      focusPaneForSearchTarget(pending);
    }, SHIFT_CLICK_RETRY_DELAY_MS / 1000).timeoutId;
  }, SHIFT_CLICK_FALLBACK_DELAY_MS / 1000).timeoutId;
};

export const setupShiftClickPaneTracking = (): (() => void) => {
  const getEventTargetElement = (event: Event): HTMLElement | null => {
    const rawTarget = event.target as Element | null;

    return rawTarget && rawTarget.nodeType === 1
      ? (rawTarget as HTMLElement)
      : (rawTarget?.parentElement ?? null);
  };

  const setPendingShiftClickFromTarget = (
    target: HTMLElement,
    shiftTarget: ShiftClickTarget
  ): void => {
    const { activePaneId, activePaneIndex } = getActivePaneContext(target);
    globalState.pendingShiftClick = {
      targetType: shiftTarget.type,
      targetId: shiftTarget.id,
      targetCandidates: shiftTarget.candidates ?? [shiftTarget.id],
      searchSection: shiftTarget.searchSection ?? null,
      timestamp: Date.now(),
      activePaneId,
      activePaneIndex,
    };
    debugLog(DEBUG_PREFIX, 'pending set', globalState.pendingShiftClick);
    startShiftClickPaneWatcher();
    scheduleExistingPaneReorder(globalState.pendingShiftClick);
  };

  const handleShiftPointerEvent = (event: MouseEvent, eventType: 'mousedown' | 'click') => {
    if (!globalState.isPanesModeModeActive) return;
    if (!event.shiftKey || event.button !== 0) return;

    const target = getEventTargetElement(event);
    if (!target) return;

    const shiftTarget = getShiftClickTarget(target);
    if (!shiftTarget) return;

    setPendingShiftClickFromTarget(target, shiftTarget);
  };

  const handleMouseDown = (event: MouseEvent) => {
    // DB graphs swallow the shift-mousedown on page refs, so legacy keeps mousedown
    // while DB mode uses the shift-click path below.
    if (APP_SETTINGS_CONFIG.isDBVersion) return;

    handleShiftPointerEvent(event, 'mousedown');
  };

  const handleClick = (event: MouseEvent) => {
    if (!globalState.isPanesModeModeActive) return;
    if (event.button !== 0) return;

    if (event.shiftKey) {
      if (!APP_SETTINGS_CONFIG.isDBVersion) return;
      handleShiftPointerEvent(event, 'click');

      return;
    }

    const target = getEventTargetElement(event);
    if (!target) return;

    const searchTarget = getSearchPaneTarget(target);
    if (!searchTarget) return;

    const pendingSearchFocus = createPendingSearchFocus(searchTarget);
    debugLog(DEBUG_PREFIX, 'search click focus pending', pendingSearchFocus);
    scheduleSearchPaneFocus(pendingSearchFocus);
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (!globalState.isPanesModeModeActive) return;
    if (!isEnterKey(event)) return;

    const target = getEventTargetElement(event);
    const activeElement = parent.document.activeElement as HTMLElement | null;
    const container =
      findSearchContainer(target) ?? findSearchContainer(activeElement) ?? findSearchContainer();
    if (!container) return;

    const selectedItem = getSearchSelectedItem(container);
    if (!selectedItem) return;

    const selectionContainer = findSearchContainer(selectedItem) ?? container;
    const sectionType = getSearchSectionType(selectedItem, selectionContainer);
    debugLog(DEBUG_PREFIX, 'search enter selection', {
      tag: selectedItem.tagName,
      className: selectedItem.className,
      sectionType,
      opacity: getOpacityValue(selectedItem),
      pageText: getSearchItemText(selectedItem),
      blockText: getSearchBlockText(selectedItem),
    });

    const searchTarget = getSearchPaneTarget(selectedItem);
    if (!searchTarget) return;

    if (!event.shiftKey) {
      const pendingSearchFocus = createPendingSearchFocus(searchTarget);
      debugLog(DEBUG_PREFIX, 'search enter focus pending', pendingSearchFocus);
      scheduleSearchPaneFocus(pendingSearchFocus);

      return;
    }

    const { activePaneId, activePaneIndex } = getActivePaneContext(selectedItem);
    globalState.pendingShiftClick = {
      targetType: searchTarget.type,
      targetId: searchTarget.id,
      targetCandidates: searchTarget.candidates ?? [searchTarget.id],
      searchSection: searchTarget.searchSection ?? null,
      timestamp: Date.now(),
      activePaneId,
      activePaneIndex,
    };
    debugLog(DEBUG_PREFIX, 'shift+enter pending set', globalState.pendingShiftClick);
    startShiftClickPaneWatcher();
    scheduleExistingPaneReorder(globalState.pendingShiftClick);
  };

  const targetWindow = parent.window ?? window;
  targetWindow.addEventListener('mousedown', handleMouseDown, true);
  targetWindow.addEventListener('click', handleClick, true);
  targetWindow.addEventListener('keydown', handleKeyDown, true);
  debugLog(DEBUG_PREFIX, 'listeners attached to parent.window');

  return () => {
    targetWindow.removeEventListener('mousedown', handleMouseDown, true);
    targetWindow.removeEventListener('click', handleClick, true);
    targetWindow.removeEventListener('keydown', handleKeyDown, true);
    stopShiftClickPaneWatcher();
    if (pendingShiftClickTimer) {
      clearTimeout(pendingShiftClickTimer);
      pendingShiftClickTimer = null;
    }
    if (pendingShiftClickRetryTimer) {
      clearTimeout(pendingShiftClickRetryTimer);
      pendingShiftClickRetryTimer = null;
    }
    if (pendingSearchFocusTimer) {
      clearTimeout(pendingSearchFocusTimer);
      pendingSearchFocusTimer = null;
    }
    if (pendingSearchFocusRetryTimer) {
      clearTimeout(pendingSearchFocusRetryTimer);
      pendingSearchFocusRetryTimer = null;
    }
  };
};
