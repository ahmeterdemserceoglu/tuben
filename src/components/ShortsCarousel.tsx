import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { VideoItem } from '../types/video';
import { THEME } from '../constants/theme';
import { Haptics } from '../utils/haptics';

interface ShortsCarouselProps {
  shorts: VideoItem[];
  onPress: (video: VideoItem) => void;
}

export const ShortsCarousel: React.FC<ShortsCarouselProps> = ({ shorts, onPress }) => {
  if (!shorts || shorts.length === 0) return null;

  return (
    <View style={styles.container}>
      {/* Section Header */}
      <View style={styles.headerRow}>
        <View style={styles.titleRow}>
          <View style={styles.shortsIconWrap}>
            <Ionicons name="flash" size={16} color="#FF0033" />
          </View>
          <Text style={styles.sectionTitle}>Shorts</Text>
        </View>
      </View>

      {/* Horizontal Carousel */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {shorts.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={styles.card}
            activeOpacity={0.88}
            onPress={() => {
              Haptics.selection();
              onPress(item);
            }}
          >
            <Image
              source={{ uri: item.thumbnailUrl || `https://i.ytimg.com/vi/${item.id}/hqdefault.jpg` }}
              style={styles.thumbnail}
              resizeMode="cover"
            />

            <LinearGradient
              colors={['transparent', 'rgba(0, 0, 0, 0.3)', 'rgba(0, 0, 0, 0.9)']}
              style={styles.gradient}
            />

            <View style={styles.overlayContent}>
              <Text style={styles.videoTitle} numberOfLines={2}>
                {item.title}
              </Text>
              <Text style={styles.viewCount}>
                {item.viewCount >= 1000
                  ? `${(item.viewCount / 1000).toFixed(1)}B görüntüleme`
                  : `${item.viewCount || 'Yeni'}`}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  shortsIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 0, 51, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    letterSpacing: -0.2,
  },
  scrollContent: {
    paddingHorizontal: 12,
    gap: 10,
  },
  card: {
    width: 135,
    height: 220,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#1C1C22',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    position: 'relative',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  gradient: {
    ...StyleSheet.absoluteFill,
  },
  overlayContent: {
    position: 'absolute',
    bottom: 10,
    left: 8,
    right: 8,
  },
  videoTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
    lineHeight: 16,
    marginBottom: 4,
  },
  viewCount: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.65)',
    fontWeight: '500',
  },
});
