import { PLUGIN_UI_SELECTORS } from '../../core/constants';
import {
  debugGroupCollapsed,
  debugGroupEnd,
  debugLog,
  debugWarn,
} from '../../core/logger';
import {
  getPaneIdFromPane,
  getParentElementById,
  getRightSidebarContainer,
  getScrollablePanesContainer,
} from '../../core/domUtils';
import { globalState } from '../../core/pluginGlobalState';
import type { ProjectListItem } from './types';
import {
  debounce,
  isPrimaryShortcutModifierPressed,
  showError,
  showSuccess,
  waitForDomChanges,
} from '../../core/utils';
import { EXPECTED_MUTATIONS } from '../observers/types';
import { stopPaneOrderSync } from '../observers/paneMutations';
import { getCurrentSidebarPanes, refreshPanesElementsCache } from '../panes/paneCache';
import { setActivePaneByIndex } from '../panes/paneNavigation';
import { updatePanesOrderInStorage } from '../panes/panePersistence';
import { updateTabs } from '../tabs/tabs';
import { getAllProjectsList, saveProject, deleteProject, getProjectById } from './projectStorage';
import { PROJECTS_CLASSES } from './consts';
import { createProjectsModalHTML } from './projectsView';

let modalKeydownHandler: ((e: KeyboardEvent) => void) | null = null;
let escapeKeydownHandler: ((e: KeyboardEvent) => void) | null = null;

const PROJECT_DELETE_ICON = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M3 6h18" />
    <path d="M8 6V4h8v2" />
    <path d="M19 6l-1 14H6L5 6" />
    <path d="M10 11v6" />
    <path d="M14 11v6" />
  </svg>
`;

const debouncedUpdateList = debounce((query: string) => {
  void updateProjectsListImmediate(query);
}, 50);

export const openProject = async (projectId: string): Promise<void> => {
  const project = await getProjectForOpen(projectId);
  if (!project) return;

  logProjectPanesForOpen(projectId, project);

  hideProjectsModal();

  const currentPanes = getCurrentSidebarPanes();
  const keeperPaneId = currentPanes.length > 0 ? getPaneIdFromPane(currentPanes[0]) : null;

  await closePanesExceptFirst(currentPanes);

  const openedCount = await openProjectPanes(project.panesOrder);
  if (openedCount === 0) {
    showError('Could not open any panes from project');

    return;
  }

  await waitForDomChanges(undefined, 0.3);

  const container = getScrollablePanesContainer();
  if (container) {
    applyProjectPaneLayout(project, container);
  }

  await removeKeeperPaneIfNeeded(keeperPaneId, project.panesOrder);

  finalizeProjectOpen(project);
};

const logProjectPanesForOpen = (projectId: string, project: ProjectListItem['data']): void => {
  const panes = project.panesOrder.map(pageId => ({
    pageId,
    dimensions: project.paneDimensions[pageId] ?? null,
    fitContentHeight: project.paneFitContentHeight[pageId] ?? false,
    collapseOrientation: project.paneCollapseOrientation[pageId] ?? null,
  }));

  debugGroupCollapsed(`[PanesMode][Projects] Opening panes for project "${project.name}"`);
  debugLog('projectId:', projectId);
  debugLog('project:', project);
  debugLog('panes:', panes);
  debugGroupEnd();
};

const isUuidLike = (value: string): boolean => {
  const trimmedValue = value.trim();

  return /^[0-9a-f-]{16,}$/i.test(trimmedValue) && trimmedValue.includes('-');
};

const resolveProjectPaneTarget = async (savedPaneId: string): Promise<string | null> => {
  const trimmedPaneId = savedPaneId.trim();
  if (!trimmedPaneId) return null;
  if (isUuidLike(trimmedPaneId) || !logseq?.Editor?.getPage) {
    return trimmedPaneId;
  }

  try {
    const page: any = await logseq.Editor.getPage(trimmedPaneId);
    if (!page) {
      return trimmedPaneId;
    }

    const resolvedPaneId =
      page?.uuid ?? page?.id ?? page?.originalName ?? page?.name ?? trimmedPaneId;

    if (resolvedPaneId !== trimmedPaneId) {
      debugLog('[PanesMode][Projects] Resolved saved pane reference', {
        savedPaneId: trimmedPaneId,
        resolvedPaneId,
      });
    }

    return resolvedPaneId;
  } catch (error) {
    debugWarn('[PanesMode][Projects] Failed to resolve saved pane reference', {
      savedPaneId: trimmedPaneId,
      error,
    });

    return trimmedPaneId;
  }
};

export const initProjectsModal = (): HTMLElement => {
  const existingModal = getParentElementById<HTMLElement>(PLUGIN_UI_SELECTORS.projectsModalId);
  if (existingModal) {
    existingModal.remove();
  }

  const modal = createProjectsModalElement();

  attachSearchInputListeners(modal);
  attachModalKeyHandlers(modal);
  attachModalClickHandlers(modal);
  attachAddButtonHandler(modal);

  return modal;
};

export const showProjectsModal = (): void => {
  if (!globalState.isPanesModeModeActive) return;

  const modal =
    getParentElementById<HTMLElement>(PLUGIN_UI_SELECTORS.projectsModalId) || initProjectsModal();

  ensureModalInRightSidebar(modal);
  setModalVisibleState(modal);
  attachShowKeyHandlers(modal);
  scheduleModalFocusReset();
};

export const hideProjectsModal = (): void => {
  const modal = getParentElementById<HTMLElement>(PLUGIN_UI_SELECTORS.projectsModalId);
  if (modal) {
    modal.classList.remove('visible');
    modal.setAttribute('aria-hidden', 'true');
    globalState.isProjectsModalVisible = false;

    const searchInput = modal.querySelector(
      `.${PROJECTS_CLASSES.search}`
    ) as HTMLInputElement | null;
    if (searchInput) {
      searchInput.blur();
      searchInput.tabIndex = -1;
    }

    if (modalKeydownHandler) {
      modal.removeEventListener('keydown', modalKeydownHandler, true);
      modalKeydownHandler = null;
    }
    if (escapeKeydownHandler) {
      parent.document.removeEventListener('keydown', escapeKeydownHandler, true);
      escapeKeydownHandler = null;
    }
  }
};

export const updateProjectsSelection = (): void => {
  const modal = getParentElementById<HTMLElement>(PLUGIN_UI_SELECTORS.projectsModalId);
  if (!modal) return;

  const items = modal.querySelectorAll(
    `.${PROJECTS_CLASSES.item}:not(.${PROJECTS_CLASSES.noResults})`
  );
  items.forEach((item, index) => {
    if (index === globalState.projectsSelectedIndex) {
      item.classList.add('selected');
      (item as HTMLElement).scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    } else {
      item.classList.remove('selected');
    }
  });
};

export const cleanupProjects = (): void => {
  const projectsModal = getParentElementById<HTMLElement>(PLUGIN_UI_SELECTORS.projectsModalId);
  if (projectsModal) {
    if (modalKeydownHandler) {
      projectsModal.removeEventListener('keydown', modalKeydownHandler, true);
      modalKeydownHandler = null;
    }
    if (escapeKeydownHandler) {
      parent.document.removeEventListener('keydown', escapeKeydownHandler, true);
      escapeKeydownHandler = null;
    }
    projectsModal.remove();
  }
  globalState.isProjectsModalVisible = false;
  globalState.projectsSelectedIndex = 0;
  globalState.projectsFilteredList = [];
};

const getProjectForOpen = async (projectId: string) => {
  const project = await getProjectById(projectId);
  if (!project) {
    showError('Project not found');

    return null;
  }

  if (project.panesOrder.length === 0) {
    showError('Project has no saved panes');

    return null;
  }

  return project;
};

const closePanesExceptFirst = async (currentPanes: Element[]) => {
  if (currentPanes.length <= 1) return;

  for (let i = currentPanes.length - 1; i > 0; i--) {
    await closePaneByIndexAsync(i);
    await waitForDomChanges(undefined, 0.05);
  }
};

const openProjectPanes = async (paneIds: string[]) => {
  let openedCount = 0;
  for (const savedPaneId of paneIds) {
    try {
      const resolvedPaneId = await resolveProjectPaneTarget(savedPaneId);
      if (!resolvedPaneId) {
        debugWarn('[PanesMode][Projects] Skipping empty saved pane reference', { savedPaneId });
        continue;
      }

      if (logseq?.Editor?.openInRightSidebar) {
        await logseq.Editor.openInRightSidebar(resolvedPaneId);
        openedCount++;
        await waitForDomChanges(undefined, 0.1);
      }
    } catch (err) {
      debugWarn(`[PanesMode][Projects] Failed to open pane ${savedPaneId}:`, err);
    }
  }

  return openedCount;
};

const applyProjectPaneLayout = (project: ProjectListItem['data'], container: HTMLElement) => {
  const newPanes = getCurrentSidebarPanes();
  const idToPaneMap = getPaneIdToElementMap(newPanes);

  // Stop any existing sync interval so it doesn't revert our reorder
  stopPaneOrderSync();

  // Mark as expected so the mutation observer won't fight the reorder
  globalState.expectedMutations.push(EXPECTED_MUTATIONS.newSidebarItemsReordering);

  project.panesOrder.forEach(pageId => {
    const pane = idToPaneMap.get(pageId);
    if (pane) {
      container.appendChild(pane);
    }
  });

  // Refresh cache and storage immediately so the observer treats this order as canonical
  const reorderedPanes = getCurrentSidebarPanes();
  refreshPanesElementsCache(reorderedPanes);
  updatePanesOrderInStorage(reorderedPanes);

  idToPaneMap.forEach((pane, pageId) => {
    const paneElement = pane as HTMLElement;

    const dims = project.paneDimensions[pageId];
    if (dims) {
      paneElement.style.width = `${dims.width}px`;
      paneElement.style.height = typeof dims.height === 'number' ? `${dims.height}px` : 'auto';
    }

    const fitContent = project.paneFitContentHeight[pageId];
    if (fitContent) {
      paneElement.dataset.panesModeFitContent = 'true';
      paneElement.classList.add('panesMode-fit-content');
      paneElement.style.height = 'auto';
    }

    const orientation = project.paneCollapseOrientation[pageId];
    if (orientation) {
      paneElement.classList.remove(
        'panesMode-collapse-vertical',
        'panesMode-collapse-horizontal'
      );
      paneElement.classList.add(`panesMode-collapse-${orientation}`);
    }
  });
};

const removeKeeperPaneIfNeeded = async (keeperPaneId: string | null, panesOrder: string[]) => {
  if (!keeperPaneId || panesOrder.includes(keeperPaneId)) return;

  const updatedPanes = getCurrentSidebarPanes();
  const keeperIndex = updatedPanes.findIndex(p => getPaneIdFromPane(p) === keeperPaneId);
  if (keeperIndex !== -1) {
    await closePaneByIndexAsync(keeperIndex);
  }
};

const finalizeProjectOpen = (project: ProjectListItem['data']) => {
  const finalPanes = getCurrentSidebarPanes();
  refreshPanesElementsCache(finalPanes);
  if (finalPanes.length > 0) {
    setActivePaneByIndex(0, finalPanes);
  }
  updateTabs(finalPanes);

  showSuccess(`Project "${project.name}" loaded`);
};

const attachSearchInputListeners = (modal: HTMLElement) => {
  const searchInput = modal.querySelector(`.${PROJECTS_CLASSES.search}`) as HTMLInputElement;
  if (searchInput) {
    searchInput.tabIndex = -1;
  }

  searchInput.addEventListener('input', e => {
    const query = (e.target as HTMLInputElement).value;
    debouncedUpdateList(query);
    updateAddButtonVisibility(query);
  });

  searchInput.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      const query = searchInput.value.trim();
      const addButton = modal.querySelector(`.${PROJECTS_CLASSES.addButton}`) as HTMLElement;
      const isAddButtonVisible = addButton && addButton.style.display !== 'none';

      if (isAddButtonVisible && query) {
        void handleCreateProject(query);
      } else if (globalState.projectsFilteredList.length > 0) {
        const selectedProject = globalState.projectsFilteredList[globalState.projectsSelectedIndex];
        if (selectedProject) {
          void openProject(selectedProject.id);
        }
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      hideProjectsModal();
    }
  });
};

const attachModalKeyHandlers = (modal: HTMLElement) => {
  const container = modal.querySelector(`.${PROJECTS_CLASSES.container}`) as HTMLElement;
  container.addEventListener('keydown', (e: KeyboardEvent) => {
    const isMod = isPrimaryShortcutModifierPressed(e);
    if (
      ['ArrowUp', 'ArrowDown', 'Enter', 'Escape'].includes(e.key) ||
      (isMod && (e.key === 'j' || e.key === 'k'))
    ) {
      e.stopPropagation();
    }
  });
};

const attachModalClickHandlers = (modal: HTMLElement) => {
  const container = modal.querySelector(`.${PROJECTS_CLASSES.container}`) as HTMLElement;
  modal.addEventListener('click', e => {
    if ((e.target as HTMLElement).classList.contains(PROJECTS_CLASSES.modal)) {
      hideProjectsModal();
    }
  });

  container.addEventListener('click', e => e.stopPropagation());
};

const attachAddButtonHandler = (modal: HTMLElement) => {
  const addButton = modal.querySelector(`.${PROJECTS_CLASSES.addButton}`) as HTMLElement;
  const searchInput = modal.querySelector(`.${PROJECTS_CLASSES.search}`) as HTMLInputElement;
  addButton.addEventListener('click', () => {
    const query = searchInput.value.trim();
    if (query) {
      void handleCreateProject(query);
    }
  });
};

const createProjectsModalElement = () => {
  const modalElement = parent.document.createElement('div');
  modalElement.innerHTML = createProjectsModalHTML();
  const modal = modalElement.firstElementChild as HTMLElement;

  const rightSidebarContainer = getRightSidebarContainer();
  if (rightSidebarContainer) {
    rightSidebarContainer.appendChild(modal);
  } else {
    parent.document.body.appendChild(modal);
  }

  return modal;
};

const ensureModalInRightSidebar = (modal: HTMLElement) => {
  const rightSidebarContainer = getRightSidebarContainer();
  if (rightSidebarContainer && !rightSidebarContainer.contains(modal)) {
    rightSidebarContainer.appendChild(modal);
  }
};

const setModalVisibleState = (modal: HTMLElement) => {
  modal.classList.add('visible');
  modal.setAttribute('aria-hidden', 'false');
  globalState.isProjectsModalVisible = true;

  void updateProjectsListImmediate('');
  globalState.projectsSelectedIndex = 0;
  updateProjectsSelection();
  ensureProjectsFocus(modal);
};

const attachShowKeyHandlers = (modal: HTMLElement) => {
  modalKeydownHandler = (e: KeyboardEvent) => {
    const isArrowUp = e.key === 'ArrowUp';
    const isArrowDown = e.key === 'ArrowDown';
    const isMod = isPrimaryShortcutModifierPressed(e);
    const isMetaK = isMod && e.key === 'k';
    const isMetaJ = isMod && e.key === 'j';
    const isEscape = e.key === 'Escape';

    if (isEscape) {
      e.preventDefault();
      e.stopPropagation();
      hideProjectsModal();

      return;
    }

    if (isArrowUp || isArrowDown || isMetaK || isMetaJ) {
      e.preventDefault();
      e.stopPropagation();
      if ((isArrowUp || isMetaK) && globalState.projectsSelectedIndex > 0) {
        globalState.projectsSelectedIndex--;
        updateProjectsSelection();
      } else if (
        (isArrowDown || isMetaJ) &&
        globalState.projectsSelectedIndex < globalState.projectsFilteredList.length - 1
      ) {
        globalState.projectsSelectedIndex++;
        updateProjectsSelection();
      }
    }
  };

  modal.addEventListener('keydown', modalKeydownHandler, true);

  escapeKeydownHandler = (e: KeyboardEvent) => {
    const activeModal = getParentElementById<HTMLElement>(PLUGIN_UI_SELECTORS.projectsModalId);
    if (!activeModal || !activeModal.classList.contains('visible')) return;
    if (e.key !== 'Escape') return;
    e.preventDefault();
    e.stopPropagation();
    hideProjectsModal();
  };
  parent.document.addEventListener('keydown', escapeKeydownHandler, true);
};

const scheduleModalFocusReset = () => {
  void waitForDomChanges(() => {
    const activeModal = getParentElementById<HTMLElement>(PLUGIN_UI_SELECTORS.projectsModalId);
    if (!activeModal || !activeModal.classList.contains('visible')) return;
    const searchInput = activeModal.querySelector(
      `.${PROJECTS_CLASSES.search}`
    ) as HTMLInputElement | null;
    if (!searchInput) return;
    searchInput.value = '';
    searchInput.tabIndex = 0;
    updateAddButtonVisibility('');
    ensureProjectsFocus(activeModal);
  }, 0);
};

const focusProjectsInput = (modal: HTMLElement): void => {
  const searchInput = modal.querySelector(`.${PROJECTS_CLASSES.search}`) as HTMLInputElement;
  if (!searchInput) return;
  searchInput.tabIndex = 0;
  searchInput.focus();
  const valueLength = searchInput.value.length;
  searchInput.setSelectionRange(valueLength, valueLength);
};

const ensureProjectsFocus = (modal: HTMLElement, attempts = 3): void => {
  const searchInput = modal.querySelector(`.${PROJECTS_CLASSES.search}`) as HTMLInputElement;
  if (!searchInput) return;
  focusProjectsInput(modal);
  if (parent.document.activeElement === searchInput) return;
  if (attempts <= 0) return;
  void waitForDomChanges(() => ensureProjectsFocus(modal, attempts - 1), 0.05);
};

const closePaneByIndexAsync = (paneIndex: number): Promise<void> => {
  return new Promise(resolve => {
    const panes = getCurrentSidebarPanes();
    const pane = panes[paneIndex];
    if (!pane) {
      resolve();

      return;
    }
    const closeButton = pane.querySelector('[title="Close"]') as HTMLElement | null;
    if (!closeButton) {
      resolve();

      return;
    }
    globalState.expectedMutations.push(EXPECTED_MUTATIONS.paneClosing);
    closeButton.click();
    void waitForDomChanges(() => resolve(), 0.1);
  });
};

const getPaneIdToElementMap = (panes: Element[]): Map<string, Element> => {
  const map = new Map<string, Element>();
  panes.forEach(pane => {
    const pageId = getPaneIdFromPane(pane);
    if (pageId) {
      map.set(pageId, pane);
    }
  });

  return map;
};

const handleCreateProject = async (name: string): Promise<void> => {
  if (!name.trim()) return;

  const projectId = await saveProject(name.trim());
  if (!projectId) {
    showError('Cannot save empty project (no panes open)');

    return;
  }

  showSuccess(`Project "${name}" saved`);

  const modal = getParentElementById<HTMLElement>(PLUGIN_UI_SELECTORS.projectsModalId);
  if (modal) {
    const searchInput = modal.querySelector(`.${PROJECTS_CLASSES.search}`) as HTMLInputElement;
    if (searchInput) {
      searchInput.value = '';
    }
    await updateProjectsListImmediate('');
    updateAddButtonVisibility('');
  }
};

const handleDeleteProject = async (projectId: string): Promise<void> => {
  await deleteProject(projectId);

  const modal = getParentElementById<HTMLElement>(PLUGIN_UI_SELECTORS.projectsModalId);
  if (modal) {
    const searchInput = modal.querySelector(`.${PROJECTS_CLASSES.search}`) as HTMLInputElement;
    const query = searchInput?.value.toLowerCase() ?? '';
    await updateProjectsListImmediate(query);
  }

  showSuccess('Project deleted');
};

const updateAddButtonVisibility = (query: string): void => {
  const modal = getParentElementById<HTMLElement>(PLUGIN_UI_SELECTORS.projectsModalId);
  if (!modal) return;

  const addButton = modal.querySelector(`.${PROJECTS_CLASSES.addButton}`) as HTMLElement;
  const projectNameSpan = addButton?.querySelector('.project-name') as HTMLElement;

  if (!addButton) return;

  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    addButton.style.display = 'none';

    return;
  }

  const hasExactMatch = globalState.projectsFilteredList.some(
    item => item.data.name.toLowerCase() === trimmedQuery.toLowerCase()
  );

  if (hasExactMatch) {
    addButton.style.display = 'none';
  } else {
    addButton.style.display = '';
    if (projectNameSpan) {
      projectNameSpan.textContent = trimmedQuery;
    }
  }
};

const formatDate = (timestamp: number): string => {
  const date = new Date(timestamp);

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const updateProjectsListImmediate = async (query: string): Promise<void> => {
  const modal = getParentElementById<HTMLElement>(PLUGIN_UI_SELECTORS.projectsModalId);
  if (!modal) return;

  const listContainer = modal.querySelector(`.${PROJECTS_CLASSES.list}`) as HTMLElement;
  const searchInput = modal.querySelector(`.${PROJECTS_CLASSES.search}`) as HTMLInputElement;
  const wasFocused = parent.document.activeElement === searchInput;
  const selectionStart = searchInput?.selectionStart ?? 0;
  const selectionEnd = searchInput?.selectionEnd ?? 0;

  listContainer.innerHTML = '';

  const allProjects = await getAllProjectsList();
  const queryLower = query.toLowerCase();

  globalState.projectsFilteredList = allProjects.filter(item =>
    item.data.name.toLowerCase().includes(queryLower)
  );

  globalState.projectsFilteredList.sort((a, b) => {
    const nameA = a.data.name.toLowerCase();
    const nameB = b.data.name.toLowerCase();

    const getRelevanceScore = (name: string): number => {
      if (name === queryLower) return 3;
      if (name.startsWith(queryLower)) return 2;
      if (name.includes(queryLower)) return 1;

      return 0;
    };

    const scoreA = getRelevanceScore(nameA);
    const scoreB = getRelevanceScore(nameB);

    if (scoreA !== scoreB) return scoreB - scoreA;

    return (b.data.updatedAt ?? 0) - (a.data.updatedAt ?? 0);
  });

  globalState.projectsFilteredList.forEach((item, index) => {
    const projectItem = parent.document.createElement('div');
    projectItem.className = PROJECTS_CLASSES.item;
    projectItem.dataset.projectId = item.id;
    projectItem.dataset.projectIndex = index.toString();

    const nameSpan = parent.document.createElement('span');
    nameSpan.className = PROJECTS_CLASSES.itemName;
    nameSpan.textContent = item.data.name;

    const metaSpan = parent.document.createElement('span');
    metaSpan.className = PROJECTS_CLASSES.itemMeta;
    metaSpan.textContent = `${item.data.panesOrder.length} panes`;

    const deleteBtn = parent.document.createElement('button');
    deleteBtn.className = PROJECTS_CLASSES.itemDelete;
    deleteBtn.innerHTML = PROJECT_DELETE_ICON;
    deleteBtn.title = 'Delete project';
    deleteBtn.setAttribute('aria-label', 'Delete project');
    deleteBtn.addEventListener('click', e => {
      e.stopPropagation();
      void handleDeleteProject(item.id);
    });

    projectItem.appendChild(nameSpan);
    projectItem.appendChild(metaSpan);
    projectItem.appendChild(deleteBtn);
    projectItem.addEventListener('click', () => {
      void openProject(item.id);
    });

    listContainer.appendChild(projectItem);
  });

  if (globalState.projectsFilteredList.length === 0) {
    const noResults = parent.document.createElement('div');
    noResults.className = `${PROJECTS_CLASSES.item} ${PROJECTS_CLASSES.noResults}`;
    noResults.textContent =
      query.length > 0 ? `No projects matching "${query}"` : 'No projects saved yet';
    listContainer.appendChild(noResults);
  }

  globalState.projectsSelectedIndex = Math.min(
    globalState.projectsSelectedIndex,
    Math.max(0, globalState.projectsFilteredList.length - 1)
  );

  updateProjectsSelection();

  if (searchInput) {
    if (wasFocused || modal.classList.contains('visible')) {
      searchInput.focus();
      searchInput.setSelectionRange(selectionStart, selectionEnd);
    }
  }
};
