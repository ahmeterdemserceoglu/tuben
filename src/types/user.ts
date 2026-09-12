export interface AppUser {
  uid: string;
  email: string | null;
  displayName: string;
  photoURL: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface UserSubscription {
  channelId: string;
  channelTitle: string;
  thumbnailUrl: string;
  subscribedAt: number;
  youtubeBrowseParams?: string;
}

export interface FavoriteVideo {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
  duration: number;
  addedAt: number;
}

export interface WatchHistoryItem {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
  duration: number;
  lastPosition: number;
  watchedAt: number;
}

export interface CustomPlaylist {
  id: string;
  title: string;
  createdAt: number;
  videoIds: string[];
}
