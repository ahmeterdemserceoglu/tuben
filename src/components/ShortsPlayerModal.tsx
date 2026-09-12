import { YouTubeExploreService } from '../services/youtubeExploreService';
import { CommentsSheet } from './CommentsSheet';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  useWindowDimensions,
  TouchableOpacity,
  Image,
  Share,
  Modal,
  FlatList,
  Animated,
  ActivityIndicator,
  StatusBar,
  BackHandler,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Platform,
  Pressable,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import type { ContentType } from 'expo-video';
import { usePlayerStore } from '../store/usePlayerStore';
import { useLibraryStore } from '../store/useLibraryStore';
import { useAuth } from '../auth/AuthContext';
import { THEME } from '../constants/theme';
import { YouTubeService, IOS_USER_AGENT } from '../services/youtubeService';
import { VideoItem } from '../types/video';
import { CommentItem } from '../types/comment';
import { Haptics } from '../utils/haptics';

export const ShortsPlayerModal: React.FC = () => {
  const insets = useSafeAreaInsets();
  const screenDims = Dimensions.get('screen');
  const windowDims = Dimensions.get('window');
  const initialHeight =
    Platform.OS === 'android'
      ? Math.max(screenDims.height, windowDims.height)
      : windowDims.height;
  const initialWidth = windowDims.width || screenDims.width;

  const [containerHeight, setContainerHeight] = useState<number>(initialHeight);
  const [containerWidth, setContainerWidth] = useState<number>(initialWidth);
  const { user } = useAuth();

  const {
    currentVideo,
    streamBundle,
    activeStreamUrl,
    streamHeaders,
    isShortsPlayerVisible,
    isPlaying,
    loading,
    currentTime,
    duration,
    setShortsPlayerVisible,
    setPlaying,
    updatePlaybackTime,
    handlePlaybackError,
    closePlayer,
    queue,
    queueIndex,
  } = usePlayerStore();

  const { isFavorite, toggleFavorite, isSubscribed, toggleSubscription } = useLibraryStore();

  const [comments, setComments] = useState<CommentItem[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [isDisliked, setIsDisliked] = useState(false);
  const [channelAvatarUrl, setChannelAvatarUrl] = useState<string | null>(null);
  const [showCenterIcon, setShowCenterIcon] = useState<'play' | 'pause' | null>(null);
  const [showSpinner, setShowSpinner] = useState(false);

  const flatListRef = useRef<FlatList<VideoItem>>(null);
  const iconAnim = useRef(new Animated.Value(0)).current;
  const lastTapRef = useRef<number>(0);
  const sourceRevisionRef = useRef<number>(0);
  const engineSourceRef = useRef<string | null>(null);
  const replacingSourceRef = useRef(false);
  const isLoadingMoreRef = useRef<boolean>(false);
  const currentIndexRef = useRef<number>(queueIndex);

  const effectiveQueue = queue.length > 0 ? queue : currentVideo ? [currentVideo] : [];

  // Initialize single expo-video player instance
  const player = useVideoPlayer(null, (instance) => {
    instance.loop = true;
    instance.preservesPitch = true;
    instance.timeUpdateEventInterval = 0.25;
  });

  // Reset interaction states when active video changes
  useEffect(() => {
    setIsLiked(false);
    setIsDisliked(false);
    setDescExpanded(false);
    setChannelAvatarUrl(null);
    currentIndexRef.current = queueIndex;
  }, [currentVideo?.id, queueIndex]);

  // Fetch comments when active video changes
  useEffect(() => {
    if (!currentVideo?.id || !isShortsPlayerVisible) return;
    let isMounted = true;
    setLoadingComments(true);
    YouTubeExploreService.comments(currentVideo.id).then(page => page.items)
      .then((items) => {
        if (isMounted) {
          setComments(items);
          setLoadingComments(false);
        }
      })
      .catch(() => {
        if (isMounted) setLoadingComments(false);
      });
    return () => {
      isMounted = false;
    };
  }, [currentVideo?.id, isShortsPlayerVisible]);

  // Fetch channel avatar if missing
  useEffect(() => {
    if (!currentVideo || !isShortsPlayerVisible) return;
    let isMounted = true;
    const cid = streamBundle?.uploaderId || currentVideo.uploaderId || currentVideo.uploaderName;
    const directAvatar = streamBundle?.uploaderAvatarUrl || currentVideo.uploaderAvatarUrl;

    if (directAvatar && !directAvatar.includes('hqdefault.jpg') && !directAvatar.includes('default_avatar')) {
      setChannelAvatarUrl(directAvatar);
      return;
    }

    if (cid) {
      YouTubeService.getChannelDetails(cid)
        .then((res) => {
          if (isMounted && res?.avatarUrl && !res.avatarUrl.includes('default_avatar')) {
            setChannelAvatarUrl(res.avatarUrl);
          }
        })
        .catch(() => undefined);
    }
    return () => {
      isMounted = false;
    };
  }, [currentVideo?.id, currentVideo?.uploaderId, streamBundle?.uploaderId, isShortsPlayerVisible]);

  // Load stream into expo-video player
  useEffect(() => {
    if (!isShortsPlayerVisible) {
      player.pause();
      return;
    }

    const revision = ++sourceRevisionRef.current;
    engineSourceRef.current = null;
    replacingSourceRef.current = true;
    if (!activeStreamUrl) {
      player.pause();
      void player.replaceAsync(null).catch(() => undefined);
      return;
    }

    const isHls =
      activeStreamUrl.includes('.m3u8') ||
      activeStreamUrl.includes('manifest/hls') ||
      activeStreamUrl.includes('hls_variant') ||
      activeStreamUrl.includes('hls_playlist');
    const isDash = activeStreamUrl.endsWith('.mpd') || activeStreamUrl.includes('.mpd');
    const contentType: ContentType = isHls ? 'hls' : isDash ? 'dash' : 'progressive';

    const headers = { ...streamHeaders };


    player
      .replaceAsync({
        uri: activeStreamUrl,
        headers,
        contentType,
        metadata: currentVideo
          ? {
              title: currentVideo.title,
              artist: currentVideo.uploaderName,
              artwork: currentVideo.thumbnailUrl,
            }
          : undefined,
      })
      .then(() => {
        if (revision !== sourceRevisionRef.current) return;
        engineSourceRef.current = activeStreamUrl;
        replacingSourceRef.current = false;
        if (usePlayerStore.getState().isPlaying) player.play();
      })
      .catch((err) => {
        if (revision !== sourceRevisionRef.current) return;
        console.warn('[ShortsPlayer] replaceAsync error, attempting fallback:', err);
        void handlePlaybackError(activeStreamUrl, err?.message || 'Medya kaynağı açılamadı.');
      });

    return () => {
      sourceRevisionRef.current += 1;
      replacingSourceRef.current = true;
    };
  }, [activeStreamUrl, currentVideo?.id, isShortsPlayerVisible, player]);

  // Player listeners
  useEffect(() => {
    if (!isShortsPlayerVisible) return;

    const sourceSub = player.addListener('sourceChange', ({ source }) => {
      engineSourceRef.current = typeof source === 'string' ? source : source && typeof source === 'object' ? source.uri || null : null;
    });
    const isCurrent = () => !!engineSourceRef.current && engineSourceRef.current === usePlayerStore.getState().activeStreamUrl;
    const timeSub = player.addListener('timeUpdate', ({ currentTime: t }) => {
      if (!isCurrent() || replacingSourceRef.current) return;
      updatePlaybackTime(t, player.duration || 60);
    });

    const statusSub = player.addListener('statusChange', ({ status, error: playerError }) => {
      if (status === 'error' && isCurrent()) {
        console.warn('[ShortsPlayer] statusChange error:', playerError);
        void handlePlaybackError(engineSourceRef.current!, playerError?.message || 'Medya kaynağı açılamadı.');
      }
    });

    const playSub = player.addListener('playingChange', ({ isPlaying: p }) => {
      if (!isCurrent() || replacingSourceRef.current || player.status !== 'readyToPlay') return;
      if (usePlayerStore.getState().isPlaying !== p) {
        usePlayerStore.setState({ isPlaying: p });
      }
    });

    return () => {
      sourceSub.remove();
      timeSub.remove();
      statusSub.remove();
      playSub.remove();
    };
  }, [player, isShortsPlayerVisible, updatePlaybackTime, handlePlaybackError]);

  // Debounced loading spinner
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    if (loading) {
      timer = setTimeout(() => setShowSpinner(true), 400);
    } else {
      setShowSpinner(false);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [loading]);

  // Clean back exit
  const handleClose = useCallback(() => {
    Haptics.selection();
    player.pause();
    void player.replaceAsync(null).catch(() => undefined);
    setShortsPlayerVisible(false);
    closePlayer();
  }, [player, setShortsPlayerVisible, closePlayer]);

  // Android hardware back handler
  useEffect(() => {
    if (!isShortsPlayerVisible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      handleClose();
      return true;
    });
    return () => sub.remove();
  }, [isShortsPlayerVisible, handleClose]);

  // Align FlatList to active short when modal opens
  useEffect(() => {
    if (isShortsPlayerVisible && flatListRef.current && queueIndex >= 0 && queueIndex < effectiveQueue.length) {
      try {
        flatListRef.current.scrollToIndex({ index: queueIndex, animated: false });
      } catch {
        // Handled by onScrollToIndexFailed
      }
    }
  }, [isShortsPlayerVisible]);

  // Flash center play/pause indicator
  const triggerCenterIcon = (type: 'play' | 'pause') => {
    setShowCenterIcon(type);
    iconAnim.setValue(1);
    Animated.timing(iconAnim, {
      toValue: 0,
      duration: 550,
      useNativeDriver: true,
    }).start(() => setShowCenterIcon(null));
  };

  // Screen tap handler: single tap play/pause, double tap like
  const handleScreenPress = (item: VideoItem) => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      Haptics.success();
      setIsLiked(true);
      setIsDisliked(false);
      void toggleFavorite(user?.uid, item);
      lastTapRef.current = 0;
      return;
    }
    lastTapRef.current = now;

    if (player.playing) {
      player.pause();
      setPlaying(false);
      triggerCenterIcon('pause');
    } else {
      player.play();
      setPlaying(true);
      triggerCenterIcon('play');
    }
  };

  // Share handler
  const handleShare = async (video: VideoItem) => {
    try {
      await Share.share({
        message: `${video.title}\nhttps://youtube.com/shorts/${video.id}`,
        title: video.title,
      });
    } catch {
      // Ignored
    }
  };

  // Auto-fetch more shorts when user scrolls near the end
  const loadMoreShorts = async () => {
    if (isLoadingMoreRef.current) return;
    isLoadingMoreRef.current = true;
    try {
      const more = await YouTubeService.searchVideos('#shorts trend türkiye');
      const currentQueue = usePlayerStore.getState().queue;
      const existingIds = new Set(currentQueue.map((v) => v.id));
      const fresh = more.filter((v) => !existingIds.has(v.id));
      if (fresh.length > 0) {
        usePlayerStore.setState((s) => ({ queue: [...s.queue, ...fresh] }));
      }
    } catch {
      // Ignored
    } finally {
      isLoadingMoreRef.current = false;
    }
  };

  const handleContainerLayout = useCallback(
    (e: any) => {
      const { width, height } = e.nativeEvent.layout;
      if (height > 0 && Math.abs(height - containerHeight) > 1) {
        setContainerHeight(height);
        if (queueIndex > 0) {
          requestAnimationFrame(() => {
            flatListRef.current?.scrollToOffset({ offset: queueIndex * height, animated: false });
          });
        }
      }
      if (width > 0 && Math.abs(width - containerWidth) > 1) {
        setContainerWidth(width);
      }
    },
    [containerHeight, containerWidth, queueIndex]
  );

  // Handle momentum scroll end to smoothly switch video
  const handleMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetY = e.nativeEvent.contentOffset.y;
    const newIndex = Math.round(offsetY / containerHeight);
    if (newIndex >= 0 && newIndex < effectiveQueue.length && newIndex !== queueIndex) {
      Haptics.selection();
      const nextShort = effectiveQueue[newIndex];
      void usePlayerStore.getState().loadAndPlay(nextShort, effectiveQueue, newIndex);
    }
  };

  // Handle scroll drag to allow swipe-down to dismiss at the very first short
  const handleScrollEndDrag = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetY = e.nativeEvent.contentOffset.y;
    if (offsetY < -80 && queueIndex === 0) {
      handleClose();
    }
  };

  if (!isShortsPlayerVisible || !currentVideo) {
    return null;
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const renderShortItem = ({ item, index }: { item: VideoItem; index: number }) => {
    const isCurrent = index === queueIndex;
    const itemChannelId = item.uploaderId || item.uploaderName || '';
    const itemSubscribed = isSubscribed(itemChannelId);
    const itemFavorited = isFavorite(item.id);
    const thumbUrl = item.thumbnailUrl || `https://i.ytimg.com/vi/${item.id}/hqdefault.jpg`;
    const channelName =
      isCurrent && streamBundle?.uploaderName && streamBundle.uploaderName !== 'Shorts'
        ? streamBundle.uploaderName
        : item.uploaderName && item.uploaderName !== 'Shorts'
        ? item.uploaderName
        : 'Kanal';
    const avatarUrl =
      isCurrent && channelAvatarUrl
        ? channelAvatarUrl
        : streamBundle?.uploaderAvatarUrl && !streamBundle.uploaderAvatarUrl.includes('default_avatar')
        ? streamBundle.uploaderAvatarUrl
        : thumbUrl;

    return (
      <View style={{ width: containerWidth, height: containerHeight, position: 'relative', overflow: 'hidden' }}>
        {/* Poster Thumbnail: visible immediately on all cards to prevent black flashes */}
        <Image
          source={{ uri: thumbUrl }}
          style={styles.fullScreenVideo}
          resizeMode="cover"
        />

        {/* VideoView: Mounted on the active item for smooth, hardware-accelerated playback */}
        {isCurrent && (
          <VideoView
            player={player}
            style={styles.fullScreenVideo}
            contentFit="cover"
            nativeControls={false}
            surfaceType="textureView"
          />
        )}

        {/* Tap surface for single-tap play/pause and double-tap like */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => handleScreenPress(item)}
        />

        {/* Debounced Loading Spinner on active video */}
        {isCurrent && showSpinner && (
          <View pointerEvents="none" style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#FFFFFF" />
          </View>
        )}

        {/* Center Animated Play/Pause Indicator on active video */}
        {isCurrent && showCenterIcon && (
          <Animated.View pointerEvents="none" style={[styles.centerIconOverlay, { opacity: iconAnim }]}>
            <View style={styles.centerIconCircle}>
              <Ionicons
                name={showCenterIcon === 'play' ? 'play' : 'pause'}
                size={44}
                color="#FFFFFF"
                style={{ marginLeft: showCenterIcon === 'play' ? 4 : 0 }}
              />
            </View>
          </Animated.View>
        )}

        {/* Top subtle vignette gradient */}
        <LinearGradient
          colors={['rgba(0,0,0,0.65)', 'rgba(0,0,0,0.2)', 'transparent']}
          style={styles.topGradient}
          pointerEvents="none"
        />

        {/* Bottom subtle gradient overlay for typography readability */}
        <LinearGradient
          colors={['transparent', 'rgba(0, 0, 0, 0.4)', 'rgba(0, 0, 0, 0.9)']}
          style={styles.bottomGradient}
          pointerEvents="none"
        />

        {/* Right Floating Action Column (YouTube Shorts Style) */}
        <View style={[styles.rightActionsColumn, { paddingBottom: Math.max(insets.bottom, 24) }]}>
          {/* Like Button */}
          <TouchableOpacity
            style={styles.actionItem}
            activeOpacity={0.7}
            onPress={() => {
              Haptics.selection();
              if (isCurrent) {
                setIsLiked(!isLiked);
                setIsDisliked(false);
              }
              void toggleFavorite(user?.uid, item);
            }}
          >
            <View
              style={[
                styles.actionIconCircle,
                (isCurrent ? isLiked || itemFavorited : itemFavorited) && styles.actionActiveCircle,
              ]}
            >
              <Ionicons
                name={(isCurrent ? isLiked || itemFavorited : itemFavorited) ? 'thumbs-up' : 'thumbs-up-outline'}
                size={23}
                color="#FFFFFF"
              />
            </View>
            <Text style={styles.actionLabel}>
              {((item.viewCount || 1000) / 10).toLocaleString('tr-TR', { maximumFractionDigits: 0 })}
            </Text>
          </TouchableOpacity>

          {/* Dislike Button */}
          <TouchableOpacity
            style={styles.actionItem}
            activeOpacity={0.7}
            onPress={() => {
              Haptics.selection();
              if (isCurrent) {
                setIsDisliked(!isDisliked);
                setIsLiked(false);
              }
            }}
          >
            <View style={[styles.actionIconCircle, isCurrent && isDisliked && styles.actionActiveCircle]}>
              <Ionicons
                name={isCurrent && isDisliked ? 'thumbs-down' : 'thumbs-down-outline'}
                size={23}
                color="#FFFFFF"
              />
            </View>
            <Text style={styles.actionLabel}>Beğenme</Text>
          </TouchableOpacity>

          {/* Comments Button */}
          <TouchableOpacity
            style={styles.actionItem}
            activeOpacity={0.7}
            onPress={() => {
              Haptics.selection();
              setShowCommentsModal(true);
            }}
          >
            <View style={styles.actionIconCircle}>
              <Ionicons name="chatbubble-ellipses-outline" size={23} color="#FFFFFF" />
            </View>
            <Text style={styles.actionLabel}>
              {isCurrent && comments.length > 0 ? comments.length : 'Yorum'}
            </Text>
          </TouchableOpacity>

          {/* Share Button */}
          <TouchableOpacity
            style={styles.actionItem}
            activeOpacity={0.7}
            onPress={() => handleShare(item)}
          >
            <View style={styles.actionIconCircle}>
              <Ionicons name="arrow-redo-outline" size={24} color="#FFFFFF" />
            </View>
            <Text style={styles.actionLabel}>Paylaş</Text>
          </TouchableOpacity>

          {/* Spinning Sound Disc */}
          <View style={styles.soundDisc}>
            <Image source={{ uri: avatarUrl }} style={styles.soundDiscImage} />
          </View>
        </View>

        {/* Bottom Info Overlay: Channel, Title, Sound */}
        <View style={[styles.bottomInfoOverlay, { paddingBottom: Math.max(insets.bottom + 10, 20) }]}>
          {/* Channel Row */}
          <View style={styles.channelRow}>
            <Image source={{ uri: avatarUrl }} style={styles.channelAvatar} />
            <Text style={styles.channelNameText} numberOfLines={1}>
              @{channelName}
            </Text>
            <TouchableOpacity
              style={[styles.subButton, itemSubscribed && styles.subButtonActive]}
              activeOpacity={0.8}
              onPress={() => {
                Haptics.selection();
                void toggleSubscription(user?.uid, {
                  id: itemChannelId,
                  name: item.uploaderName || channelName,
                  avatarUrl,
                });
              }}
            >
              <Text style={[styles.subButtonText, itemSubscribed && styles.subButtonTextActive]}>
                {itemSubscribed ? 'Aboneliktesin' : 'Abone Ol'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Video Title */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => isCurrent && setDescExpanded(!descExpanded)}
          >
            <Text
              style={styles.videoTitleText}
              numberOfLines={isCurrent && descExpanded ? undefined : 2}
            >
              {item.title}
            </Text>
          </TouchableOpacity>

          {/* Sound / Music Track Info */}
          <View style={styles.soundRow}>
            <Ionicons name="musical-notes" size={13} color="#FFFFFF" />
            <Text style={styles.soundTitleText} numberOfLines={1}>
              Orijinal Ses - @{channelName}
            </Text>
          </View>
        </View>

        {/* Bottom Slim Red Scrubber (only on active playing video) */}
        {isCurrent && (
          <View style={styles.bottomScrubberTrack}>
            <View style={[styles.bottomScrubberFill, { width: `${progress}%` }]} />
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container} onLayout={handleContainerLayout}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Top Fixed Header Overlay */}
      <View style={[styles.topHeader, { paddingTop: Math.max(insets.top, 12) }]}>
        <TouchableOpacity
          style={styles.headerIconButton}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          onPress={handleClose}
        >
          <Ionicons name="chevron-down" size={28} color="#FFFFFF" />
        </TouchableOpacity>

        <View style={styles.shortsBadge}>
          <Ionicons name="flash" size={14} color="#FF0033" />
          <Text style={styles.shortsBadgeText}>Shorts</Text>
        </View>

        <TouchableOpacity
          style={styles.headerIconButton}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          onPress={() => currentVideo && handleShare(currentVideo)}
        >
          <Ionicons name="share-outline" size={22} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Smooth vertical pager FlatList */}
      <FlatList
        ref={flatListRef}
        data={effectiveQueue}
        keyExtractor={(item, index) => `${item.id}_${index}`}
        renderItem={renderShortItem}
        pagingEnabled
        snapToInterval={containerHeight}
        snapToAlignment="start"
        decelerationRate="fast"
        disableIntervalMomentum
        showsVerticalScrollIndicator={false}
        initialScrollIndex={queueIndex >= 0 && queueIndex < effectiveQueue.length ? queueIndex : 0}
        getItemLayout={(_, index) => ({
          length: containerHeight,
          offset: containerHeight * index,
          index,
        })}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        onScrollEndDrag={handleScrollEndDrag}
        onEndReached={loadMoreShorts}
        onEndReachedThreshold={0.5}
        onScrollToIndexFailed={(info) => {
          setTimeout(() => {
            flatListRef.current?.scrollToIndex({ index: info.index, animated: false });
          }, 80);
        }}
        windowSize={3}
        maxToRenderPerBatch={2}
        removeClippedSubviews={Platform.OS === 'android'}
        style={{ flex: 1, width: containerWidth, height: containerHeight }}
      />

      {/* Interactive Comments Bottom Sheet */}
      <CommentsSheet visible={showCommentsModal} videoId={currentVideo?.id || ''} channelId={currentVideo?.uploaderId} onClose={() => setShowCommentsModal(false)} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#000000',
    zIndex: 2000,
    elevation: 30,
  },
  fullScreenVideo: {
    ...StyleSheet.absoluteFill,
  },
  loadingBox: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    zIndex: 5,
  },
  centerIconOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 8,
  },
  centerIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  topGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 120,
    zIndex: 3,
  },
  bottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 280,
    zIndex: 3,
  },
  topHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    zIndex: 30,
  },
  headerIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shortsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  shortsBadgeText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  rightActionsColumn: {
    position: 'absolute',
    right: 12,
    bottom: 70,
    alignItems: 'center',
    gap: 18,
    zIndex: 10,
  },
  actionItem: {
    alignItems: 'center',
  },
  actionIconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(20, 20, 25, 0.60)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionActiveCircle: {
    backgroundColor: THEME.colors.primary,
    borderColor: THEME.colors.primary,
  },
  actionLabel: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  soundDisc: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1E1E24',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  soundDiscImage: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  bottomInfoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 76,
    paddingHorizontal: 16,
    zIndex: 10,
  },
  channelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 10,
  },
  channelAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    backgroundColor: THEME.colors.surface,
  },
  channelNameText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    flexShrink: 1,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  subButton: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  subButtonActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  subButtonText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '800',
  },
  subButtonTextActive: {
    color: '#FFFFFF',
  },
  videoTitleText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
    marginBottom: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  soundRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  soundTitleText: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 12,
    fontWeight: '600',
  },
  bottomScrubberTrack: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    zIndex: 15,
  },
  bottomScrubberFill: {
    height: '100%',
    backgroundColor: THEME.colors.primary,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'flex-end',
  },
  commentsSheet: {
    backgroundColor: '#181820',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '65%',
    paddingTop: 8,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignSelf: 'center',
    marginBottom: 8,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  sheetTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 4,
  },
  commentsLoader: {
    padding: 30,
    alignItems: 'center',
  },
  commentItem: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
    gap: 12,
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: THEME.colors.surface,
  },
  commentBody: {
    flex: 1,
  },
  commentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 3,
  },
  commentAuthor: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    fontWeight: '700',
  },
  commentTime: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 11,
  },
  commentText: {
    color: '#FFFFFF',
    fontSize: 13,
    lineHeight: 18,
  },
  commentLikes: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  commentLikesCount: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 11,
  },
  emptyBox: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 13,
  },
});
