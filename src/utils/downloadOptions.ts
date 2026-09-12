import { StreamBundle, StreamItem } from '../types/video';
export interface DownloadOption { kind?: 'hls'; expiresAt?: number; quality: string; video: StreamItem; audio?: StreamItem; }
export function getDownloadOptions(bundle: StreamBundle): DownloadOption[] {
  const mp4 = (s: StreamItem) => /^https?:\/\//.test(s.url) && (s.format.toLowerCase().includes('mp4') || s.mimeType?.includes('mp4')) && !/\.(m3u8|mpd)(\?|$)/i.test(s.url);
  const audio = bundle.audioStreams.filter(mp4).sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];
  const options = new Map<string, DownloadOption>();
  for (const video of bundle.videoStreams.filter(mp4)) {
    if (video.isAdaptive && !audio) continue;
    const quality = video.height ? `${video.height}p` : video.quality;
    const previous = options.get(quality);
    if (!previous || (!video.isAdaptive && previous.video.isAdaptive)) options.set(quality, { quality, video, audio: video.isAdaptive ? audio : undefined });
  }
  for (const video of bundle.qualityStreams || []) if (video.format === 'hls' && !options.has(video.quality)) options.set(video.quality, { kind: 'hls', expiresAt: bundle.expiresAt, quality: video.quality, video });
  return [...options.values()].sort((a, b) => parseInt(b.quality) - parseInt(a.quality));
}
