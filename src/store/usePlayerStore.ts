import { useRecommendationStore, filterRecommendations } from './useRecommendationStore';
import { PlaybackDiagnostics } from '../services/playbackDiagnostics';
import { create } from 'zustand';
import { StatusBar } from 'react-native';
import { VideoItem, StreamBundle, StreamItem, SubtitleItem } from '../types/video';
import { SponsorSegment } from '../types/sponsor';
import { YouTubeService, IOS_USER_AGENT } from '../services/youtubeService';
import { SponsorBlockService } from '../services/sponsorBlockService';
import { PlaybackQuality, useSettingsStore } from './useSettingsStore';
import { CheckpointService } from '../services/checkpointService';
import { NativePlayerBridge } from '../services/nativePlayerBridge';
import { auth } from '../config/firebase';
import { useLibraryStore } from './useLibraryStore';
import { prepareQualityStreams } from '../services/playbackQualityService';
import { DownloadService } from '../services/downloadService';

let loadGeneration = 0;
let subtitleGeneration = 0;
let lastHistorySaveTime = 0;

function persistCurrentWatchPosition() {
  const { currentVideo, currentTime, duration } = usePlayerStore.getState();
  if (!currentVideo) return Promise.resolve();
  return useLibraryStore.getState().addToHistory(auth?.currentUser?.uid || null,
    { ...currentVideo, duration: duration || currentVideo.duration }, Math.round(currentTime)).catch(() => undefined);
}

function prefetchNextShort(queue: VideoItem[], currentIndex: number) {
  const nextVideo = queue[currentIndex + 1];
  if (nextVideo?.id) {
    void YouTubeService.getPlaybackStreams(nextVideo.id).catch(() => undefined);
  }
  const nextNextVideo = queue[currentIndex + 2];
  if (nextNextVideo?.id) {
    void YouTubeService.getPlaybackStreams(nextNextVideo.id).catch(() => undefined);
  }
}

export interface SelectedStream {
  url: string;
  quality: PlaybackQuality;
  headers: Record<string, string>;
  format?: string;
  isAudioOnly?: boolean;
}

export function pickFallbackStream(
  bundle: StreamBundle,
  failedUrls: Set<string>,
  requestedQuality: PlaybackQuality
): SelectedStream {
  const defaultHeaders =
    bundle.videoStreams[0]?.headers ||
    bundle.audioStreams[0]?.headers || { 'User-Agent': IOS_USER_AGENT };

  if (requestedQuality !== 'Auto') {
    const exact = bundle.qualityStreams?.find((stream) => stream.quality === requestedQuality && !failedUrls.has(stream.url));
    if (exact) return { url: exact.url, quality: requestedQuality, headers: exact.headers || defaultHeaders, format: exact.format };
  }

  // Explicit progressive quality contains both audio and video.
  const muxed = bundle.videoStreams.filter(
    (stream) => !stream.isAdaptive && stream.format !== 'hls' && Boolean(stream.url) && !failedUrls.has(stream.url)
  );

  if (requestedQuality !== 'Auto') {
    const exactMuxed = muxed.find(
      (stream) => stream.quality === requestedQuality || stream.quality.includes(requestedQuality)
    );
    if (exactMuxed) {
      return {
        url: exactMuxed.url,
        quality: requestedQuality,
        headers: exactMuxed.headers || defaultHeaders,
        format: exactMuxed.format || 'mp4',
      };
    }
  }

  // Auto uses the synchronized adaptive master playlist.
  if (bundle.hlsManifestUrl && !failedUrls.has(bundle.hlsManifestUrl)) {
    return {
      url: bundle.hlsManifestUrl,
      quality: 'Auto',
      headers: bundle.hlsManifestHeaders || defaultHeaders,
      format: 'hls',
    };
  }

  const bestMuxed = muxed[0];
  if (bestMuxed) {
    return {
      url: bestMuxed.url,
      quality: (bestMuxed.quality as PlaybackQuality) || 'Auto',
      headers: bestMuxed.headers || defaultHeaders,
      format: bestMuxed.format || 'mp4',
    };
  }

  // 3. DASH Manifest (if available)
  if (bundle.dashManifestUrl && !failedUrls.has(bundle.dashManifestUrl)) {
    return {
      url: bundle.dashManifestUrl,
      quality: 'Auto',
      headers: bundle.dashManifestHeaders || defaultHeaders,
      format: 'mpd',
    };
  }

  throw new Error('Oynatılabilir medya akışı bulunamadı veya tüm formatlar tükendi.');
}

interface PlayerState {
  currentVideo: VideoItem | null;
  streamBundle: StreamBundle | null;
  activeStreamUrl: string | null;
  streamHeaders: Record<string, string>;
  failedStreamUrls: Set<string>;
  loading: boolean;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  bufferedTime: number;
  isBuffering: boolean;
  error: string | null;
  quality: PlaybackQuality;
  speed: number;
  isMinimized: boolean;
  isShortsPlayerVisible: boolean;
  queue: VideoItem[];
  queueIndex: number;
  sponsorSegments: SponsorSegment[];
  currentSponsorSegment: SponsorSegment | null;
  selectedSubtitle: SubtitleItem | null;
  isSubtitlesEnabled: boolean;
  subtitleCues: { startMs: number; endMs: number; text: string }[];
  currentSubtitleText: string | null;
  isFullscreen: boolean;
  streamRecoveryAttempts: number;

  loadAndPlay: (
    video: VideoItem,
    queue?: VideoItem[],
    index?: number,
    startPosition?: number
  ) => Promise<void>;
  playVideo: (video: VideoItem, feedList?: VideoItem[]) => Promise<void>;
  playShorts: (short: VideoItem, shortsList?: VideoItem[]) => Promise<void>;
  setShortsPlayerVisible: (visible: boolean) => void;
  retryCurrent: () => Promise<void>;
  refreshExpiringStream: () => Promise<void>;
  prepareSeek: (position: number) => Promise<void>;
  advanceToNextFallback: (failedUrl?: string) => boolean;
  handlePlaybackError: (failedUrl: string, message: string) => Promise<boolean>;
  togglePlay: () => void;
  setPlaying: (playing: boolean) => void;
  updatePlaybackTime: (currentTime: number, duration: number) => void;
  setBufferedTime: (seconds: number) => void;
  setBuffering: (buffering: boolean) => void;
  setError: (message: string | null) => void;
  setQuality: (quality: PlaybackQuality) => void;
  setSpeed: (speed: number) => void;
  setMinimized: (minimized: boolean) => void;
  closePlayer: () => void;
  playNext: () => Promise<void>;
  playPrevious: () => Promise<void>;
  skipCurrentSponsor: () => number | null;
  requestedSeekTime: number | null;
  requestSeek: (time: number) => void;
  clearRequestedSeek: () => void;
  toggleSubtitles: () => void;
  selectSubtitle: (subtitle: SubtitleItem | null) => Promise<void>;
  updateSubtitleForTime: (timeSec: number) => void;
  setFullscreen: (fullscreen: boolean) => void;
  toggleFullscreen: () => void;
}

let refreshingStream = false;
let lastStreamRefresh = 0;
let seekGeneration = 0;
let recoveryStableSince = 0;

export const usePlayerStore = create<PlayerState>((set, get) => ({
  currentVideo: null,
  streamBundle: null,
  activeStreamUrl: null,
  streamHeaders: { 'User-Agent': IOS_USER_AGENT },
  failedStreamUrls: new Set<string>(),
  loading: false,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  bufferedTime: 0,
  isBuffering: false,
  error: null,
  quality: 'Auto',
  speed: 1,
  isMinimized: false,
  isShortsPlayerVisible: false,
  queue: [],
  queueIndex: 0,
  sponsorSegments: [],
  currentSponsorSegment: null,
  selectedSubtitle: null,
  isSubtitlesEnabled: false,
  subtitleCues: [],
  currentSubtitleText: null,
  isFullscreen: false,
  streamRecoveryAttempts: 0,

  setShortsPlayerVisible: (isShortsPlayerVisible) => set({ isShortsPlayerVisible }),

  loadAndPlay: async (video, queue = [], index = 0, startPosition) => {
    const requestGeneration = ++loadGeneration;
    ++subtitleGeneration;
    const preferredSubtitleLanguage = get().selectedSubtitle?.languageCode;
    const requestedQuality = useSettingsStore.getState().defaultQuality;
    const effectiveQueue = queue.length > 0 ? queue : [video];
    const safeIndex = Math.max(0, Math.min(index, effectiveQueue.length - 1));

    // Flush previous video checkpoint if changing video
    const prevVideo = get().currentVideo;
    if (prevVideo && prevVideo.id !== video.id) {
      await persistCurrentWatchPosition();
      if (requestGeneration !== loadGeneration) return;
      await CheckpointService.onVideoExit();
    }

    // Determine starting position: explicit startPosition, or saved checkpoint, or 0
    let resolvedStart = 0;
    if (typeof startPosition === 'number' && startPosition > 0) {
      resolvedStart = startPosition;
    } else {
      resolvedStart = await CheckpointService.getCheckpoint(video.id);
    }

    if (requestGeneration !== loadGeneration) return;

    set({
      currentVideo: video,
      streamBundle: null,
      activeStreamUrl: null,
      streamHeaders: { 'User-Agent': IOS_USER_AGENT },
      failedStreamUrls: new Set<string>(),
      streamRecoveryAttempts: 0,
      requestedSeekTime: null,
      loading: true,
      isPlaying: true,
      currentTime: resolvedStart,
      duration: video.duration || 0,
      bufferedTime: 0,
      isBuffering: false,
      error: null,
      quality: requestedQuality,
      queue: effectiveQueue,
      queueIndex: safeIndex,
      sponsorSegments: [],
      currentSponsorSegment: null,
      selectedSubtitle: null,
      subtitleCues: [],
      currentSubtitleText: null,
    });

    // Record to watch history immediately
    void useLibraryStore.getState().addToHistory(auth?.currentUser?.uid || null, video, resolvedStart);

    // If playing shorts, prefetch next short in queue immediately
    if (get().isShortsPlayerVisible || video.streamType === 'SHORTS') {
      prefetchNextShort(effectiveQueue, safeIndex);
    }

    try {
      let bundle: StreamBundle;

      const downloaded = await DownloadService.findDownloadedVideo(video.id);
      if (requestGeneration !== loadGeneration) return;
      if (downloaded) video = { ...video, localUri: downloaded.localVideoUri };
      else if (video.localUri) throw new Error('İndirilen video eksik veya bozuk. Videoyu tekrar indirin.');

      if (video.localUri) {
        bundle = {
          videoId: video.id,
          title: video.title,
          uploaderName: video.uploaderName,
          viewCount: video.viewCount,
          thumbnailUrl: video.thumbnailUrl,
          isLive: false,
          isUpcoming: false,
          videoStreams: [
            {
              url: video.localUri,
              quality: 'Offline',
              format: video.localUri.endsWith('.m3u8') ? 'offline-hls' : 'mp4',
              isAdaptive: false,
            },
          ],
          audioStreams: [],
          subtitles: [],
          relatedVideos: [],
        };
      } else {
        bundle = await YouTubeService.getPlaybackStreams(video.id);

        // Fetch secondary metadata (related videos, subtitles, rich description) in background
        void YouTubeService.getSecondaryMetadata(video.id).then((secondary) => {
          if (requestGeneration !== loadGeneration || get().currentVideo?.id !== video.id) return;
          const currentBundle = get().streamBundle;
          if (!currentBundle) return;
          const updatedBundle: StreamBundle = {
            ...currentBundle,
            storyboards: secondary.storyboards?.length ? secondary.storyboards : currentBundle.storyboards,
            chapters: secondary.chapters?.length ? secondary.chapters : currentBundle.chapters,
            relatedVideos: secondary.relatedVideos.length > 0 ? secondary.relatedVideos : currentBundle.relatedVideos,
            subtitles: secondary.subtitles.length > 0 ? secondary.subtitles : currentBundle.subtitles,
            description: currentBundle.description || secondary.description || '',
            uploaderAvatarUrl: currentBundle.uploaderAvatarUrl || secondary.uploaderAvatarUrl,
            uploaderSubscriberCount: secondary.subscriberCount || currentBundle.uploaderSubscriberCount,
            uploadDate: secondary.uploadDate || currentBundle.uploadDate,
            uploaderId: secondary.uploaderId || currentBundle.uploaderId,
          };
          set({
            streamBundle: updatedBundle,
            currentVideo: get().currentVideo
              ? {
                  ...get().currentVideo!,
                  uploaderAvatarUrl: updatedBundle.uploaderAvatarUrl || get().currentVideo!.uploaderAvatarUrl,
                }
              : null,
          });

          const nextVideo = effectiveQueue[safeIndex + 1] || filterRecommendations(updatedBundle.relatedVideos, useRecommendationStore.getState())[0];
          if (nextVideo && nextVideo.id !== video.id && !nextVideo.localUri) void YouTubeService.getPlaybackStreams(nextVideo.id).catch(() => undefined);

          if (updatedBundle.subtitles && updatedBundle.subtitles.length > 0) {
            const prevLang = get().selectedSubtitle?.languageCode || preferredSubtitleLanguage;
            const matching =
              (prevLang ? updatedBundle.subtitles.find((s) => s.languageCode === prevLang) : null) ||
              updatedBundle.subtitles.find((s) => s.languageCode.startsWith('tr')) ||
              updatedBundle.subtitles.find((s) => s.languageCode.startsWith('en')) ||
              updatedBundle.subtitles[0];

            if (get().isSubtitlesEnabled && matching) {
              void get().selectSubtitle(matching);
            } else if (!get().selectedSubtitle && matching) {
              set({ selectedSubtitle: matching });
            }
          }
        });

        // Fetch sponsor segments in background without blocking stream start
        void SponsorBlockService.getSegments(video.id).then((segs) => {
          if (requestGeneration !== loadGeneration || get().currentVideo?.id !== video.id) return;
          if (segs && segs.length > 0) {
            set({ sponsorSegments: segs });
          }
        });
      }

      if (requestGeneration !== loadGeneration || get().currentVideo?.id !== video.id) return;

      if (requestedQuality !== 'Auto') {
        try {
          if (!bundle.hlsManifestUrl && !bundle.dashManifestUrl && bundle.videoStreams.some((stream) => stream.isAdaptive)) {
            const protectedSource = await NativePlayerBridge.resolveStreams(video.id, true);
            if (protectedSource?.hlsUrl || protectedSource?.dashUrl) {
              bundle.hlsManifestUrl = protectedSource.hlsUrl;
              bundle.dashManifestUrl = protectedSource.dashUrl;
              bundle.hlsManifestHeaders = protectedSource.headers;
              bundle.dashManifestHeaders = protectedSource.headers;
            }
          }
          const qualityStreams = await prepareQualityStreams(bundle);
          if (qualityStreams.length) bundle.qualityStreams = qualityStreams;
        } catch { /* Start with an available synchronized stream if the quality manifest fails. */ }
        if (requestGeneration !== loadGeneration || get().currentVideo?.id !== video.id) return;
      }

      const selected = pickFallbackStream(bundle, new Set(), requestedQuality);
      set({
        streamBundle: bundle,
        currentVideo: {
          ...video,
          title: bundle.title || video.title,
          uploaderName:
            bundle.uploaderName && bundle.uploaderName !== 'Shorts'
              ? bundle.uploaderName
              : video.uploaderName,
          uploaderAvatarUrl: bundle.uploaderAvatarUrl || video.uploaderAvatarUrl,
          uploaderId: bundle.uploaderId || video.uploaderId,
          uploaderUrl: bundle.uploaderUrl || video.uploaderUrl,
          thumbnailUrl: bundle.thumbnailUrl || video.thumbnailUrl,
          uploadDate: bundle.uploadDate || video.uploadDate,
          viewCount: bundle.viewCount || video.viewCount,
        },
        activeStreamUrl: selected.url,
        streamHeaders: selected.headers,
        loading: false,
        isPlaying: true,
        quality: selected.quality,
        duration: video.duration || get().duration,
      });

      const nextQueued = effectiveQueue[safeIndex + 1];
      if (nextQueued && !nextQueued.localUri) void YouTubeService.getPlaybackStreams(nextQueued.id).catch(() => undefined);

      // Auto-load subtitle cues if subtitles are enabled or pre-select default
      if (bundle.subtitles && bundle.subtitles.length > 0) {
        const prevLang = get().selectedSubtitle?.languageCode || preferredSubtitleLanguage;
        const matching =
          (prevLang ? bundle.subtitles.find((s) => s.languageCode === prevLang) : null) ||
          bundle.subtitles.find((s) => s.languageCode.startsWith('tr')) ||
          bundle.subtitles.find((s) => s.languageCode.startsWith('en')) ||
          bundle.subtitles[0];

        if (get().isSubtitlesEnabled && matching) {
          void get().selectSubtitle(matching);
        } else if (!get().selectedSubtitle && matching) {
          set({ selectedSubtitle: matching });
        }
      }
    } catch (error: unknown) {
      if (requestGeneration !== loadGeneration || get().currentVideo?.id !== video.id) return;
      const message = error instanceof Error ? error.message : 'Video hazırlanırken bir hata oluştu.';
      console.error('[PlayerStore] loadAndPlay failed:', error);
      set({
        loading: false,
        isBuffering: false,
        isPlaying: false,
        error: message,
      });
    }
  },

  playShorts: async (short, shortsList) => {
    if (get().isFullscreen) {
      void NativePlayerBridge.setOrientation('portrait');
      StatusBar.setHidden(false, 'fade');
      void NativePlayerBridge.setPlayerFullscreen(false).catch(() => undefined);
    }
    set({ isShortsPlayerVisible: true, isMinimized: false, isFullscreen: false });
    const queue = shortsList && shortsList.length > 0 ? shortsList : [short];
    const idx = queue.findIndex((v) => v.id === short.id);
    const safeIdx = idx >= 0 ? idx : 0;
    prefetchNextShort(queue, safeIdx);
    await get().loadAndPlay(short, queue, safeIdx);
  },

  playVideo: async (video, feedList) => {
    const isShort =
      video.streamType === 'SHORTS' ||
      video.title.toLowerCase().includes('#shorts');
    if (isShort) {
      await get().playShorts(video, feedList);
      return;
    }
    set({ isShortsPlayerVisible: false });
    if (feedList && feedList.length > 0) {
      const idx = feedList.findIndex((v) => v.id === video.id);
      const safeIdx = idx >= 0 ? idx : 0;
      await get().loadAndPlay(video, feedList, safeIdx);
    } else {
      await get().loadAndPlay(video, [video], 0);
    }
  },

  advanceToNextFallback: (failedUrl) => {
    const { streamBundle, activeStreamUrl, failedStreamUrls, quality } = get();
    if (failedUrl && activeStreamUrl !== failedUrl) return true;
    if (!streamBundle) return false;

    const nextFailed = new Set(failedStreamUrls);
    if (activeStreamUrl) nextFailed.add(activeStreamUrl);

    try {
      const nextStream = pickFallbackStream(streamBundle, nextFailed, quality);
      console.log('[PlayerStore] Advancing to stream fallback:', nextStream.quality, nextStream.format);
      set({
        failedStreamUrls: nextFailed,
        activeStreamUrl: nextStream.url,
        streamHeaders: nextStream.headers,
        quality: nextStream.quality,
        error: null,
      });
      return true;
    } catch {
      set({
        failedStreamUrls: nextFailed,
        error: 'Tüm akış formatları denendi ancak oynatılamadı.',
        isPlaying: false,
      });
      return false;
    }
  },

  handlePlaybackError: async (failedUrl, message) => {
    const state = get();
    if (state.activeStreamUrl !== failedUrl || state.loading) return true;
    void PlaybackDiagnostics.record({ videoId: state.currentVideo?.id, category: 'source-error', message, quality: state.quality, position: state.currentTime });
    const rejectedSource = /(?:403|410|expired|forbidden)/i.test(message);
    if (!rejectedSource) return get().advanceToNextFallback(failedUrl);
    const video = state.currentVideo;
    if (!video || state.streamRecoveryAttempts >= 2) {
      set({ isPlaying: false, isBuffering: false, error: 'YouTube medya bağlantısını reddetti. Videoyu yeniden açmayı deneyin.' });
      return false;
    }
    recoveryStableSince = 0;
    const generation = loadGeneration;
    const resumeAt = state.currentTime;
    const failed = new Set(state.failedStreamUrls).add(failedUrl);
    set({
      activeStreamUrl: null,
      failedStreamUrls: failed,
      streamRecoveryAttempts: state.streamRecoveryAttempts + 1,
      loading: true,
      isBuffering: true,
      error: null,
    });
    try {
      const bundle = await YouTubeService.getPlaybackStreams(video.id, { forceRefresh: true, preferProtected: true });
      if (generation !== loadGeneration || get().currentVideo?.id !== video.id) return true;
      if (state.quality !== 'Auto') { try { bundle.qualityStreams = await prepareQualityStreams(bundle); } catch { /* Manifest quality failure must not reject a playable Auto source. */ } }
      if (generation !== loadGeneration || get().currentVideo?.id !== video.id) return true;
      const selected = pickFallbackStream(bundle, new Set(), state.quality);
      set({
        streamBundle: { ...state.streamBundle, ...bundle,
          storyboards: state.streamBundle?.storyboards, chapters: state.streamBundle?.chapters,
          description: bundle.description || state.streamBundle?.description,
          uploadDate: bundle.uploadDate || state.streamBundle?.uploadDate,
          uploaderAvatarUrl: bundle.uploaderAvatarUrl || state.streamBundle?.uploaderAvatarUrl,
          uploaderSubscriberCount: bundle.uploaderSubscriberCount || state.streamBundle?.uploaderSubscriberCount,
          relatedVideos: bundle.relatedVideos.length ? bundle.relatedVideos : state.streamBundle?.relatedVideos || [],
          subtitles: bundle.subtitles.length ? bundle.subtitles : state.streamBundle?.subtitles || [],
        },
        activeStreamUrl: selected.url,
        streamHeaders: selected.headers,
        quality: selected.quality,
        currentTime: resumeAt,
        loading: false,
        isBuffering: true,
      });
      return true;
    } catch {
      if (generation !== loadGeneration || get().currentVideo?.id !== video.id) return true;
      set({ loading: false, isBuffering: false, isPlaying: false,
        error: 'YouTube medya bağlantısı yenilenemedi. Tekrar deneyin.',
      });
      return false;
    }
  },

  prepareSeek: async (position) => {
    const state = get(), generation = loadGeneration, request = ++seekGeneration;
    const target = Math.max(0, Math.min(Number.isFinite(position) ? position : 0, state.duration > 0 ? Math.max(0, state.duration - 0.25) : Infinity));
    set({ currentTime: target, streamRecoveryAttempts: 0, error: null });
    const alreadySegmented = /\.m3u8|manifest\/hls|\.mpd/.test(state.activeStreamUrl || '');
    if (!state.currentVideo || state.currentVideo.localUri || alreadySegmented || target <= state.bufferedTime + 2) return;
    set({ loading: true, isBuffering: true });
    try {
      const bundle = await YouTubeService.getPlaybackStreams(state.currentVideo.id, { preferProtected: true });
      if (state.quality !== 'Auto') { try { bundle.qualityStreams = await prepareQualityStreams(bundle); } catch { /* Keep the synchronized Auto stream usable. */ } }
      if (generation !== loadGeneration || request !== seekGeneration || get().currentVideo?.id !== state.currentVideo.id) return;
      if (bundle.hlsManifestUrl || bundle.dashManifestUrl) {
        const selected = pickFallbackStream(bundle, new Set(), state.quality);
        set({ streamBundle: { ...state.streamBundle, ...bundle, storyboards: state.streamBundle?.storyboards, chapters: state.streamBundle?.chapters, relatedVideos: state.streamBundle?.relatedVideos || [], subtitles: state.streamBundle?.subtitles || [] }, activeStreamUrl: selected.url, streamHeaders: selected.headers, quality: selected.quality, currentTime: target, failedStreamUrls: new Set(), loading: false });
      } else set({ loading: false, currentTime: target });
    } catch { if (generation === loadGeneration && request === seekGeneration) set({ loading: false, currentTime: target }); }
  },

  refreshExpiringStream: async () => {
    const state = get(), expiry = state.streamBundle?.expiresAt;
    if (!state.currentVideo || state.currentVideo.localUri || !state.activeStreamUrl || !expiry || expiry - Date.now() > 120000 || state.loading || refreshingStream || Date.now() - lastStreamRefresh < 30000) return;
    refreshingStream = true; lastStreamRefresh = Date.now();
    const generation = loadGeneration, videoId = state.currentVideo.id;
    try {
      const bundle = await YouTubeService.getPlaybackStreams(videoId, { forceRefresh: true, preferProtected: true });
      if (state.quality !== 'Auto') bundle.qualityStreams = await prepareQualityStreams(bundle);
      if (generation !== loadGeneration || get().currentVideo?.id !== videoId || get().activeStreamUrl !== state.activeStreamUrl) return;
      const selected = pickFallbackStream(bundle, new Set(), state.quality);
      set({ streamBundle: { ...state.streamBundle!, ...bundle, storyboards: state.streamBundle?.storyboards, chapters: state.streamBundle?.chapters, relatedVideos: state.streamBundle?.relatedVideos || bundle.relatedVideos, subtitles: state.streamBundle?.subtitles || bundle.subtitles }, activeStreamUrl: selected.url, streamHeaders: selected.headers, quality: selected.quality, failedStreamUrls: new Set(), streamRecoveryAttempts: 0 });
    } catch { void PlaybackDiagnostics.record({ videoId, category: 'renewal-failed', message: 'Medya bağlantısı yenilenemedi', quality: state.quality, position: get().currentTime }); }
    finally { refreshingStream = false; }
  },

  retryCurrent: async () => {
    const { currentVideo, queue, queueIndex, currentTime } = get();
    if (!currentVideo) return;
    YouTubeService.clearStreamCache(currentVideo.id);
    await get().loadAndPlay(currentVideo, queue, queueIndex, currentTime);
  },

  togglePlay: () => set({ isPlaying: !get().isPlaying }),
  setPlaying: (isPlaying) => set({ isPlaying }),

  updatePlaybackTime: (currentTime, duration) => {
    void get().refreshExpiringStream();
    const normalizedTime = Math.max(0, Number.isFinite(currentTime) ? currentTime : 0);
    const resolvedDuration = duration > 0 ? duration : get().duration;
    const currentVideo = get().currentVideo;

    const healthy = get().isPlaying && !get().loading && !get().isBuffering && normalizedTime > get().currentTime && normalizedTime - get().currentTime < 2;
    if (healthy && get().streamRecoveryAttempts > 0) {
      recoveryStableSince ||= Date.now();
      if (Date.now() - recoveryStableSince > 5000) { set({ streamRecoveryAttempts: 0 }); recoveryStableSince = 0; }
    } else if (!healthy) recoveryStableSince = 0;

    // Checkpoint persistence
    if (currentVideo?.id) {
      void CheckpointService.saveCheckpoint(currentVideo.id, normalizedTime, resolvedDuration);
    }

    // Watch history persistence (throttled every 10s)
    const now = Date.now();
    if (now - lastHistorySaveTime > 10000 && currentVideo?.id) {
      lastHistorySaveTime = now;
      void useLibraryStore.getState().addToHistory(auth?.currentUser?.uid || null, { ...currentVideo, duration: resolvedDuration || currentVideo.duration }, Math.round(normalizedTime));
    }

    const currentSponsor = get().sponsorSegments.find(
      (segment) => normalizedTime >= segment.segment[0] && normalizedTime < segment.segment[1]
    );

    set({
      currentTime: normalizedTime,
      duration: resolvedDuration,
      currentSponsorSegment: currentSponsor || null,
    });

    get().updateSubtitleForTime(normalizedTime);
  },

  setBufferedTime: (bufferedTime) => set({ bufferedTime: Math.max(0, bufferedTime) }),
  setBuffering: (isBuffering) => set({ isBuffering }),
  setError: (error) => set({ error }),

  setQuality: (quality) => {
    const { streamBundle, failedStreamUrls } = get();
    if (!streamBundle) {
      set({ quality });
      return;
    }

    try {
      const selected = pickFallbackStream(streamBundle, failedStreamUrls, quality);
      set({
        quality: selected.quality,
        activeStreamUrl: selected.url,
        streamHeaders: selected.headers,
        error: null,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Bu kalite oynatılamıyor.';
      set({ error: message });
    }
  },

  setSpeed: (speed) => set({ speed: Math.max(0.25, Math.min(4, speed)) }),
  setMinimized: (isMinimized) => {
    if (isMinimized && get().isFullscreen) {
      void NativePlayerBridge.setOrientation('portrait');
      StatusBar.setHidden(false, 'fade');
      void NativePlayerBridge.setPlayerFullscreen(false).catch(() => undefined);
      set({ isMinimized, isFullscreen: false });
      return;
    }
    set({ isMinimized });
  },

  closePlayer: () => {
    void persistCurrentWatchPosition();
    ++loadGeneration;
    ++subtitleGeneration;
    void CheckpointService.onVideoExit();
    if (get().isFullscreen) {
      void NativePlayerBridge.setOrientation('portrait');
      StatusBar.setHidden(false, 'fade');
      void NativePlayerBridge.setPlayerFullscreen(false).catch(() => undefined);
    }
    set({
      currentVideo: null,
      streamBundle: null,
      activeStreamUrl: null,
      streamHeaders: { 'User-Agent': IOS_USER_AGENT },
      failedStreamUrls: new Set<string>(),
      loading: false,
      isPlaying: false,
      isMinimized: false,
      isFullscreen: false,
      isShortsPlayerVisible: false,
      currentTime: 0,
      duration: 0,
      bufferedTime: 0,
      isBuffering: false,
      error: null,
      sponsorSegments: [],
      currentSponsorSegment: null,
      selectedSubtitle: null,
      isSubtitlesEnabled: false,
      subtitleCues: [],
      currentSubtitleText: null,
      queue: [],
      queueIndex: 0,
    });
  },

  playNext: async () => {
    const { queue, queueIndex, streamBundle } = get();
    await CheckpointService.onVideoExit();

    if (queueIndex + 1 < queue.length) {
      const nextIdx = queueIndex + 1;
      if (get().isShortsPlayerVisible) {
        prefetchNextShort(queue, nextIdx);
      }
      await get().loadAndPlay(queue[nextIdx], queue, nextIdx);
      return;
    }

    const related = filterRecommendations(streamBundle?.relatedVideos || [], useRecommendationStore.getState()).filter(v => v.id !== get().currentVideo?.id && !queue.some(q => q.id === v.id));
    if (related.length) {
      const nextRelated = related[0];
      const newQueue = [...queue, nextRelated];
      await get().loadAndPlay(nextRelated, newQueue, newQueue.length - 1);
      return;
    }

    set({ isPlaying: false });
  },

  playPrevious: async () => {
    const { queue, queueIndex, currentTime } = get();
    // If played more than 5s, seek back to beginning instead of skipping to previous video
    if (currentTime > 5) {
      set({ currentTime: 0 });
      return;
    }

    if (queueIndex <= 0) return;
    await CheckpointService.onVideoExit();
    await get().loadAndPlay(queue[queueIndex - 1], queue, queueIndex - 1);
  },

  skipCurrentSponsor: () => {
    const currentSponsorSegment = get().currentSponsorSegment;
    if (!currentSponsorSegment) return null;
    set({ currentSponsorSegment: null });
    return currentSponsorSegment.segment[1];
  },

  requestedSeekTime: null,
  requestSeek: (time: number) => {
    set({ requestedSeekTime: time });
  },
  clearRequestedSeek: () => {
    set({ requestedSeekTime: null });
  },

  toggleSubtitles: () => {
    const { isSubtitlesEnabled, selectedSubtitle, streamBundle } = get();
    if (isSubtitlesEnabled) {
      ++subtitleGeneration;
      set({ isSubtitlesEnabled: false, currentSubtitleText: null });
    } else {
      if (selectedSubtitle) {
        set({ isSubtitlesEnabled: true });
        if (get().subtitleCues.length === 0) {
          void get().selectSubtitle(selectedSubtitle);
        }
      } else if (streamBundle?.subtitles && streamBundle.subtitles.length > 0) {
        const defaultSub =
          streamBundle.subtitles.find((s) => s.languageCode.startsWith('tr')) ||
          streamBundle.subtitles.find((s) => s.languageCode.startsWith('en')) ||
          streamBundle.subtitles[0];
        void get().selectSubtitle(defaultSub);
      }
    }
  },

  selectSubtitle: async (subtitle) => {
    const request = ++subtitleGeneration;
    const generation = loadGeneration;
    if (!subtitle) {
      set({
        selectedSubtitle: null,
        isSubtitlesEnabled: false,
        subtitleCues: [],
        currentSubtitleText: null,
      });
      return;
    }
    set({ selectedSubtitle: subtitle, isSubtitlesEnabled: true, subtitleCues: [], currentSubtitleText: null });
    try {
      const cues = await YouTubeService.fetchSubtitleCues(subtitle.url);
      if (request !== subtitleGeneration || generation !== loadGeneration) return;
      set({ subtitleCues: cues });
      const currentTime = get().currentTime;
      get().updateSubtitleForTime(currentTime);
    } catch (e) {
      console.warn('[PlayerStore] Failed to load subtitle cues:', e);
    }
  },

  updateSubtitleForTime: (timeSec) => {
    const { isSubtitlesEnabled, subtitleCues, currentSubtitleText } = get();
    if (!isSubtitlesEnabled || subtitleCues.length === 0) {
      if (currentSubtitleText !== null) set({ currentSubtitleText: null });
      return;
    }
    const ms = Math.round(timeSec * 1000);
    const cue = subtitleCues.find((c) => ms >= c.startMs && ms <= c.endMs);
    const newText = cue ? cue.text : null;
    if (currentSubtitleText !== newText) {
      set({ currentSubtitleText: newText });
    }
  },

  setFullscreen: (fullscreen: boolean) => {
    if (fullscreen) {
      void NativePlayerBridge.setOrientation('landscape');
      StatusBar.setHidden(true, 'fade');
      void NativePlayerBridge.setPlayerFullscreen(true).catch(() => undefined);
    } else {
      void NativePlayerBridge.setOrientation('portrait');
      StatusBar.setHidden(false, 'fade');
      void NativePlayerBridge.setPlayerFullscreen(false).catch(() => undefined);
    }
    set({ isFullscreen: fullscreen });
  },

  toggleFullscreen: () => {
    const next = !get().isFullscreen;
    get().setFullscreen(next);
  },
}));
