import { PLUGIN_UI_SELECTORS } from '../../../core/constants';

export const PANE_SWITCHER_CLASSES = {
  modal: 'panesMode-pane-switcher-modal',
  container: 'panesMode-pane-switcher-container',
  search: 'panesMode-pane-switcher-search',
  listWrapper: 'panesMode-pane-switcher-list-wrapper',
  list: 'panesMode-pane-switcher-list',
  item: 'panesMode-pane-switcher-item',
  noResults: 'no-results',
  hasResults: 'has-results',
} as const;

export const createPaneSwitcherModalHTML = (): string => `
  <div id="${PLUGIN_UI_SELECTORS.paneSwitcherModalId}" class="${PANE_SWITCHER_CLASSES.modal}">
    <div class="${PANE_SWITCHER_CLASSES.container}">
      <input type="text" class="${PANE_SWITCHER_CLASSES.search}" placeholder="Search panes..." autofocus>
      <div class="${PANE_SWITCHER_CLASSES.listWrapper}">
        <div class="${PANE_SWITCHER_CLASSES.list}"></div>
      </div>
    </div>
  </div>
`;
