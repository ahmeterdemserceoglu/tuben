import { create } from 'zustand';
import { LibraryRepository } from '../repositories/libraryRepository';
import { VideoItem } from '../types/video';
import { ChannelItem } from '../types/channel';
import { FavoriteVideo, WatchHistoryItem, UserSubscription, CustomPlaylist } from '../types/user';

interface LibraryStoreState {
  favorites: FavoriteVideo[];
  history: WatchHistoryItem[];
  subscriptions: UserSubscription[];
  playlists: CustomPlaylist[];
  loading: boolean;
  
  loadLibrary: (uid?: string | null) => Promise<void>;
  toggleFavorite: (uid: string | null | undefined, video: VideoItem) => Promise<boolean>;
  isFavorite: (videoId: string) => boolean;
  addToHistory: (uid: string | null | undefined, video: VideoItem, position?: number) => Promise<void>;
  removeFromHistory: (uid: string | null | undefined, videoId: string) => Promise<void>;
  clearHistory: (uid?: string | null) => Promise<void>;
  toggleSubscription: (uid: string | null | undefined, channel: ChannelItem) => Promise<boolean>;
  isSubscribed: (channelId: string) => boolean;
  createPlaylist: (uid: string | null | undefined, title: string) => Promise<CustomPlaylist>;
}

let libraryGeneration = 0;
let libraryUid: string | null | undefined;
export const useLibraryStore = create<LibraryStoreState>((set, get) => ({
  favorites: [],
  history: [],
  subscriptions: [],
  playlists: [],
  loading: false,

  loadLibrary: async (uid) => {
    const generation = ++libraryGeneration;
    const accountChanged = libraryUid !== (uid || null);
    libraryUid = uid || null;
    set({ loading: true, ...(accountChanged ? { favorites: [], history: [], subscriptions: [], playlists: [] } : {}) });
    try {
      const [favs, hist, subs, pls] = await Promise.all([
        LibraryRepository.getFavorites(uid),
        LibraryRepository.getHistory(uid),
        LibraryRepository.getSubscriptions(uid),
        LibraryRepository.getPlaylists(uid),
      ]);
      if (generation === libraryGeneration) set({ favorites: favs, history: hist, subscriptions: subs, playlists: pls, loading: false });
    } catch {
      if (generation === libraryGeneration) set({ loading: false });
    }
  },

  toggleFavorite: async (uid, video) => {
    const generation = libraryGeneration;
    const isFav = get().isFavorite(video.id);
    // Optimistic UI update
    if (isFav) {
      set({ favorites: get().favorites.filter((f) => f.videoId !== video.id) });
    } else {
      set({
        favorites: [
          {
            videoId: video.id,
            title: video.title,
            channelTitle: video.uploaderName,
            thumbnailUrl: video.thumbnailUrl,
            duration: video.duration,
            addedAt: Date.now(),
          },
          ...get().favorites,
        ],
      });
    }

    try {
      const result = await LibraryRepository.toggleFavorite(uid, video);
      return result;
    } catch {
      // Revert if error
      if (generation === libraryGeneration) void get().loadLibrary(uid);
      return isFav;
    }
  },

  isFavorite: (videoId: string) => {
    return get().favorites.some((f) => f.videoId === videoId);
  },

  addToHistory: async (uid, video, position = 0) => {
    const item: WatchHistoryItem = {
      videoId: video.id,
      title: video.title,
      channelTitle: video.uploaderName,
      thumbnailUrl: video.thumbnailUrl,
      duration: video.duration,
      lastPosition: position,
      watchedAt: Date.now(),
    };
    const filtered = get().history.filter((h) => h.videoId !== video.id);
    set({ history: [item, ...filtered] });
    await LibraryRepository.addToHistory(uid, video, position);
  },

  removeFromHistory: async (uid, videoId) => {
    set({ history: get().history.filter((h) => h.videoId !== videoId) });
    await LibraryRepository.removeFromHistory(uid, videoId);
  },

  clearHistory: async (uid) => {
    set({ history: [] });
    await LibraryRepository.clearHistory(uid);
  },

  toggleSubscription: async (uid, channel) => {
    const generation = libraryGeneration;
    const isSub = get().isSubscribed(channel.id);
    // Optimistic UI update
    if (isSub) {
      set({ subscriptions: get().subscriptions.filter((s) => s.channelId !== channel.id) });
    } else {
      set({
        subscriptions: [
          {
            channelId: channel.id,
            channelTitle: channel.name,
            thumbnailUrl: channel.avatarUrl,
            subscribedAt: Date.now(),
          },
          ...get().subscriptions,
        ],
      });
    }

    try {
      const result = await LibraryRepository.toggleSubscription(uid, channel);
      return result;
    } catch {
      if (generation === libraryGeneration) void get().loadLibrary(uid);
      return isSub;
    }
  },

  isSubscribed: (channelId: string) => {
    return get().subscriptions.some((s) => s.channelId === channelId);
  },

  createPlaylist: async (uid, title) => {
    const generation = libraryGeneration;
    const pl = await LibraryRepository.createPlaylist(uid, title);
    if (generation === libraryGeneration) set({ playlists: [pl, ...get().playlists] });
    return pl;
  },
}));
