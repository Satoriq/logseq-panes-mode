import { getScrollablePanesContainer } from '../../core/domUtils';
import { getInitialPanesOrder } from './panePersistence';
import { getCurrentSidebarPanes } from './paneCache';
import { refreshPanesElementsCache } from './paneCache';

export const applyInitialPanesOrder = (
  idToPaneMap: Map<string, Element>,
  updateTabs: (panes: Element[]) => void,
  focusPaneByIndex: (index: number, panes?: Element[]) => void
): void => {
  const container = getScrollablePanesContainer();
  if (!container) return;

  const idToPaneMapCopy: Map<string, Element> = new Map(idToPaneMap);
  const reorderedPanes: Element[] = [];
  const storedOrder = getInitialPanesOrder();

  storedOrder.forEach(storedId => {
    const pane = idToPaneMapCopy.get(storedId);
    if (pane) {
      reorderedPanes.push(pane);
      idToPaneMapCopy.delete(storedId);
    }
  });

  idToPaneMapCopy.forEach(pane => reorderedPanes.push(pane));

  reorderedPanes.forEach((pane, desiredIndex) => {
    if (container.children[desiredIndex] === pane) return;
    const referenceNode = container.children[desiredIndex] ?? null;
    container.insertBefore(pane, referenceNode);
  });

  const updatedPanes = getCurrentSidebarPanes();
  focusPaneByIndex(0, updatedPanes);
  updateTabs(updatedPanes);
  refreshPanesElementsCache(updatedPanes);
};
