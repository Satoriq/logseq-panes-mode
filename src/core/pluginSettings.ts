import type { SettingSchemaDesc } from '@logseq/libs/dist/LSPlugin.user';
import { APP_SETTINGS_CONFIG } from './constants';
import { globalState } from './pluginGlobalState';

export type PluginSettings = {
  domWaitCoefficient: number;
  enableDebugingConsoles: boolean;
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
  themeDarkPaneSwitcherItemBackground: string;
  themeDarkPaneSwitcherItemBorderBottom: string;
  themeDarkPaneSwitcherSelectedBackground: string;
  themeDarkPaneSwitcherSelectedBorderLeft: string;
};

const defaultSettings: PluginSettings = {
  domWaitCoefficient: 1,
  enableDebugingConsoles: false,
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
  resizerWidthPx: 2,
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
  themeDarkPaneSwitcherItemBackground: '#023643',
  themeDarkPaneSwitcherItemBorderBottom: '#073642',
  themeDarkPaneSwitcherSelectedBackground: '#042e39',
  themeDarkPaneSwitcherSelectedBorderLeft: '#2aa198',
};

const settingsSchema: SettingSchemaDesc[] = [
  {
    key: 'resetSettingsNote',
    title: 'Reset',
    description:
      'Reset settings from the Command Palette with "Reset PanesMode settings", or use the reset button in the left sidebar actions.',
    type: 'heading',
    default: null,
  },
  {
    key: 'behaviorHeading',
    title: 'Behavior',
    description: 'Core PanesMode behavior and interaction settings.',
    type: 'heading',
    default: null,
  },
  {
    key: 'maxTabs',
    title: 'Max open panes (after cleaning)',
    description:
      'Maximum number of panes to keep open at once after cleaning. Used by auto-close and clean unused, left/right actions.',
    type: 'number',
    default: defaultSettings.maxTabs,
  },
  {
    key: 'autoCloseOldestTab',
    title: 'Auto-close oldest pane at limit',
    description:
      'When a new pane would exceed the max open panes limit, close the pane that has been inactive the longest. Its kinda annoying, so dont use if not necessary.',
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
    title: 'Use custom smooth scrolling',
    description:
      'Enable PanesMode smooth scrolling. Disable it to fall back to native browser scrolling. (Works better for potato PC)',
    type: 'boolean',
    default: defaultSettings.smoothScrollEnabled,
  },
  {
    key: 'stickyPaneHeaders',
    title: 'Keep pane headers sticky',
    description: 'Keep pane headers visible at the top while scrolling.',
    type: 'boolean',
    default: defaultSettings.stickyPaneHeaders,
  },
  {
    key: 'layoutHeading',
    title: 'Layout And Typography',
    description: 'Pane sizing, tab sizing, and text sizes.',
    type: 'heading',
    default: null,
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
    description: 'Spacing between panes in the right sidebar.',
    type: 'number',
    default: defaultSettings.panesGapPx,
  },
  {
    key: 'tabWidthPx',
    title: 'Tab width (px)',
    description: 'Minimum width for each tab.',
    type: 'number',
    default: defaultSettings.tabWidthPx,
  },
  {
    key: 'tabHeightPx',
    title: 'Tab height (px)',
    description: 'Height for each tab.',
    type: 'number',
    default: defaultSettings.tabHeightPx,
  },
  {
    key: 'tabTextSizePx',
    title: 'Tab text size (px)',
    description: 'Font size for tab labels.',
    type: 'number',
    default: defaultSettings.tabTextSizePx,
  },
  {
    key: 'headerTextSizePx',
    title: 'Pane header text size (px)',
    description: 'Font size for pane headers.',
    type: 'number',
    default: defaultSettings.headerTextSizePx,
  },
  {
    key: 'activePaneOutlineWidthPx',
    title: 'Active pane outline width (px)',
    description: 'Outline width applied to the active pane.',
    type: 'number',
    default: defaultSettings.activePaneOutlineWidthPx,
  },
  {
    key: 'sharedAppearanceHeading',
    title: 'Shared Appearance',
    description: 'Visual settings used in both light and dark modes.',
    type: 'heading',
    default: null,
  },
  {
    key: 'verticalTabsBackground',
    title: 'Vertical tabs empty space background',
    description: 'Background color for the empty area in the vertical tabs column.',
    type: 'string',
    default: defaultSettings.verticalTabsBackground,
    inputAs: 'color',
  },
  {
    key: 'resizerWidthPx',
    title: 'Pane resizer width (px)',
    description: 'Width of the pane resizer handle.',
    type: 'number',
    default: defaultSettings.resizerWidthPx,
  },
  {
    key: 'resizerColor',
    title: 'Pane resizer color',
    description: 'Color of the pane resizer handle.',
    type: 'string',
    default: defaultSettings.resizerColor,
    inputAs: 'color',
  },
  {
    key: 'lightModeHeading',
    title: 'Light Mode Colors',
    description: 'Colors used when Logseq is in light mode.',
    type: 'heading',
    default: null,
  },
  {
    key: 'themeLightTabBackground',
    title: 'Light mode vertical tab background',
    description: 'Background color for tabs when light mode and vertical tabs are used.',
    type: 'string',
    default: defaultSettings.themeLightTabBackground,
    inputAs: 'color',
  },
  {
    key: 'themeLightTabBackgroundHorizontal',
    title: 'Light mode horizontal tab background',
    description: 'Background color for tabs when light mode and horizontal tabs are used.',
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
    key: 'sidebarListBackground',
    title: 'Light mode right sidebar background',
    description: 'Background behind panes in the right sidebar in light mode.',
    type: 'string',
    default: defaultSettings.sidebarListBackground,
    inputAs: 'color',
  },
  {
    key: 'activePaneOutlineColor',
    title: 'Light mode active pane outline color',
    description: 'Outline color applied to the active pane in light mode.',
    type: 'string',
    default: defaultSettings.activePaneOutlineColor,
    inputAs: 'color',
  },
  {
    key: 'paneBorderColor',
    title: 'Light mode pane border color',
    description: 'Border color for panes in light mode. Use "transparent" to remove the border.',
    type: 'string',
    default: defaultSettings.paneBorderColor,
    inputAs: 'color',
  },
  {
    key: 'darkModeHeading',
    title: 'Dark Mode Colors',
    description: 'Colors used when Logseq is in dark mode.',
    type: 'heading',
    default: null,
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
    key: 'themeDarkPaneSwitcherItemBackground',
    title: 'Dark mode pane switcher item background',
    description:
      'Background color for pane switcher items in dark mode. Also applies to the pane switcher search background.',
    type: 'string',
    default: defaultSettings.themeDarkPaneSwitcherItemBackground,
    inputAs: 'color',
  },
  {
    key: 'themeDarkPaneSwitcherItemBorderBottom',
    title: 'Dark mode pane switcher item border color',
    description:
      'Bottom border color for pane switcher items in dark mode. Also applies to the pane switcher search bottom border.',
    type: 'string',
    default: defaultSettings.themeDarkPaneSwitcherItemBorderBottom,
    inputAs: 'color',
  },
  {
    key: 'themeDarkPaneSwitcherSelectedBackground',
    title: 'Dark mode selected pane switcher item background',
    description: 'Background color for the selected pane switcher item in dark mode.',
    type: 'string',
    default: defaultSettings.themeDarkPaneSwitcherSelectedBackground,
    inputAs: 'color',
  },
  {
    key: 'themeDarkPaneSwitcherSelectedBorderLeft',
    title: 'Dark mode selected pane switcher item left border',
    description: 'Left border color for the selected pane switcher item in dark mode.',
    type: 'string',
    default: defaultSettings.themeDarkPaneSwitcherSelectedBorderLeft,
    inputAs: 'color',
  },
  {
    key: 'sidebarListBackgroundDark',
    title: 'Dark mode right sidebar background',
    description: 'Background behind panes in the right sidebar in dark mode.',
    type: 'string',
    default: defaultSettings.sidebarListBackgroundDark,
    inputAs: 'color',
  },
  {
    key: 'activePaneOutlineColorDark',
    title: 'Dark mode active pane outline color',
    description: 'Outline color applied to the active pane in dark mode.',
    type: 'string',
    default: defaultSettings.activePaneOutlineColorDark,
    inputAs: 'color',
  },
  {
    key: 'paneBorderColorDark',
    title: 'Dark mode pane border color',
    description: 'Border color for panes in dark mode. Use "transparent" to remove the border.',
    type: 'string',
    default: defaultSettings.paneBorderColorDark,
    inputAs: 'color',
  },
  {
    key: 'advancedHeading',
    title: 'Advanced',
    description: 'Low-level behavior tuning.',
    type: 'heading',
    default: null,
  },
  {
    key: 'tabPaddingCoefficient',
    title: 'Active tab centering padding',
    description: 'Extra padding used when centering the active tab.',
    type: 'number',
    default: defaultSettings.tabPaddingCoefficient,
  },
  {
    key: 'moreButtonProximityPx',
    title: '"More" button trigger distance (px)',
    description: 'Distance from the pane bottom that triggers auto-click of the More button.',
    type: 'number',
    default: defaultSettings.moreButtonProximityPx,
  },
  {
    key: 'domWaitCoefficient',
    title: 'DOM wait coefficient',
    description:
      'Multiplier for internal DOM wait delays. Increase it in 0.5 steps if the plugin behaves inconsistently on slower machines.',
    type: 'number',
    default: defaultSettings.domWaitCoefficient,
  },
  {
    key: 'debugHeading',
    title: 'Debug',
    description: 'Optional troubleshooting output.',
    type: 'heading',
    default: null,
  },
  {
    key: 'enableDebugingConsoles',
    title: 'Enable debuging consoles',
    description: 'If enabled, PanesMode writes internal debug output to the browser console.',
    type: 'boolean',
    default: defaultSettings.enableDebugingConsoles,
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
