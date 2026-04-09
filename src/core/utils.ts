import { getPluginSettings } from './pluginSettings';

const isMacPlatform = /Mac/.test(navigator.platform);

export function debounce<T extends (...args: any[]) => void>(func: T, delay: number) {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
}

export type WaitForDomChangesResult = Promise<void> & {
  timeoutId: ReturnType<typeof setTimeout>;
};

// TODO: Write particular DOM changes detector for each place
export const waitForDomChanges = (
  callback?: () => void,
  seconds = 0.1,
  useDomWaitCoefficient = true
): WaitForDomChangesResult => {
  const domWaitCoefficient = useDomWaitCoefficient
    ? getPluginSettings().domWaitCoefficient || 1
    : 1;
  const effectiveDelayMs = seconds * domWaitCoefficient * 1000;
  let resolvePromise!: () => void;
  const result = new Promise<void>(resolve => {
    resolvePromise = resolve;
  }) as WaitForDomChangesResult;

  result.timeoutId = setTimeout(() => {
    try {
      callback?.();
    } finally {
      resolvePromise();
    }
  }, effectiveDelayMs);

  return result;
};

export const exitIfEditing = async () => {
  const isEditingMode = await logseq.Editor.checkEditing();
  if (isEditingMode) {
    await logseq.Editor.exitEditingMode();
  }
};

export const isPrimaryShortcutModifierPressed = (e: KeyboardEvent): boolean =>
  isMacPlatform ? e.metaKey : e.ctrlKey;

export const showError = (message: string) => {
  logseq.UI.showMsg(`[PanesMode] ${message}`, 'error');
};

export const showSuccess = (message: string) => {
  logseq.UI.showMsg(`[PanesMode] ${message}`, 'success');
};
