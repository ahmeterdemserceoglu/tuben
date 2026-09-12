import React, { useEffect, useState } from 'react';
import { Image, ImageProps } from 'react-native';

type Props = Omit<ImageProps, 'source'> & { videoId: string; uri?: string; portrait?: boolean };

export function VideoThumbnail({ videoId, uri, portrait, onError, onLoad, ...props }: Props) {
  const [candidate, setCandidate] = useState(0);
  useEffect(() => setCandidate(0), [videoId, uri, portrait]);
  const base = `https://i.ytimg.com/vi/${videoId}`;
  const candidates = Array.from(new Set((portrait
    ? [uri, `${base}/maxresdefault.jpg`, `${base}/hqdefault.jpg`]
    : [`${base}/maxresdefault.jpg`, `${base}/hq720.jpg`, uri, `${base}/sddefault.jpg`, `${base}/hqdefault.jpg`]
  ).filter((url): url is string => !!url))).map((url) => url.startsWith('//') ? `https:${url}` : url);
  const advance = () => setCandidate((previous) => Math.min(previous + 1, candidates.length - 1));
  return (
    <Image
      {...props}
      source={{ uri: candidates[Math.min(candidate, candidates.length - 1)] }}
      onError={(event) => { advance(); onError?.(event); }}
      onLoad={(event) => {
        // YouTube may return a tiny placeholder with HTTP 200 for unavailable HD covers.
        if (event.nativeEvent.source.width <= 120 && candidate < candidates.length - 1) advance();
        onLoad?.(event);
      }}
    />
  );
}
