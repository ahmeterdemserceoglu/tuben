import { WatchProgressBar } from '../components/WatchProgressBar';
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { YouTubeService } from '../services/youtubeService';
import { PlaylistDetails } from '../types/playlist';
import { VideoItem } from '../types/video';
import { THEME } from '../constants/theme';

export const PlaylistScreen: React.FC<{ route: any; navigation: any }> = ({
  route,
  navigation,
}) => {
  const { playlistId, title: initialTitle } = route.params || {};
  const [playlist, setPlaylist] = useState<PlaylistDetails | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchPlaylist = useCallback(async () => {
    try {
      setLoading(true);
      const data = await YouTubeService.getPlaylistDetails(playlistId);
      setPlaylist(data);
    } catch {
      // Handled
    } finally {
      setLoading(false);
    }
  }, [playlistId]);

  useEffect(() => {
    fetchPlaylist();
  }, [fetchPlaylist]);

  const handlePlayVideo = (video: VideoItem, index: number) => {
    navigation.navigate('Player', {
      videoId: video.id,
      video,
      playlist: playlist?.videos,
      currentIndex: index,
    });
  };

  const handlePlayAll = () => {
    if (playlist && playlist.videos.length > 0) {
      handlePlayVideo(playlist.videos[0], 0);
    }
  };

  const formatDuration = (seconds: number) => {
    if (!seconds) return '';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={THEME.colors.background} />

      {/* Header Bar */}
      <View style={styles.navBar}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={26} color={THEME.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.navTitle} numberOfLines={1}>
          {playlist?.title || initialTitle || 'Oynatma Listesi'}
        </Text>
        <View style={{ width: 38 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={THEME.colors.primary} />
        </View>
      ) : (
        <FlatList
          data={playlist?.videos || []}
          keyExtractor={(item, index) => `${item.id}-${index}`}
          renderItem={({ item, index }) => (
            <TouchableOpacity
              style={styles.videoRow}
              activeOpacity={0.7}
              onPress={() => handlePlayVideo(item, index)}
            >
              <Text style={styles.indexText}>{index + 1}</Text>
              <View style={[styles.thumb, { overflow: 'hidden' }]}>
                <Image source={{ uri: item.thumbnailUrl }} style={StyleSheet.absoluteFill} />
                <WatchProgressBar videoId={item.id} duration={item.duration} position={item.progress} isLive={item.isLive} />
              </View>
              <View style={styles.videoMeta}>
                <Text style={styles.videoTitle} numberOfLines={2}>
                  {item.title}
                </Text>
                <Text style={styles.channelText} numberOfLines={1}>
                  {item.uploaderName} {item.duration ? `• ${formatDuration(item.duration)}` : ''}
                </Text>
              </View>
            </TouchableOpacity>
          )}
          ListHeaderComponent={
            <View style={styles.playlistHero}>
              {playlist?.thumbnailUrl ? (
                <Image source={{ uri: playlist.thumbnailUrl }} style={styles.heroThumb} />
              ) : (
                <View style={styles.heroPlaceholder}>
                  <Ionicons name="musical-notes" size={48} color={THEME.colors.primary} />
                </View>
              )}

              <Text style={styles.heroTitle}>{playlist?.title || initialTitle}</Text>
              <Text style={styles.heroSub}>
                {playlist?.uploaderName ? `${playlist.uploaderName} • ` : ''}
                {playlist?.videos?.length || 0} video
              </Text>

              {/* Action Buttons */}
              <View style={styles.actionRow}>
                <TouchableOpacity style={styles.playAllBtn} onPress={handlePlayAll}>
                  <Ionicons name="play" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.playAllText}>Tümünü Oynat</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.shuffleBtn}
                  onPress={() => {
                    if (playlist && playlist.videos.length > 0) {
                      const randomIndex = Math.floor(Math.random() * playlist.videos.length);
                      handlePlayVideo(playlist.videos[randomIndex], randomIndex);
                    }
                  }}
                >
                  <Ionicons name="shuffle" size={18} color={THEME.colors.textPrimary} style={{ marginRight: 6 }} />
                  <Text style={styles.shuffleText}>Karıştır</Text>
                </TouchableOpacity>
              </View>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Ionicons name="albums-outline" size={48} color={THEME.colors.textMuted} />
              <Text style={styles.emptyText}>Bu listede henüz video bulunmuyor</Text>
            </View>
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
    backgroundColor: THEME.colors.background,
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: THEME.spacing.md,
    paddingVertical: THEME.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  iconBtn: {
    padding: 6,
  },
  navTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    textAlign: 'center',
  },
  playlistHero: {
    alignItems: 'center',
    padding: THEME.spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
    backgroundColor: THEME.colors.surface,
  },
  heroThumb: {
    width: 140,
    height: 140,
    borderRadius: 12,
    marginBottom: 16,
  },
  heroPlaceholder: {
    width: 140,
    height: 140,
    borderRadius: 12,
    backgroundColor: THEME.colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
    textAlign: 'center',
    marginBottom: 6,
  },
  heroSub: {
    fontSize: 14,
    color: THEME.colors.textSecondary,
    marginBottom: 16,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  playAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 24,
    marginRight: 12,
  },
  playAllText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  shuffleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.surfaceLight,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  shuffleText: {
    color: THEME.colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  videoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: THEME.spacing.lg,
    paddingVertical: THEME.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.03)',
  },
  indexText: {
    width: 26,
    color: THEME.colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  thumb: {
    width: 90,
    height: 52,
    borderRadius: 6,
    marginRight: 12,
    backgroundColor: THEME.colors.surface,
  },
  videoMeta: {
    flex: 1,
  },
  videoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
    lineHeight: 18,
    marginBottom: 4,
  },
  channelText: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
  },
  listContent: {
    paddingBottom: 60,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 50,
  },
  emptyText: {
    color: THEME.colors.textSecondary,
    fontSize: 14,
    marginTop: 10,
  },
});
