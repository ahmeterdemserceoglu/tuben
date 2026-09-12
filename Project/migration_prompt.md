# GÖREV: KOTLIN ANDROID UYGULAMASINI REACT NATIVE + EXPO + FIREBASE MİMARİSİNE TAM OLARAK TAŞI

Sen kıdemli bir:

- Android/Kotlin mühendisi
- React Native mühendisi
- Expo uzmanı
- TypeScript mühendisi
- Firebase mimarı
- Backend entegrasyon mühendisi
- Mobil sistem mimarı
- Native Android / React Native bridge uzmanı
- Medya/player altyapısı uzmanı
- Performans, cache ve realtime sistem uzmanı

olarak hareket edeceksin.

Bu görev basit bir UI dönüştürme işi değildir.

Mevcut Kotlin Android uygulamasını reverse-engineer ederek davranışlarını anlayacak ve yeni uygulamayı React Native + Expo + TypeScript mimarisi üzerinde yeniden oluşturacaksın.

Firebase tarafında özellikle:

- Firebase Authentication
- Cloud Firestore
- Firebase Realtime Database

kullanılacak.

Firebase'in ücretsiz Spark kotasının mümkün olduğunca verimli kullanılması kritik gereksinimdir.

---

# 1. PROJE KLASÖRLERİ

Kaynak Kotlin Android projesi:

```text
SOURCE_PROJECT = E:\tubentrailer
```

Yeni React Native + Expo projesi:

```text
TARGET_PROJECT = E:\tuben
```

SOURCE_PROJECT salt okunur kabul edilecek.

```text
E:\tubentrailer
```

üzerinde:

- dosya silme
- dosya taşıma
- refactor
- formatlama
- Gradle değiştirme
- dependency değiştirme
- asset silme
- source code değiştirme

YAPMA.

Kaynak projeyi yalnızca analiz et.

Bütün yeni kodlar:

```text
E:\tuben
```

içinde oluşturulacak.

Kaynak projeden gerekli:

```text
image
icon
font
drawable
raw asset
configuration information
```

kopyalanabilir.

Ancak kaynak dosya taşınmayacak veya silinmeyecek.

---

# 2. HEDEF

Son mimari kabaca:

```text
KOTLIN SOURCE APP
       │
       ▼
Reverse Engineering
       │
       ▼
Feature / Backend / Native Analysis
       │
       ▼
React Native + Expo
       │
       ├──────────────► Firebase Authentication
       │
       ├──────────────► Cloud Firestore
       │
       ├──────────────► Realtime Database
       │
       ├──────────────► Existing Backend/API
       │
       └──────────────► Native Kotlin Modules
```

olmalıdır.

Amaç yalnızca ekranların benzemesi değildir.

Amaç:

```text
aynı temel özellikler
aynı backend davranışı
aynı kullanıcı akışları
doğru native davranış
doğru player lifecycle
Firebase entegrasyonu
kalıcı kullanıcı hesabı
cloud sync
realtime özellikler
production seviyesinde mimari
```

sağlamaktır.

---

# 3. ÖNCE ANALİZ ET

İlk gördüğün dosyadan kod yazmaya başlama.

Öncelikle Kotlin projesini recursive olarak incele.

Özellikle:

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
```

incele.

Aşağıdaki yapıları ara:

```text
Activity
Fragment
Compose
ViewModel
Repository
UseCase
Service
Worker
BroadcastReceiver
ContentProvider

Room
DAO
Entity
DataStore
SharedPreferences

Retrofit
OkHttp
Interceptor
Authenticator
WebSocket

Coroutine
Flow
StateFlow
SharedFlow
LiveData

ExoPlayer
Media3
MediaSession
MediaBrowserService
ForegroundService

Notification
WorkManager
DownloadManager
WebView

Intent
Deep Link
FileProvider

Firebase
Firestore
Realtime Database
Authentication
```

Sadece isimlere bakma.

Çağrı zincirlerini takip et.

Örneğin:

```text
HomeActivity
    ↓
HomeViewModel
    ↓
GetHomeFeed
    ↓
VideoRepository
    ↓
InnertubeClient
    ↓
HTTP / Parser
```

gibi zincirin sonuna kadar git.

---

# 4. ANALİZ ÇIKTILARI

Kod yazmadan önce kendi çalışma dosyalarında migration haritası oluştur.

En az aşağıdakileri belirle:

```text
Screens
Navigation
API endpoints
Backend URLs
HTTP methods
Headers
Cookies
Authentication
Tokens
Refresh tokens
Request models
Response models
Pagination
Continuation tokens
Streaming URLs
Local storage
Room databases
Cache
Background tasks
Player
Media services
Notifications
Downloads
Deep links
Permissions
File access
Analytics
Crash reporting
Retry
Timeout
Offline behavior
Network fallback
Lifecycle
Native integrations
```

Her önemli Kotlin özelliğini şu kategorilerden birine yerleştir:

```text
PURE_REACT_NATIVE
EXPO_SUPPORTED
EXPO_CONFIG_PLUGIN
THIRD_PARTY_NATIVE_LIBRARY
CUSTOM_NATIVE_MODULE
ANDROID_ONLY
REDESIGN_REQUIRED
```

---

# 5. KOTLIN → REACT NATIVE MIGRATION HARİTASI

Mantıksal karşılıkları belirle.

Örneğin:

```text
Activity
→ Screen

Fragment
→ Screen / Component

ViewModel
→ Presentation hook / Zustand slice

Repository
→ Repository

Retrofit
→ API service

OkHttp Interceptor
→ Network interceptor

Room
→ Local database

DataStore
→ Persistent local preferences

Coroutine
→ async operation / task abstraction

StateFlow
→ observable/store state

ForegroundService
→ Native Android service

MediaSession
→ Native media integration
```

Bunları mekanik dönüşüm olarak kullanma.

Kaynak davranışı analiz ederek en uygun React Native karşılığını seç.

---

# 6. EXPO STRATEJİSİ

Expo kullanılacak.

Ancak:

```text
Expo = Expo Go
```

olarak düşünme.

Proje gerektiğinde:

```text
Expo Development Build
expo-dev-client
Expo Prebuild
Expo Config Plugins
Expo Modules API
Native Kotlin
```

kullanabilir.

Native özellik gerekiyorsa sırayla şunu değerlendir:

```text
1. Expo'nun resmi API'si
2. Stabil React Native library
3. Expo Config Plugin
4. Expo Native Module
5. Özel Kotlin implementation
```

Native functionality gerekiyorsa özelliği Expo Go uğruna kaldırma.

---

# 7. REACT NATIVE PROJESİ

Yeni proje TypeScript tabanlı olacak.

Önerilen yapı:

```text
E:\tuben
│
├── app/
│
├── src/
│   │
│   ├── api/
│   ├── auth/
│   ├── backend/
│   ├── components/
│   ├── config/
│   ├── constants/
│   ├── domain/
│   ├── features/
│   ├── firebase/
│   ├── hooks/
│   ├── models/
│   ├── native/
│   ├── player/
│   ├── repositories/
│   ├── services/
│   ├── storage/
│   ├── store/
│   ├── types/
│   └── utils/
│
├── assets/
│
├── modules/
│
├── android/
│
├── app.config.ts
├── firebase.json
├── firestore.rules
├── database.rules.json
├── package.json
└── tsconfig.json
```

Gerektiğinde yapıyı projeye göre iyileştirebilirsin.

---

# 8. FIREBASE ANA STRATEJİSİ

Firebase'i üç ayrı göreve böl.

```text
Firebase Authentication
        │
        └── Identity / Session

Cloud Firestore
        │
        └── Persistent cloud user data

Realtime Database
        │
        └── High-frequency / presence / realtime ephemeral state
```

Her veriyi Firestore'a atma.

Her veriyi Realtime Database'e de atma.

Verinin:

```text
kalıcılığı
güncellenme sıklığı
query ihtiyacı
realtime ihtiyacı
boyutu
kullanıcı sayısı
read/write maliyeti
```

incelenerek servis seçilecek.

---

# 9. FIREBASE ÜCRETSİZ KOTA STRATEJİSİ

Proje başlangıçta Firebase Spark ücretsiz planına göre optimize edilecek.

Kod içinde quota harcamasını kontrolsüz artıracak tasarımlar kurma.

Firestore açısından özellikle:

```text
gereksiz onSnapshot
çok geniş collection listener
her render'da query
N+1 document reads
sonsuz listeners
gereksiz document writes
player position'u sürekli Firestore'a yazma
aynı veriyi tekrar tekrar çekme
```

yapma.

Realtime Database tarafında:

```text
root listener
çok büyük node dinleme
gereksiz büyük JSON payload
yüksek frekanslı gereksiz write
```

yapma.

---

# 10. FIREBASE AUTHENTICATION

Authentication için Firebase Authentication kullan.

Başlangıçta desteklenmesi gereken yapı:

```text
Email + Password
Persistent Login
Logout
Account creation
Auth state restoration
Password reset
Optional Google Sign-In
```

Phone/SMS Authentication'ı varsayılan sistem yapma.

SMS gerekmiyorsa kullanma.

Auth için tek bir merkezi servis kur.

Örneğin:

```text
src/firebase/firebaseApp.ts
src/firebase/firebaseAuth.ts

src/auth/AuthProvider.tsx
src/auth/useAuth.ts

src/repositories/AuthRepository.ts
```

UI componentleri doğrudan karmaşık Firebase Auth operasyonları yapmasın.

---

# 11. REACT NATIVE AUTH PERSISTENCE

React Native'de kullanıcı her uygulama açılışında yeniden login olmamalı.

Firebase Authentication persistence doğru kurulmalı.

Örneğin uygun sürüm ve API destekliyorsa:

```ts
initializeAuth(...)
getReactNativePersistence(...)
```

ve AsyncStorage kullanılabilir.

Mantık:

```text
App boot
   ↓
Firebase initialize
   ↓
Restore auth session
   ↓
onAuthStateChanged
   ↓
Auth store/provider
   ↓
Navigation decision
```

olmalıdır.

Auth restore tamamlanmadan:

```text
Login Screen
```

gösterip hemen Home'a atlama gibi flicker oluşturma.

Boot/loading state kullan.

---

# 12. AUTH STATE

Authentication state için tek source of truth oluştur.

Örneğin:

```ts
interface AuthState {
  user: AppUser | null;
  firebaseUser: FirebaseUser | null;
  initialized: boolean;
  loading: boolean;
  error: AppError | null;
}
```

Uygulamanın farklı bölümlerinde ayrı ayrı:

```ts
onAuthStateChanged(...)
```

listenerları oluşturma.

Tek merkezi listener kullan.

---

# 13. FIRESTORE NE İÇİN KULLANILACAK?

Cloud Firestore kalıcı ve query edilmesi gereken kullanıcı verileri için kullanılacak.

Örnek:

```text
users
userProfiles
favorites
playlists
playlistItems
history
subscriptions
userSettings
devices
library
```

Ancak mevcut Kotlin projesindeki özellikleri analiz ederek gerçekten gerekli collectionları oluştur.

Olmayan özellikleri uydurma.

---

# 14. ÖNERİLEN FIRESTORE MODELİ

Örneğin:

```text
users/{uid}
```

document:

```ts
{
  displayName: string;
  email: string | null;
  photoURL: string | null;

  createdAt: Timestamp;
  updatedAt: Timestamp;

  schemaVersion: number;
}
```

Kullanıcıya özel alt collectionlar:

```text
users/{uid}/favorites/{videoId}

users/{uid}/history/{videoId}

users/{uid}/playlists/{playlistId}

users/{uid}/settings/app
```

kullanılabilir.

Veri modelini gerçek proje ihtiyacına göre tasarla.

---

# 15. FIRESTORE'DA DEVASA USER DOCUMENT OLUŞTURMA

Şunu yapma:

```text
users/{uid}

{
  favorites: [10000 item],
  history: [50000 item],
  playlists: [...],
  settings: {...}
}
```

Büyük array'leri tek document içine doldurma.

Favori/history/playlists gibi büyüyen veriler subcollection olarak tutulmalı.

Böylece:

```text
pagination
incremental fetch
targeted updates
```

yapılabilir.

---

# 16. FIRESTORE READ OPTİMİZASYONU

Firestore read sayısını minimum tut.

Örneğin Home ekranında:

```text
favorites
history
playlists
profile
settings
```

koleksiyonlarının tamamını her açılışta getirme.

Sadece ekranın ihtiyaç duyduğu veriyi getir.

Query'lerde:

```text
where
orderBy
limit
startAfter
```

kullan.

Pagination kur.

Örneğin:

```ts
query(
  collection(...),
  orderBy("updatedAt", "desc"),
  limit(20)
)
```

mantığı kullan.

---

# 17. REALTIME LISTENER KURALI

Firestore realtime listener yalnızca gerçekten realtime gerekli olduğunda kullanılacak.

Şunu yapma:

```ts
onSnapshot(entireCollection)
```

ve listenerı uygulama boyunca açık bırakma.

Listener:

```text
screen mount
        ↓
subscribe
        ↓
screen unmount
        ↓
unsubscribe
```

lifecycle'ına sahip olmalı.

Global olarak gerekli listenerlar ayrıca merkezi yönetilmeli.

---

# 18. TANSTACK QUERY / CACHE

Firestore ve mevcut backend verisini gereksiz tekrar okumamak için uygun cache stratejisi kur.

TanStack Query kullanılması mantıklıysa kullan.

Örneğin:

```text
Firebase / API
      ↓
Repository
      ↓
Query Cache
      ↓
Hooks
      ↓
UI
```

Ancak realtime subscription ile query cache'in birbirleriyle kavga etmesini engelle.

Firebase cache + app cache katmanlarının görevlerini açıkça belirle.

---

# 19. REALTIME DATABASE NE İÇİN KULLANILACAK?

Firebase Realtime Database yalnızca yüksek frekanslı veya gerçekten realtime state için tercih edilecek.

Örnek:

```text
presence
online/offline
lastSeen
activeDevice

gerekirse:
cross-device playback state
live session
temporary sync
```

Kalıcı kullanıcı kütüphanesini RTDB'ye koyma.

---

# 20. PRESENCE SİSTEMİ

Online/offline durumu gerekiyorsa:

```text
Realtime Database
```

üzerinden kur.

Örnek:

```text
/status/{uid}/{connectionId}
```

veya ihtiyaca uygun benzeri yapı.

Firebase'in:

```text
.info/connected
onDisconnect()
server timestamp
```

mekanizmalarından yararlan.

Mantık:

```text
Client connects
      ↓
.info/connected = true
      ↓
register onDisconnect
      ↓
mark connection online
      ↓
connection lost
      ↓
Firebase server executes onDisconnect
```

olmalıdır.

Önce `onDisconnect` kaydını oluştur, sonra online yaz.

Race condition oluşturma.

---

# 21. PLAYER STATE FIRESTORE'A YAZILMAYACAK

ÇOK ÖNEMLİ.

Şunu yapma:

```text
player position:
00:01
00:02
00:03
...
```

ve her saniye Firestore write.

Bu Firestore kotasını gereksiz tüketir.

Player position için öncelik:

```text
local memory
↓
local storage
↓
gerekiyorsa throttled realtime sync
```

olmalıdır.

Bulut sync gerekiyorsa örneğin:

```text
track değişti
pause oldu
app background oldu
30-60 saniyede bir checkpoint
playback sona erdi
```

gibi event bazlı sync kullanılabilir.

Her frame veya her saniye write yapma.

---

# 22. REALTIME PLAYER SYNC

Eğer farklı cihazlar arasında canlı playback synchronization gerçekten gerekiyorsa Firestore yerine RTDB değerlendir.

Örneğin:

```text
/liveSessions/{uid}
```

altında:

```ts
{
  mediaId: string;
  positionMs: number;
  playing: boolean;
  updatedAt: number;
  deviceId: string;
}
```

gibi hafif state tutulabilir.

Ancak yine throttle/debounce uygula.

Örneğin position sürekli yazılmak yerine belirli aralıklarla checkpoint edilebilir.

---

# 23. SERVER TIMESTAMP

Client clock'a güvenilmesi gerekmeyen alanlarda Firebase server timestamp kullan.

Örneğin:

```text
createdAt
updatedAt
lastSeen
history timestamp
```

mümkünse server tarafından belirlenmeli.

---

# 24. USER DATA REPOSITORY

UI Firebase SDK'yı doğrudan kullanmasın.

Örneğin:

```text
UI
 ↓
useFavorites()
 ↓
FavoritesRepository
 ↓
FirestoreFavoritesDataSource
 ↓
Firebase
```

kullan.

Benzer şekilde:

```text
AuthRepository
UserRepository
FavoritesRepository
HistoryRepository
PlaylistRepository
PresenceRepository
```

kurulabilir.

Ancak gereksiz abstraction oluşturma.

---

# 25. FIREBASE INITIALIZATION

Firebase initialization merkezi olmalı.

Örneğin:

```text
src/firebase/
├── app.ts
├── auth.ts
├── firestore.ts
├── realtime.ts
└── index.ts
```

Tek Firebase App instance kullanılmalı.

Hot reload nedeniyle duplicate app initialization oluşturma.

Mantık yaklaşık olarak:

```ts
const app =
  getApps().length === 0
    ? initializeApp(firebaseConfig)
    : getApp();
```

şeklinde güvenli olmalı.

Kullanılan Firebase SDK sürümüne göre doğru güncel API'yi uygula.

---

# 26. FIREBASE CONFIG

Firebase client config'in yapısını doğru değerlendir.

Config:

```text
apiKey
authDomain
projectId
databaseURL
storageBucket
messagingSenderId
appId
```

gibi bilgiler içerebilir.

Firebase client config'i klasik backend secret gibi değerlendirme.

Ancak gerçek gizli bilgileri asla client'a koyma:

```text
service account private key
Admin SDK credentials
server secrets
private API secrets
```

Client içinde OLMAMALI.

---

# 27. ENVIRONMENT

Firebase config için:

```text
.env
.env.example
app.config.ts
```

yapısı oluşturulabilir.

Örneğin isimlendirme:

```text
EXPO_PUBLIC_FIREBASE_API_KEY
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN
EXPO_PUBLIC_FIREBASE_PROJECT_ID
EXPO_PUBLIC_FIREBASE_DATABASE_URL
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
EXPO_PUBLIC_FIREBASE_APP_ID
```

Ancak `.env` kullanılması Firebase Security Rules yerine geçmez.

Firebase database güvenliği mutlaka rules ile sağlanacak.

---

# 28. FIRESTORE SECURITY RULES

Production ortamında:

```text
allow read, write: if true;
```

YASAK.

Kullanıcı yalnızca izin verilen kendi verisine erişmeli.

Temel mantık:

```text
request.auth != null
```

ve:

```text
request.auth.uid == userId
```

kontrolleri olmalı.

Örneğin kullanıcıya ait:

```text
users/{uid}
users/{uid}/favorites/*
users/{uid}/history/*
users/{uid}/playlists/*
```

verilerini başka kullanıcı okuyamamalı/yazamamalı.

---

# 29. SECURITY RULE DATA VALIDATION

Rules sadece:

```text
logged in mi?
```

kontrolü yapmamalı.

Mümkün olduğunda data schema'yı da doğrula.

Örneğin:

```text
uid değiştirilemez
ownerId değiştirilemez
createdAt değiştirilmemeli
string uzunluğu sınırı
izin verilen alanlar
izin verilen veri tipleri
```

kontrol edilmeli.

Client'ın:

```text
isAdmin: true
```

yazabilmesi gibi güvenlik açıkları oluşturma.

---

# 30. REALTIME DATABASE RULES

RTDB de production rules ile korunmalı.

Root seviyesinde public read/write açma.

Örneğin:

```text
/status/{uid}
```

için sadece ilgili kullanıcı yazabilmeli.

Gerekli ise read politikası ayrıca tasarlanmalı.

---

# 31. FIREBASE EMULATOR

Mümkünse Firebase Emulator Suite desteği ekle.

Development sırasında:

```text
Authentication Emulator
Firestore Emulator
Realtime Database Emulator
```

kullanılabilsin.

Production verisini test amacıyla kirletme.

Development config üzerinden emulator bağlantısı kontrol edilebilir.

---

# 32. FIREBASE SECURITY RULE TESTLERİ

Rules test edilmeden production'a bırakılmamalı.

En az:

```text
unauthenticated user denied
user A cannot modify user B
user can read own data
user can create valid favorite
invalid document rejected
```

senaryolarını test et.

---

# 33. FIREBASE APP CHECK

Firebase App Check kullanımını değerlendir.

Ama Expo/React Native environment'ında destek durumunu kontrol etmeden körlemesine ekleme.

React Native Firebase JavaScript SDK ortamında App Check için native attestation gerekiyorsa uygun native/custom provider yaklaşımını değerlendir.

Development build'de debug provider gerekiyorsa production provider ile karıştırma.

App Check, Security Rules'ın yerine geçmez.

İkisi birlikte çalışmalıdır.

---

# 34. FIREBASE AUTH + FIRESTORE USER CREATION

Yeni hesap açıldığında:

```text
Firebase Auth user
```

oluşması ile:

```text
Firestore users/{uid}
```

profil documenti oluşturulmasını kontrollü şekilde yönet.

Duplicate profile document oluşturma.

Auth başarılı olup profil write başarısız olursa retry/recovery stratejisi kur.

---

# 35. AUTH HATALARI

Firebase hata kodlarını doğrudan kullanıcıya gösterme.

Örneğin:

```text
auth/invalid-credential
auth/email-already-in-use
auth/weak-password
auth/network-request-failed
```

uygulama hata modeline map edilmeli.

UI kullanıcıya anlaşılır mesaj göstermeli.

---

# 36. LOGOUT

Logout yalnızca:

```ts
signOut()
```

çağırmak değildir.

Logout sırasında kullanıcıya özel:

```text
Zustand state
query cache
Firebase listeners
presence connection
private local cache
```

temizlenmeli veya doğru şekilde resetlenmeli.

Başka kullanıcının login olması durumunda önceki hesabın private datası görünmemeli.

---

# 37. BACKEND VE FIREBASE AYRIMI

Mevcut Kotlin backend'i Firebase uğruna yeniden yazma.

Örneğin Kotlin app:

```text
Innertube
custom REST
video resolver
streaming API
parser
```

kullanıyorsa bunlar aynen migration planında korunabilir.

Firebase'in görevi:

```text
user identity
user-owned cloud data
sync
realtime features
```

olabilir.

Mevcut video/search backend'i doğrudan Firebase'e taşımaya çalışma.

---

# 38. BACKEND ANALİZİ

Kotlin tarafında bul:

```text
BASE_URL
Retrofit
OkHttp
Interceptor
Authenticator
Bearer
Cookie
Header
POST body
Multipart
WebSocket
Continuation
Pagination
Streaming resolver
Timeout
Retry
User-Agent
Origin
Referer
```

Backend davranışını koru.

React Native'de merkezi network client kur.

---

# 39. NETWORK MİMARİSİ

Örneğin:

```text
src/api/client.ts
src/api/errors.ts
src/api/interceptors.ts
src/api/endpoints.ts
```

oluştur.

UI içinde rastgele:

```ts
fetch(...)
```

kullanma.

Destekle:

```text
timeout
abort
retry
auth
error normalization
network detection
401
403
404
429
5xx
```

---

# 40. TYPESCRIPT

Mümkün olduğunca:

```text
.ts
.tsx
```

kullan.

Kaçınılabilir:

```ts
any
```

kullanma.

Firebase document modellerini type-safe tanımla.

Örneğin:

```ts
export interface FavoriteDocument {
  videoId: string;
  title: string;
  thumbnailUrl?: string;
  createdAt: Timestamp;
}
```

Gerekiyorsa Firestore converter kullan.

---

# 41. FIRESTORE DOCUMENT BOYUTUNU KÜÇÜK TUT

Video metadata gibi backend'den yeniden elde edilebilecek devasa response'ları Firestore'a dump etme.

Örneğin favoride gerekiyorsa yalnızca:

```text
videoId
title
thumbnail
channelId
duration
createdAt
```

gibi UI için gerekli minimum snapshot tut.

Megabaytlarca backend JSON'u saklama.

---

# 42. DUPLICATION STRATEJİSİ

Firestore NoSQL olduğundan kontrollü denormalization kabul edilebilir.

Ancak aynı büyük veriyi yüzlerce yere kopyalama.

Öncelik:

```text
minimum reads
reasonable writes
small documents
simple queries
```

dengesidir.

---

# 43. HISTORY OPTİMİZASYONU

History mevcutsa her playback tick'te Firestore write yapma.

History kaydını örneğin:

```text
video opened
meaningful playback occurred
player background oldu
video değişti
playback sona erdi
```

eventlerinde güncelle.

Position update gerekiyorsa throttle uygula.

---

# 44. FAVORITES

Favorite toggle:

```text
users/{uid}/favorites/{videoId}
```

şeklinde idempotent tasarlanabilir.

Aynı videonun birden fazla duplicate favorite document oluşturmasını engelle.

---

# 45. PLAYLIST

Playlist için:

```text
users/{uid}/playlists/{playlistId}
```

ve gerekiyorsa:

```text
users/{uid}/playlists/{playlistId}/items/{itemId}
```

kullan.

Dev playlist'i tek array document içinde tutma.

---

# 46. LOCAL-FIRST DÜŞÜN

Her UI interaction Firebase round-trip beklememeli.

Uygun durumlarda:

```text
optimistic UI
local state
query cache
local persistence
background sync
```

kullan.

Örneğin favorite tıklaması kullanıcıya anında yansıyabilir; cloud write sonradan tamamlanabilir.

Write başarısız olursa rollback/error stratejisi kullan.

---

# 47. PLAYER / MEDIA ANALİZİ

Kaynak uygulamada player varsa şu özellikleri analiz et:

```text
play
pause
seek
queue
next
previous
repeat
shuffle
buffer
error
retry
audio focus
Bluetooth
headset
background
lock screen
notification
media button
process lifecycle
```

Player UI'dan bağımsız yaşamayı gerektiriyorsa native service kullan.

---

# 48. BACKGROUND PLAYBACK

Gerekirse:

```text
React Native UI
      ↓
Player Store
      ↓
Playback Service
      ↓
Expo Native Module
      ↓
Kotlin
      ↓
Foreground Service
      ↓
MediaSession
```

mimarisi kullan.

UI unmount olduğunda player yanlışlıkla release edilmemeli.

---

# 49. PLAYER STATE KATMANLARI

Player state'i üç seviyeye ayır:

```text
1. In-memory live playback state

2. Local persistent resume state

3. Optional cloud sync checkpoint
```

Canlı position state ile cloud state'i aynı şey yapma.

---

# 50. CONCURRENCY

Şunları test et:

```text
rapid next
rapid previous
rapid search
source change during seek
screen unmount
network cancellation
player release
queue mutation
Firebase listener cleanup
logout during sync
auth state change
```

Stale async task'ın yeni state'i ezmesini engelle.

AbortController, operation id veya generation token gibi kontrollü çözümler kullan.

---

# 51. LOCAL STORAGE

Kotlin'de:

```text
SharedPreferences
DataStore
Room
Files
SQLite
```

kullanılan yerleri analiz et.

Her şeyi Firebase'e taşımak zorunda değilsin.

Örneğin:

```text
theme
temporary player state
cache metadata
device-only settings
```

lokalde tutulabilir.

Cloud sync gerçekten gereken veriyi Firebase'e koy.

---

# 52. CLOUD VS LOCAL KARARI

Her veri için şu soruları sor:

```text
Bu veri başka cihazda gerekli mi?

Bu veri kullanıcı hesabına bağlı mı?

Realtime gerekli mi?

Bu veri yeniden üretilebilir mi?

Sık mı değişiyor?

Boyutu büyük mü?

Firestore read/write harcar mı?
```

Sonra:

```text
Memory
Local Storage
Firestore
Realtime Database
Existing Backend
```

arasından doğru yeri seç.

---

# 53. UI MIGRATION

Her ekran için:

```text
purpose
inputs
state
backend
Firebase usage
loading
empty
error
navigation
native operations
```

çıkar.

Sonra React Native'e taşı.

Responsive tasarım kullan.

Destekle:

```text
safe area
different screen sizes
keyboard
Android navigation bar
font scaling
```

---

# 54. NAVIGATION

Kaynak navigation graph'ını çıkar.

Yeni projede mümkünse Expo Router veya uygun React Navigation mimarisi kullan.

Auth route yapısı örneğin:

```text
app/
├── _layout.tsx
├── (auth)/
│   ├── login.tsx
│   ├── register.tsx
│   └── forgot-password.tsx
│
└── (app)/
    ├── index.tsx
    ├── search.tsx
    ├── library.tsx
    ├── settings.tsx
    ├── video/[id].tsx
    └── channel/[id].tsx
```

gibi olabilir.

Gerçek uygulamaya göre adapte et.

---

# 55. STATE MANAGEMENT

State'i ayır:

```text
UI state
Server/backend state
Firebase state
Auth state
Player state
Persistent local state
Realtime state
```

Her şeyi tek Zustand store'a koyma.

Gerektiğinde:

```text
React state
Context
Zustand
TanStack Query
```

görev bazlı kullan.

---

# 56. CACHE

Ayır:

```text
memory cache
image cache
backend query cache
Firestore query cache
local persistence
media cache
search cache
```

Cache invalidation stratejisini belirle.

---

# 57. PERMISSIONS

AndroidManifest'i analiz et.

Örneğin:

```text
INTERNET
POST_NOTIFICATIONS
FOREGROUND_SERVICE
FOREGROUND_SERVICE_MEDIA_PLAYBACK
WAKE_LOCK
READ_MEDIA_AUDIO
READ_MEDIA_VIDEO
BLUETOOTH_CONNECT
```

gerekli olanları Expo config'e taşı.

Gereksiz permission isteme.

---

# 58. ASSETS

Kaynak:

```text
drawable
mipmap
font
raw
assets
```

dosyalarını analiz et.

Gerekenleri hedef projeye KOPYALA.

Kaynak projeyi değiştirme.

---

# 59. SECURITY

Şunları client içine koyma:

```text
Firebase Admin credentials
service account JSON
private keys
backend secrets
database admin credentials
```

Firebase Authentication kullanıcı tokenını debug loglarda basma.

Password loglama.

Secret header loglama.

---

# 60. FIREBASE ADMIN SDK

Mobil uygulamada Firebase Admin SDK KULLANMA.

Admin SDK yalnızca güvenilir server environment'ında kullanılabilir.

Şunu yapma:

```text
React Native app
→ Firebase Admin SDK
```

Client:

```text
Firebase Client SDK
```

kullanmalı.

Privileged işlemler gerekiyorsa güvenilir backend gerekir.

---

# 61. CLOUD FUNCTIONS KONUSU

Spark planını korumak ana hedef olduğu için Cloud Functions'ı gereksiz yere architecture'ın merkezine koyma.

İş client + Security Rules + mevcut backend ile güvenli şekilde yapılabiliyorsa yeni serverless function oluşturma.

Privileged server operation gerçekten gerekiyorsa ayrıca değerlendir ve plan/ücret gereksinimini açıkça belirt.

---

# 62. FIREBASE USAGE MONITORING

Firebase Console üzerinden kullanımın takip edilebilmesi için Firebase kullanımını merkezi servislerden geçir.

Development sırasında istenirse şu loglar üretilebilir:

```text
[FIREBASE_AUTH]
[FIRESTORE_READ]
[FIRESTORE_WRITE]
[RTDB]
[PRESENCE]
```

Ancak production'da aşırı verbose logging kapat.

---

# 63. FREE-TIER GUARDRAILS

Kod review sırasında özellikle ara:

```text
onSnapshot
onValue
setInterval + Firebase write
player progress write
unbounded query
collection get without limit
listener without unsubscribe
duplicate auth listener
duplicate RTDB subscription
```

Bunlar varsa tek tek değerlendir.

---

# 64. FIREBASE QUOTA BUDGET

Mimariyi yaklaşık quota bütçesi düşünerek tasarla.

Örneğin bir kullanıcı Home ekranını açtığında yüzlerce Firestore read oluşturmak kabul edilemez.

Bir user action için mümkün olduğunca:

```text
0-çok az reads
0-1 gerekli write
```

hedeflenmeli.

Kesin sayı özelliğe göre değişebilir.

Ana amaç kontrolsüz read amplification oluşturmamaktır.

---

# 65. FIREBASE CLEANUP

Component veya feature kapanırken tüm subscriptions temizlenmeli.

Örneğin:

```ts
const unsubscribe = onSnapshot(...)

return () => {
  unsubscribe()
}
```

veya kullanılan SDK'ya uygun cleanup uygulanmalı.

---

# 66. APP LIFECYCLE + FIREBASE

App:

```text
active
background
inactive
terminated
```

durumlarını düşün.

Realtime presence/player sync gerekiyorsa AppState ile Firebase lifecycle birlikte tasarlanmalı.

Background'a geçtiğinde gereksiz live listenerları açık tutup veri tüketme.

Ancak kritik global listenerları yanlışlıkla da kapatma.

---

# 67. FIREBASE OFFLINE DAVRANIŞI

Kullandığın Firebase SDK'nın React Native ortamındaki gerçek offline persistence desteğini kontrol et.

Web dokümanındaki persistence davranışını React Native'e körlemesine uygulama.

Firebase JS SDK'nın React Native için desteklemediği persistence özelliği varsa:

```text
AsyncStorage
local database
TanStack Query persistence
```

gibi uygun local strategy kur.

---

# 68. KOTLIN FIREBASE KODU VARSA

Kaynak Kotlin projesinde Firebase zaten kullanılıyorsa:

```text
google-services.json
FirebaseAuth
FirebaseFirestore
FirebaseDatabase
FirebaseMessaging
Crashlytics
Analytics
```

arama yap.

Mevcut Firebase schema ve davranışı varsa gereksiz yere yeni schema tasarlama.

Önce mevcut sistemi analiz et.

---

# 69. FIREBASE PROJECT CONFIG

Firebase project hazırsa mevcut:

```text
projectId
applicationId/packageName
SHA fingerprints
Authentication providers
Firestore database
Realtime Database
Security Rules
```

yapısını analiz et.

Yeni Android package değişiyorsa Firebase Console tarafında yeni Android app registration gerekebileceğini belirt.

`google-services.json` gerekiyorsa doğru app registration'a ait dosyayı kullan.

---

# 70. NATIVE FIREBASE KARARI

Öncelikle Firebase JavaScript SDK ile ihtiyacın karşılanıp karşılanmadığını değerlendir.

Eğer yalnızca:

```text
Auth
Firestore
Realtime Database
```

gerekiyorsa ve kullanılan özellikler React Native JS SDK tarafından destekleniyorsa gereksiz native Firebase dependency ekleme.

Ancak ihtiyaç:

```text
native Firebase functionality
unsupported JS SDK behavior
native Android integration
```

gerektiriyorsa Expo Development Build ile native Firebase çözümünü değerlendir.

İki ayrı Firebase stack'i sebepsiz yere aynı projede karıştırma.

---

# 71. ERROR MODEL

Merkezi hata modeli oluştur.

Örneğin:

```ts
export type AppErrorType =
  | 'network'
  | 'timeout'
  | 'authentication'
  | 'permission'
  | 'firebase'
  | 'backend'
  | 'rate-limit'
  | 'playback'
  | 'not-found'
  | 'unknown';

export interface AppError {
  type: AppErrorType;
  code?: string;
  message: string;
  cause?: unknown;
}
```

Firebase errorlarını bu modele normalize et.

---

# 72. LOGGING

Development log kategorileri:

```text
[API]
[FIREBASE]
[AUTH]
[FIRESTORE]
[RTDB]
[PLAYER]
[NATIVE]
[STORAGE]
[CACHE]
[NAVIGATION]
```

olabilir.

Sensitive data loglama.

---

# 73. TEST

Her önemli migration aşamasında çalıştır:

```bash
npx tsc --noEmit
```

Lint varsa çalıştır.

Testler varsa çalıştır.

Firebase repository'ler için unit test yazılabiliyorsa yaz.

Security Rules için emulator tests değerlendir.

---

# 74. ANDROID BUILD

Native kod gerekiyorsa development build üret.

Gerekirse:

```bash
npx expo prebuild
```

sonrasında Windows:

```powershell
cd android
.\gradlew assembleDebug
```

çalıştır.

Gradle/Kotlin/Manifest hatalarını çöz.

---

# 75. BUILD QUALITY GATES

Final durumda mümkün olduğunca:

```text
TypeScript                 PASS
Lint                       PASS
Unit tests                 PASS
Firebase rules tests       PASS
Metro                      PASS
Expo config                PASS
Android compile            PASS
Android debug build        PASS
App launch                 PASS
Firebase Auth              PASS
Firestore                  PASS
Realtime Database          PASS
Backend                    PASS
Navigation                 PASS
Player                     PASS
Background playback        PASS
```

olmalı.

---

# 76. FEATURE PARITY

Gerçek feature listesi çıkar.

Örneğin:

```text
FEATURE                    KOTLIN    RN       CLOUD       STATUS

Home                        ✅        ✅       N/A         DONE
Search                      ✅        ✅       N/A         DONE
Player                      ✅        ✅       Local       DONE
Login                       -         ✅       Auth        DONE
Favorites                   ✅        ✅       Firestore   DONE
History                     ✅        ✅       Firestore   DONE
Presence                    -         ✅       RTDB        DONE
Settings                    ✅        ✅       Firestore   DONE
```

Gerçek uygulamaya göre düzenle.

---

# 77. MOCK DATA

Final production implementation içinde mock data bırakma.

Mevcut backend varsa gerçek backend kullan.

Firebase feature ise gerçek repository kullan.

Şunlarla işi bitirme:

```ts
const mockVideos = [...]
```

---

# 78. PLACEHOLDER

Kritik yerde:

```ts
// TODO
throw new Error("Not implemented")
return null
```

bırakıp özelliği tamamlanmış sayma.

---

# 79. SOURCE OF TRUTH

Kotlin davranışı konusunda şüphe varsa:

```text
E:\tubentrailer
```

source of truth'tur.

Firebase açısından yeni özellik eklenirken mevcut Kotlin business logic'i yanlışlıkla değiştirme.

---

# 80. İŞ FAZLARI

Çalışmayı şu sırayla yap.

```text
[x] FAZ 0: Environment (BURAYA KADAR YAPILDI - 11.09.2026)
[x] FAZ 1: Full Kotlin analysis (BURAYA KADAR YAPILDI - 11.09.2026)
[x] FAZ 2: Screen + backend + native + storage map (BURAYA KADAR YAPILDI - 11.09.2026)
[x] FAZ 3: Firebase data architecture (BURAYA KADAR YAPILDI - 11.09.2026)
[x] FAZ 4: React Native / Expo foundation (BURAYA KADAR YAPILDI - 11.09.2026)
[x] FAZ 5: TypeScript models (BURAYA KADAR YAPILDI - 11.09.2026)
[x] FAZ 6: Existing backend migration (BURAYA KADAR YAPILDI - 11.09.2026)
[x] FAZ 7: Firebase initialization (BURAYA KADAR YAPILDI - 11.09.2026)
[x] FAZ 8: Authentication (BURAYA KADAR YAPILDI - 11.09.2026)
[x] FAZ 9: Firestore repositories (BURAYA KADAR YAPILDI - 11.09.2026)
[x] FAZ 10: Realtime Database / presence (BURAYA KADAR YAPILDI - 11.09.2026)

FAZ 11
Screens

FAZ 3
Firebase data architecture

FAZ 4
React Native / Expo foundation

FAZ 5
TypeScript models

FAZ 6
Existing backend migration

FAZ 7
Firebase initialization

FAZ 8
Authentication

FAZ 9
Firestore repositories

FAZ 10
Realtime Database / presence

[x] FAZ 11: Screens & Navigation (BURAYA KADAR YAPILDI - 11.09.2026)

[x] FAZ 12: Player / Media System (BURAYA KADAR YAPILDI - 11.09.2026)

[x] FAZ 13: Background Service & Native Audio (BURAYA KADAR YAPILDI - 11.09.2026)

[x] FAZ 14: Local Storage & Cache (BURAYA KADAR YAPILDI - 11.09.2026)

[x] FAZ 15: Security Rules (BURAYA KADAR YAPILDI - 11.09.2026)

[x] FAZ 16: Tests & Verification (BURAYA KADAR YAPILDI - 11.09.2026)

FAZ 17
Android build

FAZ 18
Performance + Firebase quota audit

FAZ 19
Cleanup

FAZ 20
Final report
```

---

# 81. FIREBASE DATA ARCHITECTURE RAPORU

Kodlamadan önce şu tabloyu çıkar:

```text
DATA                    LOCATION             REASON

Authentication          Firebase Auth        identity
User profile            Firestore            persistent
Favorites               Firestore            persistent/queryable
History                 Firestore/local      cloud sync
Settings                Firestore/local      cross-device
Presence                RTDB                 realtime
Player position         Local                high frequency
Player checkpoint       Firestore/RTDB       optional/throttled
Video catalog           Existing backend     already available
Search results          Existing backend     transient
```

Gerçek uygulamaya göre değiştir.

Her Firebase collection/node için neden seçildiğini belirt.

---

# 82. MİMARİ

Hedef mimari yaklaşık:

```text
                         REACT NATIVE UI
                                │
                                ▼
                       PRESENTATION LAYER
                                │
                                ▼
                           DOMAIN LAYER
                                │
                                ▼
                          REPOSITORIES
                 ┌──────────────┼──────────────┐
                 │              │              │
                 ▼              ▼              ▼
          EXISTING API      FIREBASE       LOCAL DATA
                 │              │              │
                 │        ┌─────┼─────┐        │
                 │        │     │     │        │
                 ▼        ▼     ▼     ▼        ▼
             Backend     Auth  Fire  RTDB    AsyncStorage/
                               store          Local DB


PLAYER:

React Native UI
       │
       ▼
Player Store
       │
       ▼
Playback Domain
       │
       ├────────► Local Resume State
       │
       ├────────► Optional Cloud Checkpoint
       │
       ▼
Native Player Module
       │
       ▼
Kotlin Android
       │
       ▼
Foreground Service / MediaSession
```

---

# 83. FIREBASE PERFORMANS PRENSİBİ

Her Firebase feature için şu soruyu sor:

```text
Bu listener gerçekten gerekiyor mu?

Bu veri local cache'de zaten var mı?

Bu query limitli mi?

Bu write gerçekten gerekli mi?

Bu veri Firestore yerine RTDB olmalı mı?

Bu veri Firebase'e hiç gitmemeli mi?
```

Firebase'i kolay olduğu için her probleme çözüm olarak kullanma.

---

# 84. FIREBASE SECURITY PRENSİBİ

Şunu asla düşünme:

```text
Firebase API key gizli değil,
o zaman database de güvende.
```

Database'i koruyan şey:

```text
Authentication
+
Security Rules
+
Data validation
+
gerekirse App Check
```

kombinasyonudur.

---

# 85. DOKÜMANTASYON

TARGET_PROJECT içine mümkünse:

```text
README.md
MIGRATION.md
FIREBASE.md
```

oluştur.

`FIREBASE.md` içinde:

```text
Firebase project setup
Authentication providers
Environment variables
Firestore schema
Realtime Database schema
Security Rules
Emulator usage
Data ownership
Quota optimization
Production deployment
```

anlat.

---

# 86. FINAL FIREBASE RAPORU

Final raporda ayrıca aşağıdakileri açıkça göster:

```text
FIREBASE

Authentication:
- kullanılan providerlar
- persistence yöntemi
- auth flow

Firestore:
- collections
- documents
- indexes
- pagination
- realtime listeners

Realtime Database:
- nodes
- presence
- listeners
- onDisconnect

Security:
- Firestore Rules
- RTDB Rules
- App Check durumu

Optimization:
- read azaltma yöntemleri
- write azaltma yöntemleri
- listener lifecycle
- local cache strategy

Free-tier risks:
- yüksek read üretebilecek yerler
- yüksek write üretebilecek yerler
- RTDB connection riski
```

---

# 87. FINAL MIGRATION RAPORU

İş bittiğinde:

```text
MIGRATION RESULT

Source:
E:\tubentrailer

Target:
E:\tuben

1. Kotlin architecture
2. Screens
3. Existing backend
4. React Native architecture
5. Firebase architecture
6. Authentication
7. Firestore
8. Realtime Database
9. Security Rules
10. Local storage
11. Cache
12. Native modules
13. Player
14. Background services
15. Build
16. Tests
17. Feature parity
18. Firebase quota audit
19. Known issues
20. Future improvements
```

raporunu ver.

---

# SON VE EN ÖNEMLİ TALİMAT

Bu göreve:

```text
"Kotlin'i JavaScript'e çevir"
```

şeklinde yaklaşma.

Gerçek süreç:

```text
KOTLIN PROJESİNİ ANALİZ ET
        ↓
FEATURE'LARI ÇIKAR
        ↓
BACKEND'İ ANLA
        ↓
NATIVE ANDROID DAVRANIŞINI ANLA
        ↓
LOCAL DATA'YI ANLA
        ↓
CLOUD'A GİTMESİ GEREKEN VERİYİ BELİRLE
        ↓
FIREBASE VERİ MİMARİSİNİ TASARLA
        ↓
REACT NATIVE + EXPO TEMELİNİ KUR
        ↓
AUTHENTICATION'I KUR
        ↓
FIRESTORE'U KUR
        ↓
REALTIME DATABASE'İ KUR
        ↓
SECURITY RULES YAZ
        ↓
BACKEND'İ MIGRATE ET
        ↓
EKRANLARI MIGRATE ET
        ↓
PLAYER/NATIVE SİSTEMİ MIGRATE ET
        ↓
LOCAL CACHE + CLOUD SYNC KUR
        ↓
TEST ET
        ↓
FIREBASE KOTA AUDIT YAP
        ↓
ANDROID BUILD AL
```

Firebase konusunda ana prensip:

```text
AUTH
→ Firebase Authentication

KALICI KULLANICI VERİSİ
→ Cloud Firestore

YÜKSEK FREKANSLI REALTIME VERİ
→ Realtime Database

ÇOK YÜKSEK FREKANSLI PLAYER STATE
→ Öncelikle local memory/storage

VİDEO/SEARCH/BACKEND VERİSİ
→ Mevcut backend
```

olmalıdır.

Firebase kullanılacak diye mevcut sağlam backend mimarisini gereksiz yere Firebase'e taşıma.

Firebase kullanılacak diye her state'i cloud'a yazma.

Ücretsiz Spark kotasını korumak için:

```text
minimum reads
minimum writes
limited queries
pagination
listener cleanup
local cache
event-based sync
throttled realtime updates
```

uygula.

Son hedef:

**Mevcut Kotlin uygulamasının davranışlarını mümkün olduğunca eksiksiz koruyan, React Native + Expo kullanan, gerektiğinde native Kotlin modüllerine sahip, Firebase Authentication + Cloud Firestore + Realtime Database ile kullanıcı hesabı ve cloud sync sağlayan ve Firebase ücretsiz kotasını mümkün olduğunca verimli kullanan production seviyesinde yeni uygulama oluşturmak.**

---
- **Sonuç**: 20 Fazın Tamamı Eksiksiz Tamamlandı, APK Derlendi ve Doğrulandı.
- [x] BURAYA KADAR YAPILDI