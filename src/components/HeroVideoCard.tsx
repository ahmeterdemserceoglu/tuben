import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { VideoItem } from '../types/video';
import { THEME } from '../constants/theme';
import { Haptics } from '../utils/haptics';

interface HeroVideoCardProps {
  video: VideoItem;
  onPress: (video: VideoItem) => void;
}

export const HeroVideoCard: React.FC<HeroVideoCardProps> = ({
  video,
  onPress,
}) => {
  const thumbUrl = video.thumbnailUrl || `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`;

  return (
    <TouchableOpacity
      style={styles.container}
      activeOpacity={0.92}
      onPress={() => {
        Haptics.selection();
        onPress(video);
      }}
    >
      <View style={styles.card}>
        <Image source={{ uri: thumbUrl }} style={styles.bannerImage} resizeMode="cover" />

        {/* Gradient Overlay for high-end cinematic feel */}
        <LinearGradient
          colors={['transparent', 'rgba(11, 11, 14, 0.4)', 'rgba(11, 11, 14, 0.95)']}
          style={styles.gradient}
        />

        {/* Content Container */}
        <View style={styles.content}>
          <Text style={styles.channelName} numberOfLines={1}>
            {video.uploaderName}
          </Text>
          <Text style={styles.title} numberOfLines={2}>
            {video.title}
          </Text>

          {/* Action Row */}
          <View style={styles.actionRow}>
            <View style={styles.playButton}>
              <Ionicons name="play" size={18} color="#FFFFFF" />
              <Text style={styles.playText}>Hemen İzle</Text>
            </View>

            <View style={styles.viewBadge}>
              <Ionicons name="eye-outline" size={14} color="rgba(255,255,255,0.7)" />
              <Text style={styles.viewText}>
                {video.viewCount >= 1000
                  ? `${(video.viewCount / 1000).toFixed(1)}B görüntüleme`
                  : `${video.viewCount || 'Yeni'}`}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 12,
    marginBottom: 20,
    marginTop: 6,
  },
  card: {
    height: 220,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    position: 'relative',
    backgroundColor: '#18181F',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 8,
  },
  bannerImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  gradient: {
    ...StyleSheet.absoluteFill,
  },
  content: {
    position: 'absolute',
    bottom: 12,
    left: 14,
    right: 14,
    zIndex: 2,
  },
  channelName: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
    marginBottom: 10,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  playButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 18,
    gap: 6,
    shadowColor: THEME.colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
  playText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  viewBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  viewText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 11,
    fontWeight: '500',
  },
});
