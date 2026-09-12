import * as FileSystem from 'expo-file-system/legacy';
import { StreamBundle, StreamItem } from '../types/video';

export function resolutionOf(stream: Pick<StreamItem, 'quality' | 'height'>): number {
  return Number(stream.quality.match(/^(\d+)p/)?.[1]) || stream.height || 0;
}

// Keep alternate audio and subtitles in the master playlist when fixing a resolution.
export function hlsQualityPlaylists(text: string, manifestUrl: string): { height: number; text: string }[] {
  const absolute = (uri: string) => new URL(uri, manifestUrl).href;
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const shared = lines.filter((line) => line.startsWith('#EXT-X-MEDIA:') || line.startsWith('#EXT-X-SESSION-KEY:'))
    .map((line) => line.replace(/URI="([^"]+)"/g, (_, uri) => `URI="${absolute(uri)}"`));
  const variants = new Map<number, { height: number; text: string; bandwidth: number }>();
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].startsWith('#EXT-X-STREAM-INF:')) continue;
    const height = Number(lines[i].match(/RESOLUTION=\d+x(\d+)/)?.[1]);
    const uri = lines[i + 1];
    if (!height || !uri || uri.startsWith('#')) continue;
    const bandwidth = Number(lines[i].match(/(?:^|[:,])BANDWIDTH=(\d+)/)?.[1]) || 0;
    if ((variants.get(height)?.bandwidth ?? -1) >= bandwidth) continue;
    const version = lines.find((line) => line.startsWith('#EXT-X-VERSION:'));
    variants.set(height, { height, bandwidth, text: ['#EXTM3U', version, ...shared, lines[i], absolute(uri), ''].filter((line) => line !== undefined).join('\n') });
  }
  return [...variants.values()].sort((a, b) => b.height - a.height);
}

export function dashQualityManifests(xml: string, manifestUrl: string): { height: number; text: string }[] {
  const sets = [...xml.matchAll(/<AdaptationSet\b[^>]*>[\s\S]*?<\/AdaptationSet>/g)].map((match) => match[0]);
  const videoSets = sets.filter((set) => /(?:mimeType="video\/|contentType="video"|\bheight="\d+")/.test(set));
  const heights = new Set<number>();
  videoSets.forEach((set) => [...set.matchAll(/\bheight="(\d+)"/g)].forEach((match) => heights.add(Number(match[1]))));
  return [...heights].filter(Boolean).sort((a, b) => b - a).map((height) => {
    let text = xml;
    for (const set of videoSets) {
      const inheritedHeight = Number(set.match(/^<AdaptationSet\b[^>]*\bheight="(\d+)"/)?.[1]);
      let count = 0;
      const filtered = set.replace(/<Representation\b[^>]*(?:\/>|>[\s\S]*?<\/Representation>)/g, (rep) => {
        const repHeight = Number(rep.match(/\bheight="(\d+)"/)?.[1]) || inheritedHeight;
        if (repHeight !== height) return '';
        count++;
        return rep;
      });
      text = text.replace(set, count ? filtered : '');
    }
    if (/^https?:/.test(manifestUrl)) {
      // Relative segment paths still resolve against the original remote manifest.
      const base = new URL('.', manifestUrl).href.replace(/&/g, '&amp;');
      const beforePeriod = text.split(/<Period\b/)[0];
      if (!/<BaseURL\b/.test(beforePeriod)) {
        text = text.replace(/<MPD\b[^>]*>/, (tag) => `${tag}<BaseURL>${base}</BaseURL>`);
      } else {
        const header = beforePeriod.replace(/<BaseURL>([^<]+)<\/BaseURL>/g, (tag, uri) => {
          if (/^https?:/.test(uri)) return tag;
          return `<BaseURL>${new URL(uri.replace(/&amp;/g, '&'), manifestUrl).href.replace(/&/g, '&amp;')}</BaseURL>`;
        });
        text = header + text.slice(beforePeriod.length);
      }
    }
    return { height, text };
  });
}

let manifestRevision = 0;
export async function prepareQualityStreams(bundle: StreamBundle): Promise<StreamItem[]> {
  const headers = bundle.hlsManifestUrl ? bundle.hlsManifestHeaders : bundle.dashManifestHeaders;
  const url = bundle.hlsManifestUrl || bundle.dashManifestUrl;
  if (!url) return [];
  let text: string;
  if (/^https?:/.test(url)) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(url, { headers, signal: controller.signal });
      if (!response.ok) throw new Error(`Kalite listesi alınamadı (${response.status}).`);
      text = await response.text();
    } finally { clearTimeout(timeout); }
  } else {
    text = await FileSystem.readAsStringAsync(url);
  }
  const isHls = Boolean(bundle.hlsManifestUrl);
  const variants = isHls ? hlsQualityPlaylists(text, url) : dashQualityManifests(text, url);
  const cache = FileSystem.cacheDirectory;
  if (!cache) return [];
  const revision = ++manifestRevision;
  return Promise.all(variants.map(async (variant) => {
    const path = `${cache}quality_${bundle.videoId}_${revision}_${variant.height}.${isHls ? 'm3u8' : 'mpd'}`;
    await FileSystem.writeAsStringAsync(path, variant.text, { encoding: FileSystem.EncodingType.UTF8 });
    return { url: path, quality: `${variant.height}p`, height: variant.height, format: isHls ? 'hls' : 'mpd', headers, isAdaptive: false };
  }));
}
