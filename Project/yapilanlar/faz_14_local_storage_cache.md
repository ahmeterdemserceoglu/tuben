# FAZ 14: Local Storage & Cache

**Tarih:** 11 Eylül 2026  
**Durum:** Tamamlandı  
**TypeScript Doğrulaması:** %100 Başarılı (`tsc --noEmit` -> 0 Hata)  

---

## 1. Genel Bakış

Kotlin kaynak uygulamasındaki (`E:\tubentrailer`) Room veritabanı, SharedPreferences ve yerel disk önbelleği yapıları, React Native tarafında sıfır Firestore kotası harcayan, offline-first bir mimari ile yeniden kuruldu:
1. **AsyncStorage Hizmeti (`src/services/storageService.ts`):**
   - Kullanıcı Tercihleri (`@tuben_user_preferences`): Koyu tema, varsayılan kalite (1080p), arka planda çalma, SponsorBlock filtreleri.
   - Arama Geçmişi (`@tuben_search_history`): En fazla 25 arama terimini saklayan hızlı LRU mekanizması.
   - Video Kaldığı Yer Checkpoint'i (`@tuben_video_checkpoints`): Saniyede bir Firestore write maliyetini engellemek amacıyla doğrudan cihazın yerel belleğinde saklanır.
   - Önbellek Temizleme: Tek tıkla tüm yerel arama ve durum önbelleklerini sıfırlama.
2. **Çevrimdışı İndirme Yöneticisi (`src/services/downloadService.ts`):**
   - `expo-file-system/legacy` ile `documentDirectory + 'downloads/'` klasörüne unthrottled doğrudan MP4 video ve ses dosyalarını kaydeder.
   - Arka planda indirme ilerleme yüzdesi takibi (`createDownloadResumable`).
   - İndirilen videoların meta verileri, dosya boyutu (byte) ve silme/yönetim fonksiyonları.
3. **Bellek İçi LRU + TTL Önbellek Yöneticisi (`src/services/cacheManager.ts`):**
   - YouTube InnerTube CDN akışları, arama önerileri ve kanal bilgileri için 5-15 dakikalık TTL önbellekleme.
   - Tekrarlayan ağ çağrılarını engeller, veri tüketimini azaltır ve ekranlar arası geçişleri anlık (0ms) hale getirir.

---

## 2. Geliştirilen Dosyalar

| Dosya | Görev |
|---|---|
| `src/services/storageService.ts` | AsyncStorage kullanıcı tercihleri, arama geçmişi ve video kaldığı yer checkpoint'leri. |
| `src/services/downloadService.ts` | Expo FileSystem yerel MP4 video indirme, boyut hesaplama ve silme işlemleri. |
| `src/services/cacheManager.ts` | Bellek içi LRU & TTL önbellek katmanı. |

---

## 3. Doğrulama

- `npx tsc --noEmit` çalıştırıldı ve 0 hata ile doğrulandı.

---
**[x] BURAYA KADAR YAPILDI: FAZ 14 TAMAMLANDI**
