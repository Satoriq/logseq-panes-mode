import { APP_SETTINGS_CONFIG } from '../../core/constants';
import { getTabsContainer, getScrollablePanesContainer } from '../../core/domUtils';
import { getPluginSettings } from '../../core/pluginSettings';
import { globalState } from '../../core/pluginGlobalState';
import { getCurrentSidebarPanes } from './paneCache';
import { updateLastActivePanesInStorage } from './panePersistence';

const scrollQueue: Array<{ targetLeft: number; duration: number }> = [];
let isScrolling = false;
let currentAnimation: number | null = null;

function smoothContinuousScrollTo(
  element: HTMLElement,
  targetLeft: number,
  speedMultiplier = 2
): void {
  const duration = 300 / speedMultiplier;
  scrollQueue.push({ targetLeft, duration });
  if (!isScrolling) {
    processScrollQueue(element);
  }
}

function processScrollQueue(element: HTMLElement): void {
  if (scrollQueue.length === 0) {
    isScrolling = false;
    currentAnimation = null;

    return;
  }

  isScrolling = true;
  const { targetLeft, duration } = scrollQueue.shift()!;
  const startTime = performance.now();
  const startLeft = element.scrollLeft;
  const distance = targetLeft - startLeft;

  function animateScroll(currentTime: number) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const easeOutQuad = 0.5 - 0.5 * Math.cos(Math.PI * progress);
    element.scrollLeft = startLeft + distance * easeOutQuad;

    if (progress > 0.85 && scrollQueue.length > 0) {
      processScrollQueue(element);

      return;
    }
    if (progress < 1) {
      currentAnimation = requestAnimationFrame(animateScroll);
    } else {
      processScrollQueue(element);
    }
  }

  if (currentAnimation) {
    cancelAnimationFrame(currentAnimation);
  }
  currentAnimation = requestAnimationFrame(animateScroll);
}

export const updateFocusPaneStylingGlobally = (activeIndex: number): void => {
  const currentPanes = getCurrentSidebarPanes();
  currentPanes.forEach((pane, index) => {
    pane.classList.toggle('selectedPane', index === activeIndex);
  });
};

const updateFocusPaneStylingLocally = (activeIndex: number, panes: Element[]): void => {
  const previousIndex = globalState.currentActivePaneIndex;

  if (previousIndex !== null && previousIndex !== activeIndex && panes[previousIndex]) {
    panes[previousIndex].classList.remove('selectedPane');
  }
  if (panes[activeIndex]) {
    panes[activeIndex].classList.add('selectedPane');
  }
};

export const focusNextVisiblePane = (
  collapsedPane: HTMLElement,
  updateTabs?: (panes?: Element[]) => void
): void => {
  const currentIndex = globalState.currentActivePaneIndex;
  if (currentIndex === null) return;
  if (globalState.cachedPanes[currentIndex] !== collapsedPane) return;

  const visibleIndexes = globalState.cachedPanes
    .map((pane, idx) => (!pane.classList.contains('collapsed') ? idx : -1))
    .filter(idx => idx !== -1);

  if (visibleIndexes.length === 0) {
    globalState.currentActivePaneIndex = null;
    updateTabs?.();

    return;
  }

  const nextIndex = visibleIndexes.find(idx => idx > currentIndex) ?? visibleIndexes[0];
  if (nextIndex !== currentIndex) {
    setActivePaneByIndex(nextIndex, globalState.cachedPanes, true);
  }
};

export const centerActiveTabWithPadding = (
  tabsContainer: HTMLElement | null,
  activeTab: HTMLElement | null,
  scrollBehavior: ScrollBehavior = 'smooth'
): void => {
  if (!tabsContainer || !activeTab) return;
  const containerWidth = tabsContainer.clientWidth;
  const tabWidth = activeTab.clientWidth;
  const padding = containerWidth * APP_SETTINGS_CONFIG.activeTabOverflowCoefficient;
  const targetScrollLeft = activeTab.offsetLeft - padding + tabWidth / 2;
  tabsContainer.scrollTo({
    left: Math.max(0, targetScrollLeft),
    behavior: scrollBehavior,
  });
};

let previousActiveTabIndex: number = 0;

export const resetActiveTabIndex = (): void => {
  previousActiveTabIndex = 0;
};

export const updateActiveTab = (scrollBehavior: ScrollBehavior = 'smooth'): void => {
  const tabsContainer = getTabsContainer(APP_SETTINGS_CONFIG.isVerticalTabs);
  if (!tabsContainer) return;

  const newIndex = globalState.currentActivePaneIndex;
  const tabs = Array.from(tabsContainer.querySelectorAll<HTMLElement>('.panesMode-tab'));
  const activeIndexString = newIndex !== null ? String(newIndex) : null;

  tabs.forEach(tab => {
    const shouldBeActive = activeIndexString !== null && tab.dataset.paneIndex === activeIndexString;
    tab.classList.toggle('active-tab', shouldBeActive);
  });

  const activeTab =
    activeIndexString !== null
      ? (tabs.find(tab => tab.dataset.paneIndex === activeIndexString) as HTMLElement | undefined)
      : undefined;

  if (activeTab) {
    previousActiveTabIndex = newIndex;
    requestAnimationFrame(() => {
      centerActiveTabWithPadding(tabsContainer, activeTab, scrollBehavior);
    });
  } else if (newIndex !== null) {
    previousActiveTabIndex = newIndex;
  }
};

// Approved
export const setActivePaneByIndex = (
  desiredPaneIndex: number,
  currentPanes?: Element[],
  fastStyleUpdate: boolean = false,
  scrollSpeedMultiplier = 1,
  isNativeScroll?: boolean,
  skipScroll: boolean = false,
  forceScroll: boolean = false
): void => {
  const isSamePane = globalState.currentActivePaneIndex === desiredPaneIndex;

  const scrollableContainer = getScrollablePanesContainer();
  if (!scrollableContainer) return;

  const panes = currentPanes || globalState.cachedPanes;
  const newActivePane = panes[desiredPaneIndex];
  if (!newActivePane) return;

  if (fastStyleUpdate) {
    updateFocusPaneStylingLocally(desiredPaneIndex, panes);
  } else {
    updateFocusPaneStylingGlobally(desiredPaneIndex);
  }

  if (!skipScroll && (!isSamePane || forceScroll)) {
    const { smoothScrollEnabled } = getPluginSettings();
    const containerRect = scrollableContainer.getBoundingClientRect();
    const paneRect = newActivePane.getBoundingClientRect();
    const paneLeftEdge = paneRect.left - containerRect.left;
    const paneRightEdge = paneLeftEdge + paneRect.width;
    const scrollBufferForUX = APP_SETTINGS_CONFIG.activePaneScrollOverflowBuffer;
    const isFullyVisible =
      paneLeftEdge >= scrollBufferForUX && paneRightEdge <= containerRect.width - scrollBufferForUX;

    if (!isFullyVisible) {
      let newScrollLeft = scrollableContainer.scrollLeft;

      if (paneLeftEdge < scrollBufferForUX) {
        newScrollLeft += paneLeftEdge - scrollBufferForUX;
      } else if (paneRightEdge > containerRect.width - scrollBufferForUX) {
        newScrollLeft += paneRightEdge - (containerRect.width - scrollBufferForUX);
      }

      const targetScrollLeft = Math.round(newScrollLeft);

      if (isNativeScroll || !smoothScrollEnabled) {
        scrollableContainer.scrollTo({
          left: targetScrollLeft,
          behavior: smoothScrollEnabled ? 'smooth' : 'auto',
        });
      } else {
        smoothContinuousScrollTo(scrollableContainer, targetScrollLeft, scrollSpeedMultiplier);
      }
    }
  }

  globalState.currentActivePaneIndex = desiredPaneIndex;

  if (!isSamePane) {
    updateActiveTab();
    updateLastActivePanesInStorage(desiredPaneIndex, panes);
  }
};
