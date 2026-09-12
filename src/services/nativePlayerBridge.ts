import { NativeModules, Platform } from 'react-native';

const { TubenNativeModule } = NativeModules;

export class NativePlayerBridge {
  /**
   * Starts native Android foreground media session with lock screen notification controls
   */
  static async startBackgroundPlayback(
    title: string,
    artist: string,
    videoId: string,
    streamUrl: string
  ): Promise<boolean> {
    if (Platform.OS !== 'android' || !TubenNativeModule?.startBackgroundPlayback) {
      return false;
    }
    try {
      return await TubenNativeModule.startBackgroundPlayback(title, artist, videoId, streamUrl);
    } catch (e) {
      console.warn('[NativePlayerBridge] startBackgroundPlayback error:', e);
      return false;
    }
  }

  /**
   * Updates playback state (Playing / Paused) in the native notification
   */
  static async updatePlaybackState(isPlaying: boolean): Promise<boolean> {
    if (Platform.OS !== 'android' || !TubenNativeModule?.updatePlaybackState) {
      return false;
    }
    try {
      return await TubenNativeModule.updatePlaybackState(isPlaying);
    } catch (e) {
      console.warn('[NativePlayerBridge] updatePlaybackState error:', e);
      return false;
    }
  }

  /**
   * Stops background service and removes ongoing notification
   */
  static async stopBackgroundPlayback(): Promise<boolean> {
    if (Platform.OS !== 'android' || !TubenNativeModule?.stopBackgroundPlayback) {
      return false;
    }
    try {
      return await TubenNativeModule.stopBackgroundPlayback();
    } catch (e) {
      console.warn('[NativePlayerBridge] stopBackgroundPlayback error:', e);
      return false;
    }
  }

  /**
   * Enters native Android Picture-in-Picture (PiP) mode
   */
  static async enterPictureInPicture(): Promise<boolean> {
    if (Platform.OS !== 'android' || !TubenNativeModule?.enterPictureInPicture) {
      return false;
    }
    try {
      return await TubenNativeModule.enterPictureInPicture();
    } catch (e) {
      console.warn('[NativePlayerBridge] enterPictureInPicture error:', e);
      return false;
    }
  }

  /**
   * Resolves unthrottled streams using native NewPipeExtractor engine
   */
  static async resolveStreams(videoId: string, preferProtected = false): Promise<any | null> {
    if (Platform.OS !== 'android' || !TubenNativeModule?.resolveStreams) {
      return null;
    }
    try {
      if (preferProtected && TubenNativeModule.resolveFreshStreams) {
        return await TubenNativeModule.resolveFreshStreams(videoId);
      }
      return await TubenNativeModule.resolveStreams(videoId);
    } catch (e) {
      console.warn('[NativePlayerBridge] resolveStreams error:', e);
      return null;
    }
  }

  static async setPlayerFullscreen(fullscreen: boolean): Promise<void> {
    if (Platform.OS === 'android' && TubenNativeModule?.setPlayerFullscreen) {
      await TubenNativeModule.setPlayerFullscreen(fullscreen);
    }
  }

  /**
   * Sets screen orientation (landscape, portrait, or unspecified)
   */
  static async setOrientation(orientation: 'landscape' | 'portrait' | 'unspecified'): Promise<boolean> {
    if (Platform.OS !== 'android' || !TubenNativeModule?.setScreenOrientation) {
      return false;
    }
    try {
      return await TubenNativeModule.setScreenOrientation(orientation);
    } catch (e) {
      console.warn('[NativePlayerBridge] setOrientation error:', e);
      return false;
    }
  }
}
