CREATE TABLE IF NOT EXISTS scores (
  day INTEGER NOT NULL, week INTEGER NOT NULL, pid TEXT NOT NULL, nick TEXT NOT NULL,
  score INTEGER NOT NULL, ok INTEGER NOT NULL, combo INTEGER NOT NULL, ts INTEGER NOT NULL,
  PRIMARY KEY (day, pid)
);
CREATE INDEX IF NOT EXISTS scores_day ON scores (day, score DESC);
CREATE INDEX IF NOT EXISTS scores_week ON scores (week, pid);
-- v2: ülke kodu (bağlantıdan), ülke sıralaması için
-- ALTER TABLE scores ADD COLUMN cc TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS scores_day_cc ON scores (day, cc, score DESC);
-- v3: bilgi kartları veritabanında (günlük rutin buraya ekler; uygulama /api/cards ile okur)
CREATE TABLE IF NOT EXISTS cards (
  id INTEGER PRIMARY KEY AUTOINCREMENT, c TEXT NOT NULL, d INTEGER NOT NULL,
  q_tr TEXT NOT NULL, q_en TEXT NOT NULL, a TEXT NOT NULL, k_tr TEXT NOT NULL UNIQUE, k_en TEXT NOT NULL UNIQUE
);
