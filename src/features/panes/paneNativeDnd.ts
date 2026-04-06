import { getScrollablePanesContainer } from '../../core/domUtils';
import { globalState } from '../../core/pluginGlobalState';
import { EXPECTED_MUTATIONS } from '../observers/types';
import { getCurrentSidebarPanes, refreshPanesElementsCache } from './paneCache';
import { setActivePaneByIndex } from './paneNavigation';
import { updatePanesOrderInStorage } from './panePersistence';

const DROP_ZONE_CLASSES = {
  container: 'panesMode-pane-drop-zones',
  zone: 'panesMode-pane-drop-zone',
  zoneBefore: 'panesMode-pane-drop-zone-before',
  zoneAfter: 'panesMode-pane-drop-zone-after',
  zoneActive: 'panesMode-pane-drop-zone-active',
  paneIsDragTarget: 'panesMode-pane-drag-target',
} as const;

type DragDropData = {
  isPaneReorderActive: boolean;
  invalidStartPlace: boolean;
  invalidDropPlace: boolean;
  destinationPaneIndex: number | null;
  destinationPaneSide: string;
  draggedPaneElement: HTMLElement | null;
};

const getDragAndDropInitialState = (): DragDropData => ({
  isPaneReorderActive: false,
  invalidStartPlace: false,
  invalidDropPlace: false,
  destinationPaneIndex: null,
  destinationPaneSide: '',
  draggedPaneElement: null,
});

let dragAndDropData: DragDropData = getDragAndDropInitialState();

const resetDragAndDropData = () => {
  dragAndDropData = getDragAndDropInitialState();
};

const createDropZones = (pane: HTMLElement): HTMLElement => {
  const container = parent.document.createElement('div');
  container.className = DROP_ZONE_CLASSES.container;

  const beforeZone = parent.document.createElement('div');
  beforeZone.className = `${DROP_ZONE_CLASSES.zone} ${DROP_ZONE_CLASSES.zoneBefore}`;
  beforeZone.innerHTML = '<span>Move before</span>';

  const afterZone = parent.document.createElement('div');
  afterZone.className = `${DROP_ZONE_CLASSES.zone} ${DROP_ZONE_CLASSES.zoneAfter}`;
  afterZone.innerHTML = '<span>Move after</span>';

  container.appendChild(beforeZone);
  container.appendChild(afterZone);

  pane.appendChild(container);

  return container;
};

const showDropZones = (pane: HTMLElement): void => {
  let dropZonesContainer = pane.querySelector(
    `.${DROP_ZONE_CLASSES.container}`
  ) as HTMLElement | null;
  if (!dropZonesContainer) {
    dropZonesContainer = createDropZones(pane);
  }
  dropZonesContainer.style.display = 'flex';
  dropZonesContainer.style.pointerEvents = 'auto';
  pane.classList.add(DROP_ZONE_CLASSES.paneIsDragTarget);
};

const hideDropZones = (pane: HTMLElement): void => {
  pane.classList.remove(DROP_ZONE_CLASSES.paneIsDragTarget);
  const container = pane.querySelector(`.${DROP_ZONE_CLASSES.container}`) as HTMLElement | null;
  if (container) {
    container.style.display = 'none';
    container.style.pointerEvents = 'none';
  }
  const zones = pane.querySelectorAll(`.${DROP_ZONE_CLASSES.zone}`);
  zones.forEach(zone => zone.classList.remove(DROP_ZONE_CLASSES.zoneActive));
};

const hideAllDropZones = (): void => {
  const allPanes = parent.document.querySelectorAll('.sidebar-item');
  allPanes.forEach(pane => hideDropZones(pane as HTMLElement));
};

const updateActiveDropZone = (pane: HTMLElement, side: 'left' | 'right'): void => {
  const beforeZone = pane.querySelector(`.${DROP_ZONE_CLASSES.zoneBefore}`);
  const afterZone = pane.querySelector(`.${DROP_ZONE_CLASSES.zoneAfter}`);

  if (side === 'left') {
    beforeZone?.classList.add(DROP_ZONE_CLASSES.zoneActive);
    afterZone?.classList.remove(DROP_ZONE_CLASSES.zoneActive);
  } else {
    beforeZone?.classList.remove(DROP_ZONE_CLASSES.zoneActive);
    afterZone?.classList.add(DROP_ZONE_CLASSES.zoneActive);
  }
};

const handlePotentialNativeDropEnd = (e: DragEvent) => {
  if (!globalState.isPanesModeModeActive) {
    resetDragAndDropData();

    return;
  }
  if (!dragAndDropData.isPaneReorderActive) {
    resetDragAndDropData();

    return;
  }
  if (dragAndDropData.invalidStartPlace) {
    resetDragAndDropData();

    return;
  }
  const currentPanes = getCurrentSidebarPanes();
  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();
  if (dragAndDropData.invalidDropPlace) {
    resetDragAndDropData();

    return;
  }
  const draggedElement = e.target as HTMLElement;
  const draggedPaneElement = draggedElement.closest('.sidebar-item') as HTMLElement | null;
  const destinationPaneIndex = dragAndDropData.destinationPaneIndex;
  const destinationPaneSide = dragAndDropData.destinationPaneSide;
  const destinationPaneElement =
    destinationPaneIndex !== null ? currentPanes[destinationPaneIndex] : null;
  if (!destinationPaneElement || !draggedPaneElement) {
    resetDragAndDropData();

    return;
  }
  const panesWithoutDragged = currentPanes.filter(pane => pane !== draggedPaneElement);
  const desiredOrder = panesWithoutDragged;
  const newDestinationPaneIndex = desiredOrder.indexOf(destinationPaneElement);
  if (destinationPaneSide === 'left') {
    desiredOrder.splice(newDestinationPaneIndex, 0, draggedPaneElement);
  } else if (destinationPaneSide === 'right') {
    desiredOrder.splice(newDestinationPaneIndex + 1, 0, draggedPaneElement);
  }
  const isPanesOrderChanged = desiredOrder.some((pane, index) => pane !== currentPanes[index]);
  if (isPanesOrderChanged) {
    globalState.expectedMutations.push(EXPECTED_MUTATIONS.dragAndDropItemReordering);
  }
  const container = getScrollablePanesContainer();
  if (!container) return;
  desiredOrder.forEach((pane, index) => {
    if (container.children[index] !== pane) {
      container.insertBefore(pane, container.children[index] || null);
    }
  });
  const updatedPanes = getCurrentSidebarPanes();
  updatePanesOrderInStorage(updatedPanes);

  updatedPanes.forEach(pane => pane.classList.remove('selectedPane'));

  refreshPanesElementsCache(updatedPanes);

  const newActiveIndex = updatedPanes.indexOf(draggedPaneElement);
  setActivePaneByIndex(newActiveIndex, updatedPanes);
  resetDragAndDropData();
};

export const setupNativeDragDropListener = (): (() => void) => {
  const panesContainer = getScrollablePanesContainer();
  if (!panesContainer) {
    return () => {};
  }
  const handleDragStart = (e: DragEvent) => {
    if (!globalState.isPanesModeModeActive) {
      resetDragAndDropData();

      return;
    }
    const draggedElement = e.target as HTMLElement;
    const draggedPane = draggedElement.closest('.sidebar-item') as HTMLElement | null;

    if (!draggedPane) {
      dragAndDropData = {
        ...getDragAndDropInitialState(),
        invalidStartPlace: true,
      };

      return;
    }

    const isPaneHeaderDragged = Boolean(
      draggedElement.classList.contains('sidebar-item-header') ||
      draggedElement.closest('.sidebar-item-header')
    );

    const isValidDragSource = isPaneHeaderDragged || draggedElement === draggedPane;

    dragAndDropData = {
      ...getDragAndDropInitialState(),
      isPaneReorderActive: isValidDragSource,
      invalidStartPlace: !isValidDragSource,
      draggedPaneElement: isValidDragSource ? draggedPane : null,
    };
  };

  const handleDragOver = (e: DragEvent) => {
    if (
      !globalState.isPanesModeModeActive ||
      !dragAndDropData.isPaneReorderActive ||
      dragAndDropData.invalidStartPlace
    ) {
      hideAllDropZones();

      return;
    }

    e.preventDefault();
    const targetElement = e.target as HTMLElement;
    const paneElement = targetElement.closest('.sidebar-item') as HTMLElement | null;

    if (!paneElement || paneElement === dragAndDropData.draggedPaneElement) {
      hideAllDropZones();

      return;
    }

    const allPanes = parent.document.querySelectorAll('.sidebar-item');
    allPanes.forEach(pane => {
      if (pane !== paneElement) hideDropZones(pane as HTMLElement);
    });

    showDropZones(paneElement);

    const dropSide =
      paneElement.clientWidth / 2 < e.clientX - paneElement.getBoundingClientRect().left
        ? 'right'
        : 'left';

    updateActiveDropZone(paneElement, dropSide as 'left' | 'right');
  };

  const handleDragLeave = (e: DragEvent) => {
    if (
      !globalState.isPanesModeModeActive ||
      !dragAndDropData.isPaneReorderActive ||
      dragAndDropData.invalidStartPlace
    ) {
      hideAllDropZones();

      return;
    }

    const targetElement = e.target as HTMLElement;
    const paneElement = targetElement.closest('.sidebar-item') as HTMLElement | null;
    const relatedTarget = e.relatedTarget as HTMLElement | null;

    if (paneElement && relatedTarget && !paneElement.contains(relatedTarget)) {
      hideDropZones(paneElement);
    }
  };

  const handleDrop = (e: DragEvent) => {
    hideAllDropZones();

    if (!globalState.isPanesModeModeActive) {
      resetDragAndDropData();

      return;
    }
    if (!dragAndDropData.isPaneReorderActive) {
      resetDragAndDropData();

      return;
    }
    if (dragAndDropData.invalidStartPlace) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    const targetElement = e.target as HTMLElement;
    if (!targetElement) return;
    const paneElement = targetElement.closest('.sidebar-item') as HTMLElement | null;
    const samePane = paneElement === dragAndDropData.draggedPaneElement;
    const paneIndex = parseInt(paneElement?.dataset.currentIndex ?? '-1', 10);
    if (!paneElement || Number.isNaN(paneIndex) || samePane) return;
    const dropSide =
      paneElement.clientWidth / 2 < e.clientX - paneElement.getBoundingClientRect().left
        ? 'right'
        : 'left';
    dragAndDropData = {
      ...dragAndDropData,
      invalidDropPlace: false,
      destinationPaneIndex: paneIndex,
      destinationPaneSide: dropSide,
    };
  };

  const executeOnNativeDragEnd = (e: DragEvent) => {
    hideAllDropZones();

    if (!globalState.isPanesModeModeActive) {
      resetDragAndDropData();

      return;
    }
    handlePotentialNativeDropEnd(e);
  };
  panesContainer.addEventListener('dragstart', handleDragStart);
  panesContainer.addEventListener('dragover', handleDragOver);
  panesContainer.addEventListener('dragleave', handleDragLeave);
  panesContainer.addEventListener('drop', handleDrop);
  panesContainer.addEventListener('dragend', executeOnNativeDragEnd);

  return () => {
    panesContainer.removeEventListener('dragstart', handleDragStart);
    panesContainer.removeEventListener('dragover', handleDragOver);
    panesContainer.removeEventListener('dragleave', handleDragLeave);
    panesContainer.removeEventListener('drop', handleDrop);
    panesContainer.removeEventListener('dragend', executeOnNativeDragEnd);
    hideAllDropZones();
    resetDragAndDropData();
  };
};
