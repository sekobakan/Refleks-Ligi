"""Bilgi kartlarını denetler: python3 tools/cards_check.py  (hata varsa çıkış kodu 1)
Kart: {"c": kategori, "d": eklendiği UTC gün numarası, "q": [TR, EN], "a": [doğru, yanlış, yanlış, yanlış]}
Bir kart, eklendiği günden SONRAKİ gün oyunda görünür (gün içinde herkes aynı soruları görsün diye).
"""
import json, re, sys, time, unicodedata
CATS = {"geo", "sci", "nature", "math", "history", "art", "sport", "tech"}
def norm(s):
    s = unicodedata.normalize("NFKD", s.lower()); return re.sub(r"[^a-z0-9]+", "", "".join(c for c in s if not unicodedata.combining(c)))
j = json.load(open("public/cards.json", encoding="utf-8")); err = []; seen = {}; today = int(time.time() // 86400)
for i, c in enumerate(j["cards"], 1):
    def e(m): err.append(f"{i}. kart ({c.get('q', ['?'])[0][:40]}): {m}")
    if set(c) != {"c", "d", "q", "a"}: e("alanlar c,d,q,a olmalı"); continue
    if c["c"] not in CATS: e("kategori geçersiz: " + str(c["c"]))
    if not isinstance(c["d"], int) or c["d"] > today: e("d (gün) geçersiz")
    if len(c["q"]) != 2 or not all(isinstance(x, str) and 8 <= len(x) <= 52 and x.endswith("?") for x in c["q"]): e("soru iki dilde, 8-52 karakter, ? ile bitmeli")
    if len(c["a"]) != 4: e("4 cevap olmalı"); continue
    for lang in (0, 1):
        opts = [str(a).split("|")[lang] if "|" in str(a) else str(a) for a in c["a"]]
        if len(set(norm(o) for o in opts)) != 4: e("cevaplar birbirinden farklı olmalı")
        if any(not o or len(o) > 16 for o in opts): e("cevap en çok 16 karakter")
    if any(str(a).count("|") > 1 for a in c["a"]): e("cevapta en çok bir | olur")
    for lang in (0, 1):
        k = norm(c["q"][lang])
        if k in seen: e(f"aynı soru {seen[k]}. kartta var")
        seen[k] = i
from collections import Counter
print(len(j["cards"]), "kart ·", dict(Counter(c["c"] for c in j["cards"])))
if err: print("\n".join(err)); sys.exit(1)
print("Kartlar geçerli.")
