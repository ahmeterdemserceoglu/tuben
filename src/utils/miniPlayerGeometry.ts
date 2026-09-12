import { floatingNavigationBottom, MINI_PLAYER_HEIGHT, MINI_PLAYER_NAV_GAP, miniPlayerWidth } from '../constants/navigationLayout';

interface Insets { top: number; bottom: number; left: number; right: number }
export interface DragBounds { minX: number; maxX: number; minY: number; maxY: number }

export function miniPlayerGeometry(width: number, height: number, insets: Insets, barHeight: number, platform: string) {
  const cardWidth = miniPlayerWidth(width, insets.left, insets.right);
  const minLeft = insets.left + 12;
  const maxLeft = Math.max(minLeft, width - insets.right - 12 - cardWidth);
  const left = (minLeft + maxLeft) / 2;
  const bottom = floatingNavigationBottom(insets.bottom, platform) + barHeight + MINI_PLAYER_NAV_GAP;
  const top = height - bottom - MINI_PLAYER_HEIGHT;
  return { width: cardWidth, left, bottom, bounds: {
    minX: minLeft - left, maxX: maxLeft - left,
    minY: Math.min(0, insets.top + 8 - top), maxY: 0,
  } };
}

export function clampMiniPlayerPosition(position: { x: number; y: number }, bounds: DragBounds) {
  return {
    x: Math.min(bounds.maxX, Math.max(bounds.minX, position.x)),
    y: Math.min(bounds.maxY, Math.max(bounds.minY, position.y)),
  };
}
