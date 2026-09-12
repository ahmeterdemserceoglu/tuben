import { StreamBundle, Storyboard, VideoChapter } from '../types/video';
export function streamExpiresAt(bundle: StreamBundle): number | undefined {
  const values = [bundle.hlsManifestUrl, bundle.dashManifestUrl, ...bundle.videoStreams.map(x => x.url)].flatMap(url => { try { const seconds = Number(new URL(url || '').searchParams.get('expire')); return seconds > 0 ? [seconds * 1000] : []; } catch { return []; } });
  return values.length ? Math.min(...values) : undefined;
}
export function parseStoryboards(spec?: string): Storyboard[] {
  if (!spec) return [];
  const [template, ...levels] = spec.split('|');
  return levels.flatMap((level, index) => {
    const [w, h, count, columns, rows, interval, name, signature] = level.split('#');
    if (![w, h, count, columns, rows, interval].every(x => Number(x) > 0)) return [];
    try { const url = new URL(template.replace('$L', String(index)).replace('$N', name)); url.searchParams.set('sigh', signature); return [{ templateUrl: url.toString(), width: Number(w), height: Number(h), count: Number(count), columns: Number(columns), rows: Number(rows), intervalMs: Number(interval) }]; } catch { return []; }
  });
}
export function storyboardFrame(boards: Storyboard[], seconds: number) {
  const board = boards.filter(b => b.width >= 120).sort((a, b) => a.width - b.width)[0] || boards.at(-1);
  if (!board) return;
  const index = Math.max(0, Math.min(board.count - 1, Math.floor(seconds * 1000 / board.intervalMs)));
  const perSheet = board.columns * board.rows, cell = index % perSheet;
  return { board, url: board.urls?.[Math.floor(index / perSheet)] || board.templateUrl.replace(/\$M/g, String(Math.floor(index / perSheet))), x: cell % board.columns, y: Math.floor(cell / board.columns) };
}
export function parseChapters(data: any): VideoChapter[] {
  const found = new Map<number, VideoChapter>();
  const visit = (n: any) => { if (!n || typeof n !== 'object') return; const c = n.chapterRenderer; if (c && Number.isFinite(Number(c.timeRangeStartMillis))) { const startTime = Number(c.timeRangeStartMillis) / 1000; found.set(startTime, { startTime, title: c.title?.simpleText || c.title?.runs?.map((x: any) => x.text).join('') || '', thumbnailUrl: c.thumbnail?.thumbnails?.at(-1)?.url }); } Object.values(n).forEach(visit); };
  visit(data);
  return [...found.values()].sort((a, b) => a.startTime - b.startTime);
}
