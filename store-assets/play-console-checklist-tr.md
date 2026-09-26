# Tuben — Play Console beyan kontrol listesi

Bu dosya Play Console formlarını doldururken kaynak koddaki mevcut davranışı özetler. Google'ın formdaki güncel tanımları esas alınmalıdır.

## Play Console durumu — 26 Eylül 2026

- Play Console uygulaması oluşturuldu: `com.tuben.app`.
- Türkçe mağaza açıklamaları, uygulama simgesi, özellik görseli ve iki telefon ekran görüntüsü yüklendi.
- Gizlilik politikası kaydedildi ve `https://ahmeterdemserceoglu.github.io/tuben/gizlilik/` adresinde yayınlandı.
- Reklam, resmi kurum, finans ve sağlık beyanları tamamlandı.
- Uygulama erişimi, misafir oturumuyla temel özelliklerin incelenebileceği açıklanarak tamamlandı.
- Hedef kitle `13–15`, `16–17` ve `18+` olarak kaydedildi.
- IARC içerik derecelendirme anketi tamamlandı; üçüncü taraf video ve yorum içeriği için ihtiyatlı yanıtlar verildi.
- Veri Güvenliği anketi tamamlandı ve Yayınlama özetine kaydedildi.
- Kategori `Video Oynatıcılar ve Düzenleyiciler` olarak seçildi.
- Herkese açık destek e-postası `ahmeterdemserceoglo@gmail.com`, web sitesi `https://ahmeterdemserceoglu.github.io/tuben/` olarak kaydedildi.
- Hesap/veri silme URL'si `https://ahmeterdemserceoglu.github.io/tuben/hesap-silme/` olarak kaydedildi.
- Mağaza kurulumu için gereken içerik ve giriş taslakları tamamlandı. Değişiklikler Yayınlama özetinde bekliyor; incelemeye gönderilmedi.
- Üretim erişimi için henüz kapalı test sürümü, 12 test kullanıcısı ve kesintisiz 14 günlük test şartı tamamlanmadı.

## Uygulama erişimi

- Temel özellikler hesap olmadan kullanılabilir.
- Test ekibine verilecek özel kullanıcı adı veya parola yoktur.
- YouTube senkronizasyonu isteğe bağlıdır ve kullanıcının kendi Google hesabıyla cihaz kodu akışı üzerinden yapılır.

## Reklamlar

- Uygulama içinde reklam SDK'sı veya geliştirici tarafından gösterilen reklam bulunmuyor.
- Play Console'da “Uygulamanız reklam içeriyor mu?” sorusunun mevcut kod için yanıtı: Hayır.

## Hedef kitle

- Uygulama özellikle çocuklara yönelik tasarlanmamıştır.
- Önerilen hedef yaş grubu: 13 yaş ve üzeri.
- Çocuklara yönelik pazarlama görseli veya metni kullanılmamalıdır.

## İçerik derecelendirme notları

- Uygulama, üçüncü taraf kullanıcı üretimi video ve yorumları görüntüleyebilir.
- Kullanıcı YouTube hesabını bağladığında yorum gönderebilir.
- İçerik seçimi ve moderasyonu ilgili içerik hizmeti tarafından sağlanır.
- Kullanıcıların uygulama içinde birbirleriyle doğrudan özel mesajlaşması yoktur.
- Uygulamada kumar, satın alma, finans veya flört işlevi yoktur.

## Veri güvenliği — kaynak kod özeti

### Toplanabilen/vericiye gönderilebilen veriler

- Kişisel bilgiler: e-posta adresi, görünen ad, Firebase kullanıcı kimliği.
- Uygulama etkinliği: izleme geçmişi ve oynatma konumu, beğeniler, abonelikler, oynatma listeleri.
- Arama sorguları, sonuç sağlamak için üçüncü taraf içerik hizmetlerine gönderilebilir.
- Kullanıcının isteğe bağlı olarak gönderdiği yorumlar YouTube'a aktarılır.
- Hesap yönetimi: oturum ve hesap bilgileri.
- Kullanıcının seçimine bağlı YouTube OAuth belirteçleri cihazda yerel olarak saklanır ve Google/YouTube uç noktalarına gönderilir.
- Çevrimiçi durum bilgisi Firebase Realtime Database'e yazılabilir.
- SponsorBlock etkinse video kimliği SponsorBlock API'sine gönderilebilir.
- Firebase ve bağlı hizmetler yaklaşık konumu ağ/IP bilgisi üzerinden ve cihaz ya da diğer kimlikleri işleyebilir.

### Play Console Veri Güvenliği beyanı

- Kişisel bilgiler: ad, e-posta adresi ve kullanıcı kimliği.
- Konum: yaklaşık konum.
- Uygulama etkinliği: uygulama işlemleri, uygulama içi arama geçmişi ve kullanıcı tarafından oluşturulan diğer içerikler.
- Cihaz veya diğer kimlikler.
- Aktarım sırasında şifreleme ve hem hesap hem de belirli uygulama verileri için silme seçenekleri beyan edildi.

### Yalnız cihazda saklanan veriler

- Tema ve oynatma tercihleri.
- Arama geçmişi.
- Oynatma hata kayıtları.
- İndirme kuyruğu ve indirilen dosya bilgileri.
- Hesap kullanılmıyorsa kitaplık ve geçmiş verileri.

### Güvenlik ve kullanım

- Ağ aktarımı HTTPS üzerinden yapılır.
- Kodda reklam veya davranışsal analiz SDK'sı bulunmuyor.
- Kişisel veriler reklam amacıyla satılmıyor.
- Bulut verileri uygulama işlevlerini sunmak ve cihazlar arasında eşitlemek için kullanılıyor.

## Politika öncesi tamamlanması gerekenler

- YouTube içerik indirme, reklam filtreleme ve SponsorBlock davranışının Google Play ve YouTube koşullarına uygunluğu geliştirici tarafından doğrulanmalı.
- Üretim AAB'si debug anahtarıyla değil, ayrı ve güvenli biçimde yedeklenmiş Tuben upload key ile imzalanmalı.
- İmzalı AAB kapalı test kanalına yüklenmeli.
- En az 12 test kullanıcısı kapalı teste katılmalı ve kesintisiz 14 günlük test tamamlanmalı.
- Test tamamlanıp gerçek cihaz doğrulamaları yapıldıktan sonra Yayınlama özetindeki değişiklikler ayrıca incelemeye gönderilmeli.
