import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@tuben_youtube_auth';

// Standard YouTube TV client identity (tested & verified for device flow)
const DEFAULT_CLIENT_ID = process.env.EXPO_PUBLIC_YOUTUBE_CLIENT_ID || '861556708454-d6dlm3lh05idd8npek18k6be8ba3oc68.apps.googleusercontent.com';
const DEFAULT_CLIENT_SECRET = process.env.EXPO_PUBLIC_YOUTUBE_CLIENT_SECRET || '';

export interface YouTubeTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // timestamp in ms
  tokenType?: string;
  scope?: string;
}

export interface DeviceCodeResponse {
  deviceCode: string;
  userCode: string;
  expiresIn: number;
  interval: number;
  verificationUrl: string;
}

type AuthStateListener = (isAuthenticated: boolean) => void;

class YouTubeAuthServiceClass {
  private tokens: YouTubeTokens | null = null;
  private isLoaded = false;
  private loadPromise: Promise<YouTubeTokens | null> | null = null;
  private refreshPromise: Promise<YouTubeTokens | null> | null = null;
  private sessionRevision = 0;
  private listeners: Set<AuthStateListener> = new Set();
  private pollAbortController: AbortController | null = null;

  constructor() {
    void this.loadTokens();
  }

  /**
   * Load tokens from AsyncStorage
   */
  async loadTokens(): Promise<YouTubeTokens | null> {
    if (this.isLoaded) return this.tokens;
    if (!this.loadPromise) {
      const revision = this.sessionRevision;
      this.loadPromise = (async () => {
        try {
          const stored = await AsyncStorage.getItem(STORAGE_KEY);
          if (revision === this.sessionRevision) this.tokens = stored ? JSON.parse(stored) : null;
        } catch {
          if (revision === this.sessionRevision) this.tokens = null;
        } finally {
          this.isLoaded = true;
          this.loadPromise = null;
        }
        return this.tokens;
      })();
    }
    return this.loadPromise;
  }

  /**
   * Check if user is currently authenticated with YouTube
   */
  async isAuthenticated(): Promise<boolean> {
    const tokens = await this.loadTokens();
    return !!tokens?.accessToken;
  }

  /**
   * Synchronous check if tokens are cached in memory
   */
  hasCachedTokens(): boolean {
    return !!this.tokens?.accessToken;
  }

  /**
   * Add listener for auth state changes
   */
  subscribe(listener: AuthStateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  requestFeedReload(): void {
    this.notify();
  }

  private notify() {
    const isAuth = !!this.tokens?.accessToken;
    this.listeners.forEach((l) => {
      try {
        l(isAuth);
      } catch {
        // Ignored
      }
    });
  }

  /**
   * Step 1: Request Device Code from Google
   */
  async requestDeviceCode(): Promise<DeviceCodeResponse> {
    const payload = {
      client_id: DEFAULT_CLIENT_ID,
      scope: 'http://gdata.youtube.com https://www.googleapis.com/auth/youtube-paid-content',
      device_id: 'tuben-' + Math.random().toString(36).substring(2, 10),
      device_model: 'ytlr::',
    };

    const res = await fetch('https://www.youtube.com/o/oauth2/device/code', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Google Cihaz Kodu alınamadı (${res.status}): ${text}`);
    }

    const data = await res.json();
    return {
      deviceCode: data.device_code,
      userCode: data.user_code,
      expiresIn: data.expires_in,
      interval: data.interval || 5,
      verificationUrl: data.verification_url || 'https://www.google.com/device',
    };
  }

  /**
   * Step 2: Poll Google token endpoint until user confirms in browser
   */
  startPolling(
    deviceCode: string,
    intervalSec: number,
    onSuccess: (tokens: YouTubeTokens) => void,
    onError: (err: string) => void
  ): () => void {
    this.stopPolling();
    const abort = new AbortController();
    this.pollAbortController = abort;

    const intervalMs = Math.max((intervalSec || 5) * 1000, 3000);
    let isFinished = false;

    const poll = async () => {
      if (isFinished || abort.signal.aborted) return;

      try {
        const payload = {
          client_id: DEFAULT_CLIENT_ID,
          client_secret: DEFAULT_CLIENT_SECRET,
          code: deviceCode,
          grant_type: 'http://oauth.net/grant_type/device/1.0',
        };

        const res = await fetch('https://www.youtube.com/o/oauth2/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
          signal: abort.signal,
        });

        const data = await res.json();

        if (data.error) {
          if (data.error === 'authorization_pending' || data.error === 'slow_down') {
            // Still waiting for user, continue polling
            if (!abort.signal.aborted) {
              setTimeout(poll, intervalMs);
            }
            return;
          }

          if (data.error === 'access_denied') {
            isFinished = true;
            onError('İşlem Google tarafından reddedildi.');
            return;
          }

          if (data.error === 'expired_token') {
            isFinished = true;
            onError('Giriş kodunun süresi doldu. Lütfen tekrar deneyin.');
            return;
          }

          isFinished = true;
          onError(`Giriş hatası: ${data.error_description || data.error}`);
          return;
        }

        if (data.access_token) {
          isFinished = true;
          const tokens: YouTubeTokens = {
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
            expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
            tokenType: data.token_type,
            scope: data.scope,
          };

          await this.saveTokens(tokens);
          onSuccess(tokens);
        }
      } catch (err: any) {
        if (abort.signal.aborted) return;
        setTimeout(poll, intervalMs);
      }
    };

    // First check after interval
    setTimeout(poll, intervalMs);

    return () => this.stopPolling();
  }

  stopPolling() {
    if (this.pollAbortController) {
      this.pollAbortController.abort();
      this.pollAbortController = null;
    }
  }

  /**
   * Save tokens locally
   */
  async saveTokens(tokens: YouTubeTokens): Promise<void> {
    const sessionChanged = !this.tokens || this.tokens.refreshToken !== tokens.refreshToken;
    if (sessionChanged) this.sessionRevision++;
    this.tokens = tokens;
    this.isLoaded = true;
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
    } catch {
      // Ignored
    }
    // Refreshing a token must not trigger every feed to reload (and refresh again).
    if (sessionChanged) this.notify();
  }

  /**
   * Get valid Authorization header value (e.g. 'Bearer ya29...')
   * Automatically refreshes token if expired.
   */
  async getAuthHeader(forceRefresh = false): Promise<string | null> {
    const tokens = await this.loadTokens();
    if (!tokens || !tokens.accessToken) return null;

    // If token expires in less than 2 minutes, refresh it
    if (forceRefresh || Date.now() > tokens.expiresAt - 120000) {
      const refreshed = await this.refreshTokens();
      if (!refreshed && (forceRefresh || Date.now() >= tokens.expiresAt)) {
        throw new Error('YouTube oturumu yenilenemedi. Ayarlar’dan YouTube hesabınızı yeniden bağlayın.');
      }
    }

    return this.tokens?.accessToken ? `Bearer ${this.tokens.accessToken}` : null;
  }

  /**
   * Refresh access token using refresh_token
   */
  async refreshTokens(): Promise<YouTubeTokens | null> {
    if (this.refreshPromise) return this.refreshPromise;
    this.refreshPromise = this.performRefresh();
    try {
      return await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
    }
  }

  private async performRefresh(): Promise<YouTubeTokens | null> {
    if (!this.tokens?.refreshToken) return null;
    const tokens = this.tokens;
    const revision = this.sessionRevision;

    try {
      const payload = {
        client_id: DEFAULT_CLIENT_ID,
        client_secret: DEFAULT_CLIENT_SECRET,
        refresh_token: tokens.refreshToken,
        grant_type: 'refresh_token',
      };

      const res = await fetch('https://www.youtube.com/o/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) return null;
      const data = await res.json();
      if (data.access_token && revision === this.sessionRevision) {
        const updated: YouTubeTokens = {
          ...tokens,
          accessToken: data.access_token,
          expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
        };
        await this.saveTokens(updated);
        return updated;
      }
    } catch {
      // Ignored
    }
    return null;
  }

  /**
   * Sign out and clear stored tokens
   */
  async signOut(): Promise<void> {
    this.stopPolling();
    this.sessionRevision++;
    this.isLoaded = true;
    this.tokens = null;
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignored
    }
    this.notify();
  }
}

export const YouTubeAuthService = new YouTubeAuthServiceClass();
