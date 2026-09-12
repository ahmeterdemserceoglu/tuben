# FAZ 3: Firebase Data Architecture (Veri Mimarisi ve Kota Optimizasyonu)

**Tarih:** 11 Eylül 2026  
**Hedef:** Firebase Spark (Ücretsiz Plan) sınırlarında sıfır kota aşımı ve en yüksek performans.  
**Durum:** Tamamlandı

---

## 1. Veri Dağılım Matrisi (Data Architecture Matrix)

| Veri Türü | Depolama Konumu | Neden Bu Konum Seçildi? | Kota / Maliyet Etkisi |
|---|---|---|---|
| **Kullanıcı Hesabı & Oturum** | Firebase Authentication | Güvenli JWT/OAuth, yerleşik session persistence | Sınırsız / Ücretsiz |
| **Kullanıcı Profil Bilgisi** | Cloud Firestore (`users/{uid}`) | Nadir güncellenen temel veriler (displayName, avatar) | Günde 1-2 okuma |
| **Abonelikler (Subscriptions)** | Firestore (`users/{uid}/subscriptions/{channelId}`) | Cihazlar arası kalıcı takip listesi, alt koleksiyon | Hedefli okuma/yazma |
| **Beğenilen Videolar (Favorites)** | Firestore (`users/{uid}/favorites/{videoId}`) | Kalıcı beğeni arşivi, sayfalama imkanı | Doküman başına 1 yazma |
| **Özel Oynatma Listeleri** | Firestore (`users/{uid}/playlists/{playlistId}`) | Kullanıcının oluşturduğu listeler ve içerikleri | Gerektiğinde okuma |
| **İzleme Geçmişi (History)** | Firestore (`users/{uid}/history/{videoId}`) | Video bazlı son izlenme ve kalınan süre (`lastPosition`) | Debounced (5 sn ara) |
| **Anlık Varlık (Presence)** | Realtime Database (`presence/{uid}`) | Çevrimiçi/çevrimdışı durumu, son aktiflik | RTDB Spark kotası içinde |
| **Oynatıcı Anlık İlerlemesi** | Zustand / React State / Memory | Video oynarken anlık pozisyon ASLA Firestore'a yazılmaz! | **Sıfır Firestore Yazma** |
| **Arama Geçmişi & UI Ayarları** | AsyncStorage (Cihaz İçi) | Hızlı, çevrimdışı ve cihaz bazlı tercihler | **Sıfır Bulut Maliyeti** |
| **İndirilen Videolar** | Cihaz Dosya Sistemi (`FileSystem.documentDirectory`) | Tam çevrimdışı video/ses dosyaları | **Sıfır Bulut Maliyeti** |

---

## 2. Firestore Veri Modelleri

### A. Kullanıcı Kök Dokümanı: `users/{userId}`
```typescript
interface UserProfileDocument {
  uid: string;
  email: string | null;
  displayName: string;
  photoURL: string | null;
  createdAt: number; // Server timestamp ms
  updatedAt: number;
  schemaVersion: 1;
}
```

### B. Abonelikler: `users/{userId}/subscriptions/{channelId}`
```typescript
interface SubscriptionDocument {
  channelId: string;
  channelTitle: string;
  thumbnailUrl: string;
  subscribedAt: number;
}
```

### C. Beğenilenler: `users/{userId}/favorites/{videoId}`
```typescript
interface FavoriteDocument {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
  duration: number;
  addedAt: number;
}
```

### D. İzleme Geçmişi: `users/{userId}/history/{videoId}`
```typescript
interface HistoryDocument {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
  duration: number;
  lastPosition: number; // saniye
  watchedAt: number; // son izleme timestamp
}
```

---

## 3. Spark Kotası Guardrails (Koruma Kuralları)
1. **Debounce Kuralı:** Video izlerken pozisyon güncellemesi yalnızca video duraklatıldığında veya kullanıcı sayfadan çıktığında yazılır.
2. **Toplu Dinleyici Yasağı:** Ekran açık değilken hiçbir Firestore `onSnapshot` dinleyicisi çalıştırılmaz. Ekran unmount olduğunda abonelik iptal edilir.
3. **Sayfalama (Pagination):** Listeler ilk açılışta `limit(20)` ile çekilir.

---
**[x] BURAYA KADAR YAPILDI: FAZ 3 TAMAMLANDI**
