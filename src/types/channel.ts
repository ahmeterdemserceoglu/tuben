import { VideoItem } from './video';

export interface ChannelItem {
  id: string;
  name: string;
  avatarUrl: string;
  subscriberCount?: string;
  verified?: boolean;
}

export interface ChannelDetails {
  id: string;
  name: string;
  avatarUrl: string;
  bannerUrl?: string;
  subscriberCount?: string;
  description?: string;
  verified?: boolean;
  isSubscribed?: boolean;
  videos: VideoItem[];
  shorts?: VideoItem[];
  playlists?: any[];
}
