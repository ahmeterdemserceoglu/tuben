import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Modal, TouchableOpacity, FlatList, Image, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { YouTubeExploreService } from '../services/youtubeExploreService';
import { CommentItem } from '../types/comment';
import { THEME } from '../constants/theme';
export const CommentsSheet: React.FC<{ visible: boolean; videoId: string; channelId?: string; onClose: () => void }> = ({ visible, videoId, channelId, onClose }) => {
  const { height, width } = useWindowDimensions(), insets = useSafeAreaInsets();
  const [items, setItems] = useState<CommentItem[]>([]), [token, setToken] = useState<string>();
  const [sortTokens, setSortTokens] = useState<{ top?: string; newest?: string }>({});
  const [sort, setSort] = useState<'top' | 'newest'>('top'), [loading, setLoading] = useState(false), [error, setError] = useState('');
  const [replyTo, setReplyTo] = useState<CommentItem>(), [draft, setDraft] = useState(''), [sending, setSending] = useState(false);
  const [replies, setReplies] = useState<Record<string, CommentItem[]>>({}), [replyTokens, setReplyTokens] = useState<Record<string, string | undefined>>({});
  const [replyLoading, setReplyLoading] = useState<string>();
  const generation = useRef(0), paging = useRef(false), sendingRef = useRef(false);
  const load = async (continuation?: string, append = false) => {
    if (paging.current) return;
    const id = generation.current; paging.current = true; setLoading(true); setError('');
    try { const page = await YouTubeExploreService.comments(videoId, continuation); if (id !== generation.current) return;
      setItems(prev => { const old = append ? prev : [], keys = new Set(old.map(x => x.id)); return [...old, ...page.items.filter(x => !keys.has(x.id))]; }); setToken(page.continuation);
      if (page.sortTokens?.top || page.sortTokens?.newest) setSortTokens(page.sortTokens);
    } catch (e) { if (id === generation.current) setError(e instanceof Error ? e.message : 'Yorumlar yüklenemedi.'); }
    finally { if (id === generation.current) { paging.current = false; setLoading(false); } }
  };
  useEffect(() => { generation.current++; paging.current = false; setItems([]); setToken(undefined); setSortTokens({}); setSort('top'); setReplies({}); setReplyTokens({}); setReplyTo(undefined); setReplyLoading(undefined); setDraft(''); setLoading(false); if (visible) void load(); return () => { generation.current++; }; }, [visible, videoId]);
  const loadReplies = async (item: CommentItem) => {
    const continuation = replyTokens[item.id] || item.repliesToken;
    if (!continuation || replyLoading) return;
    const id = generation.current; setReplyLoading(item.id);
    try { const page = await YouTubeExploreService.comments(videoId, continuation); if (id !== generation.current) return; setReplies(prev => { const old = prev[item.id] || [], ids = new Set(old.map(x => x.id)); return { ...prev, [item.id]: [...old, ...page.items.filter(x => !ids.has(x.id))] }; }); setReplyTokens(prev => ({ ...prev, [item.id]: page.continuation })); }
    catch { if (id === generation.current) setError('Yanıtlar yüklenemedi.'); }
    finally { if (id === generation.current) setReplyLoading(undefined); }
  };
  const send = async () => {
    if (!draft.trim() || sendingRef.current) return;
    const id = generation.current; sendingRef.current = true; setSending(true); setError('');
    try { await YouTubeExploreService.postComment(videoId, channelId || '', draft.trim(), replyTo?.id); if (id !== generation.current) return; setDraft(''); setReplyTo(undefined); setSort('top'); await load(); }
    catch (e) { if (id === generation.current) setError(e instanceof Error ? e.message : 'Yorum gönderilemedi.'); }
    finally { sendingRef.current = false; setSending(false); }
  };
  const renderComment = (item: CommentItem, nested = false) => <View key={item.id} style={{ flexDirection: 'row', gap: 10, paddingVertical: 12, paddingLeft: nested ? 40 : 0 }}>
    <Image source={{ uri: item.authorThumbnail || 'https://www.gstatic.com/youtube/img/creator/avatar/default_avatar.png' }} style={{ width: nested ? 26 : 34, height: nested ? 26 : 34, borderRadius: 17 }} />
    <View style={{ flex: 1 }}><Text style={{ color: '#aaa', fontSize: 12 }}>{item.authorName} · {item.uploadDate}</Text><Text selectable style={{ color: 'white', marginVertical: 8, lineHeight: 21 }}>{item.commentText}</Text>
      <View style={{ flexDirection: 'row', gap: 20 }}><Text style={{ color: '#aaa' }}>♡ {item.likeCount}</Text><TouchableOpacity onPress={() => setReplyTo(item)}><Text style={{ color: '#aaa' }}>Yanıtla</Text></TouchableOpacity></View>
      {!nested && item.repliesToken && (!replies[item.id] || replyTokens[item.id]) && <TouchableOpacity onPress={() => loadReplies(item)} style={{ paddingTop: 14 }}><Text style={{ color: '#70b4ff' }}>{replyLoading === item.id ? 'Yanıtlar yükleniyor…' : replies[item.id] ? 'Diğer yanıtları göster' : `${item.repliesCount || ''} yanıtı göster`}</Text></TouchableOpacity>}
    </View>
  </View>;
  return <Modal visible={visible} transparent animationType="slide" statusBarTranslucent navigationBarTranslucent supportedOrientations={['portrait', 'landscape']} onRequestClose={onClose}>
    <View style={{ flex: 1, justifyContent: 'flex-end' }}><TouchableOpacity style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Yorumları kapat" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ height: height * (width > height ? 0.94 : 0.78), backgroundColor: '#111116', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 16, paddingBottom: Math.max(12, insets.bottom) }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 18 }}><Text style={{ color: 'white', fontWeight: '700', fontSize: 18 }}>Yorumlar</Text><TouchableOpacity onPress={onClose}><Text style={{ color: 'white', fontSize: 20 }}>✕</Text></TouchableOpacity></View>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>{(['top', 'newest'] as const).map(key => <TouchableOpacity key={key} disabled={!sortTokens[key] || loading} onPress={() => { setSort(key); void load(sortTokens[key]); }} style={{ backgroundColor: sort === key ? '#444' : '#24242a', borderRadius: 20, padding: 10 }}><Text style={{ color: 'white', opacity: sortTokens[key] ? 1 : 0.5 }}>{key === 'top' ? 'En beğenilen' : 'En yeni'}</Text></TouchableOpacity>)}</View>
        {!!error && <TouchableOpacity onPress={() => load(token, !!items.length)}><Text style={{ color: '#ff8f8f', paddingVertical: 8 }}>{error}</Text></TouchableOpacity>}
        <FlatList data={items} keyExtractor={x => x.id} renderItem={({ item }) => <View>{renderComment(item)}{(replies[item.id] || []).map(r => renderComment(r, true))}</View>} onEndReached={() => { if (token) void load(token, true); }} onEndReachedThreshold={0.4} ListEmptyComponent={loading ? <ActivityIndicator color={THEME.colors.primary} /> : <Text style={{ color: '#aaa', paddingVertical: 20 }}>Yorum bulunmuyor veya yorumlar kapalı.</Text>} ListFooterComponent={loading && items.length ? <ActivityIndicator color={THEME.colors.primary} /> : null} />
        {replyTo && <TouchableOpacity onPress={() => setReplyTo(undefined)}><Text style={{ color: '#70b4ff', padding: 6 }}>{replyTo.authorName} kullanıcısına yanıt · İptal</Text></TouchableOpacity>}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 1, borderTopColor: '#333', paddingTop: 8 }}><TextInput value={draft} onChangeText={setDraft} placeholder="YouTube’da yorum ekle…" placeholderTextColor="#888" multiline maxLength={10000} style={{ flex: 1, color: 'white', maxHeight: 80, padding: 10 }} /><TouchableOpacity disabled={sending || !draft.trim()} onPress={send}><Text style={{ color: draft.trim() ? '#70b4ff' : '#555' }}>{sending ? 'Gönderiliyor…' : 'Gönder'}</Text></TouchableOpacity></View>
      </KeyboardAvoidingView>
    </View>
  </Modal>;
};
