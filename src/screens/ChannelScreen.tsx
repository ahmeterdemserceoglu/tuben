import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Image, TouchableOpacity, FlatList, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { YouTubeExploreService, ChannelTab, SearchResult } from '../services/youtubeExploreService';
import { ChannelDetails } from '../types/channel';
import { VideoCard } from '../components/VideoCard';
import { usePlayerStore } from '../store/usePlayerStore';
import { useLibraryStore } from '../store/useLibraryStore';
import { useAuth } from '../auth/AuthContext';
import { useThemeStore } from '../store/useThemeStore';
import { THEME } from '../constants/theme';
import { useChannelPreferencesStore } from '../store/useChannelPreferencesStore';
const tabs: { id: ChannelTab; label: string }[] = [{ id: 'videos', label: 'Videolar' }, { id: 'shorts', label: 'Shorts' }, { id: 'live', label: 'Canlı' }, { id: 'playlists', label: 'Listeler' }, { id: 'about', label: 'Hakkında' }];
export const ChannelScreen: React.FC<{ route: any; navigation: any }> = ({ route, navigation }) => {
  const colors = useThemeStore(s => s.colors), { user } = useAuth();
  const { isSubscribed, toggleSubscription } = useLibraryStore();
  const { notifications, setNotifications } = useChannelPreferencesStore();
  const [channel, setChannel] = useState<ChannelDetails>();
  const [tab, setTab] = useState<ChannelTab>('videos');
  const [items, setItems] = useState<SearchResult[]>([]), [continuation, setContinuation] = useState<string>();
  const [loading, setLoading] = useState(true), [more, setMore] = useState(false), [error, setError] = useState('');
  const generation = useRef(0), paging = useRef(false);
  useEffect(() => { let active = true; setChannel(undefined); setError(''); setLoading(true); YouTubeExploreService.channel(route.params.channelId || route.params.channelName).then(c => { if (active) setChannel(c); }).catch(e => { if (active) { setError(e.message); setLoading(false); } }); return () => { active = false; generation.current++; }; }, [route.params.channelId, route.params.channelName]);
  useEffect(() => {
    if (!channel) return;
    const id = ++generation.current; paging.current = false; setMore(false); setItems([]); setContinuation(undefined); setError('');
    if (tab === 'about') { setLoading(false); return; }
    setLoading(true); YouTubeExploreService.channelTab(channel.id, tab).then(page => { if (id === generation.current) { setItems(page.items); setContinuation(page.continuation); } }).catch(e => { if (id === generation.current) setError(e.message); }).finally(() => { if (id === generation.current) setLoading(false); });
    return () => { generation.current++; };
  }, [channel?.id, tab]);
  const loadMore = async () => {
    if (!channel || !continuation || loading || paging.current) return;
    const id = generation.current; paging.current = true; setMore(true);
    try { const page = await YouTubeExploreService.channelTab(channel.id, tab, continuation); if (id !== generation.current) return; setItems(prev => { const keys = new Set(prev.map(x => x.item.id)); return [...prev, ...page.items.filter(x => !keys.has(x.item.id))]; }); setContinuation(page.continuation); }
    catch { if (id === generation.current) setError('Devamı yüklenemedi.'); }
    finally { if (id === generation.current) { paging.current = false; setMore(false); } }
  };
  const followed = channel && isSubscribed(channel.id);
  const notification = channel ? notifications[channel.id] || 'personalized' : 'personalized';
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
    <View style={styles.nav}><TouchableOpacity onPress={() => navigation.goBack()}><Ionicons name="arrow-back" color="white" size={24} /></TouchableOpacity><Text numberOfLines={1} style={[styles.title, { flex: 1 }]}>{channel?.name || route.params.channelName || 'Kanal'}</Text><TouchableOpacity onPress={() => navigation.navigate('Search')}><Ionicons name="search" color="white" size={24} /></TouchableOpacity></View>
    <FlatList data={items} keyExtractor={x => `${x.kind}:${x.item.id}`} onEndReached={loadMore} onEndReachedThreshold={0.4} contentContainerStyle={{ paddingBottom: 100 }}
      ListHeaderComponent={<View>
        {channel?.bannerUrl && <Image source={{ uri: channel.bannerUrl }} style={{ width: '100%', height: 120 }} />}
        {channel && <View style={{ padding: 16 }}><View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}><Image source={{ uri: channel.avatarUrl || 'https://www.gstatic.com/youtube/img/creator/avatar/default_avatar.png' }} style={{ width: 76, height: 76, borderRadius: 38 }} /><View style={{ flex: 1 }}><Text style={styles.title}>{channel.name}</Text><Text style={styles.secondary}>{channel.subscriberCount}</Text></View></View>
          <TouchableOpacity style={styles.button} onPress={() => { void toggleSubscription(user?.uid, { id: channel.id, name: channel.name, avatarUrl: channel.avatarUrl, subscriberCount: channel.subscriberCount }); }}><Text style={styles.title}>{followed ? 'Aboneliktesiniz' : 'Abone ol'}</Text></TouchableOpacity>
          {followed && <TouchableOpacity onPress={() => setNotifications(channel.id, notification === 'all' ? 'none' : notification === 'none' ? 'personalized' : 'all')}><Text style={styles.secondary}>♧ Tuben kanal tercihi: {notification === 'all' ? 'Tüm videolar' : notification === 'none' ? 'Kapalı' : 'Kişiselleştirilmiş'}</Text></TouchableOpacity>}
        </View>}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, gap: 8 }}>{tabs.map(t => <TouchableOpacity key={t.id} onPress={() => setTab(t.id)} style={[styles.chip, { backgroundColor: t.id === tab ? THEME.colors.primary : colors.surfaceElevated }]}><Text style={styles.title}>{t.label}</Text></TouchableOpacity>)}</ScrollView>
        {tab === 'about' && <Text selectable style={{ color: 'white', padding: 20, lineHeight: 23 }}>{channel?.description || 'Kanal açıklaması bulunmuyor.'}</Text>}
      </View>}
      renderItem={({ item: result }) => result.kind === 'video' ? <VideoCard video={result.item} onPress={v => { if (tab === 'shorts') void usePlayerStore.getState().playShorts({ ...v, streamType: 'SHORTS' }, items.flatMap(x => x.kind === 'video' ? [{ ...x.item, streamType: 'SHORTS' as const }] : [])); else void usePlayerStore.getState().playVideo(v, items.flatMap(x => x.kind === 'video' ? [x.item] : [])); }} /> : result.kind === 'playlist' ? <TouchableOpacity style={styles.nav} onPress={() => navigation.navigate('Playlist', { playlistId: result.item.id, title: result.item.title })}><Image source={{ uri: result.item.thumbnailUrl }} style={{ width: 120, height: 68, borderRadius: 8 }} /><Text style={[styles.title, { flex: 1 }]}>{result.item.title}</Text></TouchableOpacity> : null}
      ListEmptyComponent={tab === 'about' ? null : loading ? <ActivityIndicator style={{ padding: 32 }} color={THEME.colors.primary} /> : <Text style={{ color: '#aaa', padding: 24 }}>{error || 'Bu sekmede içerik bulunmuyor.'}</Text>}
      ListFooterComponent={more ? <ActivityIndicator color={THEME.colors.primary} /> : continuation ? <TouchableOpacity onPress={loadMore} style={styles.button}><Text style={styles.title}>Daha fazla yükle</Text></TouchableOpacity> : null}
    />
  </SafeAreaView>;
};
const styles = StyleSheet.create({ nav: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 16 }, title: { color: 'white', fontWeight: '700', fontSize: 15 }, secondary: { color: '#aaa', marginTop: 8 }, button: { backgroundColor: '#24242a', padding: 14, borderRadius: 24, alignItems: 'center', marginTop: 16 }, chip: { padding: 12, borderRadius: 20 } });
