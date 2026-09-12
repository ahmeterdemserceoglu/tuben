import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  SectionList,
  TextInput,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLibraryStore } from '../store/useLibraryStore';
import { useAuth } from '../auth/AuthContext';
import { WatchHistoryItem } from '../types/user';
import { THEME } from '../constants/theme';
import { useThemeStore } from '../store/useThemeStore';
import { usePlayerStore } from '../store/usePlayerStore';
import { ActionSheet, ActionSheetOption } from '../components/common/ActionSheet';
import { EmptyState } from '../components/common/EmptyState';
import { useToastStore } from '../store/useToastStore';
import { Haptics } from '../utils/haptics';

export const HistoryScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const colors = useThemeStore((s) => s.colors);
  const { history, removeFromHistory, clearHistory } = useLibraryStore();
  const { user } = useAuth();
  const { showToast } = useToastStore();
  const [filterQuery, setFilterQuery] = useState('');
  const [showClearSheet, setShowClearSheet] = useState(false);

  const filteredHistory = useMemo(() => {
    return history.filter(
      (item) =>
        item.title.toLowerCase().includes(filterQuery.toLowerCase()) ||
        (item.channelTitle || '').toLowerCase().includes(filterQuery.toLowerCase())
    );
  }, [history, filterQuery]);

  // Group by Date: Bugün, Dün, Bu Hafta, Daha Eski
  const groupedSections = useMemo(() => {
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    const today: WatchHistoryItem[] = [];
    const yesterday: WatchHistoryItem[] = [];
    const thisWeek: WatchHistoryItem[] = [];
    const older: WatchHistoryItem[] = [];

    filteredHistory.forEach((item) => {
      const diff = now - (item.watchedAt || now);
      if (diff < oneDay) {
        today.push(item);
      } else if (diff < 2 * oneDay) {
        yesterday.push(item);
      } else if (diff < 7 * oneDay) {
        thisWeek.push(item);
      } else {
        older.push(item);
      }
    });

    const sections = [];
    if (today.length > 0) sections.push({ title: 'Bugün', data: today });
    if (yesterday.length > 0) sections.push({ title: 'Dün', data: yesterday });
    if (thisWeek.length > 0) sections.push({ title: 'Bu Hafta', data: thisWeek });
    if (older.length > 0) sections.push({ title: 'Daha Eski', data: older });

    return sections;
  }, [filteredHistory]);

  const handlePlayVideo = (item: WatchHistoryItem) => {
    Haptics.selection();
    usePlayerStore.getState().loadAndPlay({
      id: item.videoId,
      title: item.title,
      uploaderName: item.channelTitle,
      thumbnailUrl: item.thumbnailUrl,
      duration: item.duration,
      viewCount: 0,
    });
    usePlayerStore.getState().setMinimized(false);
  };

  const handleClearConfirm = async () => {
    await clearHistory(user?.uid);
    showToast('İzleme geçmişi temizlendi', 'info');
  };

  const clearOptions: ActionSheetOption[] = [
    {
      id: 'clear',
      title: 'Geçmişi Tamamen Temizle',
      subtitle: 'Tüm izleme kayıtlarınız silinir ve geri alınamaz.',
      icon: 'trash',
      destructive: true,
      onPress: handleClearConfirm,
    },
  ];

  const formatDuration = (seconds: number) => {
    if (!seconds) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      {/* Header */}
      <View style={[styles.navBar, { borderBottomColor: colors.divider || 'rgba(255,255,255,0.06)' }]}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={26} color={THEME.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>İzleme Geçmişi</Text>
        {history.length > 0 ? (
          <TouchableOpacity style={styles.iconBtn} onPress={() => setShowClearSheet(true)}>
            <Ionicons name="trash-outline" size={22} color={THEME.colors.error} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 38 }} />
        )}
      </View>

      {/* Search in History */}
      {history.length > 0 && (
        <View style={styles.searchWrap}>
          <View style={[styles.searchBox, { backgroundColor: colors.surfaceElevated }]}>
            <Ionicons name="search-outline" size={16} color={THEME.colors.textTertiary} style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Geçmişte ara..."
              placeholderTextColor={THEME.colors.textTertiary}
              value={filterQuery}
              onChangeText={setFilterQuery}
              returnKeyType="search"
            />
            {filterQuery.length > 0 && (
              <TouchableOpacity onPress={() => setFilterQuery('')}>
                <Ionicons name="close-circle" size={17} color={THEME.colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* Grouped SectionList */}
      {history.length === 0 ? (
        <EmptyState
          icon="time-outline"
          title="İzleme Geçmişi Boş"
          description="İzlediğiniz videolar burada listelenir. Videolara kaldığınız yerden devam edebilirsiniz."
          actionLabel="Video İzle"
          onAction={() => navigation.navigate('Home')}
        />
      ) : groupedSections.length === 0 ? (
        <EmptyState
          icon="search"
          title="Eşleşme Yok"
          description={`"${filterQuery}" aramasına ait video bulunamadı.`}
          actionLabel="Filtreyi Temizle"
          onAction={() => setFilterQuery('')}
        />
      ) : (
        <SectionList
          sections={groupedSections}
          keyExtractor={(item, index) => `${item.videoId}_${index}`}
          renderSectionHeader={({ section: { title } }) => (
            <View style={[styles.sectionHeaderWrap, { backgroundColor: colors.background }]}>
              <Text style={styles.sectionHeaderTitle}>{title}</Text>
            </View>
          )}
          renderItem={({ item }) => {
            const progressPercent =
              item.duration > 0
                ? Math.min(100, Math.round((item.lastPosition / item.duration) * 100))
                : 0;

            return (
              <TouchableOpacity
                style={[styles.rowCard, { backgroundColor: colors.surface }]}
                activeOpacity={0.85}
                onPress={() => handlePlayVideo(item)}
              >
                {/* Thumbnail Container with Progress bar */}
                <View style={styles.thumbWrapper}>
                  <Image source={{ uri: item.thumbnailUrl }} style={styles.thumbnail} resizeMode="cover" />
                  {item.duration > 0 && (
                    <View style={styles.timeBadge}>
                      <Text style={styles.timeBadgeText}>{formatDuration(item.duration)}</Text>
                    </View>
                  )}
                  {progressPercent > 0 && (
                    <View style={styles.progressBarBg}>
                      <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
                    </View>
                  )}
                </View>

                {/* Info Text */}
                <View style={styles.infoWrapper}>
                  <Text style={styles.videoTitle} numberOfLines={2}>
                    {item.title}
                  </Text>
                  <Text style={styles.channelTitle} numberOfLines={1}>
                    {item.channelTitle}
                  </Text>
                </View>

                {/* Remove single item button */}
                <TouchableOpacity
                  style={styles.deleteBtn}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  onPress={() => {
                    Haptics.selection();
                    void removeFromHistory(user?.uid, item.videoId);
                  }}
                >
                  <Ionicons name="close" size={18} color={THEME.colors.textTertiary} />
                </TouchableOpacity>
              </TouchableOpacity>
            );
          }}
          contentContainerStyle={{ paddingBottom: 80 }}
        />
      )}

      {/* Clear History Sheet */}
      <ActionSheet
        visible={showClearSheet}
        title="Geçmişi Temizle"
        options={clearOptions}
        onClose={() => setShowClearSheet(false)}
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
  searchWrap: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 38,
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 13,
    paddingVertical: 0,
  },
  sectionHeaderWrap: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 6,
  },
  sectionHeaderTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.primary,
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
    marginBottom: 8,
    padding: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  thumbWrapper: {
    width: 110,
    height: 64,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#000000',
    position: 'relative',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  timeBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  timeBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
  },
  progressBarBg: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: THEME.colors.primary,
  },
  infoWrapper: {
    flex: 1,
    marginLeft: 10,
    justifyContent: 'center',
  },
  videoTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
    lineHeight: 18,
    marginBottom: 3,
  },
  channelTitle: {
    fontSize: 11,
    color: THEME.colors.textSecondary,
  },
  deleteBtn: {
    padding: 6,
  },
});
