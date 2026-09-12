import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  query,
  orderBy,
  limit,
} from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '../config/firebase';
import { VideoItem } from '../types/video';
import { ChannelItem } from '../types/channel';
import { FavoriteVideo, WatchHistoryItem, UserSubscription, CustomPlaylist } from '../types/user';

const LOCAL_FAVORITES_KEY = '@tuben_favorites';
const LOCAL_HISTORY_KEY = '@tuben_history';
const LOCAL_SUBS_KEY = '@tuben_subscriptions';
const LOCAL_PLAYLISTS_KEY = '@tuben_playlists';

export class LibraryRepository {
  // ==========================================
  // 1. FAVORITES (Beğenilen Videolar)
  // ==========================================

  static async getFavorites(uid?: string | null): Promise<FavoriteVideo[]> {
    if (!uid) {
      const local = await AsyncStorage.getItem(LOCAL_FAVORITES_KEY);
      return local ? JSON.parse(local) : [];
    }

    try {
      const favRef = collection(db, 'users', uid, 'favorites');
      const q = query(favRef, orderBy('addedAt', 'desc'), limit(50));
      const snap = await getDocs(q);
      const list = snap.docs.map((d) => d.data() as FavoriteVideo);
      // Update local cache
      AsyncStorage.setItem(LOCAL_FAVORITES_KEY, JSON.stringify(list)).catch(() => {});
      return list;
    } catch {
      const local = await AsyncStorage.getItem(LOCAL_FAVORITES_KEY);
      return local ? JSON.parse(local) : [];
    }
  }

  static async toggleFavorite(uid: string | null | undefined, video: VideoItem): Promise<boolean> {
    const isFav = await this.isFavorite(uid, video.id);

    if (!uid) {
      const list = await this.getFavorites(null);
      let updated: FavoriteVideo[];
      if (isFav) {
        updated = list.filter((v) => v.videoId !== video.id);
      } else {
        updated = [
          {
            videoId: video.id,
            title: video.title,
            channelTitle: video.uploaderName,
            thumbnailUrl: video.thumbnailUrl,
            duration: video.duration,
            addedAt: Date.now(),
          },
          ...list,
        ];
      }
      await AsyncStorage.setItem(LOCAL_FAVORITES_KEY, JSON.stringify(updated));
      return !isFav;
    }

    const docRef = doc(db, 'users', uid, 'favorites', video.id);
    if (isFav) {
      await deleteDoc(docRef);
      return false;
    } else {
      const item: FavoriteVideo = {
        videoId: video.id,
        title: video.title,
        channelTitle: video.uploaderName,
        thumbnailUrl: video.thumbnailUrl,
        duration: video.duration,
        addedAt: Date.now(),
      };
      await setDoc(docRef, item);
      return true;
    }
  }

  static async isFavorite(uid: string | null | undefined, videoId: string): Promise<boolean> {
    if (!uid) {
      const list = await this.getFavorites(null);
      return list.some((v) => v.videoId === videoId);
    }
    try {
      const docRef = doc(db, 'users', uid, 'favorites', videoId);
      const snap = await getDoc(docRef);
      return snap.exists();
    } catch {
      const list = await this.getFavorites(null);
      return list.some((v) => v.videoId === videoId);
    }
  }

  // ==========================================
  // 2. WATCH HISTORY (İzleme Geçmişi)
  // ==========================================

  static async getHistory(uid?: string | null): Promise<WatchHistoryItem[]> {
    if (!uid) {
      const local = await AsyncStorage.getItem(LOCAL_HISTORY_KEY);
      return local ? JSON.parse(local) : [];
    }

    try {
      const histRef = collection(db, 'users', uid, 'history');
      const q = query(histRef, orderBy('watchedAt', 'desc'), limit(50));
      const snap = await getDocs(q);
      const list = snap.docs.map((d) => d.data() as WatchHistoryItem);
      AsyncStorage.setItem(LOCAL_HISTORY_KEY, JSON.stringify(list)).catch(() => {});
      return list;
    } catch {
      const local = await AsyncStorage.getItem(LOCAL_HISTORY_KEY);
      return local ? JSON.parse(local) : [];
    }
  }

  static async addToHistory(uid: string | null | undefined, video: VideoItem, position = 0): Promise<void> {
    const item: WatchHistoryItem = {
      videoId: video.id,
      title: video.title,
      channelTitle: video.uploaderName,
      thumbnailUrl: video.thumbnailUrl,
      duration: video.duration,
      lastPosition: position,
      watchedAt: Date.now(),
    };

    // Always persist to local cache first for instant UI response and offline support
    try {
      const list = await this.getHistory(null);
      const filtered = list.filter((v) => v.videoId !== video.id);
      const updated = [item, ...filtered].slice(0, 100);
      await AsyncStorage.setItem(LOCAL_HISTORY_KEY, JSON.stringify(updated));
    } catch (err) {
      console.warn('[LibraryRepo] Failed to save local history:', err);
    }

    if (!uid) return;

    try {
      const docRef = doc(db, 'users', uid, 'history', video.id);
      await setDoc(docRef, item, { merge: true });
    } catch (e) {
      console.warn('[LibraryRepo] Error adding history to Firestore:', e);
    }
  }

  static async removeFromHistory(uid: string | null | undefined, videoId: string): Promise<void> {
    const list = await this.getHistory(null);
    const updated = list.filter((v) => v.videoId !== videoId);
    await AsyncStorage.setItem(LOCAL_HISTORY_KEY, JSON.stringify(updated));

    if (uid) {
      try {
        const docRef = doc(db, 'users', uid, 'history', videoId);
        await deleteDoc(docRef);
      } catch (e) {
        console.warn('[LibraryRepo] Error deleting history item in Firestore:', e);
      }
    }
  }

  static async clearHistory(uid?: string | null): Promise<void> {
    await AsyncStorage.removeItem(LOCAL_HISTORY_KEY);
    if (!uid) return;
    try {
      const histRef = collection(db, 'users', uid, 'history');
      const snap = await getDocs(histRef);
      const deletePromises = snap.docs.map((d) => deleteDoc(d.ref));
      await Promise.all(deletePromises);
    } catch (e) {
      console.warn('[LibraryRepo] Error clearing history in Firestore:', e);
    }
  }

  // ==========================================
  // 3. SUBSCRIPTIONS (Kanal Abonelikleri)
  // ==========================================

  static async getSubscriptions(uid?: string | null): Promise<UserSubscription[]> {
    if (!uid) {
      const local = await AsyncStorage.getItem(LOCAL_SUBS_KEY);
      return local ? JSON.parse(local) : [];
    }

    try {
      const subRef = collection(db, 'users', uid, 'subscriptions');
      const q = query(subRef, orderBy('subscribedAt', 'desc'));
      const snap = await getDocs(q);
      const list = snap.docs.map((d) => d.data() as UserSubscription);
      AsyncStorage.setItem(LOCAL_SUBS_KEY, JSON.stringify(list)).catch(() => {});
      return list;
    } catch {
      const local = await AsyncStorage.getItem(LOCAL_SUBS_KEY);
      return local ? JSON.parse(local) : [];
    }
  }

  static async toggleSubscription(uid: string | null | undefined, channel: ChannelItem): Promise<boolean> {
    const isSub = await this.isSubscribed(uid, channel.id);

    if (!uid) {
      const list = await this.getSubscriptions(null);
      let updated: UserSubscription[];
      if (isSub) {
        updated = list.filter((c) => c.channelId !== channel.id);
      } else {
        updated = [
          {
            channelId: channel.id,
            channelTitle: channel.name,
            thumbnailUrl: channel.avatarUrl,
            subscribedAt: Date.now(),
          },
          ...list,
        ];
      }
      await AsyncStorage.setItem(LOCAL_SUBS_KEY, JSON.stringify(updated));
      return !isSub;
    }

    const docRef = doc(db, 'users', uid, 'subscriptions', channel.id);
    if (isSub) {
      await deleteDoc(docRef);
      return false;
    } else {
      const item: UserSubscription = {
        channelId: channel.id,
        channelTitle: channel.name,
        thumbnailUrl: channel.avatarUrl,
        subscribedAt: Date.now(),
      };
      await setDoc(docRef, item);
      return true;
    }
  }

  static async isSubscribed(uid: string | null | undefined, channelId: string): Promise<boolean> {
    if (!uid) {
      const list = await this.getSubscriptions(null);
      return list.some((c) => c.channelId === channelId);
    }
    try {
      const docRef = doc(db, 'users', uid, 'subscriptions', channelId);
      const snap = await getDoc(docRef);
      return snap.exists();
    } catch {
      const list = await this.getSubscriptions(null);
      return list.some((c) => c.channelId === channelId);
    }
  }

  // ==========================================
  // 4. CUSTOM PLAYLISTS (Özel Oynatma Listeleri)
  // ==========================================

  static async getPlaylists(uid?: string | null): Promise<CustomPlaylist[]> {
    if (!uid) {
      const local = await AsyncStorage.getItem(LOCAL_PLAYLISTS_KEY);
      return local ? JSON.parse(local) : [];
    }

    try {
      const plRef = collection(db, 'users', uid, 'playlists');
      const q = query(plRef, orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      const list = snap.docs.map((d) => d.data() as CustomPlaylist);
      AsyncStorage.setItem(LOCAL_PLAYLISTS_KEY, JSON.stringify(list)).catch(() => {});
      return list;
    } catch {
      const local = await AsyncStorage.getItem(LOCAL_PLAYLISTS_KEY);
      return local ? JSON.parse(local) : [];
    }
  }

  static async createPlaylist(uid: string | null | undefined, title: string): Promise<CustomPlaylist> {
    const id = `pl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newPl: CustomPlaylist = {
      id,
      title: title.trim(),
      createdAt: Date.now(),
      videoIds: [],
    };

    if (!uid) {
      const list = await this.getPlaylists(null);
      const updated = [newPl, ...list];
      await AsyncStorage.setItem(LOCAL_PLAYLISTS_KEY, JSON.stringify(updated));
      return newPl;
    }

    const docRef = doc(db, 'users', uid, 'playlists', id);
    await setDoc(docRef, newPl);
    return newPl;
  }
}
