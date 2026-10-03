import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, AppStateStatus } from 'react-native';

const CHECKPOINT_STORAGE_KEY = '@tuben_playback_checkpoints_v2';
const MAX_CHECKPOINTS = 100;
const AUTO_FLUSH_INTERVAL_MS = 5000;

export interface VideoCheckpoint {
  videoId: string;
  positionSec: number;
  durationSec: number;
  updatedAt: number;
}

class PlaybackCheckpointManager {
  private cache: Map<string, VideoCheckpoint> = new Map();
  private isLoaded = false;
  private isDirty = false;
  private revision = 0;
  private flushPending: Promise<void> = Promise.resolve();
  private loadPending: Promise<void> | null = null;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private currentVideoId: string | null = null;

  constructor() {
    this.init();
    AppState.addEventListener('change', this.handleAppStateChange);
  }

  private async init(): Promise<void> {
    if (this.isLoaded) return;
    if (this.loadPending) return this.loadPending;
    this.loadPending = this.load();
    return this.loadPending;
  }

  private async load(): Promise<void> {
    try {
      const raw = await AsyncStorage.getItem(CHECKPOINT_STORAGE_KEY);
      if (raw) {
        const parsed: Record<string, VideoCheckpoint> = JSON.parse(raw);
        Object.entries(parsed).forEach(([id, cp]) => {
          this.cache.set(id, cp);
        });
      }
    } catch (e) {
      console.warn('[CheckpointService] Failed to load checkpoints from storage:', e);
    } finally {
      this.isLoaded = true;
    }
  }

  private handleAppStateChange = (state: AppStateStatus) => {
    if (state === 'background' || state === 'inactive') {
      void this.flush();
    }
  };

  /**
   * Save or update checkpoint for a video
   */
  async saveCheckpoint(videoId: string, positionSec: number, durationSec: number): Promise<void> {
    if (!videoId || positionSec < 0) return;
    if (!this.isLoaded) await this.init();

    this.currentVideoId = videoId;
    const pos = Math.floor(positionSec);
    const dur = Math.floor(durationSec);

    // If finished or near end (>90% or within last 10 seconds), reset checkpoint
    const isNearEnd = dur > 0 && (pos / dur >= 0.9 || dur - pos <= 10);
    const isTooEarly = pos < 5;

    if (isNearEnd || isTooEarly) {
      if (this.cache.has(videoId)) {
        this.cache.delete(videoId);
        this.isDirty = true;
        this.revision++;
        this.scheduleFlush();
      }
      return;
    }

    this.cache.set(videoId, {
      videoId,
      positionSec: pos,
      durationSec: dur,
      updatedAt: Date.now(),
    });
    this.isDirty = true;
    this.revision++;
    this.scheduleFlush();
  }

  /**
   * Get saved checkpoint position in seconds. Returns 0 if no valid checkpoint.
   */
  async getCheckpoint(videoId: string): Promise<number> {
    if (!videoId) return 0;
    if (!this.isLoaded) await this.init();

    const cp = this.cache.get(videoId);
    if (!cp || cp.positionSec <= 5) return 0;

    // Check if it was saved as near-end
    if (cp.durationSec > 0 && cp.positionSec / cp.durationSec >= 0.9) {
      this.clearCheckpoint(videoId);
      return 0;
    }

    return cp.positionSec;
  }

  /**
   * Clear checkpoint for a specific video
   */
  clearCheckpoint(videoId: string): void {
    if (this.cache.delete(videoId)) {
      this.isDirty = true;
      this.revision++;
      void this.flush();
    }
  }

  /**
   * Force flush all dirty in-memory checkpoints to AsyncStorage immediately
   */
  async flush(): Promise<void> {
    const operation = this.flushPending.then(() => this.flushDirty());
    this.flushPending = operation.catch(() => undefined);
    return operation;
  }

  private async flushDirty(): Promise<void> {
    if (!this.isDirty) return;
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    try {
      // LRU eviction if cache exceeds MAX_CHECKPOINTS
      if (this.cache.size > MAX_CHECKPOINTS) {
        const sorted = Array.from(this.cache.entries()).sort(
          (a, b) => b[1].updatedAt - a[1].updatedAt
        );
        this.cache = new Map(sorted.slice(0, MAX_CHECKPOINTS));
      }

      const revision = this.revision;
      const record: Record<string, VideoCheckpoint> = {};
      this.cache.forEach((val, key) => {
        record[key] = val;
      });

      await AsyncStorage.setItem(CHECKPOINT_STORAGE_KEY, JSON.stringify(record));
      this.isDirty = revision !== this.revision;
      if (this.isDirty) this.scheduleFlush();
    } catch (e) {
      console.warn('[CheckpointService] Flush failed:', e);
    }
  }

  private scheduleFlush(): void {
    if (this.flushTimer || !this.isDirty) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      void this.flush();
    }, AUTO_FLUSH_INTERVAL_MS);
  }

  /**
   * Called when video changes or player closes
   */
  async onVideoExit(): Promise<void> {
    await this.flush();
    this.currentVideoId = null;
  }
}

export const CheckpointService = new PlaybackCheckpointManager();
