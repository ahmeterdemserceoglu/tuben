export interface HlsAsset { url: string; fileName: string; }
export interface OfflineHlsPlan { assets: HlsAsset[]; playlists: { fileName: string; text: string }[]; }
/** Rewrite every media/map/key URI; no remote address remains in an offline playlist. */
export async function planOfflineHls(rootUrl: string, read: (url: string) => Promise<string>): Promise<OfflineHlsPlan> {
  const assets: HlsAsset[] = [], playlists: { fileName: string; text: string }[] = [];
  const names = new Map<string, string>();
  let counter = 0;
  const asset = (url: string) => { let file = names.get(url); if (!file) { file = `asset_${counter++}.bin`; names.set(url, file); assets.push({ url, fileName: file }); } return file; };
  const playlist = async (url: string, fileName: string, depth: number) => {
    if (depth > 4) throw new Error('Desteklenmeyen iç içe oynatma listesi.');
    names.set(url, fileName);
    const source = await read(url), lines = source.split(/\r?\n/).map(x => x.trim());
    if (!source.startsWith('#EXTM3U')) throw new Error('HLS oynatma listesi geçersiz.');
    const master = lines.some(x => x.startsWith('#EXT-X-STREAM-INF'));
    if (!master && !lines.includes('#EXT-X-ENDLIST')) throw new Error('Canlı yayınlar tamamlanmadan indirilemez.');
    const rewritten: string[] = [];
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];
      if (!line || line.startsWith('#EXT-X-I-FRAME') || /^#EXT-X-MEDIA:.*TYPE=SUBTITLES/.test(line)) continue;
      if (line.startsWith('#EXT-X-STREAM-INF')) line = line.replace(/,SUBTITLES="[^"]*"/, '');
      const uriMatch = line.match(/URI="([^"]+)"/);
      if (uriMatch) {
        const remote = new URL(uriMatch[1], url).href;
        let local = names.get(remote);
        if (!local) { if (line.startsWith('#EXT-X-MEDIA')) { local = `playlist_${counter++}.m3u8`; await playlist(remote, local, depth + 1); } else local = asset(remote); }
        line = line.replace(uriMatch[0], `URI="${local}"`);
      } else if (!line.startsWith('#')) {
        const remote = new URL(line, url).href;
        let local = names.get(remote);
        if (!local) { if (master) { local = `playlist_${counter++}.m3u8`; await playlist(remote, local, depth + 1); } else local = asset(remote); }
        line = local;
      }
      rewritten.push(line);
    }
    playlists.push({ fileName, text: rewritten.join('\n') + '\n' });
  };
  await playlist(rootUrl, 'index.m3u8', 0);
  return { assets, playlists };
}
