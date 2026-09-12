const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ts = require('typescript');
function load(file, deps = {}, globals = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require: key => { if (!(key in deps)) throw Error(`Unexpected import ${key}`); return deps[key]; }, URL, AbortController, setTimeout, clearTimeout, console, ...globals });
  return module.exports;
}
const plain = x => JSON.parse(JSON.stringify(x));
const metadata = load('src/utils/playbackMetadata.ts');
const downloadOptions = load('src/utils/downloadOptions.ts');
const hls = load('src/utils/offlineHls.ts');
const service = load('src/services/youtubeService.ts', { '../utils/playbackMetadata': metadata, 'expo-file-system/legacy': {}, './nativePlayerBridge': {}, './youtubeAuthService': {} });
function explore(request = async () => ({}), extraGlobals = {}) { return load('src/services/youtubeExploreService.ts', { './youtubeService': { ...service, YouTubeService: { request, resolveChannelId: async id => id } }, './youtubeAuthService': { YouTubeAuthService: { getAuthHeader: async () => 'Bearer test' } } }, extraGlobals); }
const parser = explore();
test('Server search filters encode channel, date, duration and real resolution fields', () => {
  assert.equal(parser.encodeSearchFilters({ type: 'channel' }), 'EgIQAg==');
  assert.deepEqual([...Buffer.from(parser.encodeSearchFilters({ type: 'video', date: 3, duration: 5, resolution: '4k' }), 'base64')], [18, 8, 8, 3, 16, 1, 24, 5, 112, 1]);
  assert.deepEqual([...Buffer.from(parser.encodeSearchFilters({ type: 'shorts' }), 'base64')], [18, 2, 16, 9]);
});
test('Search results contain genuine channel and playlist cards, never playlist IDs as videos', () => {
  const page = parser.parseSearchPage({ contents: [ { channelRenderer: { channelId: 'UCtest', title: { simpleText: 'Channel' }, thumbnail: { thumbnails: [{ url: '//avatar' }] } } }, { lockupViewModel: { contentId: 'PLtest', contentType: 'LOCKUP_CONTENT_TYPE_PLAYLIST', metadata: { lockupMetadataViewModel: { title: { content: 'Playlist' } } } } }, { videoRenderer: { videoId: 'video', title: { simpleText: 'Video' }, lengthText: { simpleText: '0:20' } } } ] });
  assert.equal(page.items.length, 3); assert.equal(page.items.filter(x => x.kind === 'video')[0].item.id, 'video'); assert.equal(page.items.find(x => x.kind === 'channel').item.name, 'Channel'); assert.equal(page.items.find(x => x.kind === 'playlist').item.id, 'PLtest');
});
test('Search continuations are requested without repeating initial query/filter parameters', async () => {
  const calls = [];
  const { YouTubeExploreService } = explore(async (endpoint, body) => { calls.push({ endpoint, body }); return { items: [{ continuationItemRenderer: { continuationEndpoint: { continuationCommand: { token: 'next' } } } }] }; });
  const page = await YouTubeExploreService.search('hello', { type: 'channel' }); await YouTubeExploreService.search('hello', { type: 'channel' }, page.continuation);
  assert.equal(calls[0].body.params, 'EgIQAg=='); assert.deepEqual(plain(calls[1].body), { continuation: 'next' });
});
test('Channel tabs use their actual browse endpoint rather than search or duration guesses', async () => {
  const calls = []; const root = { metadata: { channelMetadataRenderer: { title: 'Channel', description: 'About' } }, contents: { twoColumnBrowseResultsRenderer: { tabs: [{ tabRenderer: { title: 'Shorts', endpoint: { browseEndpoint: { browseId: 'UCtest', params: 'real-shorts-param' } } } }] } } };
  const { YouTubeExploreService } = explore(async (endpoint, body) => { calls.push(body); return body.params ? { shortsLockupViewModel: { entityId: 'shorts-shelf-item-abcdefghijk', onTap: { innertubeCommand: { reelWatchEndpoint: { videoId: 'abcdefghijk' } } }, overlayMetadata: { primaryText: { content: 'Short' } } } } : root; });
  const channel = await YouTubeExploreService.channel('UCtest'); await YouTubeExploreService.channelTab(channel.id, 'shorts'); const missing = await YouTubeExploreService.channelTab(channel.id, 'live');
  assert.equal(calls[1].params, 'real-shorts-param'); assert.equal(missing.items.length, 0); assert.equal(calls.length, 2);
});
function continuation(token) { return { continuationItemRenderer: { continuationEndpoint: { continuationCommand: { token } } } }; }
// Current WEB schema checked against a live read-only YouTube next response on 2026-09-12.
function commentsFixture() { return { onResponseReceivedEndpoints: [{ reloadContinuationItemsCommand: { continuationItems: [ { commentsHeaderRenderer: { sortMenu: { sortFilterSubMenuRenderer: { subMenuItems: [{ serviceEndpoint: { continuationCommand: { token: 'top' } } }, { serviceEndpoint: { continuationCommand: { token: 'newest' } } }] } } } }, { commentThreadRenderer: { commentViewModel: { commentViewModel: { commentKey: 'entity', commentId: 'comment' } }, replies: { commentRepliesRenderer: { contents: [continuation('reply-token')], viewReplies: { buttonRenderer: { text: { simpleText: '3 yanıt' } } } } } } }, continuation('page-token') ] } }], frameworkUpdates: { entityBatchUpdate: { mutations: [{ entityKey: 'entity', payload: { commentEntityPayload: { properties: { commentId: 'comment', content: { content: 'Hello world' }, publishedTime: 'Yesterday' }, author: { displayName: '@Author', avatarThumbnailUrl: 'avatar' }, toolbar: { likeCountNotliked: '16', replyCount: '3' } } } }] } } }; }
test('Modern entity comments use properties.commentId and associate replies with the correct thread', () => {
  const page = parser.parseCommentsPage(commentsFixture()); assert.equal(page.items.length, 1); assert.equal(page.items[0].commentText, 'Hello world'); assert.equal(page.items[0].repliesToken, 'reply-token'); assert.equal(page.items[0].repliesCount, 3); assert.equal(page.continuation, 'page-token'); assert.equal(page.sortTokens.newest, 'newest');
});
test('A reply continuation cannot become the next top-level comments page', () => { const data = commentsFixture(); data.onResponseReceivedEndpoints[0].reloadContinuationItemsCommand.continuationItems.pop(); assert.equal(parser.parseCommentsPage(data).continuation, undefined); });
test('Legacy comments keep text, IDs and reply continuations', () => { const page = parser.parseCommentsPage({ commentThreadRenderer: { comment: { commentRenderer: { commentId: 'old', authorText: { simpleText: 'Old' }, contentText: { runs: [{ text: 'First' }, { text: ' second' }] }, voteCount: { simpleText: '42' } } }, replies: { commentRepliesRenderer: { contents: [continuation('replies')], viewReplies: { buttonRenderer: { text: { simpleText: '2 yanıt' } } } } } } }); assert.equal(page.items[0].commentText, 'First second'); assert.equal(page.items[0].repliesToken, 'replies'); });
test('Initial comments request ignores related-video continuation tokens', async () => {
  const calls = []; const { YouTubeExploreService } = explore(async (_, payload) => { calls.push(payload); return payload.videoId ? { unrelated: continuation('wrong'), contents: { itemSectionRenderer: { sectionIdentifier: 'comment-item-section', contents: [continuation('comments')] } } } : commentsFixture(); });
  await YouTubeExploreService.comments('video'); assert.equal(calls[1].continuation, 'comments');
});
test('Comment submission sends an authenticated request and reports rejection without success', async () => {
  const calls = []; const { YouTubeExploreService } = explore(undefined, { fetch: async (url, options) => { calls.push({ url, options }); return { ok: false, status: 403, json: async () => ({ error: { errors: [{ reason: 'insufficientPermissions' }] } }) }; } });
  await assert.rejects(YouTubeExploreService.postComment('video', 'channel', 'my comment'), /yorum gönderme izni/); assert.equal(calls.length, 1); assert.equal(calls[0].options.headers.Authorization, 'Bearer test'); assert.equal(JSON.parse(calls[0].options.body).snippet.topLevelComment.snippet.textOriginal, 'my comment');
});
test('Storyboard grids select the correct sheet, cell and signature and clamp the final frame', () => {
  const boards = metadata.parseStoryboards('https://i.example/sb/$L/$N?sigh=old|160#90#250#5#5#1000#M$M#signature');
  const frame = metadata.storyboardFrame(boards, 28); assert.ok(frame.url.includes('/0/M1?')); assert.ok(frame.url.includes('sigh=signature')); assert.equal(frame.x, 3); assert.equal(frame.y, 0); const last = metadata.storyboardFrame(boards, 9999); assert.equal(last.y, 4); assert.ok(last.url.includes('M9'));
});
test('Native NewPipe preview URLs work without assuming an unsigned URL template', () => { const frame = metadata.storyboardFrame([{ templateUrl: 'unused', urls: ['sheet0', 'sheet1'], width: 160, height: 90, count: 50, columns: 5, rows: 5, intervalMs: 1000 }], 26); assert.equal(frame.url, 'sheet1'); assert.equal(frame.x, 1); });
test('Invalid preview levels are ignored and chapters use ordered seconds', () => { assert.equal(metadata.parseStoryboards('url|0#0#0#0#0#0').length, 0); const chapters = metadata.parseChapters({ items: [{ chapterRenderer: { timeRangeStartMillis: '30000', title: { simpleText: 'Second' } } }, { chapterRenderer: { timeRangeStartMillis: '0', title: { simpleText: 'Intro' } } }] }); assert.equal(chapters[0].startTime, 0); assert.equal(chapters[1].startTime, 30); });
test('Stream renewal uses the earliest real signed expiry, not the short metadata cache lifetime', () => { assert.equal(metadata.streamExpiresAt({ hlsManifestUrl: 'https://cdn/playlist?expire=2000', videoStreams: [{ url: 'https://cdn/video?expire=1000' }] }), 1000000); assert.equal(metadata.streamExpiresAt({ videoStreams: [{ url: 'file:///video.mp4' }] }), undefined); });
const mp4 = (url, quality, adaptive = false) => ({ url, quality, format: 'mp4', isAdaptive: adaptive, headers: { 'User-Agent': 'correct' } });
test('Download qualities never offer adaptive video without compatible audio', () => { assert.equal(downloadOptions.getDownloadOptions({ videoStreams: [mp4('https://cdn/video', '1080p', true)], audioStreams: [{ url: 'https://cdn/audio', format: 'webm', quality: 'audio' }] }).length, 0); });
test('High-quality MP4 downloads preserve both source headers and prefer muxed video when available', () => { const bundle = { videoStreams: [mp4('https://cdn/adaptive', '1080p', true), mp4('https://cdn/muxed', '720p')], audioStreams: [mp4('https://cdn/audio', 'audio')] }; const options = downloadOptions.getDownloadOptions(bundle); assert.equal(options[0].audio.url, 'https://cdn/audio'); assert.equal(options[0].video.headers['User-Agent'], 'correct'); assert.equal(options[1].audio, undefined); });
test('Protected HLS sources expose actual resolved offline quality variants', () => { const options = downloadOptions.getDownloadOptions({ videoStreams: [], audioStreams: [], qualityStreams: [{ url: 'file:///fixed.m3u8', quality: '1080p', format: 'hls' }], expiresAt: 10000 }); assert.equal(options[0].kind, 'hls'); assert.equal(options[0].expiresAt, 10000); });
test('Offline HLS downloads retain audio, initialization maps and encryption keys with only local references', async () => {
  const manifests = { 'https://cdn/master.m3u8': '#EXTM3U\n#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="a",URI="audio.m3u8"\n#EXT-X-STREAM-INF:RESOLUTION=1920x1080,AUDIO="a"\nvideo.m3u8', 'https://cdn/video.m3u8': '#EXTM3U\n#EXT-X-MAP:URI="init.mp4"\n#EXT-X-KEY:METHOD=AES-128,URI="key.bin"\n#EXTINF:5,\nv0.ts\n#EXTINF:5,\nv1.ts\n#EXT-X-ENDLIST', 'https://cdn/audio.m3u8': '#EXTM3U\n#EXTINF:10,\na0.ts\n#EXT-X-ENDLIST' };
  const plan = await hls.planOfflineHls('https://cdn/master.m3u8', async url => manifests[url]); assert.equal(plan.assets.length, 5); assert.equal(plan.playlists.length, 3); for (const p of plan.playlists) assert.ok(!p.text.includes('https://')); assert.ok(plan.playlists.find(p => p.fileName === 'index.m3u8').text.includes('TYPE=AUDIO'));
});
test('Live HLS cannot be presented as a complete offline download', async () => { await assert.rejects(hls.planOfflineHls('https://cdn/live.m3u8', async () => '#EXTM3U\n#EXTINF:5,\nsegment.ts'), /Canlı yayınlar/); });
function downloadHarness({ blockFirst = false, adaptive = false, failure = false, ignoreRange = false } = {}) {
  let downloads = [], stored = null; const files = new Map(), calls = [], merges = []; let firstResolve; let failed = false;
  const store = { getState: () => ({ downloads, enqueue: (video, option) => { downloads.push({ id: video.id, video, option, quality: option.quality, status: 'queued', progress: 0 }); }, update: (id, patch) => { downloads = downloads.map(x => x.id === id ? { ...x, ...patch } : x); }, remove: id => { downloads = downloads.filter(x => x.id !== id); } }) };
  const fileSystem = { documentDirectory: 'file:///docs/', makeDirectoryAsync: async () => {}, getInfoAsync: async uri => ({ exists: files.has(uri), size: files.get(uri)?.size || 0 }), deleteAsync: async uri => { files.delete(uri); }, moveAsync: async ({ from, to }) => { files.set(to, files.get(from)); files.delete(from); }, createDownloadResumable: (url, uri, options, callback, resumeData) => {
    const finish = () => { files.set(uri, { size: 10 }); return { uri, status: 200 }; };
    return { downloadAsync: async () => { calls.push({ url, options, method: 'download' }); if (failure && !failed) { failed = true; return { uri, status: 403 }; } if (blockFirst && url.includes('first') && calls.filter(c => c.url === url && c.method === 'download').length === 1) return new Promise(resolve => { firstResolve = resolve; }); return finish(); }, pauseAsync: async () => { firstResolve?.(undefined); return { resumeData: 'resume-data' }; }, resumeAsync: async () => { calls.push({ url, options, resumeData, method: 'resume' }); return { ...finish(), status: ignoreRange ? 200 : 206 }; } };
  } };
  const { DownloadService } = load('src/services/downloadService.ts', { '../utils/offlineHls': hls, './playbackQualityService': { prepareQualityStreams: async () => [] }, 'expo-file-system/legacy': fileSystem, '@react-native-async-storage/async-storage': { getItem: async () => stored, setItem: async (_, value) => { stored = value; } }, 'react-native': { Platform: { OS: 'android' }, NativeModules: { TubenNativeModule: { mergeMediaTracks: async (video, audio, output) => { assert.ok(files.has(video)); assert.ok(files.has(audio)); merges.push({ video, audio }); files.set(output, { size: 20 }); } } } }, '../store/useDownloadStore': { useDownloadStore: store }, '../utils/downloadOptions': downloadOptions, './youtubeService': { YouTubeService: {} } });
  const video = id => ({ id, title: id, uploaderName: 'Channel', thumbnailUrl: 'image', duration: 10, viewCount: 1 });
  const option = id => ({ quality: '1080p', video: mp4(`https://cdn/${id}`, '1080p', adaptive), ...(adaptive ? { audio: mp4(`https://cdn/${id}-audio`, 'audio') } : {}) });
  return { DownloadService, store, calls, merges, enqueue: id => DownloadService.enqueue(video(id), option(id)) };
}
async function until(check) { for (let i = 0; i < 500; i++) { if (check()) return; await new Promise(resolve => setImmediate(resolve)); } throw Error('Operation did not finish'); }
test('Download queue pauses one transfer, runs the next and resumes using its saved transfer state', async () => {
  const h = downloadHarness({ blockFirst: true }); h.enqueue('first'); h.enqueue('second'); await until(() => h.calls.length === 1); await h.DownloadService.pause('first'); await until(() => h.store.getState().downloads.find(x => x.id === 'second').status === 'completed'); assert.equal(h.store.getState().downloads[0].status, 'paused'); await h.DownloadService.resume('first'); await until(() => h.store.getState().downloads.every(x => x.status === 'completed')); const resumed = h.calls.find(x => x.method === 'resume'); assert.equal(resumed.resumeData, 'resume-data'); assert.equal(resumed.options.headers['User-Agent'], 'correct'); assert.equal((await h.DownloadService.getDownloadedVideos()).length, 2);
});
test('Adaptive downloads cannot complete until video and audio have both downloaded and merged', async () => { const h = downloadHarness({ adaptive: true }); h.enqueue('adaptive'); await until(() => h.store.getState().downloads[0].status === 'completed'); assert.equal(h.calls.length, 2); assert.equal(h.merges.length, 1); assert.equal(h.store.getState().downloads[0].fileSize, 20); });
test('Rejected download sources stay in error and can be explicitly retried', async () => { const h = downloadHarness({ failure: true }); h.enqueue('failed'); await until(() => h.store.getState().downloads[0].status === 'error'); assert.equal((await h.DownloadService.getDownloadedVideos()).length, 0); await h.DownloadService.resume('failed'); await until(() => h.store.getState().downloads[0].status === 'completed'); });
test('Cancelling an active download removes its queue record after the transfer settles', async () => { const h = downloadHarness({ blockFirst: true }); h.enqueue('first'); await until(() => h.calls.length === 1); await h.DownloadService.cancelDownload('first'); assert.equal(h.store.getState().downloads.length, 0); assert.equal((await h.DownloadService.getDownloadedVideos()).length, 0); });

test('A server ignoring a resume Range cannot produce a corrupted completed download', async () => {
  const h = downloadHarness({ blockFirst: true, ignoreRange: true }); h.enqueue('first'); await until(() => h.calls.length === 1); await h.DownloadService.pause('first'); await h.DownloadService.resume('first'); await until(() => h.store.getState().downloads[0].status === 'error'); assert.equal((await h.DownloadService.getDownloadedVideos()).length, 0); assert.equal(h.store.getState().downloads[0].resumeData, undefined); await h.DownloadService.resume('first'); await until(() => h.store.getState().downloads[0].status === 'completed');
});
