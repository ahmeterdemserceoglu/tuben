import { YouTubeExploreService } from '../services/youtubeExploreService';
import { useDownloadSheetStore } from '../store/useDownloadSheetStore';
import { CommentsSheet } from './CommentsSheet';
import { useRecommendationStore, filterRecommendations } from '../store/useRecommendationStore';
import { WatchProgressBar } from './WatchProgressBar';
import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  useWindowDimensions,
  Share,
  Modal,
  FlatList,
  ActivityIndicator,
  Animated,
  BackHandler,
  PanResponder,
  Linking,
  LayoutAnimation,
  Platform,
  UIManager,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { PlayerView } from './PlayerView';
import { usePlayerStore } from '../store/usePlayerStore';
import { useLibraryStore } from '../store/useLibraryStore';
import { useAuth } from '../auth/AuthContext';
import { THEME } from '../constants/theme';
import { useThemeStore } from '../store/useThemeStore';
import { VideoItem } from '../types/video';
import { CommentItem } from '../types/comment';
import { YouTubeService } from '../services/youtubeService';
import { DownloadService } from '../services/downloadService';
import { Haptics } from '../utils/haptics';
import { useNavigationLayoutStore } from '../store/useNavigationLayoutStore';
import { MINI_PLAYER_HEIGHT } from '../constants/navigationLayout';
import { miniPlayerGeometry, clampMiniPlayerPosition } from '../utils/miniPlayerGeometry';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

function formatCompactViews(views: number): string {
  if (!views || views <= 0) return '0 views';
  if (views >= 1_000_000_000) return `${(views / 1_000_000_000).toFixed(1).replace('.0', '')}B views`;
  if (views >= 1_000_000) return `${(views / 1_000_000).toFixed(1).replace('.0', '')}M views`;
  if (views >= 1_000) return `${(views / 1_000).toFixed(1).replace('.0', '')}K views`;
  return `${views} views`;
}

function extractHashtags(text?: string): string[] {
  if (!text) return [];
  const matches = text.match(/#[a-zA-Z0-9_\p{L}]+/gu);
  return matches ? Array.from(new Set(matches)) : [];
}

function parseTimestampToSeconds(ts: string): number {
  const parts = ts.split(':').map((p) => parseInt(p, 10));
  if (parts.some(isNaN)) return 0;
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return 0;
}

function renderFormattedDescription(
  text: string,
  onSeek: (seconds: number) => void,
  textStyle?: any,
  linkStyle?: any,
  timestampStyle?: any
) {
  const regex = /(https?:\/\/[^\s]+|\b\d{1,2}:\d{2}(?::\d{2})?\b)/g;
  const parts = text.split(regex);

  return (
    <Text style={textStyle}>
      {parts.map((part, index) => {
        if (/^https?:\/\//i.test(part)) {
          return (
            <Text
              key={index}
              style={linkStyle}
              onPress={() => {
                Linking.openURL(part).catch(() => undefined);
              }}
            >
              {part}
            </Text>
          );
        }
        if (/^\d{1,2}:\d{2}(?::\d{2})?$/.test(part)) {
          const seconds = parseTimestampToSeconds(part);
          return (
            <Text
              key={index}
              style={timestampStyle}
              onPress={() => {
                Haptics.selection();
                onSeek(seconds);
              }}
            >
              {part}
            </Text>
          );
        }
        return part;
      })}
    </Text>
  );
}

const isNewArch = Boolean(
  (globalThis as any).RN$Bridgeless || (globalThis as any).nativeFabricUIManager
);

if (Platform.OS === 'android' && !isNewArch && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export const FullPlayerModal: React.FC = () => {
  const insets = useSafeAreaInsets();
  const bottomBarHeight = useNavigationLayoutStore((state) => state.bottomBarHeight);
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const colors = useThemeStore((s) => s.colors);
  const { user } = useAuth();
  const {
    currentVideo,
    streamBundle,
    isMinimized,
    setMinimized,
    loadAndPlay,
    isShortsPlayerVisible,
    requestSeek,
    isFullscreen,
    toggleFullscreen,
    closePlayer,
  } = usePlayerStore();

  const { isFavorite, toggleFavorite, isSubscribed, toggleSubscription } = useLibraryStore();

  const preferences = useRecommendationStore();
  const history = useLibraryStore(s => s.history);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  const [channelAvatarUrl, setChannelAvatarUrl] = useState<string | null>(null);

  const toggleDescExpanded = (targetState?: boolean) => {
    Haptics.selection();
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setDescExpanded((prev) => (typeof targetState === 'boolean' ? targetState : !prev));
  };

  // Fetch real channel avatar if missing or video thumbnail
  useEffect(() => {
    let isMounted = true;
    const cid = streamBundle?.uploaderId || currentVideo?.uploaderId || currentVideo?.uploaderName;
    const directAvatar = streamBundle?.uploaderAvatarUrl || currentVideo?.uploaderAvatarUrl;

    if (directAvatar && !directAvatar.includes('hqdefault.jpg') && !directAvatar.includes('default_avatar')) {
      setChannelAvatarUrl(directAvatar);
      return;
    }

    setChannelAvatarUrl(null);
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
  }, [currentVideo?.id, currentVideo?.uploaderId, streamBundle?.uploaderId, streamBundle?.uploaderAvatarUrl]);

  // Animated translateY for 60fps native slide in/out of full player
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  // Position survives release, video changes, and expanding the player.
  const miniTranslateX = useRef(new Animated.Value(0)).current;
  const miniTranslateY = useRef(new Animated.Value(0)).current;
  const miniPositionRef = useRef({ x: 0, y: 0 });
  const miniDragStartRef = useRef({ x: 0, y: 0 });
  const miniLayout = miniPlayerGeometry(windowWidth, windowHeight, insets, bottomBarHeight, Platform.OS);
  const miniBoundsRef = useRef(miniLayout.bounds);
  miniBoundsRef.current = miniLayout.bounds;

  useEffect(() => {
    const position = clampMiniPlayerPosition(miniPositionRef.current, miniBoundsRef.current);
    miniPositionRef.current = position;
    miniTranslateX.setValue(position.x);
    miniTranslateY.setValue(position.y);
  }, [windowWidth, windowHeight, insets.top, insets.bottom, insets.left, insets.right, bottomBarHeight]);

  // Handle slide animation when isMinimized or currentVideo changes
  useEffect(() => {
    if (currentVideo && !isMinimized) {
      Animated.spring(translateY, {
        toValue: 0,
        friction: 9,
        tension: 65,
        useNativeDriver: true,
      }).start();
    } else {
      translateY.setValue(0);
    }
  }, [isMinimized, currentVideo?.id, translateY]);

  // Android hardware back button handler
  useEffect(() => {
    const onBackPress = () => {
      // If Shorts player is active, let Shorts handle its own back press
      if (isShortsPlayerVisible || currentVideo?.streamType === 'SHORTS') {
        return false;
      }
      if (isFullscreen) {
        toggleFullscreen();
        return true;
      }
      if (descExpanded) {
        setDescExpanded(false);
        return true;
      }
      if (showCommentsModal) {
        setShowCommentsModal(false);
        return true;
      }
      if (!isMinimized && currentVideo) {
        setMinimized(true);
        return true;
      }
      return false;
    };

    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [isFullscreen, toggleFullscreen, descExpanded, showCommentsModal, isMinimized, currentVideo, setMinimized, isShortsPlayerVisible]);

  // PanResponder to allow dragging down from full player to minimize smoothly
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return gestureState.numberActiveTouches === 1 && gestureState.dy > 18 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx) * 1.5;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 120 || gestureState.vy > 0.8) {
          setMinimized(true);
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            friction: 8,
            tension: 70,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  // Dragging only moves the card; tapping expands it and the close button dismisses it.
  const miniPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 6 || Math.abs(gesture.dy) > 6,
      onPanResponderGrant: () => {
        miniDragStartRef.current = { ...miniPositionRef.current };
        Haptics.selection();
      },
      onPanResponderMove: (_, gesture) => {
        const position = clampMiniPlayerPosition({
          x: miniDragStartRef.current.x + gesture.dx,
          y: miniDragStartRef.current.y + gesture.dy,
        }, miniBoundsRef.current);
        miniPositionRef.current = position;
        miniTranslateX.setValue(position.x);
        miniTranslateY.setValue(position.y);
      },
      onPanResponderRelease: () => {
        miniDragStartRef.current = { ...miniPositionRef.current };
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderTerminate: () => {
        miniDragStartRef.current = { ...miniPositionRef.current };
      },
    })
  ).current;

  // Fetch comments when currentVideo changes
  useEffect(() => {
    let isMounted = true;
    if (currentVideo?.id) {
      setLoadingComments(true);
      YouTubeExploreService.comments(currentVideo.id).then(page => page.items)
        .then((data) => {
          if (isMounted) {
            setComments(data);
            setLoadingComments(false);
          }
        })
        .catch(() => {
          if (isMounted) setLoadingComments(false);
        });
    }
    return () => {
      isMounted = false;
    };
  }, [currentVideo?.id]);

  if (
    !currentVideo ||
    isShortsPlayerVisible ||
    currentVideo.streamType === 'SHORTS' ||
    currentVideo.title.toLowerCase().includes('#shorts')
  ) {
    return null;
  }

  const activeVideo = currentVideo;
  const channelId = streamBundle?.uploaderId || activeVideo.uploaderId || activeVideo.uploaderName;
  const favorited = isFavorite(activeVideo.id);
  const subscribed = isSubscribed(channelId);

  const handleMinimize = () => {
    setMinimized(true);
  };

  const handleFavoriteToggle = async () => {
    await toggleFavorite(user?.uid, activeVideo);
  };

  const handleSubscribeToggle = async () => {
    await toggleSubscription(user?.uid, {
      id: channelId,
      name: streamBundle?.uploaderName || activeVideo.uploaderName,
      avatarUrl:
        channelAvatarUrl ||
        streamBundle?.uploaderAvatarUrl ||
        'https://www.gstatic.com/youtube/img/creator/avatar/default_avatar.png',
    });
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `${activeVideo.title}\nhttps://youtu.be/${activeVideo.id}`,
        title: activeVideo.title,
      });
    } catch {
      // Ignored
    }
  };

  const handleDownload = () => useDownloadSheetStore.getState().open(activeVideo);

  const handleRelatedVideoPress = (item: VideoItem) => {
    loadAndPlay(item);
  };

  const relatedList = filterRecommendations(streamBundle?.relatedVideos || [], preferences, history.map(x => x.videoId));
  const topComment = comments[0];

  const resolvedAvatarUri =
    channelAvatarUrl ||
    (streamBundle?.uploaderAvatarUrl && !streamBundle.uploaderAvatarUrl.includes('hqdefault.jpg')
      ? streamBundle.uploaderAvatarUrl
      : null) ||
    (activeVideo.uploaderAvatarUrl && !activeVideo.uploaderAvatarUrl.includes('hqdefault.jpg')
      ? activeVideo.uploaderAvatarUrl
      : null) ||
    'https://www.gstatic.com/youtube/img/creator/avatar/default_avatar.png';

  const viewCount = streamBundle?.viewCount || activeVideo.viewCount || 0;
  const compactViews = formatCompactViews(viewCount);
  const uploadDateText = streamBundle?.uploadDate || activeVideo.uploadDate || '';
  const allHashtags = extractHashtags((streamBundle?.description || '') + ' ' + (activeVideo.title || ''));
  const firstHashtag = allHashtags[0] || '';
  const stableTopInset = isFullscreen
    ? 0
    : Platform.OS === 'android'
      ? Math.max(insets.top, StatusBar.currentHeight || 0)
      : insets.top;


  return (
    <View
      pointerEvents={isMinimized ? 'box-none' : 'auto'}
      style={[
        styles.overlayContainer,
        {
          backgroundColor: isMinimized ? 'transparent' : '#000000',
          zIndex: isMinimized ? 9999 : 1000,
          elevation: isMinimized ? 25 : 20,
        },
      ]}
    >
      <StatusBar hidden={isFullscreen} barStyle="light-content" backgroundColor="transparent" translucent />
      {/* Full Player Backdrop & Details (hidden when minimized) */}
      {!isMinimized && (
        <Animated.View
          style={[
            styles.safeContainer,
            {
              paddingTop: stableTopInset,
              transform: [{ translateY }],
            },
          ]}
        >
          {/* Spacer equal to video height so details scroll underneath */}
          <View style={{ height: isFullscreen ? windowHeight : (windowWidth * 9) / 16 }} />

          {/* Video Details & Meta */}
          {!isFullscreen && (
            <ScrollView style={styles.detailsScroll} showsVerticalScrollIndicator={false}>
            <View style={styles.metaContainer}>
            {/* Video Title */}
            <TouchableOpacity
              activeOpacity={0.88}
              onPress={() => toggleDescExpanded()}
            >
              <Text style={styles.videoTitle}>{activeVideo.title}</Text>
            </TouchableOpacity>

            {/* When collapsed: stats row with ...more */}
            {!descExpanded ? (
              <TouchableOpacity
                style={styles.collapsedStatsRow}
                activeOpacity={0.75}
                onPress={() => toggleDescExpanded(true)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.collapsedStatsText} numberOfLines={1}>
                  {compactViews}   {uploadDateText ? `${uploadDateText}   ` : ''}{firstHashtag ? `${firstHashtag}   ` : ''}
                  <Text style={styles.moreHintText}>...more</Text>
                </Text>
              </TouchableOpacity>
            ) : (
              /* When expanded: inline description (No modal!) */
              <View style={styles.inlineDescContainer}>
                <View style={styles.inlineDescStatsRow}>
                  <Text style={styles.inlineDescStatItem}>
                    {viewCount.toLocaleString('tr-TR')} görüntüleme
                  </Text>
                  <Text style={styles.inlineDescDot}>•</Text>
                  <Text style={styles.inlineDescStatItem}>
                    {uploadDateText || 'Yeni'}
                  </Text>
                </View>

                {allHashtags.length > 0 && (
                  <View style={styles.inlineHashtagsRow}>
                    {allHashtags.map((tag, idx) => (
                      <Text key={idx} style={styles.inlineHashtagText}>
                        {tag}{' '}
                      </Text>
                    ))}
                  </View>
                )}

                <View style={styles.inlineDescTextBox}>
                  {streamBundle?.description ? (
                    renderFormattedDescription(
                      streamBundle.description,
                      (seconds) => {
                        requestSeek(seconds);
                      },
                      styles.descTextParagraph,
                      styles.descLinkText,
                      styles.descTimestampText
                    )
                  ) : (
                    <Text style={styles.emptyDescText}>Bu video için açıklama bulunmuyor.</Text>
                  )}
                </View>

                <TouchableOpacity
                  style={styles.showLessBtn}
                  activeOpacity={0.75}
                  onPress={() => toggleDescExpanded(false)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={styles.showLessText}>...less</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Channel Info Row directly below video metadata */}
            <View style={styles.channelRow}>
              <View style={styles.channelLeft}>
                {resolvedAvatarUri && !resolvedAvatarUri.includes('default_avatar') ? (
                  <Image
                    source={{ uri: resolvedAvatarUri }}
                    style={styles.channelAvatar}
                  />
                ) : (
                  <View
                    style={[
                      styles.channelAvatar,
                      styles.channelAvatarFallback,
                      { backgroundColor: THEME.colors.primary },
                    ]}
                  >
                    <Text style={styles.channelAvatarInitial}>
                      {(activeVideo.uploaderName || 'K').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={styles.channelInfo}>
                  <View style={styles.channelNameRow}>
                    <Text style={styles.channelName} numberOfLines={1}>
                      {activeVideo.uploaderName}
                    </Text>
                    <Ionicons name="checkmark-circle" size={13} color="#AAAAAA" style={{ marginLeft: 4 }} />
                  </View>
                  <Text style={styles.subCountText}>
                    {streamBundle?.uploaderSubscriberCount || 'Kanal'}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.subBtn, subscribed && styles.subBtnActive]}
                onPress={handleSubscribeToggle}
                activeOpacity={0.8}
              >
                <Text style={[styles.subBtnText, subscribed && styles.subBtnTextActive]}>
                  {subscribed ? 'Abonesin' : 'Abone Ol'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* YouTube Authentic Horizontal Action Pill Chips */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.actionPillsContainer}
            >
              {/* Like / Dislike Dual Pill */}
              <View style={styles.likeDislikePill}>
                <TouchableOpacity
                  style={styles.likePillBtn}
                  activeOpacity={0.7}
                  onPress={handleFavoriteToggle}
                >
                  <Ionicons
                    name={favorited ? 'thumbs-up' : 'thumbs-up-outline'}
                    size={17}
                    color={favorited ? THEME.colors.primary : '#FFFFFF'}
                  />
                  <Text
                    style={[
                      styles.pillText,
                      favorited && { color: THEME.colors.primary, fontWeight: '700' },
                    ]}
                  >
                    {favorited ? 'Beğenildi' : 'Beğen'}
                  </Text>
                </TouchableOpacity>
                <View style={styles.pillDivider} />
                <TouchableOpacity
                  style={styles.dislikePillBtn}
                  activeOpacity={0.7}
                  onPress={() => alert('Geri bildiriminiz kaydedildi.')}
                >
                  <Ionicons name="thumbs-down-outline" size={17} color="#FFFFFF" />
                </TouchableOpacity>
              </View>

              {/* Share Pill */}
              <TouchableOpacity
                style={styles.actionPill}
                activeOpacity={0.75}
                onPress={handleShare}
              >
                <Ionicons name="share-social-outline" size={17} color="#FFFFFF" />
                <Text style={styles.pillText}>Paylaş</Text>
              </TouchableOpacity>

              {/* Download Pill (Remix ignored per user instruction) */}
              <TouchableOpacity
                style={styles.actionPill}
                activeOpacity={0.75}
                onPress={handleDownload}
              >
                <Ionicons name="arrow-down-circle-outline" size={18} color="#FFFFFF" />
                <Text style={styles.pillText}>İndir</Text>
              </TouchableOpacity>
            </ScrollView>

            {/* Comments Preview Card */}
            <TouchableOpacity
              style={styles.commentsCard}
              activeOpacity={0.8}
              onPress={() => setShowCommentsModal(true)}
            >
              <View style={styles.commentsHeader}>
                <Text style={styles.commentsTitle}>
                  Yorumlar{' '}
                  <Text style={styles.commentsCount}>
                    {comments.length > 0 ? `(${comments.length})` : ''}
                  </Text>
                </Text>
                <Ionicons name="chevron-forward" size={18} color={THEME.colors.textSecondary} />
              </View>

              {loadingComments ? (
                <ActivityIndicator size="small" color={THEME.colors.primary} style={{ marginVertical: 8 }} />
              ) : topComment ? (
                <View style={styles.topCommentRow}>
                  <Image
                    source={{ uri: topComment.authorThumbnail }}
                    style={styles.commentAvatarMini}
                  />
                  <Text style={styles.topCommentText} numberOfLines={2}>
                    <Text style={styles.topCommentAuthor}>{topComment.authorName} </Text>
                    {topComment.commentText}
                  </Text>
                </View>
              ) : (
                <Text style={styles.noCommentsText}>Yorumları görüntülemek için dokunun...</Text>
              )}
            </TouchableOpacity>

            {/* Related Videos Section */}
            {relatedList.length > 0 && (
              <View style={styles.relatedSection}>
                <Text style={styles.relatedSectionTitle}>Önerilen Videolar</Text>
                {relatedList.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.relatedCard}
                    activeOpacity={0.7}
                    onPress={() => handleRelatedVideoPress(item)}
                  >
                    <View style={[styles.relatedThumb, { overflow: 'hidden' }]}>
                      <Image source={{ uri: item.thumbnailUrl || `https://i.ytimg.com/vi/${item.id}/hqdefault.jpg` }} style={StyleSheet.absoluteFill} />
                      <WatchProgressBar videoId={item.id} duration={item.duration} position={item.progress} isLive={item.isLive} />
                    </View>
                    <View style={styles.relatedInfo}>
                      <Text style={styles.relatedTitle} numberOfLines={2}>
                        {item.title}
                      </Text>
                      <Text style={styles.relatedUploader} numberOfLines={1}>
                        {item.uploaderName}
                      </Text>
                      <Text style={styles.relatedViews}>
                        {item.viewCount ? `${item.viewCount.toLocaleString('tr-TR')} görüntüleme` : 'YouTube'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </ScrollView>
        )}
        </Animated.View>
      )}

      {/* Video Canvas Player: Persistent instance, morphs between full screen and floating mini player */}
      <Animated.View
        style={
          isFullscreen
            ? StyleSheet.absoluteFill
            : isMinimized
              ? [
                  styles.miniPlayerCard,
                  {
                    bottom: miniLayout.bottom,
                    left: miniLayout.left,
                    width: miniLayout.width,
                    transform: [{ translateX: miniTranslateX }, { translateY: miniTranslateY }],
                  },
                ]
              : [
                  styles.fullPlayerWrapper,
                  {
                    top: stableTopInset,
                    width: windowWidth,
                    height: isFullscreen ? windowHeight : (windowWidth * 9) / 16,
                    transform: [{ translateY }],
                  },
                ]
        }
        {...(isMinimized
          ? miniPanResponder.panHandlers
          : !isFullscreen
            ? panResponder.panHandlers
            : {})}
      >
        <PlayerView onMinimize={handleMinimize} />
      </Animated.View>

      {/* Interactive Comments Modal (only in full player mode) */}
      <CommentsSheet visible={!isMinimized && showCommentsModal} videoId={activeVideo.id} channelId={streamBundle?.uploaderId || activeVideo.uploaderId} onClose={() => setShowCommentsModal(false)} />
    </View>
  );
};

const styles = StyleSheet.create({
  overlayContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    elevation: 20,
    backgroundColor: '#000000',
  },
  safeContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  fullPlayerWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: (SCREEN_WIDTH * 9) / 16,
    zIndex: 20,
    elevation: 20,
  },
  miniPlayerCard: {
    position: 'absolute',
    height: MINI_PLAYER_HEIGHT,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#000000',
    elevation: 25,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    borderWidth: 0,
    zIndex: 9999,
  },
  detailsScroll: {
    flex: 1,
    backgroundColor: '#000000',
  },
  metaContainer: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 16,
  },
  videoTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    lineHeight: 24,
  },
  collapsedStatsRow: {
    paddingVertical: 4,
    marginTop: 4,
  },
  collapsedStatsText: {
    fontSize: 12,
    color: '#AAAAAA',
    lineHeight: 18,
  },
  moreHintText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  actionPillsContainer: {
    paddingVertical: 10,
    gap: 8,
  },
  likeDislikePill: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginRight: 8,
  },
  likePillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 14,
    paddingRight: 10,
    height: 36,
  },
  pillDivider: {
    width: 1,
    height: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
  },
  dislikePillBtn: {
    paddingLeft: 10,
    paddingRight: 14,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginRight: 8,
  },
  pillText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  channelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    marginTop: 4,
  },
  channelLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  channelAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: THEME.colors.surface,
  },
  channelAvatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  channelAvatarInitial: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  channelInfo: {
    marginLeft: 11,
    flex: 1,
  },
  channelNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  channelName: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  subCountText: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.55)',
    marginTop: 2,
  },
  subBtn: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 18,
  },
  subBtnActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  subBtnText: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '700',
  },
  subBtnTextActive: {
    color: 'rgba(255, 255, 255, 0.85)',
  },
  inlineDescContainer: {
    backgroundColor: '#212121',
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  inlineDescStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  inlineDescStatItem: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  inlineDescDot: {
    color: '#888888',
    marginHorizontal: 6,
    fontSize: 12,
  },
  inlineHashtagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  inlineHashtagText: {
    color: '#3EA6FF',
    fontSize: 12,
    fontWeight: '600',
    marginRight: 6,
  },
  inlineDescTextBox: {
    marginTop: 2,
  },
  showLessBtn: {
    alignSelf: 'flex-start',
    marginTop: 10,
    paddingVertical: 2,
  },
  showLessText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  descTextParagraph: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.9)',
    lineHeight: 20,
  },
  descLinkText: {
    color: '#3EA6FF',
    textDecorationLine: 'underline',
  },
  descTimestampText: {
    color: '#3EA6FF',
    fontWeight: '700',
  },
  emptyDescText: {
    fontSize: 13,
    color: '#888888',
    fontStyle: 'italic',
    marginTop: 10,
  },
  commentsCard: {
    backgroundColor: '#272727',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  commentsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  commentsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  commentsCount: {
    fontSize: 13,
    fontWeight: '400',
    color: THEME.colors.textSecondary,
  },
  topCommentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 4,
  },
  commentAvatarMini: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 8,
  },
  topCommentText: {
    flex: 1,
    fontSize: 12,
    color: THEME.colors.textPrimary,
    lineHeight: 17,
  },
  topCommentAuthor: {
    fontWeight: '700',
    color: THEME.colors.textSecondary,
  },
  noCommentsText: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    fontStyle: 'italic',
  },
  relatedSection: {
    marginTop: 8,
  },
  relatedSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    marginBottom: 12,
  },
  relatedCard: {
    flexDirection: 'row',
    marginBottom: 14,
  },
  relatedThumb: {
    width: 120,
    height: 68,
    borderRadius: 8,
    backgroundColor: THEME.colors.surface,
  },
  relatedInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  relatedTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
    lineHeight: 18,
  },
  relatedUploader: {
    fontSize: 11,
    color: THEME.colors.textSecondary,
    marginTop: 4,
  },
  relatedViews: {
    fontSize: 11,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'flex-end',
  },
  commentsSheet: {
    backgroundColor: THEME.colors.surfaceElevated,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    maxHeight: '75%',
    paddingBottom: 24,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  closeModalBtn: {
    padding: 4,
  },
  commentItem: {
    flexDirection: 'row',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  commentAuthorAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: THEME.colors.surface,
    marginRight: 12,
  },
  commentContent: {
    flex: 1,
  },
  commentMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  commentAuthorName: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    marginRight: 8,
  },
  commentTime: {
    fontSize: 11,
    color: THEME.colors.textSecondary,
  },
  commentBody: {
    fontSize: 13,
    color: THEME.colors.textPrimary,
    lineHeight: 18,
  },
  commentLikesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  commentLikesText: {
    fontSize: 11,
    color: THEME.colors.textSecondary,
    marginLeft: 4,
  },
  emptyCommentsBox: {
    padding: 32,
    alignItems: 'center',
  },
  emptyCommentsText: {
    color: THEME.colors.textSecondary,
    fontSize: 14,
  },
});
