import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface ThemeColors {
  background: string;
  surface: string;
  surfaceElevated: string;
  surfaceHighlight: string;
  surfaceBorder: string;
  border: string;
  borderLight: string;
  borderSubtle: string;
  divider: string;
}

const DEFAULT_DARK_COLORS: ThemeColors = {
  background: '#0B0B0E',
  surface: '#14141A',
  surfaceElevated: '#1C1C24',
  surfaceHighlight: '#242430',
  surfaceBorder: 'rgba(255, 255, 255, 0.08)',
  border: 'rgba(255, 255, 255, 0.08)',
  borderLight: 'rgba(255, 255, 255, 0.14)',
  borderSubtle: 'rgba(255, 255, 255, 0.04)',
  divider: 'rgba(255, 255, 255, 0.06)',
};

const AMOLED_COLORS: ThemeColors = {
  background: '#000000',
  surface: '#08080A',
  surfaceElevated: '#121214',
  surfaceHighlight: '#1A1A1E',
  surfaceBorder: 'rgba(255, 255, 255, 0.06)',
  border: 'rgba(255, 255, 255, 0.05)',
  borderLight: 'rgba(255, 255, 255, 0.10)',
  borderSubtle: 'rgba(255, 255, 255, 0.025)',
  divider: 'rgba(255, 255, 255, 0.04)',
};

interface ThemeState {
  isAmoled: boolean;
  toggleAmoled: () => void;
  colors: ThemeColors;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      isAmoled: false,
      colors: DEFAULT_DARK_COLORS,
      toggleAmoled: () =>
        set((state) => {
          const next = !state.isAmoled;
          return {
            isAmoled: next,
            colors: next ? AMOLED_COLORS : DEFAULT_DARK_COLORS,
          };
        }),
    }),
    {
      name: 'tuben-theme-storage',
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.colors = state.isAmoled ? AMOLED_COLORS : DEFAULT_DARK_COLORS;
        }
      },
    }
  )
);
