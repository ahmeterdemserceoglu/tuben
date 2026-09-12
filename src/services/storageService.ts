import AsyncStorage from '@react-native-async-storage/async-storage';

export interface UserPreferences {
  theme: 'dark' | 'luxury';
  defaultQuality: 'Auto' | '1080p' | '720p' | '480p' | '360p';
  autoPlayNext: boolean;
  backgroundPlayback: boolean;
  sponsorBlockEnabled: boolean;
  skipIntros: boolean;
  skipSelfPromo: boolean;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  theme: 'dark',
  defaultQuality: '1080p',
  autoPlayNext: true,
  backgroundPlayback: true,
  sponsorBlockEnabled: true,
  skipIntros: true,
  skipSelfPromo: true,
};

const KEYS = {
  PREFERENCES: '@tuben_user_preferences',
  SEARCH_HISTORY: '@tuben_search_history',
  CHECKPOINTS: '@tuben_video_checkpoints',
  FAVORITES_CACHE: '@tuben_offline_favorites',
};

export class StorageService {
  /**
   * 1. Get or initialize user preferences
   */
  static async getPreferences(): Promise<UserPreferences> {
    try {
      const data = await AsyncStorage.getItem(KEYS.PREFERENCES);
      return data ? { ...DEFAULT_PREFERENCES, ...JSON.parse(data) } : DEFAULT_PREFERENCES;
    } catch {
      return DEFAULT_PREFERENCES;
    }
  }

  /**
   * 2. Save user preferences
   */
  static async savePreferences(prefs: Partial<UserPreferences>): Promise<void> {
    try {
      const current = await this.getPreferences();
      const updated = { ...current, ...prefs };
      await AsyncStorage.setItem(KEYS.PREFERENCES, JSON.stringify(updated));
    } catch (e) {
      console.warn('[StorageService] Error saving preferences:', e);
    }
  }

  /**
   * 3. Get search history
   */
  static async getSearchHistory(): Promise<string[]> {
    try {
      const data = await AsyncStorage.getItem(KEYS.SEARCH_HISTORY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  /**
   * 4. Add query to search history (LRU, max 25)
   */
  static async addSearchHistory(query: string): Promise<string[]> {
    if (!query.trim()) return await this.getSearchHistory();
    try {
      const history = await this.getSearchHistory();
      const filtered = history.filter((q) => q.toLowerCase() !== query.toLowerCase());
      const updated = [query.trim(), ...filtered].slice(0, 25);
      await AsyncStorage.setItem(KEYS.SEARCH_HISTORY, JSON.stringify(updated));
      return updated;
    } catch {
      return [];
    }
  }

  /**
   * 5. Remove single search item
   */
  static async removeSearchItem(query: string): Promise<string[]> {
    try {
      const history = await this.getSearchHistory();
      const updated = history.filter((q) => q !== query);
      await AsyncStorage.setItem(KEYS.SEARCH_HISTORY, JSON.stringify(updated));
      return updated;
    } catch {
      return [];
    }
  }

  /**
   * 6. Save video playback checkpoint (offline resume)
   */
  static async saveVideoCheckpoint(videoId: string, seconds: number): Promise<void> {
    try {
      const raw = await AsyncStorage.getItem(KEYS.CHECKPOINTS);
      const map: Record<string, number> = raw ? JSON.parse(raw) : {};
      map[videoId] = seconds;
      await AsyncStorage.setItem(KEYS.CHECKPOINTS, JSON.stringify(map));
    } catch {
      // Handled
    }
  }

  /**
   * 7. Get video playback checkpoint
   */
  static async getVideoCheckpoint(videoId: string): Promise<number> {
    try {
      const raw = await AsyncStorage.getItem(KEYS.CHECKPOINTS);
      if (!raw) return 0;
      const map: Record<string, number> = JSON.parse(raw);
      return map[videoId] || 0;
    } catch {
      return 0;
    }
  }

  /**
   * 8. Clear all local application caches
   */
  static async clearAllStorage(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([
        KEYS.SEARCH_HISTORY,
        KEYS.CHECKPOINTS,
        KEYS.FAVORITES_CACHE,
      ]);
    } catch (e) {
      console.warn('[StorageService] Error clearing storage:', e);
    }
  }
}
