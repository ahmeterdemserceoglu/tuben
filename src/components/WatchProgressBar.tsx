import React from 'react';
import { StyleSheet, View } from 'react-native';
import { THEME } from '../constants/theme';
import { useLibraryStore } from '../store/useLibraryStore';
import { usePlayerStore } from '../store/usePlayerStore';

interface WatchProgressBarProps {
  videoId: string;
  duration?: number;
  position?: number;
  isLive?: boolean;
}

export const WatchProgressBar: React.FC<WatchProgressBarProps> = ({ videoId, duration = 0, position, isLive }) => {
  const saved = useLibraryStore((state) => state.history.find((item) => item.videoId === videoId));
  const playingPosition = usePlayerStore((state) => state.currentVideo?.id === videoId ? state.currentTime : null);
  const playingDuration = usePlayerStore((state) => state.currentVideo?.id === videoId ? state.duration : 0);
  const total = playingDuration || duration || saved?.duration || 0;
  const seconds = playingPosition ?? saved?.lastPosition ?? position ?? 0;
  if (isLive || total <= 0 || seconds <= 0 || !Number.isFinite(total) || !Number.isFinite(seconds)) return null;
  const percent = Math.min(100, Math.max(0, seconds / total * 100));
  return (
    <View pointerEvents="none" style={styles.track}>
      <View style={[styles.fill, { width: `${percent}%` }]} />
    </View>
  );
};

const styles = StyleSheet.create({
  track: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, backgroundColor: 'rgba(255,255,255,0.35)' },
  fill: { height: '100%', backgroundColor: THEME.colors.primary },
});
