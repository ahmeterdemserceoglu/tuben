import { useRecommendationStore, filterRecommendations } from '../store/useRecommendationStore';
import { WatchProgressBar } from '../components/WatchProgressBar';
import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StatusBar,
  Image,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { YouTubeService } from '../services/youtubeService';
import { useYouTubeAuth } from '../auth/useYouTubeAuth';
import { VideoItem } from '../types/video';
import { VideoCard } from '../components/VideoCard';
import { ShortsCarousel } from '../components/ShortsCarousel';
import { CompactVideoRow } from '../components/CompactVideoRow';
import { VideoCardSkeleton, ShortsSkeleton } from '../components/common/Skeleton';
import { EmptyState } from '../components/common/EmptyState';
import { THEME } from '../constants/theme';
import { useThemeStore } from '../store/useThemeStore';
import { usePlayerStore } from '../store/usePlayerStore';
import { useLibraryStore } from '../store/useLibraryStore';
import { useAuth } from '../auth/AuthContext';
import { Haptics } from '../utils/haptics';

export const HomeScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [feedError, setFeedError] = useState<string | null>(null);
  const requestId = useRef(0);
  const { authenticated: isYouTubeAuth, ready: authReady, revision: authRevision } = useYouTubeAuth();

  const [shortsList, setShortsList] = useState<VideoItem[]>([]);
  const [regularVideos, setRegularVideos] = useState<VideoItem[]>([]);

  const colors = useThemeStore((s) => s.colors);
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { history, loadLibrary } = useLibraryStore();

  useEffect(() => {
    void loadLibrary(user?.uid);
  }, [user?.uid, loadLibrary]);

  const fetchVideos = useCallback(async () => {
    if (!authReady) return;
    const currentRequest = ++requestId.current;
    setFeedError(null);
    try {
      const isAuth = isYouTubeAuth;
      const [results, initialShorts] = await Promise.all([
        YouTubeService.getHomeFeed(selectedCategory),
        !isAuth ? YouTubeService.searchVideos('#shorts trend türkiye').catch(() => []) : Promise.resolve([]),
      ]);

      const detectedShorts: VideoItem[] = [];
      const regular: VideoItem[] = [];

      results.forEach((v) => {
        const isShort =
          v.streamType === 'SHORTS' ||
          v.title.toLowerCase().includes('#shorts');

        if (isShort) {
          detectedShorts.push(v);
        } else {
          regular.push(v);
        }
      });

      const combinedShortsMap = new Map<string, VideoItem>();
      detectedShorts.forEach((s) => combinedShortsMap.set(s.id, s));

      // If we don't have enough shorts from personal recommendations, fetch popular shorts
      if (!isAuth && combinedShortsMap.size < 4) {
        const extra = initialShorts.length > 0
          ? initialShorts
          : await YouTubeService.searchVideos('#shorts trend türkiye').catch(() => []);
        extra.forEach((s) => {
          if (!combinedShortsMap.has(s.id)) {
            combinedShortsMap.set(s.id, s);
          }
        });
      }

      if (currentRequest !== requestId.current) return;
      setShortsList(Array.from(combinedShortsMap.values()).slice(0, 12));
      setRegularVideos(regular);
      setVideos(results);
    } catch (error) {
      if (currentRequest !== requestId.current) return;
      setVideos([]);
      setShortsList([]);
      setRegularVideos([]);
      setFeedError(error instanceof Error ? error.message : 'YouTube akışı yüklenemedi.');
    } finally {
      if (currentRequest === requestId.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [selectedCategory, isYouTubeAuth, authReady, authRevision]);

  useEffect(() => {
    setLoading(true);
    setVideos([]);
    setShortsList([]);
    setRegularVideos([]);
    void fetchVideos();
    return () => { requestId.current++; };
  }, [fetchVideos]);

  const categories = useMemo(() => [
    { id: 'all', label: isYouTubeAuth ? 'Sana Özel' : 'Tümü' },
    { id: 'trending', label: 'Trendler' },
    { id: 'music', label: 'Müzik' },
    { id: 'gaming', label: 'Oyun' },
    { id: 'news', label: 'Haberler' },
    { id: 'tech', label: 'Teknoloji' },
  ], [isYouTubeAuth]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchVideos();
  };

  const handleShortsPress = (short: VideoItem) => {
    Haptics.selection();
    void usePlayerStore.getState().playShorts(short, shortsList);
  };

  const handleVideoPress = (video: VideoItem) => {
    Haptics.selection();
    void usePlayerStore.getState().playVideo(video, filterRecommendations(videos, useRecommendationStore.getState(), history.map(x => x.videoId)));
  };

  // Recent history items for "Devam Et"
  const recentHistory = useMemo(() => {
    return history.slice(0, 4);
  }, [history]);

  // Construct composite feed: first 2 regular videos -> Shorts shelf -> 2 videos -> Devam Et shelf (if history exists) -> remaining videos
  const preferences = useRecommendationStore();
  const watchedIds = history.map(x => x.videoId);
  const visibleRegular = filterRecommendations(regularVideos, preferences, watchedIds);
  const visibleShorts = filterRecommendations(shortsList, preferences, watchedIds);
  const feedItems = useMemo(() => {
    type FeedItem =
      | { type: 'video'; id: string; video: VideoItem }
      | { type: 'shorts'; id: string; shorts: VideoItem[] }
      | { type: 'continue'; id: string; items: typeof recentHistory };

    if (visibleRegular.length === 0) {
      if (visibleShorts.length > 0) {
        return [{ type: 'shorts' as const, id: 'shorts-shelf', shorts: visibleShorts }];
      }
      return [] as FeedItem[];
    }

    const items: FeedItem[] = [];
    const SHORTS_POSITION = 2; // Show 2 regular recommended videos, then Shorts section
    const CONTINUE_POSITION = 4; // Show Continue watching shelf further down after video 4

    visibleRegular.forEach((video, index) => {
      if (index === SHORTS_POSITION && visibleShorts.length > 0) {
        items.push({ type: 'shorts', id: 'shorts-shelf', shorts: visibleShorts });
      }
      if (index === CONTINUE_POSITION && recentHistory.length > 0 && selectedCategory === 'all') {
        items.push({ type: 'continue', id: 'continue-shelf', items: recentHistory });
      }
      items.push({ type: 'video', id: `video-${video.id}-${index}`, video });
    });

    if (visibleRegular.length <= SHORTS_POSITION && visibleShorts.length > 0) {
      items.push({ type: 'shorts', id: 'shorts-shelf', shorts: visibleShorts });
    }

    return items;
  }, [visibleRegular, visibleShorts, recentHistory, selectedCategory]);

  const feedHeader = (
    <View style={{ paddingTop: insets.top + 10 }}>
      <View style={styles.headerRow}>
        <View style={styles.brandLockup}>
          <View style={styles.brandRow}>
            <Text style={styles.brandName}>TUBEN</Text>
            <View style={styles.brandDot} />
          </View>
          <Text style={styles.subBrand}>Sınırsız & Reklamsız Video</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity accessibilityLabel="Ara" style={styles.headerAction} activeOpacity={0.7} onPress={() => navigation.navigate('Search')}>
            <Ionicons name="search-outline" size={17} color={THEME.colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity accessibilityLabel="Ayarlar" style={styles.headerAction} activeOpacity={0.7} onPress={() => navigation.navigate('Settings')}>
            <Ionicons name="settings-outline" size={17} color={THEME.colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity accessibilityLabel={user ? 'Profil' : 'Giriş yap'} style={styles.headerAction} activeOpacity={0.7} onPress={() => navigation.navigate(user ? 'Library' : 'Auth')}>
            {user?.photoURL
              ? <Image source={{ uri: user.photoURL }} style={styles.profileAvatar} />
              : <Ionicons name={user ? 'person-circle' : 'person-outline'} size={20} color={user ? THEME.colors.primary : THEME.colors.textSecondary} />}
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.topFilterBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesContent}
        >
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.categoryChip,
                  {
                    backgroundColor: isSelected ? '#FFFFFF' : colors.surfaceElevated,
                    borderColor: 'transparent',
                  },
                ]}
                activeOpacity={0.75}
                onPress={() => {
                  Haptics.selection();
                  setSelectedCategory(cat.id);
                }}
              >
                <Text
                  style={[
                    styles.categoryChipText,
                    isSelected && styles.categoryChipTextActive,
                  ]}
                >
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );

  return (
    <SafeAreaView edges={['left', 'right']} style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Loading Skeletons */}
      {loading && !refreshing ? (
        <ScrollView style={styles.skeletonContainer} showsVerticalScrollIndicator={false}>
          {feedHeader}
          <VideoCardSkeleton />
          <View style={{ flexDirection: 'row', paddingHorizontal: 12, marginBottom: 16 }}>
            <ShortsSkeleton />
            <ShortsSkeleton />
            <ShortsSkeleton />
          </View>
          <VideoCardSkeleton />
        </ScrollView>
      ) : videos.length === 0 ? (
        <View style={{ flex: 1 }}>{feedHeader}
        <EmptyState
          icon="film-outline"
          title={feedError ? 'Akış Yüklenemedi' : 'Video Bulunamadı'}
          description={feedError || 'Bu kategoride gösterilecek video bulunamadı.'}
          actionLabel="Tekrar Dene"
          onAction={fetchVideos}
        />
        </View>
      ) : (
        <FlatList
          data={feedItems}
          ListHeaderComponent={feedHeader}
          showsVerticalScrollIndicator={false}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            if (item.type === 'shorts') {
              return (
                <ShortsCarousel
                  shorts={item.shorts}
                  onPress={handleShortsPress}
                />
              );
            }
            if (item.type === 'continue') {
              return (
                <View style={styles.sectionBlock}>
                  <View style={styles.sectionHeader}>
                    <Ionicons name="time-outline" size={17} color={THEME.colors.primary} />
                    <Text style={styles.sectionTitle}>İzlemeye Devam Et</Text>
                  </View>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.continueScroll}
                  >
                    {item.items.map((hist) => (
                      <TouchableOpacity
                        key={hist.videoId}
                        style={[styles.continueCard, { backgroundColor: colors.surface }]}
                        activeOpacity={0.88}
                        onPress={() =>
                          handleVideoPress({
                            id: hist.videoId,
                            title: hist.title,
                            uploaderName: hist.channelTitle || '',
                            thumbnailUrl: hist.thumbnailUrl,
                            duration: hist.duration || 0,
                            viewCount: 0,
                          })
                        }
                      >
                        <View style={[styles.continueThumb, { overflow: 'hidden' }]}>
                          <Image source={{ uri: hist.thumbnailUrl }} style={StyleSheet.absoluteFill} />
                          <WatchProgressBar videoId={hist.videoId} duration={hist.duration} position={hist.lastPosition} />
                        </View>
                        <View style={styles.continueInfo}>
                          <Text style={styles.continueTitle} numberOfLines={1}>
                            {hist.title}
                          </Text>
                          <Text style={styles.continueChannel} numberOfLines={1}>
                            {hist.channelTitle}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              );
            }
            return (
              <VideoCard
                video={item.video}
                onPress={handleVideoPress}
                onChannelPress={(channelName, channelId) =>
                  navigation.navigate('Channel', {
                    channelId: channelId || channelName,
                    channelName,
                  })
                }
              />
            );
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={THEME.colors.primary}
              colors={[THEME.colors.primary]}
            />
          }
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 100 }]}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 20, gap: 10 },
  brandLockup: { flexShrink: 1 },
  brandRow: { flexDirection: 'row', alignItems: 'baseline' },
  brandName: { fontSize: 26, fontWeight: '900', color: '#FFFFFF', letterSpacing: -0.5 },
  brandDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: THEME.colors.primary, marginLeft: 4, marginBottom: 4 },
  subBrand: { fontSize: 12, color: THEME.colors.textTertiary, marginTop: 2, fontWeight: '500' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerAction: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  profileAvatar: { width: 26, height: 26, borderRadius: 13 },
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  topFilterBar: {
    paddingTop: 4,
    paddingBottom: 16,
  },
  categoriesContent: {
    paddingHorizontal: 12,
    alignItems: 'center',
    gap: 8,
  },
  searchChip: {
    width: 38,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
  },
  categoryChipText: {
    color: 'rgba(255, 255, 255, 0.88)',
    fontSize: 13,
    fontWeight: '600',
  },
  categoryChipTextActive: {
    color: '#000000',
    fontWeight: '700',
  },
  skeletonContainer: {
    flex: 1,
    paddingTop: 12,
  },
  listContent: {
    paddingBottom: 72,
  },
  sectionBlock: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    letterSpacing: -0.2,
  },
  continueScroll: {
    paddingHorizontal: 12,
    gap: 10,
  },
  continueCard: {
    width: 170,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  continueThumb: {
    width: '100%',
    height: 95,
    backgroundColor: '#000',
  },
  continueInfo: {
    padding: 8,
  },
  continueTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  continueChannel: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 10,
  },
});
