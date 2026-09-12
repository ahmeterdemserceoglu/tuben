interface TouchPoint { pageX: number; pageY: number }

export function pinchDistance(touches: readonly TouchPoint[]): number {
  if (touches.length < 2) return 0;
  return Math.hypot(touches[0].pageX - touches[1].pageX, touches[0].pageY - touches[1].pageY);
}

export function pinchFillMode(scale: number, current: boolean): boolean {
  if (scale > 1.12) return true;
  if (scale < 0.88) return false;
  return current;
}
