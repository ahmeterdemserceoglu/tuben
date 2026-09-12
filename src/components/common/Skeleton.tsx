import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, DimensionValue, ViewStyle } from 'react-native';
import { THEME } from '../../constants/theme';
import { useThemeStore } from '../../store/useThemeStore';

interface SkeletonBoxProps {
  width: DimensionValue;
  height: DimensionValue;
  borderRadius?: number;
  style?: ViewStyle;
}

export const SkeletonBox: React.FC<SkeletonBoxProps> = ({
  width,
  height,
  borderRadius = 8,
  style,
}) => {
  const colors = useThemeStore((s) => s.colors);
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: colors.surfaceHighlight || '#22222A',
          opacity,
        },
        style,
      ]}
    />
  );
};

export const VideoCardSkeleton: React.FC = () => {
  return (
    <View style={styles.cardContainer}>
      {/* 16:9 Thumbnail Skeleton */}
      <SkeletonBox width="100%" height={200} borderRadius={14} />

      {/* Info Row Skeleton */}
      <View style={styles.infoRow}>
        <SkeletonBox width={38} height={38} borderRadius={19} />
        <View style={styles.textColumn}>
          <SkeletonBox width="90%" height={14} borderRadius={4} style={{ marginBottom: 6 }} />
          <SkeletonBox width="60%" height={12} borderRadius={4} style={{ marginBottom: 4 }} />
          <SkeletonBox width="40%" height={10} borderRadius={4} />
        </View>
      </View>
    </View>
  );
};

export const CompactRowSkeleton: React.FC = () => {
  return (
    <View style={styles.compactRow}>
      <SkeletonBox width={140} height={84} borderRadius={10} />
      <View style={styles.compactTextColumn}>
        <SkeletonBox width="95%" height={13} borderRadius={4} style={{ marginBottom: 6 }} />
        <SkeletonBox width="70%" height={11} borderRadius={4} style={{ marginBottom: 4 }} />
        <SkeletonBox width="50%" height={10} borderRadius={4} />
      </View>
    </View>
  );
};

export const ShortsSkeleton: React.FC = () => {
  return (
    <View style={styles.shortsItem}>
      <SkeletonBox width={130} height={210} borderRadius={14} />
      <SkeletonBox width={110} height={12} borderRadius={4} style={{ marginTop: 8 }} />
      <SkeletonBox width={70} height={10} borderRadius={4} style={{ marginTop: 4 }} />
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    marginBottom: 20,
    paddingHorizontal: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingTop: 10,
    gap: 10,
  },
  textColumn: {
    flex: 1,
    justifyContent: 'center',
  },
  compactRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    marginBottom: 12,
    gap: 10,
  },
  compactTextColumn: {
    flex: 1,
    justifyContent: 'center',
  },
  shortsItem: {
    marginRight: 12,
  },
});
