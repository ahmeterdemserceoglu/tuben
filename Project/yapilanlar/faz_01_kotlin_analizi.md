# FAZ 1: Full Kotlin Analysis (E:\tubentrailer)

**Kaynak Proje:** `E:\tubentrailer` (PlayTube - `com.arslandaim.playtube`)  
**Tarih:** 11 Eylül 2026  
**Durum:** Tamamlandı

---

## 1. Genel Mimari ve Bağımlılıklar
- **Mimari:** Clean Architecture (Domain - Data - UI/Presentation)
- **Framework:** Jetpack Compose (Material 3), Navigation Compose
- **DI:** Hilt (Dagger)
- **Local DB:** Room Database (`PlayTubeDatabase`: History, Favorites, Subscriptions, Playlists, Downloads, Blacklist, UserInterests, FeedCache, SearchHistory)
- **Storage/Prefs:** DataStore Preferences (`PreferencesManager`)
- **Player/Medya:** Media3 ExoPlayer (HLS, DASH, OkHttpDataSource, MediaSessionService `PlaybackService`, Audio Becoming Noisy, Background Playback, PiP)
- **YouTube Veri Çekme:** NewPipe Extractor (`org.schabi.newpipe.extractor`), Piped / InnerTube fallback
- **SponsorBlock:** `SponsorBlockRepositoryImpl` (Segment atlama)
- **Background Jobs:** WorkManager (`DownloadWorker`, `ImportWorker`)

---

## 2. Domain & Model Katmanı
| Model | Tanım | Yeni Mimari Karşılığı (TypeScript) |
|---|---|---|
| `VideoItem` | Video kartı (id, title, uploader, views, duration, thumbnail, isLive) | `src/types/video.ts` |
| `StreamBundle` | Çözümlenmiş video/ses akışları, metadata, related videolar, altyazılar | `src/types/player.ts` |
| `StreamItem` | Tekil video/ses akış linki, kalite (`1080p`, `720p`), format, codec | `src/types/player.ts` |
| `ChannelDetails` | Kanal profili, banner, abone sayısı, videolar, shorts, playlistler | `src/types/channel.ts` |
| `PlaylistDetails` | Oynatma listesi başlığı, yazar, video listesi | `src/types/playlist.ts` |
| `CommentItem` | Yorum yazarı, metin, beğeni sayısı, yanıtlar, sabitlenmiş durum | `src/types/comment.ts` |
| `SponsorSegment` | SponsorBlock segmentleri (başlangıç/bitiş saniyesi, kategori) | `src/types/sponsor.ts` |
| `NeuroDiscovery` | İlgi alanlarına göre yerel öneri motoru (vector/topic scoring) | `src/services/recommendationService.ts` |

---

## 3. Ekranlar (UI & Navigation)
1. **HomeScreen (`ui/screens/home`):**
   - Trend videolar (KioskInfo / Trending)
   - Kategori etiketleri (Tümü, Müzik, Oyun, Haberler vb.)
   - Önerilen videolar akışı (Sayfalama ve sonsuz kaydırma)
2. **SearchScreen (`ui/screens/search`):**
   - Anlık arama önerileri (`SearchSuggestionProvider`)
   - Son aramalar geçmişi (`SearchHistoryDao`)
   - Video, Kanal ve Oynatma Listesi filtreleme
3. **ChannelScreen (`ui/screens/channel`):**
   - Kanal banner ve avatarı
   - Abone ol / Abonelikten çık durumu
   - Sekmeler: Videolar, Shorts, Oynatma Listeleri, Hakkında
4. **PlayerScreen & MiniPlayer (`ui/screens/player`):**
   - Tam ekran ve kayan mini oynatıcı (In-app PiP ve Android Native PiP)
   - Çift dokunma ile 10s ileri/geri sarma, dikey kaydırma ile parlaklık/ses jestleri
   - Kalite seçici, oynatma hızı seçici, uyku zamanlayıcısı
   - Altyazılar, SponsorBlock otomatik atlama, yorumlar paneli
5. **SubscriptionsScreen (`ui/screens/subscriptions`):**
   - Takip edilen kanalların üst hikaye avatar çubuğu
   - Kronolojik karma video akışı
6. **LibraryScreen (`ui/screens/library`):**
   - İzleme Geçmişi (History)
   - Beğenilen Videolar (Liked Videos / Favorites)
   - Özel Oynatma Listeleri (Custom Playlists)
   - İndirilenler (Offline Downloads)
7. **SettingsScreen (`ui/screens/settings`):**
   - Koyu/Açık tema, dil seçimi, SponsorBlock ayarları, veri dışa/içe aktarma

---

## 4. Servisler ve Arka Plan (Services & Background)
- **`PlaybackService`:** Media3 `MediaSessionService`. Kilit ekranı kontrolleri, bildirim çubuğu medya kontrolleri, kulaklık tuşları (`ACTION_MEDIA_BUTTON`).
- **`VideoDownloadService` & `DownloadWorker`:** Çok parçalı paralel indirme (`ParallelDownloader`), indirme duraklatma/devam ettirme ve yerel dosya yönetimi.

---
**[x] BURAYA KADAR YAPILDI: FAZ 1 TAMAMLANDI**
