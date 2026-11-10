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
