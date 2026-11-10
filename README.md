# 42 Istanbul — Gece Dinlenmesi Anketi

TR/EN anket. 42 intra ile giriş, sadece aktif 42 Istanbul öğrencileri, kişi başı tek oy, cevap değiştirilemez.
Admin paneli ortak şifreyle; hiçbir yerde login/isim yok.

## Neyi saklıyoruz? (kodu kendin kontrol et)
Bu repo, yayındaki sitenin kaynağıdır; sitenin altındaki linkte deploy edilen commit yazar.

| Tablo | Kolonlar | Kimlik bilgisi? |
|---|---|---|
| `voters` | `voter_hash` | `HMAC-SHA256(VOTER_SALT, intra_id)` — login, isim, e-posta, zaman yok |
| `responses` | `id` (rastgele uuid), `answer`, `reason`, `suggestion`, `comment`, `lang`, `created_on` (sadece gün) | yok |
| `rule_votes` | `response_id`, `rule_id`, `agree`, `comment` | yok |

İlgili kod:
- `src/lib/schema.ts`: şema, başka tablo yok.
- `src/app/api/auth/callback/route.ts`: intra profili sadece uygunluk kontrolü için okunur, sonra atılır.
- `src/lib/intra.ts`: `voterHash` ve `checkEligibility`.
- `src/lib/survey.ts`: `submit`, oyu yazan tek fonksiyon.
- `tests/survey.test.ts`: “anonymity” testleri kolon listelerini birebir doğrular.

**Oy ile cevap neden bağlanamaz?**
- `voters` ile `responses` arasında ortak anahtar yok.
- Postgres her satıra transaction no (`xmin`) ve fiziksel konum (`ctid`) yazar. Bu yüzden her oyda `voters` tablosunun tamamı rastgele sırayla yeniden yazılır. Sonuçta tüm voter satırları aynı `xmin`'e sahip olur, sıraları karışır; test: “xmin / ctid cannot tie…”.
- Admin paneli ve CSV hash, tarih ve sıra göstermez; metinler rastgele sıralanır.

**Kalan riskler (dürüst liste):**
- Hem `VOTER_SALT`'a hem DB'ye erişimi olan kişi, bir intra id'nin oy verip vermediğini görebilir, ama *ne* oy verdiğini göremez. Tek oy kuralı bu kontrolü gerektiriyor.
- Postgres'in WAL / yedek dosyaları, sunucu seviyesinde erişimi olan birine yazma sırasını gösterebilir. Normal SQL ile bu bilgiye ulaşılamaz.
- Anket bitince `voters` tablosu boşaltılacak ve `VOTER_SALT` silinecek. Böylece hash'ler de anlamsızlaşır.
- intra, OAuth girişinin yapıldığını kendi tarafında görür. Bu sitenin kontrolü dışında.

`VOTER_SALT` anket bitene kadar değişmemeli; değişirse herkes tekrar oy verebilir.

## Kurulum
```bash
npm install
cp .env.example .env.local   # değerleri doldur
npm run dev                  # http://localhost:3000
```

## Kontrol
```bash
npm test          # 26 test: tek oy, anonimlik şeması, uygunluk, CSV
npm run typecheck
npm run build
```

## Yayına alma (Vercel)
1. Postgres oluştur (Neon/Supabase), `DATABASE_URL` ver. Tablolar ilk istekte otomatik kurulur.
2. `.env.example`'daki tüm değişkenleri Vercel'e ekle.
3. intra app #79145 > Redirect URI'ye `https://<domain>/api/auth/callback` ekle, aynısını `FT_REDIRECT_URI` yap.
4. 16/11/2026'dan sonra yeni secret'ı `FT_CLIENT_SECRET_NEXT`'e yaz.

## Admin
`/admin` — özet, kural bazında destek, cevaplar, kelime sıklığı, AI tema analizi, kural yönetimi,
yazdırılabilir rapor (`/admin/report`), anonim CSV (`/api/admin/export`).
