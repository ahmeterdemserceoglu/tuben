import React from 'react';
import { View, Image, Text } from 'react-native';
import { Storyboard, VideoChapter } from '../types/video';
import { storyboardFrame } from '../utils/playbackMetadata';
export const SeekPreview: React.FC<{ boards: Storyboard[]; chapters: VideoChapter[]; seconds: number; label: string }> = ({ boards, chapters, seconds, label }) => {
  const frame = storyboardFrame(boards, seconds);
  const chapter = [...chapters].reverse().find(x => x.startTime <= seconds);
  const width = 144, scale = frame ? width / frame.board.width : 1, height = frame ? frame.board.height * scale : 0;
  return <View style={{ width, backgroundColor: '#191919', borderRadius: 8, overflow: 'hidden' }}>
    {frame && <View style={{ width, height, overflow: 'hidden' }}><Image source={{ uri: frame.url }} style={{ position: 'absolute', width: frame.board.width * frame.board.columns * scale, height: frame.board.height * frame.board.rows * scale, left: -frame.x * width, top: -frame.y * height }} resizeMode="stretch" /></View>}
    <Text numberOfLines={1} style={{ color: 'white', textAlign: 'center', padding: 6, fontSize: 12 }}>{chapter?.title || label}</Text>
    {chapter && <Text style={{ color: '#aaa', textAlign: 'center', paddingBottom: 6, fontSize: 11 }}>{label}</Text>}
  </View>;
};
