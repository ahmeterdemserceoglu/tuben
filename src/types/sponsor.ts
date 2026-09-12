export interface SponsorSegment {
  category: 'sponsor' | 'intro' | 'outro' | 'interaction' | 'selfpromo' | 'music_offtopic' | 'preview';
  actionType: 'skip' | 'mute';
  segment: [number, number]; // [startSeconds, endSeconds]
  uuid: string;
}
