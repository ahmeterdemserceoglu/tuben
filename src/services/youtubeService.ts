import { streamExpiresAt, parseStoryboards, parseChapters } from '../utils/playbackMetadata';
import * as FileSystem from 'expo-file-system/legacy';
import { VideoItem, StreamBundle, StreamItem, SubtitleItem } from '../types/video';
import { ChannelDetails } from '../types/channel';
import { PlaylistDetails } from '../types/playlist';
import { CommentItem } from '../types/comment';
import { NativePlayerBridge } from './nativePlayerBridge';

export const IOS_USER_AGENT = 'com.google.ios.youtube/20.01.2 (iPhone16,2; U; CPU iOS 18_1_1 like Mac OS X)';

function escapeXml(str: string): string {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildDashMpd(durationSec: number, videoFormats: any[], audioFormats: any[]): string {
  const videoReps = videoFormats
    .map((f) => {
      const mimeMatch = f.mimeType?.match(/codecs="([^"]+)"/);
      const codecs = mimeMatch ? mimeMatch[1] : 'avc1.640028';
      return `      <Representation id="${f.itag}" bandwidth="${f.bitrate}" width="${f.width}" height="${f.height}" codecs="${codecs}">
        <BaseURL>${escapeXml(f.url)}</BaseURL>
        <SegmentBase indexRange="${f.indexRange.start}-${f.indexRange.end}">
          <Initialization range="${f.initRange.start}-${f.initRange.end}"/>
        </SegmentBase>
      </Representation>`;
    })
    .join('\n');

  const audioReps = audioFormats
    .map((f) => {
      const mimeMatch = f.mimeType?.match(/codecs="([^"]+)"/);
      const codecs = mimeMatch ? mimeMatch[1] : 'mp4a.40.2';
      return `      <Representation id="${f.itag}" bandwidth="${f.bitrate}" codecs="${codecs}">
        <BaseURL>${escapeXml(f.url)}</BaseURL>
        <SegmentBase indexRange="${f.indexRange.start}-${f.indexRange.end}">
          <Initialization range="${f.initRange.start}-${f.initRange.end}"/>
        </SegmentBase>
      </Representation>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<MPD xmlns="urn:mpeg:dash:schema:mpd:2011"
     profiles="urn:mpeg:dash:profile:isoff-on-demand:2011"
     type="static"
     mediaPresentationDuration="PT${durationSec.toFixed(3)}S"
     minBufferTime="PT1.5S">
  <Period>
    <AdaptationSet mimeType="video/mp4" subsegmentAlignment="true" subsegmentStartsWithSAP="1">
${videoReps}
    </AdaptationSet>
    <AdaptationSet mimeType="audio/mp4" subsegmentAlignment="true" subsegmentStartsWithSAP="1">
${audioReps}
    </AdaptationSet>
  </Period>
</MPD>`;
}

function cleanUrl(url?: string): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('//')) return `https:${url}`;
  return url;
}

import { YouTubeAuthService } from './youtubeAuthService';
import { UserSubscription } from '../types/user';


function browseText(value: any): string {
  if (typeof value === 'string') return value;
  return value?.simpleText || value?.content || value?.runs?.map((r: any) => r.text).join('') || '';
}

function browseCount(text: string): number {
  const normalized = text.toLowerCase().trim();
  const abbreviated = normalized.match(/([\d.,]+)\s*(mn|milyon|million|bin|thousand|m|b|k)(?:\s|[^a-z]|$)/);
  if (abbreviated) {
    const amount = Number(abbreviated[1].replace(',', '.'));
    const multiplier = ['mn', 'milyon', 'million', 'm'].includes(abbreviated[2]) ? 1000000 : 1000;
    return Math.round(amount * multiplier) || 0;
  }
  return Number(text.replace(/[^0-9]/g, '')) || 0;
}

function channelIdFromParams(params?: string): string | undefined {
  if (!params) return undefined;
  try {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    const encoded = decodeURIComponent(params).replace(/-/g, '+').replace(/_/g, '/');
    let bits = 0, value = 0, decoded = '';
    for (const char of encoded) {
      const digit = alphabet.indexOf(char);
      if (digit < 0) continue;
      value = (value << 6) | digit;
      bits += 6;
      if (bits >= 8) {
        bits -= 8;
        decoded += String.fromCharCode((value >> bits) & 255);
      }
    }
    return decoded.match(/UC[\w-]{22}/)?.[0];
  } catch {
    return undefined;
  }
}

function findChannelBrowseId(node: any): string | undefined {
  if (!node || typeof node !== 'object') return undefined;
  if (node.browseEndpoint?.browseId?.startsWith('UC')) return node.browseEndpoint.browseId;
  if (node.browseId?.startsWith('UC')) return node.browseId;
  if (typeof node.url === 'string') {
    const id = node.url.match(/\/channel\/(UC[\w-]{22})/)?.[1];
    if (id) return id;
  }
  for (const child of Object.values(node)) {
    const id = findChannelBrowseId(child);
    if (id) return id;
  }
  return undefined;
}

export function extractChannelsFromBrowse(data: any): UserSubscription[] {
  const channels: UserSubscription[] = [];
  const seenIds = new Set<string>();

  const traverse = (node: any) => {
    if (!node || typeof node !== 'object') return;

    // The TV subscriptions sidebar uses tabs, including channels with no recent uploads.
    const tab = node.tabRenderer;
    const endpoint = tab?.endpoint?.browseEndpoint;
    const tile = node.tileRenderer;
    const tabId = endpoint?.browseId === 'FEsubscriptions'
      ? channelIdFromParams(endpoint.params)
      : endpoint?.browseId?.startsWith('UC') ? endpoint.browseId : undefined;
    const tileId = tile?.contentType === 'TILE_CONTENT_TYPE_CHANNEL'
      ? tile.onSelectCommand?.browseEndpoint?.browseId : undefined;
    const id = tabId || tileId;
    if (id && !seenIds.has(id)) {
      seenIds.add(id);
      const thumbs = tab?.thumbnail?.thumbnails || tile?.header?.tileHeaderRenderer?.thumbnail?.thumbnails || [];
      channels.push({
        channelId: id,
        channelTitle: browseText(tab?.title || tile?.metadata?.tileMetadataRenderer?.title) || 'Kanal',
        thumbnailUrl: cleanUrl(thumbs[thumbs.length - 1]?.url) || '',
        subscribedAt: Date.now(),
        youtubeBrowseParams: tabId ? endpoint?.params : undefined,
      });
    }

    if (node.channelRenderer) {
      const cr = node.channelRenderer;
      const cid = cr.channelId;
      if (cid && !seenIds.has(cid)) {
        seenIds.add(cid);
        const title = cr.title?.simpleText || cr.title?.runs?.[0]?.text || 'Kanal';
        const thumbs = cr.thumbnail?.thumbnails || [];
        const avatar = thumbs[thumbs.length - 1]?.url || '';
        channels.push({
          channelId: cid,
          channelTitle: title,
          thumbnailUrl: cleanUrl(avatar) || '',
          subscribedAt: Date.now(),
        });
      }
    }

    if (node.gridChannelRenderer) {
      const gcr = node.gridChannelRenderer;
      const cid = gcr.channelId;
      if (cid && !seenIds.has(cid)) {
        seenIds.add(cid);
        const title = gcr.title?.simpleText || gcr.title?.runs?.[0]?.text || 'Kanal';
        const thumbs = gcr.thumbnail?.thumbnails || [];
        const avatar = thumbs[thumbs.length - 1]?.url || '';
        channels.push({
          channelId: cid,
          channelTitle: title,
          thumbnailUrl: cleanUrl(avatar) || '',
          subscribedAt: Date.now(),
        });
      }
    }

    if (node.avatarLockupRenderer) {
      const alr = node.avatarLockupRenderer;
      const cid = alr.avatarImage?.navigationEndpoint?.browseEndpoint?.browseId || '';
      const title = alr.title?.content || 'Kanal';
      const thumbs = alr.avatarImage?.sources || [];
      const avatar = thumbs[thumbs.length - 1]?.url || '';
      if (cid && !seenIds.has(cid)) {
        seenIds.add(cid);
        channels.push({
          channelId: cid,
          channelTitle: title,
          thumbnailUrl: cleanUrl(avatar) || '',
          subscribedAt: Date.now(),
        });
      }
    }

    if (Array.isArray(node)) {
      for (const child of node) traverse(child);
    } else {
      for (const key of Object.keys(node)) {
        traverse(node[key]);
      }
    }
  };

  traverse(data);
  return channels;
}

export function extractVideosFromBrowse(data: any): VideoItem[] {
  const list: VideoItem[] = [];
  const seenIds = new Set<string>();

  const traverse = (node: any) => {
    if (!node || typeof node !== 'object') return;

    if (node.tileRenderer) {
      const tile = node.tileRenderer;
      const command = tile.onSelectCommand;
      const vid = command?.watchEndpoint?.videoId || command?.reelWatchEndpoint?.videoId;
      if (vid && !seenIds.has(vid) &&
          (!tile.contentType || ['TILE_CONTENT_TYPE_VIDEO', 'TILE_CONTENT_TYPE_SHORTS'].includes(tile.contentType))) {
        seenIds.add(vid);
        const header = tile.header?.tileHeaderRenderer || {};
        const metadata = tile.metadata?.tileMetadataRenderer ||
          header.thumbnailOverlays?.find((o: any) => o.tileMetadataRenderer)?.tileMetadataRenderer || {};
        const lineParts: string[][] = (metadata.lines || []).map((line: any) =>
          (line.lineRenderer?.items || []).map((item: any) => browseText(item.lineItemRenderer?.text))
            .filter((text: string) => text.trim() && !/^[•·|]+$/.test(text.trim()))
        );
        const lines = lineParts.map((parts) => parts.join(' • '));
        const overlays = header.thumbnailOverlays || [];
        const time = overlays.find((o: any) => o.thumbnailOverlayTimeStatusRenderer)?.thumbnailOverlayTimeStatusRenderer;
        const parts = browseText(time?.text).split(':').map(Number);
        const duration = parts.length > 1 && parts.every(Number.isFinite)
          ? parts.reduce((total: number, part: number) => total * 60 + part, 0) : 0;
        const thumbs = header.thumbnail?.thumbnails || [];
        const isShort = !!command?.reelWatchEndpoint || tile.contentType === 'TILE_CONTENT_TYPE_SHORTS' ||
          tile.style === 'TILE_STYLE_YTLR_SHORTS' || time?.style === 'SHORTS';
        list.push({
          id: vid,
          title: browseText(metadata.title) || 'Video',
          uploaderName: lines[0] || 'Kanal',
          uploaderId: findChannelBrowseId(tile),
          thumbnailUrl: cleanUrl(thumbs[thumbs.length - 1]?.url) || `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`,
          duration,
          viewCount: browseCount(lineParts[1]?.[0] || ''),
          uploadDate: lineParts[2]?.join(' ') || lineParts[1]?.slice(1).join(' ') || '',
          isLive: time?.style === 'LIVE',
          isUpcoming: time?.style === 'UPCOMING',
          streamType: isShort ? 'SHORTS' : time?.style === 'LIVE' ? 'LIVE_STREAM' : 'VIDEO_STREAM',
        });
      }
      return;
    }

    if (node.videoRenderer) {
      const vr = node.videoRenderer;
      const vid = vr.videoId;
      if (vid && !seenIds.has(vid)) {
        seenIds.add(vid);
        const title =
          vr.title?.runs?.map((r: any) => r.text).join('') ||
          vr.title?.simpleText ||
          'Video';
        const channelName =
          vr.ownerText?.runs?.map((r: any) => r.text).join('') ||
          vr.shortBylineText?.runs?.map((r: any) => r.text).join('') ||
          'Kanal';
        const channelId =
          vr.ownerText?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.browseId ||
          vr.shortBylineText?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.browseId ||
          '';
        const thumbs = vr.thumbnail?.thumbnails || [];
        const thumbUrl =
          thumbs[thumbs.length - 1]?.url ||
          `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`;
        const avatarThumbs =
          vr.channelThumbnailSupportedRenderers?.channelThumbnailWithLinkRenderer?.thumbnail?.thumbnails || [];
        const avatarUrl = avatarThumbs[avatarThumbs.length - 1]?.url;

        let duration = 0;
        const lengthText =
          vr.lengthText?.simpleText ||
          vr.lengthText?.runs?.map((r: any) => r.text).join('');
        if (lengthText) {
          const parts = lengthText.split(':').map(Number);
          if (parts.length === 2) duration = parts[0] * 60 + parts[1];
          else if (parts.length === 3) duration = parts[0] * 3600 + parts[1] * 60 + parts[2];
        }

        let viewCount = 0;
        const vcText =
          vr.viewCountText?.simpleText ||
          vr.viewCountText?.runs?.map((r: any) => r.text).join('') ||
          '';
        const match = vcText.replace(/\./g, '').replace(/,/g, '').match(/\d+/);
        if (match) viewCount = parseInt(match[0], 10);

        list.push({
          id: vid,
          title,
          uploaderName: channelName,
          uploaderId: channelId,
          uploaderAvatarUrl: avatarUrl,
          thumbnailUrl: thumbUrl,
          duration,
          viewCount,
          uploadDate: vr.publishedTimeText?.simpleText || '',
          streamType: vr.navigationEndpoint?.reelWatchEndpoint ? 'SHORTS' : 'VIDEO_STREAM',
        });
      }
    }

    if (node.compactVideoRenderer) {
      const cvr = node.compactVideoRenderer;
      const vid = cvr.videoId;
      if (vid && !seenIds.has(vid)) {
        seenIds.add(vid);
        const title =
          cvr.title?.runs?.map((r: any) => r.text).join('') ||
          cvr.title?.simpleText ||
          'Video';
        const channelName =
          cvr.shortBylineText?.runs?.map((r: any) => r.text).join('') ||
          cvr.longBylineText?.runs?.map((r: any) => r.text).join('') ||
          'Kanal';
        const channelId =
          cvr.shortBylineText?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.browseId ||
          cvr.longBylineText?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.browseId ||
          '';
        const thumbs = cvr.thumbnail?.thumbnails || [];
        const thumbUrl = thumbs[thumbs.length - 1]?.url || `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`;
        const avatarThumbs =
          cvr.channelThumbnailSupportedRenderers?.channelThumbnailWithLinkRenderer?.thumbnail?.thumbnails || [];
        const avatarUrl = avatarThumbs[avatarThumbs.length - 1]?.url;

        let duration = 0;
        const lengthText =
          cvr.lengthText?.simpleText ||
          cvr.lengthText?.runs?.map((r: any) => r.text).join('');
        if (lengthText) {
          const parts = lengthText.split(':').map(Number);
          if (parts.length === 2) duration = parts[0] * 60 + parts[1];
          else if (parts.length === 3) duration = parts[0] * 3600 + parts[1] * 60 + parts[2];
        }

        let viewCount = 0;
        const vcText =
          cvr.viewCountText?.simpleText ||
          cvr.viewCountText?.runs?.map((r: any) => r.text).join('') ||
          '';
        const match = vcText.replace(/\./g, '').replace(/,/g, '').match(/\d+/);
        if (match) viewCount = parseInt(match[0], 10);

        list.push({
          id: vid,
          title,
          uploaderName: channelName,
          uploaderId: channelId || channelName,
          uploaderAvatarUrl: avatarUrl,
          thumbnailUrl: thumbUrl,
          duration,
          viewCount,
          uploadDate: cvr.publishedTimeText?.simpleText || '',
          streamType: cvr.navigationEndpoint?.reelWatchEndpoint ? 'SHORTS' : 'VIDEO_STREAM',
        });
      }
    }

    if (node.gridVideoRenderer) {
      const gvr = node.gridVideoRenderer;
      const vid = gvr.videoId;
      if (vid && !seenIds.has(vid)) {
        seenIds.add(vid);
        const title =
          gvr.title?.runs?.map((r: any) => r.text).join('') ||
          gvr.title?.simpleText ||
          'Video';
        const channelName =
          gvr.shortBylineText?.runs?.map((r: any) => r.text).join('') || 'Kanal';
        const channelId =
          gvr.shortBylineText?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.browseId ||
          '';
        const thumbs = gvr.thumbnail?.thumbnails || [];
        const thumbUrl =
          thumbs[thumbs.length - 1]?.url ||
          `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`;

        list.push({
          id: vid,
          title,
          uploaderName: channelName,
          uploaderId: channelId,
          thumbnailUrl: thumbUrl,
          duration: 0,
          viewCount: 0,
          uploadDate: gvr.publishedTimeText?.simpleText || '',
          streamType: 'VIDEO_STREAM',
        });
      }
    }

    if (node.shortsLockupViewModel) {
      const sm = node.shortsLockupViewModel;
      const vid =
        sm.onTap?.innertubeCommand?.reelWatchEndpoint?.videoId ||
        (sm.entityId ? sm.entityId.replace(/^shorts-shelf-item-/, '') : '');
      if (vid && !seenIds.has(vid)) {
        seenIds.add(vid);
        const title = sm.overlayMetadata?.primaryText?.content || 'Shorts';
        const viewsStr = sm.overlayMetadata?.secondaryText?.content || '0';
        const viewCount = parseInt(viewsStr.replace(/[^0-9]/g, ''), 10) || 0;
        const a11y = sm.overlayMetadata?.primaryText?.accessibility?.accessibilityData?.label || '';
        const match = a11y.match(/yayınlayan:\s*([^,]+)/i) || a11y.match(/tarafından\s*([^,]+)/i);
        const channelName = match ? match[1].trim() : 'Shorts';
        const thumbs = sm.thumbnailViewModel?.thumbnailViewModel?.image?.sources || [];
        const thumbUrl = thumbs[thumbs.length - 1]?.url || `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`;

        list.push({
          id: vid,
          title,
          uploaderName: channelName,
          uploaderId: channelName,
          thumbnailUrl: thumbUrl,
          duration: 60,
          viewCount,
          streamType: 'SHORTS',
        });
      }
    }

    if (node.reelItemRenderer) {
      const r = node.reelItemRenderer;
      const vid = r.videoId;
      if (vid && !seenIds.has(vid)) {
        seenIds.add(vid);
        const title = r.headline?.simpleText || r.headline?.runs?.map((x: any) => x.text).join('') || 'Shorts';
        const channelName =
          r.shortBylineText?.simpleText ||
          r.shortBylineText?.runs?.map((x: any) => x.text).join('') ||
          'Shorts';
        const channelId =
          r.shortBylineText?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.browseId ||
          '';
        const thumbs = r.thumbnail?.thumbnails || [];
        const thumbUrl = thumbs[thumbs.length - 1]?.url || `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`;
        const vcText = r.viewCountText?.simpleText || r.viewCountText?.runs?.map((x: any) => x.text).join('') || '';
        const match = vcText.replace(/\./g, '').replace(/,/g, '').match(/\d+/);
        const viewCount = match ? parseInt(match[0], 10) : 0;

        list.push({
          id: vid,
          title,
          uploaderName: channelName,
          uploaderId: channelId || channelName,
          thumbnailUrl: thumbUrl,
          duration: 60,
          viewCount,
          streamType: 'SHORTS',
        });
      }
    }

    if (node.lockupViewModel) {
      const vm = node.lockupViewModel;
      const vid =
        vm.contentId ||
        vm.rendererContext?.commandContext?.onTap?.innertubeCommand?.watchEndpoint?.videoId;
      if (vid && !seenIds.has(vid) &&
          (!vm.contentType || ['LOCKUP_CONTENT_TYPE_VIDEO', 'LOCKUP_CONTENT_TYPE_SHORT'].includes(vm.contentType))) {
        seenIds.add(vid);
        const title = vm.metadata?.lockupMetadataViewModel?.title?.content || 'Video';
        const rows =
          vm.metadata?.lockupMetadataViewModel?.metadata?.contentMetadataViewModel?.metadataRows || [];
        const channelName = rows[0]?.metadataParts?.[0]?.text?.content || 'Kanal';
        const thumbs = vm.contentImage?.thumbnailViewModel?.image?.sources || [];
        const thumbUrl = thumbs[thumbs.length - 1]?.url || `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`;

        let duration = 0;
        const overlays = vm.contentImage?.thumbnailViewModel?.overlays || [];
        for (const ov of overlays) {
          const badges = ov.thumbnailBottomOverlayViewModel?.badges || [];
          for (const b of badges) {
            const timeStr = b.thumbnailBadgeViewModel?.text;
            if (timeStr && timeStr.includes(':')) {
              const parts = timeStr.split(':').map(Number);
              if (parts.length === 2) duration = parts[0] * 60 + parts[1];
              else if (parts.length === 3) duration = parts[0] * 3600 + parts[1] * 60 + parts[2];
            }
          }
        }

        let viewCount = 0;
        const vcText = rows[1]?.metadataParts?.[0]?.text?.content || '';
        const match = vcText.replace(/\./g, '').replace(/,/g, '').match(/\d+/);
        if (match) viewCount = parseInt(match[0], 10);

        const isShort = vm.contentType === 'LOCKUP_CONTENT_TYPE_SHORT';

        list.push({
          id: vid,
          title,
          uploaderName: channelName,
          uploaderId: findChannelBrowseId(vm),
          uploaderAvatarUrl: cleanUrl(vm.metadata?.lockupMetadataViewModel?.image?.decoratedAvatarViewModel?.avatar?.avatarViewModel?.image?.sources?.slice(-1)[0]?.url),
          thumbnailUrl: thumbUrl,
          duration,
          viewCount,
          uploadDate: rows[1]?.metadataParts?.[1]?.text?.content || '',
          streamType: isShort ? 'SHORTS' : 'VIDEO_STREAM',
        });
      }
    }

    if (Array.isArray(node)) {
      for (const child of node) traverse(child);
    } else {
      for (const key of Object.keys(node)) {
        traverse(node[key]);
      }
    }
  };

  traverse(data);
  return list;
}

export class YouTubeService {
  private static streamCache = new Map<string, { bundle: StreamBundle; expiresAt: number }>();
  private static streamRequests = new Map<string, Promise<StreamBundle>>();
  private static streamRevisions = new Map<string, number>();
  private static avatarCache = new Map<string, { url: string | undefined; expiresAt: number }>();
  private static avatarRequests = new Map<string, Promise<string | undefined>>();

  static async getChannelAvatar(channelId: string): Promise<string | undefined> {
    if (!channelId?.startsWith('UC')) return undefined;
    const cached = this.avatarCache.get(channelId);
    if (cached && cached.expiresAt > Date.now()) return cached.url;
    const pending = this.avatarRequests.get(channelId);
    if (pending) return pending;
    const request = (async () => {
      try {
        const channel = await this.getChannelDetails(channelId);
        const url = channel.avatarUrl && !channel.avatarUrl.includes('default_avatar') ? cleanUrl(channel.avatarUrl) : undefined;
        if (this.avatarCache.size > 200) this.avatarCache.delete(this.avatarCache.keys().next().value!);
        this.avatarCache.set(channelId, { url, expiresAt: Date.now() + (url ? 3600000 : 30000) });
        return url;
      } finally {
        this.avatarRequests.delete(channelId);
      }
    })();
    this.avatarRequests.set(channelId, request);
    return request;
  }

  static clearStreamCache(videoId?: string) {
    if (videoId) {
      this.streamRevisions.set(videoId, (this.streamRevisions.get(videoId) || 0) + 1);
      this.streamRequests.delete(videoId);
      this.streamRequests.delete(`${videoId}:protected`);
      this.streamCache.delete(videoId);
    } else {
      for (const id of this.streamRevisions.keys()) this.streamRevisions.set(id, this.streamRevisions.get(id)! + 1);
      this.streamRequests.clear();
      this.streamCache.clear();
    }
  }

  static hasCachedStreams(videoId: string): boolean {
    const cached = this.streamCache.get(videoId);
    return Boolean(cached && cached.expiresAt > Date.now());
  }

  /**
   * Helper: InnerTube POST request with YouTube Web, TV, VR or iOS client
   */
  static async request(endpoint: string, payload: any): Promise<any> {
    return this.postInnerTube(endpoint, payload, 'WEB');
  }

  private static async postInnerTube(
    endpoint: string,
    payload: any,
    clientType: 'IOS' | 'WEB' | 'ANDROID_VR' | 'TV' = 'WEB',
    useAuth: boolean = false
  ): Promise<any> {
    const isIOS = clientType === 'IOS';
    const isVR = clientType === 'ANDROID_VR';
    const isTV = clientType === 'TV';
    const url = `https://www.youtube.com/youtubei/v1/${endpoint}?prettyPrint=false`;
    let clientContext: any;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (useAuth) {
      const authHeader = await YouTubeAuthService.getAuthHeader();
      if (!authHeader) throw new Error('YouTube hesabınızı Ayarlar’dan bağlayın.');
      headers['Authorization'] = authHeader;
    }

    if (isTV) {
      clientContext = {
        clientName: 'TVHTML5',
        clientVersion: '7.20260311.12.00',
        hl: 'tr',
        gl: 'TR',
      };
      headers['User-Agent'] = 'Mozilla/5.0 (ChromiumStylePlatform) Cobalt/Version';
      headers['Referer'] = 'https://www.youtube.com/tv';
      headers['Origin'] = 'https://www.youtube.com';
      headers['X-YouTube-Client-Name'] = '7';
      headers['X-YouTube-Client-Version'] = '7.20260311.12.00';
    } else if (isIOS) {
      clientContext = {
        clientName: 'IOS',
        clientVersion: '20.01.2',
        deviceMake: 'Apple',
        deviceModel: 'iPhone16,2',
        osName: 'iOS',
        osVersion: '18.1.1',
        hl: 'tr',
        gl: 'TR',
      };
      headers['User-Agent'] = IOS_USER_AGENT;
      headers['X-YouTube-Client-Name'] = '5';
      headers['X-YouTube-Client-Version'] = '20.01.2';
    } else if (isVR) {
      clientContext = {
        clientName: 'ANDROID_VR',
        clientVersion: '1.60.19',
        deviceMake: 'Oculus',
        deviceModel: 'Quest 3',
        osName: 'Android',
        osVersion: '12',
        hl: 'tr',
        gl: 'TR',
      };
      headers['User-Agent'] =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    } else {
      clientContext = {
        clientName: 'WEB',
        clientVersion: '2.20240901.01.00',
        hl: 'tr',
        gl: 'TR',
      };
    }

    const body = JSON.stringify({ context: { client: clientContext }, ...payload });
    const request = async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);
      try {
        return await fetch(url, { method: 'POST', headers, body, signal: controller.signal });
      } finally {
        clearTimeout(timeout);
      }
    };
    let res = await request();
    if (useAuth && res.status === 401) {
      const refreshed = await YouTubeAuthService.getAuthHeader(true);
      if (!refreshed) throw new Error('YouTube hesabınızı Ayarlar’dan yeniden bağlayın.');
      headers.Authorization = refreshed;
      res = await request();
    }
    if (!res.ok) {
      if (useAuth) {
        throw new Error(res.status === 401 || res.status === 403
          ? 'YouTube hesabına erişilemedi. Ayarlar’dan hesabınızı yeniden bağlayın.'
          : 'YouTube akışı yüklenemedi. Lütfen tekrar deneyin.');
      }
      throw new Error(`InnerTube request failed: ${res.status}`);
    }
    const data = await res.json();
    if (data.error) throw new Error('YouTube akışı yüklenemedi. Lütfen tekrar deneyin.');
    if (useAuth) {
      const loggedOut = data.responseContext?.mainAppWebResponseContext?.loggedOut ||
        data.responseContext?.serviceTrackingParams?.some((service: any) =>
          service.params?.some((param: any) => param.key === 'logged_in' && param.value === '0'));
      if (loggedOut) throw new Error('YouTube oturumu doğrulanamadı. Ayarlar’dan hesabınızı yeniden bağlayın.');
    }
    return data;
  }

  private static async getPersonalBrowse(payload: Record<string, string>): Promise<any> {
    const data = await this.postInnerTube('browse', payload, 'TV', true);
    if (!data.contents && !data.continuationContents && !data.onResponseReceivedActions && !data.onResponseReceivedEndpoints) {
      throw new Error('YouTube kişisel akışınızı göndermedi. Lütfen tekrar deneyin.');
    }
    return data;
  }

  private static async getPersonalHome(): Promise<VideoItem[]> {
    let data = await this.getPersonalBrowse({ browseId: 'default' });
    let videos = extractVideosFromBrowse(data);
    if (videos.length === 0) {
      data = await this.getPersonalBrowse({ browseId: 'FEwhat_to_watch' });
      videos = extractVideosFromBrowse(data);
    }
    if (videos.length === 0) {
      throw new Error('YouTube kişisel önerilerinizi göndermedi. İzleme geçmişiniz kapalı olabilir; tekrar deneyin.');
    }
    return videos;
  }

  private static async getPersonalCategory(category: string): Promise<VideoItem[]> {
    if (category === 'all' || category === 'foryou') return this.getPersonalHome();
    const browseIds: Record<string, string> = {
      now: 'FEtrending', trending: 'FEtrending', music: 'FEtopics_music', gaming: 'FEtopics_gaming', news: 'FEtopics_news', movies: 'FEtopics_movies',
    };
    if (browseIds[category]) {
      return extractVideosFromBrowse(await this.getPersonalBrowse({ browseId: browseIds[category] }));
    }
    // Use YouTube's own category command instead of substituting generic search results.
    const home = await this.getPersonalBrowse({ browseId: 'default' });
    const labels: Record<string, string[]> = { tech: ['teknoloji', 'technology'] };
    let selected: any;
    const findCategory = (node: any) => {
      if (!node || typeof node !== 'object' || selected) return;
      const chip = node.chipCloudChipRenderer || node.tabRenderer;
      const title = browseText(chip?.text || chip?.title).toLowerCase();
      const endpoint = chip?.navigationEndpoint?.browseEndpoint || chip?.endpoint?.browseEndpoint;
      if (endpoint && labels[category]?.includes(title)) selected = endpoint;
      else Object.values(node).forEach(findCategory);
    };
    findCategory(home.contents);
    if (!selected) throw new Error('YouTube hesabınızda bu kategori mevcut değil. Sana Özel akışını açabilirsiniz.');
    return extractVideosFromBrowse(await this.getPersonalBrowse(selected));
  }

  /**
   * 1. Get Home Feed based on Category (supports authenticated personal TV feed)
   */
  static async getHomeFeed(category: string = 'all'): Promise<VideoItem[]> {
    if (await YouTubeAuthService.isAuthenticated()) return this.getPersonalCategory(category);
    try {
      let queries: string[];
      if (category === 'all') {
        queries = ['türkiye gündem', 'türkçe popüler müzik', 'türkçe podcast'];
      } else if (category === 'trending') {
        queries = ['türkiye trend videolar', 'türkiye gündem', 'en çok izlenen türkçe'];
      } else if (category === 'music') {
        queries = ['türkçe popüler müzik klipleri', 'yeni türkçe şarkılar', 'trend müzik'];
      } else if (category === 'gaming') {
        queries = ['türkçe oyun gameplay', 'oyun trendleri', 'türkçe oyun'];
      } else if (category === 'news') {
        queries = ['türkiye haberleri canlı', 'son dakika haberler gündem'];
      } else if (category === 'tech') {
        queries = ['teknoloji haberleri türkiye', 'yeni telefon inceleme', 'teknoloji'];
      } else {
        queries = [category];
      }

      const results = await Promise.all(queries.map((q) => this.searchVideos(q)));
      const map = new Map<string, VideoItem>();
      for (const list of results) {
        for (const item of list) {
          if (!map.has(item.id)) {
            map.set(item.id, item);
          }
        }
      }
      const all = Array.from(map.values());
      // Prioritize long form videos
      all.sort((a, b) => (b.duration > 60 ? 1 : 0) - (a.duration > 60 ? 1 : 0));
      if (all.length > 0) return all;
      return this.getFallbackTrending();
    } catch {
      return this.getFallbackTrending();
    }
  }

  /**
   * Get user's authentic YouTube Subscriptions feed when signed in
   */
  static async getPersonalSubscriptions(): Promise<VideoItem[]> {
    if (!await YouTubeAuthService.isAuthenticated()) return [];
    return extractVideosFromBrowse(await this.getPersonalBrowse({ browseId: 'FEsubscriptions' }));
  }

  static async getPersonalSubscriptionFeed(): Promise<{ videos: VideoItem[]; channels: UserSubscription[] }> {
    if (!await YouTubeAuthService.isAuthenticated()) return { videos: [], channels: [] };
    const data = await this.getPersonalBrowse({ browseId: 'FEsubscriptions' });
    const videos = extractVideosFromBrowse(data);
    let channels = extractChannelsFromBrowse(data);
    if (channels.length === 0) {
      // Older TV responses can expose the channel list through a separate feed.
      const channelData = await this.getPersonalBrowse({ browseId: 'FEchannels' });
      const unique = new Map<string, UserSubscription>();
      let page = channelData;
      const seenContinuations = new Set<string>();
      while (page) {
        for (const channel of extractChannelsFromBrowse(page)) unique.set(channel.channelId, channel);
        const continuations: string[] = [];
        const findNext = (node: any) => {
          if (!node || typeof node !== 'object') return;
          const token = node.nextContinuationData?.continuation ||
            node.continuationItemRenderer?.continuationEndpoint?.continuationCommand?.token;
          if (token) continuations.push(token);
          Object.values(node).forEach(findNext);
        };
        findNext(page.contents || page.continuationContents || page.onResponseReceivedActions || page.onResponseReceivedEndpoints);
        const next = continuations.find((token) => !seenContinuations.has(token));
        if (!next) break;
        seenContinuations.add(next);
        page = await this.getPersonalBrowse({ continuation: next });
      }
      channels = Array.from(unique.values());
    }
    return { videos, channels };
  }

  static async getPersonalSubscribedChannels(): Promise<UserSubscription[]> {
    return (await this.getPersonalSubscriptionFeed()).channels;
  }

  static async getPersonalChannelSubscriptions(channel: UserSubscription): Promise<VideoItem[]> {
    const payload: Record<string, string> = channel.youtubeBrowseParams
      ? { browseId: 'FEsubscriptions', params: channel.youtubeBrowseParams }
      : { browseId: channel.channelId };
    return extractVideosFromBrowse(await this.getPersonalBrowse(payload));
  }

  /**
   * 2. Get Trending Videos by tab
   */
  static async getTrendingVideos(cat: string = 'now'): Promise<VideoItem[]> {
    if (await YouTubeAuthService.isAuthenticated()) return this.getPersonalCategory(cat);
    if (cat === 'foryou') return this.getHomeFeed('all');
    try {
      let queries: string[];
      if (cat === 'music') {
        queries = ['trend müzik türkiye pop', 'türkçe popüler şarkılar'];
      } else if (cat === 'gaming') {
        queries = ['trend oyun türkiye', 'türkçe gameplay popüler'];
      } else if (cat === 'movies') {
        queries = ['yeni film fragmanları', 'türkçe sinema fragman'];
      } else {
        queries = ['türkiye trend videolar', 'en çok izlenen türkçe', 'türkiye gündem'];
      }

      const results = await Promise.all(queries.map((q) => this.searchVideos(q)));
      const map = new Map<string, VideoItem>();
      for (const list of results) {
        for (const item of list) {
          if (!map.has(item.id)) {
            map.set(item.id, item);
          }
        }
      }
      const all = Array.from(map.values());
      all.sort((a, b) => (b.duration > 60 ? 1 : 0) - (a.duration > 60 ? 1 : 0));
      if (all.length > 0) return all;
      return this.getFallbackTrending();
    } catch {
      return this.getFallbackTrending();
    }
  }

  /**
   * 3. Search Videos, Shorts, Channels
   */
  static async searchVideos(query: string): Promise<VideoItem[]> {
    if (!query) return [];
    try {
      const data = await this.postInnerTube('search', { query }, 'WEB');
      return this.parseSearchSection(data);
    } catch {
      return [];
    }
  }

  /**
   * Helper: Parse Search and Browse Section List to VideoItem Array
   */
  public static parseSearchSection(data: any): VideoItem[] {
    const items: VideoItem[] = [];
    const sections =
      data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents ||
      data?.contents?.sectionListRenderer?.contents ||
      [];

    for (const s of sections) {
      const contents = s?.itemSectionRenderer?.contents || [];
      for (const c of contents) {
        if (c.videoRenderer) {
          const item = this.parseVideoRenderer(c.videoRenderer);
          if (item) items.push(item);
        } else if (c.compactVideoRenderer) {
          const item = this.parseVideoRenderer(c.compactVideoRenderer);
          if (item) items.push(item);
        } else if (c.lockupViewModel?.contentId) {
          items.push(...extractVideosFromBrowse(c));
        } else if (c.gridShelfViewModel?.contents) {
          for (const inner of c.gridShelfViewModel.contents) {
            if (inner.lockupViewModel?.contentId) {
              items.push(...extractVideosFromBrowse(inner));
            } else if (inner.shortsLockupViewModel?.entityId) {
              const sm = inner.shortsLockupViewModel;
              const vidId = sm.entityId.replace(/^shorts-shelf-item-/, '');
              const title = sm.overlayMetadata?.primaryText?.content || 'Shorts';
              const viewsStr = sm.overlayMetadata?.secondaryText?.content || '0';
              const viewCount = parseInt(viewsStr.replace(/[^0-9]/g, ''), 10) || 0;
              const a11y = sm.overlayMetadata?.primaryText?.accessibility?.accessibilityData?.label || '';
              const match = a11y.match(/yayınlayan:\s*([^,]+)/i) || a11y.match(/tarafından\s*([^,]+)/i);
              const author = match ? match[1].trim() : 'Shorts';
              items.push({
                id: vidId,
                title,
                uploaderName: author,
                viewCount,
                duration: 60,
                streamType: 'SHORTS',
                thumbnailUrl: `https://i.ytimg.com/vi/${vidId}/hqdefault.jpg`,
              });
            }
          }
        } else if (c.shelfRenderer) {
          const shelfItems =
            c.shelfRenderer.content?.verticalListRenderer?.items ||
            c.shelfRenderer.content?.expandedShelfContentsRenderer?.items ||
            c.shelfRenderer.content?.gridRenderer?.items ||
            [];
          for (const item of shelfItems) {
            if (item.videoRenderer) {
              const parsed = this.parseVideoRenderer(item.videoRenderer);
              if (parsed) items.push(parsed);
            } else if (item.compactVideoRenderer) {
              const parsed = this.parseVideoRenderer(item.compactVideoRenderer);
              if (parsed) items.push(parsed);
            }
          }
        }
      }
    }
    return items.filter((it) => Boolean(it && it.id && typeof it.id === 'string' && it.id.length > 0));
  }

  /**
   * 3. Get Playback Stream Bundle (Audio, Video & Dynamic DASH Manifest)
   */
  static async getPlaybackStreams(videoId: string, options: { forceRefresh?: boolean; preferProtected?: boolean } = {}): Promise<StreamBundle> {
    if (options.forceRefresh) this.clearStreamCache(videoId);
    const cached = this.streamCache.get(videoId);
    if (cached && cached.expiresAt > Date.now() && (!options.preferProtected || cached.bundle.hlsManifestUrl || cached.bundle.dashManifestUrl)) return cached.bundle;
    const key = options.preferProtected ? `${videoId}:protected` : videoId;
    const pending = this.streamRequests.get(key);
    if (pending) return pending;
    const revision = this.streamRevisions.get(videoId) || 0;
    this.streamRevisions.set(videoId, revision);
    const request = this.resolvePlaybackStreams(videoId, !!options.preferProtected).then((bundle) => {
      bundle.expiresAt = streamExpiresAt(bundle);
      if ((this.streamRevisions.get(videoId) || 0) === revision) {
        const expiryTimes = [bundle.hlsManifestUrl, bundle.dashManifestUrl, ...bundle.videoStreams.map((stream) => stream.url)]
          .flatMap((url) => {
            try {
              const expiry = Number(new URL(url || '').searchParams.get('expire')) * 1000;
              return expiry > 0 ? [expiry - 60000] : [];
            } catch { return []; }
          });
        this.streamCache.set(videoId, { bundle, expiresAt: Math.min(Date.now() + 180000, ...expiryTimes) });
      }
      return bundle;
    }).finally(() => {
      if (this.streamRequests.get(key) === request) this.streamRequests.delete(key);
    });
    this.streamRequests.set(key, request);
    return request;
  }

  private static async resolvePlaybackStreams(videoId: string, preferProtected: boolean): Promise<StreamBundle> {
    // 1. Try Native NewPipeExtractor first for unthrottled streaming
    try {
      const nativeRes = await NativePlayerBridge.resolveStreams(videoId, preferProtected);
      if (nativeRes && nativeRes.videoStreams && nativeRes.videoStreams.length > 0) {
        if (nativeRes.videoId && nativeRes.videoId !== videoId) throw new Error('Medya kaynağı video ile eşleşmedi.');
        const defaultHeaders = nativeRes.headers || {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          Referer: 'https://www.youtube.com/',
          Origin: 'https://www.youtube.com',
        };
        const videoStreams = (nativeRes.videoStreams || []).map((s: any) => ({
          ...s,
          headers: s.headers || defaultHeaders,
        }));
        const audioStreams = (nativeRes.audioStreams || []).map((s: any) => ({
          ...s,
          headers: s.headers || defaultHeaders,
        }));
        const bundle: StreamBundle = {
          videoId,
          storyboards: nativeRes.storyboards || [],
          chapters: nativeRes.chapters || [],
          title: nativeRes.title || 'Video',
          uploaderName: nativeRes.uploaderName || 'Kanal',
          uploaderId: nativeRes.uploaderId,
          uploaderUrl: nativeRes.uploaderUrl,
          uploaderAvatarUrl: nativeRes.uploaderAvatarUrl,
          uploaderSubscriberCount: undefined,
          description: nativeRes.description || '',
          uploadDate: undefined,
          viewCount: Number(nativeRes.viewCount) || 0,
          thumbnailUrl: nativeRes.thumbnailUrl || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
          isLive: Boolean(nativeRes.isLive),
          isUpcoming: false,
          videoStreams,
          audioStreams,
          bestAudioStreamUrl: nativeRes.bestAudioStreamUrl || audioStreams[0]?.url,
          subtitles: [],
          relatedVideos: [],
          dashManifestUrl: nativeRes.dashUrl,
          hlsManifestHeaders: defaultHeaders,
          dashManifestHeaders: defaultHeaders,
          hlsManifestUrl: nativeRes.hlsUrl,
        };
        return bundle;
      }
    } catch (nativeErr) {
      console.warn('[YouTubeService] Native resolver fallback:', nativeErr);
    }

    const [playerData, vrPlayerData, nextInfo] = await Promise.all([
      this.postInnerTube('player', { videoId }, 'IOS').catch(() => null),
      this.postInnerTube('player', { videoId }, 'ANDROID_VR').catch(() => null),
      this.getWatchNext(videoId).catch(() => ({
        relatedVideos: [],
        uploaderAvatarUrl: undefined,
        subscriberCount: undefined,
        uploaderId: undefined,
        description: undefined,
        uploadDate: undefined,
      })),
    ]);

    const streamingData = playerData?.streamingData;
    const details = playerData?.videoDetails || vrPlayerData?.videoDetails || {};

    const videoStreams: StreamItem[] = [];
    const audioStreams: StreamItem[] = [];

    const defaultBrowserHeaders = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    };

    // 1. Progressive Muxed formats from ANDROID_VR (Direct MP4 with video+audio, never fail with 403)
    for (const f of vrPlayerData?.streamingData?.formats || []) {
      if (f.url) {
        videoStreams.push({
          url: f.url,
          quality: f.qualityLabel || '360p',
          format: 'mp4',
          isAdaptive: false,
          bitrate: f.bitrate,
          height: f.height,
          headers: defaultBrowserHeaders,
        });
      }
    }

    // 2. Progressive Muxed formats from iOS client (if any)
    for (const f of streamingData?.formats || []) {
      if (f.url && !videoStreams.some((s) => s.url === f.url)) {
        videoStreams.push({
          url: f.url,
          quality: f.qualityLabel || '360p',
          format: 'mp4',
          isAdaptive: false,
          bitrate: f.bitrate,
          height: f.height,
          headers: { 'User-Agent': IOS_USER_AGENT },
        });
      }
    }

    // 3. Adaptive formats (HD video and high-bitrate audio) from both clients
    const combinedAdaptive = [
      ...(streamingData?.adaptiveFormats || []),
      ...(vrPlayerData?.streamingData?.adaptiveFormats || []),
    ];

    for (const f of combinedAdaptive) {
      if (!f.url) continue;
      if (videoStreams.some((s) => s.url === f.url) || audioStreams.some((s) => s.url === f.url)) continue;

      const mime = f.mimeType || '';
      const isFromIOS = streamingData?.adaptiveFormats?.some((af: any) => af.url === f.url);
      const streamHeaders = isFromIOS ? { 'User-Agent': IOS_USER_AGENT } : defaultBrowserHeaders;

      if (mime.startsWith('audio/')) {
        audioStreams.push({
          url: f.url,
          quality: `${Math.round((f.bitrate || 128000) / 1000)} kbps`,
          format: mime.includes('webm') ? 'webm' : 'mp4',
          isAdaptive: true,
          bitrate: f.bitrate,
          audioOnly: true,
          headers: streamHeaders,
        });
      } else if (mime.startsWith('video/')) {
        videoStreams.push({
          url: f.url,
          quality: f.qualityLabel || `${f.height}p`,
          format: mime.includes('webm') ? 'webm' : 'mp4',
          isAdaptive: true,
          bitrate: f.bitrate,
          height: f.height,
          headers: streamHeaders,
        });
      }
    }

    // Sort video streams by resolution desc
    videoStreams.sort((a, b) => (b.height || 0) - (a.height || 0));
    // Sort audio streams by bitrate desc
    audioStreams.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));

    // Dynamic DASH MPD generation for synchronized video + audio
    let dashManifestUrl: string | undefined;
    const dashData = [streamingData, vrPlayerData?.streamingData].find((data) => {
      const formats = data?.adaptiveFormats || [];
      return formats.some((f: any) => f.url && f.mimeType?.startsWith('video/mp4') && f.initRange && f.indexRange) &&
        formats.some((f: any) => f.url && f.mimeType?.startsWith('audio/mp4') && f.initRange && f.indexRange);
    });
    const mp4Videos = (dashData?.adaptiveFormats || []).filter(
      (f: any) => f.url && f.mimeType?.startsWith('video/mp4') && f.initRange && f.indexRange
    );
    const mp4Audios = (dashData?.adaptiveFormats || []).filter(
      (f: any) => f.url && f.mimeType?.startsWith('audio/mp4') && f.initRange && f.indexRange
    );
    const dashManifestHeaders = dashData === streamingData ? { 'User-Agent': IOS_USER_AGENT } : defaultBrowserHeaders;

    if (mp4Videos.length > 0 && mp4Audios.length > 0) {
      try {
        const durationSec = Number(details.lengthSeconds) || 180;
        const mpdXml = buildDashMpd(durationSec, mp4Videos, mp4Audios);
        const cacheDir = FileSystem.cacheDirectory || FileSystem.documentDirectory || '';
        if (cacheDir) {
          const manifestPath = `${cacheDir}manifest_${videoId}.mpd`;
          await FileSystem.writeAsStringAsync(manifestPath, mpdXml, {
            encoding: FileSystem.EncodingType.UTF8,
          });
          dashManifestUrl = manifestPath;
        }
      } catch (err) {
        console.warn('[YouTubeService] DASH manifest write error:', err);
      }
    }

    const hlsManifestUrl = streamingData?.hlsManifestUrl;

    const bundle: StreamBundle = {
      videoId,
      title: details.title || 'Video',
      uploaderName: details.author || 'Kanal',
      uploaderId: details.channelId || nextInfo.uploaderId || undefined,
      uploaderUrl: (details.channelId || nextInfo.uploaderId) ? `https://www.youtube.com/channel/${details.channelId || nextInfo.uploaderId}` : undefined,
      uploaderAvatarUrl: nextInfo.uploaderAvatarUrl,
      uploaderSubscriberCount: nextInfo.subscriberCount,
      description: nextInfo.description || details.shortDescription || '',
      uploadDate: nextInfo.uploadDate,
      viewCount: Number(details.viewCount) || 0,
      thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      isLive: Boolean(details.isLiveContent),
      isUpcoming: false,
      videoStreams,
      audioStreams,
      bestAudioStreamUrl: audioStreams[0]?.url,
      subtitles: this.parseCaptionTracks(playerData?.captions),
      relatedVideos: nextInfo.relatedVideos,
      dashManifestUrl,
      hlsManifestHeaders: { 'User-Agent': IOS_USER_AGENT },
      dashManifestHeaders,
      hlsManifestUrl,
    };

    return bundle;
  }

  /**
   * Fetches secondary metadata (related videos, subtitles, rich description) in background
   */
  static async getSecondaryMetadata(videoId: string): Promise<{
    storyboards?: import("../types/video").Storyboard[];
    chapters?: import("../types/video").VideoChapter[];
    relatedVideos: VideoItem[];
    subtitles: SubtitleItem[];
    description?: string;
    uploaderAvatarUrl?: string;
    subscriberCount?: string;
    uploadDate?: string;
    uploaderId?: string;
  }> {
    const [watchNextInfo, subtitles, previews] = await Promise.all([
      this.getWatchNext(videoId).catch(() => null),
      this.getCaptions(videoId).catch(() => []),
      this.request('player', { videoId }).catch(() => null),
    ]);
    return {
      storyboards: parseStoryboards(previews?.storyboards?.playerStoryboardSpecRenderer?.spec),
      chapters: watchNextInfo?.chapters || [],
      relatedVideos: watchNextInfo?.relatedVideos || [],
      subtitles: subtitles || [],
      description: watchNextInfo?.description,
      uploaderAvatarUrl: watchNextInfo?.uploaderAvatarUrl,
      subscriberCount: watchNextInfo?.subscriberCount,
      uploadDate: watchNextInfo?.uploadDate,
      uploaderId: watchNextInfo?.uploaderId,
    };
  }

  /**
   * Parse InnerTube captionTracks into SubtitleItem array
   */
  static parseCaptionTracks(captionsData: any): SubtitleItem[] {
    const tracks = captionsData?.playerCaptionsTracklistRenderer?.captionTracks || [];
    const items: SubtitleItem[] = [];
    for (const t of tracks) {
      if (!t.baseUrl) continue;
      const rawName =
        t.name?.runs?.[0]?.text || t.name?.simpleText || t.languageCode || 'Bilinmeyen';
      const isAuto = t.kind === 'asr' || t.vssId?.startsWith('a.');
      items.push({
        languageName: isAuto && !rawName.includes('otomatik') ? `${rawName} (Otomatik)` : rawName,
        languageCode: t.languageCode || 'tr',
        url: t.baseUrl,
        isAutoGenerated: isAuto,
      });
    }
    return items;
  }

  /**
   * Fetch caption tracks for a video via InnerTube player API
   */
  static async getCaptions(videoId: string): Promise<SubtitleItem[]> {
    try {
      const data = await this.postInnerTube('player', { videoId }, 'IOS');
      return this.parseCaptionTracks(data?.captions);
    } catch {
      return [];
    }
  }

  /**
   * Fetch and parse subtitle cues in json3 format with millisecond timestamps
   */
  static async fetchSubtitleCues(
    url: string
  ): Promise<{ startMs: number; endMs: number; text: string }[]> {
    try {
      const sep = url.includes('?') ? '&' : '?';
      const fetchUrl = url.includes('fmt=') ? url : `${url}${sep}fmt=json3`;
      const res = await fetch(fetchUrl);
      const data = await res.json();
      const events = data?.events || [];
      const cues: { startMs: number; endMs: number; text: string }[] = [];

      for (const ev of events) {
        if (!ev.segs || ev.segs.length === 0) continue;
        const text = ev.segs
          .map((s: any) => s.utf8 || '')
          .join('')
          .replace(/\n+/g, ' ')
          .trim();
        if (!text) continue;
        const startMs = Number(ev.tStartMs) || 0;
        const durationMs = Number(ev.dDurationMs) || 0;
        cues.push({
          startMs,
          endMs: startMs + durationMs,
          text,
        });
      }
      return cues.sort((a, b) => a.startMs - b.startMs);
    } catch (e) {
      console.warn('[YouTubeService] fetchSubtitleCues error:', e);
      return [];
    }
  }

  /**
   * 4. Get Video Comments from InnerTube
   */
  static async getComments(videoId: string): Promise<CommentItem[]> {
    try {
      const initial = await this.postInnerTube('next', { videoId }, 'WEB');
      const panel = initial.engagementPanels?.find(
        (p: any) =>
          p.engagementPanelSectionListRenderer?.panelIdentifier === 'comment-item-section' ||
          p.engagementPanelSectionListRenderer?.panelIdentifier === 'engagement-panel-comments-section'
      );

      let token =
        panel?.engagementPanelSectionListRenderer?.content?.sectionListRenderer?.continuations?.[0]
          ?.reloadContinuationData?.continuation;

      if (!token) {
        const findContinuation = (obj: any): string | null => {
          if (!obj || typeof obj !== 'object') return null;
          if (obj.reloadContinuationData?.continuation) return obj.reloadContinuationData.continuation;
          if (obj.continuationCommand?.token) return obj.continuationCommand.token;
          if (Array.isArray(obj)) {
            for (const item of obj) {
              const res = findContinuation(item);
              if (res) return res;
            }
          } else {
            for (const k of Object.keys(obj)) {
              const res = findContinuation(obj[k]);
              if (res) return res;
            }
          }
          return null;
        };
        token = findContinuation(panel || initial);
      }

      if (!token) return [];

      const contData = await this.postInnerTube('next', { continuation: token }, 'WEB');
      const mutations = contData.frameworkUpdates?.entityBatchUpdate?.mutations || [];
      const comments: CommentItem[] = [];

      for (const m of mutations) {
        const c = m.payload?.commentEntityPayload;
        if (c && c.properties?.content?.content) {
          const author = c.author?.displayName || 'Kullanıcı';
          const avatar =
            c.author?.avatarThumbnailUrl ||
            'https://www.gstatic.com/youtube/img/creator/avatar/default_avatar.png';
          const text = c.properties.content.content;
          const time = c.properties.publishedTime || '';
          const likes =
            parseInt((c.toolbar?.likeCountNotliked || '0').replace(/[^0-9]/g, ''), 10) || 0;

          comments.push({
            id: c.commentId || `${Date.now()}_${Math.random()}`,
            authorName: author,
            authorThumbnail: avatar,
            commentText: text,
            likeCount: likes,
            uploadDate: time,
          });
        }
      }
      return comments;
    } catch (err) {
      console.warn('[YouTubeService] getComments error:', err);
      return [];
    }
  }

  /**
   * 5. Get Watch Next (Related Videos & Channel Info & Description) from InnerTube
   */
  static async getWatchNext(videoId: string): Promise<{
    chapters?: import("../types/video").VideoChapter[];
    relatedVideos: VideoItem[];
    uploaderAvatarUrl?: string;
    subscriberCount?: string;
    uploaderId?: string;
    description?: string;
    uploadDate?: string;
  }> {
    try {
      const data = await this.postInnerTube('next', { videoId }, 'WEB');
      const results =
        data.contents?.twoColumnWatchNextResults?.secondaryResults?.secondaryResults?.results || [];
      const items: VideoItem[] = [];

      // Extract Channel Avatar, Subscriber Count, Upload Date & Description
      let uploaderAvatarUrl: string | undefined;
      let subscriberCount: string | undefined;
      let uploaderId: string | undefined;
      let description: string | undefined;
      let uploadDate: string | undefined;

      const mainContents =
        data.contents?.twoColumnWatchNextResults?.results?.results?.contents || [];
      for (const item of mainContents) {
        // Video Primary Info (dates, title, view count)
        if (item.videoPrimaryInfoRenderer) {
          const prim = item.videoPrimaryInfoRenderer;
          uploadDate =
            prim.dateText?.simpleText ||
            prim.relativeDateText?.simpleText ||
            prim.relativeDateText?.accessibility?.accessibilityData?.label;
        }

        // Video Secondary Info (author, avatar, description)
        const secInfo =
          item?.videoSecondaryInfoRenderer ||
          item?.itemSectionRenderer?.contents?.[0]?.videoSecondaryInfoRenderer;
        if (secInfo) {
          if (secInfo.owner?.videoOwnerRenderer) {
            const owner = secInfo.owner.videoOwnerRenderer;
            const thumbs = owner.thumbnail?.thumbnails || [];
            uploaderAvatarUrl = cleanUrl(thumbs[thumbs.length - 1]?.url);
            subscriberCount =
              owner.subscriberCountText?.simpleText ||
              owner.subscriberCountText?.runs?.[0]?.text;
            uploaderId = owner.navigationEndpoint?.browseEndpoint?.browseId;
          }

          if (secInfo.attributedDescription?.content) {
            description = secInfo.attributedDescription.content;
          } else if (secInfo.description?.runs) {
            description = secInfo.description.runs.map((r: any) => r.text || '').join('');
          }
        }
      }

      // Fallback description from engagementPanels
      if (!description && data.engagementPanels) {
        for (const p of data.engagementPanels) {
          const panel = p?.engagementPanelSectionListRenderer;
          if (panel?.panelIdentifier?.includes('description')) {
            const panelItems = panel.content?.structuredDescriptionContentRenderer?.items || [];
            for (const it of panelItems) {
              if (it?.expandableVideoDescriptionBodyRenderer?.attributedDescriptionBodyText?.content) {
                description = it.expandableVideoDescriptionBodyRenderer.attributedDescriptionBodyText.content;
                break;
              }
              if (it?.videoDescriptionHeaderRenderer?.publishDate?.simpleText && !uploadDate) {
                uploadDate = it.videoDescriptionHeaderRenderer.publishDate.simpleText;
              }
            }
          }
          if (description) break;
        }
      }

      // Deep search fallback for videoOwnerRenderer
      if (!uploaderAvatarUrl) {
        const findOwner = (obj: any, depth = 0): any => {
          if (!obj || typeof obj !== 'object' || depth > 8) return null;
          if (obj.videoOwnerRenderer) return obj.videoOwnerRenderer;
          for (const key of Object.keys(obj)) {
            if (key === 'secondaryResults' || key === 'comments' || key === 'comment-item-section') {
              continue;
            }
            const res = findOwner(obj[key], depth + 1);
            if (res) return res;
          }
          return null;
        };
        const foundOwner = findOwner(data.contents);
        if (foundOwner) {
          const thumbs = foundOwner.thumbnail?.thumbnails || [];
          uploaderAvatarUrl = cleanUrl(thumbs[thumbs.length - 1]?.url);
          if (!subscriberCount) {
            subscriberCount =
              foundOwner.subscriberCountText?.simpleText ||
              foundOwner.subscriberCountText?.runs?.[0]?.text;
          }
          if (!uploaderId) {
            uploaderId = foundOwner.navigationEndpoint?.browseEndpoint?.browseId;
          }
        }
      }

      for (const r of results) {
        const vm = r.lockupViewModel;
        if (vm && vm.contentId) {
          const meta = vm.metadata?.lockupMetadataViewModel;
          const title = meta?.title?.content || 'Video';
          const rows = meta?.metadata?.contentMetadataViewModel?.metadataRows || [];
          const author = rows[0]?.metadataParts?.[0]?.text?.content || 'Kanal';
          const viewsStr = rows[1]?.metadataParts?.[0]?.text?.content || '0';
          const viewCount = parseInt(viewsStr.replace(/[^0-9]/g, ''), 10) || 0;

          items.push({
            id: vm.contentId,
            title,
            uploaderName: author,
            viewCount,
            duration: 0,
            thumbnailUrl: `https://i.ytimg.com/vi/${vm.contentId}/hqdefault.jpg`,
          });
          continue;
        }

        const cv = r.compactVideoRenderer;
        if (cv && cv.videoId) {
          items.push(this.parseVideoRenderer(cv));
        }
      }

      return {
        chapters: parseChapters(data),
        relatedVideos: items,
        uploaderAvatarUrl,
        subscriberCount,
        uploaderId,
        description,
        uploadDate,
      };
    } catch {
      return {
        relatedVideos: [],
        uploaderAvatarUrl: undefined,
        subscriberCount: undefined,
        uploaderId: undefined,
        description: undefined,
        uploadDate: undefined,
      };
    }
  }

  static async getRelatedVideos(videoId: string): Promise<VideoItem[]> {
    const res = await this.getWatchNext(videoId);
    return res.relatedVideos;
  }

  static async resolveChannelId(channelRef: string): Promise<string> {
    if (!channelRef) return channelRef;
    if (channelRef.startsWith('UC') || channelRef.startsWith('FE')) return channelRef;

    try {
      const data = await this.postInnerTube('search', { query: channelRef }, 'WEB');
      const sections = data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents || [];
      for (const section of sections) {
        const contents = section?.itemSectionRenderer?.contents || [];
        for (const item of contents) {
          const channel = item?.channelRenderer;
          if (channel?.channelId) return channel.channelId;

          const video = item?.videoRenderer;
          const browseId = video?.ownerText?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.browseId ||
            video?.shortBylineText?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.browseId;
          if (browseId) return browseId;
        }
      }
    } catch {
      // Fall through and let caller use the original reference as a search hint.
    }
    return channelRef;
  }

  /**
   * 6. Get Channel Details & Videos
   */
  static async getChannelDetails(channelId: string): Promise<ChannelDetails> {
    try {
      const resolvedId = await this.resolveChannelId(channelId);
      const canBrowse = resolvedId.startsWith('UC') || resolvedId.startsWith('FE');
      if (!canBrowse) {
        throw new Error('Channel browse id could not be resolved');
      }

      const data = await this.postInnerTube('browse', { browseId: resolvedId });
      const header = data?.header?.c4TabbedHeaderRenderer;
      const pageHeader = data?.header?.pageHeaderRenderer?.content?.pageHeaderViewModel;
      const channelMeta = data?.metadata?.channelMetadataRenderer;

      const name =
        header?.title ||
        pageHeader?.title?.dynamicTextViewModel?.text?.content ||
        channelMeta?.title ||
        channelId ||
        'Kanal';

      const pageHeaderAvatar =
        pageHeader?.image?.decoratedAvatarViewModel?.avatar?.avatarViewModel?.image?.sources?.slice(-1)[0]?.url ||
        pageHeader?.image?.avatarViewModel?.image?.sources?.slice(-1)[0]?.url;
      const metaAvatar = channelMeta?.avatar?.thumbnails?.slice(-1)[0]?.url;
      const c4Avatar = header?.avatar?.thumbnails?.slice(-1)[0]?.url;
      const tvAvatar = data?.header?.tvChannelHeaderRenderer?.avatar?.thumbnails?.slice(-1)[0]?.url;

      const rawAvatar = pageHeaderAvatar || metaAvatar || c4Avatar || tvAvatar;
      const avatarUrl =
        cleanUrl(rawAvatar) ||
        'https://www.gstatic.com/youtube/img/creator/avatar/default_avatar.png';
      const bannerUrl = cleanUrl(header?.banner?.thumbnails?.pop()?.url);
      const subscriberCount =
        header?.subscriberCountText?.simpleText ||
        pageHeader?.metadata?.contentMetadataViewModel?.metadataRows?.[0]?.metadataParts?.[0]?.text?.content ||
        '';

      const videos: VideoItem[] = [];
      const tabs = data?.contents?.twoColumnBrowseResultsRenderer?.tabs || [];
      const videoTab =
        tabs.find((t: any) => t?.tabRenderer?.title === 'Videolar' || t?.tabRenderer?.title === 'Videos') ||
        tabs[0];
      const contents =
        videoTab?.tabRenderer?.content?.richGridRenderer?.contents ||
        videoTab?.tabRenderer?.content?.sectionListRenderer?.contents ||
        [];

      for (const item of contents) {
        const v =
          item?.richItemRenderer?.content?.videoRenderer ||
          item?.videoRenderer ||
          item?.compactVideoRenderer;
        if (v?.videoId) {
          videos.push(this.parseVideoRenderer(v));
          continue;
        }

        const lockup = item?.richItemRenderer?.content?.lockupViewModel || item?.lockupViewModel;
        if (lockup?.contentId) {
          const meta = lockup.metadata?.lockupMetadataViewModel;
          const rows = meta?.metadata?.contentMetadataViewModel?.metadataRows || [];
          videos.push({
            id: lockup.contentId,
            title: meta?.title?.content || 'Video',
            uploaderName: name,
            uploaderId: resolvedId,
            uploaderUrl: `https://www.youtube.com/channel/${resolvedId}`,
            viewCount: parseInt(String(rows[1]?.metadataParts?.[0]?.text?.content || '0').replace(/[^0-9]/g, ''), 10) || 0,
            duration: 0,
            thumbnailUrl: `https://i.ytimg.com/vi/${lockup.contentId}/hqdefault.jpg`,
          });
        }
      }

      if (videos.length === 0 && name) {
        const searchResults = await this.searchVideos(name);
        const ownVideos = searchResults.filter((item) => !item.uploaderId || item.uploaderId === resolvedId);
        videos.push(...ownVideos.slice(0, 30));
      }

      return {
        id: resolvedId,
        name,
        avatarUrl,
        bannerUrl,
        subscriberCount,
        videos,
      };
    } catch {
      return {
        id: channelId,
        name: 'Kanal',
        avatarUrl: 'https://www.gstatic.com/youtube/img/creator/avatar/default_avatar.png',
        videos: [],
      };
    }
  }

  /**
   * 7. Get Playlist Details & Videos
   */
  static async getPlaylistDetails(playlistId: string): Promise<PlaylistDetails> {
    try {
      const browseId = playlistId.startsWith('VL') ? playlistId : `VL${playlistId}`;
      const data = await this.postInnerTube('browse', { browseId });

      const header = data?.header?.playlistHeaderRenderer;
      const title = header?.title?.simpleText || 'Oynatma Listesi';
      const uploaderName = header?.ownerText?.runs?.[0]?.text || '';
      const thumb = header?.playlistHeaderBanner?.thumbnails?.pop()?.url || '';

      const videos: VideoItem[] = [];
      const tabs = data?.contents?.twoColumnBrowseResultsRenderer?.tabs || [];
      const section = tabs[0]?.tabRenderer?.content?.sectionListRenderer?.contents?.[0];
      const contents = section?.itemSectionRenderer?.contents?.[0]?.playlistVideoListRenderer?.contents || [];

      for (const item of contents) {
        const v = item?.playlistVideoRenderer;
        if (v && v.videoId) {
          videos.push(this.parseVideoRenderer(v));
        }
      }

      return {
        id: playlistId,
        title,
        thumbnailUrl: thumb,
        uploaderName,
        videoCount: videos.length,
        videos,
      };
    } catch {
      return {
        id: playlistId,
        title: 'Oynatma Listesi',
        thumbnailUrl: '',
        videoCount: 0,
        videos: [],
      };
    }
  }

  /**
   * 8. Parse InnerTube videoRenderer JSON object to VideoItem
   */
  private static parseVideoRenderer(v: any): VideoItem {
    const videoId = v.videoId;
    const title = v.title?.runs?.[0]?.text || v.title?.simpleText || 'Video';
    const ownerRun = v.ownerText?.runs?.[0] || v.shortBylineText?.runs?.[0];
    const author = ownerRun?.text || 'Kanal';
    const uploaderId = ownerRun?.navigationEndpoint?.browseEndpoint?.browseId ||
      v.longBylineText?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.browseId ||
      undefined;
    const viewsStr = v.viewCountText?.simpleText || v.viewCountText?.runs?.[0]?.text || '0';
    const viewCount = parseInt(viewsStr.replace(/[^0-9]/g, ''), 10) || 0;
    const durationStr = v.lengthText?.simpleText || '';
    const duration = this.parseDuration(durationStr);
    const thumb = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
    const avatar =
      v.channelThumbnail?.thumbnails?.slice(-1)[0]?.url ||
      v.channelThumbnailSupportedRenderers?.channelThumbnailWithLinkRenderer?.thumbnail?.thumbnails?.[0]?.url ||
      v.ownerBadges?.[0]?.metadataBadgeRenderer?.iconUrl ||
      undefined;
    const uploadDate = v.publishedTimeText?.simpleText || undefined;

    return {
      id: videoId,
      title,
      uploaderName: author,
      uploaderId,
      uploaderUrl: uploaderId ? `https://www.youtube.com/channel/${uploaderId}` : undefined,
      uploaderAvatarUrl: cleanUrl(avatar),
      uploadDate,
      viewCount,
      duration,
      thumbnailUrl: thumb,
      isLive: Boolean(v.badges?.some((b: any) => b.metadataBadgeRenderer?.style?.includes('LIVE'))),
    };
  }

  private static parseDuration(str: string): number {
    if (!str) return 0;
    const parts = str.split(':').map(Number);
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return 0;
  }

  private static getFallbackTrending(): VideoItem[] {
    return [];
  }
}
