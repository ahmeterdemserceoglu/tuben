# GÖREV: MEVCUT KOTLIN ANDROID UYGULAMASINI REACT NATIVE + EXPO MİMARİSİNE TAM OLARAK TAŞI

Sen kıdemli bir:

- Android/Kotlin mühendisi
- React Native mühendisi
- Expo uzmanı
- Backend entegrasyon mühendisi
- Mobil mimari uzmanı
- Native Android / React Native bridge uzmanı
- Performans ve medya uygulamaları uzmanı

olarak hareket edeceksin.

Bu görev basit bir UI dönüştürme işi DEĞİLDİR.

Mevcut Kotlin Android uygulamasını kapsamlı şekilde analiz edecek, uygulamanın:

- ekranlarını,
- iş mantığını,
- veri modellerini,
- backend iletişimini,
- API katmanını,
- native Android özelliklerini,
- medya/oynatıcı sistemlerini,
- background servislerini,
- cache sistemini,
- state yönetimini,
- navigation yapısını,
- hata yönetimini,
- lifecycle davranışlarını,
- kullanıcı deneyimini,
- performans optimizasyonlarını

tespit ederek yeni bir **React Native + Expo** projesinde yeniden oluşturacaksın.

---

# 1. PROJE KLASÖRLERİ

Ana çalışma klasörü:

```text
A\
```

Mevcut Kotlin projesi:

```text
E:\tubentrailer
```

Bu proje:

```text
SOURCE_PROJECT = E:\tuben
```

Yeni React Native + Expo projesi:

```text
E:\tuben
```

Bu proje:

```text
TARGET_PROJECT = E:\tubentrailer
```

KRİTİK KURAL:

```text
E:\tubentrailer
```

klasörünü ASLA bozma.

Kaynak Kotlin projesinde:

- dosya silme,
- toplu değiştirme,
- refactor,
- formatlama,
- Gradle değiştirme,
- dependency değiştirme,
- asset taşıma

yapma.

Kaynak proje sadece:

```text
READ ONLY
```

olarak kabul edilecek.

Tüm yeni geliştirmeler:

```text
A\Tuben 2
```

içerisinde yapılacak.

Gerekirse kaynak projeden asset, font, icon vb. KOPYALANABİLİR ancak kaynak dosyalar silinmeyecek veya taşınmayacak.

---

# 2. ANA AMAÇ

Son durumda:

```text
Kotlin Android App
        ↓
Detailed Reverse Engineering
        ↓
React Native Architecture
        ↓
Expo Development Build
        ↓
Required Native Android Modules
        ↓
Existing Backend/API
        ↓
Feature Parity
```

elde etmek istiyorum.

Amaç sadece ekranların benzemesi değildir.

Amaç:

```text
Kotlin uygulamasıyla aynı işi yapan,
aynı backend ile çalışan,
aynı temel özelliklere sahip,
modern React Native mimarisine uygun,
bakımı kolay,
performanslı,
production-ready
bir uygulama üretmek.
```

---

# 3. ÖNCE ANALİZ ET, SONRA KOD YAZ

İlk gördüğün dosyadan itibaren kod yazmaya başlama.

Önce Kotlin projesini TAMAMEN analiz et.

Öncelikle aşağıdaki dosya ve klasörleri incele.

Örneğin:

```text
settings.gradle
settings.gradle.kts
build.gradle
build.gradle.kts
gradle.properties
AndroidManifest.xml
proguard-rules.pro

app/src/main/java
app/src/main/kotlin
app/src/main/res
app/src/main/assets
app/src/main/AndroidManifest.xml
```

Bunun yanında proje içinde kullanılan bütün:

```text
Activity
Fragment
ViewModel
Repository
Service
Worker
BroadcastReceiver
ContentProvider
Room Database
DAO
Entity
Retrofit
OkHttp
Interceptor
WebSocket
Coroutine
Flow
StateFlow
SharedFlow
LiveData
DataStore
SharedPreferences
ExoPlayer
Media3
MediaSession
MediaBrowserService
Notification
WorkManager
ForegroundService
Firebase
WebView
DownloadManager
Intent
Deep Link
FileProvider
```

yapılarını bul.

Sadece sınıf isimlerine bakma.

Gerçek çağrı zincirlerini incele.

Örneğin:

```text
UI
 ↓
ViewModel
 ↓
UseCase
 ↓
Repository
 ↓
API / Database / Native Layer
```

gibi ilişkileri çıkar.

---

# 4. ANALİZ RAPORU ÇIKAR

Kodlamaya başlamadan önce kendi çalışma notlarında bir migration haritası oluştur.

En az şu bilgileri çıkar:

```text
1. Ekranlar
2. Navigation akışı
3. API endpointleri
4. Backend URL'leri
5. HTTP methodları
6. Request body'leri
7. Response modelleri
8. Authentication sistemi
9. Token yönetimi
10. Header'lar
11. Cookie sistemi
12. Cache mekanizması
13. Local storage
14. Database sistemi
15. Background task'ler
16. Native Android servisleri
17. Medya sistemi
18. Notification sistemi
19. Deep link sistemi
20. Download sistemi
21. Dosya erişimi
22. Permission sistemi
23. Analytics
24. Crash reporting
25. Player lifecycle
26. App lifecycle
27. Retry sistemleri
28. Error handling
29. Network fallback'leri
30. Offline davranışı
```

Ayrıca şu sınıflandırmayı yap:

```text
PURE_JS
EXPO_SUPPORTED
EXPO_CONFIG_PLUGIN_REQUIRED
CUSTOM_NATIVE_MODULE_REQUIRED
ANDROID_ONLY
CAN_BE_REDESIGNED
```

Her önemli Kotlin özelliğini bu kategorilerden birine koy.

---

# 5. KOTLIN → REACT NATIVE EŞLEŞTİRME TABLOSU

Her önemli Kotlin componentinin React Native tarafındaki karşılığını belirle.

Örneğin:

```text
Kotlin Activity
→ React Navigation Screen

Fragment
→ React Component / Screen

ViewModel
→ Zustand / React hooks / domain state

Repository
→ Repository layer

Retrofit
→ HTTP client/service layer

OkHttp Interceptor
→ API interceptor

Room
→ SQLite / appropriate persistent storage

SharedPreferences/DataStore
→ appropriate React Native persistent storage

Coroutine
→ Promise / async-await / controlled async task

StateFlow
→ observable/store state

ForegroundService
→ Android native service + RN integration

Media3/ExoPlayer
→ compatible React Native/native media implementation

WorkManager
→ background task/native scheduler where appropriate
```

Ancak bu listeyi körü körüne uygulama.

Kaynak kodun davranışına göre en doğru karşılığı seç.

---

# 6. EXPO KONUSUNDA KRİTİK KURAL

Projeyi Expo tabanlı kur.

Ancak:

```text
Expo kullanılıyor = sadece Expo Go kullanılacak
```

şeklinde düşünme.

Kaynak Kotlin uygulaması native Android özellikleri kullanıyorsa:

```text
Expo Development Build
expo-dev-client
Expo Prebuild
Config Plugins
Native Android modules
Kotlin native code
```

kullanmaktan çekinme.

Özellikle aşağıdakiler varsa Expo Go ile sınırlanmaya çalışma:

```text
Background playback
Foreground service
MediaSession
Android notification controls
Native audio
Native video
Persistent service
Custom Intent
BroadcastReceiver
Special permissions
Picture-in-Picture
Advanced download manager
Media buttons
Lock screen controls
Native caching
Custom player
Android service lifecycle
```

Gerekirse:

```text
React Native UI
        ↓
TypeScript API
        ↓
Native Module / TurboModule
        ↓
Kotlin
        ↓
Android Framework
```

mimarisi kullan.

Ama gereksiz native kod da yazma.

Öncelik:

```text
1. Expo API
2. Sağlam React Native library
3. Config Plugin
4. Native Kotlin module
```

sırasıyla ilerlemek olsun.

---

# 7. YENİ PROJEYİ KUR

Hedef:

```text
A\Tuben 2
```

Eğer klasör boşsa uygun Expo projesini burada oluştur.

TypeScript kullan.

Modern ve production uyumlu bir yapı kur.

Önerilen mimari:

```text
Tuben 2/
│
├── app/
│
├── src/
│   ├── api/
│   ├── components/
│   ├── constants/
│   ├── domain/
│   ├── hooks/
│   ├── models/
│   ├── navigation/
│   ├── repositories/
│   ├── services/
│   ├── store/
│   ├── utils/
│   ├── features/
│   ├── player/
│   ├── native/
│   └── types/
│
├── assets/
│   ├── images/
│   ├── icons/
│   └── fonts/
│
├── modules/
│
├── android/
│
├── app.json / app.config.ts
├── package.json
└── tsconfig.json
```

Ancak proje için daha mantıklı bir mimari varsa onu kullanabilirsin.

Ama her şeyi:

```text
components/
services/
utils/
```

içine rastgele doldurma.

Feature/domain bazlı düzenli mimari kullan.

---

# 8. TYPESCRIPT ZORUNLU

Yeni projede mümkün olduğunca:

```text
.ts
.tsx
```

kullan.

Kaçınılabilir yerlerde:

```text
any
```

kullanma.

Backend modellerini TypeScript interface/type olarak tanımla.

Örneğin:

```ts
export interface Video {
  id: string;
  title: string;
  thumbnailUrl: string;
  duration: number;
}
```

Backend response'larını doğrudan UI içinde kullanmak yerine normalize edilmesi gerekiyorsa uygun mapper oluştur.

---

# 9. BACKEND EN KRİTİK KONULARDAN BİRİ

Backend entegrasyonuna çok dikkat et.

Kotlin projesindeki bütün network sistemini analiz et.

Bul:

```text
BASE_URL
API_URL
Retrofit Builder
OkHttpClient
Interceptor
Authenticator
Headers
Cookies
Authorization
Bearer tokens
Refresh tokens
Query params
POST payloads
Multipart uploads
WebSocket
Streaming URL
Pagination
Continuation token
Retry
Timeout
DNS handling
User-Agent
Referer
Origin
Device headers
Custom headers
```

Backend davranışını değiştirme.

Eski uygulama bir request gönderiyorsa yeni uygulama aynı mantığı korumalı.

Örneğin Kotlin:

```kotlin
@GET("videos")
suspend fun getVideos(
    @Query("page") page: Int
): VideoResponse
```

ise bunu sadece rastgele bir fetch çağrısına dönüştürme.

Merkezi API mimarisi kur.

Örneğin:

```text
src/api/client.ts
src/api/endpoints.ts
src/api/interceptors.ts
src/repositories/videoRepository.ts
```

UI içinde rastgele:

```ts
fetch(...)
```

kullanma.

---

# 10. NETWORK LAYER

Merkezi network katmanı oluştur.

Desteklenmesi gereken şeyler:

```text
Base URL
timeout
retry
auth headers
request cancellation
response parsing
error normalization
logging
network status
token refresh
401 handling
403 handling
429 handling
5xx handling
```

Özellikle component unmount olduğunda gereksiz requestlerin devam etmesini engelle.

AbortController veya uygun cancellation mekanizması kullan.

---

# 11. BACKEND'I YENİDEN YAZMA

Kotlin uygulaması mevcut çalışan bir backend kullanıyorsa backend'i gereksiz yere yeniden oluşturma.

Önce mevcut backend'i kullan.

Fakat Kotlin tarafında backend gibi davranan native/local katman varsa bunu ayrıca analiz et.

Örneğin:

```text
Parser
Scraper
Innertube client
Local HTTP service
Media resolver
Signature decoder
Streaming extractor
```

gibi bir katman varsa sadece REST API zannedip atlama.

Bu sistemlerin yeni uygulamada nereye taşınacağına karar ver.

---

# 12. NATIVE KODU KÖRÜ KÖRÜNE TYPESCRIPT'E ÇEVİRME

Kotlin kodunda Android sistemine sıkı bağlı bir özellik varsa TypeScript'e zorla taşıma.

Örneğin:

```kotlin
MediaSession
ForegroundService
NotificationManager
AudioManager
BroadcastReceiver
PendingIntent
Intent
Service
MediaButtonReceiver
```

gibi sistemler gerekiyorsa Kotlin tarafında bırakılabilir.

Yeni mimari:

```text
React Native / TypeScript
        ↓
Native Interface
        ↓
Kotlin Android Module
```

şeklinde olabilir.

Native tarafı mümkün olduğunca:

```text
small
isolated
well-defined
testable
```

tut.

---

# 13. UI MIGRATION

Kotlin uygulamasındaki bütün ekranları bul.

Her ekran için:

```text
Screen name
Purpose
Inputs
Outputs
State
Loading state
Empty state
Error state
Navigation actions
Backend calls
Native actions
```

çıkar.

Sonra React Native ekranını oluştur.

Tasarımı mümkün olduğunca kaynak uygulamaya sadık tut.

Ancak kötü veya Android'e özel layout kodunu birebir kopyalama.

React Native'e uygun responsive layout kur.

Destekle:

```text
different phone sizes
safe area
notches
Android navigation bar
keyboard
orientation requirements
font scaling where appropriate
```

---

# 14. NAVIGATION

Kaynak uygulamadaki navigation graph'ı analiz et.

Yeni projede uygun şekilde:

```text
Expo Router
```

veya proje için daha uygun olan React Navigation tabanlı mimari kullanılabilir.

Routing yapısını temiz tut.

Örneğin:

```text
/
├── index
├── search
├── library
├── settings
├── video/[id]
├── channel/[id]
└── player
```

gibi.

Deep link kullanılıyorsa onu da koru.

---

# 15. STATE MANAGEMENT

Her şeyi global store'a koyma.

State'i ayır:

```text
Local UI state
Server state
Global application state
Persistent state
Player state
Authentication state
```

İhtiyaca göre:

```text
React hooks
Context
Zustand
TanStack Query
```

vb. kullan.

Ancak dependency kullanmadan önce gerçekten gerekli olduğundan emin ol.

Player gibi global sistemler için merkezi state kullan.

---

# 16. DATA FLOW

Yeni uygulamanın veri akışı mümkün olduğunca şu şekilde olsun:

```text
UI
 ↓
Presentation hooks
 ↓
Domain / Use Cases
 ↓
Repository
 ↓
Services
 ↓
HTTP / Storage / Native
```

Örneğin:

```text
HomeScreen
 ↓
useHomeFeed()
 ↓
GetHomeFeed
 ↓
HomeRepository
 ↓
HomeApi
 ↓
Backend
```

UI'nın backend ayrıntılarını bilmesini istemiyorum.

---

# 17. PLAYER / MEDIA VARSA ÖZEL DİKKAT

Kaynak uygulamada video veya müzik player varsa bunu kritik sistem olarak kabul et.

Analiz et:

```text
play
pause
seek
next
previous
queue
repeat
shuffle
duration
position
buffer
loading
playback errors
retry
audio focus
headset unplug
Bluetooth
background playback
lockscreen
notification
media buttons
app background
app foreground
screen lock
process lifecycle
```

Sadece ekranda video oynuyor diye player migrasyonu tamamlanmış sayılmayacak.

Player lifecycle doğru kurulmalı.

---

# 18. BACKGROUND PLAYBACK VARSA

Background playback native Android servisine bağlıysa aynı davranışı yeni sistemde koru.

Örneğin:

```text
React Native
     ↓
Playback Store
     ↓
Playback Service abstraction
     ↓
Native player/service
     ↓
Android Foreground Service
     ↓
MediaSession
     ↓
Notification
```

gibi sağlam bir yapı kullan.

App minimize edildiğinde playback'in yanlışlıkla durmamasını sağla.

UI component unmount olduğunda player service yok edilmemeli.

Player'ın:

```text
UI lifecycle
```

yerine gerektiğinde:

```text
application/service lifecycle
```

ile yaşaması sağlanmalı.

---

# 19. CONCURRENCY / RACE CONDITION

Kotlin Coroutine sistemini React Native'e geçirirken race condition oluşturma.

Özellikle:

```text
hızlı next/previous
seek sırasında source değişimi
aynı anda birden fazla request
search değişimi
screen unmount
player release
queue mutation
token refresh
pagination
```

durumlarını kontrol et.

Stale operation'ların yeni state'i ezmesini önle.

Generation ID, AbortController, request identity veya benzeri mekanizmalar kullan.

---

# 20. CACHE

Kotlin uygulamasındaki cache mekanizmasını bul.

Ayır:

```text
memory cache
disk cache
image cache
API cache
media cache
database cache
search cache
```

Yeni uygulamada bilinçli bir cache stratejisi kur.

Cache yüzünden stale data veya yanlış video oynatma problemleri oluşturmamaya dikkat et.

---

# 21. LOCAL STORAGE

Kaynak projede kullanılan:

```text
SharedPreferences
DataStore
Room
Files
SQLite
```

sistemlerini incele.

Ne için kullanıldığını belirle.

Örneğin:

```text
settings
history
favorites
downloads
sessions
tokens
queue
player position
```

Her veri için uygun React Native persistence çözümünü seç.

---

# 22. ASSET MIGRATION

Kaynak projedeki:

```text
drawable
mipmap
font
raw
assets
```

klasörlerini analiz et.

Gerekli dosyaları:

```text
A\Tuben 2\assets
```

altına KOPYALA.

Android density assetlerini React Native asset yapısına uygun hale getir.

Gereksiz duplicate dosyaları taşıma.

---

# 23. ENVIRONMENT CONFIG

Hardcoded backend URL veya secret kullanma.

Gerekirse:

```text
.env
.env.example
app.config.ts
```

kullan.

Ama Kotlin projesindeki gerçek çalışma davranışını bozma.

Secret olmayan public API configuration ile gerçek secret'ları ayır.

---

# 24. ERROR HANDLING

Bütün backend hatalarını kullanıcıya:

```text
[object Object]
Network request failed
undefined
```

şeklinde gösterme.

Normalize edilmiş hata modeli kur.

Örneğin:

```ts
interface AppError {
  type:
    | 'network'
    | 'timeout'
    | 'authentication'
    | 'server'
    | 'not-found'
    | 'rate-limit'
    | 'playback'
    | 'unknown';

  message: string;
  cause?: unknown;
}
```

---

# 25. LOGGING

Merkezi logging sistemi kur.

Development sırasında şu kategoriler loglanabilsin:

```text
[API]
[PLAYER]
[NATIVE]
[AUTH]
[NAVIGATION]
[CACHE]
[STORAGE]
[BACKGROUND]
```

Production build'de gereksiz verbose logları kapat.

Token, password veya sensitive data loglama.

---

# 26. PERMISSIONS

AndroidManifest'i detaylı incele.

Tüm permission'ları çıkar.

Örneğin:

```text
INTERNET
POST_NOTIFICATIONS
FOREGROUND_SERVICE
FOREGROUND_SERVICE_MEDIA_PLAYBACK
WAKE_LOCK
READ_MEDIA_AUDIO
READ_MEDIA_VIDEO
BLUETOOTH
BLUETOOTH_CONNECT
```

Hangisinin gerçekten kullanıldığını tespit et.

Yeni Expo config / AndroidManifest sisteminde gerekli olanları ekle.

Gereksiz permission ekleme.

---

# 27. ANDROID VERSİYONLARI

Modern Android sürümleri için uyumlu ol.

Özellikle:

```text
Android 13
Android 14
Android 15
Android 16+
```

davranışlarını düşün.

Foreground Service, notification ve media permission değişikliklerini göz önünde bulundur.

---

# 28. EXPO CONFIG PLUGIN

Native config değişikliği gerekiyorsa manuel olarak sürekli:

```text
android/
```

içine patch atmak yerine mümkünse config plugin düşün.

Prebuild tekrar çalıştırıldığında native değişikliklerin kaybolmamasını sağla.

---

# 29. CUSTOM NATIVE MODULE GEREKİRSE

Gerekli native Android fonksiyonlarını ayrı modüle koy.

Örneğin:

```text
modules/
└── tuben-player/
    ├── android/
    │   └── src/main/java/...
    ├── src/
    └── expo-module.config.json
```

gibi Expo Modules API tabanlı bir yapı uygun ise kullan.

Native API yüzeyini küçük tut.

Örneğin:

```ts
play(url)
pause()
seek(position)
setQueue(items)
getState()
```

gibi.

React tarafına Android iç detaylarını sızdırma.

---

# 30. DEPENDENCY SEÇİMİ

Her sorunu yeni npm paketi kurarak çözme.

Dependency eklemeden önce:

```text
1. gerçekten gerekli mi?
2. güncel mi?
3. Expo ile uyumlu mu?
4. New Architecture destekliyor mu?
5. Android build'i bozuyor mu?
6. maintain ediliyor mu?
7. native dependency gerektiriyor mu?
```

kontrol et.

Deprecated package kullanma.

Kuracağın dependency'nin kullanılan Expo/React Native sürümüyle uyumlu olduğundan emin ol.

---

# 31. SÜRÜM SEÇİMİ

Projeyi oluştururken rastgele eski tutorial sürümlerini kullanma.

Kurulum anında mevcut environment ile uyumlu:

```text
Node
Expo SDK
React Native
React
Gradle
Android Gradle Plugin
Kotlin
JDK
```

versiyon kombinasyonunu kontrol et.

Sürüm uyumluluğunu bozacak rastgele upgrade yapma.

---

# 32. TEST ETMEDEN "TAMAMLANDI" DEME

Her büyük migration adımından sonra kontrol et:

```bash
npx tsc --noEmit
```

uygunsa lint çalıştır.

Test altyapısı varsa testleri çalıştır.

Android native kod varsa Gradle compile/build kontrolü yap.

Development build'in gerçekten açıldığını doğrula.

Sadece TypeScript compile olması migration'ın çalıştığı anlamına gelmez.

---

# 33. ANDROID BUILD

Hedeflerden biri:

```text
Android Development Build
```

oluşturabilmek.

Gerekirse:

```bash
npx expo prebuild
```

ve:

```bash
cd android
gradlew assembleDebug
```

veya uygun Expo build komutlarını kullan.

Build hatalarını çözmeden işi bırakma.

---

# 34. EXPO GO'YA ZORLAMA YOK

Custom native module gerekiyorsa:

```text
Expo Go desteklemiyor
```

diye özelliği kaldırma.

Bunun yerine:

```text
Expo Development Build
```

kullan.

Bu proje production uygulamasıdır.

Expo Go uyumluluğu ana hedef değildir.

---

# 35. FEATURE PARITY MATRİSİ

Migration sırasında her özelliği takip et.

Örneğin:

```text
FEATURE                         KOTLIN    RN/EXPO    STATUS

Home Feed                       ✅        ✅          DONE
Search                          ✅        ✅          DONE
Video Details                   ✅        ✅          DONE
Playback                        ✅        ✅          DONE
Background Playback             ✅        ✅          DONE
Media Notification              ✅        ✅          DONE
History                         ✅        ✅          DONE
Favorites                       ✅        ✅          DONE
Settings                        ✅        ✅          DONE
Offline Cache                   ✅        ✅          DONE
```

Gerçek projedeki özelliklere göre tabloyu oluştur.

Kotlin'de olan bir özelliği sessizce atlama.

---

# 36. DESIGN PARITY ≠ ARCHITECTURE PARITY

UI benziyor diye işi bitmiş kabul etme.

Şunların da eşleşmesi gerekir:

```text
business logic
network behavior
loading behavior
error behavior
player behavior
background behavior
persistence
navigation
pagination
cache
authentication
native integration
```

---

# 37. KOD KALİTESİ

Aşağıdaki anti-patternleri oluşturma:

```text
2000 satırlık component
API çağrısının JSX içinde yapılması
her yerde any
duplicate API client
duplicate models
global mutable state
magic strings
hardcoded URLs
dev-only hacks
setTimeout ile race-condition çözme
component lifecycle'a bağlı global player
```

Kod:

```text
modular
typed
testable
maintainable
production-ready
```

olmalı.

---

# 38. İŞİ FAZLARA AYIR

Çalışmayı aşağıdaki sırayla gerçekleştir.

## FAZ 0 — ENVIRONMENT

Kontrol et:

```text
Node
npm
JDK
Android SDK
Gradle
Expo environment
```

---

## FAZ 1 — KOTLIN DISCOVERY

Kotlin projesini recursive olarak analiz et.

Feature listesi çıkar.

Dependency'leri bul.

Manifest'i incele.

Backend'i incele.

Native componentleri bul.

---

## FAZ 2 — ARCHITECTURE MAP

Şunları çıkar:

```text
Screen map
Navigation map
Backend map
Data flow
Native dependency map
Player map
Storage map
```

---

## FAZ 3 — REACT NATIVE FOUNDATION

Tuben 2 projesini kur.

TypeScript ayarla.

Navigation oluştur.

Folder architecture oluştur.

Config oluştur.

---

## FAZ 4 — CORE LAYERS

Önce:

```text
types
models
API client
repositories
storage
error handling
logging
configuration
```

katmanlarını kur.

---

## FAZ 5 — BACKEND

Kotlin network davranışını RN tarafına geçir.

Request/response parity sağla.

Authentication varsa taşı.

Pagination varsa taşı.

---

## FAZ 6 — NATIVE FOUNDATION

Native Android gereken özellikleri belirle.

Expo APIs → library → config plugin → native module sırasıyla değerlendir.

---

## FAZ 7 — SCREENS

Kotlin ekranlarını teker teker migrate et.

Her ekran gerçekten backend'e bağlansın.

Mock data ile işi bitmiş sayma.

---

## FAZ 8 — MEDIA / PLAYER

Media sistemi varsa ayrı migration olarak ele al.

Race condition ve lifecycle testleri yap.

---

## FAZ 9 — BACKGROUND

Background service, notifications ve media controls özelliklerini tamamla.

---

## FAZ 10 — PERSISTENCE

History, favorites, settings vb. local verileri tamamla.

---

## FAZ 11 — TEST

Feature parity testi yap.

Kritik user flow'ları test et.

---

## FAZ 12 — BUILD

Android development build üret.

Build hatalarını gider.

---

## FAZ 13 — CLEANUP

Dead code sil.

Unused dependency kaldır.

Debug hacklerini kaldır.

TypeScript hatalarını sıfırla.

---

# 39. HER ADIMDA GERÇEK DOSYALARI İNCELE

Dosya adına bakarak tahmin yürütme.

Örneğin:

```text
PlayerService.kt
```

bulduysan tamam deyip geçme.

Dosyanın tamamını oku.

Kim çağırıyor bul.

Bağlı olduğu classları bul.

Manifest registration'ını kontrol et.

Notification channel'ını bul.

Player instance'ın nerede oluşturulduğunu bul.

Lifecycle'ın nasıl yönetildiğini bul.

Sonra React Native tasarımını yap.

---

# 40. RECURSIVE ANALİZ

Örneğin:

```text
HomeActivity
```

şunu çağırıyorsa:

```text
HomeViewModel
```

onu incele.

O:

```text
VideoRepository
```

çağırıyorsa onu incele.

O:

```text
InnertubeClient
```

çağırıyorsa onu incele.

O:

```text
PlayerParser
```

çağırıyorsa onu incele.

Bağımlılık zincirinin en altına kadar git.

Yüzeysel migration istemiyorum.

---

# 41. DAVRANIŞI ANLA

Kotlin kodunu TypeScript syntaxına çevirmek migration değildir.

Şunu anla:

```text
Bu kod NE yapıyor?
NEDEN böyle yapıyor?
Hangi lifecycle'a bağlı?
Hangi thread'de çalışıyor?
Hangi state'i koruyor?
Hata alınca ne yapıyor?
Retry var mı?
Cache var mı?
Cancellation var mı?
```

Sonra React Native'e uygun implementation yaz.

---

# 42. KRİTİK KULLANICI AKIŞLARI

Uygulamaya göre bu akışların eşdeğerlerini test et:

```text
App launch
Home load
Search
Open detail
Start playback
Pause
Resume
Seek
Next
Previous
Background app
Return to app
Network loss
Network restore
Rapid navigation
Rapid next/previous
App process recreation
```

Gerçek projede olmayan özellikleri uydurma.

---

# 43. MOCK DATA YASAĞI

Gerçek Kotlin uygulaması backend kullanıyorsa production implementation içinde mock data kullanma.

Geçici test için kullanırsan final koddan kaldır.

Örneğin:

```ts
const videos = [
  ...
]
```

yazarak gerçek backend entegrasyonunu atlama.

---

# 44. PLACEHOLDER YASAĞI

Şunlarla işi bırakma:

```ts
// TODO implement
throw new Error("Not implemented")
return null
// placeholder
```

Kritik bir özellik gerçekten uygulanamıyorsa nedenini teknik olarak belirle ve mümkün olan implementation'ı yap.

---

# 45. SOURCE OF TRUTH

Herhangi bir davranış konusunda emin değilsen:

```text
A\Tuben Trailer
```

kaynak kodunu source of truth kabul et.

Tahmin yerine mevcut implementasyonu araştır.

---

# 46. KAYNAK PROJE ÇALIŞIYORSA DAVRANIŞINI BOZMA

Kotlin tarafında garip görünen ama çalışan özel bir:

```text
header
parser
cache
retry
continuation
request
player workaround
```

varsa bunu "daha temiz olsun" diyerek doğrudan silme.

Önce neden var olduğunu araştır.

---

# 47. GÜVENLİ MIGRATION

Source ve target kesin olarak ayrılacak:

```text
SOURCE
A\Tuben Trailer
       ↓
   READ ONLY


TARGET
A\Tuben 2
       ↓
  ALL WRITES
```

Yanlış klasörde komut çalıştırma.

Özellikle:

```text
npm install
npx expo
git init
gradlew clean
```

gibi değiştiren komutları yalnızca doğru klasörde çalıştır.

---

# 48. DOKÜMANTASYON

Hedef projede mümkünse:

```text
MIGRATION.md
```

oluştur.

İçinde:

```text
Architecture
Kotlin → RN mapping
Native modules
Backend
Build instructions
Environment
Known limitations
```

olsun.

Ayrıca:

```text
README.md
```

içinde projeyi nasıl çalıştıracağımızı açıkla.

---

# 49. FINAL ARCHITECTURE

Son sistem genel olarak buna benzer olmalı:

```text
                    REACT NATIVE UI
                          │
                          ▼
               PRESENTATION / HOOKS
                          │
                          ▼
                    DOMAIN LAYER
                          │
                          ▼
                     REPOSITORIES
                    /            \
                   ▼              ▼
            BACKEND/API       LOCAL STORAGE
                   │
                   │
                   ▼
             NETWORK CLIENT


Ayrı olarak:


                    PLAYER UI
                        │
                        ▼
                 PLAYER STORE
                        │
                        ▼
               PLAYBACK SERVICE
                 /          \
                ▼            ▼
        JS/RN PLAYER     NATIVE MODULE
                              │
                              ▼
                         KOTLIN CORE
                              │
                              ▼
                       ANDROID SERVICES
```

Gerçek proje ihtiyaçlarına göre mimariyi adapte et.

---

# 50. ÇALIŞMA PRENSİBİN

Bana sürekli:

```text
Bunu yapayım mı?
Devam edeyim mi?
Şimdi diğer dosyaya geçeyim mi?
```

diye sorma.

Projeyi analiz et ve görevi uçtan uca ilerlet.

Bir sorun çıktığında mümkünse kendin araştırıp çöz.

Bir komut başarısız olursa çıktıyı incele, temel nedeni bul, düzelt ve tekrar test et.

---

# 51. ÖNEMLİ: DOSYA DEĞİŞTİRMEDEN ÖNCE BAĞLAMLARI OKU

Bir dosyayı değiştirmeden önce:

```text
imports
call sites
types
related services
related hooks
related native code
```

incele.

Tek bir bug fix başka sistemi bozmamalı.

---

# 52. BUILD HATASI GİZLEME

Build hata veriyorsa:

```text
migration successful
```

deme.

Örneğin:

```text
TypeScript error
Gradle error
Manifest merge error
Kotlin compile error
Metro error
Native module error
dependency conflict
```

varsa çözmeye devam et.

---

# 53. QUALITY GATES

Final aşamada şu kontroller mümkün olduğunca başarılı olmalı:

```text
TypeScript: PASS
Lint: PASS
Tests: PASS
Metro bundle: PASS
Expo config: PASS
Android Gradle compile: PASS
Android debug build: PASS
App launch: PASS
Backend connection: PASS
Critical navigation: PASS
Critical playback: PASS
```

---

# 54. FINAL RAPOR

İş bittiğinde bana kapsamlı rapor ver.

Şu formatta:

```text
MIGRATION RESULT

Source:
A\Tuben Trailer

Target:
A\Tuben 2


1. Kotlin projesinde bulunan mimari

2. Tespit edilen backend sistemi

3. Tespit edilen native Android özellikleri

4. Kullanılan React Native/Expo mimarisi

5. Oluşturulan ekranlar

6. Backend entegrasyonları

7. Native modüller

8. Player/media sistemi

9. Storage/cache sistemi

10. Background işlemleri

11. Build sonucu

12. Test sonuçları

13. Kotlin → RN feature parity

14. Bilinen problemler

15. Gelecekte geliştirilebilecek alanlar
```

---

# EN ÖNEMLİ TALİMAT

Bu projeye:

```text
"Kotlin kodunu React Native'e çevir"
```

gibi yüzeysel yaklaşma.

Görevin:

```text
MEVCUT UYGULAMAYI REVERSE ENGINEER ET
        ↓
DAVRANIŞLARINI ANLA
        ↓
BACKEND VE NATIVE SİSTEMLERİ ÇÖZÜMLE
        ↓
REACT NATIVE'E UYGUN YENİ MİMARİ TASARLA
        ↓
EXPO TABANLI PROJEYİ KUR
        ↓
GEREKEN YERLERDE NATIVE KOTLIN KULLAN
        ↓
ÖZELLİKLERİ TEK TEK MIGRATE ET
        ↓
TEST ET
        ↓
ANDROID BUILD AL
```

şeklindedir.

Özellikle:

```text
BACKEND,
NATIVE ANDROID,
PLAYER,
BACKGROUND SERVICES,
NETWORK,
CACHE,
STATE MANAGEMENT,
LIFECYCLE
```

konularını kritik kabul et.

UI'yı bitirip backend'i veya native sistemi yarım bırakmak kabul edilemez.

Önce:

```text
A\Tuben Trailer
```

projesini detaylı analiz et.

Sonra tüm yeni implementasyonu:

```text
A\Tuben 2
```

içinde gerçekleştir.

Kaynak Kotlin projesine zarar verme.

Son hedef:

**Kotlin uygulamasının özelliklerini ve backend davranışını mümkün olduğunca eksiksiz koruyan, modern React Native + Expo tabanlı, gerektiğinde Kotlin native modüller kullanan, production seviyesinde yeni bir Tuben 2 uygulaması oluşturmaktır.**
