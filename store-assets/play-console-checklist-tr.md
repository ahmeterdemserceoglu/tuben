# Tuben — Play Console beyan kontrol listesi

Bu dosya Play Console formlarını doldururken kaynak koddaki mevcut davranışı özetler. Google'ın formdaki güncel tanımları esas alınmalıdır.

## Play Console durumu — 26 Eylül 2026

- Play Console uygulaması oluşturuldu: `com.tuben.app`.
- Türkçe mağaza açıklamaları, uygulama simgesi, özellik görseli ve iki telefon ekran görüntüsü yüklendi.
- Gizlilik politikası kaydedildi ve `https://ahmeterdemserceoglu.github.io/tuben/gizlilik/` adresinde yayınlandı.
- Reklam, resmi kurum, finans ve sağlık beyanları tamamlandı.
- Kategori `Video Oynatıcılar ve Düzenleyiciler` olarak seçildi; herkese açık destek e-postası henüz kaydedilmedi.
- Uygulama erişimi görevi, inceleme ekibine bütün özellikleri açan yeniden kullanılabilir erişim bilgisi istediği için tamamlanmadı. Misafir oturumu temel işlevleri açıyor; isteğe bağlı YouTube senkronizasyonu ve yorum gönderme için üçüncü taraf Google hesabı gerekiyor.
- Hedef kitle anketi, uygulama erişimi görevi tamamlanana kadar Play Console tarafından kilitli tutuluyor.
- İçerik derecelendirme ve veri güvenliği formları henüz gönderilmedi.
- Hiçbir sürüm incelemeye veya üretime gönderilmedi.

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
- Hesap yönetimi: oturum ve hesap bilgileri.
- Kullanıcının seçimine bağlı YouTube OAuth belirteçleri cihazda yerel olarak saklanır ve Google/YouTube uç noktalarına gönderilir.
- Çevrimiçi durum bilgisi Firebase Realtime Database'e yazılabilir.
- SponsorBlock etkinse video kimliği SponsorBlock API'sine gönderilebilir.

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

- Uygulama hesap oluşturabildiği için uygulama içinde erişilebilir “Hesabı ve verileri sil” akışı eklenmeli.
- Hesap silme için herkese açık bir web sayfası/URL yayınlanmalı.
- Gizlilik politikasına gerçek destek e-postası eklenmeli ve herkese açık URL oluşturulmalı.
- YouTube içerik indirme, reklam filtreleme ve SponsorBlock davranışının Google Play ve YouTube koşullarına uygunluğu geliştirici tarafından doğrulanmalı.
- Üretim AAB'si debug anahtarıyla değil, ayrı ve güvenli biçimde yedeklenmiş Tuben upload key ile imzalanmalı.
