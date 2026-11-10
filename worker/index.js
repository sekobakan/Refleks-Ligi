// Reflex League API: günlük sıralama + haftalık lig (D1). Statik dosyalar ASSETS'ten.
// Gün = UTC gün numarası (istemciyle aynı), hafta Pazartesi başlar.
// Doğrulama şimdilik tutarlılık kontrolü (puan/doğru sayısı sınırları, hız sınırı); tam tur tekrarı doğrulaması sonraki aşama.
const J = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json", "cache-control": "no-store" } });
const today = () => Math.floor(Date.now() / 864e5);
const weekOf = (d) => Math.floor((d + 3) / 7);
const cleanNick = (n) => (String(n || "").replace(/[^\p{L}\p{N} _.-]/gu, "").trim().slice(0, 14)) || "Player";
const PID = /^[a-f0-9-]{16,40}$/;
const tier = (rank, total) => { const p = (rank - 1) / Math.max(1, total); return p < 0.1 ? 3 : p < 0.3 ? 2 : p < 0.6 ? 1 : 0; };

async function dayStats(db, day, pid) {
  const me = await db.prepare("SELECT score FROM scores WHERE day=? AND pid=?").bind(day, pid).first();
  const total = (await db.prepare("SELECT COUNT(*) c FROM scores WHERE day=?").bind(day).first()).c;
  if (!me) return { rank: null, score: 0, total };
  const above = (await db.prepare("SELECT COUNT(*) c FROM scores WHERE day=? AND score>?").bind(day, me.score).first()).c;
  return { rank: above + 1, score: me.score, total };
}
async function weekStats(db, week, pid) {
  const me = await db.prepare("SELECT SUM(score) s FROM scores WHERE week=? AND pid=?").bind(week, pid).first();
  const total = (await db.prepare("SELECT COUNT(DISTINCT pid) c FROM scores WHERE week=?").bind(week).first()).c;
  if (!me || me.s == null) return { rank: null, score: 0, total, tier: 0 };
  const above = (await db.prepare("SELECT COUNT(*) c FROM (SELECT SUM(score) s FROM scores WHERE week=? GROUP BY pid HAVING s>?)").bind(week, me.s).first()).c;
  return { rank: above + 1, score: me.s, total, tier: tier(above + 1, total) };
}

export default {
  async fetch(req, env) {
    const u = new URL(req.url);
    try {
      if (u.pathname === "/api/score" && req.method === "POST") {
        const b = await req.json().catch(() => null);
        if (!b || !PID.test(String(b.pid))) return J({ error: "bad_request" }, 400);
        const t = today(), day = Number(b.day), score = Number(b.score), ok = Number(b.ok), combo = Number(b.combo);
        const late = day === t - 1 && Date.now() % 864e5 < 15 * 60e3;
        if (day !== t && !late) return J({ error: "wrong_day", today: t }, 409);
        const sane = [score, ok, combo].every(Number.isInteger) && score >= 0 && score % 10 === 0 && ok >= 0 && ok <= 140 && combo <= ok && score >= ok * 10 && score <= ok * 50;
        if (!sane) return J({ error: "invalid_score" }, 422);
        const now = Date.now(), nick = cleanNick(b.nick);
        const old = await env.DB.prepare("SELECT score, ts FROM scores WHERE day=? AND pid=?").bind(day, b.pid).first();
        if (old && now - old.ts < 8000) return J({ error: "too_fast" }, 429);
        await env.DB.prepare("INSERT INTO scores (day,week,pid,nick,score,ok,combo,ts) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(day,pid) DO UPDATE SET nick=excluded.nick, ts=excluded.ts, score=MAX(score,excluded.score), ok=CASE WHEN excluded.score>score THEN excluded.ok ELSE ok END, combo=CASE WHEN excluded.score>score THEN excluded.combo ELSE combo END")
          .bind(day, weekOf(day), b.pid, nick, score, ok, combo, now).run();
        return J({ day: await dayStats(env.DB, day, b.pid), week: await weekStats(env.DB, weekOf(day), b.pid) });
      }
      if (u.pathname === "/api/board" && req.method === "GET") {
        const pid = u.searchParams.get("pid") || "", day = today(), week = weekOf(day), mode = u.searchParams.get("mode") === "week" ? "week" : "day";
        const rows = mode === "day"
          ? (await env.DB.prepare("SELECT nick, score, pid FROM scores WHERE day=? ORDER BY score DESC, ts ASC LIMIT 50").bind(day).all()).results
          : (await env.DB.prepare("SELECT MAX(nick) nick, SUM(score) score, pid FROM scores WHERE week=? GROUP BY pid ORDER BY score DESC LIMIT 50").bind(week).all()).results;
        const me = PID.test(pid) ? (mode === "day" ? await dayStats(env.DB, day, pid) : await weekStats(env.DB, week, pid)) : null;
        return J({ mode, day, top: rows.map((r) => ({ nick: r.nick, score: r.score, me: r.pid === pid })), me });
      }
      if (u.pathname.startsWith("/api/")) return J({ error: "not_found" }, 404);
    } catch (e) {
      return J({ error: "server_error" }, 500);
    }
    return env.ASSETS.fetch(req);
  },
};
