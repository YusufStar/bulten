# Freewill Gündem

Ege Bey’e gönderilen günlük, haftalık ve aylık raporlar. CTO görevleri girer (ya da notlarını yapıştırıp Claude’a listeletir), Claude raporu yazar, “Paylaş” ile okuma linki alınır. Linki olan herkes hesapsız okuyabilir.

- **Raporlar**: dönem seçilir, o dönemin görevleri, grafikler ve uygulama yazıları otomatik gelir. “Claude ile yaz” başlığı, özeti ve uygulama yazılarını hazırlar; “Geri al” ile geri dönülebilir.
- **Görevler**: Özellik / Bug / İyileştirme / Tasarım / Altyapı, sorumlu, durum, ekran görüntüsü, alt görevler. “Metinden görev çıkar” Slack mesajı ya da not listesinden görev listesi üretir.
- **Metrikler**: günlere, uygulamalara, kişilere ve türlere göre tamamlanan işler.
- **Çalışanlar**: ekle, düzenle, pasife al (silme yok).

Next.js 16, Node’un yerleşik SQLite’ı (`node:sqlite`), görseller Cloudflare R2’de, metinler Claude (`claude-opus-5-5`).

## Yerelde çalıştırma

```bash
npm install
cp .env.example .env.local      # değerleri doldurun
npm run seed                    # örnek çalışanlar, görevler ve raporlar (yalnızca yerel)
npm run dev
```

`npm run seed -- --reset` yerel veritabanını silip baştan kurar. Seed production’da (`NODE_ENV=production` ya da `DATA_DIR=/data`) çalışmayı reddeder.

Testler: `npm test`

## Coolify

1. Bu repoyu **Docker Compose** kaynağı olarak ekleyin (`docker-compose.yml`).
2. `bulten` servisinin alan adına `https://bulten.openwild.ai:3000` yazın.
3. `.env.production` içindeki değişkenleri Environment Variables sekmesine yapıştırın.
4. Deploy. Veritabanı `bulten-data` volume’unda (`/data`) durur; görseller R2’de.

Giriş bilgileri `ADMIN_USERNAME` / `ADMIN_PASSWORD`; tek hesap vardır, kayıt yoktur. `SESSION_SECRET` değişirse tüm oturumlar kapanır.
