import { useDownloadSheetStore } from '../store/useDownloadSheetStore';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { VideoItem } from '../types/video';
import { THEME } from '../constants/theme';
import { useThemeStore } from '../store/useThemeStore';
import { useLibraryStore } from '../store/useLibraryStore';
import { useAuth } from '../auth/AuthContext';
import { useToastStore } from '../store/useToastStore';
import { DownloadService } from '../services/downloadService';
import { YouTubeService } from '../services/youtubeService';
import { ActionSheet, ActionSheetOption } from './common/ActionSheet';
import { Haptics } from '../utils/haptics';
import { VideoThumbnail } from './VideoThumbnail';
import { useRecommendationStore } from '../store/useRecommendationStore';
import { WatchProgressBar } from './WatchProgressBar';

interface VideoCardProps {
  video: VideoItem;
  onPress: (video: VideoItem) => void;
  onChannelPress?: (channelName: string, channelId?: string) => void;
  compact?: boolean;
}

export const VideoCard: React.FC<VideoCardProps> = ({
  video,
  onPress,
  onChannelPress,
  compact = false,
}) => {
  const colors = useThemeStore((s) => s.colors);
  const { user } = useAuth();
  const { toggleFavorite, isFavorite } = useLibraryStore();
  const { showToast } = useToastStore();
  const [showMenu, setShowMenu] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(video?.uploaderAvatarUrl);
  const [avatarFailed, setAvatarFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setAvatarFailed(false);
    const direct = video?.uploaderAvatarUrl;
    setAvatarUrl(direct?.startsWith('//') ? `https:${direct}` : direct);
    if (!direct && (video?.uploaderId || video?.uploaderUrl)) {
      const reference = video.uploaderId || video.uploaderUrl!;
      void YouTubeService.resolveChannelId(reference).then(id => YouTubeService.getChannelAvatar(id)).then((url) => {
        if (active) setAvatarUrl(url);
      }).catch(() => undefined);
    }
    return () => { active = false; };
  }, [video?.id, video?.uploaderId, video?.uploaderUrl, video?.uploaderAvatarUrl]);

  if (!video || !video.id) return null;

  const formatDuration = (seconds: number) => {
    if (!seconds) return '';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const formatViews = (views: number) => {
    if (!views) return 'Yeni video';
    if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M görüntüleme`;
    if (views >= 1000) return `${(views / 1000).toFixed(1)}B görüntüleme`;
    return `${views} görüntüleme`;
  };

  const dateText = (video.uploadDate || '').replace(/[•·]/g, '').trim();
  const metadata = [video.uploaderName, formatViews(video.viewCount), dateText].filter(Boolean).join(' · ');
  const favorited = isFavorite(video.id);

  const handleShare = async () => {
    try {
      await Share.share({
        message: `${video.title}\nhttps://youtu.be/${video.id}`,
        title: video.title,
      });
    } catch {
      // Ignored
    }
  };

  const handleFavoriteToggle = async () => {
    await toggleFavorite(user?.uid, video);
    showToast(
      favorited ? 'Favorilerden çıkarıldı' : 'Favorilere eklendi',
      favorited ? 'info' : 'success'
    );
  };

  const handleDownload = () => useDownloadSheetStore.getState().open(video);

  const menuOptions: ActionSheetOption[] = [
    {
      id: 'play',
      title: 'Hemen Oynat',
      icon: 'play',
      iconColor: THEME.colors.primary,
      onPress: () => onPress(video),
    },
    {
      id: 'favorite',
      title: favorited ? 'Favorilerden Çıkar' : 'Favorilere Ekle',
      icon: favorited ? 'heart-dislike' : 'heart',
      iconColor: favorited ? THEME.colors.error : THEME.colors.accent,
      onPress: handleFavoriteToggle,
    },
    {
      id: 'channel',
      title: `${video.uploaderName} Kanalı`,
      icon: 'person-circle-outline',
      onPress: () => onChannelPress?.(video.uploaderName, video.uploaderId),
    },
    {
      id: 'download',
      title: 'Çevrimdışı İndir',
      icon: 'download-outline',
      onPress: handleDownload,
    },
    { id: 'uninterested', title: 'İlgilenmiyorum', icon: 'eye-off-outline', onPress: () => { useRecommendationStore.getState().hideVideo(video.id); showToast('Önerilerden kaldırıldı', 'info'); } },
    { id: 'block-channel', title: 'Bu kanalı önerme', icon: 'ban-outline', onPress: () => { useRecommendationStore.getState().blockChannel(video.uploaderId || `name:${video.uploaderName.toLocaleLowerCase('tr')}`); showToast('Kanal önerileri kapatıldı', 'info'); } },
    {
      id: 'share',
      title: 'Paylaş',
      icon: 'share-social-outline',
      onPress: handleShare,
    },
  ];

  return (
    <View style={styles.cardContainer}>
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.88}
        onPress={() => {
          Haptics.selection();
          onPress(video);
        }}
      >
        {/* Thumbnail Container */}
        <View style={[styles.thumbWrapper, { backgroundColor: colors.surfaceHighlight || '#1C1C22' }]}>
          <VideoThumbnail
            videoId={video.id}
            uri={video.thumbnailUrl}
            portrait={video.streamType === 'SHORTS'}
            style={styles.thumbnail}
            resizeMode="cover"
          />

          {video.isLive ? (
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>CANLI</Text>
            </View>
          ) : video.duration > 0 ? (
            <View style={styles.durationBadge}>
              <Text style={styles.durationText}>{formatDuration(video.duration)}</Text>
            </View>
          ) : null}
          <WatchProgressBar videoId={video.id} duration={video.duration} position={video.progress} isLive={video.isLive} />
        </View>

        {/* Video Info Row */}
        <View style={styles.infoRow}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => onChannelPress?.(video.uploaderName, video.uploaderId)}
            style={styles.avatarWrapper}
          >
            {avatarUrl && !avatarFailed ? (
              <Image source={{ uri: avatarUrl }} style={[styles.avatar, compact && { width: 26, height: 26, borderRadius: 13 }]} onError={() => {
                setAvatarFailed(true);
                if (video.uploaderId) void YouTubeService.getChannelAvatar(video.uploaderId).then(url => {
                  if (url && url !== avatarUrl) { setAvatarUrl(url); setAvatarFailed(false); }
                }).catch(() => undefined);
              }} />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: colors.surfaceHighlight }, compact && { width: 26, height: 26, borderRadius: 13 }]}>
                <Text style={styles.avatarInitial}>
                  {(video.uploaderName || 'T').charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          <View style={styles.textContainer}>
            <Text style={[styles.title, compact && { fontSize: 12, lineHeight: 17 }]} numberOfLines={2}>
              {video.title}
            </Text>
            <Text style={[styles.viewsText, compact && { fontSize: 10 }]} numberOfLines={2}>{metadata}</Text>
          </View>

          <TouchableOpacity
            style={styles.moreBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            onPress={() => setShowMenu(true)}
          >
            <Ionicons name="ellipsis-vertical" size={17} color={THEME.colors.textTertiary} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>

      <ActionSheet
        visible={showMenu}
        title={video.title}
        subtitle={video.uploaderName}
        options={menuOptions}
        onClose={() => setShowMenu(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    marginBottom: 18,
  },
  card: {
    paddingHorizontal: 12,
  },
  thumbWrapper: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    position: 'relative',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  durationBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.16)',
  },
  durationText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  liveBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: '#E50914',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
  liveText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingTop: 10,
    paddingHorizontal: 2,
  },
  avatarWrapper: {
    marginRight: 10,
    paddingTop: 2,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#262626',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  avatarPlaceholder: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  avatarInitial: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  textContainer: {
    flex: 1,
    paddingRight: 4,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
    lineHeight: 20,
    marginBottom: 3,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  channelName: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    fontWeight: '500',
    maxWidth: '50%',
  },
  viewsText: {
    fontSize: 12,
    color: THEME.colors.textTertiary,
  },
  moreBtn: {
    padding: 6,
    marginTop: 2,
  },
});
