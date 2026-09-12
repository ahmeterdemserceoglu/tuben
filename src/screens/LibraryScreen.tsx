import { useDownloadStore } from '../store/useDownloadStore';
import { WatchProgressBar } from '../components/WatchProgressBar';
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../auth/AuthContext';
import { useLibraryStore } from '../store/useLibraryStore';
import { THEME } from '../constants/theme';
import { useThemeStore } from '../store/useThemeStore';
import { usePlayerStore } from '../store/usePlayerStore';
import { DownloadService, DownloadedVideo } from '../services/downloadService';
import { EmptyState } from '../components/common/EmptyState';
import { Haptics } from '../utils/haptics';

export const LibraryScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { user, signOut, isAnonymous } = useAuth();
  const { history, favorites, playlists, subscriptions, loadLibrary } = useLibraryStore();
  const colors = useThemeStore((s) => s.colors);

  const downloadRevision = useDownloadStore(s => s.downloads);
  const [downloads, setDownloads] = useState<DownloadedVideo[]>([]);

  useEffect(() => {
    void loadLibrary(user?.uid);
    const unsubscribe = navigation.addListener('focus', async () => {
      void loadLibrary(user?.uid);
      const list = await DownloadService.getDownloadedVideos();
      setDownloads(list);
    });
    return unsubscribe;
  }, [user?.uid, navigation, loadLibrary]);

  const handlePlayVideo = (video: any) => {
    Haptics.selection();
    usePlayerStore.getState().loadAndPlay(video);
    usePlayerStore.getState().setMinimized(false);
  };

  useEffect(() => { let active = true; void DownloadService.getDownloadedVideos().then(x => { if (active) setDownloads(x); }); return () => { active = false; }; }, [downloadRevision]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.divider || 'rgba(255,255,255,0.06)' }]}>
        <Text style={styles.headerTitle}>Kitaplık & Profil</Text>
        <TouchableOpacity
          style={[styles.settingsBtn, { backgroundColor: colors.surfaceElevated }]}
          onPress={() => navigation.navigate('Settings')}
        >
          <Ionicons name="settings-outline" size={20} color={THEME.colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollContent} contentContainerStyle={{ paddingBottom: 80 }}>
        {/* Personalized User & Profile Card */}
        <View style={[styles.profileCard, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
          <View style={styles.profileTopRow}>
            <View style={styles.avatarWrap}>
              <Text style={styles.avatarText}>
                {(user?.displayName || 'T').charAt(0).toUpperCase()}
              </Text>
            </View>

            <View style={styles.profileInfo}>
              <Text style={styles.userName}>
                {user?.displayName || (isAnonymous ? 'Misafir Kullanıcı' : 'Kullanıcı')}
              </Text>
              <Text style={styles.userEmail}>
                {user?.email || (isAnonymous ? 'Yerel Oturum' : 'Giriş Yapılmadı')}
              </Text>
            </View>

            {user && !isAnonymous ? (
              <TouchableOpacity style={styles.signOutBtn} onPress={signOut}>
                <Text style={styles.signOutText}>Çıkış</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.loginBtn}
                onPress={() => navigation.navigate('Auth')}
              >
                <Text style={styles.loginBtnText}>Giriş Yap</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Quick Stats Bar */}
          <View style={[styles.statsRow, { borderTopColor: colors.divider }]}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{history.length}</Text>
              <Text style={styles.statLabel}>İzlenen</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.divider }]} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{favorites.length}</Text>
              <Text style={styles.statLabel}>Beğeni</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.divider }]} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{downloads.length}</Text>
              <Text style={styles.statLabel}>İndirilen</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.divider }]} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{subscriptions.length}</Text>
              <Text style={styles.statLabel}>Abonelik</Text>
            </View>
          </View>
        </View>

        {/* Quick Action Tiles */}
        <View style={styles.tilesGrid}>
          <TouchableOpacity
            style={[styles.tileCard, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('History')}
          >
            <View style={[styles.tileIconCircle, { backgroundColor: 'rgba(255, 0, 51, 0.12)' }]}>
              <Ionicons name="time-outline" size={20} color={THEME.colors.primary} />
            </View>
            <Text style={styles.tileTitle}>Geçmiş</Text>
            <Text style={styles.tileCount}>{history.length} video</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tileCard, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('Subscriptions')}
          >
            <View style={[styles.tileIconCircle, { backgroundColor: 'rgba(56, 189, 248, 0.12)' }]}>
              <Ionicons name="albums-outline" size={20} color="#38BDF8" />
            </View>
            <Text style={styles.tileTitle}>Abonelikler</Text>
            <Text style={styles.tileCount}>{subscriptions.length} kanal</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={() => navigation.navigate('Downloads')} style={{ padding: 16, borderRadius: 14, backgroundColor: colors.surfaceElevated, marginBottom: 12 }}><Text style={{ color: 'white', fontWeight: '700' }}>İndirme kuyruğu · {downloadRevision.filter(x => x.status !== 'completed').length} işlem →</Text></TouchableOpacity>
        {/* Section: İndirilenler */}
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionTitleWrap}>
            <Ionicons name="download-outline" size={18} color={THEME.colors.primary} />
            <Text style={styles.sectionTitle}>Çevrimdışı İndirilenler</Text>
            <View style={styles.countPill}>
              <Text style={styles.countPillText}>{downloads.length}</Text>
            </View>
          </View>
        </View>

        {downloads.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalScroll}
          >
            {downloads.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[styles.compactCard, { backgroundColor: colors.surface }]}
                activeOpacity={0.88}
                onPress={() =>
                  handlePlayVideo({
                    id: item.id,
                    title: item.title,
                    uploaderName: item.uploaderName,
                    thumbnailUrl: item.thumbnailUrl,
                    duration: item.duration,
                    localUri: item.localVideoUri,
                  })
                }
              >
                <View style={[styles.compactThumb, { overflow: 'hidden' }]}>
                  <Image source={{ uri: item.thumbnailUrl }} style={StyleSheet.absoluteFill} />
                  <WatchProgressBar videoId={item.id} duration={item.duration} />
                </View>
                <View style={styles.compactInfo}>
                  <Text style={styles.compactTitle} numberOfLines={2}>
                    {item.title}
                  </Text>
                  <Text style={styles.compactChannel} numberOfLines={1}>
                    {item.uploaderName}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : (
          <View style={[styles.emptyNotice, { backgroundColor: colors.surface }]}>
            <Ionicons name="cloud-download-outline" size={22} color={THEME.colors.textTertiary} />
            <Text style={styles.emptyNoticeText}>
              Henüz video indirmediniz. İstediğiniz videoyu üç nokta menüsünden çevrimdışı kaydedebilirsiniz.
            </Text>
          </View>
        )}

        {/* Section: Son İzlenenler */}
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionTitleWrap}>
            <Ionicons name="play-circle-outline" size={18} color={THEME.colors.primary} />
            <Text style={styles.sectionTitle}>Son İzlenenler</Text>
          </View>
          {history.length > 0 && (
            <TouchableOpacity onPress={() => navigation.navigate('History')}>
              <Text style={styles.seeAllText}>Tümü</Text>
            </TouchableOpacity>
          )}
        </View>

        {history.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalScroll}
          >
            {history.slice(0, 8).map((item) => (
              <TouchableOpacity
                key={item.videoId}
                style={[styles.compactCard, { backgroundColor: colors.surface }]}
                activeOpacity={0.88}
                onPress={() =>
                  handlePlayVideo({
                    id: item.videoId,
                    title: item.title,
                    uploaderName: item.channelTitle || '',
                    thumbnailUrl: item.thumbnailUrl,
                    duration: item.duration,
                    viewCount: 0,
                  })
                }
              >
                <View style={[styles.compactThumb, { overflow: 'hidden' }]}>
                  <Image source={{ uri: item.thumbnailUrl }} style={StyleSheet.absoluteFill} />
                  <WatchProgressBar videoId={item.videoId} duration={item.duration} />
                </View>
                <View style={styles.compactInfo}>
                  <Text style={styles.compactTitle} numberOfLines={2}>
                    {item.title}
                  </Text>
                  <Text style={styles.compactChannel} numberOfLines={1}>
                    {item.channelTitle}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : (
          <View style={[styles.emptyNotice, { backgroundColor: colors.surface }]}>
            <Ionicons name="time-outline" size={22} color={THEME.colors.textTertiary} />
            <Text style={styles.emptyNoticeText}>
              İzleme geçmişiniz boş. İzlediğiniz videolar otomatik olarak burada toplanır.
            </Text>
          </View>
        )}

        {/* Section: Beğenilen Videolar */}
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionTitleWrap}>
            <Ionicons name="heart-outline" size={18} color={THEME.colors.accent} />
            <Text style={styles.sectionTitle}>Beğenilenler</Text>
            <View style={styles.countPill}>
              <Text style={styles.countPillText}>{favorites.length}</Text>
            </View>
          </View>
        </View>

        {favorites.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalScroll}
          >
            {favorites.map((item) => (
              <TouchableOpacity
                key={item.videoId}
                style={[styles.compactCard, { backgroundColor: colors.surface }]}
                activeOpacity={0.88}
                onPress={() =>
                  handlePlayVideo({
                    id: item.videoId,
                    title: item.title,
                    uploaderName: item.channelTitle || '',
                    thumbnailUrl: item.thumbnailUrl,
                    duration: item.duration,
                    viewCount: 0,
                  })
                }
              >
                <View style={[styles.compactThumb, { overflow: 'hidden' }]}>
                  <Image source={{ uri: item.thumbnailUrl }} style={StyleSheet.absoluteFill} />
                  <WatchProgressBar videoId={item.videoId} duration={item.duration} />
                </View>
                <View style={styles.compactInfo}>
                  <Text style={styles.compactTitle} numberOfLines={2}>
                    {item.title}
                  </Text>
                  <Text style={styles.compactChannel} numberOfLines={1}>
                    {item.channelTitle}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : (
          <View style={[styles.emptyNotice, { backgroundColor: colors.surface }]}>
            <Ionicons name="heart-dislike-outline" size={22} color={THEME.colors.textTertiary} />
            <Text style={styles.emptyNoticeText}>
              Henüz favori videonuz yok. Beğendiğiniz videoları kalp ikonuna basarak kaydedebilirsiniz.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
    letterSpacing: -0.5,
  },
  settingsBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: 14,
    paddingTop: 14,
  },
  profileCard: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 16,
  },
  profileTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  avatarWrap: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: THEME.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
  },
  profileInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 12,
    color: THEME.colors.textTertiary,
  },
  signOutBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  signOutText: {
    color: THEME.colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  loginBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 14,
    backgroundColor: THEME.colors.primary,
  },
  loginBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingVertical: 12,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 16,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
  },
  statLabel: {
    fontSize: 10,
    color: THEME.colors.textTertiary,
    marginTop: 1,
    fontWeight: '500',
  },
  statDivider: {
    width: 1,
    height: 22,
  },
  tilesGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  tileCard: {
    flex: 1,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  tileIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  tileTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    marginBottom: 2,
  },
  tileCount: {
    fontSize: 12,
    color: THEME.colors.textTertiary,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    marginTop: 6,
  },
  sectionTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    letterSpacing: -0.2,
  },
  countPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 4,
  },
  countPillText: {
    color: THEME.colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  seeAllText: {
    color: THEME.colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  horizontalScroll: {
    gap: 10,
    paddingBottom: 16,
  },
  compactCard: {
    width: 155,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  compactThumb: {
    width: '100%',
    height: 88,
    backgroundColor: '#000000',
  },
  compactInfo: {
    padding: 8,
  },
  compactTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
    lineHeight: 16,
    marginBottom: 3,
  },
  compactChannel: {
    fontSize: 10,
    color: THEME.colors.textTertiary,
  },
  emptyNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    gap: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  emptyNoticeText: {
    flex: 1,
    fontSize: 12,
    color: THEME.colors.textTertiary,
    lineHeight: 17,
  },
});
