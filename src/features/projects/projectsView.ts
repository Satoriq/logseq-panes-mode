import { PLUGIN_UI_SELECTORS } from '../../core/constants';
import { PROJECTS_CLASSES } from './consts';

export const createProjectsModalHTML = (): string => `
  <div id="${PLUGIN_UI_SELECTORS.projectsModalId}" class="${PROJECTS_CLASSES.modal}">
    <div class="${PROJECTS_CLASSES.container}">
      <input type="text" class="${PROJECTS_CLASSES.search}" placeholder="Search or create project..." autofocus>
      <div class="${PROJECTS_CLASSES.listWrapper}">
        <div class="${PROJECTS_CLASSES.list}"></div>
      </div>
      <button class="${PROJECTS_CLASSES.addButton}" style="display: none;">
        Add project "<span class="project-name"></span>"
      </button>
    </div>
  </div>
`;
