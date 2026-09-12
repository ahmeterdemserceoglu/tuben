import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { VideoItem } from '../types/video';
import { THEME } from '../constants/theme';
import { useThemeStore } from '../store/useThemeStore';
import { Haptics } from '../utils/haptics';

interface CompactVideoRowProps {
  video: VideoItem;
  progressPercent?: number;
  onPress: (video: VideoItem) => void;
  onRemove?: () => void;
}

export const CompactVideoRow: React.FC<CompactVideoRowProps> = ({
  video,
  progressPercent,
  onPress,
  onRemove,
}) => {
  const colors = useThemeStore((s) => s.colors);
  const thumbUrl = video.thumbnailUrl || `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`;

  return (
    <TouchableOpacity
      style={[
        styles.container,
        {
          backgroundColor: colors.surface || '#14141A',
          borderColor: colors.borderSubtle || 'rgba(255, 255, 255, 0.05)',
        },
      ]}
      activeOpacity={0.85}
      onPress={() => {
        Haptics.selection();
        onPress(video);
      }}
    >
      {/* Thumbnail */}
      <View style={styles.thumbWrapper}>
        <Image source={{ uri: thumbUrl }} style={styles.thumbnail} resizeMode="cover" />
        {progressPercent !== undefined && progressPercent > 0 && (
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${Math.min(100, progressPercent)}%` }]} />
          </View>
        )}
      </View>

      {/* Info */}
      <View style={styles.infoWrapper}>
        <Text style={styles.title} numberOfLines={2}>
          {video.title}
        </Text>
        <Text style={styles.channel} numberOfLines={1}>
          {video.uploaderName}
        </Text>
      </View>

      {onRemove && (
        <TouchableOpacity style={styles.removeBtn} onPress={onRemove}>
          <Ionicons name="close" size={18} color={THEME.colors.textTertiary} />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
    marginHorizontal: 12,
  },
  thumbWrapper: {
    width: 100,
    height: 58,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#1A1A22',
    position: 'relative',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  progressBarBg: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: THEME.colors.primary,
  },
  infoWrapper: {
    flex: 1,
    marginLeft: 10,
    justifyContent: 'center',
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
    lineHeight: 18,
    marginBottom: 3,
  },
  channel: {
    fontSize: 11,
    color: THEME.colors.textSecondary,
  },
  removeBtn: {
    padding: 6,
    marginLeft: 4,
  },
});
