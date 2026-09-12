import { SponsorSegment } from '../types/sponsor';

export class SponsorBlockService {
  private static cache = new Map<string, { segments: SponsorSegment[]; expiresAt: number }>();

  /**
   * Fetches sponsor and intro segments from SponsorBlock API
   */
  static async getSegments(videoId: string): Promise<SponsorSegment[]> {
    if (!videoId) return [];
    
    const cached = this.cache.get(videoId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.segments;
    }

    try {
      const categories = JSON.stringify(['sponsor', 'intro', 'outro', 'selfpromo', 'interaction']);
      const url = `https://sponsor.ajay.app/api/skipSegments?videoID=${videoId}&categories=${encodeURIComponent(categories)}`;
      
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Tuben/1.0',
        },
      });

      if (!res.ok) {
        if (res.status === 404) {
          // No segments for this video
          this.cache.set(videoId, { segments: [], expiresAt: Date.now() + 600000 });
          return [];
        }
        return [];
      }

      const data = await res.json();
      if (!Array.isArray(data)) return [];

      const segments: SponsorSegment[] = data.map((item: any) => ({
        category: item.category,
        actionType: item.actionType || 'skip',
        segment: [Number(item.segment?.[0] || 0), Number(item.segment?.[1] || 0)],
        uuid: item.UUID || String(Math.random()),
      }));

      this.cache.set(videoId, { segments, expiresAt: Date.now() + 600000 });
      return segments;
    } catch {
      return [];
    }
  }
}
