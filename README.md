# Reflex League (Refleks Ligi)

60 saniyelik, tek parmakla oynanan refleks oyunu. Her gün herkese aynı tur (tarih tohumlu), 7 mini oyun, seri çarpanı, token.

- Prototip (tarayıcı): `public/index.html`, tek dosya, bağımlılık yok.
- Önizleme: https://refleks-ligi.square-term-6f51.workers.dev (`npx -y wrangler@4 deploy`, noindex)
- Sıradaki aşama: çevrim içi sıralama + haftalık lig (Cloudflare), AdMob ödüllü reklam, Flutter ile Android/iOS paketleri.
- Kural: token yalnızca oyun içi (para/ödüle çevrilmez); AdMob ve mağaza politikaları gereği.

## Bilgi kartları
`public/cards.json` içinde durur; oyun her açılışta buradan çeker, yani yeni kart eklemek için uygulama güncellemesi gerekmez.
Biçim: `{"q":["Türkçe soru","English question"],"a":["doğru","yanlış","yanlış","yanlış"]}`; ilk cevap doğrudur, iki dilde farklıysa `"Türkçe|English"`.
Kartlar yalnızca kesin, tartışmasız bilgilerden seçilir (sıralamaya puan olarak yansıdığı için).

## Tur doğrulaması
`/api/start` imzalı bir tur anahtarı verir (`RUN_KEY` gizli anahtarı, `wrangler secret put RUN_KEY`). Skor, anahtar + geçen süre + doğru/yanlış sayısı tutarlıysa kabul edilir.

Kategoriler (`c`): geo, sci, nature, math, history, art, sport, tech. `d` = kartın eklendiği UTC gün numarası; kart ertesi gün oyunda görünür.
Denetim: `python3 tools/cards_check.py`. Günlük rutin her gün 10 yeni kart ekler (denetim + `npx wrangler@4 deploy`).
