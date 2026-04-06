import layoutStyles from '../features/layout/layout.scss';
import tabsStyles from '../features/tabs/tabs.scss';
import paneSwitcherStyles from '../features/panes/paneSwitcher/paneSwitcher.scss';
import projectsStyles from '../features/projects/projects.scss';
import toolbarStyles from '../features/toolbar/toolbar.scss';

export const panesModeBaseStyles = [
  tabsStyles,
  paneSwitcherStyles,
  projectsStyles,
  toolbarStyles,
].join('\n');
export const panesModeStyles = [
  layoutStyles,
  tabsStyles,
  paneSwitcherStyles,
  projectsStyles,
  toolbarStyles,
].join('\n');
