import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PlaybackDiagnostics } from '../services/playbackDiagnostics';
import { useThemeStore } from '../store/useThemeStore';
export const DiagnosticsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [events, setEvents] = useState<Awaited<ReturnType<typeof PlaybackDiagnostics.read>>>([]);
  const colors = useThemeStore(s => s.colors);
  useEffect(() => { void PlaybackDiagnostics.read().then(setEvents); }, []);
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}><View style={{ flexDirection: 'row', padding: 16, gap: 16 }}><TouchableOpacity onPress={() => navigation.goBack()}><Text style={{ color: 'white', fontSize: 22 }}>‹</Text></TouchableOpacity><Text style={{ flex: 1, color: 'white', fontSize: 18, fontWeight: '700' }}>Oynatma hata kayıtları</Text><TouchableOpacity onPress={() => { void Share.share({ message: JSON.stringify(events, null, 2) }).catch(() => undefined); }}><Text style={{ color: '#70b4ff' }}>Paylaş</Text></TouchableOpacity></View>
    <FlatList data={events} keyExtractor={(e, i) => `${e.timestamp}:${i}`} contentContainerStyle={{ padding: 16 }} ListEmptyComponent={<Text style={{ color: '#aaa' }}>Kayıtlı oynatma hatası bulunmuyor.</Text>} renderItem={({ item }) => <View style={{ padding: 14, borderRadius: 12, backgroundColor: colors.surfaceElevated, marginBottom: 10 }}><Text style={{ color: 'white', fontWeight: '600' }}>{item.category} · {item.quality}</Text><Text style={{ color: '#aaa', marginVertical: 6 }}>{item.timestamp ? new Date(item.timestamp).toLocaleString('tr-TR') : ''} · {Math.floor(item.position)} sn · {item.videoId}</Text><Text selectable style={{ color: '#ddd' }}>{item.message}</Text></View>} />
  </SafeAreaView>;
};
