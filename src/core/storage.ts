// Agents generated
import { STORAGE_KEYS, LOCAL_STORAGE_SAVINGS_LIMITS } from './constants';
import { showError } from './utils';

export type PaneDimensions = { width: number; height?: number };
type PaneDimensionsRecord = Record<string, PaneDimensions>;
type CollapseOrientation = 'vertical' | 'horizontal';
type FitContentHeightRecord = Record<string, boolean>;

export const readPanesOrderFromStorage = (): string[] => readArrayStorage(STORAGE_KEYS.panesOrder);

export const writePanesOrderToStorage = (order: string[]): void => {
  persistArray(STORAGE_KEYS.panesOrder, order);
};

export const readLastActivePanesFromStorage = (): string[] =>
  readArrayStorage(STORAGE_KEYS.lastActivePanes);

export const writeLastActiveToStorage = (order: string[]): void => {
  persistArray(STORAGE_KEYS.lastActivePanes, order);
};

export const writeOriginalLeftSideWithoutBar = (width: number): void => {
  localStorage.setItem(STORAGE_KEYS.originalLeftSideWidth, JSON.stringify(width));
};

export const readOriginalLeftSideWithoutBar = (): number | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.originalLeftSideWidth);
    const parsed = raw ? JSON.parse(raw) : null;

    return parsed;
  } catch {

    return null;
  }
};

export const readPanesDimensionsFromStorage = (): PaneDimensionsRecord =>
  readRecordStorage<PaneDimensions>(STORAGE_KEYS.paneDimensions);

export const readPaneFitContentHeightFromStorage = (): FitContentHeightRecord =>
  readRecordStorage<boolean>(STORAGE_KEYS.paneFitContentHeight);

export const writePaneFitContentHeightToStorage = (pageId: string, enabled: boolean): void => {
  updateRecordStorage<boolean>(
    STORAGE_KEYS.paneFitContentHeight,
    record => {
      if (enabled) {
        record[pageId] = true;
      } else {
        delete record[pageId];
      }
    },
    'Failed to store fit-content height state:'
  );
};

export const writePaneDimensionsToStorage = (pageId: string, dimensions: PaneDimensions): void => {
  updateRecordStorage<PaneDimensions>(
    STORAGE_KEYS.paneDimensions,
    record => {
      record[pageId] =
        typeof dimensions.height === 'number'
          ? { width: dimensions.width, height: dimensions.height }
          : { width: dimensions.width };
    },
    'Failed to store pane dimensions:'
  );
};

export const readPaneCollapseOrientationsFromStorage = (): Record<string, CollapseOrientation> =>
  readRecordStorage<CollapseOrientation>(STORAGE_KEYS.paneCollapseOrientation);

export const writePaneCollapseOrientationToStorage = (
  pageId: string,
  orientation: CollapseOrientation
): void => {
  updateRecordStorage<CollapseOrientation>(
    STORAGE_KEYS.paneCollapseOrientation,
    record => {
      record[pageId] = orientation;
    },
    'Failed to store pane collapse orientation:'
  );
};

const readArrayStorage = (key: string): string[] => {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    const parsedArray = Array.isArray(parsed) ? (parsed as string[]) : [];
    const trimmed = trimArrayStorage(parsedArray, key);

    if (trimmed.length !== parsedArray.length) {
      localStorage.setItem(key, JSON.stringify(trimmed));
    }

    return trimmed;
  } catch {

    return [];
  }
};

const readRecordStorage = <T>(key: string): Record<string, T> => {
  try {
    const raw = localStorage.getItem(key);
    const parsed = ensureRecord<T>(raw ? JSON.parse(raw) : {});
    const trimmed = trimRecordStorage<T>(parsed, key);

    if (Object.keys(trimmed).length !== Object.keys(parsed || {}).length) {
      localStorage.setItem(key, JSON.stringify(trimmed));
    }

    return trimmed;
  } catch {

    return {};
  }
};

const updateRecordStorage = <T>(
  key: string,
  updater: (record: Record<string, T>) => void,
  errorMessage: string
): void => {
  try {
    const raw = localStorage.getItem(key);
    const allValues = trimRecordStorage<T>(ensureRecord<T>(raw ? JSON.parse(raw) : {}), key);

    updater(allValues);
    persistRecord<T>(key, allValues);
  } catch (error) {
    console.error(errorMessage, error);
    showError(errorMessage);
  }
};

const logStorageTrim = (key: string, originalSize: number, trimmedSize: number): void => {
  if (originalSize <= trimmedSize) return;
  console.info(
    `[PanesMode][Task1] Trimmed ${originalSize - trimmedSize} entries from ${key} (kept ${trimmedSize})`
  );
};

const trimArrayStorage = <T>(items: T[], key?: string): T[] => {
  const trimmedItems = Array.isArray(items) ? [...items] : [];
  const originalSize = trimmedItems.length;
  while (trimmedItems.length > LOCAL_STORAGE_SAVINGS_LIMITS.maxEntries) {
    trimmedItems.splice(0, LOCAL_STORAGE_SAVINGS_LIMITS.pruneBatchSize);
  }
  if (key) {
    logStorageTrim(key, originalSize, trimmedItems.length);
  }

  return trimmedItems;
};

const trimRecordStorage = <T>(
  record: Record<string, T> | null | undefined,
  key?: string
): Record<string, T> => {
  const safeRecord =
    record && typeof record === 'object' && !Array.isArray(record) ? { ...record } : {};
  const keys = Object.keys(safeRecord);
  const originalSize = keys.length;
  if (keys.length <= LOCAL_STORAGE_SAVINGS_LIMITS.maxEntries) return safeRecord;
  let removalIndex = 0;
  while (keys.length - removalIndex > LOCAL_STORAGE_SAVINGS_LIMITS.maxEntries) {
    const keysToDrop = keys.slice(
      removalIndex,
      removalIndex + LOCAL_STORAGE_SAVINGS_LIMITS.pruneBatchSize
    );
    keysToDrop.forEach(key => delete safeRecord[key]);
    removalIndex += LOCAL_STORAGE_SAVINGS_LIMITS.pruneBatchSize;
  }
  if (key) {
    logStorageTrim(key, originalSize, Object.keys(safeRecord).length);
  }

  return safeRecord;
};

const persistArray = (key: string, values: string[]): string[] => {
  const trimmed = trimArrayStorage(values, key);
  localStorage.setItem(key, JSON.stringify(trimmed));

  return trimmed;
};

const persistRecord = <T>(key: string, values: Record<string, T>): Record<string, T> => {
  const trimmed = trimRecordStorage(values, key);
  localStorage.setItem(key, JSON.stringify(trimmed));

  return trimmed;
};

const ensureRecord = <T>(value: unknown): Record<string, T> => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {

    return value as Record<string, T>;
  }

  return {};
};
