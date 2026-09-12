import { create } from 'zustand';
import { DEFAULT_BOTTOM_BAR_HEIGHT } from '../constants/navigationLayout';

interface NavigationLayoutState {
  bottomBarHeight: number;
  setBottomBarHeight: (height: number) => void;
}

export const useNavigationLayoutStore = create<NavigationLayoutState>((set) => ({
  bottomBarHeight: DEFAULT_BOTTOM_BAR_HEIGHT,
  setBottomBarHeight: (height) => {
    if (Number.isFinite(height) && height > 0) set({ bottomBarHeight: height });
  },
}));
