export const DEFAULT_BOTTOM_BAR_HEIGHT = 64;
export const MINI_PLAYER_NAV_GAP = 6;

export function floatingNavigationBottom(bottomInset: number, platform: string): number {
  return bottomInset > 0 ? bottomInset + 6 : platform === 'ios' ? 20 : 14;
}

export const MINI_PLAYER_HEIGHT = 76;
export const MINI_PLAYER_MAX_WIDTH = 320;

export function miniPlayerWidth(windowWidth: number, leftInset = 0, rightInset = 0): number {
  return Math.max(1, Math.min(windowWidth - leftInset - rightInset - 24, MINI_PLAYER_MAX_WIDTH));
}
