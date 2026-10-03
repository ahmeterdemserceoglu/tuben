import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, Image, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDownloadStore } from '../store/useDownloadStore';
import { DownloadService, DownloadedVideo } from '../services/downloadService';
import { usePlayerStore } from '../store/usePlayerStore';
import { useThemeStore } from '../store/useThemeStore';
const labels = { queued: 'Sırada', downloading: 'İndiriliyor', paused: 'Duraklatıldı', merging: 'Ses ve video birleştiriliyor', completed: 'Tamamlandı', error: 'İndirme başarısız' };
export const DownloadsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const downloads = useDownloadStore(s => s.downloads), colors = useThemeStore(s => s.colors);
  const [saved, setSaved] = useState<DownloadedVideo[]>([]);
  useEffect(() => { let active = true; void DownloadService.getDownloadedVideos().then(x => { if (active) setSaved(x); }); return () => { active = false; }; }, [downloads]);
  const rows = [...downloads.map(task => ({ id: task.id, task, video: task.video, localUri: task.localUri, quality: task.quality })), ...saved.filter(x => !downloads.some(t => t.id === x.id)).map(x => ({ id: x.id, task: undefined, video: { id: x.id, title: x.title, uploaderName: x.uploaderName, thumbnailUrl: x.thumbnailUrl, duration: x.duration, viewCount: 0 }, localUri: x.localVideoUri, quality: x.quality || '' }))];
  const remove = (id: string) => Alert.alert('İndirmeyi sil', 'Dosya ve kuyruk kaydı silinsin mi?', [{ text: 'İptal', style: 'cancel' }, { text: 'Sil', style: 'destructive', onPress: () => { void DownloadService.deleteDownload(id).then(() => setSaved(s => s.filter(x => x.id !== id))).catch(() => Alert.alert('Dosya silinemedi')); } }]);
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
    <View style={{ padding: 16, flexDirection: 'row', gap: 16 }}><TouchableOpacity onPress={() => navigation.goBack()}><Text style={{ color: 'white', fontSize: 22 }}>‹</Text></TouchableOpacity><Text style={{ color: 'white', fontSize: 20, fontWeight: '700' }}>İndirmeler</Text></View>
    <FlatList data={rows} keyExtractor={x => x.id} contentContainerStyle={{ padding: 16, paddingBottom: 100 }} ListEmptyComponent={<Text style={{ color: '#aaa' }}>Videonun menüsünden kalite seçerek indirme kuyruğuna ekle.</Text>} renderItem={({ item }) => {
      const task = item.task, complete = !task || task.status === 'completed';
      return <View style={{ backgroundColor: colors.surfaceElevated, borderRadius: 14, padding: 14, marginBottom: 12 }}>
        <TouchableOpacity disabled={!complete || !item.localUri} style={{ flexDirection: 'row', gap: 12 }} onPress={() => { if (item.localUri) void usePlayerStore.getState().playVideo({ ...item.video, localUri: item.localUri }); }}><Image source={{ uri: item.video.thumbnailUrl }} style={{ width: 100, height: 58, borderRadius: 8 }} /><View style={{ flex: 1 }}><Text numberOfLines={2} style={{ color: 'white', fontWeight: '600' }}>{item.video.title}</Text><Text style={{ color: '#aaa', marginTop: 6 }}>{item.quality} · {task ? labels[task.status] : 'Tamamlandı'}{task && !complete ? ` · %${Math.floor(task.progress * 100)}` : ''}</Text></View></TouchableOpacity>
        {task && !complete && <View style={{ height: 3, backgroundColor: '#444', marginTop: 12 }}><View style={{ width: `${task.progress * 100}%`, height: 3, backgroundColor: '#e62c43' }} /></View>}
        {task?.error && <Text style={{ color: '#ff9090', marginTop: 8 }}>{task.error}</Text>}
        {task?.status === 'downloading' && <Text style={{ color: '#aaa', marginTop: 8, fontSize: 12 }}>{[
          task.phase === 'audio' ? 'Ses indiriliyor' : task.phase === 'hls' ? 'Video parçaları indiriliyor' : 'Video indiriliyor',
          task.downloadedBytes != null ? `${(task.downloadedBytes / 1048576).toFixed(1)} MB${task.totalBytes ? ` / ${(task.totalBytes / 1048576).toFixed(1)} MB` : ''}` : '',
          task.bytesPerSecond ? `${(task.bytesPerSecond / 1048576).toFixed(2)} MB/sn` : '',
          task.remainingSeconds ? `yaklaşık ${Math.ceil(task.remainingSeconds / 60)} dk kaldı` : '',
        ].filter(Boolean).join(' · ')}</Text>}
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 24, paddingTop: 12 }}>
          {task && ['downloading', 'queued'].includes(task.status) && <TouchableOpacity onPress={() => { void DownloadService.pause(item.id); }}><Text style={{ color: '#70b4ff' }}>Duraklat</Text></TouchableOpacity>}
          {task && ['paused', 'error'].includes(task.status) && <TouchableOpacity onPress={() => { void DownloadService.resume(item.id); }}><Text style={{ color: '#70b4ff' }}>{task.status === 'error' ? 'Tekrar dene' : 'Devam et'}</Text></TouchableOpacity>}
          {task?.status !== 'merging' && <TouchableOpacity onPress={() => remove(item.id)}><Text style={{ color: '#ff9090' }}>{complete ? 'Sil' : 'İptal'}</Text></TouchableOpacity>}
        </View>
      </View>;
    }} />
  </SafeAreaView>;
};
