import type { SettingSchemaDesc } from '@logseq/libs/dist/LSPlugin.user';
import { APP_SETTINGS_CONFIG } from './constants';
import { globalState } from './pluginGlobalState';

export type PluginSettings = {
  domWaitCoefficient: number;
  movePaneLeftShortcut: string;
  movePaneRightShortcut: string;
  maxTabs: number;
  autoCloseOldestTab: boolean;
  isVerticalTabs: boolean;
  smoothScrollEnabled: boolean;
  stickyPaneHeaders: boolean;
  tabWidthPx: number;
  tabHeightPx: number;
  tabTextSizePx: number;
  headerTextSizePx: number;
  paneInitialWidthPx: number;
  panesGapPx: number;
  verticalTabsBackground: string;
  sidebarListBackground: string;
  sidebarListBackgroundDark: string;
  resizerWidthPx: number;
  resizerColor: string;
  activePaneOutlineWidthPx: number;
  activePaneOutlineColor: string;
  activePaneOutlineColorDark: string;
  paneBorderColor: string;
  paneBorderColorDark: string;
  tabPaddingCoefficient: number;
  moreButtonProximityPx: number;
  themeLightTabBackground: string;
  themeLightTabBackgroundHorizontal: string;
  themeLightTabActiveBackground: string;
  themeLightTabText: string;
  themeDarkTabBackground: string;
  themeDarkTabActiveBackground: string;
  themeDarkTabText: string;
};

const defaultSettings: PluginSettings = {
  domWaitCoefficient: 1,
  movePaneLeftShortcut: 'mod+shift+h',
  movePaneRightShortcut: 'mod+shift+l',
  maxTabs: APP_SETTINGS_CONFIG.defaultMaxTabs,
  autoCloseOldestTab: false,
  isVerticalTabs: APP_SETTINGS_CONFIG.isVerticalTabs,
  smoothScrollEnabled: true,
  stickyPaneHeaders: true,
  tabWidthPx: 160,
  tabHeightPx: 30,
  tabTextSizePx: 12,
  headerTextSizePx: 14,
  paneInitialWidthPx: 1000,
  panesGapPx: 10,
  verticalTabsBackground: 'var(--ls-secondary-background-color, #f5f5f5)',
  sidebarListBackground: 'var(--ls-secondary-background-color, #f8f8f8)',
  sidebarListBackgroundDark: '#023a47',
  resizerWidthPx: 1,
  resizerColor: 'rgba(0,0,0,0.2)',
  activePaneOutlineWidthPx: 2,
  activePaneOutlineColor: '#afafaf',
  activePaneOutlineColorDark: '#597a7b',
  paneBorderColor: 'transparent',
  paneBorderColorDark: 'transparent',
  tabPaddingCoefficient: APP_SETTINGS_CONFIG.activeTabOverflowCoefficient,
  moreButtonProximityPx: APP_SETTINGS_CONFIG.moreButtonActivationProximityPx,
  themeLightTabBackground: '#e5e5e5',
  themeLightTabBackgroundHorizontal: '#e5e5e5',
  themeLightTabActiveBackground: '#c9c9c9',
  themeLightTabText: '#1f2937',
  themeDarkTabBackground: '#0d4b5d',
  themeDarkTabActiveBackground: '#06313c',
  themeDarkTabText: '#e5e7eb',
};

const settingsSchema: SettingSchemaDesc[] = [
  {
    key: 'domWaitCoefficient',
    title: 'Dom wait coeficient',
    description:
      'Multiplier for internal DOM changes wait delays. If you have slow pc, and you see broken plugin behaviour, try increasing this value by 0.5 step. Range: 1 to 5',
    type: 'number',
    default: defaultSettings.domWaitCoefficient,
  },
  {
    key: 'movePaneLeftShortcut',
    title: 'Move pane left shortcut',
    description: 'Shortcut for moving the active pane left in order. Applied on next reload.',
    type: 'string',
    default: defaultSettings.movePaneLeftShortcut,
  },
  {
    key: 'movePaneRightShortcut',
    title: 'Move pane right shortcut',
    description: 'Shortcut for moving the active pane right in order. Applied on next reload.',
    type: 'string',
    default: defaultSettings.movePaneRightShortcut,
  },
  {
    key: 'maxTabs',
    title: 'Max tabs limit',
    description:
      'Maximum number of panes to keep open at once, works with auto-close and close left/right actions.',
    type: 'number',
    default: defaultSettings.maxTabs,
  },
  {
    key: 'autoCloseOldestTab',
    title: 'Automode for max tabs limit',
    description:
      'Automatically close the oldest (the one that wasnt "active/selected" for longest time) pane when opening a new pane beyond the max tab limit. Its quite anoying, its better to use manual action cleaning buttons, clean left, clean right and clean unused.',
    type: 'boolean',
    default: defaultSettings.autoCloseOldestTab,
  },
  {
    key: 'isVerticalTabs',
    title: 'Use vertical tabs',
    description: 'If enabled, render tabs vertically instead of horizontally.',
    type: 'boolean',
    default: defaultSettings.isVerticalTabs,
  },
  {
    key: 'smoothScrollEnabled',
    title: 'Use custom smooth scroll',
    description:
      'Enable PanesMode smooth scrolling. Disable to use the browser native scroll behavior (works better for potato PC).',
    type: 'boolean',
    default: defaultSettings.smoothScrollEnabled,
  },
  {
    key: 'stickyPaneHeaders',
    title: 'Sticky headers for panes',
    description: 'Keep pane headers visible at the top while scrolling.',
    type: 'boolean',
    default: defaultSettings.stickyPaneHeaders,
  },
  {
    key: 'tabWidthPx',
    title: 'Tab width (px)',
    description: 'Minimum width of each tab in pixels.',
    type: 'number',
    default: defaultSettings.tabWidthPx,
  },
  {
    key: 'tabHeightPx',
    title: 'Tab height (px)',
    description: 'Height of each tab in pixels.',
    type: 'number',
    default: defaultSettings.tabHeightPx,
  },
  {
    key: 'paneInitialWidthPx',
    title: 'Pane initial width (px)',
    description: 'Default width applied when panes render in the right sidebar.',
    type: 'number',
    default: defaultSettings.paneInitialWidthPx,
  },
  {
    key: 'panesGapPx',
    title: 'Gap between panes (px)',
    description: 'Space between panes in the right sidebar.',
    type: 'number',
    default: defaultSettings.panesGapPx,
  },
  {
    key: 'paneBorderColor',
    title: 'Pane border color',
    description: 'Border color for panes (light mode). Use "transparent" to remove the border.',
    type: 'string',
    default: defaultSettings.paneBorderColor,
  },
  {
    key: 'paneBorderColorDark',
    title: 'Pane border color (dark)',
    description: 'Border color for panes (dark mode). Use "transparent" to remove the border.',
    type: 'string',
    default: defaultSettings.paneBorderColorDark,
  },
  {
    key: 'verticalTabsBackground',
    title: 'Vertical tabs empty space background',
    description: 'Background color for empty space in the vertical tabs area.',
    type: 'string',
    default: defaultSettings.verticalTabsBackground,
    inputAs: 'color',
  },
  {
    key: 'sidebarListBackground',
    title: 'Right side background',
    description: 'Background color behind the panes on right side (light mode).',
    type: 'string',
    default: defaultSettings.sidebarListBackground,
    inputAs: 'color',
  },
  {
    key: 'sidebarListBackgroundDark',
    title: 'Right side background (dark)',
    description: 'Background color behind the panes on right side (dark mode).',
    type: 'string',
    default: defaultSettings.sidebarListBackgroundDark,
    inputAs: 'color',
  },
  {
    key: 'activePaneOutlineWidthPx',
    title: 'Active pane outline width (px)',
    description: 'Outline width applied to the active pane.',
    type: 'number',
    default: defaultSettings.activePaneOutlineWidthPx,
  },
  {
    key: 'activePaneOutlineColor',
    title: 'Active pane outline color',
    description: 'Outline color applied to the active pane (light mode).',
    type: 'string',
    default: defaultSettings.activePaneOutlineColor,
    inputAs: 'color',
  },
  {
    key: 'activePaneOutlineColorDark',
    title: 'Active pane outline color (dark)',
    description: 'Outline color applied to the active pane (dark mode).',
    type: 'string',
    default: defaultSettings.activePaneOutlineColorDark,
    inputAs: 'color',
  },
  {
    key: 'resizerWidthPx',
    title: 'Right side resizer / sides splitter width (px)',
    description: 'Width of the pane resizer handle.',
    type: 'number',
    default: defaultSettings.resizerWidthPx,
  },
  {
    key: 'resizerColor',
    title: 'Right side resizer / sides splitter color',
    description: 'Color of the pane resizer handle.',
    type: 'string',
    default: defaultSettings.resizerColor,
    inputAs: 'color',
  },
  {
    key: 'tabTextSizePx',
    title: 'Tab text size (px)',
    description: 'Font size for tab labels in pixels.',
    type: 'number',
    default: defaultSettings.tabTextSizePx,
  },
  {
    key: 'headerTextSizePx',
    title: 'Pane header text size (px)',
    description: 'Font size for pane headers in pixels.',
    type: 'number',
    default: defaultSettings.headerTextSizePx,
  },
  {
    key: 'tabPaddingCoefficient',
    title: 'Tab padding coefficient',
    description: 'Padding used when centering the active tab.',
    type: 'number',
    default: defaultSettings.tabPaddingCoefficient,
  },
  {
    key: 'moreButtonProximityPx',
    title: '"More" button trigger distance (px)',
    description: 'Distance from pane bottom that triggers auto-click of the More button.',
    type: 'number',
    default: defaultSettings.moreButtonProximityPx,
  },
  {
    key: 'themeLightTabBackground',
    title: 'Light mode tab background',
    description: 'Background color for tabs in light mode.',
    type: 'string',
    default: defaultSettings.themeLightTabBackground,
    inputAs: 'color',
  },
  {
    key: 'themeLightTabBackgroundHorizontal',
    title: 'Light mode horizontal tab background',
    description: 'Background color for tabs in light mode when tabs are horizontal.',
    type: 'string',
    default: defaultSettings.themeLightTabBackgroundHorizontal,
    inputAs: 'color',
  },
  {
    key: 'themeLightTabActiveBackground',
    title: 'Light mode active tab background',
    description: 'Background color for the active tab in light mode.',
    type: 'string',
    default: defaultSettings.themeLightTabActiveBackground,
    inputAs: 'color',
  },
  {
    key: 'themeLightTabText',
    title: 'Light mode tab text color',
    description: 'Text color for tabs in light mode.',
    type: 'string',
    default: defaultSettings.themeLightTabText,
    inputAs: 'color',
  },
  {
    key: 'themeDarkTabBackground',
    title: 'Dark mode tab background',
    description: 'Background color for tabs in dark mode.',
    type: 'string',
    default: defaultSettings.themeDarkTabBackground,
    inputAs: 'color',
  },
  {
    key: 'themeDarkTabActiveBackground',
    title: 'Dark mode active tab background',
    description: 'Background color for the active tab in dark mode.',
    type: 'string',
    default: defaultSettings.themeDarkTabActiveBackground,
    inputAs: 'color',
  },
  {
    key: 'themeDarkTabText',
    title: 'Dark mode tab text color',
    description: 'Text color for tabs in dark mode.',
    type: 'string',
    default: defaultSettings.themeDarkTabText,
    inputAs: 'color',
  },
  {
    key: 'resetSettingsNote',
    title: '',
    description:
      'If you want to reset settings use "Reset panesMode settings" command Ctrl + P or actions button on top of left side.',
    type: 'heading',
    default: null,
  },
];

let currentSettings: PluginSettings = defaultSettings;

const settingsListeners: Array<(settings: PluginSettings, previous: PluginSettings) => void> = [];

const clampDomWaitCoefficient = (value: unknown): number => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return defaultSettings.domWaitCoefficient;

  return Math.round(Math.min(9.9, Math.max(1, numericValue)) * 10) / 10;
};

const applySettingsToRuntime = (settings: PluginSettings, previous?: PluginSettings) => {
  currentSettings = settings;
  globalState.maxTabs = settings.maxTabs;
  APP_SETTINGS_CONFIG.isVerticalTabs = settings.isVerticalTabs;
  APP_SETTINGS_CONFIG.activeTabOverflowCoefficient = settings.tabPaddingCoefficient;
  APP_SETTINGS_CONFIG.moreButtonActivationProximityPx = settings.moreButtonProximityPx;

  settingsListeners.forEach(listener => listener(settings, previous ?? settings));
};

const mergeSettings = (settings: Partial<PluginSettings> | null | undefined) => {
  const incoming = settings ?? {};

  return {
    ...defaultSettings,
    ...incoming,
    domWaitCoefficient: clampDomWaitCoefficient(incoming.domWaitCoefficient),
  };
};

export const getPluginSettings = (): PluginSettings => currentSettings;

export const onSettingsUpdated = (
  listener: (settings: PluginSettings, previous: PluginSettings) => void
): void => {
  settingsListeners.push(listener);
};

export const resetSettingsToDefaults = async (): Promise<PluginSettings> => {
  const mergedDefaults = mergeSettings(defaultSettings);

  applySettingsToRuntime(mergedDefaults, currentSettings);
  await logseq.updateSettings(mergedDefaults);

  return mergedDefaults;
};

export const initPluginSettings = async (): Promise<PluginSettings> => {
  logseq.useSettingsSchema(settingsSchema);

  const merged = mergeSettings(logseq.settings as Partial<PluginSettings>);
  applySettingsToRuntime(merged);

  logseq.onSettingsChanged((newSettings, oldSettings) => {
    const previous = currentSettings;
    const mergedSettings = mergeSettings({
      ...previous,
      ...(newSettings as Partial<PluginSettings>),
    });
    applySettingsToRuntime(mergedSettings, previous);
  });

  return merged;
};
