const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, dependencies, globals = {}) {
  const module = { exports: {} };
  const compiled = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(compiled, {
    module, exports: module.exports,
    require: (name) => {
      if (!(name in dependencies)) throw new Error(`Unexpected import: ${name}`);
      return dependencies[name];
    },
    setTimeout, clearTimeout, AbortController, URL, console, ...globals,
  }, { filename: file });
  return module.exports;
}

const response = (data, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => data });
const deferred = () => { let resolve; const promise = new Promise((r) => { resolve = r; }); return { promise, resolve }; };
const plain = (value) => JSON.parse(JSON.stringify(value));
const channelId = 'UCYrxIIlUsH2xrWiQowOFqHw';
const otherChannelId = 'UC0123456789012345678901';
const params = encodeURIComponent(Buffer.concat([Buffer.from([0x8a, 3, 26, 10, 24]), Buffer.from(channelId)]).toString('base64'));
// Minimal synthetic TV schema, checked against MediaServiceCore's TV fixtures and TileItem model:
// https://github.com/yuliskov/MediaServiceCore/blob/master/youtubeapi/src/test/resources/browse/tv/2026.02.21_subscriptions.json
function tile(videoId = 'video-1', overrides = {}) {
  return { tileRenderer: {
    contentType: 'TILE_CONTENT_TYPE_VIDEO', style: 'TILE_STYLE_YTLR_DEFAULT',
    header: { tileHeaderRenderer: {
      thumbnail: { thumbnails: [{ url: '//i.ytimg.com/vi/test.jpg' }] },
      thumbnailOverlays: [{ thumbnailOverlayTimeStatusRenderer: { text: { runs: [{ text: '12:34' }] }, style: 'DEFAULT' } }],
    } },
    metadata: { tileMetadataRenderer: { title: { simpleText: 'My subscription video' }, lines: [
      { lineRenderer: { items: [{ lineItemRenderer: { text: { runs: [{ text: 'My channel' }] } } }] } },
      { lineRenderer: { items: [{ lineItemRenderer: { text: { simpleText: '123 views' } } }, { lineItemRenderer: { text: { simpleText: '2 hours ago' } } }] } },
    ] } },
    onSelectCommand: { watchEndpoint: { videoId } },
    onLongPressCommand: { showMenuCommand: { menu: { menuRenderer: { items: [
      { menuNavigationItemRenderer: { navigationEndpoint: { browseEndpoint: { browseId: channelId } } } },
    ] } } } },
    ...overrides,
  } };
}
function channelTab(id = channelId) {
  return { tabRenderer: {
    title: 'My channel', endpoint: { browseEndpoint: { browseId: 'FEsubscriptions', params: id === channelId ? params : Buffer.from(id).toString('base64') } },
    thumbnail: { thumbnails: [{ url: '//yt3.googleusercontent.com/avatar.jpg' }] },
  } };
}
function subscriptionResponse() { return { contents: { tabs: [channelTab(), channelTab(otherChannelId)], items: [tile()] } }; }
function service(fetch, auth = {}, nativeBridge = {}) {
  return load('src/services/youtubeService.ts', {
    '../utils/playbackMetadata': load('src/utils/playbackMetadata.ts', {}),
    'expo-file-system/legacy': {}, './nativePlayerBridge': { NativePlayerBridge: nativeBridge },
    './youtubeAuthService': { YouTubeAuthService: {
      isAuthenticated: async () => true, getAuthHeader: async () => 'Bearer test', ...auth,
    } },
  }, { fetch });
}
function authService(storage, fetch) {
  return load('src/services/youtubeAuthService.ts', { '@react-native-async-storage/async-storage': storage }, { fetch }).YouTubeAuthService;
}
const tokens = (expiresAt = Date.now() + 3600000) => ({ accessToken: 'old', refreshToken: 'refresh', expiresAt });
function storage(stored = null) {
  return { getItem: async () => stored, setItem: async () => {}, removeItem: async () => {} };
}

test('TV tiles preserve title, channel ID, duration, HTTPS image and upload date', () => {
  const { extractVideosFromBrowse } = service(() => assert.fail('No network needed'));
  const videos = extractVideosFromBrowse({ contents: [tile(), tile(), { tileRenderer: { contentType: 'TILE_CONTENT_TYPE_PLAYLIST', contentId: 'playlist' } }] });
  assert.equal(videos.length, 1);
  assert.equal(videos[0].uploaderId, channelId);
  assert.equal(videos[0].title, 'My subscription video');
  assert.equal(videos[0].duration, 754);
  assert.equal(videos[0].thumbnailUrl, 'https://i.ytimg.com/vi/test.jpg');
  assert.equal(videos[0].uploadDate, '2 hours ago');
});

test('TV subscriptions sidebar includes subscribed channels with no uploads', () => {
  const { extractChannelsFromBrowse } = service(() => assert.fail('No network needed'));
  const channels = extractChannelsFromBrowse({ contents: [channelTab(), channelTab(), channelTab(otherChannelId), { tabRenderer: { title: 'All', endpoint: { browseEndpoint: { browseId: 'FEsubscriptions' } } } }] });
  assert.equal(channels.length, 2);
  assert.equal(channels[0].channelId, channelId);
  assert.equal(channels[0].youtubeBrowseParams, params);
  assert.equal(channels[0].thumbnailUrl, 'https://yt3.googleusercontent.com/avatar.jpg');
  assert.equal(channels[1].channelId, otherChannelId);
});

test('TV live and Shorts cards retain their explicit types', () => {
  const { extractVideosFromBrowse } = service(() => {});
  const live = tile('live', { header: { tileHeaderRenderer: { thumbnailOverlays: [{ thumbnailOverlayTimeStatusRenderer: { style: 'LIVE', text: { simpleText: 'LIVE' } } }] } } });
  const shorts = tile('short', { contentType: 'TILE_CONTENT_TYPE_SHORTS', style: 'TILE_STYLE_YTLR_SHORTS', onSelectCommand: { reelWatchEndpoint: { videoId: 'short' } } });
  const videos = extractVideosFromBrowse([live, shorts]);
  assert.equal(videos[0].isLive, true);
  assert.equal(videos[0].streamType, 'LIVE_STREAM');
  assert.equal(videos[1].streamType, 'SHORTS');
});

test('Legacy short regular videos remain regular videos', () => {
  const { extractVideosFromBrowse } = service(() => {});
  const videos = extractVideosFromBrowse({ videoRenderer: { videoId: 'regular', title: { simpleText: '30 second video' }, lengthText: { simpleText: '0:30' } } });
  assert.equal(videos[0].streamType, 'VIDEO_STREAM');
});

test('View models exclude playlists and resolve channel endpoints', () => {
  const { extractVideosFromBrowse } = service(() => {});
  const videos = extractVideosFromBrowse([
    { lockupViewModel: { contentId: 'playlist', contentType: 'LOCKUP_CONTENT_TYPE_PLAYLIST' } },
    { lockupViewModel: { contentId: 'video', contentType: 'LOCKUP_CONTENT_TYPE_VIDEO', metadata: { navigationEndpoint: { browseEndpoint: { browseId: channelId } } } } },
  ]);
  assert.equal(videos.length, 1);
  assert.equal(videos[0].uploaderId, channelId);
});

test('Personal subscriptions use one matching authenticated TV request', async () => {
  const calls = [];
  const { YouTubeService } = service(async (url, options) => {
    calls.push({ url, headers: { ...options.headers }, body: JSON.parse(options.body) });
    return response(subscriptionResponse());
  });
  const result = await YouTubeService.getPersonalSubscriptionFeed();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].body.browseId, 'FEsubscriptions');
  assert.equal(calls[0].body.context.client.clientName, 'TVHTML5');
  assert.equal(calls[0].headers['X-YouTube-Client-Name'], '7');
  assert.equal(calls[0].headers['X-YouTube-Client-Version'], calls[0].body.context.client.clientVersion);
  assert.equal(calls[0].headers.Authorization, 'Bearer test');
  assert.equal(result.channels.length, 2);
  assert.equal(result.videos.length, 1);
});

test('Channel selection follows the YouTube subscription filter command', async () => {
  let payload;
  const { YouTubeService } = service(async (_, options) => { payload = JSON.parse(options.body); return response({ contents: [tile()] }); });
  await YouTubeService.getPersonalChannelSubscriptions({ channelId, youtubeBrowseParams: params });
  assert.equal(payload.browseId, 'FEsubscriptions');
  assert.equal(payload.params, params);
});

test('Older channel lists follow continuation pages without reloading tabs', async () => {
  const calls = [];
  const { YouTubeService } = service(async (_, options) => {
    const body = JSON.parse(options.body); calls.push(body);
    if (body.browseId === 'FEsubscriptions') return response({ contents: [tile()] });
    if (body.browseId === 'FEchannels') return response({ contents: { items: [{ channelRenderer: { channelId, title: { simpleText: 'First' } } }], continuations: [{ nextContinuationData: { continuation: 'next' } }, { reloadContinuationData: { continuation: 'reload' } }] } });
    assert.equal(body.continuation, 'next');
    return response({ continuationContents: { items: [{ gridChannelRenderer: { channelId: otherChannelId, title: { simpleText: 'Second' } } }], continuations: [{ nextContinuationData: { continuation: 'next' } }] } });
  });
  const result = await YouTubeService.getPersonalSubscriptionFeed();
  assert.equal(result.channels.length, 2);
  assert.equal(calls.length, 3);
});

test('Personal home and discovery never replace failed sync with searches', async () => {
  const calls = [];
  const { YouTubeService } = service(async (url) => { calls.push(url); return response({}, 403); });
  await assert.rejects(YouTubeService.getHomeFeed('all'), /YouTube/);
  await assert.rejects(YouTubeService.getTrendingVideos('foryou'), /YouTube/);
  assert.equal(calls.length, 2);
  assert.ok(calls.every((url) => url.includes('/browse?')));
});

test('Personal category feeds also use authenticated TV topics', async () => {
  const calls = [];
  const { YouTubeService } = service(async (_, options) => { calls.push({ headers: { ...options.headers }, body: JSON.parse(options.body) }); return response({ contents: [tile()] }); });
  await YouTubeService.getHomeFeed('music');
  await YouTubeService.getTrendingVideos('gaming');
  assert.deepEqual(calls.map((call) => call.body.browseId), ['FEtopics_music', 'FEtopics_gaming']);
  assert.ok(calls.every((call) => call.headers.Authorization === 'Bearer test'));
});

test('Empty personal home retries only the alternate authenticated home endpoint', async () => {
  const calls = [];
  const { YouTubeService } = service(async (_, options) => { calls.push(JSON.parse(options.body).browseId); return response({ contents: [] }); });
  await assert.rejects(YouTubeService.getHomeFeed(), /kişisel önerilerinizi/);
  assert.deepEqual(calls, ['default', 'FEwhat_to_watch']);
});

test('Logged-out responses are rejected even with HTTP 200', async () => {
  const { YouTubeService } = service(async () => response({ ...subscriptionResponse(), responseContext: { serviceTrackingParams: [{ params: [{ key: 'logged_in', value: '0' }] }] } }));
  await assert.rejects(YouTubeService.getPersonalSubscriptionFeed(), /oturumu doğrulanamadı/);
});

test('Subscription failures are not reported as an empty subscription list', async () => {
  const { YouTubeService } = service(async () => response({}, 500));
  await assert.rejects(YouTubeService.getPersonalSubscriptions(), /yüklenemedi/);
  await assert.rejects(YouTubeService.getPersonalSubscribedChannels(), /yüklenemedi/);
});

test('Missing auth header never sends an anonymous personal request', async () => {
  const { YouTubeService } = service(() => assert.fail('No request should be sent'), { getAuthHeader: async () => null });
  await assert.rejects(YouTubeService.getPersonalSubscriptions(), /bağlayın/);
});

test('Unauthorized personal requests refresh once and retry with the new token', async () => {
  const forced = []; const headers = [];
  const { YouTubeService } = service(async (_, options) => { headers.push(options.headers.Authorization); return response(subscriptionResponse(), headers.length === 1 ? 401 : 200); }, {
    getAuthHeader: async (force = false) => { forced.push(force); return force ? 'Bearer new' : 'Bearer old'; },
  });
  await YouTubeService.getPersonalSubscriptionFeed();
  assert.deepEqual(forced, [false, true]);
  assert.deepEqual(headers, ['Bearer old', 'Bearer new']);
});

test('Concurrent expired-token requests share a refresh and do not emit auth reloads', async () => {
  const refresh = deferred(); let requests = 0; const events = [];
  const auth = authService(storage(), async () => { requests++; await refresh.promise; return response({ access_token: 'new', expires_in: 3600 }); });
  await auth.loadTokens();
  auth.subscribe((connected) => events.push(connected));
  await auth.saveTokens(tokens(Date.now() - 1000));
  const first = auth.getAuthHeader(); const second = auth.getAuthHeader();
  await Promise.resolve(); await Promise.resolve();
  refresh.resolve();
  assert.deepEqual(await Promise.all([first, second]), ['Bearer new', 'Bearer new']);
  assert.equal(requests, 1);
  assert.deepEqual(events, [true]);
  auth.requestFeedReload();
  assert.deepEqual(events, [true, true]);
});

test('Expired tokens are not reused after failed refresh', async () => {
  const auth = authService(storage(), async () => response({}, 400));
  await auth.loadTokens(); await auth.saveTokens(tokens(Date.now() - 1000));
  await assert.rejects(auth.getAuthHeader(), /yeniden bağlayın/);
});

test('Startup token loading is shared and cannot restore a signed-out account', async () => {
  const read = deferred(); let reads = 0;
  const auth = authService({ ...storage(), getItem: async () => { reads++; return read.promise; } }, () => {});
  const initial = auth.loadTokens();
  await auth.signOut();
  read.resolve(JSON.stringify(tokens()));
  assert.equal(await initial, null);
  assert.equal(await auth.isAuthenticated(), false);
  assert.equal(reads, 1);
});

test('An in-flight refresh cannot reconnect an account after sign-out', async () => {
  const refresh = deferred(); const events = [];
  const auth = authService(storage(), async () => { await refresh.promise; return response({ access_token: 'new', expires_in: 3600 }); });
  await auth.loadTokens(); await auth.saveTokens(tokens(Date.now() - 1000));
  auth.subscribe((value) => events.push(value));
  const request = auth.refreshTokens();
  await auth.signOut(); refresh.resolve();
  assert.equal(await request, null);
  assert.equal(await auth.isAuthenticated(), false);
  assert.deepEqual(events, [false]);
});

test('An empty public feed contains no fabricated demo video', async () => {
  const { YouTubeService } = service(async () => response({}), { isAuthenticated: async () => false });
  assert.deepEqual(plain(await YouTubeService.getHomeFeed()), []);
});

function bundle(id = 'video-1', url = 'https://cdn.example/old.mp4') {
  return { videoId: id, title: 'Test video', uploaderName: 'Channel', thumbnailUrl: 'image', viewCount: 1,
    isLive: false, isUpcoming: false, videoStreams: [{ url, quality: '720p', format: 'mp4', isAdaptive: false, headers: { 'User-Agent': 'Correct client' } }],
    audioStreams: [], subtitles: [], relatedVideos: [],
  };
}
function playerStore(youtube = {}, settings = {}, qualities = {}) {
  const historySaves = [];
  const result = load('src/store/usePlayerStore.ts', {
    './useRecommendationStore': { useRecommendationStore: { getState: () => ({ hiddenVideos: [], blockedChannels: [], hideWatched: false }) }, filterRecommendations: videos => videos },
    '../services/playbackDiagnostics': { PlaybackDiagnostics: { record: async () => {} } },
    zustand: require('zustand'), 'react-native': { StatusBar: { setHidden() {} } },
    '../services/youtubeService': { IOS_USER_AGENT: 'IOS', YouTubeService: {
      clearStreamCache() {}, getPlaybackStreams: async (id) => bundle(id),
      getSecondaryMetadata: async () => ({ relatedVideos: [], subtitles: [] }), ...youtube,
    } },
    '../services/sponsorBlockService': { SponsorBlockService: { getSegments: async () => [] } },
    './useSettingsStore': { useSettingsStore: { getState: () => ({ defaultQuality: 'Auto', ...settings }) } },
    '../services/checkpointService': { CheckpointService: { onVideoExit: async () => {}, getCheckpoint: async () => 0, saveCheckpoint: async () => {} } },
    '../services/nativePlayerBridge': { NativePlayerBridge: { setOrientation: async () => true, setPlayerFullscreen: async () => {} } },
    '../config/firebase': { auth: null },
    '../services/playbackQualityService': { prepareQualityStreams: async () => [], ...qualities },
    './useLibraryStore': { useLibraryStore: { getState: () => ({ addToHistory: async (uid, video, position) => { historySaves.push({ video, position }); } }) } },
  });
  const store = result.usePlayerStore;
  store.setState({ currentVideo: { id: 'video-1', title: 'Test video', uploaderName: 'Channel', duration: 100, viewCount: 1, thumbnailUrl: 'image' },
    streamBundle: bundle(), activeStreamUrl: 'https://cdn.example/old.mp4', currentTime: 83, isPlaying: true,
    queue: [{ id: 'video-1' }, { id: 'video-2' }], queueIndex: 0,
  });
  return { ...result, store, historySaves };
}

test('TV metadata ignores literal separator fields and parses abbreviated views', () => {
  const { extractVideosFromBrowse } = service(() => {});
  const card = tile();
  card.tileRenderer.metadata.tileMetadataRenderer.lines[1].lineRenderer.items = [
    { lineItemRenderer: { badge: { metadataBadgeRenderer: { label: '4K' } } } },
    { lineItemRenderer: { text: { simpleText: '1,5 B görüntüleme' } } },
    { lineItemRenderer: { text: { simpleText: '•' } } },
    { lineItemRenderer: { text: { simpleText: '5 saat önce' } } },
  ];
  const video = extractVideosFromBrowse(card)[0];
  assert.equal(video.uploadDate, '5 saat önce');
  assert.equal(video.viewCount, 1500);
});

test('Channel avatar requests are shared and cached across feed cards', async () => {
  const { YouTubeService } = service(() => {});
  const wait = deferred(); let count = 0;
  YouTubeService.getChannelDetails = async () => { count++; await wait.promise; return { avatarUrl: '//yt3.googleusercontent.com/avatar' }; };
  const first = YouTubeService.getChannelAvatar(channelId), second = YouTubeService.getChannelAvatar(channelId);
  wait.resolve();
  assert.deepEqual(await Promise.all([first, second]), ['https://yt3.googleusercontent.com/avatar', 'https://yt3.googleusercontent.com/avatar']);
  await YouTubeService.getChannelAvatar(channelId);
  assert.equal(count, 1);
});

test('Manifest selection preserves headers from the extracting client', () => {
  const { pickFallbackStream } = playerStore();
  const stream = { ...bundle(), hlsManifestUrl: 'https://cdn.example/master.m3u8', hlsManifestHeaders: { 'User-Agent': 'TV', Referer: 'tv' } };
  assert.deepEqual(plain(pickFallbackStream(stream, new Set(), 'Auto').headers), { 'User-Agent': 'TV', Referer: 'tv' });
});

test('Fallback cannot play an adaptive video without its audio', () => {
  const { pickFallbackStream } = playerStore();
  const stream = bundle(); stream.videoStreams[0].isAdaptive = true;
  stream.audioStreams = [{ url: 'audio', quality: '128kbps', audioOnly: true }];
  assert.throws(() => pickFallbackStream(stream, new Set(), 'Auto'), /Oynatılabilir medya/);
});

test('403 refreshes the same video at the same position using protected extraction', async () => {
  const calls = [];
  const { store } = playerStore({ getPlaybackStreams: async (id, options) => { calls.push({ id, options }); return { ...bundle(id), hlsManifestUrl: 'https://cdn.example/fresh.m3u8', hlsManifestHeaders: { 'User-Agent': 'TV' } }; } });
  const queue = store.getState().queue;
  store.setState({ streamBundle: { ...store.getState().streamBundle, description: 'Rich description', uploadDate: '5 saat önce', uploaderAvatarUrl: 'real-logo' } });
  await store.getState().handlePlaybackError('https://cdn.example/old.mp4', 'Source error Response code: 403');
  assert.deepEqual(calls.map(plain), [{ id: 'video-1', options: { forceRefresh: true, preferProtected: true } }]);
  assert.equal(store.getState().currentVideo.id, 'video-1');
  assert.equal(store.getState().currentTime, 83);
  assert.equal(store.getState().activeStreamUrl, 'https://cdn.example/fresh.m3u8');
  assert.equal(store.getState().queue, queue);
  assert.equal(store.getState().queueIndex, 0);
  assert.equal(store.getState().streamBundle.description, 'Rich description');
  assert.equal(store.getState().streamBundle.uploadDate, '5 saat önce');
  assert.equal(store.getState().streamBundle.uploaderAvatarUrl, 'real-logo');
});

test('Duplicate errors cannot trigger simultaneous refresh or skip sources', async () => {
  const wait = deferred(); let count = 0;
  const { store } = playerStore({ getPlaybackStreams: async () => { count++; await wait.promise; return bundle('video-1', 'https://cdn.example/fresh.mp4'); } });
  const first = store.getState().handlePlaybackError('https://cdn.example/old.mp4', '403');
  await store.getState().handlePlaybackError('https://cdn.example/old.mp4', '403');
  wait.resolve(); await first;
  assert.equal(count, 1);
  assert.equal(store.getState().streamRecoveryAttempts, 1);
});

test('Repeated 403 recovery is bounded and stops on the requested video', async () => {
  let count = 0;
  const { store } = playerStore({ getPlaybackStreams: async () => bundle('video-1', `https://cdn.example/new-${++count}.mp4`) });
  for (let i = 0; i < 3; i++) await store.getState().handlePlaybackError(store.getState().activeStreamUrl, '403');
  assert.equal(count, 2);
  assert.equal(store.getState().isPlaying, false);
  assert.equal(store.getState().currentVideo.id, 'video-1');
  assert.ok(store.getState().error);
});

test('User pause during recovery is preserved', async () => {
  const wait = deferred();
  const { store } = playerStore({ getPlaybackStreams: async () => { await wait.promise; return bundle('video-1', 'fresh'); } });
  const recovery = store.getState().handlePlaybackError('https://cdn.example/old.mp4', '403');
  store.getState().setPlaying(false); wait.resolve(); await recovery;
  assert.equal(store.getState().isPlaying, false);
});

test('Late errors for an older source do not reject the current source', async () => {
  const { store } = playerStore({ getPlaybackStreams: () => assert.fail('No refresh needed') });
  store.setState({ activeStreamUrl: 'new-source' });
  await store.getState().handlePlaybackError('old-source', '403');
  store.getState().advanceToNextFallback('old-source');
  assert.equal(store.getState().activeStreamUrl, 'new-source');
  assert.equal(store.getState().failedStreamUrls.size, 0);
});

test('Closing during stream recovery cannot restore playback', async () => {
  const wait = deferred();
  const { store } = playerStore({ getPlaybackStreams: async () => { await wait.promise; return bundle('video-1', 'fresh'); } });
  const recovery = store.getState().handlePlaybackError('https://cdn.example/old.mp4', '403');
  store.getState().closePlayer(); wait.resolve(); await recovery;
  assert.equal(store.getState().currentVideo, null);
  assert.equal(store.getState().activeStreamUrl, null);
});

test('Prefetched stream results cannot overwrite a later protected refresh in the cache', async () => {
  const wait = deferred();
  const { YouTubeService } = service(() => assert.fail('Native extraction expected'), {}, {
    resolveStreams: async (id, protectedRequest) => {
      if (!protectedRequest) await wait.promise;
      return bundle(id, protectedRequest ? 'fresh-protected' : 'stale-prefetch');
    },
  });
  const old = YouTubeService.getPlaybackStreams('video-1');
  const fresh = await YouTubeService.getPlaybackStreams('video-1', { forceRefresh: true, preferProtected: true });
  wait.resolve(); await old;
  assert.equal(fresh.videoStreams[0].url, 'fresh-protected');
  assert.equal((await YouTubeService.getPlaybackStreams('video-1')).videoStreams[0].url, 'fresh-protected');
});

test('Expired signed CDN URLs are not retained in the stream cache', async () => {
  let count = 0;
  const { YouTubeService } = service(() => assert.fail('Native extraction expected'), {}, {
    resolveStreams: async (id) => { count++; return bundle(id, 'https://cdn.example/video?expire=1'); },
  });
  await YouTubeService.getPlaybackStreams('video-1'); await YouTubeService.getPlaybackStreams('video-1');
  assert.equal(count, 2);
});

function qualityService(fileSystem = {}, fetch = () => assert.fail('No network needed')) {
  return load('src/services/playbackQualityService.ts', { 'expo-file-system/legacy': fileSystem }, { fetch });
}
const masterPlaylist = `#EXTM3U
#EXT-X-VERSION:6
#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio",NAME="Original",DEFAULT=YES,URI="audio/index.m3u8"
#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs",NAME="Turkish",URI="../subs.m3u8"
#EXT-X-STREAM-INF:BANDWIDTH=300000,RESOLUTION=256x144,AUDIO="audio",SUBTITLES="subs"
144/index.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=8000000,RESOLUTION=3840x2160,AUDIO="audio"
2160/index.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=9000000,RESOLUTION=3840x2160,AUDIO="audio"
2160/high.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=100000,AUDIO="audio"
audio/index.m3u8`;

test('HLS exposes actual 4K and 144p variants, deduplicates codecs and skips audio-only', () => {
  const variants = qualityService().hlsQualityPlaylists(masterPlaylist, 'https://cdn.example/master/index.m3u8');
  assert.deepEqual(plain(variants.map((v) => v.height)), [2160, 144]);
  assert.match(variants[0].text, /2160\/high.m3u8/);
  assert.equal((variants[0].text.match(/#EXT-X-STREAM-INF/g) || []).length, 1);
  assert.doesNotMatch(variants[0].text, /RESOLUTION=256x144/);
});
test('Fixed HLS resolution retains external audio/subtitle groups and absolute URIs', () => {
  const variant = qualityService().hlsQualityPlaylists(masterPlaylist, 'https://cdn.example/master/index.m3u8')[1];
  assert.match(variant.text, /URI="https:\/\/cdn.example\/master\/audio\/index.m3u8"/);
  assert.match(variant.text, /URI="https:\/\/cdn.example\/subs.m3u8"/);
  assert.match(variant.text, /https:\/\/cdn.example\/master\/144\/index.m3u8/);
});
test('A media playlist does not fabricate resolution options', () => {
  assert.equal(qualityService().hlsQualityPlaylists('#EXTM3U\n#EXTINF:4\nsegment.ts', 'https://cdn.example/index.m3u8').length, 0);
});
const dashXml = `<MPD><Period><AdaptationSet mimeType="video/mp4"><Representation id="high" height="2160"><BaseURL>high.mp4</BaseURL></Representation><Representation id="low" height="240"><BaseURL>low.mp4</BaseURL></Representation></AdaptationSet><AdaptationSet mimeType="audio/mp4"><Representation id="audio"><BaseURL>audio.m4a</BaseURL></Representation></AdaptationSet></Period></MPD>`;
test('Fixed DASH removes other video resolutions and preserves synchronized audio', () => {
  const variants = qualityService().dashQualityManifests(dashXml, 'https://cdn.example/dash/index.mpd');
  assert.deepEqual(plain(variants.map((v) => v.height)), [2160, 240]);
  assert.match(variants[1].text, /id="low"/);
  assert.doesNotMatch(variants[1].text, /id="high"/);
  assert.match(variants[1].text, /id="audio"/);
  assert.match(variants[1].text, /<MPD><BaseURL>https:\/\/cdn.example\/dash\/<\/BaseURL>/);
});
test('DASH handles height inherited from AdaptationSet and self-closing representations', () => {
  const xml = '<MPD><Period><AdaptationSet contentType="video" height="720"><Representation id="v" /></AdaptationSet><AdaptationSet contentType="audio"><Representation id="a" /></AdaptationSet></Period></MPD>';
  const variants = qualityService().dashQualityManifests(xml, 'file:///manifest.mpd');
  assert.equal(variants.length, 1);
  assert.equal(variants[0].height, 720);
  assert.match(variants[0].text, /id="a"/);
});
test('Preparing HLS variants keeps client headers for playlist and segment requests', async () => {
  const written = []; let sentHeaders;
  const service = qualityService({ cacheDirectory: 'file:///cache/', EncodingType: { UTF8: 'utf8' }, writeAsStringAsync: async (path, text) => written.push({ path, text }) }, async (url, options) => {
    sentHeaders = options.headers; return { ok: true, text: async () => masterPlaylist };
  });
  const streams = await service.prepareQualityStreams({ ...bundle(), hlsManifestUrl: 'https://cdn.example/master/index.m3u8', hlsManifestHeaders: { 'User-Agent': 'Protected client' } });
  assert.equal(streams.length, 2);
  assert.equal(written.length, 2);
  assert.match(streams[0].url, /2160.m3u8$/);
  assert.deepEqual(plain(streams[0].headers), sentHeaders);
});
test('Quality playlist fetch rejects 403 and can trigger protected extraction', async () => {
  const service = qualityService({}, async () => ({ ok: false, status: 403 }));
  await assert.rejects(service.prepareQualityStreams({ ...bundle(), hlsManifestUrl: 'https://cdn.example/master.m3u8' }), /403/);
});
test('Explicit quality chooses the fixed manifest instead of merely relabeling HLS Auto', () => {
  const { pickFallbackStream } = playerStore();
  const stream = { ...bundle(), hlsManifestUrl: 'https://cdn.example/master.m3u8', qualityStreams: [{ url: 'file:///quality_2160.m3u8', quality: '2160p', format: 'hls', headers: { Test: 'header' } }] };
  const selected = pickFallbackStream(stream, new Set(), '2160p');
  assert.equal(selected.url, 'file:///quality_2160.m3u8');
  assert.equal(selected.quality, '2160p');
  assert.equal(pickFallbackStream(stream, new Set(), 'Auto').url, stream.hlsManifestUrl);
  assert.equal(pickFallbackStream(stream, new Set(), '1440p').quality, 'Auto');
});
test('Quality change preserves the playing position, pause state and queue', () => {
  const { store } = playerStore();
  store.setState({ isPlaying: false, streamBundle: { ...bundle(), qualityStreams: [{ url: 'file:///quality_240.mpd', quality: '240p', format: 'mpd' }] } });
  store.getState().setQuality('240p');
  assert.equal(store.getState().activeStreamUrl, 'file:///quality_240.mpd');
  assert.equal(store.getState().currentTime, 83);
  assert.equal(store.getState().isPlaying, false);
  assert.equal(store.getState().queueIndex, 0);
});

test('DASH resolves a root BaseURL without flattening relative representation paths', () => {
  const xml = dashXml.replace('<MPD>', '<MPD><BaseURL>media/</BaseURL>');
  const variant = qualityService().dashQualityManifests(xml, 'https://cdn.example/dash/index.mpd')[0];
  assert.match(variant.text, /<BaseURL>https:\/\/cdn.example\/dash\/media\/<\/BaseURL>/);
  assert.match(variant.text, /<BaseURL>high.mp4<\/BaseURL>/);
});
test('Default resolution is applied to an adaptive manifest when opening a video', async () => {
  const streams = [{ url: 'file:///fixed_2160.m3u8', quality: '2160p', format: 'hls' }];
  const { store } = playerStore({ getPlaybackStreams: async () => ({ ...bundle(), hlsManifestUrl: 'https://cdn.example/master.m3u8' }) },
    { defaultQuality: '2160p' }, { prepareQualityStreams: async () => streams });
  await store.getState().loadAndPlay(store.getState().currentVideo);
  assert.equal(store.getState().quality, '2160p');
  assert.equal(store.getState().activeStreamUrl, 'file:///fixed_2160.m3u8');
});

test('Closing the player saves the exact last position for thumbnail progress', () => {
  const { store, historySaves } = playerStore();
  store.setState({ currentTime: 87, duration: 123 });
  store.getState().closePlayer();
  assert.equal(historySaves.length, 1);
  assert.equal(historySaves[0].position, 87);
  assert.equal(historySaves[0].video.duration, 123);
  assert.equal(store.getState().currentVideo, null);
});

function temporaryRate(player, preferred) {
  return load('src/utils/temporaryPlaybackRate.ts', {}).createTemporaryPlaybackRate(player, preferred);
}
test('Holding a video plays at 2x and releasing restores the selected speed', () => {
  const player = { playbackRate: 1.5 };
  const rate = temporaryRate(player, () => 1.5);
  rate.begin();
  assert.equal(player.playbackRate, 2);
  rate.end();
  assert.equal(player.playbackRate, 1.5);
});
test('Temporary 2x does not overwrite settings and reads the latest preference on release', () => {
  let selected = 0.75;
  const player = { playbackRate: selected };
  const rate = temporaryRate(player, () => selected);
  rate.begin();
  assert.equal(selected, 0.75);
  selected = 1.25;
  rate.end();
  assert.equal(player.playbackRate, 1.25);
});
test('Duplicate hold and release events cannot leave playback stuck at 2x', () => {
  const player = { playbackRate: 1 };
  const rate = temporaryRate(player, () => 1);
  rate.begin(); rate.begin();
  rate.end(); rate.end();
  assert.equal(player.playbackRate, 1);
  assert.equal(rate.isActive, false);
});
function miniGeometry() {
  const layout = load('src/constants/navigationLayout.ts', {});
  return { ...layout, ...load('src/utils/miniPlayerGeometry.ts', { '../constants/navigationLayout': layout }) };
}
test('Mini player stays above the measured bottom bar with a 6px gap', () => {
  const geometry = miniGeometry();
  const insets = { top: 32, bottom: 24, left: 0, right: 0 };
  const card = geometry.miniPlayerGeometry(384, 840, insets, 78, 'android');
  assert.equal(card.bottom - geometry.floatingNavigationBottom(insets.bottom, 'android') - 78, 6);
  assert.ok(card.width < 384 - 24);
  assert.equal(geometry.clampMiniPlayerPosition({ x: 0, y: 200 }, card.bounds).y, 0);
});
test('Dragging mini player preserves an arbitrary position and stays within safe screen edges', () => {
  const geometry = miniGeometry();
  const insets = { top: 32, bottom: 24, left: 0, right: 0 };
  const card = geometry.miniPlayerGeometry(384, 840, insets, 64, 'android');
  const position = geometry.clampMiniPlayerPosition({ x: 10, y: -240 }, card.bounds);
  assert.deepEqual(plain(position), { x: 10, y: -240 });
  const further = geometry.clampMiniPlayerPosition({ x: position.x - 8, y: position.y + 35 }, card.bounds);
  assert.deepEqual(plain(further), { x: 2, y: -205 });
  const edge = geometry.clampMiniPlayerPosition({ x: -10000, y: -10000 }, card.bounds);
  assert.equal(card.left + edge.x, insets.left + 12);
  assert.equal(840 - card.bottom - geometry.MINI_PLAYER_HEIGHT + edge.y, insets.top + 8);
});
test('Rotating the screen clamps the existing mini position to the new safe area', () => {
  const geometry = miniGeometry();
  const insets = { top: 0, bottom: 0, left: 38, right: 18 };
  const card = geometry.miniPlayerGeometry(840, 384, insets, 64, 'android');
  const position = geometry.clampMiniPlayerPosition({ x: 250, y: -500 }, card.bounds);
  const left = card.left + position.x;
  const top = 384 - card.bottom - geometry.MINI_PLAYER_HEIGHT + position.y;
  assert.ok(left >= insets.left + 12);
  assert.ok(left + card.width <= 840 - insets.right - 12);
  assert.ok(top >= insets.top + 8);
  assert.ok(top + geometry.MINI_PLAYER_HEIGHT <= 384 - card.bottom);
});

test('Spreading two fingers fills the video and pinching inward restores original fit', () => {
  const { pinchDistance, pinchFillMode } = load('src/utils/pinchToFill.ts', {});
  const initial = pinchDistance([{ pageX: 50, pageY: 80 }, { pageX: 150, pageY: 80 }]);
  const spread = pinchDistance([{ pageX: 25, pageY: 55 }, { pageX: 175, pageY: 105 }]);
  assert.equal(pinchFillMode(spread / initial, false), true);
  const inward = pinchDistance([{ pageX: 80, pageY: 80 }, { pageX: 120, pageY: 80 }]);
  assert.equal(pinchFillMode(inward / initial, true), false);
});
test('One finger and small two-finger movement cannot change video fill mode', () => {
  const { pinchDistance, pinchFillMode } = load('src/utils/pinchToFill.ts', {});
  assert.equal(pinchDistance([{ pageX: 50, pageY: 80 }]), 0);
  assert.equal(pinchFillMode(1.04, false), false);
  assert.equal(pinchFillMode(0.96, true), true);
});

test('Seeking beyond the progressive buffer promotes to a protected segmented source at the target position', async () => {
  const calls = []; const protectedBundle = { ...bundle(), hlsManifestUrl: 'https://cdn.example/segmented.m3u8', videoStreams: [] };
  const { store } = playerStore({ getPlaybackStreams: async (id, options) => { calls.push(options); return protectedBundle; } });
  store.setState({ duration: 100, bufferedTime: 5, streamRecoveryAttempts: 2 });
  await store.getState().prepareSeek(70);
  assert.equal(store.getState().activeStreamUrl, protectedBundle.hlsManifestUrl); assert.equal(store.getState().currentTime, 70); assert.equal(store.getState().streamRecoveryAttempts, 0); assert.equal(store.getState().queueIndex, 0); assert.equal(calls[0].preferProtected, true);
});
test('Seeking inside the available buffer does not replace or re-extract the source', async () => {
  const { store } = playerStore({ getPlaybackStreams: () => assert.fail('Buffered seeking needs no network extraction') });
  store.setState({ bufferedTime: 90, streamRecoveryAttempts: 2 }); await store.getState().prepareSeek(40);
  assert.equal(store.getState().activeStreamUrl, 'https://cdn.example/old.mp4'); assert.equal(store.getState().currentTime, 40); assert.equal(store.getState().streamRecoveryAttempts, 0);
});
test('The newest seek wins when extraction for an earlier seek completes late', async () => {
  const first = deferred(), second = deferred(); let count = 0;
  const { store } = playerStore({ getPlaybackStreams: async () => { count++; await (count === 1 ? first.promise : second.promise); return { ...bundle(), hlsManifestUrl: 'https://cdn/hls.m3u8' }; } });
  const seek1 = store.getState().prepareSeek(30), seek2 = store.getState().prepareSeek(80);
  second.resolve(); await seek2; first.resolve(); await seek1;
  assert.equal(store.getState().currentTime, 80); assert.equal(store.getState().loading, false);
});
test('Seeking to the final pixel clamps before video end and does not advance the queue', async () => {
  const { store } = playerStore(); store.setState({ bufferedTime: 100, duration: 100 }); await store.getState().prepareSeek(100);
  assert.equal(store.getState().currentTime, 99.75); assert.equal(store.getState().queueIndex, 0);
});
test('A quality manifest error cannot turn a successfully renewed stream into a fatal playback error', async () => {
  const { store } = playerStore({ getPlaybackStreams: async () => ({ ...bundle(), hlsManifestUrl: 'https://cdn/fresh.m3u8', videoStreams: [] }) }, {}, { prepareQualityStreams: async () => { throw Error('Quality list HTTP 403'); } });
  store.setState({ quality: '1080p' }); const recovered = await store.getState().handlePlaybackError('https://cdn.example/old.mp4', '403');
  assert.equal(recovered, true); assert.equal(store.getState().activeStreamUrl, 'https://cdn/fresh.m3u8'); assert.equal(store.getState().error, null);
});
test('Proactive renewal preserves play/pause, current position and the video queue', async () => {
  const { store } = playerStore({ getPlaybackStreams: async () => ({ ...bundle('video-1', 'https://cdn/fresh.mp4'), expiresAt: Date.now() + 3600000 }) });
  const oldQueue = store.getState().queue; store.setState({ streamBundle: { ...bundle(), expiresAt: Date.now() + 1000 }, isPlaying: false }); await store.getState().refreshExpiringStream();
  assert.equal(store.getState().activeStreamUrl, 'https://cdn/fresh.mp4'); assert.equal(store.getState().isPlaying, false); assert.equal(store.getState().currentTime, 83); assert.equal(store.getState().queue, oldQueue);
});
test('Protected extraction bypasses a cached progressive bundle', async () => {
  const requests = []; const native = { resolveStreams: async (id, protectedMode) => { requests.push(protectedMode); return { ...bundle(id, protectedMode ? 'https://cdn/protected.m3u8' : 'https://cdn/muxed.mp4'), hlsUrl: protectedMode ? 'https://cdn/protected.m3u8' : undefined }; } };
  const { YouTubeService } = service(async () => response({}), {}, native);
  await YouTubeService.getPlaybackStreams('protected-test'); const result = await YouTubeService.getPlaybackStreams('protected-test', { preferProtected: true });
  assert.equal(result.hlsManifestUrl, 'https://cdn/protected.m3u8'); assert.deepEqual(requests, [false, true]);
});
