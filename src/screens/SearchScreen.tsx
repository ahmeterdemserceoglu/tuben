import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ScrollView,
  StatusBar,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { SuggestionService } from '../services/suggestionService';
import { YouTubeExploreService, SearchFilters, SearchKind, SearchResult } from '../services/youtubeExploreService';
import { VideoItem } from '../types/video';
import { VideoCard } from '../components/VideoCard';
import { VideoCardSkeleton } from '../components/common/Skeleton';
import { EmptyState } from '../components/common/EmptyState';
import { THEME } from '../constants/theme';
import { useThemeStore } from '../store/useThemeStore';
import { usePlayerStore } from '../store/usePlayerStore';
import { Haptics } from '../utils/haptics';

const SEARCH_FILTERS = [
  { id: 'all', label: 'Tümü' },
  { id: 'video', label: 'Videolar' },
  { id: 'shorts', label: 'Shorts' },
  { id: 'channel', label: 'Kanallar' },
  { id: 'playlist', label: 'Listeler' },
];

const RECENT_SEARCHES_KEY = 'tuben_recent_searches_v2';

export const SearchScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const colors = useThemeStore((s) => s.colors);
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<SearchKind>('all');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const requestId = useRef(0);
  const [filters, setFilters] = useState<SearchFilters>({ type: 'all' });
  const [showFilters, setShowFilters] = useState(false);
  const [continuation, setContinuation] = useState<string>();
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const searchedTerm = useRef('');
  const pageLoading = useRef(false);

  // Load recent searches
  useEffect(() => {
    AsyncStorage.getItem(RECENT_SEARCHES_KEY).then((data) => {
      if (data) {
        try {
          const parsed = JSON.parse(data);
          if (Array.isArray(parsed)) setRecentSearches(parsed.filter(x => typeof x === 'string')); 
        } catch {
          // Ignore
        }
      }
    }).catch(() => undefined);
    return () => { requestId.current++; };
  }, []);

  const saveRecentSearch = async (term: string) => {
    const trimmed = term.trim();
    if (!trimmed) return;
    const updated = [trimmed, ...recentSearches.filter((s) => s.toLowerCase() !== trimmed.toLowerCase())].slice(0, 10);
    setRecentSearches(updated);
    await AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
  };

  const removeRecentSearch = async (term: string) => {
    const updated = recentSearches.filter((s) => s !== term);
    setRecentSearches(updated);
    await AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
  };

  const clearRecentSearches = async () => {
    setRecentSearches([]);
    await AsyncStorage.removeItem(RECENT_SEARCHES_KEY);
  };

  useEffect(() => {
    if (query.trim().length > 1 && !hasSearched) {
      let active = true;
      const timer = setTimeout(async () => {
        const list = await SuggestionService.getSuggestions(query);
        if (active) setSuggestions(list);
      }, 180);
      return () => { active = false; clearTimeout(timer); };
    } else {
      setSuggestions([]);
    }
  }, [query, hasSearched]);

  const performSearch = async (searchTerm: string, nextFilters = filters) => {
    if (!searchTerm.trim()) return;
    const generation = ++requestId.current;
    searchedTerm.current = searchTerm.trim();
    setQuery(searchTerm); setHasSearched(true); setLoading(true); setError(''); setContinuation(undefined);
    setSuggestions([]); setResults([]); setLoadingMore(false); pageLoading.current = false;
    void saveRecentSearch(searchTerm).catch(() => undefined);
    try {
      const page = await YouTubeExploreService.search(searchTerm.trim(), nextFilters);
      if (generation === requestId.current) { setResults(page.items); setContinuation(page.continuation); }
    } catch (e) { if (generation === requestId.current) setError(e instanceof Error ? e.message : 'Arama yüklenemedi.'); }
    finally { if (generation === requestId.current) setLoading(false); }
  };
  const applyFilters = (patch: Partial<SearchFilters>) => {
    const next = { ...filters, ...patch, ...(patch.type === 'channel' || patch.type === 'playlist' ? { date: 0, duration: 0, resolution: 'any' as const } : {}) }; setFilters(next); setActiveFilter(next.type);
    void performSearch(searchedTerm.current || query, next);
  };
  const loadMore = async () => {
    if (!continuation || pageLoading.current || loading) return;
    const generation = requestId.current; pageLoading.current = true; setLoadingMore(true);
    try {
      const page = await YouTubeExploreService.search(searchedTerm.current, filters, continuation);
      if (generation !== requestId.current) return;
      setResults(previous => { const ids = new Set(previous.map(x => x.kind + x.item.id)); return [...previous, ...page.items.filter(x => !ids.has(x.kind + x.item.id))]; });
      setContinuation(page.continuation);
    } catch (e) { if (generation === requestId.current) setError('Devamı yüklenemedi. Tekrar dene.'); }
    finally { if (generation === requestId.current) { pageLoading.current = false; setLoadingMore(false); } }
  };
  const filterGroups = [
    { title: 'Yükleme tarihi', key: 'date', choices: [[0, 'Her zaman'], [2, 'Bugün'], [3, 'Bu hafta'], [4, 'Bu ay'], [5, 'Bu yıl']] },
    { title: 'Süre', key: 'duration', choices: [[0, 'Tümü'], [4, '3 dk altı'], [5, '3–20 dk'], [2, '20 dk üzeri']] },
    { title: 'Çözünürlük', key: 'resolution', choices: [['any', 'Tümü'], ['hd', 'HD'], ['4k', '4K']] },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      {/* Search Header */}
      <View style={[styles.headerRow, { borderBottomColor: colors.divider || 'rgba(255,255,255,0.06)' }]}>
        <TouchableOpacity
          style={styles.backBtn}
          activeOpacity={0.7}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={THEME.colors.textPrimary} />
        </TouchableOpacity>

        <View style={[styles.inputBox, { backgroundColor: colors.surfaceElevated || '#1B1B22' }]}>
          <Ionicons name="search" size={17} color={THEME.colors.textTertiary} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.input}
            placeholder="YouTube ve Tuben'de Ara..."
            placeholderTextColor={THEME.colors.textTertiary}
            value={query}
            onChangeText={(text) => {
              setQuery(text);
              setHasSearched(false);
            }}
            onSubmitEditing={() => performSearch(query)}
            autoFocus
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity
              style={styles.clearIcon}
              onPress={() => {
                setQuery('');
                setHasSearched(false);
                setResults([]);
              }}
            >
              <Ionicons name="close-circle" size={18} color={THEME.colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={[styles.searchAction, { backgroundColor: THEME.colors.primary }]}
          activeOpacity={0.8}
          onPress={() => performSearch(query)}
        >
          <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Filter Tabs when searched */}
      {hasSearched && (
        <View style={[styles.filterBar, { borderBottomColor: colors.divider || 'rgba(255,255,255,0.06)' }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
            {SEARCH_FILTERS.map((f) => {
              const isSelected = activeFilter === f.id;
              return (
                <TouchableOpacity
                  key={f.id}
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor: isSelected ? THEME.colors.primary : colors.surfaceElevated,
                      borderColor: isSelected ? THEME.colors.primary : colors.surfaceBorder || 'rgba(255,255,255,0.08)',
                    },
                  ]}
                  activeOpacity={0.8}
                  onPress={() => {
                    Haptics.selection();
                    applyFilters({ type: f.id as SearchKind });
                  }}
                >
                  <Text style={[styles.filterText, isSelected && styles.filterTextActive]}>
                    {f.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {hasSearched && <View>
        <TouchableOpacity style={{ padding: 12 }} onPress={() => setShowFilters(!showFilters)}><Text style={{ color: THEME.colors.textPrimary }}>☷ Filtreler {showFilters ? '▴' : '▾'}</Text></TouchableOpacity>
        {showFilters && activeFilter !== 'channel' && activeFilter !== 'playlist' && filterGroups.map(group => <View key={group.key} style={{ paddingHorizontal: 12, paddingBottom: 10 }}>
          <Text style={{ color: THEME.colors.textSecondary, marginBottom: 6 }}>{group.title}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>{group.choices.map(([value, label]) => <TouchableOpacity key={value} onPress={() => applyFilters({ [group.key]: value })} style={[styles.filterChip, { marginRight: 6, backgroundColor: (filters as any)[group.key] === value ? THEME.colors.primary : colors.surfaceElevated }]}><Text style={{ color: THEME.colors.textPrimary }}>{label}</Text></TouchableOpacity>)}</ScrollView>
        </View>)}
      </View>}
      {/* Recent Searches (shown before typing or searching) */}
      {!hasSearched && query.length <= 1 && recentSearches.length > 0 && (
        <View style={styles.recentSection}>
          <View style={styles.recentHeader}>
            <Text style={styles.recentTitle}>Son Aramalar</Text>
            <TouchableOpacity onPress={() => { void clearRecentSearches().catch(() => undefined); }}>
              <Text style={styles.recentClear}>Temizle</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.recentChipsWrap}>
            {recentSearches.map((term) => (
              <View key={term} style={[styles.recentChip, { backgroundColor: colors.surfaceElevated }]}>
                <TouchableOpacity
                  style={styles.recentChipTouch}
                  onPress={() => performSearch(term)}
                >
                  <Ionicons name="time-outline" size={14} color={THEME.colors.textTertiary} style={{ marginRight: 6 }} />
                  <Text style={styles.recentChipText} numberOfLines={1}>
                    {term}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.recentChipClose}
                  onPress={() => { void removeRecentSearch(term).catch(() => undefined); }}
                >
                  <Ionicons name="close" size={14} color={THEME.colors.textTertiary} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Suggestion Rows */}
      {suggestions.length > 0 && !hasSearched && (
        <FlatList
          data={suggestions}
          keyExtractor={(item) => item}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.suggestionRow}
              activeOpacity={0.7}
              onPress={() => performSearch(item)}
            >
              <Ionicons name="search-outline" size={18} color={THEME.colors.textTertiary} style={{ marginRight: 14 }} />
              <Text style={styles.suggestionText} numberOfLines={1}>
                {item}
              </Text>
              <TouchableOpacity
                style={styles.fillIcon}
                onPress={() => setQuery(item)}
              >
                <Ionicons name="arrow-up-outline" size={16} color={THEME.colors.textTertiary} />
              </TouchableOpacity>
            </TouchableOpacity>
          )}
        />
      )}

      {/* Loading Skeletons */}
      {loading && (
        <ScrollView style={{ flex: 1, paddingTop: 12 }}>
          <VideoCardSkeleton />
          <VideoCardSkeleton />
        </ScrollView>
      )}

      {/* Search Results */}
      {hasSearched && !loading && (
        <FlatList
          data={results}
          keyExtractor={(result) => `${result.kind}_${result.item.id}`}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          ListFooterComponent={loadingMore ? <ActivityIndicator color={THEME.colors.primary} /> : error ? <TouchableOpacity onPress={continuation ? loadMore : () => performSearch(query)} style={{ padding: 16 }}><Text style={{ color: THEME.colors.primary }}>{error} · Tekrar dene</Text></TouchableOpacity> : null}
          renderItem={({ item: result }) => {
            if (result.kind === 'video') return <VideoCard video={result.item} onPress={v => { void usePlayerStore.getState().playVideo(v, results.flatMap(x => x.kind === 'video' ? [x.item] : [])); }} onChannelPress={(channelName, channelId) => navigation.navigate('Channel', { channelId: channelId || channelName, channelName })} />;
            const item = result.item;
            return <TouchableOpacity style={{ flexDirection: 'row', padding: 16, gap: 16, alignItems: 'center' }} onPress={() => navigation.navigate(result.kind === 'channel' ? 'Channel' : 'Playlist', result.kind === 'channel' ? { channelId: item.id, channelName: (item as any).name } : { playlistId: item.id, title: (item as any).title })}>
              <Image source={{ uri: result.kind === 'channel' ? (item as any).avatarUrl : (item as any).thumbnailUrl }} style={{ width: 96, height: result.kind === 'channel' ? 96 : 60, borderRadius: result.kind === 'channel' ? 48 : 8, backgroundColor: colors.surfaceElevated }} />
              <View style={{ flex: 1 }}><Text style={{ color: THEME.colors.textPrimary, fontWeight: '700', fontSize: 16 }}>{result.kind === 'channel' ? (item as any).name : (item as any).title}</Text><Text style={{ color: THEME.colors.textSecondary, marginTop: 6 }}>{result.kind === 'channel' ? (item as any).subscriberCount || 'Kanal' : `${(item as any).videoCount || ''} video · Oynatma listesi`}</Text></View>
            </TouchableOpacity>;
          }}
          ListEmptyComponent={
            <EmptyState
              icon="search"
              title={error ? "Arama Yüklenemedi" : "Sonuç Bulunamadı"}
              description={error || `"${query}" için arama sonucu bulunamadı. Lütfen farklı kelimeler deneyin.`}
              actionLabel="Tekrar Ara"
              onAction={() => performSearch(query)}
            />
          }
          contentContainerStyle={{ paddingBottom: 80, paddingTop: 8 }}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 8,
  },
  backBtn: {
    padding: 6,
  },
  inputBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 42,
    borderRadius: 21,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  input: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    paddingVertical: 0,
  },
  clearIcon: {
    padding: 4,
  },
  searchAction: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBar: {
    borderBottomWidth: 1,
    paddingVertical: 8,
  },
  filterScroll: {
    paddingHorizontal: 12,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  filterText: {
    color: THEME.colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  filterTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  recentSection: {
    padding: 16,
  },
  recentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  recentTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  recentClear: {
    fontSize: 12,
    color: THEME.colors.primary,
    fontWeight: '600',
  },
  recentChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  recentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingLeft: 10,
    paddingRight: 6,
    paddingVertical: 5,
  },
  recentChipTouch: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recentChipText: {
    color: THEME.colors.textSecondary,
    fontSize: 12,
    fontWeight: '500',
    maxWidth: 160,
  },
  recentChipClose: {
    padding: 4,
    marginLeft: 4,
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  suggestionText: {
    flex: 1,
    color: THEME.colors.textPrimary,
    fontSize: 14,
    fontWeight: '500',
  },
  fillIcon: {
    padding: 4,
  },
});
