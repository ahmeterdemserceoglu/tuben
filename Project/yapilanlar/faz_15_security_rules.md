# FAZ 15: Security Rules (Firestore & RTDB)

**Tarih:** 11 Eylül 2026  
**Durum:** Tamamlandı  
**Doğrulama:** Tam Korumalı (Zero Public Access)  

---

## 1. Genel Bakış

Firebase ücretsiz Spark kotasını korumak, kullanıcı verilerini izole etmek ve veritabanı saldırılarını önlemek amacıyla Cloud Firestore ve Firebase Realtime Database için sıfır toleranslı güvenlik kuralları yazılmıştır.

---

## 2. Cloud Firestore Kuralları (`firestore.rules`)

1. **Varsayılan Engel:** Tüm tanımlanmamış koleksiyon ve dokümanlar için `allow read, write: if false;` ile dış erişim tamamen kapatılmıştır.
2. **Kullanıcı İzolasyonu (`request.auth.uid == userId`):** Hiçbir kullanıcı başka bir kullanıcının profilini, beğenilerini, geçmişini veya aboneliklerini okuyamaz veya değiştiremez.
3. **Şema Doğrulaması:**
   - Profil oluştururken `uid`, `createdAt`, `updatedAt` zorunludur.
   - Profil güncellenirken `uid` ve `createdAt` alanlarının değiştirilmesi engellenir.
   - `delete: if false;` ile kullanıcı hesaplarının istemciden kalıcı olarak silinmesi engellenir.
   - Beğeniler, geçmiş ve aboneliklerde string tip kontrolleri yapılır.
   - Özel oynatma listesi başlıkları maksimum 100 karakter ile sınırlandırılmıştır.

---

## 3. Realtime Database Kuralları (`database.rules.json`)

1. Kök seviyesinde okuma ve yazma tamamen yasaklanmıştır (`.read: false`, `.write: false`).
2. `/presence/$uid`: Yalnızca oturum açmış kullanıcı kendi çevrimiçi durumunu yazabilir (`auth.uid === $uid`). `newData.hasChildren(['online'])` ile veri tipi doğrulaması yapılır.
3. `/ephemeral/$uid`: Yalnızca ilgili oturum sahibi okuyabilir ve yazabilir.

---

## 4. Emulator Yapılandırması (`firebase.json`)

- Firestore Kuralları: `firestore.rules`
- Realtime Database Kuralları: `database.rules.json`
- Emulator Portları: Auth (9099), Firestore (8080), RTDB (9000), UI (4000).

---
**[x] BURAYA KADAR YAPILDI: FAZ 15 TAMAMLANDI**
