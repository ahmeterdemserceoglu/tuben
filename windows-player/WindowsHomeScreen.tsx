import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { VideoCard } from '../src/components/VideoCard';
import { useAuth } from '../src/auth/AuthContext';
import { useYouTubeAuth } from '../src/auth/useYouTubeAuth';
import { useLibraryStore } from '../src/store/useLibraryStore';
import { usePlayerStore } from '../src/store/usePlayerStore';
import { filterRecommendations, useRecommendationStore } from '../src/store/useRecommendationStore';
import { YouTubeService } from '../src/services/youtubeService';
import { VideoItem } from '../src/types/video';
import { THEME } from '../src/constants/theme';

const categories = [
  { id: 'all', label: 'Sana Özel' },
  { id: 'trending', label: 'Trendler' },
  { id: 'music', label: 'Müzik' },
  { id: 'gaming', label: 'Oyun' },
  { id: 'news', label: 'Haberler' },
  { id: 'tech', label: 'Teknoloji' },
];

export function WindowsHomeScreen({ navigation }: { navigation: any }) {
  const { width } = useWindowDimensions();
  const columns = Math.max(1, Math.min(5, Math.floor((Math.min(width, 1500) - 64) / 280)));
  const [category, setCategory] = useState('all');
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const { user } = useAuth();
  const { authenticated, ready, revision } = useYouTubeAuth();
  const { history, loadLibrary } = useLibraryStore();
  const preferences = useRecommendationStore();

  useEffect(() => { void loadLibrary(user?.uid); }, [user?.uid, loadLibrary]);

  useEffect(() => {
    if (!ready) return;
    let active = true;
    setLoading(true);
    setError('');
    void YouTubeService.getHomeFeed(category).then((result) => {
      if (active) setVideos(result);
    }).catch((cause) => {
      if (active) {
        setVideos([]);
        setError(cause instanceof Error ? cause.message : 'Video akışı yüklenemedi.');
      }
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [category, ready, revision, retry]);

  const visible = useMemo(() => filterRecommendations(
    videos.filter((video) => video.streamType !== 'SHORTS' && !video.title.toLowerCase().includes('#shorts')),
    preferences,
    history.map((item) => item.videoId),
  ), [videos, preferences, history]);
  const featured = visible[0];

  const play = useCallback((video: VideoItem) => {
    void usePlayerStore.getState().playVideo(video, visible);
  }, [visible]);

  return (
    <SafeAreaView style={styles.root} edges={['left', 'right']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.page}>
        <View style={styles.topBar}>
          <View style={styles.brandBlock}>
            <View style={styles.brandLine}><View style={styles.brandMark}><Ionicons name="play" size={17} color="#FFFFFF" /></View><Text style={styles.brand}>TUBEN</Text></View>
            <Text style={styles.brandCaption}>VİDEO DÜNYAN</Text>
          </View>
          <View style={styles.actions}>
            <TouchableOpacity style={styles.searchButton} onPress={() => navigation.navigate('Search')} accessibilityLabel="Video ara">
              <Ionicons name="search-outline" size={19} color={THEME.colors.textSecondary} />
              <Text style={styles.searchText}>Video, kanal veya konu ara</Text>
              <Text style={styles.searchShortcut}>ARA</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconButton} onPress={() => navigation.navigate('Settings')} accessibilityLabel="Ayarlar"><Ionicons name="settings-outline" size={20} color={THEME.colors.textPrimary} /></TouchableOpacity>
            <TouchableOpacity style={styles.iconButton} onPress={() => navigation.navigate(user ? 'Library' : 'Auth')} accessibilityLabel={user ? 'Kitaplık' : 'Giriş yap'}><Ionicons name={user ? 'person-circle-outline' : 'person-outline'} size={21} color={THEME.colors.textPrimary} /></TouchableOpacity>
          </View>
        </View>

        <View style={styles.intro}>
          <View><Text style={styles.eyebrow}>YENİ BİR ŞEY KEŞFET</Text><Text style={styles.heading}>İzlemeye değer olanlar.</Text></View>
          <Text style={styles.introCopy}>Sevdiğin içerikler ve yeni keşifler, rahat bir izleme alanında.</Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categories}>
          {categories.map((item) => (
            <TouchableOpacity key={item.id} onPress={() => setCategory(item.id)} style={[styles.category, category === item.id && styles.categoryActive]}>
              <Text style={[styles.categoryText, category === item.id && styles.categoryTextActive]}>{item.id === 'all' && !authenticated ? 'Tümü' : item.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {featured ? (
          <TouchableOpacity style={styles.hero} activeOpacity={0.94} onPress={() => play(featured)} accessibilityLabel={`${featured.title} videosunu oynat`}>
            <Image source={{ uri: featured.thumbnailUrl }} style={styles.heroImage} resizeMode="cover" />
            <LinearGradient colors={['rgba(10,10,14,0.02)', 'rgba(10,10,14,0.55)', '#101017']} style={StyleSheet.absoluteFill} />
            <View style={styles.heroBody}>
              <Text style={styles.heroOverline}>ÖNE ÇIKAN VİDEO</Text>
              <Text style={styles.heroTitle} numberOfLines={2}>{featured.title}</Text>
              <Text style={styles.heroChannel} numberOfLines={1}>{featured.uploaderName}</Text>
              <View style={styles.heroPlay}><Ionicons name="play" size={17} color="#FFFFFF" /><Text style={styles.heroPlayText}>Şimdi İzle</Text></View>
            </View>
          </TouchableOpacity>
        ) : (
          <View style={styles.emptyHero}>
            <Ionicons name={loading ? 'hourglass-outline' : 'videocam-outline'} size={34} color={THEME.colors.primaryLight} />
            <Text style={styles.emptyTitle}>{loading ? 'Videolar hazırlanıyor' : 'Akışa bağlanılamadı'}</Text>
            <Text style={styles.emptyDescription}>{loading ? 'Yeni içerikleri getiriyoruz.' : error || 'Bağlantıyı kontrol edip yeniden deneyin.'}</Text>
            {!loading && <TouchableOpacity style={styles.retryButton} onPress={() => setRetry((value) => value + 1)}><Text style={styles.retryText}>Yeniden dene</Text></TouchableOpacity>}
          </View>
        )}

        {visible.length > 1 && (
          <>
            <View style={styles.sectionHead}><View><Text style={styles.eyebrow}>AKIŞ</Text><Text style={styles.sectionTitle}>Senin için videolar</Text></View><Text style={styles.count}>{visible.length} video</Text></View>
            <View style={styles.grid}>
              {visible.slice(1).map((video) => (
                <View key={video.id} style={[styles.gridCell, { width: `${100 / columns}%` }]}>
                  <VideoCard compact video={video} onPress={play} onChannelPress={(channelName, channelId) => navigation.navigate('Channel', { channelId: channelId || channelName, channelName })} />
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0B0B0E' },
  page: { width: '100%', maxWidth: 1500, alignSelf: 'center', paddingHorizontal: 32, paddingTop: 28, paddingBottom: 120 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 28, marginBottom: 52 },
  brandBlock: { flexShrink: 0 },
  brandLine: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandMark: { width: 32, height: 32, borderRadius: 10, backgroundColor: THEME.colors.primary, alignItems: 'center', justifyContent: 'center' },
  brand: { color: '#FFFFFF', fontSize: 27, fontWeight: '900', letterSpacing: -1.2 },
  brandCaption: { color: THEME.colors.textTertiary, fontSize: 10, fontWeight: '800', letterSpacing: 2, marginTop: 5, marginLeft: 42 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, justifyContent: 'flex-end' },
  searchButton: { flexDirection: 'row', alignItems: 'center', gap: 10, width: 330, maxWidth: '55%', height: 44, paddingHorizontal: 14, backgroundColor: '#191920', borderWidth: 1, borderColor: THEME.colors.borderLight, borderRadius: 13 },
  searchText: { flex: 1, color: THEME.colors.textTertiary, fontSize: 13 },
  searchShortcut: { color: THEME.colors.textMuted, fontSize: 10, fontWeight: '800' },
  iconButton: { width: 44, height: 44, borderRadius: 13, backgroundColor: '#191920', borderWidth: 1, borderColor: THEME.colors.borderLight, alignItems: 'center', justifyContent: 'center' },
  intro: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 20, marginBottom: 28 },
  eyebrow: { color: THEME.colors.primaryLight, fontSize: 11, fontWeight: '800', letterSpacing: 1.8, marginBottom: 9 },
  heading: { color: THEME.colors.textPrimary, fontSize: 38, fontWeight: '800', letterSpacing: -1.2 },
  introCopy: { maxWidth: 300, color: THEME.colors.textSecondary, fontSize: 14, lineHeight: 21, textAlign: 'right' },
  categories: { alignItems: 'center', gap: 9, paddingBottom: 26 },
  category: { paddingHorizontal: 17, paddingVertical: 10, backgroundColor: '#1B1B22', borderWidth: 1, borderColor: THEME.colors.borderLight, borderRadius: 12 },
  categoryActive: { backgroundColor: THEME.colors.primary, borderColor: THEME.colors.primary },
  categoryText: { color: THEME.colors.textSecondary, fontSize: 13, fontWeight: '700' },
  categoryTextActive: { color: '#FFFFFF' },
  hero: { height: 370, borderRadius: 24, overflow: 'hidden', backgroundColor: '#1B1B22', borderWidth: 1, borderColor: THEME.colors.borderLight },
  heroImage: { width: '100%', height: '100%', position: 'absolute' },
  heroBody: { position: 'absolute', left: 36, bottom: 32, right: 36, maxWidth: 650 },
  heroOverline: { color: '#FFA6B7', fontSize: 11, fontWeight: '900', letterSpacing: 1.7, marginBottom: 10 },
  heroTitle: { color: '#FFFFFF', fontSize: 32, lineHeight: 39, fontWeight: '800', marginBottom: 8 },
  heroChannel: { color: 'rgba(255,255,255,0.75)', fontSize: 14, marginBottom: 20 },
  heroPlay: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', backgroundColor: THEME.colors.primary, paddingHorizontal: 18, paddingVertical: 11, borderRadius: 11 },
  heroPlayText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  emptyHero: { height: 300, borderRadius: 24, borderWidth: 1, borderColor: THEME.colors.borderLight, backgroundColor: '#17171E', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 },
  emptyTitle: { color: THEME.colors.textPrimary, fontSize: 21, fontWeight: '800' },
  emptyDescription: { color: THEME.colors.textSecondary, textAlign: 'center', fontSize: 13 },
  retryButton: { marginTop: 8, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: THEME.colors.primary, borderRadius: 10 },
  retryText: { color: '#FFFFFF', fontWeight: '800' },
  sectionHead: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 35, marginBottom: 20 },
  sectionTitle: { color: THEME.colors.textPrimary, fontSize: 23, fontWeight: '800', letterSpacing: -0.5 },
  count: { color: THEME.colors.textTertiary, fontSize: 13 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -10 },
  gridCell: { width: '33.333%', paddingHorizontal: 10 },
  gridCellHalf: { width: '50%' },
  gridCellFull: { width: '100%' },
});
