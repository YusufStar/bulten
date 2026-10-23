// Local demo data: people, ~6 weeks of tasks with subtasks and screenshots, and four reports.
// npm run seed           fills an empty local database
// npm run seed -- --reset wipes the local database first
import { readFileSync, readdirSync, rmSync } from 'node:fs'
import path from 'node:path'
import * as db from '../lib/db.ts'
import { addDays, type Status, type TaskType, today } from '../lib/model.ts'

if (process.env.NODE_ENV === 'production' || process.env.DATA_DIR === '/data') {
  console.error('Seed yalnızca yerel geliştirme içindir; production veritabanına dokunmaz.')
  process.exit(1)
}

const dataDir = path.resolve(process.env.DATA_DIR ?? 'data')
if (process.argv.includes('--reset'))
  for (const f of ['gundem.db', 'gundem.db-wal', 'gundem.db-shm']) rmSync(path.join(dataDir, f), { force: true })

if (db.listPeople().length) {
  console.log('Veritabanında zaten veri var. Baştan kurmak için: npm run seed -- --reset')
  process.exit(0)
}

// Screenshots go to R2 under fixed names, so re-running the seed just overwrites them.
const assetsDir = path.join(import.meta.dirname, 'seed-assets')
const assets = readdirSync(assetsDir).filter((f) => f.endsWith('.png'))
let shotsOk = false
if (process.env.R2_ACCESS_KEY_ID) {
  const { putObject } = await import('../lib/r2.ts')
  for (const f of assets) {
    const buf = readFileSync(path.join(assetsDir, f))
    await putObject(f, buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer, 'image/png')
  }
  shotsOk = true
} else console.warn('R2 ayarları yok; görevler ekran görüntüsüz eklenecek.')
const shot = (file: string, caption = '') => (shotsOk ? [{ file, caption }] : [])

const P = {
  elif: db.addPerson('Elif Kaya', 'Mobil geliştirici'),
  mert: db.addPerson('Mert Demir', 'Backend geliştirici'),
  zeynep: db.addPerson('Zeynep Arslan', 'Ürün tasarımcısı'),
  can: db.addPerson('Can Öztürk', 'Frontend geliştirici'),
  deniz: db.addPerson('Deniz Aydın', 'QA mühendisi'),
  burak: db.addPerson('Burak Şahin', 'DevOps mühendisi'),
}
db.setPersonActive(P.burak, false)

type Seed = [title: string, type: TaskType, app: string, person: keyof typeof P, subtasks?: string[]]

// Oldest first; spread over weekdays of the last six weeks.
const history: Seed[] = [
  ['Sunucular yeni Coolify kümesine taşındı', 'infra', 'Freewill Web', 'burak', ['Veritabanı yedeği alındı', 'DNS kayıtları güncellendi', 'Eski sunucu kapatıldı']],
  ['Giriş ekranındaki klavye kayması düzeltildi', 'bug', 'Hn', 'elif'],
  ['Ürün kartlarına indirim etiketi eklendi', 'feature', 'Pazar', 'can'],
  ['Hn için yeni onboarding akışı tasarlandı', 'design', 'Hn', 'zeynep', ['Akış şeması', 'Ekran tasarımları', 'Prototip testi']],
  ['Ödeme servisinde zaman aşımı 30 sn’ye çıkarıldı', 'improvement', 'Cüzdan', 'mert'],
  ['Arama sonuçlarında Türkçe karakter hatası giderildi', 'bug', 'Pazar', 'mert'],
  ['CI süresi 14 dakikadan 6 dakikaya indirildi', 'infra', 'Freewill Web', 'burak'],
  ['Para gönderme ekranına kişi arama eklendi', 'feature', 'Cüzdan', 'elif'],
  ['Kampanya sayfası yeni görsel diline taşındı', 'design', 'Freewill Web', 'zeynep'],
  ['Sipariş e-postaları yeniden yazıldı', 'improvement', 'Pazar', 'can'],
  ['Android 15’te bildirim izni hatası düzeltildi', 'bug', 'Hn', 'elif'],
  ['Satıcılar için toplu ürün yükleme', 'feature', 'Pazar', 'mert', ['CSV şablonu', 'Doğrulama kuralları', 'Hata raporu ekranı']],
  ['Uygulama açılış süresi %35 kısaldı', 'improvement', 'Hn', 'elif'],
  ['QR ile ödeme', 'feature', 'Cüzdan', 'mert', ['QR üretimi', 'Kamera ile okuma', 'Limit kontrolleri']],
  ['Kariyer sayfası yayına alındı', 'feature', 'Freewill Web', 'can'],
  ['Sepette kupon iki kez uygulanıyordu, düzeltildi', 'bug', 'Pazar', 'deniz'],
  ['Karanlık mod renkleri yenilendi', 'design', 'Hn', 'zeynep'],
  ['Veritabanı sorguları için indeksler eklendi', 'infra', 'Pazar', 'mert'],
  ['Fatura ödeme hatırlatıcıları', 'feature', 'Cüzdan', 'elif'],
  ['iOS’ta profil fotoğrafı yüklenmiyordu, düzeltildi', 'bug', 'Hn', 'elif'],
  ['Ürün detay sayfası hızlandırıldı', 'improvement', 'Pazar', 'can'],
  ['Regresyon test listesi güncellendi', 'infra', 'Hn', 'deniz'],
  ['Ana sayfa SEO başlıkları düzenlendi', 'improvement', 'Freewill Web', 'can'],
  ['Hesap dökümü PDF olarak indirilebiliyor', 'feature', 'Cüzdan', 'mert'],
  ['Kayıt formunda telefon doğrulama hatası düzeltildi', 'bug', 'Cüzdan', 'deniz'],
  ['Satıcı paneli için yeni ikon seti', 'design', 'Pazar', 'zeynep'],
  ['Sentry ile hata takibi kuruldu', 'infra', 'Hn', 'mert'],
  ['Favori listesi paylaşılabiliyor', 'feature', 'Hn', 'elif'],
  ['İade süreci adımları sadeleştirildi', 'improvement', 'Pazar', 'zeynep'],
  ['Para gönderiminde çift tıklama iki işlem yaratıyordu, düzeltildi', 'bug', 'Cüzdan', 'mert'],
  ['Blog altyapısı kuruldu', 'feature', 'Freewill Web', 'can'],
  ['Push bildirim metinleri yenilendi', 'improvement', 'Hn', 'zeynep'],
  ['Stok senkronizasyonu her 5 dakikada bir çalışıyor', 'infra', 'Pazar', 'mert'],
  ['Kart ekleme ekranı yeniden tasarlandı', 'design', 'Cüzdan', 'zeynep'],
  ['Arama önerileri eklendi', 'feature', 'Pazar', 'can'],
  ['Uygulama içi mesajlarda emoji hatası düzeltildi', 'bug', 'Hn', 'deniz'],
  ['Erişilebilirlik denetimi yapıldı', 'improvement', 'Freewill Web', 'can'],
  ['Harcama kategorileri grafiği', 'feature', 'Cüzdan', 'elif', ['Kategori eşleştirme', 'Aylık grafik', 'Filtreler']],
  ['Yük testleri: 2.000 eşzamanlı kullanıcı', 'infra', 'Pazar', 'deniz'],
  ['Ürün fotoğrafları WebP’ye çevrildi', 'improvement', 'Pazar', 'mert'],
  ['Profil ve ayarlar ekranı yenilendi', 'design', 'Hn', 'zeynep'],
  ['Şifre sıfırlama e-postası gecikiyordu, düzeltildi', 'bug', 'Hn', 'mert'],
]

const weekdays: string[] = []
for (let d = addDays(today(), -42); d < addDays(today(), -1); d = addDays(d, 1)) {
  const day = new Date(`${d}T00:00:00Z`).getUTCDay()
  if (day !== 0 && day !== 6) weekdays.push(d)
}

const add = (s: Seed, date: string, status: Status, extra: { note?: string; shots?: { file: string; caption: string }[] } = {}) => {
  const [title, type, app, who, subs] = s
  const base = { title, type, app, personId: P[who], status, date, note: extra.note ?? '', shots: extra.shots ?? [] }
  const id = db.createTask(base)
  subs?.forEach((sub, i) =>
    db.createTask({ ...base, title: sub, status: status === 'done' || i < subs.length - 1 ? 'done' : 'todo', note: '', shots: [] }, id),
  )
  return id
}

history.forEach((s, i) => {
  const date = weekdays[Math.floor((i / history.length) * weekdays.length)]
  const extra =
    s[0].startsWith('Profil ve ayarlar') ? { shots: shot('seed-hn-profil-ayarlar.png', 'Yeni profil ve ayarlar ekranı') }
    : s[0].startsWith('Kariyer') ? { shots: shot('seed-web-acilis-sayfasi.png', 'Freewill açılış sayfası') }
    : {}
  add(s, date, 'done', extra)
})

// Yesterday and today: the stories the demo reports lead with.
const y = addDays(today(), -1)
const t = today()
add(['Cüzdan ana sayfası yeniden tasarlandı', 'design', 'Cüzdan', 'zeynep'], y, 'done', { shots: shot('seed-cuzdan-ana-sayfa.png', 'Yeni bakiye kartı ve hızlı işlemler') })
add(['Bakiye yüklemede 3D Secure ekranı takılıyordu, düzeltildi', 'bug', 'Cüzdan', 'mert'], y, 'done')
add(['Ürün yorumlarına fotoğraf eklenebiliyor', 'feature', 'Pazar', 'can'], y, 'done')
add(['Sepet sayfası testleri otomatikleştirildi', 'infra', 'Pazar', 'deniz'], y, 'doing')

add(['Ödeme ekranına Apple Pay eklendi', 'feature', 'Hn', 'elif', ['Apple Pay sertifikası', 'Ödeme sağlayıcı entegrasyonu', 'TestFlight dağıtımı']], t, 'done', {
  note: 'Testte ödeme başarı oranı %91’den %97’ye çıktı.',
  shots: shot('seed-hn-odeme-ekrani.png', 'Hn’nin yeni ödeme ekranı: Apple Pay ve kartla ödeme'),
})
add(['Checkout’ta adres kaydedilemiyordu, düzeltildi', 'bug', 'Hn', 'mert'], t, 'done')
add(['Satıcı paneline sipariş listesi', 'feature', 'Pazar', 'can', ['Liste ve sayfalama', 'Durum filtreleri', 'Toplu durum güncelleme']], t, 'doing', {
  note: 'Yarın canlıya çıkması planlanıyor.',
  shots: shot('seed-pazar-siparisler.png', 'Satıcı panelinde yeni sipariş listesi'),
})
add(['Ürün görsellerinin yüklenme süresi yarıya indi', 'improvement', 'Pazar', 'mert'], t, 'done')
add(['Login sayfasındaki yazım hatası düzeltildi', 'bug', 'Freewill Web', 'can'], t, 'done')
add(['Cüzdan için iOS widget', 'feature', 'Cüzdan', 'elif'], t, 'todo')
add(['Hn sürüm notları hazırlanacak', 'improvement', 'Hn', 'deniz'], t, 'todo')

// Reports, created in this order so their numbers read 1-4.
const at = (daysAgo: number) => Date.now() - daysAgo * 86_400_000
const monthly = db.createReport('aylik', `${t.slice(0, 7)}-01`, at(3))
const weekly = db.createReport('haftalik', y, at(2))
const yesterday = db.createReport('gunluk', y, at(1))
const daily = db.createReport('gunluk', t, at(0))

db.updateReport(weekly, {
  kind: 'haftalik',
  date: y,
  headline: 'Cüzdan yenilendi, Pazar’da satıcılar için yeni araçlar',
  spot: 'Hafta boyunca dört uygulamada çalışıldı; Cüzdan’ın ana sayfası yeni tasarımına kavuştu, Pazar’da fotoğraflı yorumlar açıldı.',
  sections: [
    {
      app: 'Cüzdan',
      headline: 'Cüzdan’ın ana sayfası baştan tasarlandı',
      body: 'Bakiye kartı ve hızlı işlemler artık ilk ekranda. Para gönderme ve QR ile ödeme tek dokunuşla açılıyor.\n\nBakiye yüklemede 3D Secure ekranında takılma sorunu da giderildi.',
      featured: true,
    },
    { app: 'Pazar', headline: 'Yorumlara fotoğraf geldi', body: 'Müşteriler ürün yorumlarına fotoğraf ekleyebiliyor. Sepet testlerinin otomasyonu sürüyor.', featured: false },
  ],
})
db.setPublished(weekly, true)

db.updateReport(yesterday, {
  kind: 'gunluk',
  date: y,
  headline: 'Cüzdan’da yeni ana sayfa yayında',
  spot: 'Tasarım ekibinin iki haftalık çalışması tamamlandı; ödeme tarafında bir kritik hata çözüldü.',
  sections: [],
})
db.setPublished(yesterday, true)

db.updateReport(daily, {
  kind: 'gunluk',
  date: t,
  headline: 'Hn’de Apple Pay dönemi başladı',
  spot: 'Hn’nin ödeme ekranı yenilendi ve testte ödeme başarısı %97’ye çıktı. Pazar’ın satıcı paneline sipariş listesi geliyor.',
  sections: [
    {
      app: 'Hn',
      headline: 'Apple Pay ile ödeme açıldı, başarı oranı %97',
      body: 'Kullanıcılar artık sepeti tek dokunuşla Apple Pay ile ödeyebiliyor. Testlerde ödeme başarı oranı %91’den %97’ye çıktı.\n\nCheckout’ta adres kaydedilememesine yol açan hata da aynı gün giderildi.',
      featured: true,
    },
    {
      app: 'Pazar',
      headline: 'Satıcı paneline sipariş listesi geliyor',
      body: 'Liste ve filtreler hazır; toplu durum güncelleme bitince yarın canlıya çıkması planlanıyor.',
      featured: false,
    },
  ],
})
db.setPublished(daily, true)

console.log(`Hazır: ${Object.keys(P).length} çalışan, ${history.length + 11} görev, 4 rapor${shotsOk ? ', 5 ekran görüntüsü' : ''}.`)
console.log(`Bugünün raporu: /b/${daily}`)
