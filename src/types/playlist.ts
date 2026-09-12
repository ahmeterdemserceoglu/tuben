import { VideoItem } from './video';

export interface PlaylistItem {
  id: string;
  title: string;
  thumbnailUrl: string;
  videoCount: number;
  uploaderName?: string;
  uploaderAvatarUrl?: string;
}

export interface PlaylistDetails {
  id: string;
  title: string;
  thumbnailUrl: string;
  uploaderName?: string;
  uploaderAvatarUrl?: string;
  bannerUrl?: string;
  videoCount: number;
  description?: string;
  videos: VideoItem[];
}
