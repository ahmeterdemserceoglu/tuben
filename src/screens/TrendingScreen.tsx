import { useRecommendationStore, filterRecommendations } from '../store/useRecommendationStore';
import { useLibraryStore } from '../store/useLibraryStore';
import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { YouTubeService } from '../services/youtubeService';
import { useYouTubeAuth } from '../auth/useYouTubeAuth';
import { VideoItem } from '../types/video';
import { VideoCard } from '../components/VideoCard';
import { VideoCardSkeleton } from '../components/common/Skeleton';
import { EmptyState } from '../components/common/EmptyState';
import { THEME } from '../constants/theme';
import { useThemeStore } from '../store/useThemeStore';
import { usePlayerStore } from '../store/usePlayerStore';
import { Haptics } from '../utils/haptics';

const BASE_CATEGORIES = [
  { id: 'now', label: 'Trendler', icon: 'flame', query: 'trend türkiye' },
  { id: 'music', label: 'Müzik', icon: 'musical-notes', query: 'trend müzik' },
  { id: 'gaming', label: 'Oyun', icon: 'game-controller', query: 'trend oyun' },
  { id: 'movies', label: 'Filmler', icon: 'film', query: 'trend film fragman' },
];

export const TrendingScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const preferences = useRecommendationStore();
  const history = useLibraryStore(s => s.history);
  const colors = useThemeStore((s) => s.colors);
  const { authenticated: isYouTubeAuth, ready: authReady, revision: authRevision } = useYouTubeAuth();
  const [feedError, setFeedError] = useState<string | null>(null);
  const requestId = useRef(0);
  const [activeCat, setActiveCat] = useState('now');
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!authReady) return;
    setActiveCat((previous) => isYouTubeAuth ? 'foryou' : previous === 'foryou' ? 'now' : previous);
  }, [isYouTubeAuth, authReady, authRevision]);

  const categories = React.useMemo(() => {
    if (isYouTubeAuth) {
      return [
        { id: 'foryou', label: 'Sana Özel', icon: 'sparkles', query: 'foryou' },
        ...BASE_CATEGORIES,
      ];
    }
    return BASE_CATEGORIES;
  }, [isYouTubeAuth]);

  const fetchTrending = useCallback(async () => {
    if (!authReady) return;
    const currentRequest = ++requestId.current;
    setFeedError(null);
    try {
      const items = await YouTubeService.getTrendingVideos(activeCat);
      if (currentRequest === requestId.current) setVideos(items);
    } catch (error) {
      if (currentRequest !== requestId.current) return;
      setVideos([]);
      setFeedError(error instanceof Error ? error.message : 'YouTube akışı yüklenemedi.');
    } finally {
      if (currentRequest === requestId.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [activeCat, isYouTubeAuth, authReady, authRevision]);

  useEffect(() => {
    setLoading(true);
    setVideos([]);
    void fetchTrending();
    return () => { requestId.current++; };
  }, [fetchTrending]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchTrending();
  };

  const handleVideoPress = (video: VideoItem) => {
    Haptics.selection();
    usePlayerStore.getState().loadAndPlay(video);
    usePlayerStore.getState().setMinimized(false);
  };

  const handleChannelPress = (channelName: string, channelId?: string) => {
    navigation.navigate('Channel', { channelId: channelId || channelName, channelName });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.divider || 'rgba(255,255,255,0.06)' }]}>
        <View style={styles.headerLeft}>
          <Ionicons name="compass" size={24} color={THEME.colors.primary} style={{ marginRight: 8 }} />
          <Text style={styles.headerTitle}>Keşfet</Text>
          {isYouTubeAuth && activeCat === 'foryou' && !feedError && videos.length > 0 && (
            <View style={styles.syncBadge}>
              <Ionicons name="sparkles" size={11} color={THEME.colors.primary} />
              <Text style={styles.syncBadgeText}>Kişiselleştirildi</Text>
            </View>
          )}
        </View>
        <TouchableOpacity
          style={[styles.iconBtn, { backgroundColor: colors.surfaceElevated }]}
          onPress={() => navigation.navigate('Search')}
        >
          <Ionicons name="search-outline" size={20} color={THEME.colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* Category Pills Bar */}
      <View style={[styles.catBarWrapper, { borderBottomColor: colors.divider || 'rgba(255,255,255,0.06)' }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.catBarContent}
        >
          {categories.map((cat) => {
            const isSelected = activeCat === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.catChip,
                  {
                    backgroundColor: isSelected ? THEME.colors.primary : colors.surfaceElevated,
                    borderColor: isSelected ? THEME.colors.primary : colors.surfaceBorder || 'rgba(255,255,255,0.08)',
                  },
                ]}
                activeOpacity={0.8}
                onPress={() => {
                  Haptics.selection();
                  setActiveCat(cat.id);
                }}
              >
                <Ionicons
                  name={cat.icon as any}
                  size={14}
                  color={isSelected ? '#FFFFFF' : THEME.colors.textSecondary}
                  style={{ marginRight: 5 }}
                />
                <Text style={[styles.catText, isSelected && styles.catTextActive]}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Video Feed */}
      {loading && !refreshing ? (
        <ScrollView style={{ flex: 1, paddingTop: 12 }}>
          <VideoCardSkeleton />
          <VideoCardSkeleton />
        </ScrollView>
      ) : videos.length === 0 ? (
        <EmptyState
          icon="flame-outline"
          title={feedError ? 'Akış Yüklenemedi' : 'Video Bulunamadı'}
          description={feedError || 'Bu kategoride gösterilecek video bulunamadı.'}
          actionLabel="Tekrar Dene"
          onAction={fetchTrending}
        />
      ) : (
        <FlatList
          data={filterRecommendations(videos, preferences, history.map(x => x.videoId))}
          keyExtractor={(item, index) => `${item.id}_${index}`}
          renderItem={({ item }) => (
            <VideoCard
              video={item}
              onPress={handleVideoPress}
              onChannelPress={handleChannelPress}
            />
          )}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={THEME.colors.primary}
              colors={[THEME.colors.primary]}
            />
          }
          contentContainerStyle={styles.listContent}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
    letterSpacing: -0.5,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catBarWrapper: {
    borderBottomWidth: 1,
    paddingVertical: 10,
  },
  catBarContent: {
    paddingHorizontal: 12,
    gap: 8,
  },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  catText: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
  },
  catTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  syncBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 68, 68, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    marginLeft: 8,
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 68, 68, 0.25)',
  },
  syncBadgeText: {
    color: THEME.colors.primary,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  listContent: {
    paddingTop: 8,
    paddingBottom: 80,
  },
});
