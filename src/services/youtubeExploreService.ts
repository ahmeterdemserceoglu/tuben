import { YouTubeService, extractVideosFromBrowse, extractChannelsFromBrowse } from './youtubeService';
import { VideoItem } from '../types/video';
import { ChannelItem, ChannelDetails } from '../types/channel';
import { PlaylistDetails } from '../types/playlist';
import { CommentItem } from '../types/comment';
import { YouTubeAuthService } from './youtubeAuthService';

export type SearchKind = 'all' | 'video' | 'shorts' | 'channel' | 'playlist';
export interface SearchFilters { type: SearchKind; date?: number; duration?: number; resolution?: 'any' | 'hd' | '4k'; }
export type SearchResult = { kind: 'video'; item: VideoItem } | { kind: 'channel'; item: ChannelItem } | { kind: 'playlist'; item: PlaylistDetails };
export interface ResultPage<T> { items: T[]; continuation?: string; }
export type ChannelTab = 'videos' | 'shorts' | 'live' | 'playlists' | 'about';
export const text = (value: any): string => typeof value === 'string' ? value : value?.simpleText || value?.content || value?.runs?.map((r: any) => r.text || '').join('') || '';
export function walk(value: any, visit: (node: any) => void) {
  if (!value || typeof value !== 'object') return;
  visit(value);
  for (const child of Object.values(value)) if (child && typeof child === 'object') walk(child, visit);
}
export function continuationOf(value: any): string | undefined {
  let token: string | undefined;
  walk(value, n => { if (n.continuationItemRenderer) token = n.continuationItemRenderer.continuationEndpoint?.continuationCommand?.token; if (n.nextContinuationData) token = n.nextContinuationData.continuation; });
  return token;
}
const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
export function base64(bytes: number[]): string {
  let output = '';
  for (let i = 0; i < bytes.length; i += 3) { const a = bytes[i], b = bytes[i + 1], c = bytes[i + 2]; output += alphabet[a >> 2] + alphabet[((a & 3) << 4) | ((b || 0) >> 4)] + (b === undefined ? '=' : alphabet[((b & 15) << 2) | ((c || 0) >> 6)]) + (c === undefined ? '=' : alphabet[c & 63]); }
  return output;
}
export function encodeSearchFilters(filters: SearchFilters): string {
  const types = { all: 0, video: 1, channel: 2, playlist: 3, shorts: 9 };
  const bytes: number[] = [];
  if (filters.date) bytes.push(8, filters.date);
  if (types[filters.type]) bytes.push(16, types[filters.type]);
  if (filters.duration) bytes.push(24, filters.duration);
  if (filters.resolution === 'hd') bytes.push(32, 1);
  if (filters.resolution === '4k') bytes.push(112, 1);
  return bytes.length ? base64([18, bytes.length, ...bytes]) : '';
}
export function parsePlaylists(data: any): PlaylistDetails[] {
  const found = new Map<string, PlaylistDetails>();
  walk(data, n => {
    const p = n.playlistRenderer || n.gridPlaylistRenderer;
    const vm = n.lockupViewModel;
    const id = p?.playlistId || (vm?.contentType === 'LOCKUP_CONTENT_TYPE_PLAYLIST' ? vm.contentId : undefined);
    if (!id || found.has(id)) return;
    let thumbnails = p?.thumbnails?.[0]?.thumbnails || p?.thumbnail?.thumbnails;
    if (!thumbnails && vm) walk(vm.contentImage, x => { if (x.sources) thumbnails = x.sources; });
    found.set(id, { id, title: text(p?.title || vm?.metadata?.lockupMetadataViewModel?.title), thumbnailUrl: thumbnails?.at(-1)?.url || '', uploaderName: text(p?.shortBylineText || p?.longBylineText), videoCount: Number(text(p?.videoCount).replace(/\D/g, '')) || 0, videos: [] });
  });
  return [...found.values()];
}
export function parseSearchPage(data: any): ResultPage<SearchResult> {
  const items: SearchResult[] = extractVideosFromBrowse(data).map(item => ({ kind: 'video', item }));
  for (const item of extractChannelsFromBrowse(data)) items.push({ kind: 'channel', item: { id: item.channelId, name: item.channelTitle, avatarUrl: item.thumbnailUrl || '' } });
  for (const item of parsePlaylists(data)) items.push({ kind: 'playlist', item });
  return { items, continuation: continuationOf(data) };
}
export interface CommentsPage extends ResultPage<CommentItem> { sortTokens?: { top?: string; newest?: string }; }
export function parseCommentsPage(data: any): CommentsPage {
  const entities = new Map<string, CommentItem>();
  for (const mutation of data.frameworkUpdates?.entityBatchUpdate?.mutations || []) {
    const c = mutation.payload?.commentEntityPayload;
    const commentId = c?.properties?.commentId || c?.commentId;
    if (!commentId) continue;
    entities.set(mutation.entityKey || c.key || commentId, { id: commentId, authorName: c.author?.displayName || 'Kullanıcı', authorThumbnail: c.author?.avatarThumbnailUrl || '', commentText: text(c.properties?.content), likeCount: Number(String(c.toolbar?.likeCountNotliked || '0').replace(/\D/g, '')) || 0, uploadDate: text(c.properties?.publishedTime), repliesCount: Number(c.toolbar?.replyCount || 0) || 0 });
  }
  const comments = new Map<string, CommentItem>();
  let continuation: string | undefined;
  const sortTokens: { top?: string; newest?: string } = {};
  walk(data, n => {
    const c = n.commentRenderer;
    if (c?.commentId) comments.set(c.commentId, { id: c.commentId, authorName: text(c.authorText), authorThumbnail: c.authorThumbnail?.thumbnails?.at(-1)?.url || '', commentText: text(c.contentText), likeCount: Number(text(c.voteCount).replace(/\D/g, '')) || 0, uploadDate: text(c.publishedTimeText) });
    const thread = n.commentThreadRenderer;
    if (thread) {
      const view = thread.commentViewModel?.commentViewModel || thread.comment?.commentViewModel?.commentViewModel;
      const entry = entities.get(view?.commentKey) || [...entities.values()].find(x => x.id === view?.commentId) || comments.get(thread.comment?.commentRenderer?.commentId);
      if (entry) {
        entry.repliesCount = thread.replies?.commentRepliesRenderer?.viewReplies?.buttonRenderer ? Number(text(thread.replies.commentRepliesRenderer.viewReplies.buttonRenderer.text).replace(/\D/g, '')) || entry.repliesCount : entry.repliesCount;
        entry.repliesToken = continuationOf(thread.replies);
        comments.set(entry.id, entry);
      }
    }
    const menu = n.sortFilterSubMenuRenderer?.subMenuItems;
    if (menu) { sortTokens.top = menu[0]?.serviceEndpoint?.continuationCommand?.token; sortTokens.newest = menu[1]?.serviceEndpoint?.continuationCommand?.token; }
  });
  walk(data, n => { const thread = n.commentThreadRenderer; const entry = comments.get(thread?.comment?.commentRenderer?.commentId); if (entry && thread.replies) { entry.repliesToken = continuationOf(thread.replies); entry.repliesCount = Number(text(thread.replies.commentRepliesRenderer?.viewReplies?.buttonRenderer?.text).replace(/\D/g, '')) || 0; } });
  // Only page continuations; reply continuations belong to individual threads.
  const collect = (value: any) => { if (!value || typeof value !== 'object') return; if (value.commentRepliesRenderer) return; if (value.continuationItemRenderer) continuation = value.continuationItemRenderer.continuationEndpoint?.continuationCommand?.token; if (value.nextContinuationData) continuation = value.nextContinuationData.continuation; Object.values(value).forEach(collect); };
  collect(data);
  if (!comments.size) for (const entry of entities.values()) comments.set(entry.id, entry);
  return { items: [...comments.values()], continuation, sortTokens };
}
export class YouTubeExploreService {
  private static channels = new Map<string, any>();
  static async search(query: string, filters: SearchFilters, continuation?: string): Promise<ResultPage<SearchResult>> {
    const data = await YouTubeService.request('search', continuation ? { continuation } : { query, params: encodeSearchFilters(filters) });
    const page = parseSearchPage(data);
    page.items = page.items.filter(x => filters.type === 'all' || (filters.type === 'shorts' ? x.kind === 'video' && x.item.streamType === 'SHORTS' : x.kind === filters.type));
    return page;
  }
  static async channel(ref: string): Promise<ChannelDetails> {
    const id = await YouTubeService.resolveChannelId(ref);
    if (!id.startsWith('UC')) throw new Error('Kanal bulunamadı.');
    const data = await YouTubeService.request('browse', { browseId: id });
    this.channels.set(id, data);
    const meta = data.metadata?.channelMetadataRenderer || {};
    let header: any = data.header?.c4TabbedHeaderRenderer || {};
    let avatar = header.avatar?.thumbnails?.at(-1)?.url || meta.avatar?.thumbnails?.at(-1)?.url || '';
    let banner = header.banner?.thumbnails?.at(-1)?.url;
    walk(data.header, n => { if (n.avatarViewModel?.image?.sources) avatar = n.avatarViewModel.image.sources.at(-1)?.url; if (n.banner?.imageBannerViewModel?.image?.sources) banner = n.banner.imageBannerViewModel.image.sources.at(-1)?.url; });
    return { id, name: meta.title || text(header.title) || text(data.header?.pageHeaderRenderer?.pageTitle), avatarUrl: avatar, bannerUrl: banner, subscriberCount: text(header.subscriberCountText) || (() => { let value = ''; walk(data.header, n => { if (n.metadataParts) for (const part of n.metadataParts) if (/abone|subscriber/i.test(text(part.text))) value = text(part.text); }); return value; })(), verified: /CHECK_CIRCLE_FILLED|Doğrulanmış|Verified/.test(JSON.stringify(data.header)), description: meta.description || '', videos: [] };
  }
  static async channelTab(id: string, tab: ChannelTab, continuation?: string): Promise<ResultPage<SearchResult> & { description?: string }> {
    let data: any;
    if (continuation) data = await YouTubeService.request('browse', { continuation });
    else {
      const root = this.channels.get(id) || await YouTubeService.request('browse', { browseId: id });
      const tabs = root.contents?.twoColumnBrowseResultsRenderer?.tabs || [];
      const labels: Record<ChannelTab, RegExp> = { videos: /^(videos|videolar)$/i, shorts: /^shorts$/i, live: /^(live|canlı|canlı yayınlar)$/i, playlists: /^(playlists|oynatma listeleri)$/i, about: /^(about|hakkında)$/i };
      const selected = tabs.map((t: any) => t.tabRenderer).find((t: any) => labels[tab].test(t?.title || ''));
      if (!selected) return { items: [], description: root.metadata?.channelMetadataRenderer?.description };
      const endpoint = selected.endpoint?.browseEndpoint;
      data = selected.content ? selected : endpoint ? await YouTubeService.request('browse', endpoint) : {};
    }
    const page = parseSearchPage(data);
    page.items = tab === 'playlists' ? page.items.filter(x => x.kind === 'playlist') : page.items.filter(x => x.kind === 'video');
    return { ...page };
  }
  static async comments(videoId: string, continuation?: string): Promise<CommentsPage> {
    if (continuation) return parseCommentsPage(await YouTubeService.request('next', { continuation }));
    const initial = await YouTubeService.request('next', { videoId });
    let section: any;
    walk(initial, n => { if (n.itemSectionRenderer?.sectionIdentifier === 'comment-item-section' || n.itemSectionRenderer?.targetId === 'comments-section') section = n.itemSectionRenderer; if (/comments/.test(n.engagementPanelSectionListRenderer?.panelIdentifier || '')) section = n.engagementPanelSectionListRenderer; });
    let token = continuationOf(section);
    if (!token) walk(section, n => { token ||= n.reloadContinuationData?.continuation; });
    if (!token) return { items: [] };
    return parseCommentsPage(await YouTubeService.request('next', { continuation: token }));
  }
  static async postComment(videoId: string, channelId: string, body: string, parentId?: string): Promise<void> {
    const auth = await YouTubeAuthService.getAuthHeader();
    if (!auth) throw new Error('Yorum göndermek için Ayarlar’dan YouTube hesabını bağla.');
    const response = await fetch(`https://www.googleapis.com/youtube/v3/${parentId ? 'comments' : 'commentThreads'}?part=snippet`, { method: 'POST', headers: { Authorization: auth, 'Content-Type': 'application/json' }, body: JSON.stringify(parentId ? { snippet: { parentId, textOriginal: body } } : { snippet: { videoId, channelId, topLevelComment: { snippet: { textOriginal: body } } } }) });
    if (!response.ok) { const error = await response.json().catch(() => ({})); const reason = error.error?.errors?.[0]?.reason; throw new Error(response.status === 403 ? 'YouTube hesabının yorum gönderme izni yok veya bu videoda yorumlar kapalı.' : `Yorum gönderilemedi${reason ? ` (${reason})` : ''}.`); }
  }
}
