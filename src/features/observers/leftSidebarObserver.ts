import { LOGSEQ_UI_SELECTORS } from '../../core/constants';
import { manageActionButtonsPosition } from '../layout/layout';

export const initLeftSidebarObserver = (): MutationObserver | null => {
  const leftSidebar = parent.document.querySelector<HTMLElement>(LOGSEQ_UI_SELECTORS.leftSidebar);
  let isLeftSidebarOpenCached = leftSidebar?.classList.contains('is-open') || false;
  if (!leftSidebar) {
    console.warn('Left sidebar not found, skipping toggle observer setup.');

    return null;
  }
  const leftSidebarToggleObserver = new MutationObserver(mutations => {
    mutations.forEach(mutation => {
      if (mutation.type !== 'attributes' || mutation.attributeName !== 'class') return;
      const sidebarElement = mutation.target as HTMLElement;
      const isLeftSideBarOpen = sidebarElement.classList.contains('is-open');
      const isLeftSidebarStateChanged = isLeftSideBarOpen !== isLeftSidebarOpenCached;
      if (!isLeftSidebarStateChanged) return;
      isLeftSidebarOpenCached = isLeftSideBarOpen;
      const rightSidebar = parent.document.querySelector(
        LOGSEQ_UI_SELECTORS.rightSidebar
      ) as HTMLElement;
      const isRightSidebarOpen = Boolean(
        rightSidebar?.querySelector(LOGSEQ_UI_SELECTORS.rightSidebarContainer)
      );
      if (!isRightSidebarOpen) return;
      const isRightSidebarExtended =
        rightSidebar.classList.contains('fullRightSidebar') ||
        rightSidebar.classList.contains('doubleRightSidebar');
      if (!isRightSidebarExtended) return;
      if (isLeftSideBarOpen) {
        rightSidebar.classList.remove('fullRightSidebar');
        rightSidebar.classList.add('doubleRightSidebar');
      } else {
        rightSidebar.classList.remove('doubleRightSidebar');
        rightSidebar.classList.add('fullRightSidebar');
      }
      manageActionButtonsPosition();
    });
  });
  leftSidebarToggleObserver.observe(leftSidebar, {
    attributes: true,
    attributeFilter: ['class'],
    attributeOldValue: false,
    childList: false,
  });

  return leftSidebarToggleObserver;
};
