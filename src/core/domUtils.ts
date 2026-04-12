import { APP_SETTINGS_CONFIG, LOGSEQ_UI_SELECTORS, PLUGIN_UI_SELECTORS } from './constants';

type DomQueryOptions = {
  root?: ParentNode;
};

const BLOCK_TEXT_SELECTORS = [
  '.block-content',
  '.block-content-wrapper',
  '.block-content-inner',
  '.block-content-inline',
].join(', ');

const GENERIC_REFERENCE_PANE_TITLES = new Set(['block references']);
const GENERIC_REFERENCE_PANE_DATASET_KEY = 'panesModeGenericReferencePane';
const DB_HEADER_TITLE_READ_SELECTORS = [
  '.sidebar-item-header .page-title > span.overflow-hidden.text-ellipsis',
  '.sidebar-item-header .page-title > span',
  '.sidebar-item-header .page-title',
];
const DB_HEADER_TITLE_WRITE_SELECTORS = [
  '.sidebar-item-header .page-title > span.overflow-hidden.text-ellipsis',
  '.sidebar-item-header .page-title > span',
];

const normalizePaneTitle = (value: string): string =>
  value.trim().toLowerCase().replace(/\s+/g, ' ');

const isUuidLike = (value: string): boolean => {
  const trimmedValue = value.trim();

  return /^[0-9a-f-]{16,}$/i.test(trimmedValue) && trimmedValue.includes('-');
};

export const queryParent = <T extends Element>(
  selector: string,
  options: DomQueryOptions = {}
): T | null => {
  const root = options.root ?? parent.document;

  return root.querySelector(selector) as T | null;
};

export const getParentElementById = <T extends HTMLElement>(id: string): T | null => {
  return parent.document.getElementById(id) as T | null;
};

export function isElementVerticallyInViewport(
  element: HTMLElement,
  container?: HTMLElement,
  threshold: number = 0
): boolean {
  if (!element) return false;
  const rect = element.getBoundingClientRect();
  const containerRect = container?.getBoundingClientRect() ?? rect;
  const elementHeight = rect.height;
  const visibleHeight =
    Math.min(rect.bottom, containerRect.bottom) - Math.max(rect.top, containerRect.top);

  return (
    visibleHeight >= elementHeight * threshold &&
    rect.top < containerRect.bottom &&
    rect.bottom > containerRect.top
  );
}

export const arePanesDifferent = (
  firstElementsList: Element[],
  secondElementsList: Element[]
): boolean => {
  if (!firstElementsList || !secondElementsList) return true;
  if (firstElementsList.length !== secondElementsList.length) return true;
  for (let i = 0; i < firstElementsList.length; i++) {
    if (firstElementsList[i] !== secondElementsList[i]) return true;
  }

  return false;
};

export const getScrollablePanesContainer = (): HTMLElement | null => {
  return queryParent<HTMLElement>(LOGSEQ_UI_SELECTORS.panesContainer);
};

export const getTabsContainer = (isVerticalTabs: boolean): HTMLElement | null => {
  const selector = isVerticalTabs
    ? PLUGIN_UI_SELECTORS.tabsVertical
    : PLUGIN_UI_SELECTORS.tabsHorizontal;

  return queryParent<HTMLElement>(selector);
};

export const getRightSidebarContainer = (): HTMLElement | null => {
  return queryParent<HTMLElement>(LOGSEQ_UI_SELECTORS.rightSidebarContainer);
};

export const getRightSidebar = (): HTMLElement | null => {
  return queryParent<HTMLElement>(LOGSEQ_UI_SELECTORS.rightSidebar);
};

export const getLeftSidebar = (): HTMLElement | null => {
  return queryParent<HTMLElement>(LOGSEQ_UI_SELECTORS.leftSidebar);
};

export const getLeftContainer = (): HTMLElement | null => {
  return queryParent<HTMLElement>(LOGSEQ_UI_SELECTORS.leftContainer);
};

export const getMainContent = (): HTMLElement | null => {
  return queryParent<HTMLElement>(LOGSEQ_UI_SELECTORS.mainContent);
};

const getHeaderTitleElementsBySelectors = (
  pane: Element,
  selectors: string[]
): HTMLElement[] => {
  for (const selector of selectors) {
    const titleElements = Array.from(pane.querySelectorAll<HTMLElement>(selector)).filter(el =>
      Boolean(el.textContent?.trim())
    );
    if (titleElements.length > 0) return titleElements;
  }

  return [];
};

const getHeaderPaneTitleElements = (pane: Element): HTMLElement[] => {
  if (APP_SETTINGS_CONFIG.isDBVersion) {
    const dbTitleElements = getHeaderTitleElementsBySelectors(pane, DB_HEADER_TITLE_READ_SELECTORS);
    if (dbTitleElements.length > 0) return dbTitleElements;
  }

  return getHeaderTitleElementsBySelectors(pane, [LOGSEQ_UI_SELECTORS.tabTitle]);
};

const getEditableHeaderPaneTitleElement = (pane: Element): HTMLElement | null => {
  if (APP_SETTINGS_CONFIG.isDBVersion) {
    const dbTitleElements = getHeaderTitleElementsBySelectors(
      pane,
      DB_HEADER_TITLE_WRITE_SELECTORS
    );
    if (dbTitleElements.length > 0) return dbTitleElements[0];
  }

  return pane.querySelector(LOGSEQ_UI_SELECTORS.tabTitle) as HTMLElement | null;
};

const getHeaderPaneTitleParts = (pane: Element): string[] => {
  const titleElements = getHeaderPaneTitleElements(pane);
  if (titleElements.length === 0) return [];

  return Array.from(titleElements)
    .map(el => el.textContent?.trim())
    .filter(Boolean);
};

const getHeaderPaneTitle = (pane: Element): string | null => {
  const parts = getHeaderPaneTitleParts(pane);

  return parts.length > 0 ? parts.join(' > ') : null;
};

const isGenericReferencePaneTitle = (title: string | null): boolean =>
  title ? GENERIC_REFERENCE_PANE_TITLES.has(normalizePaneTitle(title)) : false;

const isGenericReferencePane = (pane: Element): boolean => {
  const paneElement = pane as HTMLElement;

  return (
    paneElement.dataset[GENERIC_REFERENCE_PANE_DATASET_KEY] === 'true' ||
    isGenericReferencePaneTitle(getHeaderPaneTitle(pane))
  );
};

const getBlockText = (blockElement: Element): string | null => {
  const contentElement = blockElement.querySelector(BLOCK_TEXT_SELECTORS) as HTMLElement | null;
  const text = (contentElement ?? blockElement).textContent?.replace(/\s+/g, ' ').trim();

  return text ? text : null;
};

const getBlockCandidateElements = (pane: Element): HTMLElement[] => {
  const blockElements = Array.from(pane.querySelectorAll<HTMLElement>('[blockid]'));

  return blockElements.length > 0
    ? blockElements
    : Array.from(pane.querySelectorAll<HTMLElement>('.block-ref[data-uuid]'));
};

const getTopLevelBlockElements = (pane: Element): HTMLElement[] => {
  const blockElements = getBlockCandidateElements(pane);
  if (blockElements.length === 0) return [];

  const hasBlockIds = blockElements.some(block => block.hasAttribute('blockid'));
  if (!hasBlockIds) return blockElements;

  return blockElements.filter(block => {
    const parentBlock = block.parentElement?.closest<HTMLElement>('[blockid]');

    return !parentBlock || !pane.contains(parentBlock);
  });
};

const getHighestCurrentBlockElement = (pane: Element): HTMLElement | null => {
  const topLevelBlocks = getTopLevelBlockElements(pane);
  if (topLevelBlocks.length === 0) return null;

  for (const topLevelBlock of topLevelBlocks) {
    const nestedBlock = Array.from(topLevelBlock.querySelectorAll<HTMLElement>('[blockid]')).find(
      block => block !== topLevelBlock && Boolean(getBlockText(block))
    );
    if (nestedBlock) return nestedBlock;
  }

  return topLevelBlocks.slice(1).find(block => Boolean(getBlockText(block))) ?? null;
};

const getRepresentativeBlockElement = (pane: Element): HTMLElement | null => {
  const highestCurrentBlock = isGenericReferencePane(pane)
    ? getHighestCurrentBlockElement(pane)
    : null;
  if (highestCurrentBlock) return highestCurrentBlock;

  const candidateElements = getBlockCandidateElements(pane);
  if (candidateElements.length === 0) return null;

  const preferredBlock = candidateElements.find(block => {
    const text = getBlockText(block);

    return text ? (block.getAttribute('data-refs-self') ?? '').trim() === '' : false;
  });
  if (preferredBlock) return preferredBlock;

  return candidateElements.find(block => Boolean(getBlockText(block))) ?? null;
};

const getContentDerivedPaneTitle = (pane: Element): string | null => {
  const blockElement = getRepresentativeBlockElement(pane);

  return blockElement ? getBlockText(blockElement) : null;
};

export const getPaneTitle = (pane: Element): string => {
  const headerTitle = getHeaderPaneTitle(pane);
  if (headerTitle && !isGenericReferencePane(pane)) {
    return headerTitle;
  }

  const contentDerivedTitle = getContentDerivedPaneTitle(pane);
  if (contentDerivedTitle) return contentDerivedTitle;

  // TODO: Check that it wont parse Page/Block icon

  return headerTitle ?? 'Untitled';
};

export const syncPaneHeaderTitle = (pane: Element): void => {
  const paneElement = pane as HTMLElement;
  const headerTitle = getHeaderPaneTitle(pane);
  if (!isGenericReferencePaneTitle(headerTitle)) {
    delete paneElement.dataset[GENERIC_REFERENCE_PANE_DATASET_KEY];

    return;
  }
  paneElement.dataset[GENERIC_REFERENCE_PANE_DATASET_KEY] = 'true';

  const contentDerivedTitle = getContentDerivedPaneTitle(pane);
  if (!contentDerivedTitle) return;

  const headerTitleElement = getEditableHeaderPaneTitleElement(pane);
  if (!headerTitleElement || headerTitleElement.textContent?.trim() === contentDerivedTitle) return;

  headerTitleElement.textContent = contentDerivedTitle;
};

const getPaneAttributeId = (element: HTMLElement | null): string | null => {
  if (!element) return null;

  const attributeValue =
    element.getAttribute('data-page') ??
    element.getAttribute('data-page-name') ??
    element.getAttribute('data-refs-self');

  const trimmedValue = attributeValue?.trim();

  return trimmedValue ? trimmedValue : null;
};

const getUuidElementId = (element: HTMLElement | null): string | null => {
  if (!element?.id) return null;
  const trimmedId = element.id.trim();

  return isUuidLike(trimmedId) ? trimmedId : null;
};

const getRepresentativeBlockId = (pane: Element): string | null => {
  const blockElement = getRepresentativeBlockElement(pane);
  if (!blockElement) return null;

  const blockId = blockElement.getAttribute('blockid')?.trim();
  if (blockId) return blockId;

  const dataUuid = blockElement.getAttribute('data-uuid')?.trim();
  if (dataUuid) return dataUuid;

  const nestedBlockRef = blockElement.querySelector<HTMLElement>('.block-ref[data-uuid]');
  const nestedBlockRefId = nestedBlockRef?.getAttribute('data-uuid')?.trim();
  if (nestedBlockRefId) return nestedBlockRefId;

  return getUuidElementId(blockElement);
};

// Approved
export const getPaneIdFromPane = (pane: Element): string | null => {
  const paneElement = pane as HTMLElement;
  const contentWrapper = pane.querySelector(
    LOGSEQ_UI_SELECTORS.paneContentWrapper
  ) as HTMLElement | null;
  const isReferencePane = isGenericReferencePane(pane);
  const attributeId = getPaneAttributeId(paneElement) ?? getPaneAttributeId(contentWrapper);
  if (attributeId && !isReferencePane) return attributeId;

  const paneElementId = getUuidElementId(paneElement);
  if (paneElementId) return paneElementId;

  const contentWrapperId = getUuidElementId(contentWrapper);
  if (contentWrapperId) return contentWrapperId;

  if (contentWrapper) {
    let currentParent = contentWrapper.parentElement as HTMLElement | null;
    while (currentParent && currentParent !== paneElement) {
      const currentParentId = getUuidElementId(currentParent);
      if (currentParentId) return currentParentId;
      currentParent = currentParent.parentElement;
    }
  }

  if (isReferencePane) {
    const representativeBlockId = getRepresentativeBlockId(pane);
    if (representativeBlockId) return representativeBlockId;
    if (attributeId) return attributeId;
  }

  const paneTitle = getPaneTitle(pane);

  return paneTitle !== 'Untitled' ? paneTitle : null;
};

export const isRightSidebarVisible = (): boolean => Boolean(getRightSidebarContainer());

export const getPaneIdToElementMap = (panes: Element[]): Map<string, Element> => {
  const idToPaneMap = new Map<string, Element>();
  panes.forEach(pane => {
    const pageId = getPaneIdFromPane(pane);
    if (pageId) idToPaneMap.set(pageId, pane);
  });

  return idToPaneMap;
};
