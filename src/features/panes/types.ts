export type CollapseOrientation = 'vertical' | 'horizontal';

export type CollapsiblePane = HTMLElement & {
  _collapseObserver?: MutationObserver;
  _prevCollapsed?: boolean;
};

export type FitContentToggleOptions = {
  restoreStoredDimensions?: boolean;
};
