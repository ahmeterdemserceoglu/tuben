# FAZ 2: Screen + Backend + Native + Storage Mapping

**Tarih:** 11 Eylül 2026  
**Kaynak:** `E:\tubentrailer` (PlayTube) → **Hedef:** `E:\tuben` (Tuben)  
**Durum:** Tamamlandı

---

## 1. Ekran Eşleme Haritası (Screens)

| Kotlin Ekranı (Compose) | React Native (Expo) Karşılığı | Açıklama / Özellikler |
|---|---|---|
| `HomeScreen.kt` | `src/screens/HomeScreen.tsx` | Trendler (Trending), Kategori filtreleri, sonsuz sayfalama, yenileme (Pull-to-refresh) |
| `SearchScreen.kt` | `src/screens/SearchScreen.tsx` | Canlı arama önerileri, arama geçmişi, Video/Kanal/Shorts filtreleri |
| `ChannelScreen.kt` | `src/screens/ChannelScreen.tsx` | Kanal banner, avatar, abone butonu, Videolar/Shorts/Playlist sekmeleri |
| `PlaylistScreen.kt` | `src/screens/PlaylistScreen.tsx` | Liste başlığı, yazarı, tümünü oynat, karıştır, parçaları listele |
| `PlayerScreen.kt` | `src/screens/PlayerScreen.tsx` | Tam ekran ve kayan In-App mini oynatıcı, 10s atlama, parlaklık/ses jestleri, kalite ve hız hapı |
| `SubscriptionsScreen.kt` | `src/screens/SubscriptionsScreen.tsx` | Kanalların hikaye avatarları çubuğu, kronolojik video akışı |
| `LibraryScreen.kt` | `src/screens/LibraryScreen.tsx` | Geçmiş, Beğenilenler, Çevrimdışı İndirilenler, Özel Listeler |
| `HistoryScreen.kt` | `src/screens/HistoryScreen.tsx` | Kronolojik izleme geçmişi, son kalınan süre (resume), tek tek veya toplu temizleme |
| `DownloadsScreen.kt` | `src/screens/DownloadsScreen.tsx` | Çevrimdışı kaydedilen MP4 dosyaları, duraklat/devam et, boyut yönetimi |
| `SettingsScreen.kt` | `src/screens/SettingsScreen.tsx` | Lüks koyu tema, SponsorBlock yapılandırması, oynatıcı tercihleri |

---

## 2. Backend & API Eşleme Haritası

| Özellik | Kotlin Kaynağı | React Native Servisi | Çözüm Stratejisi |
|---|---|---|---|
| **Video Akış Çözücü** | `StreamInfo.getInfo` (NewPipe) | `src/services/youtubeService.ts` | YouTube InnerTube (iOS/Android VR) + Piped yedekli CDN akışı |
| **Trend & Besleme** | `KioskInfo.getInfo` | `src/services/youtubeService.ts` | YouTube InnerTube `browse` ve Trending akışları |
| **Kanal & Playlist** | `ChannelInfo` / `PlaylistInfo` | `src/services/youtubeService.ts` | InnerTube Channel / Playlist ayrıştırma |
| **Arama Önerileri** | `SearchSuggestionProvider` | `src/services/suggestionService.ts` | YouTube Suggest API (`suggestqueries.google.com`) |
| **SponsorBlock** | `SponsorBlockRepositoryImpl` | `src/services/sponsorBlockService.ts` | SponsorBlock REST API (`sponsor.ajay.app`) |

---

## 3. Native & Medya Katmanı Eşleme Haritası

| Kotlin Özelliği | Yeni Mimari Karşılığı | Entegrasyon Türü |
|---|---|---|
| Media3 ExoPlayer | `android/app/.../TubenStreamModule.kt` | Custom Native TurboModule |
| `PlaybackService` (MediaSession) | `TubenMediaSessionService.kt` | Android Foreground MediaPlayback Service |
| Picture-in-Picture (PiP) | `enterPictureInPictureMode` Native Bridge | Native Method |
| Gesture Brightness | `WindowManager.LayoutParams.screenBrightness` | Native Method |
| Gesture Volume | `AudioManager.STREAM_MUSIC` | Native Method |

---

## 4. Depolama ve Veri Ayrımı (Storage Map)

| Veri | Konum | Neden? |
|---|---|---|
| **Kullanıcı Kimliği & Oturum** | Firebase Authentication | Güvenli, kalıcı e-posta/şifre ve anonim oturum |
| **Kütüphane (Beğeniler, Listeler, Takip)** | Cloud Firestore (`users/{uid}/...`) | Cihazlar arası kalıcı senkronizasyon, Spark kotasına uygun düşük frekans |
| **Anlık Oda & Presence** | Realtime Database (`ephemeral/...`) | Yüksek frekanslı anlık durum, sıfır Firestore maliyeti |
| **Arama Geçmişi & Arayüz Ayarları** | AsyncStorage / Local Storage | Çevrimdışı anında erişim, sunucu kotası tüketmez |
| **İndirilen Videolar** | Expo FileSystem (`documentDirectory`) | Yerel depolama, internet bağlantısı olmadan tam oynatma |

---
**[x] BURAYA KADAR YAPILDI: FAZ 2 TAMAMLANDI**
