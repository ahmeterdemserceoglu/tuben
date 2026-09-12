import { create } from 'zustand';
import { VideoItem } from '../types/video';
export const useDownloadSheetStore = create<{ video?: VideoItem; open: (video: VideoItem) => void; close: () => void }>(set => ({ video: undefined, open: video => set({ video }), close: () => set({ video: undefined }) }));
