import logoSvg from '../../icons/logo.svg';
import resetSvg from '../../icons/reset.svg';
import hideLeftSvg from '../../icons/hide-left.svg';
import showLeftSvg from '../../icons/show-left.svg';
import cleanLeftSvg from '../../icons/clean-left.svg';
import cleanRightSvg from '../../icons/clean-right.svg';
import cleanUnusedSvg from '../../icons/clean-unused.svg';
import syncOrderSvg from '../../icons/sync-order.svg';

const withSize = (svg: string, size: number): string =>
  svg.replace(/width="20"/, `width="${size}"`).replace(/height="20"/, `height="${size}"`);

export const toolbarIcons = {
  logo: (size: number) => withSize(logoSvg, size),
  reset: (size: number) => withSize(resetSvg, size),
  hideLeft: (size: number) => withSize(hideLeftSvg, size),
  showLeft: (size: number) => withSize(showLeftSvg, size),
  cleanLeft: (size: number) => withSize(cleanLeftSvg, size),
  cleanRight: (size: number) => withSize(cleanRightSvg, size),
  cleanUnused: (size: number) => withSize(cleanUnusedSvg, size),
  syncOrder: (size: number) => withSize(syncOrderSvg, size),
};
