import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Image,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../auth/AuthContext';
import { useLibraryStore } from '../store/useLibraryStore';
import { YouTubeService } from '../services/youtubeService';
import { VideoItem } from '../types/video';
import { VideoCard } from '../components/VideoCard';
import { VideoCardSkeleton } from '../components/common/Skeleton';
import { EmptyState } from '../components/common/EmptyState';
import { THEME } from '../constants/theme';
import { useThemeStore } from '../store/useThemeStore';
import { usePlayerStore } from '../store/usePlayerStore';
import { Haptics } from '../utils/haptics';

import { useYouTubeAuth } from '../auth/useYouTubeAuth';
import { UserSubscription } from '../types/user';

export const SubscriptionsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const colors = useThemeStore((s) => s.colors);
  const { user } = useAuth();
  const { subscriptions, loadLibrary } = useLibraryStore();
  const [feedVideos, setFeedVideos] = useState<VideoItem[]>([]);
  const [personalChannels, setPersonalChannels] = useState<UserSubscription[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { authenticated: isYouTubeAuth, ready: authReady, revision: authRevision } = useYouTubeAuth();
  const [feedError, setFeedError] = useState<string | null>(null);
  const requestId = useRef(0);

  useEffect(() => {
    void loadLibrary(user?.uid);
  }, [user?.uid, loadLibrary]);

  useEffect(() => {
    setPersonalChannels([]);
    setSelectedChannelId(null);
  }, [isYouTubeAuth, authRevision]);

  const loadSubscriptionFeed = useCallback(async () => {
    if (!authReady) return;
    const currentRequest = ++requestId.current;
    setFeedError(null);
    try {
      let videos: VideoItem[] = [];
      let channels: UserSubscription[] = [];
      if (isYouTubeAuth) {
        const personal = await YouTubeService.getPersonalSubscriptionFeed();
        channels = personal.channels;
        videos = personal.videos;
        const selected = channels.find((channel) => channel.channelId === selectedChannelId);
        if (selected) videos = await YouTubeService.getPersonalChannelSubscriptions(selected);
      }
      // Local subscriptions still work alongside the connected YouTube account.
      const local = selectedChannelId
        ? subscriptions.filter((sub) => sub.channelId === selectedChannelId && !channels.some((c) => c.channelId === sub.channelId))
        : subscriptions.filter((sub) => !channels.some((c) => c.channelId === sub.channelId)).slice(0, 12);
      const results = await Promise.allSettled(local.map((sub) => YouTubeService.getChannelDetails(sub.channelId)));
      const unique = new Map<string, VideoItem>(videos.map((video) => [video.id, video]));
      for (const result of results) {
        if (result.status !== 'fulfilled') continue;
        for (const video of result.value.videos.slice(0, 8)) unique.set(video.id, video);
      }
      if (currentRequest !== requestId.current) return;
      setPersonalChannels(channels);
      setFeedVideos(Array.from(unique.values()));
    } catch (error) {
      if (currentRequest !== requestId.current) return;
      setFeedVideos([]);
      setFeedError(error instanceof Error ? error.message : 'YouTube abonelikleri yüklenemedi.');
    } finally {
      if (currentRequest === requestId.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [subscriptions, selectedChannelId, isYouTubeAuth, authReady, authRevision]);

  useEffect(() => {
    setLoading(true);
    setFeedVideos([]);
    void loadSubscriptionFeed();
    return () => { requestId.current++; };
  }, [loadSubscriptionFeed]);

  const onRefresh = () => {
    setRefreshing(true);
    void loadSubscriptionFeed();
  };

  // Combine YouTube synced channels + Tuben app subscriptions
  const allChannels = React.useMemo(() => {
    const map = new Map<string, UserSubscription>();
    for (const c of personalChannels) {
      map.set(c.channelId, c);
    }
    for (const s of subscriptions) {
      if (!map.has(s.channelId)) {
        map.set(s.channelId, s);
      }
    }
    return Array.from(map.values());
  }, [personalChannels, subscriptions]);

  const displayedVideos = React.useMemo(() => {
    if (!selectedChannelId || (isYouTubeAuth && personalChannels.some((c) => c.channelId === selectedChannelId))) return feedVideos;
    const targetChan = allChannels.find((c) => c.channelId === selectedChannelId);
    return feedVideos.filter(
      (v) =>
        v.uploaderId === selectedChannelId ||
        v.uploaderName === selectedChannelId ||
        (targetChan && v.uploaderName?.toLowerCase() === targetChan.channelTitle?.toLowerCase())
    );
  }, [selectedChannelId, feedVideos, allChannels, isYouTubeAuth, personalChannels]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.divider || 'rgba(255,255,255,0.06)' }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={styles.headerTitle}>Abonelikler</Text>
          {isYouTubeAuth && (
            <View style={styles.syncBadge}>
              <Ionicons name="logo-youtube" size={12} color="#FF0000" />
              <Text style={styles.syncBadgeText}>YouTube</Text>
            </View>
          )}
        </View>
        <TouchableOpacity
          style={[styles.searchBtn, { backgroundColor: colors.surfaceElevated }]}
          onPress={() => navigation.navigate('Search')}
        >
          <Ionicons name="search-outline" size={19} color={THEME.colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* Stories Channels Bar */}
      {allChannels.length > 0 && (
        <View style={[styles.channelsBar, { borderBottomColor: colors.divider || 'rgba(255,255,255,0.06)' }]}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.channelsContent}
          >
            {/* "Tümü" option */}
            <TouchableOpacity
              style={styles.channelAvatarItem}
              activeOpacity={0.8}
              onPress={() => {
                Haptics.selection();
                setSelectedChannelId(null);
              }}
            >
              <View
                style={[
                  styles.allPillRing,
                  !selectedChannelId && styles.neonAvatarRingActive,
                ]}
              >
                <Ionicons
                  name="grid-outline"
                  size={20}
                  color={!selectedChannelId ? '#FFFFFF' : THEME.colors.textTertiary}
                />
              </View>
              <Text
                style={[
                  styles.channelName,
                  !selectedChannelId && { color: '#FFFFFF', fontWeight: '700' },
                ]}
              >
                Tümü
              </Text>
            </TouchableOpacity>

            {allChannels.map((sub) => {
              const isSelected = selectedChannelId === sub.channelId;
              return (
                <TouchableOpacity
                  key={sub.channelId}
                  style={styles.channelAvatarItem}
                  activeOpacity={0.8}
                  onPress={() => {
                    Haptics.selection();
                    setSelectedChannelId(isSelected ? null : sub.channelId);
                  }}
                  onLongPress={() =>
                    navigation.navigate('Channel', {
                      channelId: sub.channelId,
                      channelName: sub.channelTitle,
                    })
                  }
                >
                  <View
                    style={[
                      styles.neonAvatarRing,
                      isSelected && styles.neonAvatarRingActive,
                    ]}
                  >
                    <Image source={{ uri: sub.thumbnailUrl }} style={styles.channelAvatar} />
                  </View>
                  <Text
                    style={[
                      styles.channelName,
                      isSelected && { color: '#FFFFFF', fontWeight: '700' },
                    ]}
                    numberOfLines={1}
                  >
                    {sub.channelTitle}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Feed or Skeletons or Empty State */}
      {loading && !refreshing ? (
        <ScrollView style={{ flex: 1, paddingTop: 12 }}>
          <VideoCardSkeleton />
          <VideoCardSkeleton />
        </ScrollView>
      ) : feedError ? (
        <EmptyState
          icon="alert-circle-outline"
          title="Abonelikler Yüklenemedi"
          description={feedError}
          actionLabel="Tekrar Dene"
          onAction={loadSubscriptionFeed}
        />
      ) : allChannels.length === 0 && displayedVideos.length === 0 ? (
        <EmptyState
          icon="albums-outline"
          title={isYouTubeAuth ? 'YouTube Aboneliği Bulunamadı' : 'Henüz Abone Olmadınız'}
          description={isYouTubeAuth
            ? 'Bağlı YouTube hesabında abonelik bulunamadı. Doğru Google hesabını bağladığınızdan emin olun.'
            : "Sevdiğiniz kanallara abone olabilir veya Ayarlar > YouTube Senkronizasyonu ile YouTube hesabınızı bağlayabilirsiniz."}
          actionLabel={isYouTubeAuth ? "Tekrar Dene" : "YouTube'u Bağla"}
          onAction={() => (isYouTubeAuth ? void loadSubscriptionFeed() : navigation.navigate('Settings'))}
        />
      ) : displayedVideos.length === 0 ? (
        <EmptyState
          icon="videocam-outline"
          title="Yeni Video Yok"
          description="Seçili kanal için henüz yeni video bulunamadı."
          actionLabel="Tümünü Göster"
          onAction={() => setSelectedChannelId(null)}
        />
      ) : (
        <FlatList
          data={displayedVideos}
          keyExtractor={(item, index) => `${item.id}_${index}`}
          renderItem={({ item }) => (
            <VideoCard
              video={item}
              onPress={(v) => {
                usePlayerStore.getState().loadAndPlay(v);
                usePlayerStore.getState().setMinimized(false);
              }}
              onChannelPress={(channelName, channelId) =>
                navigation.navigate('Channel', {
                  channelId: channelId || channelName,
                  channelName,
                })
              }
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
          contentContainerStyle={{ paddingBottom: 80, paddingTop: 8 }}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  header: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
    letterSpacing: -0.5,
  },
  searchBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  channelsBar: {
    borderBottomWidth: 1,
    paddingVertical: 12,
  },
  channelsContent: {
    paddingHorizontal: 12,
    gap: 14,
  },
  channelAvatarItem: {
    alignItems: 'center',
    width: 64,
  },
  allPillRing: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  neonAvatarRing: {
    width: 52,
    height: 52,
    borderRadius: 26,
    padding: 2,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 6,
  },
  neonAvatarRingActive: {
    borderColor: THEME.colors.primary,
  },
  channelAvatar: {
    width: '100%',
    height: '100%',
    borderRadius: 24,
    backgroundColor: '#222',
  },
  channelName: {
    color: THEME.colors.textSecondary,
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
  },
  syncBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 0, 0, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    marginLeft: 8,
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 0, 0, 0.25)',
  },
  syncBadgeText: {
    color: '#FF4D4D',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
