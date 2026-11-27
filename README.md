# ShipToEcom — iki ikas mağazası için ortak stok ve sipariş paneli

İki ikas mağazasını bağlar; aynı SKU'lu ürünler tek stoktan düşer, siparişler mağaza etiketiyle tek listede görünür.
Müşteri bilgileri (ad, e-posta, telefon, adres) ikas'tan hiç istenmez ve saklanmaz.

## Çalıştırma

```bash
npm install
npx prisma db push
npm run dev
```

`.env.example` dosyasını `.env` olarak kopyalayıp doldurun.

## Gerçek mağaza olmadan deneme

```bash
npm run mock
IKAS_GRAPHQL_URL=http://localhost:4010/graphql IKAS_TOKEN_URL="http://localhost:4010/{store}/token" IKAS_IMAGE_URL=http://localhost:4010/image npm run dev
```

Bu iki komut yalnızca sahte API ile deneme içindir; gerçek mağazalar için düz `npm run dev` kullanın.

Mağaza adları `magaza-a` ve `magaza-b`; Client ID/Secret herhangi bir değer olabilir.
Sipariş simülasyonu: `curl -X POST "localhost:4010/_order?store=magaza-a&sku=TS-001&qty=2"`

## Platform katmanı

Senkron (`src/lib/sync.ts`) mağaza işlemlerini `src/lib/platforms/` üzerinden yapar; desteklenen tek altyapı ikas'tır (`platforms/ikas.ts`).

Sahte API ile uçtan uca deneme (gerçek mağazalara ve `dev.db`'ye dokunmaz):

```bash
DATABASE_URL=file:./test.db npx prisma db push --skip-generate
DATABASE_URL=file:./test.db APP_SECRET=<64 hex> node --experimental-strip-types scripts/seed-test.ts
node scripts/mock-ikas.mjs &
# test sunucusu: .claude/launch.json içindeki "test" yapılandırması (port 3100)
curl -H "Authorization: Bearer test" localhost:3100/api/cron/sync
```

## Mobil API (iOS uygulaması için)

`/api/mobile/*` uçları JSON döner ve çerez yerine `Authorization: Bearer <token>` kullanır. Token 30 gün geçerlidir ve web oturumu olarak kabul edilmez.

| Uç | Yöntem | İş |
| --- | --- | --- |
| `/api/mobile/giris` | POST `{email, password}` | Token üretir (15 dakikada 8 hatalı denemeden sonra 429) |
| `/api/mobile/ben` | GET | Hesap, paket, bağlı mağazalar |
| `/api/mobile/ozet?gun=7&magaza=` | GET | Satış toplamları, günlük seri, en çok satanlar, stok sayıları |
| `/api/mobile/siparisler?durum=&q=&sayfa=` | GET | Sipariş listesi (müşteri bilgisi yok) |
| `/api/mobile/raporlar?gun=30&magaza=` | GET | Rapor kırılımları (kanal, kaynak, il, kampanya, ödeme) |
| `/api/mobile/stok?f=&q=&sayfa=` | GET | SKU başına ortak stok ve mağaza stokları |
| `/api/mobile/senkron` | POST | Şimdi senkronize et |

## Mobil uygulama (Expo)

`mobile/` klasöründe Expo (React Native) uygulaması var: Giriş, Özet, Siparişler, Stok, Raporlar, Hesap. Yukarıdaki mobil API'yi kullanır.

```bash
cd mobile
npx expo start        # QR kodu gösterir; iPhone'da Expo Go ile okutulur
npx expo start --web  # tarayıcı önizlemesi
```

Geliştirmede uygulama, Expo'nun çalıştığı bilgisayarın 3000 portundaki panele bağlanır (telefon ve bilgisayar aynı Wi-Fi'da olmalı). Farklı bir adres için giriş ekranındaki "Sunucu adresi" kullanılır.

## Akıllı stok, otomasyon ve kârlılık

- **Akıllı stok dağıtımı** (`allocate` in `src/lib/reconcile.ts`, Stok > Stok ayarları): mağaza payı, mağaza minimumu, güvenlik stoğu, öncelikli mağaza ve kritik stok seviyesi. Satılabilir stok kritik seviyeye inince ürün yalnızca öncelikli mağazada satışa açık kalır; geri yükselince normal dağıtıma döner. Ayarlar kapalıyken hesap eskisiyle aynıdır (`npm test`).
- **Sipariş otomasyonu** (`src/lib/automation.ts`, `/otomasyonlar`): koşullar (tutar, mağaza, SKU, stok, durum) VE ile bağlanır; aksiyonlar etiket, bildirim, stok kontrolü. Senkrondan sonra çalışır; `AutomationRun` tekil anahtarı sayesinde bir kural bir siparişte bir kez çalışır. Kural, oluşturulduktan sonra verilen siparişlere uygulanır.
- **Kârlılık ve stok analizi** (`src/lib/analysis.ts`, `/analiz`, `/api/mobile/analiz`): mağaza cirosu, ürün kârı (alış fiyatından; komisyon/kargo hariç), en çok satan/kazandıran, kritik stok, tahmini bitiş günü, yeniden sipariş önerisi.
- **Bildirimler** (`/bildirimler`, başlıktaki zil): kritik/düşük stok ve otomasyon bildirimleri.

## Nasıl çalışır

- `src/lib/reconcile.ts` — ortak stok hesabı (`npm test`).
- `src/lib/sync.ts` — ürünleri okur, ortak stoğu hesaplar, iki mağazaya yazar, siparişleri çeker.
- `src/lib/ikas.ts` — ikas Admin API istemcisi.
- `src/lib/cache.ts` — önbellek: rapor/pano toplamları (5 dk) ve ikas kampanya listesi (60 sn); senkron ve panel işlemleri etiketi hemen düşürür. Stok, sipariş ve ürün tabloları önbelleğe alınmaz.
- `src/lib/product.ts` + `/urunler/yeni` — tek formdan seçili mağazalarda aynı SKU ile ürün oluşturur (marka/kategori/etiket/varyant tipi yoksa mağazada açılır).
- `/urunler` — ürün/fiyat listesi ve otomatik fiyat kuralı (`src/lib/pricing.ts`): bir mağazanın fiyatı diğerinden yüzde/sabit farkla hesaplanır, her senkronda yazılır.
- `/indirimler` — ikas kampanyalarını (yüzde, tutar, ücretsiz kargo, kuponlu) seçili mağazalarda oluşturur/siler; liste doğrudan ikas'tan okunur.
- `/siparisler` — durum filtreleri, ürün görselleri ve ikas paketlerinden gelen kargo barkodu/takip bilgisi.
- `/api/webhooks/ikas/[storeId]/[secret]` — ikas bildirimi gelince senkronu tetikler (gövde okunmaz).
- `/api/cron/sync` — periyodik güvenlik ağı; `Authorization: Bearer $CRON_SECRET` ile 5–10 dakikada bir çağrılmalı.

## Yayına almadan önce

- Veritabanı: `DATABASE_URL` bir PostgreSQL adresi (`postgresql://...`) olmalı. `scripts/db.mjs` sağlayıcıyı kendisi değiştirir; `npm start` açılışta tabloları `prisma db push` ile oluşturur (veri kaybı gerektiren değişiklikte durur). Şemayı elle değiştirmeyin; yerelde SQLite kalır.
- Zorunlu ortam değişkenleri: `DATABASE_URL`, `APP_SECRET`, `APP_URL`, `CRON_SECRET`, `ADMIN_SETUP_KEY`. Ayrı cron servisi yoksa `INTERNAL_CRON_MINUTES=10` uygulama içinden `/api/cron/sync`'i çağırır.
- Teşhis: `/api/durum` veritabanı bağlantısını ve tabloları denetler (gizli değer döndürmez).
- `APP_URL` https adresi olmalı; sonra Mağazalar ekranından "Webhook kur".
- Gerçek bir ikas test mağazasında doğrulanacaklar: `saveProductStockLocations` mutlak değer mi yazıyor, webhook imza başlığı, sipariş durum değerleri, ürün eklemede varyant tipi `selectionType: "CHOICE"` değeri ve görsel yükleme; görsel CDN adresi kalıbı (`cdn.myikas.com/images/{merchantId}/{imageId}/image_180.webp`), `saveVariantPrices` ile indirimli fiyatın `null` gönderilerek kaldırılması, kampanya girdisi.
