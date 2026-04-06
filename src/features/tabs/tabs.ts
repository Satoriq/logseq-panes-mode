import { APP_SETTINGS_CONFIG, TABS_CONTAINER_CLASSES } from '../../core/constants';
import {
  getPaneTitle,
  getPaneIdFromPane,
  getScrollablePanesContainer,
  syncPaneHeaderTitle,
  getTabsContainer,
} from '../../core/domUtils';
import { globalState } from '../../core/pluginGlobalState';
import { showError, waitForDomChanges } from '../../core/utils';
import { EXPECTED_MUTATIONS } from '../observers/types';
import { closePaneByIndex } from '../panes/paneActions';
import { getCurrentSidebarPanes, syncPaneIndices } from '../panes/paneCache';
import { centerActiveTabWithPadding, setActivePaneByIndex } from '../panes/paneNavigation';
import { TABS_CLASSES } from './consts';
import { getPaneIndexFromElement } from './utils';

let draggedPaneId: string | null = null;

// Approved by flesh being
export const createTabsContainer = (): HTMLElement | undefined => {
  const existingTabsContainer = getTabsContainer(APP_SETTINGS_CONFIG.isVerticalTabs);
  if (existingTabsContainer) return existingTabsContainer;

  const tabsContainer = parent.document.createElement('div');
  const containerClassName = APP_SETTINGS_CONFIG.isVerticalTabs
    ? TABS_CONTAINER_CLASSES.vertical
    : TABS_CONTAINER_CLASSES.horizontal;
  tabsContainer.className = containerClassName;

  if (APP_SETTINGS_CONFIG.isVerticalTabs) {
    const rightSideContainer = parent.document.querySelector('#right-sidebar-container');
    rightSideContainer?.classList.add('right-sidebar-vertical-tabs');
  }

  const sidebarInner = parent.document.querySelector('.cp__right-sidebar-inner');
  if (sidebarInner) {
    sidebarInner.prepend(tabsContainer);
  }

  return tabsContainer;
};

const createTab = (
  pane: Element,
  index: number,
  updateTabs: (currentPanes?: Element[]) => void
): HTMLElement => {
  const tab = parent.document.createElement('div');
  tab.className = TABS_CLASSES.tab;
  tab.dataset.paneIndex = index.toString();
  tab.dataset.paneId = getPaneIdFromPane(pane) || `pane-${index}`;
  tab.draggable = true;

  const isCollapsed = pane.classList.contains('collapsed');
  const title = getPaneTitle(pane);

  const textSpan = parent.document.createElement('span');
  textSpan.className = TABS_CLASSES.tabText;
  textSpan.textContent = `${isCollapsed ? '>' : ''} ${title}`;
  tab.appendChild(textSpan);

  const closeButton = parent.document.createElement('span');
  closeButton.className = TABS_CLASSES.tabClose;
  closeButton.innerHTML = '×';
  closeButton.onclick = e => {
    const currentIndex = getPaneIndexFromElement(tab);
    e.stopPropagation();
    closePaneByIndex(currentIndex, updateTabs);
  };
  tab.appendChild(closeButton);

  tab.onclick = () => {
    const currentIndex = getPaneIndexFromElement(tab);
    setActivePaneByIndex(currentIndex, undefined, true);
  };

  tab.addEventListener('dragstart', handleDragStart);
  tab.addEventListener('dragover', handleDragOver);
  tab.addEventListener('dragleave', handleDragLeave);
  tab.addEventListener('drop', handleDrop);
  tab.addEventListener('dragend', handleDragEnd);

  return tab;
};

const handleDragStart = (e: DragEvent): void => {
  const target = e.target as HTMLElement;
  const tabElement = target.closest(`.${TABS_CLASSES.tab}`) as HTMLElement;
  if (!tabElement || !e.dataTransfer) return;
  globalState.draggedTabIndex = getPaneIndexFromElement(tabElement);
  if (globalState.draggedTabIndex === -1) {
    draggedPaneId = null;

    return;
  }
  const currentPanes = getCurrentSidebarPanes();
  const draggedPane = currentPanes[globalState.draggedTabIndex];
  draggedPaneId = draggedPane ? getPaneIdFromPane(draggedPane) : null;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', globalState.draggedTabIndex.toString());
  tabElement.classList.add(TABS_CLASSES.dragging);
  const tabsContainer = tabElement.closest(
    `.${TABS_CONTAINER_CLASSES.horizontal}, .${TABS_CONTAINER_CLASSES.vertical}`
  ) as HTMLElement | null;
  tabsContainer?.classList.add('panesMode-tabs-dragging');
};

const handleDragOver = (e: DragEvent): void => {
  e.preventDefault();
  const target = e.target as HTMLElement;
  const tabElement = target.closest(`.${TABS_CLASSES.tab}`) as HTMLElement;
  if (!tabElement || !e.dataTransfer || !e.target || globalState.draggedTabIndex === null) return;
  const currentTargetIndex = getPaneIndexFromElement(tabElement);
  if (currentTargetIndex === globalState.draggedTabIndex) {
    tabElement.classList.remove(
      TABS_CLASSES.dragOver,
      TABS_CLASSES.dragOverLeft,
      TABS_CLASSES.dragOverRight,
      TABS_CLASSES.dragOverTop,
      TABS_CLASSES.dragOverBottom
    );

    return;
  }
  e.dataTransfer.dropEffect = 'move';
  tabElement.classList.add(TABS_CLASSES.dragOver);

  const rect = tabElement.getBoundingClientRect();
  const isVerticalTabs = APP_SETTINGS_CONFIG.isVerticalTabs;
  if (isVerticalTabs) {
    const midPointY = rect.top + rect.height / 2;
    tabElement.classList.remove(TABS_CLASSES.dragOverLeft, TABS_CLASSES.dragOverRight);
    if (e.clientY < midPointY) {
      tabElement.classList.add(TABS_CLASSES.dragOverTop);
      tabElement.classList.remove(TABS_CLASSES.dragOverBottom);
    } else {
      tabElement.classList.add(TABS_CLASSES.dragOverBottom);
      tabElement.classList.remove(TABS_CLASSES.dragOverTop);
    }
  } else {
    const midPointX = rect.left + rect.width / 2;
    tabElement.classList.remove(TABS_CLASSES.dragOverTop, TABS_CLASSES.dragOverBottom);
    if (e.clientX < midPointX) {
      tabElement.classList.add(TABS_CLASSES.dragOverLeft);
      tabElement.classList.remove(TABS_CLASSES.dragOverRight);
    } else {
      tabElement.classList.add(TABS_CLASSES.dragOverRight);
      tabElement.classList.remove(TABS_CLASSES.dragOverLeft);
    }
  }
};

const handleDragLeave = (e: DragEvent): void => {
  const target = e.target as HTMLElement;
  const tabElement = target.closest(`.${TABS_CLASSES.tab}`);
  tabElement?.classList.remove(
    TABS_CLASSES.dragOver,
    TABS_CLASSES.dragOverLeft,
    TABS_CLASSES.dragOverRight,
    TABS_CLASSES.dragOverTop,
    TABS_CLASSES.dragOverBottom
  );
};

const handleDrop = (e: DragEvent): void => {
  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();
  const target = e.target as HTMLElement;
  const dropTargetTab = target.closest(`.${TABS_CLASSES.tab}`) as HTMLElement;
  dropTargetTab?.classList.remove(
    TABS_CLASSES.dragOver,
    TABS_CLASSES.dragOverLeft,
    TABS_CLASSES.dragOverRight,
    TABS_CLASSES.dragOverTop,
    TABS_CLASSES.dragOverBottom
  );
  const isDataAndTargetValid = dropTargetTab && e.dataTransfer;
  if (!isDataAndTargetValid || globalState.draggedTabIndex === null) {
    globalState.draggedTabIndex = null;
    draggedPaneId = null;

    return;
  }

  const dropTargetIndex = getPaneIndexFromElement(dropTargetTab);
  if (dropTargetIndex === -1 || globalState.draggedTabIndex === dropTargetIndex) {
    globalState.draggedTabIndex = null;

    return;
  }

  const rect = dropTargetTab.getBoundingClientRect();
  const isVerticalTabs = APP_SETTINGS_CONFIG.isVerticalTabs;
  const midPoint = isVerticalTabs ? rect.top + rect.height / 2 : rect.left + rect.width / 2;
  const isDropBefore = isVerticalTabs ? e.clientY < midPoint : e.clientX < midPoint;
  const scrollableContainer = getScrollablePanesContainer();
  const panes = getCurrentSidebarPanes();
  const draggedPane =
    draggedPaneId !== null
      ? panes.find(pane => getPaneIdFromPane(pane) === draggedPaneId) ||
        panes[globalState.draggedTabIndex]
      : panes[globalState.draggedTabIndex];
  const dropTargetPane = panes[dropTargetIndex];
  if (!draggedPane) {
    globalState.draggedTabIndex = null;
    draggedPaneId = null;

    return;
  }
  globalState.expectedMutations.push(EXPECTED_MUTATIONS.tabDragAndDrop);
  if (isDropBefore) {
    scrollableContainer?.insertBefore(draggedPane, dropTargetPane);
  } else {
    dropTargetPane.after(draggedPane);
  }

  const updatedPanes = getCurrentSidebarPanes();
  const newDraggedPaneIndex = updatedPanes.indexOf(draggedPane);
  setActivePaneByIndex(newDraggedPaneIndex, updatedPanes);
  updateTabs(updatedPanes);

  waitForDomChanges().then(() => {
    const tabsContainer = getTabsContainer(APP_SETTINGS_CONFIG.isVerticalTabs);
    const activeTab = tabsContainer?.querySelector('.panesMode-tab.active-tab') as HTMLElement;
    if (tabsContainer && activeTab) {
      centerActiveTabWithPadding(tabsContainer, activeTab, 'smooth');
    }
  });

  globalState.draggedTabIndex = null;
  draggedPaneId = null;
  const tabsContainer = getTabsContainer(APP_SETTINGS_CONFIG.isVerticalTabs);
  tabsContainer?.classList.remove('panesMode-tabs-dragging');
};

const handleDragEnd = (): void => {
  const tabsContainer = getTabsContainer(APP_SETTINGS_CONFIG.isVerticalTabs);
  tabsContainer
    ?.querySelectorAll(
      `.${TABS_CLASSES.tab}.${TABS_CLASSES.dragging}, .${TABS_CLASSES.tab}.${TABS_CLASSES.dragOver}, .${TABS_CLASSES.tab}.${TABS_CLASSES.dragOverLeft}, .${TABS_CLASSES.tab}.${TABS_CLASSES.dragOverRight}, .${TABS_CLASSES.tab}.${TABS_CLASSES.dragOverTop}, .${TABS_CLASSES.tab}.${TABS_CLASSES.dragOverBottom}`
    )
    .forEach(tab => {
      tab.classList.remove(
        TABS_CLASSES.dragging,
        TABS_CLASSES.dragOver,
        TABS_CLASSES.dragOverLeft,
        TABS_CLASSES.dragOverRight,
        TABS_CLASSES.dragOverTop,
        TABS_CLASSES.dragOverBottom
      );
    });
  tabsContainer?.classList.remove('panesMode-tabs-dragging');
  globalState.draggedTabIndex = null;
  draggedPaneId = null;
};

let previousActivePaneIndex: number = 0;

export const resetTabsState = (): void => {
  previousActivePaneIndex = 0;
  draggedPaneId = null;
};

// Approved by flesh being
export const updateTabs = (currentPanes?: Element[]): void => {
  const panes = currentPanes || getCurrentSidebarPanes();
  let tabsContainer = getTabsContainer(APP_SETTINGS_CONFIG.isVerticalTabs);
  if (!tabsContainer) {
    tabsContainer = createTabsContainer();
  }
  if (!tabsContainer) {
    showError('Failed to create tabs container.');

    return;
  }

  const existingTabs = Array.from(
    tabsContainer.querySelectorAll(`:scope > .${TABS_CLASSES.tab}`)
  ) as HTMLElement[];

  const existingTabsByPaneId = new Map<string, HTMLElement>();
  existingTabs.forEach(tab => {
    const paneId = tab.dataset.paneId;
    if (paneId) existingTabsByPaneId.set(paneId, tab);
  });

  const newTabs = new Set<HTMLElement>();
  const currentActiveIndex = globalState.currentActivePaneIndex;

  const updateTabsBasedOnCurrentPanes = () => {
    panes.forEach((pane, paneIndex) => {
      syncPaneHeaderTitle(pane);
      const paneId = getPaneIdFromPane(pane) || `pane-${paneIndex}`;
      const isCollapsed = pane.classList.contains('collapsed');
      const title = getPaneTitle(pane);
      const isActivePane = paneIndex === currentActiveIndex;
      const expectedText = `${isCollapsed ? '>' : ''} ${title}`;

      let tabForCurrentPane = existingTabsByPaneId.get(paneId);

      const updateExistingTab = () => {
        newTabs.add(tabForCurrentPane);
        tabForCurrentPane.dataset.paneIndex = paneIndex.toString();

        const tabText = tabForCurrentPane.querySelector(
          `.${TABS_CLASSES.tabText}`
        ) as HTMLElement | null;
        if (tabText && tabText.textContent !== expectedText) {
          tabText.textContent = expectedText;
        }

        const wasActive = tabForCurrentPane.classList.contains(TABS_CLASSES.activeTab);
        if (isActivePane && !wasActive) {
          tabForCurrentPane.classList.add(TABS_CLASSES.activeTab);
        } else if (!isActivePane && wasActive) {
          tabForCurrentPane.classList.remove(TABS_CLASSES.activeTab);
        }

        const currentPosition = Array.from(tabsContainer.children).indexOf(tabForCurrentPane);
        if (currentPosition !== paneIndex) {
          const referenceNode = tabsContainer.children[paneIndex] || null;
          tabsContainer.insertBefore(tabForCurrentPane, referenceNode);
        }
      };

      const createNewTab = () => {
        tabForCurrentPane = createTab(pane, paneIndex, updateTabs);
        tabForCurrentPane.dataset.paneId = paneId;
        if (isActivePane) {
          tabForCurrentPane.classList.add(TABS_CLASSES.activeTab);
        }
        const referenceNode = tabsContainer.children[paneIndex] || null;
        tabsContainer.insertBefore(tabForCurrentPane, referenceNode);
        newTabs.add(tabForCurrentPane);
      };

      if (tabForCurrentPane) {
        updateExistingTab();
      } else {
        createNewTab();
      }

      const referenceNode = tabsContainer.children[paneIndex] || null;
      tabsContainer.insertBefore(tabForCurrentPane, referenceNode);
      newTabs.add(tabForCurrentPane);
    });

    const removeUnusedTabs = () =>
      existingTabs.filter(tab => !newTabs.has(tab)).forEach(tab => tab.remove());
    removeUnusedTabs();
  };

  updateTabsBasedOnCurrentPanes();
  syncPaneIndices(panes);

  const activeTabChanged = previousActivePaneIndex !== currentActiveIndex;

  if (activeTabChanged) {
    previousActivePaneIndex = currentActiveIndex;
    const activeTab = tabsContainer.querySelector(
      `.${TABS_CLASSES.tab}.${TABS_CLASSES.activeTab}`
    ) as HTMLElement;
    if (activeTab) {
      requestAnimationFrame(() => {
        centerActiveTabWithPadding(tabsContainer, activeTab, 'smooth');
      });
    }
  }
};
