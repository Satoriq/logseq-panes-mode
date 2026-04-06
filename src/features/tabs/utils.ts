export const getPaneIndexFromElement = (element: HTMLElement | null): number => {
  if (!element) return -1;

  return parseInt(element.dataset.paneIndex || '-1', 10);
};
