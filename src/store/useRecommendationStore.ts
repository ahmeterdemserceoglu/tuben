import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { VideoItem } from '../types/video';
interface RecommendationState {
  hiddenVideos: string[]; blockedChannels: string[]; hideWatched: boolean;
  hideVideo: (id: string) => void; blockChannel: (id: string) => void;
  setHideWatched: (value: boolean) => void; reset: () => void;
}
export const useRecommendationStore = create<RecommendationState>()(persist(set => ({
  hiddenVideos: [], blockedChannels: [], hideWatched: false,
  hideVideo: id => set(s => ({ hiddenVideos: [...new Set([...s.hiddenVideos, id])] })),
  blockChannel: id => set(s => ({ blockedChannels: [...new Set([...s.blockedChannels, id])] })),
  setHideWatched: hideWatched => set({ hideWatched }),
  reset: () => set({ hiddenVideos: [], blockedChannels: [], hideWatched: false }),
}), { name: 'tuben-recommendation-preferences', storage: createJSONStorage(() => AsyncStorage) }));
export function filterRecommendations(videos: VideoItem[], preferences: Pick<RecommendationState, 'hiddenVideos' | 'blockedChannels' | 'hideWatched'>, watched: string[] = []): VideoItem[] {
  const hidden = new Set(preferences.hiddenVideos), blocked = new Set(preferences.blockedChannels), seen = new Set(watched);
  return videos.filter(v => !hidden.has(v.id) && !blocked.has(v.uploaderId || `name:${v.uploaderName.toLocaleLowerCase('tr')}`) && !(preferences.hideWatched && seen.has(v.id)));
}
