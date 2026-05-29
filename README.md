# İddia — Arkadaş Bahis Uygulaması

## Kurulum (5 dakika)

### 1. Netlify Environment Variables
Netlify dashboard → Site → Environment Variables → şunları ekle:

```
SUPABASE_URL=https://eeluanxswhzmsfygtjbo.supabase.co
SUPABASE_SERVICE_KEY=<Supabase > Settings > API > service_role key>
```

### 2. GitHub'a Push
```bash
git init
git add .
git commit -m "init"
git remote add origin <repo-url>
git push -u origin main
```

### 3. Netlify'a Bağla
Netlify → Add new site → Import from GitHub → repo seç → Deploy

---

## Kullanım
- Ana sayfada "Yeni Bahis Oluştur" → başlık, seçenekler, oranlar, admin şifresi
- Oluşan linki WhatsApp/Telegram'a at
- Arkadaşlar linke tıklar → nickname yazar → seçenek seçer → Katıl
- Bahis bitince admin şifresiyle kazananı belirle

## Mimari
- `public/index.html` → Frontend
- `netlify/functions/bet.js` → API (SUPABASE_SERVICE_KEY burada gizli kalır)
- Supabase → PostgreSQL veritabanı (bets + participants tabloları)
- Bahisler 7 gün sonra otomatik silinir
