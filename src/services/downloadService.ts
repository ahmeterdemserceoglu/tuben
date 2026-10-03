import { planOfflineHls } from '../utils/offlineHls';
import { prepareQualityStreams } from './playbackQualityService';
import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeModules, Platform } from 'react-native';
import { VideoItem } from '../types/video';
import { DownloadOption, getDownloadOptions } from '../utils/downloadOptions';
import { useDownloadStore, DownloadTask } from '../store/useDownloadStore';
import { YouTubeService } from './youtubeService';
import { decodeMediaPrefix, validateMediaPrefix, validateDownloadHeaders } from '../utils/downloadValidation';
export interface DownloadedVideo { id: string; title: string; uploaderName: string; thumbnailUrl: string; duration: number; localVideoUri: string; fileSizeBytes: number; downloadedAt: number; quality?: string; files?: { uri: string; size: number }[]; }
const KEY = '@tuben_downloaded_videos';
const DIR = `${FileSystem.documentDirectory}downloads/`;
export class DownloadService {
  private static active?: { id: string; download: FileSystem.DownloadResumable; phase: 'video' | 'audio' | 'hls' };
  private static running = false;
  private static taskSettled = new Map<string, Promise<void>>();
  private static settling?: Promise<void>;
  private static metaPending = Promise.resolve();
  private static async readMetadata(): Promise<DownloadedVideo[]> { try { const list = JSON.parse(await AsyncStorage.getItem(KEY) || '[]'); return Array.isArray(list) ? list : []; } catch { return []; } }
  static async getDownloadedVideos(): Promise<DownloadedVideo[]> {
    const list = await this.readMetadata();
    const validated = await Promise.all(list.map(async item => await this.isAvailable(item) ? item : null));
    const available = validated.filter((item): item is DownloadedVideo => item !== null);
    for (const item of list) {
      if (!available.some(valid => valid.id === item.id)) {
        const task = useDownloadStore.getState().downloads.find(t => t.id === item.id);
        if (task?.status === 'completed') useDownloadStore.getState().update(item.id, { status: 'error', localUri: undefined, error: 'İndirilen dosyalar eksik veya bozuk. Tekrar indirin.' });
      }
    }
    return available;
  }
  static async findDownloadedVideo(id: string): Promise<DownloadedVideo | undefined> {
    const item = (await this.readMetadata()).find(item => item.id === id);
    return item && await this.isAvailable(item) ? item : undefined;
  }
  private static async isAvailable(item: DownloadedVideo): Promise<boolean> {
    try {
      if (item.files?.length) {
        for (const file of item.files) {
          const info = await FileSystem.getInfoAsync(file.uri);
          if (!info.exists || info.isDirectory || info.size <= 0 || info.size !== file.size) return false;
        }
        return true;
      }
      if (item.localVideoUri.endsWith('.m3u8')) {
        // Older downloads have no inventory; inspect every local playlist dependency.
        const visited = new Set<string>();
        const check = async (uri: string): Promise<boolean> => {
          if (!uri.startsWith(DIR)) return false;
          if (visited.has(uri)) return true;
          visited.add(uri);
          const info = await FileSystem.getInfoAsync(uri);
          if (!info.exists || info.isDirectory || info.size <= 0) return false;
          if (!uri.endsWith('.m3u8')) return true;
          const text = await FileSystem.readAsStringAsync(uri);
          if (!text.startsWith('#EXTM3U')) return false;
          const refs = text.split(/\r?\n/).flatMap(line => line.startsWith('#') ? [...line.matchAll(/URI="([^"]+)"/g)].map(m => m[1]) : line.trim() ? [line.trim()] : []);
          if (!refs.length) return false;
          for (const ref of refs) if (!await check(new URL(ref, uri).href)) return false;
          return true;
        };
        return check(item.localVideoUri);
      }
      const size = await this.validateFile(item.localVideoUri, true);
      return size === item.fileSizeBytes;
    } catch { return false; }
  }
  private static async validateFile(uri: string, mp4: boolean): Promise<number> {
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists || info.isDirectory || info.size <= 0) throw new Error('İndirilen medya dosyası boş veya eksik.');
    const prefix = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64, position: 0, length: Math.min(64, info.size) });
    validateMediaPrefix(decodeMediaPrefix(prefix), mp4);
    return info.size;
  }
  static enqueue(video: VideoItem, option: DownloadOption) {
    const existing = useDownloadStore.getState().downloads.find(x => x.id === video.id);
    if (existing && existing.status !== 'error') return;
    useDownloadStore.getState().enqueue(video, option); void this.pump();
  }
  static async resume(id: string) {
    await this.settling;
    await this.taskSettled.get(id);
    const task = useDownloadStore.getState().downloads.find(x => x.id === id);
    if (!task || !['paused', 'error'].includes(task.status)) return;
    // Renew an expired signed URL before resuming; a new format starts a clean transfer.
    const expires = task.option.kind === 'hls' ? task.option.expiresAt || 0 : Number(new URL(task.option.video.url).searchParams.get('expire')) * 1000;
    if (expires > 0 && expires < Date.now() + 60000) {
      try {
        const bundle = await YouTubeService.getPlaybackStreams(id, { forceRefresh: true });
        if (task.option.kind === 'hls') bundle.qualityStreams = await prepareQualityStreams(bundle);
        const option = getDownloadOptions(bundle).find(x => x.quality === task.quality);
        if (!option) throw new Error('Seçilen kalite şu anda indirilemiyor.');
        useDownloadStore.getState().update(id, { option, resumeData: undefined, videoUri: undefined, audioUri: undefined, hlsPlan: undefined, hlsCompleted: undefined, hlsFileSizes: undefined, hlsActiveUrl: undefined, progress: 0 });
        await this.removePartial(id);
      } catch (e) { useDownloadStore.getState().update(id, { status: 'error', error: e instanceof Error ? e.message : 'Bağlantı yenilenemedi.' }); return; }
    }
    useDownloadStore.getState().update(id, { status: 'queued', error: undefined }); void this.pump();
  }
  static async pause(id: string) {
    const task = useDownloadStore.getState().downloads.find(x => x.id === id);
    if (!task || task.status === 'merging' || task.status === 'completed') return;
    useDownloadStore.getState().update(id, { status: 'paused' });
    if (this.active?.id === id) {
      const active = this.active;
      this.settling = (async () => { try { const state = await active.download.pauseAsync(); useDownloadStore.getState().update(id, { resumeData: state.resumeData, phase: active.phase }); } catch { /* Transfer may have just finished. */ } })();
      await this.settling; this.settling = undefined;
    }
  }
  private static async transfer(task: DownloadTask, phase: 'video' | 'audio'): Promise<string | undefined> {
    const stream = phase === 'video' ? task.option.video : task.option.audio!;
    const uri = `${DIR}${task.id}.${phase}.mp4`;
    const current = useDownloadStore.getState().downloads.find(x => x.id === task.id)!;
    const resumeData = current.phase === phase ? current.resumeData : undefined;
    useDownloadStore.getState().update(task.id, { phase });
    let lastUpdate = 0;
    let previousBytes: number | undefined;
    const download = FileSystem.createDownloadResumable(stream.url, uri, { headers: stream.headers || {} }, data => {
      const now = Date.now();
      if (now - lastUpdate < 250) return;
      const speed = previousBytes !== undefined && now > lastUpdate ? Math.max(0, data.totalBytesWritten - previousBytes) * 1000 / (now - lastUpdate) : 0;
      previousBytes = data.totalBytesWritten; lastUpdate = now;
      const fraction = data.totalBytesExpectedToWrite > 0 ? Math.min(1, data.totalBytesWritten / data.totalBytesExpectedToWrite) : 0;
      const progress = task.option.audio ? phase === 'video' ? fraction * 0.85 : 0.85 + fraction * 0.14 : fraction * 0.99;
      useDownloadStore.getState().update(task.id, { progress, downloadedBytes: data.totalBytesWritten, totalBytes: Math.max(0, data.totalBytesExpectedToWrite), bytesPerSecond: speed, remainingSeconds: speed > 0 && data.totalBytesExpectedToWrite > 0 ? Math.max(0, data.totalBytesExpectedToWrite - data.totalBytesWritten) / speed : undefined });
    }, resumeData);
    this.active = { id: task.id, download, phase };
    const result = resumeData ? await download.resumeAsync() : await download.downloadAsync();
    if (this.active?.download === download) this.active = undefined;
    if (useDownloadStore.getState().downloads.find(x => x.id === task.id)?.status === 'paused') return;
    if (!result?.uri || result.status < 200 || result.status >= 300 || (resumeData && result.status !== 206)) {
      await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => undefined);
      useDownloadStore.getState().update(task.id, { resumeData: undefined });
      throw new Error(resumeData && result?.status === 200 ? 'Sunucu kaldığı yerden indirmeyi desteklemiyor. Tekrar dene ile baştan indir.' : `Medya indirilemedi${result?.status ? ` (${result.status})` : ''}.`);
    }
    try {
      validateDownloadHeaders(result.headers);
      const size = await this.validateFile(result.uri, true);
      this.validateResponseSize(result.headers, size, Boolean(resumeData));
    } catch (error) {
      await FileSystem.deleteAsync(uri, { idempotent: true });
      useDownloadStore.getState().update(task.id, { resumeData: undefined });
      throw error;
    }
    useDownloadStore.getState().update(task.id, { [phase === 'video' ? 'videoUri' : 'audioUri']: result.uri, resumeData: undefined });
    return result.uri;
  }
  private static async transferHls(task: DownloadTask): Promise<string | undefined> {
    const folder = `${DIR}${task.id}.hls/`;
    await FileSystem.makeDirectoryAsync(folder, { intermediates: true });
    let plan = task.hlsPlan;
    if (!plan) {
      const read = async (url: string) => {
        if (url.startsWith('file:')) return FileSystem.readAsStringAsync(url);
        const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 20000);
        try { const response = await fetch(url, { headers: task.option.video.headers, signal: controller.signal }); if (!response.ok) throw new Error(`HLS listesi alınamadı (${response.status}).`); return response.text(); } finally { clearTimeout(timeout); }
      };
      plan = await planOfflineHls(task.option.video.url, read);
      for (const playlist of plan.playlists) await FileSystem.writeAsStringAsync(`${folder}${playlist.fileName}`, playlist.text);
      useDownloadStore.getState().update(task.id, { hlsPlan: plan });
    }
    const completed = new Set(task.hlsCompleted || []);
    for (const asset of plan.assets) {
      const current = useDownloadStore.getState().downloads.find(x => x.id === task.id);
      if (!current || current.status === 'paused') return;
      const path = `${folder}${asset.fileName}`;
      if (completed.has(asset.url)) {
        try {
          const size = await this.validateFile(path, false);
          if (current.hlsFileSizes?.[asset.url] !== size) throw new Error('Parça boyutu değişmiş.');
          continue;
        } catch { completed.delete(asset.url); }
      }
      const resumeData = current.hlsActiveUrl === asset.url ? current.resumeData : undefined;
      useDownloadStore.getState().update(task.id, { phase: 'hls', hlsActiveUrl: asset.url });
      let previousBytes: number | undefined, lastUpdate = 0;
      const completeBytes = Object.entries(current.hlsFileSizes || {}).reduce((sum, [url, size]) => sum + (completed.has(url) ? size : 0), 0);
      const download = FileSystem.createDownloadResumable(asset.url, path, { headers: task.option.video.headers || {} }, data => {
        const now = Date.now(); if (now - lastUpdate < 250) return;
        const speed = previousBytes !== undefined && now > lastUpdate ? Math.max(0, data.totalBytesWritten - previousBytes) * 1000 / (now - lastUpdate) : 0;
        previousBytes = data.totalBytesWritten; lastUpdate = now;
        const fraction = data.totalBytesExpectedToWrite > 0 ? Math.min(1, data.totalBytesWritten / data.totalBytesExpectedToWrite) : 0;
        const progress = (completed.size + fraction) / Math.max(1, plan!.assets.length) * 0.99;
        useDownloadStore.getState().update(task.id, { progress, downloadedBytes: completeBytes + data.totalBytesWritten, totalBytes: undefined, bytesPerSecond: speed, remainingSeconds: undefined });
      }, resumeData);
      this.active = { id: task.id, download, phase: 'hls' };
      const result = resumeData ? await download.resumeAsync() : await download.downloadAsync();
      if (this.active?.download === download) this.active = undefined;
      if (useDownloadStore.getState().downloads.find(x => x.id === task.id)?.status === 'paused') return;
      if (!result || result.status < 200 || result.status >= 300 || (resumeData && result.status !== 206)) {
        await FileSystem.deleteAsync(path, { idempotent: true }).catch(() => undefined);
        useDownloadStore.getState().update(task.id, { resumeData: undefined, hlsActiveUrl: undefined });
        throw new Error('Video parçası indirilemedi. Tekrar dene ile devam et.');
      }
      try {
        validateDownloadHeaders(result.headers);
        const size = await this.validateFile(path, false);
        this.validateResponseSize(result.headers, size, Boolean(resumeData));
        useDownloadStore.getState().update(task.id, { hlsFileSizes: { ...current.hlsFileSizes, [asset.url]: size } });
      } catch (error) {
        await FileSystem.deleteAsync(path, { idempotent: true });
        useDownloadStore.getState().update(task.id, { resumeData: undefined, hlsActiveUrl: undefined, hlsCompleted: [...completed] });
        throw error;
      }
      completed.add(asset.url);
      useDownloadStore.getState().update(task.id, { hlsCompleted: [...completed], resumeData: undefined, hlsActiveUrl: undefined, progress: completed.size / Math.max(1, plan.assets.length) * 0.99 });
    }
    return `${folder}index.m3u8`;
  }
  private static async pump() {
    if (this.running) return; this.running = true;
    try {
      await FileSystem.makeDirectoryAsync(DIR, { intermediates: true });
      while (true) {
        const task = useDownloadStore.getState().downloads.find(x => x.status === 'queued'); if (!task) break;
        useDownloadStore.getState().update(task.id, { status: 'downloading', error: undefined });
        let settleTask!: () => void;
        this.taskSettled.set(task.id, new Promise<void>(resolve => { settleTask = resolve; }));
        try {
          if (task.option.kind === 'hls') {
            const localUri = await this.transferHls(task);
            if (!localUri) continue;
            const currentTask = useDownloadStore.getState().downloads.find(x => x.id === task.id);
            if (!currentTask || currentTask.status === 'paused') continue;
            const assets = currentTask.hlsPlan?.assets || [];
            if (!assets.length) throw new Error('İndirilen oynatma listesinde medya bulunamadı.');
            const assetFiles = await Promise.all(assets.map(async asset => { const uri = `${DIR}${task.id}.hls/${asset.fileName}`; return { uri, size: await this.validateFile(uri, false) }; }));
            const playlistFiles = await Promise.all((currentTask.hlsPlan?.playlists || []).map(async playlist => {
              const uri = `${DIR}${task.id}.hls/${playlist.fileName}`, info = await FileSystem.getInfoAsync(uri);
              if (!info.exists || info.isDirectory || info.size <= 0) throw new Error('İndirilen oynatma listesi eksik.');
              return { uri, size: info.size };
            }));
            const fileSize = assetFiles.reduce((sum, file) => sum + file.size, 0);
            const item: DownloadedVideo = { id: task.id, title: task.video.title, uploaderName: task.video.uploaderName, thumbnailUrl: task.video.thumbnailUrl, duration: task.video.duration, localVideoUri: localUri, fileSizeBytes: fileSize, downloadedAt: Date.now(), quality: task.quality, files: [...assetFiles, ...playlistFiles] };
            await this.mutateMetadata(list => [item, ...list.filter(x => x.id !== task.id)]);
            useDownloadStore.getState().update(task.id, { status: 'completed', progress: 1, localUri, fileSize, hlsPlan: undefined, hlsCompleted: undefined, hlsFileSizes: undefined, resumeData: undefined });
            continue;
          }
          let videoUri = task.videoUri;
          if (videoUri) { try { await this.validateFile(videoUri, true); } catch { videoUri = undefined; } }
          videoUri ||= await this.transfer(task, 'video'); if (!videoUri) continue;
          if (useDownloadStore.getState().downloads.find(x => x.id === task.id)?.status === 'paused') continue;
          let audioUri = task.audioUri;
          if (task.option.audio) {
            if (audioUri) { try { await this.validateFile(audioUri, true); } catch { audioUri = undefined; } }
            audioUri ||= await this.transfer(task, 'audio'); if (!audioUri) continue;
          }
          if (useDownloadStore.getState().downloads.find(x => x.id === task.id)?.status === 'paused') continue;
          const output = `${DIR}${task.id}.mp4`;
          if (audioUri) {
            if (Platform.OS !== 'android' || !NativeModules.TubenNativeModule?.mergeMediaTracks) throw new Error('Ses ve video birleştirme bu cihazda desteklenmiyor.');
            useDownloadStore.getState().update(task.id, { status: 'merging', progress: 0.99 });
            await NativeModules.TubenNativeModule.mergeMediaTracks(videoUri, audioUri, output);
          } else {
            await FileSystem.deleteAsync(output, { idempotent: true });
            await FileSystem.moveAsync({ from: videoUri, to: output });
          }
          const fileSize = await this.validateFile(output, true);
          const item: DownloadedVideo = { id: task.id, title: task.video.title, uploaderName: task.video.uploaderName, thumbnailUrl: task.video.thumbnailUrl, duration: task.video.duration, localVideoUri: output, fileSizeBytes: fileSize, downloadedAt: Date.now(), quality: task.quality };
          await this.mutateMetadata(list => [item, ...list.filter(x => x.id !== task.id)]);
          useDownloadStore.getState().update(task.id, { status: 'completed', progress: 1, localUri: output, fileSize, videoUri: undefined, audioUri: undefined, resumeData: undefined });
          await this.removePartial(task.id);
        } catch (e) { if (useDownloadStore.getState().downloads.find(x => x.id === task.id)?.status !== 'paused') useDownloadStore.getState().update(task.id, { status: 'error', error: e instanceof Error ? e.message : 'İndirme başarısız.' }); }
        finally { settleTask(); this.taskSettled.delete(task.id); }
      }
    } finally { this.active = undefined; this.running = false; }
  }
  private static mutateMetadata(update: (list: DownloadedVideo[]) => DownloadedVideo[]): Promise<void> {
    const operation = this.metaPending.then(async () => { await AsyncStorage.setItem(KEY, JSON.stringify(update(await this.readMetadata()))); });
    this.metaPending = operation.catch(() => undefined); return operation;
  }
  private static validateResponseSize(headers: Record<string, string> = {}, size: number, resumed: boolean): void {
    const header = (name: string) => Object.entries(headers).find(([key]) => key.toLowerCase() === name)?.[1];
    const expected = resumed ? Number(header('content-range')?.match(/\/(\d+)$/)?.[1]) : Number(header('content-length'));
    if (Number.isFinite(expected) && expected > 0 && size !== expected) throw new Error('İndirilen dosya tamamlanmadı. Tekrar deneyin.');
  }
  private static async removePartial(id: string) { await FileSystem.deleteAsync(`${DIR}${id}.hls/`, { idempotent: true }).catch(() => undefined); await Promise.all(['video', 'audio'].map(phase => FileSystem.deleteAsync(`${DIR}${id}.${phase}.mp4`, { idempotent: true }).catch(() => undefined))); }
  static async cancelDownload(id: string) { await this.pause(id); await this.taskSettled.get(id); await this.removePartial(id); useDownloadStore.getState().remove(id); }
  static async deleteDownload(id: string) { await this.cancelDownload(id); await FileSystem.deleteAsync(`${DIR}${id}.mp4`, { idempotent: true }); await this.mutateMetadata(list => list.filter(x => x.id !== id)); }
}
