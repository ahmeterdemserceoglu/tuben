import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type PlaybackQuality = 'Auto' | `${number}p`;

interface SettingsState {
  sponsorBlockEnabled: boolean;
  skipIntros: boolean;
  skipSelfPromo: boolean;
  backgroundPlayback: boolean;
  autoPlayNext: boolean;
  defaultQuality: PlaybackQuality;

  setSponsorBlockEnabled: (value: boolean) => void;
  setSkipIntros: (value: boolean) => void;
  setSkipSelfPromo: (value: boolean) => void;
  setBackgroundPlayback: (value: boolean) => void;
  setAutoPlayNext: (value: boolean) => void;
  setDefaultQuality: (value: PlaybackQuality) => void;
  resetPlaybackSettings: () => void;
}

const DEFAULTS = {
  sponsorBlockEnabled: true,
  skipIntros: true,
  skipSelfPromo: true,
  backgroundPlayback: true,
  autoPlayNext: true,
  defaultQuality: 'Auto' as PlaybackQuality,
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      setSponsorBlockEnabled: (value) => set({ sponsorBlockEnabled: value }),
      setSkipIntros: (value) => set({ skipIntros: value }),
      setSkipSelfPromo: (value) => set({ skipSelfPromo: value }),
      setBackgroundPlayback: (value) => set({ backgroundPlayback: value }),
      setAutoPlayNext: (value) => set({ autoPlayNext: value }),
      setDefaultQuality: (value) => set({ defaultQuality: value }),
      resetPlaybackSettings: () => set(DEFAULTS),
    }),
    {
      name: 'tuben-playback-settings-v2',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        sponsorBlockEnabled: state.sponsorBlockEnabled,
        skipIntros: state.skipIntros,
        skipSelfPromo: state.skipSelfPromo,
        backgroundPlayback: state.backgroundPlayback,
        autoPlayNext: state.autoPlayNext,
        defaultQuality: state.defaultQuality,
      }),
    }
  )
);
