import { getPluginSettings } from './pluginSettings';

type DebugConsoleMethod = 'debug' | 'error' | 'groupCollapsed' | 'groupEnd' | 'info' | 'log' | 'warn';

export const debugConsole = (method: DebugConsoleMethod, ...args: unknown[]): void => {
  if (!getPluginSettings().enableDebugingConsoles) return;

  const consoleMethod = console[method] as (...params: unknown[]) => void;
  consoleMethod.apply(console, args);
};

export const debugLog = (...args: unknown[]): void => {
  debugConsole('log', ...args);
};

export const debugInfo = (...args: unknown[]): void => {
  debugConsole('info', ...args);
};

export const debugWarn = (...args: unknown[]): void => {
  debugConsole('warn', ...args);
};

export const debugError = (...args: unknown[]): void => {
  debugConsole('error', ...args);
};

export const debugGroupCollapsed = (...args: unknown[]): void => {
  debugConsole('groupCollapsed', ...args);
};

export const debugGroupEnd = (): void => {
  debugConsole('groupEnd');
};
