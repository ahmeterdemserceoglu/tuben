import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { VideoItem } from '../types/video';
import { DownloadOption } from '../utils/downloadOptions';
export type DownloadStatus = 'queued' | 'downloading' | 'paused' | 'merging' | 'completed' | 'error';
export interface DownloadTask { id: string; video: VideoItem; option: DownloadOption; quality: string; status: DownloadStatus; progress: number; localUri?: string; fileSize?: number; downloadedBytes?: number; totalBytes?: number; bytesPerSecond?: number; remainingSeconds?: number; error?: string; phase?: 'video' | 'audio' | 'hls'; hlsPlan?: import('../utils/offlineHls').OfflineHlsPlan; hlsCompleted?: string[]; hlsFileSizes?: Record<string, number>; hlsActiveUrl?: string; resumeData?: string; videoUri?: string; audioUri?: string; }
interface DownloadState { downloads: DownloadTask[]; enqueue: (video: VideoItem, option: DownloadOption) => void; update: (id: string, patch: Partial<DownloadTask>) => void; remove: (id: string) => void; }
export const useDownloadStore = create<DownloadState>()(persist(set => ({
  downloads: [],
  enqueue: (video, option) => set(s => ({ downloads: [...s.downloads.filter(x => x.id !== video.id), { id: video.id, video, option, quality: option.quality, status: 'queued', progress: 0 }] })),
  update: (id, patch) => set(s => ({ downloads: s.downloads.map(x => x.id === id ? { ...x, ...patch } : x) })),
  remove: id => set(s => ({ downloads: s.downloads.filter(x => x.id !== id) })),
}), { name: 'tuben-download-queue-v2', storage: createJSONStorage(() => AsyncStorage), onRehydrateStorage: () => state => { if (state) state.downloads = state.downloads.map(x => ['downloading', 'merging', 'queued'].includes(x.status) ? { ...x, status: 'paused' as const, bytesPerSecond: 0, remainingSeconds: undefined } : x); } }));
