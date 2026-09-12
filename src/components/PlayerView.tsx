import { SeekPreview } from './SeekPreview';
import { ActionSheet } from './common/ActionSheet';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import type { ContentType } from 'expo-video';
import { THEME } from '../constants/theme';
import { NativePlayerBridge } from '../services/nativePlayerBridge';
import { usePlayerStore } from '../store/usePlayerStore';
import { PlaybackQuality, useSettingsStore } from '../store/useSettingsStore';
import { Haptics } from '../utils/haptics';
import { prepareQualityStreams, resolutionOf } from '../services/playbackQualityService';
import { miniPlayerWidth, MINI_PLAYER_HEIGHT } from '../constants/navigationLayout';
import { createTemporaryPlaybackRate } from '../utils/temporaryPlaybackRate';
import { pinchDistance, pinchFillMode } from '../utils/pinchToFill';

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

interface PlayerViewProps {
  onMinimize: () => void;
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

export const PlayerView: React.FC<PlayerViewProps> = ({ onMinimize }) => {
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const {
    currentVideo,
    streamBundle,
    activeStreamUrl,
    streamHeaders,
    loading,
    isPlaying,
    isBuffering,
    error,
    currentTime,
    duration,
    bufferedTime,
    quality,
    speed,
    currentSponsorSegment,
    setPlaying,
    updatePlaybackTime,
    setBufferedTime,
    setBuffering,
    setError,
    setQuality,
    setSpeed,
    skipCurrentSponsor,
    retryCurrent,
    handlePlaybackError,
    isShortsPlayerVisible,
    playNext,
    playPrevious,
    requestedSeekTime,
    clearRequestedSeek,
    selectedSubtitle,
    isSubtitlesEnabled,
    currentSubtitleText,
    toggleSubtitles,
    selectSubtitle,
    isFullscreen,
    toggleFullscreen,
    isMinimized,
    setMinimized,
    closePlayer,
    togglePlay,
  } = usePlayerStore();

  const MINI_WIDTH = miniPlayerWidth(windowWidth, insets.left, insets.right);
  const MINI_HEIGHT = MINI_PLAYER_HEIGHT;

  const playerWidth = isMinimized ? MINI_WIDTH : windowWidth;
  const playerHeight = isMinimized ? MINI_HEIGHT : isFullscreen ? windowHeight : (windowWidth * 9) / 16;

  const backgroundPlayback = useSettingsStore((state) => state.backgroundPlayback);
  const sponsorBlockEnabled = useSettingsStore((state) => state.sponsorBlockEnabled);
  const skipIntros = useSettingsStore((state) => state.skipIntros);
  const skipSelfPromo = useSettingsStore((state) => state.skipSelfPromo);
  const autoPlayNext = useSettingsStore((state) => state.autoPlayNext);
  const setAutoPlayNext = useSettingsStore((state) => state.setAutoPlayNext);

  const [controlsVisible, setControlsVisible] = useState(true);
  const [isFastForwarding, setIsFastForwarding] = useState(false);
  const [fillScreen, setFillScreen] = useState(false);
  const [fitFeedback, setFitFeedback] = useState<string | null>(null);
  const fillScreenRef = useRef(false);
  const pinchStartDistanceRef = useRef(0);
  const fitFeedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const singleTapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const controlsOpacity = useRef(new Animated.Value(1)).current;


  const [showChapters, setShowChapters] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showQualityModal, setShowQualityModal] = useState(false);
  const [showSpeedModal, setShowSpeedModal] = useState(false);
  const [showSleepModal, setShowSleepModal] = useState(false);
  const [showSubtitlesModal, setShowSubtitlesModal] = useState(false);
  const optionModalVisible = showChapters || showSettingsModal || showQualityModal || showSpeedModal || showSleepModal || showSubtitlesModal;
  const [qualityLoading, setQualityLoading] = useState(false);
  const [qualityMessage, setQualityMessage] = useState<string | null>(null);
  useEffect(() => {
    Animated.timing(controlsOpacity, {
      toValue: controlsVisible && !optionModalVisible ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [controlsVisible, optionModalVisible, controlsOpacity]);
  const [isLooping, setIsLooping] = useState(false);
  const [sleepTimerMinutes, setSleepTimerMinutes] = useState<number | null>(null);

  const [seekPreviewTime, setSeekPreviewTime] = useState<number | null>(null);
  const [isScrubbing, setIsScrubbing] = useState(false);

  const availableSubtitles = streamBundle?.subtitles || [];

  const videoViewRef = useRef<VideoView | null>(null);
  const sourceRevisionRef = useRef(0);
  const replacementQueueRef = useRef<Promise<void>>(Promise.resolve());
  const replacingSourceRef = useRef(false);
  const engineSourceRef = useRef<string | null>(null);
  const handledErrorRef = useRef<string | null>(null);
  const streamHeaderKey = JSON.stringify(streamHeaders);
  const lastAutoSkippedSponsorRef = useRef<string | null>(null);
  const sleepTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSeekOffsetRef = useRef(0);
  const seekThrottleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSeekingRef = useRef(false);
  const isScrubbingRef = useRef(false);
  const seekbarLayoutRef = useRef<{ x: number; width: number }>({ x: 0, width: 0 });

  const availableQualities = useMemo<PlaybackQuality[]>(() => {
    const heights = new Set(
      [...(streamBundle?.qualityStreams || []), ...(streamBundle?.videoStreams || []).filter((stream) => !stream.isAdaptive && stream.format !== 'hls')]
        .map(resolutionOf).filter(Boolean)
    );
    return ['Auto', ...[...heights].sort((a, b) => b - a).map((height) => `${height}p` as PlaybackQuality)];
  }, [streamBundle]);

  useEffect(() => {
    if (!showQualityModal || !streamBundle || streamBundle.qualityStreams !== undefined) {
      setQualityLoading(false);
      if (streamBundle?.qualityStreams !== undefined) setQualityMessage(null);
      return;
    }
    let cancelled = false;
    const original = streamBundle;
    setQualityLoading(true);
    setQualityMessage(null);
    const load = async () => {
      let bundle = original;
      let streams;
      try {
        streams = await prepareQualityStreams(bundle);
        if (!streams.length && bundle.videoStreams.some((stream) => stream.isAdaptive)) throw new Error('Uyarlanabilir kalite kaynağı gerekli.');
      } catch {
        const native = await NativePlayerBridge.resolveStreams(original.videoId, true);
        if (!native?.hlsUrl && !native?.dashUrl) throw new Error('Diğer kaliteler şu anda alınamadı. Paneli tekrar açarak deneyebilirsiniz.');
        bundle = { ...original, hlsManifestUrl: native.hlsUrl, dashManifestUrl: native.dashUrl,
          hlsManifestHeaders: native.headers, dashManifestHeaders: native.headers };
        streams = await prepareQualityStreams(bundle);
      }
      if (cancelled || usePlayerStore.getState().streamBundle !== original) return;
      usePlayerStore.setState({ streamBundle: { ...bundle, qualityStreams: streams } });
    };
    void load().catch((err) => {
      if (!cancelled) setQualityMessage(err instanceof Error ? err.message : 'Kaliteler alınamadı.');
    }).finally(() => { if (!cancelled) setQualityLoading(false); });
    return () => { cancelled = true; };
  }, [showQualityModal, streamBundle]);

  const player = useVideoPlayer(null, (instance) => {
    instance.loop = false;
    instance.preservesPitch = true;
    instance.timeUpdateEventInterval = 0.25;
    instance.bufferOptions = {
      preferredForwardBufferDuration: 24,
      minBufferForPlayback: 1.25,
      maxBufferBytes: 0,
      prioritizeTimeOverSizeThreshold: true,
      waitsToMinimizeStalling: true,
    };
  });

  useEffect(() => {
    player.staysActiveInBackground = backgroundPlayback;
    player.showNowPlayingNotification = backgroundPlayback;
  }, [backgroundPlayback, player]);

  const seekCommitRevision = useRef(0);
  const lastEngineErrorRef = useRef('');
  const temporaryRate = useMemo(() => createTemporaryPlaybackRate(player, () => usePlayerStore.getState().speed), [player]);

  useEffect(() => {
    player.playbackRate = temporaryRate.isActive ? 2 : speed;
  }, [player, speed, temporaryRate]);

  useEffect(() => {
    temporaryRate.end();
    setIsFastForwarding(false);
    return () => { try { temporaryRate.end(); } catch { /* Native player may already be released. */ } };
  }, [currentVideo?.id, isMinimized, isPlaying, isShortsPlayerVisible, optionModalVisible, temporaryRate]);

  useEffect(() => {
    return () => {
      if (fitFeedbackTimeoutRef.current) clearTimeout(fitFeedbackTimeoutRef.current);
      if (singleTapTimeoutRef.current) clearTimeout(singleTapTimeoutRef.current);
      if (sleepTimeoutRef.current) clearTimeout(sleepTimeoutRef.current);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      if (seekThrottleTimeoutRef.current) clearTimeout(seekThrottleTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    const revision = ++sourceRevisionRef.current;
    lastAutoSkippedSponsorRef.current = null;
    handledErrorRef.current = null;
    replacingSourceRef.current = true;
    engineSourceRef.current = null;
    player.pause();
    const uri = isShortsPlayerVisible ? null : activeStreamUrl;
    const resumeAt = Math.max(0, usePlayerStore.getState().currentTime || 0);
    if (uri) {
      setError(null);
      setBuffering(true);
    }
    // Serialize native replacements so an older request cannot replace a newer source.
    const replacement = replacementQueueRef.current.catch(() => undefined).then(async () => {
      if (revision !== sourceRevisionRef.current) return;
      if (!uri) {
        await player.replaceAsync(null);
        return;
      }
      const isHls = /\.m3u8|manifest\/hls|hls_variant|hls_playlist/.test(uri);
      const contentType: ContentType = isHls ? 'hls' : uri.includes('.mpd') ? 'dash' : 'progressive';
      await player.replaceAsync({
        uri,
        headers: JSON.parse(streamHeaderKey),
        contentType,
        metadata: currentVideo ? {
          title: currentVideo.title, artist: currentVideo.uploaderName, artwork: currentVideo.thumbnailUrl,
        } : undefined,
      });
      if (revision !== sourceRevisionRef.current || usePlayerStore.getState().activeStreamUrl !== uri) return;
      engineSourceRef.current = uri;
      replacingSourceRef.current = false;
      if (resumeAt > 0 && Number.isFinite(resumeAt)) player.currentTime = resumeAt;
      player.playbackRate = temporaryRate.isActive ? 2 : usePlayerStore.getState().speed;
      player.muted = false;
      player.volume = 1;
      setBuffering(false);
      if (usePlayerStore.getState().isPlaying) player.play();
      else player.pause();
    }).catch(async (replaceError: unknown) => {
      if (!uri || revision !== sourceRevisionRef.current || handledErrorRef.current === uri) return;
      handledErrorRef.current = uri;
      const message = replaceError instanceof Error ? replaceError.message
        : (replaceError as { message?: string })?.message || 'Medya kaynağı açılamadı.';
      await handlePlaybackError(uri, message);
    }).finally(() => {
      if (revision === sourceRevisionRef.current) replacingSourceRef.current = false;
    });
    replacementQueueRef.current = replacement;
    return () => { sourceRevisionRef.current++; replacingSourceRef.current = true; };
  }, [activeStreamUrl, currentVideo?.id, player, setBuffering, setError, streamHeaderKey, handlePlaybackError, isShortsPlayerVisible]);

  useEffect(() => {
    if (!activeStreamUrl || isShortsPlayerVisible || replacingSourceRef.current) return;
    if (isPlaying) player.play();
    else player.pause();
  }, [activeStreamUrl, isPlaying, player, isShortsPlayerVisible]);

  useEffect(() => {
    const isCurrentSource = () => {
      const state = usePlayerStore.getState();
      return !state.isShortsPlayerVisible && !!state.activeStreamUrl && engineSourceRef.current === state.activeStreamUrl;
    };
    const sourceSub = player.addListener('sourceChange', ({ source }) => {
      engineSourceRef.current = typeof source === 'string' ? source
        : source && typeof source === 'object' ? source.uri || null : null;
    });
    const timeSub = player.addListener('timeUpdate', ({ currentTime: nativeTime }) => {
      if (!isCurrentSource() || replacingSourceRef.current) return;
      updatePlaybackTime(nativeTime, player.duration || 0);
      const buffered = player.bufferedPosition;
      if (buffered > 0) setBufferedTime(buffered);
    });
    const statusSub = player.addListener('statusChange', ({ status, error: playerError }) => {
      if (!isCurrentSource()) return;
      setBuffering(status === 'loading');
      if (status === 'readyToPlay' && !replacingSourceRef.current) {
        if (usePlayerStore.getState().isPlaying) player.play();
        else player.pause();
      }
      if (status === 'error') {
        const uri = engineSourceRef.current!;
        lastEngineErrorRef.current = playerError?.message || 'Oynatma hatası';
        if (handledErrorRef.current === uri) return;
        handledErrorRef.current = uri;
        void handlePlaybackError(uri, playerError?.message || 'Oynatma motoru videoyu açamadı.');
      }
    });
    const playingSub = player.addListener('playingChange', ({ isPlaying: nativePlaying }) => {
      if (!isCurrentSource() || replacingSourceRef.current || isSeekingRef.current || player.status !== 'readyToPlay') return;
      if (usePlayerStore.getState().isPlaying !== nativePlaying) setPlaying(nativePlaying);
    });
    const endSub = player.addListener('playToEnd', () => {
      if (!isCurrentSource() || replacingSourceRef.current) return;
      const store = usePlayerStore.getState();
      if (useSettingsStore.getState().autoPlayNext) void store.playNext();
      else store.setPlaying(false);
    });
    return () => {
      sourceSub.remove(); timeSub.remove(); statusSub.remove(); playingSub.remove(); endSub.remove();
    };
  }, [player, setBufferedTime, setBuffering, setPlaying, updatePlaybackTime, handlePlaybackError]);

  const commitSeek = async (target: number) => {
    const revision = ++seekCommitRevision.current;
    const videoId = usePlayerStore.getState().currentVideo?.id;
    isSeekingRef.current = true;
    setSeekPreviewTime(target);
    await usePlayerStore.getState().prepareSeek(target);
    if (revision !== seekCommitRevision.current || usePlayerStore.getState().currentVideo?.id !== videoId) return;
    const state = usePlayerStore.getState();
    setSeekPreviewTime(null);
    if (engineSourceRef.current === state.activeStreamUrl && !replacingSourceRef.current) {
      handledErrorRef.current = null;
      if (player.status === 'error' && state.activeStreamUrl) {
        await state.handlePlaybackError(state.activeStreamUrl, lastEngineErrorRef.current || '403');
      } else {
        player.currentTime = state.currentTime;
        if (state.isPlaying) player.play();
      }
    }
    setTimeout(() => { if (revision === seekCommitRevision.current) isSeekingRef.current = false; }, 350);
  };

  useEffect(() => {
    seekCommitRevision.current++;
    isSeekingRef.current = false;
    isScrubbingRef.current = false;
    setIsScrubbing(false); setSeekPreviewTime(null);
    if (seekThrottleTimeoutRef.current) clearTimeout(seekThrottleTimeoutRef.current);
  }, [currentVideo?.id]);

  useEffect(() => {
    const segment = currentSponsorSegment;
    if (!segment || !sponsorBlockEnabled || segment.actionType !== 'skip') return;
    if (lastAutoSkippedSponsorRef.current === segment.uuid) return;

    const shouldSkip =
      segment.category === 'sponsor' ||
      ((segment.category === 'intro' || segment.category === 'outro') && skipIntros) ||
      ((segment.category === 'selfpromo' || segment.category === 'interaction') && skipSelfPromo);

    if (!shouldSkip) return;
    lastAutoSkippedSponsorRef.current = segment.uuid;
    player.currentTime = segment.segment[1];
    updatePlaybackTime(segment.segment[1], duration);
  }, [
    currentSponsorSegment,
    duration,
    player,
    skipIntros,
    skipSelfPromo,
    sponsorBlockEnabled,
    updatePlaybackTime,
  ]);

  useEffect(() => {
    if (requestedSeekTime !== null) {
      void commitSeek(requestedSeekTime);
      clearRequestedSeek();
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      setControlsVisible(false);
      if (usePlayerStore.getState().isPlaying && !player.playing) {
        player.play();
      }
    }
  }, [requestedSeekTime, player, duration, updatePlaybackTime, clearRequestedSeek]);

  const resetControlsTimeout = () => {
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    setControlsVisible(true);
    controlsTimeoutRef.current = setTimeout(() => setControlsVisible(false), 3500);
  };

  const safeSeekBy = (deltaSeconds: number) => {
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    setControlsVisible(false);
    const currentBase = seekPreviewTime ?? (player.currentTime || currentTime);
    const target = Math.max(0, Math.min(duration || Infinity, currentBase + deltaSeconds));
    setSeekPreviewTime(target);

    if (seekThrottleTimeoutRef.current) clearTimeout(seekThrottleTimeoutRef.current);
    seekThrottleTimeoutRef.current = setTimeout(() => { void commitSeek(target); }, 150);
  };

  useEffect(() => {
    if (optionModalVisible || isMinimized || !isPlaying) {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      if (!isPlaying) setControlsVisible(true);
      return;
    }
    resetControlsTimeout();
    return () => { if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current); };
  }, [currentVideo?.id, optionModalVisible, isMinimized, isPlaying, isFullscreen]);

  const calculateScrubTarget = (pageX: number) => {
    const state = usePlayerStore.getState();
    const totalDuration = state.duration || state.currentVideo?.duration || 0;
    const { x, width } = seekbarLayoutRef.current;
    const ratio = Math.max(0, Math.min(1, (pageX - x) / Math.max(1, width)));
    return ratio * totalDuration;
  };

  const panResponderSeek = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (evt) => {
        isScrubbingRef.current = true;
        setIsScrubbing(true);
        setControlsVisible(true);
        Haptics.selection();
        if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
        const target = calculateScrubTarget(evt.nativeEvent.pageX);
        setSeekPreviewTime(target);
      },
      onPanResponderMove: (evt) => {
        if (!isScrubbingRef.current) return;
        const target = calculateScrubTarget(evt.nativeEvent.pageX);
        setSeekPreviewTime(target);
      },
      onPanResponderRelease: (evt) => {
        if (!isScrubbingRef.current) return;
        isScrubbingRef.current = false;
        setIsScrubbing(false);
        Haptics.selection();
        const state = usePlayerStore.getState();
        const totalDuration = state.duration || state.currentVideo?.duration || 0;
        const target = calculateScrubTarget(evt.nativeEvent.pageX);

        void commitSeek(target);

        if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
        controlsTimeoutRef.current = setTimeout(() => {
          setControlsVisible(false);
        }, 2500);
      },
      onPanResponderTerminate: () => {
        isScrubbingRef.current = false;
        setIsScrubbing(false);
        setSeekPreviewTime(null);
        resetControlsTimeout();
      },
    })
  ).current;

  const seekTo = (x: number, commit: boolean) => {
    const totalDuration = duration > 0 ? duration : (currentVideo?.duration || 0);
    if (totalDuration <= 0) return;
    const ratio = Math.max(0, Math.min(1, x / playerWidth));
    const target = ratio * totalDuration;
    setSeekPreviewTime(target);
    if (commit) { void commitSeek(target); if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current); setControlsVisible(false); }
  };

  const startSleepTimer = (minutes: number | null) => {
    if (sleepTimeoutRef.current) clearTimeout(sleepTimeoutRef.current);
    setSleepTimerMinutes(minutes);
    if (minutes) {
      sleepTimeoutRef.current = setTimeout(() => {
        usePlayerStore.getState().setPlaying(false);
        setSleepTimerMinutes(null);
      }, minutes * 60 * 1000);
    }
    setShowSleepModal(false);
  };

  const enterPictureInPicture = async () => {
    try {
      await videoViewRef.current?.startPictureInPicture();
    } catch (pipError: unknown) {
      const message = pipError instanceof Error ? pipError.message : 'PiP modu başlatılamadı.';
      setError(message);
    }
  };

  const [doubleTapSide, setDoubleTapSide] = useState<'left' | 'right' | null>(null);
  const lastTapRef = useRef<{ time: number; x: number }>({ time: 0, x: 0 });
  const doubleTapOpacity = useRef(new Animated.Value(0)).current;
  const doubleTapScale = useRef(new Animated.Value(0.8)).current;

  const beginHoldToSpeed = () => {
    if (!isPlaying || loading || error || !activeStreamUrl) return;
    if (singleTapTimeoutRef.current) clearTimeout(singleTapTimeoutRef.current);
    lastTapRef.current = { time: 0, x: 0 };
    if (temporaryRate.begin()) {
      Haptics.selection();
      setIsFastForwarding(true);
      setControlsVisible(false);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    }
  };
  const endHoldToSpeed = () => {
    if (temporaryRate.end()) {
      setIsFastForwarding(false);
      lastTapRef.current = { time: 0, x: 0 };
    }
  };

  useEffect(() => {
    fillScreenRef.current = false;
    setFillScreen(false);
    setFitFeedback(null);
    pinchStartDistanceRef.current = 0;
    if (fitFeedbackTimeoutRef.current) clearTimeout(fitFeedbackTimeoutRef.current);
  }, [currentVideo?.id, isFullscreen]);

  const pinchContextRef = useRef({ enabled: false, cancelHold: endHoldToSpeed });
  pinchContextRef.current = {
    enabled: isFullscreen && !isMinimized && !optionModalVisible && Boolean(activeStreamUrl),
    cancelHold: endHoldToSpeed,
  };
  const pinchPanResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponderCapture: (event) => pinchContextRef.current.enabled && event.nativeEvent.touches.length >= 2,
    onMoveShouldSetPanResponderCapture: (event) => pinchContextRef.current.enabled && event.nativeEvent.touches.length >= 2,
    onPanResponderGrant: (event) => {
      pinchContextRef.current.cancelHold();
      if (singleTapTimeoutRef.current) clearTimeout(singleTapTimeoutRef.current);
      lastTapRef.current = { time: 0, x: 0 };
      pinchStartDistanceRef.current = pinchDistance(event.nativeEvent.touches);
    },
    onPanResponderMove: (event) => {
      if (!pinchContextRef.current.enabled) return;
      const distance = pinchDistance(event.nativeEvent.touches);
      if (!distance || !pinchStartDistanceRef.current) return;
      const next = pinchFillMode(distance / pinchStartDistanceRef.current, fillScreenRef.current);
      if (next === fillScreenRef.current) return;
      fillScreenRef.current = next;
      setFillScreen(next);
      setFitFeedback(next ? 'Ekran dolduruldu' : 'Orijinal boyut');
      Haptics.selection();
      if (fitFeedbackTimeoutRef.current) clearTimeout(fitFeedbackTimeoutRef.current);
      fitFeedbackTimeoutRef.current = setTimeout(() => setFitFeedback(null), 1000);
    },
    onPanResponderRelease: () => { pinchStartDistanceRef.current = 0; },
    onPanResponderTerminate: () => { pinchStartDistanceRef.current = 0; },
    onPanResponderTerminationRequest: () => false,
  })).current;

  const handleScreenTap = (event: any) => {
    if (temporaryRate.isActive) return;
    const now = Date.now();
    const x = event.nativeEvent.locationX;
    const isRightSide = x > playerWidth / 2;
    const sameSide =
      (isRightSide && lastTapRef.current.x > playerWidth / 2) ||
      (!isRightSide && lastTapRef.current.x <= playerWidth / 2);

    if (now - lastTapRef.current.time < 320 && sameSide) {
      if (singleTapTimeoutRef.current) clearTimeout(singleTapTimeoutRef.current);
      // Double Tap!
      const side = isRightSide ? 'right' : 'left';
      setDoubleTapSide(side);
      safeSeekBy(isRightSide ? 10 : -10);

      doubleTapOpacity.setValue(1);
      doubleTapScale.setValue(0.8);
      Animated.parallel([
        Animated.spring(doubleTapScale, { toValue: 1.1, friction: 6, useNativeDriver: true }),
        Animated.timing(doubleTapOpacity, {
          toValue: 0,
          duration: 650,
          delay: 200,
          useNativeDriver: true,
        }),
      ]).start(() => setDoubleTapSide(null));

      lastTapRef.current = { time: 0, x: 0 };
      return;
    }

    lastTapRef.current = { time: now, x };
    if (singleTapTimeoutRef.current) clearTimeout(singleTapTimeoutRef.current);
    singleTapTimeoutRef.current = setTimeout(() => {
      if (Date.now() - lastTapRef.current.time >= 300 && lastTapRef.current.time !== 0) {
        if (controlsVisible) {
          setControlsVisible(false);
        } else {
          resetControlsTimeout();
        }
      }
    }, 310);
  };

  const effectiveDuration = duration > 0 ? duration : (currentVideo?.duration || 0);
  const visibleTime = seekPreviewTime ?? currentTime;
  const progress =
    effectiveDuration > 0 ? Math.min(100, Math.max(0, (visibleTime / effectiveDuration) * 100)) : 0;
  const bufferedProgress =
    effectiveDuration > 0 ? Math.min(100, Math.max(0, (bufferedTime / effectiveDuration) * 100)) : 0;

  return (
    <View style={[styles.container, isMinimized && styles.miniContainer, { width: playerWidth, height: playerHeight }]} {...pinchPanResponder.panHandlers}>
      {activeStreamUrl ? (
        <VideoView
          ref={videoViewRef}
          style={[styles.videoView, isMinimized && styles.miniVideo]}
          player={player}
          nativeControls={false}
          contentFit={isMinimized || (isFullscreen && fillScreen) ? 'cover' : 'contain'}
          allowsPictureInPicture
        />
      ) : (
        <View style={[styles.loadingContainer, isMinimized && styles.miniVideo]}>
          {currentVideo?.thumbnailUrl ? (
            <Image
              source={{ uri: currentVideo.thumbnailUrl }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
            />
          ) : null}
          <View style={styles.loadingBackdrop} />
          <ActivityIndicator size="small" color="#FFFFFF" />
        </View>
      )}

      {activeStreamUrl && (loading || isBuffering) && !error ? (
        <View pointerEvents="none" style={[styles.bufferingOverlay, isMinimized && styles.miniVideo]}>
          <ActivityIndicator size="large" color="#FFFFFF" />
        </View>
      ) : null}

      {error ? (
        <View style={styles.errorOverlay}>
          <Ionicons name="warning-outline" size={32} color="#FFFFFF" />
          <Text style={styles.errorTitle}>Video oynatılamadı</Text>
          <Text style={styles.errorText} numberOfLines={3}>
            {error}
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => void retryCurrent()}>
            <Ionicons name="refresh" size={17} color="#FFFFFF" />
            <Text style={styles.retryText}>Tekrar dene</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {isMinimized ? (
        <View style={StyleSheet.absoluteFill}>
          <TouchableOpacity
            style={styles.miniExpand}
            activeOpacity={0.85}
            accessibilityLabel="Oynatıcıyı aç"
            onPress={() => { Haptics.selection(); setMinimized(false); }}
          >
            <View style={styles.miniMetadata}>
              <Text style={styles.miniTitle} numberOfLines={1}>{currentVideo?.title}</Text>
              <Text style={styles.miniChannel} numberOfLines={1}>{currentVideo?.uploaderName}</Text>
            </View>
          </TouchableOpacity>
          <View style={styles.miniControlsRow}>
            <TouchableOpacity style={styles.miniCircleBtn} accessibilityLabel={isPlaying ? 'Duraklat' : 'Oynat'} onPress={togglePlay}>
              <Ionicons name={isPlaying ? 'pause' : 'play'} size={25} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.miniCircleBtn} accessibilityLabel="Oynatıcıyı kapat" onPress={closePlayer}>
              <Ionicons name="close" size={23} color="#B5B5BD" />
            </TouchableOpacity>
          </View>
          <View pointerEvents="none" style={styles.miniProgressBar}>
            <View style={[styles.miniProgressFill, { width: `${progress}%` }]} />
          </View>
        </View>
      ) : (
        <>
          {fitFeedback && (
            <View pointerEvents="none" style={[styles.fastForwardBadge, { top: Math.max(insets.top, 16) }]}>
              <Ionicons name={fillScreen ? 'expand-outline' : 'contract-outline'} size={15} color="#FFFFFF" />
              <Text style={styles.fastForwardText}>{fitFeedback}</Text>
            </View>
          )}
          {isFastForwarding && (
            <View pointerEvents="none" style={[styles.fastForwardBadge, { top: isFullscreen ? Math.max(insets.top, 16) : 12 }]}>
              <Ionicons name="play-forward" size={15} color="#FFFFFF" />
              <Text style={styles.fastForwardText}>2× hız</Text>
            </View>
          )}
          {/* Double Tap Seek Feedback Overlay */}
          {doubleTapSide && (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.doubleTapOverlay,
                doubleTapSide === 'left' ? styles.doubleTapLeft : styles.doubleTapRight,
                {
                  opacity: doubleTapOpacity,
                  transform: [{ scale: doubleTapScale }],
                },
              ]}
            >
              <Ionicons
                name={doubleTapSide === 'left' ? 'play-back' : 'play-forward'}
                size={36}
                color="#FFFFFF"
              />
              <Text style={styles.doubleTapText}>
                {doubleTapSide === 'left' ? '-10 sn' : '+10 sn'}
              </Text>
            </Animated.View>
          )}

          {/* Touch Overlay for controls and gestures */}
          <TouchableOpacity
            style={styles.touchOverlay}
            activeOpacity={1}
            onPress={handleScreenTap}
            onLongPress={beginHoldToSpeed}
            onPressOut={endHoldToSpeed}
            delayLongPress={250}
          >
            {!error && (
              <Animated.View
                pointerEvents={controlsVisible && !optionModalVisible ? 'auto' : 'none'}
                style={[
                  styles.controlsLayer,
                  {
                    opacity: controlsOpacity,
                  },
                ]}
              >
                <View
                  style={[
                    styles.topBar,
                    isFullscreen && {
                      paddingHorizontal: Math.max(insets.left, insets.right, 20),
                      paddingTop: Math.max(insets.top, 8),
                    },
                  ]}
                >
                  <TouchableOpacity
                    style={styles.roundIconButton}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    onPress={() => {
                      Haptics.selection();
                      if (isFullscreen) {
                        toggleFullscreen();
                      } else {
                        onMinimize();
                      }
                    }}
                  >
                    <Ionicons name={isFullscreen ? "arrow-back" : "chevron-down"} size={24} color="#FFFFFF" />
                  </TouchableOpacity>

                  <View style={styles.topRightActions}>
                    {/* YouTube Mobile Autoplay Switch */}
                    <TouchableOpacity
                      style={[
                        styles.autoplaySwitch,
                        autoPlayNext ? styles.autoplaySwitchActive : styles.autoplaySwitchInactive,
                      ]}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      activeOpacity={0.8}
                      onPress={() => {
                        Haptics.selection();
                        setAutoPlayNext(!autoPlayNext);
                      }}
                    >
                      <View
                        style={[
                          styles.autoplayThumb,
                          autoPlayNext ? styles.autoplayThumbActive : styles.autoplayThumbInactive,
                        ]}
                      >
                        <Ionicons
                          name={autoPlayNext ? 'play' : 'pause'}
                          size={9}
                          color={autoPlayNext ? '#000000' : 'rgba(255, 255, 255, 0.7)'}
                        />
                      </View>
                    </TouchableOpacity>

                    {/* Cast Icon */}
                    <TouchableOpacity
                      style={styles.roundIconButton}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      onPress={() => {
                        Haptics.selection();
                        alert('Yayınlanacak cihaz aranıyor...');
                      }}
                    >
                      <Ionicons name="tv-outline" size={18} color="rgba(255, 255, 255, 0.9)" />
                    </TouchableOpacity>

                    {/* Subtitles / CC Icon */}
                    <TouchableOpacity
                      style={[
                        styles.roundIconButton,
                        isSubtitlesEnabled && styles.activeCcButton,
                      ]}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      onPress={() => {
                        Haptics.selection();
                        if (!availableSubtitles || availableSubtitles.length === 0) {
                          alert('Bu video için altyazı bulunmuyor.');
                          return;
                        }
                        toggleSubtitles();
                      }}
                    >
                      <MaterialIcons
                        name={isSubtitlesEnabled ? 'closed-caption' : 'closed-caption-off'}
                        size={20}
                        color={isSubtitlesEnabled ? '#FFFFFF' : 'rgba(255, 255, 255, 0.9)'}
                      />
                    </TouchableOpacity>

                    {/* Settings Gear */}
                    <TouchableOpacity
                      style={styles.roundIconButton}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      onPress={() => {
                        Haptics.selection();
                        setShowSettingsModal(true);
                      }}
                    >
                      <Ionicons name="settings-outline" size={19} color="rgba(255, 255, 255, 0.9)" />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* YouTube Center Controls: Previous / Big Play-Pause / Next */}
                <View style={styles.centerControls}>
                  <TouchableOpacity
                    style={styles.navSkipBtn}
                    activeOpacity={0.7}
                    onPress={() => {
                      Haptics.selection();
                      resetControlsTimeout();
                      void playPrevious();
                    }}
                    hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
                  >
                    <Ionicons name="play-skip-back-sharp" size={28} color="#FFFFFF" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.playPauseButton}
                    activeOpacity={0.8}
                    onPress={() => {
                      Haptics.selection();
                      setPlaying(!isPlaying);
                      resetControlsTimeout();
                    }}
                  >
                    <Ionicons
                      name={isPlaying ? 'pause' : 'play'}
                      size={36}
                      color="#FFFFFF"
                      style={{ marginLeft: isPlaying ? 0 : 3 }}
                    />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.navSkipBtn}
                    activeOpacity={0.7}
                    onPress={() => {
                      Haptics.selection();
                      resetControlsTimeout();
                      void playNext();
                    }}
                    hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
                  >
                    <Ionicons name="play-skip-forward-sharp" size={28} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>

                {/* Bottom Controls: Time badge + Fullscreen button */}
                <View style={styles.bottomSection}>
                  <View
                    style={[
                      styles.bottomBar,
                      isFullscreen && {
                        paddingHorizontal: Math.max(insets.left, insets.right, 20),
                        marginBottom: (insets.bottom > 0 ? insets.bottom + 22 : 28) + 26,
                      },
                    ]}
                  >
                    <View style={styles.timeBadge}>
                      <Text style={styles.timeBadgeText}>
                        {formatTime(visibleTime)} / {formatTime(effectiveDuration)}
                      </Text>
                    </View>

                    <TouchableOpacity
                      style={styles.fullscreenBtn}
                      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                      onPress={() => {
                        Haptics.selection();
                        toggleFullscreen();
                      }}
                    >
                      <Ionicons name={isFullscreen ? "contract-outline" : "scan-outline"} size={20} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                </View>
              </Animated.View>
            )}

            {currentSponsorSegment && !sponsorBlockEnabled ? (
              <TouchableOpacity
                style={styles.sponsorBanner}
                onPress={() => {
                  const target = skipCurrentSponsor();
                  if (target !== null) player.currentTime = target;
                }}
              >
                <Ionicons name="play-skip-forward" size={16} color="#FFFFFF" />
                <Text style={styles.sponsorText}>Bu bölümü atla</Text>
              </TouchableOpacity>
            ) : null}

            {/* Real-time Subtitle Display Overlay */}
            {isSubtitlesEnabled && currentSubtitleText ? (
              <View
                pointerEvents="none"
                style={[
                  styles.subtitleContainer,
                  controlsVisible ? styles.subtitleContainerWithControls : styles.subtitleContainerNoControls,
                ]}
              >
                <View style={styles.subtitlePill}>
                  <Text style={styles.subtitleText}>{currentSubtitleText}</Text>
                </View>
              </View>
            ) : null}
          </TouchableOpacity>

          {/* Fullscreen progress fades with the controls. */}
          {!error && effectiveDuration > 0 && (
            <Animated.View
              pointerEvents={optionModalVisible || (isFullscreen && !controlsVisible && !isScrubbing) ? 'none' : 'auto'}
              style={[
                styles.seekbarContainer,
                { opacity: isFullscreen || optionModalVisible ? controlsOpacity : 1 },
                isFullscreen && {
                  bottom: insets.bottom > 0 ? insets.bottom + 22 : 28,
                  left: Math.max(insets.left, insets.right, 20),
                  right: Math.max(insets.left, insets.right, 20),
                },
              ]}
              onLayout={(e) => {
                const layout = e.nativeEvent.layout;
                const defaultX = isFullscreen ? Math.max(insets.left, insets.right, 20) : 0;
                if (layout.width > 0) {
                  seekbarLayoutRef.current = { x: defaultX, width: layout.width };
                }
                e.currentTarget?.measure?.((x, y, width, height, pageX, pageY) => {
                  if (width > 0) {
                    seekbarLayoutRef.current = { x: pageX, width };
                  }
                });
              }}
              {...panResponderSeek.panHandlers}
            >
              {!!streamBundle?.chapters?.length && controlsVisible && <TouchableOpacity onPress={() => setShowChapters(true)} style={{ position: 'absolute', bottom: 20, right: 0, padding: 8 }}><Text numberOfLines={1} style={{ color: 'white', maxWidth: 160, fontSize: 11 }}>☷ Bölümler</Text></TouchableOpacity>}
              {/* Floating Time Tooltip dynamically following thumb while scrubbing */}
              {isScrubbing && seekPreviewTime !== null && (
                <View
                  style={[
                    styles.previewTooltip,
                    {
                      left: `${Math.min(100 - 72 / Math.max(144, seekbarLayoutRef.current.width) * 100, Math.max(72 / Math.max(144, seekbarLayoutRef.current.width) * 100, progress))}%`,
                      transform: [{ translateX: -72 }],
                      bottom: 30, paddingHorizontal: 0, paddingVertical: 0, backgroundColor: 'transparent',
                    },
                  ]}
                  pointerEvents="none"
                >
                  <SeekPreview boards={streamBundle?.storyboards || []} chapters={streamBundle?.chapters || []} seconds={seekPreviewTime} label={formatTime(seekPreviewTime)} />
                </View>
              )}

              <View pointerEvents="none" style={[styles.seekbarTrack, isScrubbing && styles.seekbarTrackScrubbing]}>
                <View style={[styles.bufferedFill, { width: `${bufferedProgress}%` }]} />
                <View style={[styles.seekbarFill, { width: `${progress}%` }]} />
                {(streamBundle?.chapters || []).filter(c => c.startTime > 0).map(c => <View key={c.startTime} style={{ position: 'absolute', left: `${Math.min(100, c.startTime / Math.max(1, effectiveDuration) * 100)}%`, width: 3, height: '100%', backgroundColor: '#000' }} />)}
                <View
                  style={[
                    styles.seekbarThumb,
                    { left: `${progress}%` },
                    !controlsVisible && !isScrubbing && styles.seekbarThumbMini,
                    isScrubbing && styles.seekbarThumbScrubbing,
                  ]}
                />
              </View>
            </Animated.View>
          )}

          {/* YouTube Mobile Style: Unified Settings Modal */}
          <ActionSheet visible={showChapters} title="Video bölümleri" onClose={() => setShowChapters(false)} options={(streamBundle?.chapters || []).map(c => ({ id: String(c.startTime), title: c.title, subtitle: formatTime(c.startTime), icon: 'play-outline', onPress: () => { void commitSeek(c.startTime); } }))} />
      <OptionModal
            visible={showSettingsModal}
            title="Ayarlar"
            subtitle={currentVideo?.title || undefined}
            onClose={() => setShowSettingsModal(false)}
          >
            <TouchableOpacity
              style={styles.settingsRow}
              activeOpacity={0.7}
              onPress={() => {
                setShowSettingsModal(false);
                setShowQualityModal(true);
              }}
            >
              <View style={styles.settingsRowLeft}>
                <Ionicons name="options-outline" size={22} color="#FFFFFF" />
                <View style={styles.settingsRowTexts}>
                  <Text style={styles.settingsRowTitle}>Kalite</Text>
                  <Text style={styles.settingsRowValue}>
                    {quality === 'Auto' ? 'Otomatik (Önerilen)' : quality}
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.4)" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.settingsRow}
              activeOpacity={0.7}
              onPress={() => {
                setShowSettingsModal(false);
                setShowSpeedModal(true);
              }}
            >
              <View style={styles.settingsRowLeft}>
                <Ionicons name="speedometer-outline" size={22} color="#FFFFFF" />
                <View style={styles.settingsRowTexts}>
                  <Text style={styles.settingsRowTitle}>Oynatma Hızı</Text>
                  <Text style={styles.settingsRowValue}>
                    {speed === 1 ? 'Normal' : `${speed}x`}
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.4)" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.settingsRow}
              activeOpacity={0.7}
              onPress={() => {
                setShowSettingsModal(false);
                setShowSubtitlesModal(true);
              }}
            >
              <View style={styles.settingsRowLeft}>
                <MaterialIcons name="closed-caption" size={22} color="#FFFFFF" />
                <View style={styles.settingsRowTexts}>
                  <Text style={styles.settingsRowTitle}>Altyazılar</Text>
                  <Text style={styles.settingsRowValue}>
                    {isSubtitlesEnabled && selectedSubtitle
                      ? selectedSubtitle.languageName
                      : 'Kapalı'}
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.4)" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.settingsRow}
              activeOpacity={0.7}
              onPress={() => {
                setShowSettingsModal(false);
                setShowSleepModal(true);
              }}
            >
              <View style={styles.settingsRowLeft}>
                <Ionicons name="moon-outline" size={22} color="#FFFFFF" />
                <View style={styles.settingsRowTexts}>
                  <Text style={styles.settingsRowTitle}>Uyku Zamanlayıcısı</Text>
                  <Text style={styles.settingsRowValue}>
                    {sleepTimerMinutes ? `${sleepTimerMinutes} dakika sonra` : 'Kapalı'}
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.4)" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.settingsRow}
              activeOpacity={0.7}
              onPress={() => {
                Haptics.selection();
                const next = !isLooping;
                setIsLooping(next);
                player.loop = next;
              }}
            >
              <View style={styles.settingsRowLeft}>
                <Ionicons name="repeat-outline" size={22} color="#FFFFFF" />
                <View style={styles.settingsRowTexts}>
                  <Text style={styles.settingsRowTitle}>Videoyu Döngüye Al</Text>
                  <Text style={styles.settingsRowValue}>{isLooping ? 'Açık' : 'Kapalı'}</Text>
                </View>
              </View>
              <Ionicons
                name={isLooping ? 'checkmark-circle' : 'ellipse-outline'}
                size={20}
                color={isLooping ? THEME.colors.primary : 'rgba(255,255,255,0.3)'}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.settingsRow}
              activeOpacity={0.7}
              onPress={() => {
                setShowSettingsModal(false);
                void enterPictureInPicture();
              }}
            >
              <View style={styles.settingsRowLeft}>
                <Ionicons name="albums-outline" size={22} color="#FFFFFF" />
                <View style={styles.settingsRowTexts}>
                  <Text style={styles.settingsRowTitle}>Resim İçinde Resim (PiP)</Text>
                  <Text style={styles.settingsRowValue}>Videoyu mini pencerede izleyin</Text>
                </View>
              </View>
              <Ionicons name="open-outline" size={18} color="rgba(255,255,255,0.4)" />
            </TouchableOpacity>
          </OptionModal>

          {/* Standardized Bottom Sheet: Quality */}
          <OptionModal
            visible={showQualityModal}
            title="Video Kalitesi"
            subtitle="Daha yüksek kalite daha fazla veri tüketir."
            onClose={() => setShowQualityModal(false)}
          >
            {qualityLoading && <View style={styles.qualityStatus}><ActivityIndicator color={THEME.colors.primary} /><Text style={styles.modalSubtitle}>Videonun kaliteleri alınıyor…</Text></View>}
            {qualityMessage && <Text style={styles.modalSubtitle}>{qualityMessage}</Text>}
            {availableQualities.map((item) => (
              <OptionRow
                key={item}
                label={item === 'Auto' ? 'Otomatik (Önerilen)' : item}
                subLabel={item === 'Auto' ? 'Ağ hızına göre ayarlanır' : Number.parseInt(item) >= 2160 ? '4K Ultra HD' : Number.parseInt(item) >= 1440 ? '2K' : Number.parseInt(item) >= 1080 ? 'Full HD' : Number.parseInt(item) >= 720 ? 'HD' : 'Veri tasarrufu'}
                active={quality === item}
                onPress={() => {
                  setQuality(item);
                  setShowQualityModal(false);
                }}
              />
            ))}
          </OptionModal>

          {/* Standardized Bottom Sheet: Speed */}
          <OptionModal
            visible={showSpeedModal}
            title="Oynatma Hızı"
            subtitle="Videoyu dilediğiniz hızda izleyin."
            onClose={() => setShowSpeedModal(false)}
          >
            {SPEEDS.map((item) => (
              <OptionRow
                key={item}
                label={item === 1 ? 'Normal (1.0x)' : `${item}x`}
                active={speed === item}
                onPress={() => {
                  setSpeed(item);
                  setShowSpeedModal(false);
                }}
              />
            ))}
          </OptionModal>

          {/* Standardized Bottom Sheet: Sleep Timer */}
          <OptionModal
            visible={showSleepModal}
            title="Uyku Zamanlayıcısı"
            subtitle="Belirlenen süre sonunda oynatma otomatik durdurulur."
            onClose={() => setShowSleepModal(false)}
          >
            {[null, 15, 30, 45, 60].map((item) => (
              <OptionRow
                key={item ?? 'off'}
                label={item === null ? 'Kapalı' : `${item} dakika sonra`}
                active={sleepTimerMinutes === item}
                onPress={() => startSleepTimer(item)}
              />
            ))}
          </OptionModal>

          {/* Standardized Bottom Sheet: Subtitles */}
          <OptionModal
            visible={showSubtitlesModal}
            title="Altyazılar"
            subtitle={
              availableSubtitles.length > 0
                ? 'Görüntülemek istediğiniz dili seçin.'
                : 'Bu video için altyazı bulunmuyor.'
            }
            onClose={() => setShowSubtitlesModal(false)}
          >
            <OptionRow
              label="Kapalı"
              active={!isSubtitlesEnabled || !selectedSubtitle}
              onPress={() => {
                void selectSubtitle(null);
                setShowSubtitlesModal(false);
              }}
            />
            {availableSubtitles.map((sub, idx) => (
              <OptionRow
                key={`${sub.languageCode}_${idx}`}
                label={sub.languageName}
                subLabel={sub.isAutoGenerated ? 'Otomatik oluşturuldu' : undefined}
                active={
                  isSubtitlesEnabled &&
                  selectedSubtitle?.languageCode === sub.languageCode &&
                  selectedSubtitle?.languageName === sub.languageName
                }
                onPress={() => {
                  void selectSubtitle(sub);
                  setShowSubtitlesModal(false);
                }}
              />
            ))}
          </OptionModal>
        </>
      )}
    </View>
  );
};

interface OptionModalProps {
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}

const OptionModal: React.FC<OptionModalProps> = ({
  visible,
  title,
  subtitle,
  onClose,
  children,
}) => {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const landscape = width > height;
  const maxHeight = height - insets.top - insets.bottom - (landscape ? 24 : 16);
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent navigationBarTranslucent
      supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}
      onRequestClose={onClose}>
      <View style={[styles.modalBackdrop, landscape && { justifyContent: 'center', alignItems: 'flex-end', paddingRight: Math.max(insets.right, 12) }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Paneli kapat" />
        <View style={[styles.modalContent, {
          width: landscape ? Math.min(380, width * 0.48) : width,
          maxHeight,
          paddingBottom: landscape ? 12 : Math.max(insets.bottom, 20),
          ...(landscape ? { borderRadius: 20, borderBottomWidth: 1 } : {}),
        }]}>
          {!landscape && <View style={styles.sheetHandle} />}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose} style={styles.modalClose} accessibilityLabel="Paneli kapat">
              <Ionicons name="close" size={22} color="#B5B5BD" />
            </TouchableOpacity>
          </View>
          {subtitle && <Text style={styles.modalSubtitle}>{subtitle}</Text>}
          <ScrollView style={styles.modalChildrenWrap} showsVerticalScrollIndicator={false} bounces={false}>
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

interface OptionRowProps {
  label: string;
  subLabel?: string;
  active: boolean;
  onPress: () => void;
}

const OptionRow: React.FC<OptionRowProps> = ({ label, subLabel, active, onPress }) => (
  <TouchableOpacity
    style={[styles.modalItem, active && styles.modalItemActive]}
    activeOpacity={0.7}
    onPress={onPress}
  >
    <View style={styles.modalItemTextColumn}>
      <Text style={[styles.modalItemText, active && styles.modalItemTextActive]}>{label}</Text>
      {subLabel && <Text style={styles.modalItemSubText}>{subLabel}</Text>}
    </View>
    {active ? <Ionicons name="checkmark-circle" size={20} color={THEME.colors.primary} /> : null}
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#000000',
    position: 'relative',
    overflow: 'visible',
  },
  videoView: { width: '100%', height: '100%' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  loadingBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  loadingText: { color: THEME.colors.textSecondary, fontSize: 12, marginTop: 10 },
  bufferingOverlay: {
    position: 'absolute', top: 0, right: 0, bottom: 0, left: 0,
    alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.18)',
  },
  errorOverlay: {
    position: 'absolute', top: 0, right: 0, bottom: 0, left: 0,
    zIndex: 3, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 34,
    backgroundColor: 'rgba(4,4,6,0.94)',
  },
  errorTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '800', marginTop: 8 },
  errorText: { color: 'rgba(255,255,255,0.68)', fontSize: 12, lineHeight: 17, textAlign: 'center', marginTop: 5 },
  retryButton: {
    marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: THEME.colors.primary, paddingHorizontal: 15, paddingVertical: 9, borderRadius: 18,
  },
  retryText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  touchOverlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 2, overflow: 'visible' },
  controlsLayer: {
    position: 'absolute', top: 0, right: 0, bottom: 0, left: 0,
    justifyContent: 'space-between',
    paddingTop: 10,
    paddingHorizontal: 0,
    paddingBottom: 0,
    backgroundColor: 'rgba(0,0,0,0.40)',
    overflow: 'visible',
  },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12 },
  topRightActions: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  autoplaySwitch: {
    width: 38,
    height: 22,
    borderRadius: 11,
    padding: 2,
    justifyContent: 'center',
    marginRight: 2,
  },
  autoplaySwitchActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
    alignItems: 'flex-end',
  },
  autoplaySwitchInactive: {
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    alignItems: 'flex-start',
  },
  autoplayThumb: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  autoplayThumbActive: {
    backgroundColor: '#000000',
  },
  autoplayThumbInactive: {
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
  },
  roundIconButton: {
    width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(16,16,20,0.68)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  compactButton: {
    minHeight: 32, paddingHorizontal: 9, borderRadius: 16, flexDirection: 'row', gap: 5,
    alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(16,16,20,0.68)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  compactText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  centerControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 40 },
  navSkipBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  playPauseButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  bottomSection: {
    position: 'relative',
    paddingBottom: 0,
    overflow: 'visible',
  },
  seekbarContainer: {
    position: 'absolute',
    bottom: -18,
    left: 0,
    right: 0,
    height: 38,
    justifyContent: 'center',
    zIndex: 99,
  },
  seekbarTrack: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: 1.5,
  },
  seekbarTrackScrubbing: {
    height: 5,
    borderRadius: 2.5,
  },
  bufferedFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.38)',
    borderRadius: 2,
  },
  seekbarFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: '#FF0000',
    borderRadius: 2,
  },
  seekbarThumb: {
    position: 'absolute',
    top: -5.5,
    width: 14,
    height: 14,
    marginLeft: -7,
    borderRadius: 7,
    backgroundColor: '#FF0000',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.6,
    shadowRadius: 3,
  },
  seekbarThumbScrubbing: {
    top: -7.5,
    width: 20,
    height: 20,
    marginLeft: -10,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    elevation: 12,
  },
  seekbarThumbMini: {
    top: -3.5,
    width: 10,
    height: 10,
    marginLeft: -5,
    borderRadius: 5,
  },
  bottomBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, marginBottom: 10 },
  timeBadge: {
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  timeBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  timeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '600' },
  fullscreenBtn: {
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sponsorBanner: {
    position: 'absolute', bottom: 43, left: 18, flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: 'rgba(0,150,92,0.94)', paddingHorizontal: 13, paddingVertical: 9, borderRadius: 18,
  },
  sponsorText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'flex-end',
  },
  modalContent: {
    width: '100%',
    backgroundColor: '#16161D',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 10,
    paddingBottom: 24,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderBottomWidth: 0,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignSelf: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    paddingHorizontal: 4,
    letterSpacing: -0.2,
  },
  modalSubtitle: {
    color: THEME.colors.textTertiary,
    fontSize: 12,
    paddingHorizontal: 4,
    marginTop: 2,
    marginBottom: 8,
  },
  modalChildrenWrap: { marginTop: 6, flexShrink: 1 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modalClose: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  qualityStatus: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 8 },
  modalItem: {
    minHeight: 48,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  modalItemActive: {
    backgroundColor: 'rgba(255, 0, 51, 0.12)',
  },
  modalItemTextColumn: {
    flex: 1,
  },
  modalItemText: {
    color: THEME.colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  modalItemTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  modalItemSubText: {
    color: THEME.colors.textTertiary,
    fontSize: 11,
    marginTop: 2,
  },
  doubleTapOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: '40%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    zIndex: 99,
  },
  doubleTapLeft: {
    left: 0,
    borderTopRightRadius: 100,
    borderBottomRightRadius: 100,
  },
  doubleTapRight: {
    right: 0,
    borderTopLeftRadius: 100,
    borderBottomLeftRadius: 100,
  },
  fastForwardBadge: { position: 'absolute', alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: 'rgba(20,20,26,0.82)', zIndex: 105 },
  fastForwardText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  doubleTapText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 4,
  },
  previewTooltip: {
    position: 'absolute',
    top: -28,
    alignSelf: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  previewTooltipText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  activeIconButton: {
    backgroundColor: 'rgba(255, 0, 51, 0.22)',
    borderColor: THEME.colors.primary,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    marginBottom: 4,
  },
  settingsRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
  },
  settingsRowTexts: {
    flex: 1,
  },
  settingsRowTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  settingsRowValue: {
    color: 'rgba(255, 255, 255, 0.55)',
    fontSize: 12,
    marginTop: 2,
  },
  activeCcButton: {
    backgroundColor: '#CC0000',
  },
  subtitleContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    alignItems: 'center',
    zIndex: 45,
  },
  subtitleContainerWithControls: {
    bottom: 56,
  },
  subtitleContainerNoControls: {
    bottom: 16,
  },
  subtitlePill: {
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    maxWidth: '92%',
  },
  subtitleText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 19,
  },
  miniContainer: { backgroundColor: '#1C1C24', borderRadius: 16, overflow: 'hidden' },
  miniVideo: { position: 'absolute', left: 6, top: 6, width: 108, height: 61, borderRadius: 10, overflow: 'hidden' },
  miniExpand: { position: 'absolute', left: 0, top: 0, bottom: 3, right: 88, justifyContent: 'center' },
  miniMetadata: { marginLeft: 126, paddingRight: 6, gap: 5 },
  miniTitle: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  miniChannel: { color: '#A4A4B0', fontSize: 11 },
  miniControlsRow: { position: 'absolute', right: 4, top: 0, bottom: 3, flexDirection: 'row', alignItems: 'center' },
  miniCircleBtn: { width: 42, height: 52, alignItems: 'center', justifyContent: 'center' },
  miniProgressBar: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, backgroundColor: '#35353F' },
  miniProgressFill: { height: '100%', backgroundColor: THEME.colors.primary },
});

