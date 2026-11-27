// Destek makaleleri: panelin gerçek ekran ve buton adlarıyla adım adım kılavuzlar.
// Saf veri modülü (veritabanı içe aktarmaz); /destek sayfası ve testler kullanır.
// Panel metni değişirse ilgili makaleyi de güncelleyin.

/** image: public/destek altındaki ekran görüntüsü (demo hesaptan alınır; gerçek müşteri verisi içermez). */
export type HelpStep = { title: string; text: string; image?: string };
export type HelpArticle = {
  slug: string;
  category: string;
  title: string;
  summary: string;
  /** Kullanıcının arayabileceği sorun ve terimler (aramada başlıktan sonra en çok ağırlık). */
  keywords: string[];
  /** Panelde ilgili ekran. */
  path?: string;
  steps: HelpStep[];
  notes?: string[];
};

export const HELP_CATEGORIES = [
  "Başlangıç",
  "Mağaza bağlantısı",
  "Ürün ve stok",
  "Siparişler ve otomasyon",
  "Vitrin modülleri",
  "Reklam ve analitik",
  "Kârlılık ve finans",
  "Hesap ve lisans",
  "Sorun giderme",
] as const;

export const HELP_ARTICLES: HelpArticle[] = [
  {
    slug: "hizli-baslangic",
    category: "Başlangıç",
    title: "ShipToEcom'a ilk adımlar",
    summary: "Hesap açtıktan sonra mağazanızı bağlayıp ortak stokla çalışmaya başlamak için izlenecek sıra.",
    keywords: ["başlangıç", "kurulum", "nasıl başlarım", "ilk adım", "deneme", "kayıt", "hesap açma"],
    path: "/panel",
    steps: [
      { title: "Hesap açın", text: "Ana sayfadaki \"Ücretsiz dene\" ile kayıt olun. Deneme süresi boyunca paketinizin modüllerini kullanabilirsiniz." },
      { title: "Mağazanızı bağlayın", text: "Panelde Entegrasyonlar ekranından ikas mağazanızı API bilgileriyle bağlayın (ayrıntı: \"ikas mağazası nasıl bağlanır\").", image: "/destek/entegrasyonlar.webp" },
      { title: "İlk senkronu bekleyin", text: "Bağlantıdan sonra ürün, stok ve siparişler çekilir. Entegrasyonlar ekranındaki \"Şimdi senkronize et\" ile elle de başlatabilirsiniz.", image: "/destek/panel.webp" },
      { title: "Ürünleri eşleştirin", text: "Aynı SKU'ya sahip ürünler kendiliğinden eşleşir. SKU'su farklı olanları Ürünler altındaki eşleştirme ekranından elle eşleştirin." },
      { title: "Stok ve kâr ayarlarını yapın", text: "Stok ekranından mağaza payı ve kritik stok seviyesini, Kârlılık altından ürün maliyetlerini ve sipariş giderlerini girin." },
    ],
  },
  {
    slug: "ikas-magaza-baglama",
    category: "Mağaza bağlantısı",
    title: "ikas mağazası nasıl bağlanır",
    summary: "ikas panelinde özel uygulama açıp Client ID ve Client Secret ile mağazanızı ShipToEcom'a bağlayın.",
    keywords: ["ikas", "mağaza bağla", "entegrasyon", "client id", "client secret", "api", "özel uygulama", "bağlantı kurma", "myikas"],
    path: "/entegrasyonlar",
    steps: [
      { title: "ikas'ta özel uygulama oluşturun", text: "ikas panelinde Uygulamalar → Uygulamalarım → Daha Fazla → Özel Uygulama Oluştur yolunu izleyin." },
      { title: "İzinleri verin", text: "Uygulamaya ürün, stok ve sipariş izinlerini verin. Müşteri izni gerekmez; ShipToEcom müşteri bilgisi almaz." },
      { title: "Bilgileri kopyalayın", text: "Oluşan uygulamanın Client ID ve Client Secret değerlerini kopyalayın." },
      { title: "Panelde formu açın", text: "ShipToEcom panelinde Entegrasyonlar ekranında ikas kartındaki \"Mağaza bağla\" butonuna basın.", image: "/destek/entegrasyonlar.webp" },
      { title: "Formu doldurun", text: "\"Panelde görünecek ad\", \"ikas mağaza adı\" (adresinizdeki .myikas.com öncesi kısım), Client ID ve Client Secret alanlarını doldurun.", image: "/destek/entegrasyonlar-form.webp" },
      { title: "Deneyip kaydedin", text: "Önce \"Bağlantıyı test et\", sonuç olumluysa \"Mağazayı bağla\" butonuna basın. Mağaza listede \"Aktif\" olarak görünür." },
    ],
    notes: [
      "Paketinizin mağaza hakkı dolduysa yeni mağaza bağlanamaz; Lisans ekranından paketinizi değiştirebilirsiniz.",
      "Bağlantıyı \"Kaldır\" ile kaldırmak mağazadaki ürün ve siparişleri silmez; yalnızca ortak stok bağları sıfırlanır.",
    ],
  },
  {
    slug: "anlik-bildirim-webhook",
    category: "Mağaza bağlantısı",
    title: "Anlık bildirim (webhook) nasıl kurulur",
    summary: "Siparişlerin ve stok değişikliklerinin beklemeden panele gelmesi için ikas webhook'unu açın.",
    keywords: ["webhook", "anlık bildirim", "sipariş gecikmesi", "geç geliyor", "anında", "gerçek zamanlı", "senkron gecikme"],
    path: "/entegrasyonlar",
    steps: [
      { title: "Entegrasyonlar ekranını açın", text: "Bağlı mağazalar listesinde ilgili ikas mağazasını bulun." },
      { title: "Ayarlar menüsünü açın", text: "Mağaza satırındaki \"Ayarlar\" butonuna basın." },
      { title: "Bildirimi kurun", text: "\"Anlık bildirimi (webhook) kur\" seçeneğine basın. Kurulum tamamlanınca seçenek \"Anlık bildirim açık\" olarak görünür.", image: "/destek/entegrasyonlar-ayarlar.webp" },
    ],
    notes: ["Webhook açık olmasa da veriler düzenli senkronla güncellenir; webhook yalnızca gecikmeyi azaltır."],
  },
  {
    slug: "senkronizasyon",
    category: "Mağaza bağlantısı",
    title: "Veriler ne zaman güncellenir, elle senkron nasıl yapılır",
    summary: "Ürün, stok ve siparişler düzenli aralıklarla çekilir; beklemek istemiyorsanız senkronu elle başlatın.",
    keywords: ["senkron", "senkronize", "güncellenmiyor", "veri gelmedi", "yenile", "son senkron", "sipariş görünmüyor", "ürün görünmüyor"],
    path: "/entegrasyonlar",
    steps: [
      { title: "Son senkron zamanına bakın", text: "Entegrasyonlar ekranında her mağazanın altında \"son senkron\" zamanı yazar." },
      { title: "Elle başlatın", text: "\"Şimdi senkronize et\" butonuna basın. Senkron arka planda sürer; bir senkron çalışırken yeni istek sıraya alınır.", image: "/destek/entegrasyonlar-senkron.webp" },
      { title: "Sonucu kontrol edin", text: "Mağaza \"Aktif\" görünüyorsa senkron başarılıdır. \"Hata\" görünüyorsa altındaki hata metnini okuyun ve Kayıtlar ekranına bakın." },
    ],
  },
  {
    slug: "sku-eslestirme",
    category: "Ürün ve stok",
    title: "Farklı SKU'lu ürünler nasıl eşleştirilir",
    summary: "İki mağazada aynı ürün farklı SKU ile kayıtlıysa elle eşleştirerek ortak stoğa bağlayın.",
    keywords: ["sku", "eşleştirme", "eşleşmiyor", "aynı ürün", "barkod", "ürün eşleştir", "ortak stok", "farklı sku"],
    path: "/urunler/eslestir",
    steps: [
      { title: "İki mağaza bağlı olmalı", text: "SKU eşleştirme için en az iki mağaza bağlı olmalıdır.", image: "/destek/eslestir.webp" },
      { title: "Eşleştirme ekranını açın", text: "Ürünler altındaki eşleştirme ekranına gidin. Aynı SKU'ya sahip ürünler zaten kendiliğinden eşleşmiştir." },
      { title: "Önerileri inceleyin", text: "Ekran benzer ürünleri öneri olarak listeler. Doğru olanı \"Eşleştir\" ile onaylayın." },
      { title: "Elle eşleştirin", text: "Öneride olmayan ürünleri sağdaki formdan seçip eşleştirin." },
      { title: "Gerekirse geri alın", text: "\"Elle yapılan eşleştirmeler\" listesinden yanlış eşleştirmeyi \"Kaldır\" ile kaldırın." },
    ],
    notes: [
      "Mağazalardaki SKU'lar değişmez.",
      "Eşleşince stoklar farklıysa düşük olan esas alınır ve iki mağazaya yazılır.",
    ],
  },
  {
    slug: "stok-ayarlari",
    category: "Ürün ve stok",
    title: "Ortak stok, güvenlik stoğu ve akıllı dağıtım ayarları",
    summary: "Aynı son adedin iki mağazada satılmasını önlemek için güvenlik stoğu, düşük stok eşiği, kritik stok ve mağaza payını ayarlayın.",
    keywords: ["stok", "fazla satış", "overselling", "kritik stok", "güvenlik stoğu", "düşük stok eşiği", "minimum stok", "öncelikli mağaza", "stok payı", "dağıtım", "stok uyarısı", "stok güncelle", "stok düzelt"],
    path: "/stok",
    steps: [
      { title: "Stok ayarlarını açın", text: "Panelde Ürünler → Stok ekranında \"Stok ayarları ve akıllı dağıtım\" bölümünü açın.", image: "/destek/stok.webp" },
      { title: "Güvenlik stoğu", text: "\"Güvenlik stoğu (adet)\": bu kadar adet mağazalarda satışa açılmaz; aynı anda iki mağazada satış olursa fazla satışı önler." },
      { title: "Düşük stok eşiği", text: "\"Düşük stok eşiği (adet)\": ortak stok bu değere inince uyarı verilir. Boş bırakılırsa kapalıdır." },
      { title: "Kritik stok ve öncelikli mağaza", text: "\"Kritik stok seviyesi (adet)\": satılabilir stok bu değere inince ürün yalnızca \"Öncelikli mağaza\" alanında seçtiğiniz mağazada satışa açık kalır." },
      { title: "Mağaza bazlı dağıtım", text: "Pay (%), ortak stoğun o mağazada görünen kısmıdır. Minimum stok, stok yetiyorsa o mağazaya en az yazılacak adettir. \"Kaydet ve uygula\" ile kaydedin.", image: "/destek/stok-ayarlar.webp" },
      { title: "Tek ürünün stoğunu düzeltin", text: "Listede SKU'ya tıklayın. \"Yeni ortak stok\" alanına sayımı yazıp \"Güncelle ve mağazalara yaz\" butonuna basın. \"Bu SKU'ya özel ayarlar\" bölümünde o ürüne özel güvenlik stoğu ve düşük stok eşiği verebilirsiniz.", image: "/destek/stok-detay.webp" },
    ],
    notes: ["Mağaza başına minimum stok, öncelikli mağaza ve kritik stok modu Profesyonel paketindedir."],
  },
  {
    slug: "urun-tanimlamalari",
    category: "Ürün ve stok",
    title: "Kategori, marka ve özel alan tanımlamaları",
    summary: "Ürünlerinizi panel içinde gruplamak için kategori, marka ve özel alanlar tanımlayın.",
    keywords: ["kategori", "marka", "özel alan", "tanımlama", "ürün grubu", "etiket"],
    path: "/urunler/tanimlamalar",
    steps: [
      { title: "Tanımlamalar ekranını açın", text: "Ürünler altında Tanımlamalar ekranına gidin." },
      { title: "Tanım ekleyin", text: "Kategori, marka ya da özel alan ekleyin ve ürünlerinize atayın.", image: "/destek/tanimlamalar.webp" },
    ],
    notes: ["Tanımlamalar yalnızca bu panelde saklanır; mağazalarınızdaki kategorileri değiştirmez."],
  },
  {
    slug: "siparis-takibi",
    category: "Siparişler ve otomasyon",
    title: "Siparişleri ve terk edilmiş sepetleri görüntüleme",
    summary: "Tüm mağazaların siparişlerini tek listede görün; ödemesi tamamlanmayan sepetleri ayrı ekranda izleyin.",
    keywords: ["sipariş", "sipariş listesi", "terk edilmiş sepet", "sepet", "ödeme tamamlanmadı", "iade", "iptal"],
    path: "/siparisler",
    steps: [
      { title: "Siparişler ekranını açın", text: "Panelde Siparişler ekranında bağlı tüm mağazaların siparişleri birlikte listelenir.", image: "/destek/siparisler.webp" },
      { title: "Terk edilmiş sepetler", text: "\"Terk edilmiş sepetler\" ekranında sepete ürün ekleyip ödemeyi tamamlamayan ziyaretleri görürsünüz.", image: "/destek/sepetler.webp" },
    ],
    notes: [
      "Müşteri bilgileri alınmaz; listede sipariş kalemleri ve tutarlar yer alır.",
      "Hatırlatma e-postaları ikas'ın kendi terk edilmiş sepet akışından gönderilir; panelde yalnızca durumu görürsünüz.",
    ],
  },
  {
    slug: "otomasyon-kurallari",
    category: "Siparişler ve otomasyon",
    title: "Sipariş otomasyon kuralı nasıl oluşturulur",
    summary: "Koşullar sağlandığında siparişe etiket ekleyen, bildirim gönderen ya da stok kontrol eden kurallar kurun.",
    keywords: ["otomasyon", "kural", "etiket", "otomatik", "bildirim", "koşul", "sipariş etiketi"],
    path: "/otomasyonlar",
    steps: [
      { title: "Otomasyon ekranını açın", text: "Panelde Otomasyon ekranına gidin." },
      { title: "Koşulları belirleyin", text: "Sağdaki formda koşulları seçin; kuralın çalışması için tümü sağlanmalıdır. Mağaza koşulu için mağaza seçin; durum koşulu için ikas'taki durum değerini yazın." },
      { title: "Eylemi seçin", text: "Siparişe etiket ekleme, bildirim gönderme ya da stok kontrolü eylemlerinden birini seçin." },
      { title: "Kuralı oluşturun", text: "\"Kuralı oluştur\" butonuna basın. Kuralı daha sonra \"Pasif yap\" / \"Aktif yap\" ile durdurup açabilir, \"Sil\" ile kaldırabilirsiniz.", image: "/destek/otomasyonlar.webp" },
    ],
    notes: [
      "Kural, oluşturulduktan sonra verilen siparişlere senkron sırasında uygulanır ve her siparişte yalnızca bir kez çalışır.",
      "Etiketler yalnızca bu panelde görünür; mağazaya yazılmaz.",
    ],
  },
  {
    slug: "indirim-kampanyasi",
    category: "Siparişler ve otomasyon",
    title: "İndirim kampanyası nasıl oluşturulur",
    summary: "Panelden ikas'ın kampanya modülünde indirim oluşturun; indirimi sepette ikas uygular.",
    keywords: ["indirim", "kampanya", "kupon", "sepet indirimi", "yüzde indirim", "kampanya oluştur"],
    path: "/indirimler",
    steps: [
      { title: "Mağaza bağlı olmalı", text: "İndirim oluşturmak için önce bir mağaza bağlayın." },
      { title: "İndirimler ekranını açın", text: "Panelde İndirimler ekranına gidin; formdaki Mağazalar alanından kampanyanın kurulacağı mağazayı seçin." },
      { title: "Kampanyayı tanımlayın", text: "Kampanya adı, tür, değer ve isteğe bağlı kupon kodunu girin; başlangıç ve bitiş tarihlerini seçin. Tarihler Türkiye saatiyledir." },
      { title: "Limitleri belirleyin", text: "Gerekirse toplam kullanım limiti, müşteri başına limit, hangi fiyata uygulanacağı ve diğer kampanyalarla birleşip birleşmeyeceğini ayarlayın." },
      { title: "Oluşturun", text: "\"Kampanyayı oluştur\" butonuna basın. Kampanya ikas'ın kampanya modülünde oluşur, tüm ürünlerde geçerli olur ve sepette ikas uygular.", image: "/destek/indirimler.webp" },
    ],
  },
  {
    slug: "vitrin-kurulumu",
    category: "Vitrin modülleri",
    title: "Vitrin modülleri mağazaya nasıl kurulur",
    summary: "Vitrin anahtarı oluşturup tek satırlık kurulum kodunu ikas temanızın özel kod alanına ekleyin.",
    keywords: ["vitrin", "kurulum kodu", "script", "tema", "özel kod", "anahtar", "loader", "modül görünmüyor", "vitrin çalışmıyor"],
    path: "/vitrin",
    steps: [
      { title: "Vitrin modülleri ekranını açın", text: "Panelde Vitrin modülleri ekranına gidin ve ikas mağazanızı seçin." },
      { title: "Anahtar oluşturun", text: "\"Anahtar Oluştur\" butonuna basın. Durum \"Vitrin anahtarı oluşturulmuş\" olarak değişir.", image: "/destek/vitrin.webp" },
      { title: "Kurulum kodunu kopyalayın", text: "\"Kurulum kodu (ikas temasının özel kod alanına eklenir)\" bölümünü açıp tek satırlık kodu kopyalayın.", image: "/destek/vitrin-kod.webp" },
      { title: "ikas temasına ekleyin", text: "ikas panelinde temanızın özel kod alanına kodu yapıştırıp kaydedin. Kurulum otomatik yapılmaz; bu adım elle yapılır." },
      { title: "Modülü açın", text: "Vitrin modülleri ekranından kullanmak istediğiniz modülü seçin, ayarlarını yapıp yayınlayın.", image: "/destek/vitrin-modul.webp" },
    ],
    notes: [
      "Anahtar yenilenirse (\"Anahtarı Yenile\") eski kod çalışmaz; yeni kodu temaya tekrar eklemeniz gerekir.",
      "Ekrandaki sayılar mağazanın son 30 gününü gösterir ve mağazadaki vitrin betiğinden gelir; kod eklenmeden istatistik oluşmaz.",
    ],
  },
  {
    slug: "vitrin-modulleri",
    category: "Vitrin modülleri",
    title: "Vitrin modülleri ve ne işe yaradıkları",
    summary: "Kampanya Barı, Bilgi Şeridi, Çok Al Az Öde, Tükenmek Üzere, Hediye Çarkı ve diğer modüllerin kısa tanımı.",
    keywords: ["kampanya barı", "bilgi şeridi", "çok al az öde", "tükenmek üzere", "hediye çarkı", "flash ürünler", "fiyat altı indirimi", "ürün etiketleri", "duyuru çubuğu", "geri sayım"],
    path: "/vitrin",
    steps: [
      { title: "Kampanya Barı / Duyuru Çubuğu", text: "Sitenin üstünde ya da altında kampanya duyurusu. Kampanya Barı'nda tarih, sayfa ve cihaz hedefleme vardır." },
      { title: "Bilgi Şeridi", text: "Ürün sayfasında kargo, iade, taksit mesajları ve tek tıkla kopyalanan indirim kodu." },
      { title: "Çok Al Az Öde", text: "Adet arttıkça artan indirim. Kampanya ikas'ta kademeli indirim olarak oluşturulur ve ürün sayfasında gösterilir." },
      { title: "Tükenmek Üzere", text: "Seçili varyantın stoğu eşiğin altına inince uyarı ve ilerleme çubuğu gösterir." },
      { title: "Hediye Çarkı", text: "Ödül sunucuda belirlenen olasılıkla seçilir; kazanana ikas'ta benzersiz kupon üretilir." },
      { title: "Flash Ürünler / Fiyat Altı İndirimi", text: "Süreli indirimli ürünleri geri sayımla listeler; fiyatın altında ürüne ya da varyanta özel indirim gösterir." },
      { title: "Ürün Etiketleri", text: "Yeni, Çok Satan, İndirimde, Tükendi, Sınırlı Stok etiketlerini gerçek fiyat, stok ve satışa göre ekler ve kaldırır." },
    ],
    notes: ["Modüller mağaza bazında yönetilir: her mağazada ayrı açılır ve ayrı ayarlanır. Önce kurulum kodunun eklenmiş olması gerekir."],
  },
  {
    slug: "web-sitesi-ekleme",
    category: "Reklam ve analitik",
    title: "Web sitesi ekleme ve reklam hesabı atama",
    summary: "Reklam raporları site bazında tutulur; siteyi ekleyip mağazasını ve reklam hesaplarını bağlayın.",
    keywords: ["web sitesi", "site ekle", "alan adı", "domain", "reklam hesabı ata", "site bazında rapor"],
    path: "/siteler",
    steps: [
      { title: "Web siteleri ekranını açın", text: "Panelde Web siteleri ekranına gidin." },
      { title: "Siteyi ekleyin", text: "\"Yeni site\" formunda Site adı ve Alan adı alanlarını doldurun. Alan adı https:// ve www olmadan kaydedilir; aynı alan adı iki kez eklenemez." },
      { title: "Mağazayı bağlayın", text: "\"Bağlı mağaza\" alanından mağazayı seçip \"Siteyi ekle\" butonuna basın. Bir mağaza tek siteye bağlanabilir.", image: "/destek/siteler.webp" },
      { title: "Reklam hesaplarını atayın", text: "Reklam hesapları ekranında bağladığınız Meta ve Google Ads hesaplarını bu siteye atayın. Bir siteye birden fazla hesap bağlanabilir." },
    ],
  },
  {
    slug: "meta-ads-baglama",
    category: "Reklam ve analitik",
    title: "Meta (Facebook / Instagram) reklam hesabı bağlama",
    summary: "Meta Ads hesabınızı yalnızca okuma izniyle bağlayıp raporlamak istediğiniz hesapları seçin.",
    keywords: ["meta", "facebook", "instagram", "reklam hesabı", "ads_read", "meta bağlan", "reklam raporu"],
    path: "/reklam-hesaplari",
    steps: [
      { title: "Reklam hesapları ekranını açın", text: "Panelde Reklam hesapları ekranında Meta Ads kartını bulun." },
      { title: "Meta ile bağlanın", text: "\"Meta ile bağlan\" butonuna basın ve açılan Meta sayfasında izni onaylayın. Yalnızca okuma izni (ads_read) istenir.", image: "/destek/reklam-hesaplari.webp" },
      { title: "Hesapları seçin", text: "Panele döndüğünüzde listelenen reklam hesaplarından raporlamak istediklerinizi seçin." },
      { title: "Siteye atayın", text: "Seçtiğiniz hesapları ilgili web sitesine atayın; raporlar site bazında oluşur." },
      { title: "Verileri güncelleyin", text: "\"Verileri şimdi güncelle\" ile son verileri hemen çekebilirsiniz." },
    ],
    notes: [
      "ShipToEcom kampanya oluşturmaz, bütçe değiştirmez ve reklam düzenlemez; yalnızca okur.",
      "Kart \"Yapılandırma bekliyor\" gösteriyorsa bağlantı sunucu tarafında henüz açılmamıştır; destek ile iletişime geçin.",
    ],
  },
  {
    slug: "google-ads-baglama",
    category: "Reklam ve analitik",
    title: "Google Ads hesabı bağlama (MCC dahil)",
    summary: "Google Ads hesaplarınızı, yönetici (MCC) hesabı altındakiler dahil, yalnızca okuma için bağlayın.",
    keywords: ["google ads", "google reklam", "mcc", "yönetici hesap", "adwords", "google bağlan"],
    path: "/reklam-hesaplari",
    steps: [
      { title: "Google Ads kartını bulun", text: "Reklam hesapları ekranında Google Ads kartına gidin." },
      { title: "Google ile bağlanın", text: "\"Google ile bağlan\" butonuna basın ve Google hesabınızla izni onaylayın." },
      { title: "Hesapları seçin", text: "Doğrudan hesaplar ve MCC altındaki reklam hesapları listelenir; raporlamak istediklerinizi seçin.", image: "/destek/reklam-hesaplari.webp" },
      { title: "Siteye atayın", text: "Seçtiğiniz hesapları web sitelerine atayın." },
    ],
    notes: ["Başka bir Google hesabını eklemek için \"+ Başka Google hesabı bağla\" butonunu kullanın."],
  },
  {
    slug: "google-analytics-4",
    category: "Reklam ve analitik",
    title: "Google Analytics 4 bağlama",
    summary: "Site trafiği, kanal kırılımı ve GA4'ün ölçtüğü geliri görmek için GA4 mülkünüzü bağlayın.",
    keywords: ["ga4", "google analytics", "analytics", "trafik", "mülk", "property id", "kanal"],
    path: "/reklam-hesaplari",
    steps: [
      { title: "GA4 kartını bulun", text: "Reklam hesapları ekranında Google Analytics 4 kartına gidin." },
      { title: "Bağlanın", text: "\"Google Analytics ile bağlan\" butonuna basın ve yalnızca okuma iznini onaylayın." },
      { title: "Mülkleri listeleyin", text: "Mülkleriniz listelenir. Görünmüyorsa \"Mülkleri yenile\" butonuna basın; mülk kimliğini elle de ekleyebilirsiniz." },
      { title: "Siteye atayın", text: "Mülkü ilgili web sitesine atayın." },
    ],
    notes: ["\"Kaldır\" ile bağlantı kaldırılırsa mülkler ve trafik verileri silinir."],
  },
  {
    slug: "urun-maliyetleri",
    category: "Kârlılık ve finans",
    title: "Ürün maliyeti girme ve kâr hesabı",
    summary: "Sipariş kârının doğru hesaplanması için ürün maliyetlerini ve geçmiş dönem maliyetlerini girin.",
    keywords: ["maliyet", "alış fiyatı", "kâr", "kar", "kârlılık", "birim maliyet", "kâr yanlış"],
    path: "/analiz/maliyetler",
    steps: [
      { title: "Maliyet geçmişini açın", text: "Panelde Raporlar → Kârlılık ekranından maliyet geçmişine gidin ve ürünü adı ya da SKU ile arayın.", image: "/destek/maliyetler.webp" },
      { title: "Maliyeti girin", text: "Maliyet bileşenlerini girin. Birim maliyet bileşenlerin toplamıdır." },
      { title: "Geçmiş dönemleri tamamlayın", text: "ikas alış fiyatı değiştikçe yeni dönem otomatik açılır. Geçmiş dönemlerin maliyetini burada elle girebilirsiniz." },
    ],
    notes: [
      "Sipariş, verildiği tarihte geçerli maliyetle hesaplanır.",
      "Girilen tarih mevcut bir dönemin içine düşerse o dönem bu tarihte kapanır; kayıtlar silinmez.",
      "Maliyeti bilinmeyen dönemdeki siparişler kârlılıkta \"maliyet eksik\" görünür; eksik maliyet sıfır kabul edilmez.",
    ],
  },
  {
    slug: "siparis-giderleri",
    category: "Kârlılık ve finans",
    title: "Komisyon, kargo ve ödeme kesintisi giderleri",
    summary: "ikas'ın sağlamadığı sipariş giderlerini elle girerek net kârı doğru görün.",
    keywords: ["gider", "komisyon", "kargo", "ödeme kesintisi", "pos", "masraf", "işletme gideri", "net kâr"],
    path: "/analiz/giderler",
    steps: [
      { title: "Giderler ekranını açın", text: "Panelde Raporlar → Kârlılık altından Giderler ekranına gidin." },
      { title: "Gider ekleyin", text: "Komisyon, ödeme kesintisi, kargo ya da diğer gider türünü seçip tutarı girin ve \"Kaydet\" butonuna basın.", image: "/destek/giderler.webp" },
      { title: "Dağıtım yöntemini seçin", text: "Toplu giderleri siparişlere satış tutarına, adede ya da ağırlığa göre dağıtabilir veya elle dağıtabilirsiniz." },
      { title: "İşletme giderleri", text: "Kira, maaş gibi siparişe bağlı olmayan giderleri İşletme giderleri ekranından girin.", image: "/destek/isletme-giderleri.webp" },
    ],
    notes: ["ikas bu giderleri sağlamadığı için elle girilir."],
  },
  {
    slug: "finans-ve-raporlar",
    category: "Kârlılık ve finans",
    title: "Finans Merkezi ve raporlar",
    summary: "Ürün, kanal, sipariş, iade ve stok bazında finansal görünümü ve satış raporlarını inceleyin.",
    keywords: ["finans", "rapor", "gelir gider", "ciro", "kanal raporu", "iade raporu", "stok değeri", "satış raporu"],
    path: "/finans",
    steps: [
      { title: "Finans Merkezi'ni açın", text: "Panelde Finans ekranında tarih aralığı, mağaza ve para birimi seçin.", image: "/destek/finans.webp" },
      { title: "Sekmeleri gezin", text: "Ürün, kanal, gelir-gider, sipariş, iade ve stok sekmelerinden ilgili kırılımı açın." },
      { title: "Raporlar", text: "Raporlar ekranında satış özetlerini görün. İptal ve taslak siparişler hariç tutulur, müşteri bilgileri kullanılmaz.", image: "/destek/raporlar.webp" },
    ],
  },
  {
    slug: "lisans-ve-odeme",
    category: "Hesap ve lisans",
    title: "Paket satın alma, kartla ve havale ile ödeme",
    summary: "Paketinizi seçin, fatura bilgilerinizi girin ve kartla ya da Havale / EFT ile ödeyin.",
    keywords: ["lisans", "paket", "ödeme", "havale", "eft", "kredi kartı", "fatura", "süre doldu", "deneme bitti", "paket değiştir", "abonelik"],
    path: "/lisans",
    steps: [
      { title: "Lisans ekranını açın", text: "Panelde Lisans ekranına gidin ve paketinizi seçin.", image: "/destek/lisans.webp" },
      { title: "Fatura bilgileri (Adım 1 / 2)", text: "Ad soyad ya da şirket unvanı ile vergi no (10 hane) veya T.C. kimlik no (11 hane) girin. Faturanız bu bilgilerle düzenlenir.", image: "/destek/lisans-odeme.webp" },
      { title: "Koşulları onaylayın", text: "Satış koşullarını ve lisansın seçtiğiniz dönem için geçerli olduğunu kabul edin." },
      { title: "Kartla ödeme", text: "\"Kredi / banka kartı ile öde\" seçilirse ödeme kuruluşunun güvenli sayfası açılır. Kart bilgileriniz ShipToEcom tarafından görülmez ve saklanmaz." },
      { title: "Havale / EFT", text: "\"Havale / EFT ile öde\" seçildiğinde banka bilgileri gösterilir. Açıklamaya sipariş numarasını yazın, ödemeden sonra \"Havaleyi yaptım, bildir\" butonuna basın." },
    ],
    notes: ["Lisans süresi dolduğunda ekranda \"Süresi doldu\" uyarısı ve lisans satın alma bağlantısı görünür."],
  },
  {
    slug: "giris-sorunlari",
    category: "Sorun giderme",
    title: "Giriş yapamıyorum",
    summary: "Şifre hatası, çok sayıda hatalı deneme sonrası geçici kilit ve oturumla ilgili sık durumlar.",
    keywords: ["giriş", "şifre", "giriş yapamıyorum", "kilitlendi", "çok fazla deneme", "oturum", "login", "hesaba giremiyorum"],
    path: "/giris",
    steps: [
      { title: "E-posta ve şifreyi kontrol edin", text: "Kayıt olduğunuz e-posta adresini ve şifrenizi büyük-küçük harfe dikkat ederek girin.", image: "/destek/giris.webp" },
      { title: "Geçici kilidi bekleyin", text: "Kısa sürede çok sayıda hatalı deneme yapılırsa güvenlik için giriş 15 dakika geçici olarak engellenir. Süre dolunca tekrar deneyin." },
      { title: "Destekle iletişime geçin", text: "Sorun sürerse kayıtlı e-posta adresinizle destek ekibine yazın. Şifrenizi kimseyle paylaşmayın." },
    ],
  },
  {
    slug: "magaza-hata-veriyor",
    category: "Sorun giderme",
    title: "Mağaza \"Hata\" gösteriyor veya veriler gelmiyor",
    summary: "Bağlı mağazada hata rozeti görünüyorsa nedenini bulup bağlantıyı düzeltin.",
    keywords: ["hata", "mağaza hata", "bağlantı hatası", "yetki", "token", "veri gelmiyor", "senkron hatası", "kayıtlar", "client secret yanlış"],
    path: "/entegrasyonlar",
    steps: [
      { title: "Hata metnini okuyun", text: "Entegrasyonlar ekranında mağaza satırının altındaki kırmızı hata metni sorunun nedenini yazar." },
      { title: "Kayıtlara bakın", text: "Kayıtlar ekranında son 200 stok değişikliği ve senkron hatası listelenir.", image: "/destek/kayitlar.webp" },
      { title: "ikas uygulamasını kontrol edin", text: "ikas'taki özel uygulamanın silinmediğini ve ürün, stok, sipariş izinlerinin açık olduğunu kontrol edin." },
      { title: "Yeniden bağlayın", text: "Client Secret değiştiyse mağazayı \"Kaldır\" ile kaldırıp yeni bilgilerle tekrar bağlayın. Mağazadaki ürün ve siparişler silinmez; ortak stok bağları sıfırlanır." },
      { title: "Senkronu deneyin", text: "\"Şimdi senkronize et\" ile tekrar deneyin ve rozetin \"Aktif\" olduğunu kontrol edin." },
    ],
  },
  {
    slug: "stok-yanlis",
    category: "Sorun giderme",
    title: "Mağazalardaki stok farklı görünüyor",
    summary: "Ortak stokta mağaza payı, güvenlik stoğu ve eşleştirme ayarları nedeniyle oluşan farkları anlayın.",
    keywords: ["stok farklı", "stok yanlış", "stok tutmuyor", "stok eşit değil", "stok düştü", "fazla satış"],
    path: "/stok",
    steps: [
      { title: "Eşleştirmeyi kontrol edin", text: "Ürün iki mağazada farklı SKU ile kayıtlıysa eşleşmemiş olabilir; Ürünler altındaki eşleştirme ekranından kontrol edin." },
      { title: "Pay ve güvenlik stoğunu kontrol edin", text: "Stok ekranında ürünün mağaza payı, minimum stok ve güvenlik stoğu ayarları mağazada görünen stoğu bilerek farklılaştırır.", image: "/destek/stok-ayarlar.webp" },
      { title: "Kritik stok modunu kontrol edin", text: "Satılabilir stok kritik seviyeye indiyse ürün yalnızca öncelikli mağazada satışa açık kalır." },
      { title: "Kayıtlara bakın", text: "Kayıtlar ekranındaki stok değişikliklerinden hangi mağazaya ne yazıldığını görün." },
    ],
  },
];

/** Türkçe karakterleri sadeleştirip küçük harfe çevirir: "Şifre İşlemi" -> "sifre islemi". */
export function normalizeTr(s: string) {
  return s
    .toLocaleLowerCase("tr")
    .replace(/[ıİ]/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[âà]/g, "a")
    .replace(/[îì]/g, "i")
    .replace(/[ûù]/g, "u")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export type HelpIndexEntry = { slug: string; category: string; title: string; summary: string; t: string; k: string; b: string };

/** Arama dizini: alanlar önceden normalize edilir (istemciye bu gönderilir). */
export function buildHelpIndex(articles: HelpArticle[] = HELP_ARTICLES): HelpIndexEntry[] {
  return articles.map((a) => ({
    slug: a.slug,
    category: a.category,
    title: a.title,
    summary: a.summary,
    t: normalizeTr(a.title),
    k: normalizeTr(a.keywords.join(" ")),
    b: normalizeTr([a.summary, a.category, ...a.steps.flatMap((s) => [s.title, s.text]), ...(a.notes ?? [])].join(" ")),
  }));
}

/** Sorguyu arar: her kelime başlık, anahtar kelime ya da metinde geçmeli. Puana göre sıralı döner. */
export function searchHelp(index: HelpIndexEntry[], query: string): HelpIndexEntry[] {
  const words = normalizeTr(query).split(" ").filter(Boolean);
  if (!words.length) return index;
  const scored: { e: HelpIndexEntry; score: number }[] = [];
  for (const e of index) {
    let score = 0;
    let all = true;
    for (const w of words) {
      const s = (e.t.includes(w) ? 6 : 0) + (e.k.includes(w) ? 4 : 0) + (e.b.includes(w) ? 1 : 0);
      if (!s) { all = false; break; }
      score += s;
    }
    if (all) scored.push({ e, score: score + (e.t.includes(words.join(" ")) ? 5 : 0) });
  }
  return scored.sort((x, y) => y.score - x.score).map((x) => x.e);
}

export const helpArticle = (slug: string) => HELP_ARTICLES.find((a) => a.slug === slug);
