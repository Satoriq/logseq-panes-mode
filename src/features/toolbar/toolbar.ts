import { toolbarIcons } from './icons';

const TOOLBAR_ICON_SIZE_PX = 22;

export const registerToolbarUIItems = (): void => {
  const registerUIItem = (interfacePlace: 'toolbar', key: string, template: string) =>
    logseq.App.registerUIItem(interfacePlace, {
      key,
      template,
    });

  registerUIItem('toolbar', 'PanesMode_mode_on_off', toolbarButtons.togglePanesMode);
  registerUIItem('toolbar', 'Hide_left_sidebar', toolbarButtons.hideLeft);
  registerUIItem('toolbar', 'Show_left_sidebar', toolbarButtons.showLeft);
  registerUIItem('toolbar', 'Close_unused_panes', toolbarButtons.cleanUnused);
  registerUIItem('toolbar', 'Close_panes_to_the_right', toolbarButtons.cleanRight);
  registerUIItem('toolbar', 'Close_panes_to_the_left', toolbarButtons.cleanLeft);
  registerUIItem('toolbar', 'Reset_PanesMode_settings', toolbarButtons.resetSettings);
  registerUIItem('toolbar', 'Sync_panes_order', toolbarButtons.syncOrder);
};

const buildToolbarButtonTemplate = (action: string, iconMarkup: string, label: string): string => {

  return `
      <a
        class="actionButton"
        data-on-click="${action}"
        title="${label}"
        aria-label="${label}"
        style="
          cursor: pointer !important;
        "
      >
        <span class="actionButton-icon" aria-hidden="true">${iconMarkup}</span>
      </a>
    `;
};

const toolbarButtons = {
  togglePanesMode: buildToolbarButtonTemplate(
    'togglePanesModeMode',
    toolbarIcons.logo(TOOLBAR_ICON_SIZE_PX),
    'Toggle PanesMode'
  ),
  hideLeft: buildToolbarButtonTemplate(
    'hideLeftSide',
    toolbarIcons.hideLeft(TOOLBAR_ICON_SIZE_PX),
    'Hide left sidebar'
  ),
  showLeft: buildToolbarButtonTemplate(
    'showLeftSide',
    toolbarIcons.showLeft(TOOLBAR_ICON_SIZE_PX),
    'Show left sidebar'
  ),
  cleanUnused: buildToolbarButtonTemplate(
    'cleanUnusedPanes',
    toolbarIcons.cleanUnused(TOOLBAR_ICON_SIZE_PX),
    'Clean unused panes'
  ),
  cleanRight: buildToolbarButtonTemplate(
    'cleanRightPanes',
    toolbarIcons.cleanRight(TOOLBAR_ICON_SIZE_PX),
    'Clean right panes'
  ),
  cleanLeft: buildToolbarButtonTemplate(
    'cleanLeftPanes',
    toolbarIcons.cleanLeft(TOOLBAR_ICON_SIZE_PX),
    'Clean left panes'
  ),
  resetSettings: buildToolbarButtonTemplate(
    'resetPanesModeSettings',
    toolbarIcons.reset(TOOLBAR_ICON_SIZE_PX),
    'Reset PanesMode settings'
  ),
  syncOrder: buildToolbarButtonTemplate(
    'syncPanesOrder',
    toolbarIcons.syncOrder(TOOLBAR_ICON_SIZE_PX),
    'Sync panes order'
  ),
};
