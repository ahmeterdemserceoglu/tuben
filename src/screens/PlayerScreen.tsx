import React, { useEffect } from 'react';
import { usePlayerStore } from '../store/usePlayerStore';

export const PlayerScreen: React.FC<{ route: any; navigation: any }> = ({
  route,
  navigation,
}) => {
  const { videoId, video: routeVideo, playlist, currentIndex = 0, startPosition = 0 } = route.params || {};
  const { loadAndPlay, setMinimized } = usePlayerStore();

  useEffect(() => {
    const activeVideo = routeVideo || (videoId ? {
      id: videoId,
      title: 'Video',
      uploaderName: 'Kanal',
      thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      duration: 0,
      viewCount: 0,
    } : null);

    if (activeVideo) {
      loadAndPlay(activeVideo, playlist, currentIndex, startPosition);
      setMinimized(false);
    }

    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  }, [videoId, routeVideo, playlist, currentIndex, startPosition, loadAndPlay, setMinimized, navigation]);

  return null;
};
