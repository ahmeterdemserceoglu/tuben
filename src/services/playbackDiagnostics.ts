import { NativeModules } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
interface PlaybackEvent { videoId?: string; category: string; message: string; quality: string; position: number; timestamp?: number; }
export class PlaybackDiagnostics {
  private static pending = Promise.resolve();
  static record(event: PlaybackEvent): Promise<void> {
    this.pending = this.pending.then(async () => { const events = await this.read(); const safe = { ...event, timestamp: event.timestamp || Date.now(), message: event.message.replace(/https?:\/\/[^\s"']+/g, '[medya]').slice(0, 300) }; await AsyncStorage.setItem('tuben-playback-diagnostics', JSON.stringify([safe, ...events].slice(0, 50))); }).catch(() => undefined);
    return this.pending;
  }
  static installCrashHandler() {
    if (NativeModules.TubenNativeModule?.consumeCrashEvents) void NativeModules.TubenNativeModule.consumeCrashEvents().then(async (json: string) => { for (const event of JSON.parse(json)) await this.record(event); }).catch(() => undefined);
    const errorUtils = (globalThis as any).ErrorUtils;
    if (!errorUtils?.getGlobalHandler || !errorUtils?.setGlobalHandler || (globalThis as any).__tubenDiagnosticsInstalled) return;
    (globalThis as any).__tubenDiagnosticsInstalled = true;
    const previous = errorUtils.getGlobalHandler();
    errorUtils.setGlobalHandler((error: Error, isFatal: boolean) => {
      void this.record({ category: isFatal ? 'fatal-js-error' : 'js-error', message: error.message || String(error), quality: '', position: 0 });
      previous(error, isFatal);
    });
  }
  static async read(): Promise<PlaybackEvent[]> { try { const data = JSON.parse(await AsyncStorage.getItem('tuben-playback-diagnostics') || '[]'); return Array.isArray(data) ? data : []; } catch { return []; } }
}
