import { useRecommendationStore } from '../store/useRecommendationStore';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  StatusBar,
  useWindowDimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { clearVideoCacheAsync } from 'expo-video';
import { useAuth } from '../auth/AuthContext';
import { THEME } from '../constants/theme';
import { useThemeStore } from '../store/useThemeStore';
import { PlaybackQuality, useSettingsStore } from '../store/useSettingsStore';
import { StorageService } from '../services/storageService';
import { ActionSheet, ActionSheetOption } from '../components/common/ActionSheet';
import { useToastStore } from '../store/useToastStore';
import { Haptics } from '../utils/haptics';
import { YouTubeAuthService } from '../services/youtubeAuthService';
import { YouTubeSyncModal } from '../components/YouTubeSyncModal';

export const SettingsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const preferences = useRecommendationStore();
  const { width, height } = useWindowDimensions();
  const landscape = width > height;
  const { user, signOut, deleteAccount } = useAuth();
  const { isAmoled, toggleAmoled, colors } = useThemeStore();
  const { showToast } = useToastStore();

  const {
    sponsorBlockEnabled,
    skipIntros,
    skipSelfPromo,
    backgroundPlayback,
    autoPlayNext,
    defaultQuality,
    setSponsorBlockEnabled,
    setSkipIntros,
    setSkipSelfPromo,
    setBackgroundPlayback,
    setAutoPlayNext,
    setDefaultQuality,
  } = useSettingsStore();

  const [showClearCacheSheet, setShowClearCacheSheet] = useState(false);
  const [showSignOutSheet, setShowSignOutSheet] = useState(false);
  const [showDeleteAccountSheet, setShowDeleteAccountSheet] = useState(false);
  const [showQualitySheet, setShowQualitySheet] = useState(false);
  const [showYouTubeSyncModal, setShowYouTubeSyncModal] = useState(false);
  const [isYouTubeSynced, setIsYouTubeSynced] = useState(false);

  useEffect(() => {
    void YouTubeAuthService.isAuthenticated().then(setIsYouTubeSynced);
    const unsub = YouTubeAuthService.subscribe(setIsYouTubeSynced);
    return unsub;
  }, []);

  const qualities: PlaybackQuality[] = ['Auto', '2160p', '1440p', '1080p', '720p', '480p', '360p', '240p', '144p'];

  const handleClearCache = async () => {
    try {
      await Promise.all([StorageService.clearAllStorage(), clearVideoCacheAsync()]);
      showToast('Tüm önbellek ve geçici veriler temizlendi.', 'success');
    } catch {
      showToast('Önbellek temizlenirken hata oluştu.', 'error');
    }
  };

  const handleSignOutConfirm = async () => {
    await signOut();
    showToast('Hesaptan çıkış yapıldı.', 'info');
    navigation.goBack();
  };

  const handleDeleteAccountConfirm = async () => {
    try {
      await deleteAccount();
      await YouTubeAuthService.signOut();
      await AsyncStorage.clear();
      showToast('Hesabınız ve ilişkili bulut verileriniz silindi.', 'success');
      navigation.goBack();
    } catch (error: any) {
      showToast(error?.message || 'Hesap silinirken bir hata oluştu.', 'error');
    }
  };

  const clearCacheOptions: ActionSheetOption[] = [
    {
      id: 'clear',
      title: 'Önbelleği Temizle',
      subtitle: 'Geçici video segmentleri ve arama geçmişi silinecektir.',
      icon: 'trash',
      destructive: true,
      onPress: handleClearCache,
    },
  ];

  const signOutOptions: ActionSheetOption[] = [
    {
      id: 'signout',
      title: 'Hesaptan Çıkış Yap',
      subtitle: 'Favoriler ve abonelikler hesabınızda kalacaktır.',
      icon: 'log-out',
      destructive: true,
      onPress: handleSignOutConfirm,
    },
  ];

  const deleteAccountOptions: ActionSheetOption[] = [
    {
      id: 'delete-account',
      title: 'Hesabı Kalıcı Olarak Sil',
      subtitle: 'Hesap, profil, favoriler, geçmiş, abonelikler ve oynatma listeleri geri alınamaz biçimde silinir.',
      icon: 'trash',
      destructive: true,
      onPress: handleDeleteAccountConfirm,
    },
  ];

  const qualityOptions: ActionSheetOption[] = qualities.map((q) => ({
    id: q,
    title: q === 'Auto' ? 'Otomatik (Önerilen)' : q,
    subtitle: q === '2160p' ? '4K Ultra HD' : q === '1440p' ? '2K' : q === '1080p' ? 'Full HD' : q === '720p' ? 'HD' : q === 'Auto' ? 'Ağ hızına göre' : 'Veri tasarrufu',
    icon: defaultQuality === q ? 'checkmark-circle' : 'ellipse-outline',
    iconColor: defaultQuality === q ? THEME.colors.primary : THEME.colors.textTertiary,
    onPress: () => {
      setDefaultQuality(q);
      showToast(`Varsayılan kalite: ${q}`, 'info');
    },
  }));

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      {/* Header */}
      <View style={[styles.navBar, { borderBottomColor: colors.divider || 'rgba(255,255,255,0.06)' }]}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={26} color={THEME.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Ayarlar</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView style={styles.scrollContent} contentContainerStyle={{ paddingBottom: 80, width: landscape ? Math.min(width - 48, 760) : '100%', alignSelf: 'center' }}>
        {/* Tuben PRO Banner */}
        <View style={[styles.proBanner, { backgroundColor: colors.surfaceElevated, borderColor: colors.borderLight }]}>
          <View style={styles.proHeader}>
            <View style={styles.proBadge}>
              <Text style={styles.proBadgeText}>PRO AKTİF</Text>
            </View>
            <Ionicons name="shield-checkmark" size={22} color={THEME.colors.primary} />
          </View>
          <Text style={styles.proTitle}>Tuben Kesintisiz Deneyim</Text>
          <Text style={styles.proSubtitle}>
            Tüm video reklamları engellendi, SponsorBlock ve arka planda oynatma devrede.
          </Text>
        </View>

        {/* Section: YouTube Senkronizasyonu */}
        <Text style={styles.sectionHeader}>YOUTUBE SENKRONİZASYONU</Text>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
          <TouchableOpacity
            style={styles.clickableRow}
            activeOpacity={0.7}
            onPress={() => {
              Haptics.selection();
              setShowYouTubeSyncModal(true);
            }}
          >
            <View style={[styles.iconWrap, { backgroundColor: 'rgba(255, 0, 51, 0.12)' }]}>
              <Ionicons name="logo-youtube" size={18} color="#FF0033" />
            </View>
            <View style={styles.rowInfo}>
              <Text style={styles.rowTitle}>YouTube ile Eşitle</Text>
              <Text style={styles.rowSubtitle}>
                {isYouTubeSynced
                  ? 'YouTube hesabınız bağlı • Akışları kontrol etmek için dokunun'
                  : 'Ana sayfanızı ve önerilen videoları YouTube ile senkronize edin'}
              </Text>
            </View>
            {isYouTubeSynced ? (
              <View style={styles.syncedBadge}>
                <Ionicons name="checkmark-circle" size={14} color="#10B981" style={{ marginRight: 4 }} />
                <Text style={styles.syncedBadgeText}>Aktif</Text>
              </View>
            ) : (
              <Ionicons name="chevron-forward" size={18} color={THEME.colors.textTertiary} />
            )}
          </TouchableOpacity>
        </View>

        {/* Section: Görünüm & Tema */}
        <Text style={styles.sectionHeader}>GÖRÜNÜM & TEMA</Text>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
          <View style={styles.row}>
            <View style={[styles.iconWrap, { backgroundColor: 'rgba(56, 189, 248, 0.12)' }]}>
              <Ionicons name="contrast" size={18} color="#38BDF8" />
            </View>
            <View style={styles.rowInfo}>
              <Text style={styles.rowTitle}>Gerçek AMOLED Siyahı</Text>
              <Text style={styles.rowSubtitle}>OLED ekranlar için gerçek siyah arka plan ve pil tasarrufu</Text>
            </View>
            <Switch
              value={isAmoled}
              onValueChange={() => {
                Haptics.selection();
                toggleAmoled();
                showToast(!isAmoled ? 'AMOLED modu devrede' : 'Karanlık tema aktif', 'info');
              }}
              trackColor={{ false: colors.surfaceElevated, true: THEME.colors.primary }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {/* Section: Oynatma & Akış */}
        <Text style={styles.sectionHeader}>OYNATMA & AKIŞ</Text>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
          <View style={styles.row}>
            <View style={[styles.iconWrap, { backgroundColor: 'rgba(16, 185, 129, 0.12)' }]}>
              <Ionicons name="headset-outline" size={18} color="#10B981" />
            </View>
            <View style={styles.rowInfo}>
              <Text style={styles.rowTitle}>Arka Planda Oynatma</Text>
              <Text style={styles.rowSubtitle}>Uygulamadan çıksanız bile ses çalmaya devam eder</Text>
            </View>
            <Switch
              value={backgroundPlayback}
              onValueChange={(val) => {
                Haptics.selection();
                setBackgroundPlayback(val);
              }}
              trackColor={{ false: colors.surfaceElevated, true: THEME.colors.primary }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={[styles.divider, { backgroundColor: colors.divider }]} />

          <View style={styles.row}>
            <View style={[styles.iconWrap, { backgroundColor: 'rgba(245, 158, 11, 0.12)' }]}>
              <Ionicons name="play-skip-forward-outline" size={18} color="#F59E0B" />
            </View>
            <View style={styles.rowInfo}>
              <Text style={styles.rowTitle}>Otomatik Sıradaki Video</Text>
              <Text style={styles.rowSubtitle}>Video bittiğinde sıradaki videoya otomatik geç</Text>
            </View>
            <Switch
              value={autoPlayNext}
              onValueChange={(val) => {
                Haptics.selection();
                setAutoPlayNext(val);
              }}
              trackColor={{ false: colors.surfaceElevated, true: THEME.colors.primary }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={[styles.divider, { backgroundColor: colors.divider }]} />

          <TouchableOpacity
            style={styles.clickableRow}
            activeOpacity={0.7}
            onPress={() => setShowQualitySheet(true)}
          >
            <View style={[styles.iconWrap, { backgroundColor: 'rgba(239, 68, 68, 0.12)' }]}>
              <Ionicons name="videocam-outline" size={18} color={THEME.colors.primary} />
            </View>
            <View style={styles.rowInfo}>
              <Text style={styles.rowTitle}>Varsayılan Kalite</Text>
              <Text style={styles.rowSubtitle}>{defaultQuality}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={THEME.colors.textTertiary} />
          </TouchableOpacity>
        </View>

        <View style={{ padding: 16, marginVertical: 12, backgroundColor: colors.surfaceElevated, borderRadius: 16 }}>
          <Text style={{ color: 'white', fontSize: 16, fontWeight: '700', marginBottom: 14 }}>Öneri tercihleri</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}><Text style={{ color: '#ddd', flex: 1 }}>İzlenen videoları önerilerden gizle</Text><Switch value={preferences.hideWatched} onValueChange={preferences.setHideWatched} /></View>
          <TouchableOpacity onPress={() => { preferences.reset(); showToast('Öneri tercihleri sıfırlandı', 'info'); }} style={{ paddingVertical: 16 }}><Text style={{ color: THEME.colors.primary }}>Gizlenen {preferences.hiddenVideos.length} video ve {preferences.blockedChannels.length} kanalı sıfırla</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Diagnostics')}><Text style={{ color: '#ddd' }}>Oynatma hata kayıtları →</Text></TouchableOpacity>
        </View>
        {/* Section: SponsorBlock */}
        <Text style={styles.sectionHeader}>SPONSORBLOCK ENTEGRASYONU</Text>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
          <View style={styles.row}>
            <View style={[styles.iconWrap, { backgroundColor: 'rgba(255, 0, 51, 0.12)' }]}>
              <Ionicons name="shield-outline" size={18} color={THEME.colors.primary} />
            </View>
            <View style={styles.rowInfo}>
              <Text style={styles.rowTitle}>Sponsorları Otomatik Atla</Text>
              <Text style={styles.rowSubtitle}>Videolardaki ücretli tanıtım bölümlerini atlar</Text>
            </View>
            <Switch
              value={sponsorBlockEnabled}
              onValueChange={(val) => {
                Haptics.selection();
                setSponsorBlockEnabled(val);
              }}
              trackColor={{ false: colors.surfaceElevated, true: THEME.colors.primary }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={[styles.divider, { backgroundColor: colors.divider }]} />

          <View style={styles.row}>
            <View style={[styles.iconWrap, { backgroundColor: 'rgba(255, 0, 51, 0.12)' }]}>
              <Ionicons name="cut-outline" size={18} color={THEME.colors.primary} />
            </View>
            <View style={styles.rowInfo}>
              <Text style={styles.rowTitle}>Giriş ve Çıkışları Atla</Text>
              <Text style={styles.rowSubtitle}>İntro ve outro jeneriklerini otomatik atlar</Text>
            </View>
            <Switch
              value={skipIntros}
              onValueChange={(val) => {
                Haptics.selection();
                setSkipIntros(val);
              }}
              trackColor={{ false: colors.surfaceElevated, true: THEME.colors.primary }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={[styles.divider, { backgroundColor: colors.divider }]} />

          <View style={styles.row}>
            <View style={[styles.iconWrap, { backgroundColor: 'rgba(255, 0, 51, 0.12)' }]}>
              <Ionicons name="megaphone-outline" size={18} color={THEME.colors.primary} />
            </View>
            <View style={styles.rowInfo}>
              <Text style={styles.rowTitle}>Kendi Tanıtımlarını Atla</Text>
              <Text style={styles.rowSubtitle}>Sosyal medya ve abone olma hatırlatmaları</Text>
            </View>
            <Switch
              value={skipSelfPromo}
              onValueChange={(val) => {
                Haptics.selection();
                setSkipSelfPromo(val);
              }}
              trackColor={{ false: colors.surfaceElevated, true: THEME.colors.primary }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {/* Section: Depolama & Önbellek */}
        <Text style={styles.sectionHeader}>DEPOLAMA & SİSTEM</Text>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
          <TouchableOpacity
            style={styles.clickableRow}
            activeOpacity={0.7}
            onPress={() => setShowClearCacheSheet(true)}
          >
            <View style={[styles.iconWrap, { backgroundColor: 'rgba(255, 255, 255, 0.08)' }]}>
              <Ionicons name="trash-outline" size={18} color={THEME.colors.textPrimary} />
            </View>
            <View style={styles.rowInfo}>
              <Text style={styles.rowTitle}>Önbelleği Temizle</Text>
              <Text style={styles.rowSubtitle}>Geçici video parçalarını ve belleği boşalt</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={THEME.colors.textTertiary} />
          </TouchableOpacity>
        </View>

        {/* Section: Hesap & Oturum */}
        {user && (
          <>
            <Text style={styles.sectionHeader}>HESAP</Text>
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
              <TouchableOpacity
                style={styles.clickableRow}
                activeOpacity={0.7}
                onPress={() => setShowSignOutSheet(true)}
              >
                <View style={[styles.iconWrap, { backgroundColor: 'rgba(239, 68, 68, 0.12)' }]}>
                  <Ionicons name="log-out-outline" size={18} color={THEME.colors.error} />
                </View>
                <View style={styles.rowInfo}>
                  <Text style={[styles.rowTitle, { color: THEME.colors.error }]}>Çıkış Yap</Text>
                  <Text style={styles.rowSubtitle}>{user.email || 'Misafir Kullanıcı'}</Text>
                </View>
              </TouchableOpacity>
              <View style={[styles.divider, { backgroundColor: colors.divider }]} />
              <TouchableOpacity
                style={styles.clickableRow}
                activeOpacity={0.7}
                onPress={() => setShowDeleteAccountSheet(true)}
                accessibilityRole="button"
                accessibilityLabel="Hesabı ve verileri sil"
              >
                <View style={[styles.iconWrap, { backgroundColor: 'rgba(239, 68, 68, 0.12)' }]}>
                  <Ionicons name="trash-outline" size={18} color={THEME.colors.error} />
                </View>
                <View style={styles.rowInfo}>
                  <Text style={[styles.rowTitle, { color: THEME.colors.error }]}>Hesabı ve Verileri Sil</Text>
                  <Text style={styles.rowSubtitle}>Bu işlem kalıcıdır ve geri alınamaz</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={THEME.colors.textTertiary} />
              </TouchableOpacity>
            </View>
          </>
        )}

        <View style={styles.appInfo}>
          <Text style={styles.appInfoText}>Tuben Mobil v1.0.0</Text>
          <Text style={styles.appInfoSubText}>Modern & Reklamsız Video İstemcisi</Text>
        </View>
      </ScrollView>

      {/* Sheets */}
      <ActionSheet
        visible={showClearCacheSheet}
        title="Önbelleği Temizle"
        options={clearCacheOptions}
        onClose={() => setShowClearCacheSheet(false)}
      />

      <ActionSheet
        visible={showSignOutSheet}
        title="Çıkış Yap"
        options={signOutOptions}
        onClose={() => setShowSignOutSheet(false)}
      />

      <ActionSheet
        visible={showDeleteAccountSheet}
        title="Hesabı ve Verileri Sil"
        subtitle="Devam ettiğinizde Tuben hesabınız ve ilişkili bulut verileriniz kalıcı olarak silinir."
        options={deleteAccountOptions}
        onClose={() => setShowDeleteAccountSheet(false)}
      />

      <ActionSheet
        visible={showQualitySheet}
        title="Varsayılan Video Kalitesi"
        options={qualityOptions}
        onClose={() => setShowQualitySheet(false)}
      />

      <YouTubeSyncModal
        visible={showYouTubeSyncModal}
        onClose={() => setShowYouTubeSyncModal(false)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  navBar: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    borderBottomWidth: 1,
  },
  iconBtn: {
    padding: 6,
  },
  navTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  scrollContent: {
    paddingHorizontal: 14,
    paddingTop: 12,
  },
  proBanner: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 20,
  },
  proHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  proBadge: {
    backgroundColor: 'rgba(255, 0, 51, 0.14)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 0, 51, 0.3)',
  },
  proBadgeText: {
    color: THEME.colors.primary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  proTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    marginBottom: 4,
  },
  proSubtitle: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
    lineHeight: 18,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.textTertiary,
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  clickableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rowInfo: {
    flex: 1,
    paddingRight: 10,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
    marginBottom: 2,
  },
  rowSubtitle: {
    fontSize: 12,
    color: THEME.colors.textTertiary,
    lineHeight: 16,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 58,
  },
  appInfo: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  appInfoText: {
    color: THEME.colors.textTertiary,
    fontSize: 12,
    fontWeight: '600',
  },
  appInfoSubText: {
    color: THEME.colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  syncedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  syncedBadgeText: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '700',
  },
});
