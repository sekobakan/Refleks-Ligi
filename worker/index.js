// Reflex League API: günlük sıralama + haftalık lig (D1). Statik dosyalar ASSETS'ten.
// Gün = UTC gün numarası (istemciyle aynı), hafta Pazartesi başlar.
// Tur doğrulaması: /api/start imzalı bir tur anahtarı (sid) verir; skor gönderimi bu anahtarı, geçen süreyi ve
// doğru/yanlış sayısının süreyle ve puanla tutarlılığını kontrol eder. Ülke, bağlantıdan (cf.country) alınır.
const J = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json", "cache-control": "no-store" } });
const today = () => Math.floor(Date.now() / 864e5);
const weekOf = (d) => Math.floor((d + 3) / 7);
const cleanNick = (n) => (String(n || "").replace(/[^\p{L}\p{N} _.-]/gu, "").trim().slice(0, 14)) || "Player";
const PID = /^[a-f0-9-]{16,40}$/;
const tier = (rank, total) => { const p = (rank - 1) / Math.max(1, total); return p < 0.1 ? 3 : p < 0.3 ? 2 : p < 0.6 ? 1 : 0; };
const country = (req) => { const c = (req.cf && req.cf.country) || ""; return /^[A-Z]{2}$/.test(c) && c !== "XX" && c !== "T1" ? c : ""; };
const maxScore = (ok) => { let s = 0; for (let i = 0; i < ok; i++) s += 10 * Math.min(5, 1 + Math.floor(i / 3)); return s; };

async function sign(env, msg) {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(env.RUN_KEY || "dev-key"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const b = new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(msg)));
  return [...b.slice(0, 16)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

async function dayStats(db, day, pid) {
  const me = await db.prepare("SELECT score, cc FROM scores WHERE day=? AND pid=?").bind(day, pid).first();
  const total = (await db.prepare("SELECT COUNT(*) c FROM scores WHERE day=?").bind(day).first()).c;
  if (!me) return { rank: null, score: 0, total };
  const above = (await db.prepare("SELECT COUNT(*) c FROM scores WHERE day=? AND score>?").bind(day, me.score).first()).c;
  const out = { rank: above + 1, score: me.score, total };
  if (me.cc) {
    out.ctotal = (await db.prepare("SELECT COUNT(*) c FROM scores WHERE day=? AND cc=?").bind(day, me.cc).first()).c;
    out.crank = (await db.prepare("SELECT COUNT(*) c FROM scores WHERE day=? AND cc=? AND score>?").bind(day, me.cc, me.score).first()).c + 1;
  }
  return out;
}
async function scoped(db, mode, key, pid, cc) {
  // cc verilirse yalnız o ülke içinde sıra
  const col = mode === "day" ? "day" : "week", w = cc ? ` AND cc=?` : "", args = cc ? [key, cc] : [key];
  const me = await db.prepare(`SELECT SUM(score) s FROM scores WHERE ${col}=? AND pid=?${w}`).bind(key, pid, ...(cc ? [cc] : [])).first();
  const total = (await db.prepare(`SELECT COUNT(DISTINCT pid) c FROM scores WHERE ${col}=?${w}`).bind(...args).first()).c;
  if (!me || me.s == null) return { rank: null, score: 0, total, tier: 0 };
  const above = (await db.prepare(`SELECT COUNT(*) c FROM (SELECT SUM(score) s FROM scores WHERE ${col}=?${w} GROUP BY pid HAVING s>?)`).bind(...args, me.s).first()).c;
  return { rank: above + 1, score: me.s, total, tier: tier(above + 1, total) };
}

export default {
  async fetch(req, env) {
    const u = new URL(req.url);
    try {
      if (u.pathname === "/api/start" && req.method === "POST") {
        const b = await req.json().catch(() => null);
        if (!b || !PID.test(String(b.pid))) return J({ error: "bad_request" }, 400);
        const ts = Date.now();
        return J({ sid: ts + "." + (await sign(env, b.pid + "." + ts)), cc: country(req) });
      }
      if (u.pathname === "/api/score" && req.method === "POST") {
        const b = await req.json().catch(() => null);
        if (!b || !PID.test(String(b.pid))) return J({ error: "bad_request" }, 400);
        const t = today(), day = Number(b.day), score = Number(b.score), ok = Number(b.ok), combo = Number(b.combo), bad = Number(b.bad);
        const late = day === t - 1 && Date.now() % 864e5 < 15 * 60e3;
        if (day !== t && !late) return J({ error: "wrong_day", today: t }, 409);
        const [tsS, sig] = String(b.sid || "").split("."), ts = Number(tsS), now = Date.now(), el = now - ts;
        if (!ts || !sig || sig !== (await sign(env, b.pid + "." + ts))) return J({ error: "bad_run" }, 403);
        if (el < 0 || el > 20 * 60e3) return J({ error: "run_expired" }, 403);
        const sane = [score, ok, combo, bad].every(Number.isInteger) && score >= 0 && score % 10 === 0 && ok >= 0 && ok <= 160 && bad >= 0 && bad <= 40 &&
          combo <= ok && score >= ok * 10 && score <= maxScore(ok) &&
          el >= 60000 - 3000 * Math.min(bad, 19) - 1500 && // tur en az bu kadar sürmüş olmalı
          ok * 300 + bad * 150 <= el;                      // insan hızının üstünde cevap sayısı olamaz
        if (!sane) return J({ error: "invalid_score" }, 422);
        const nick = cleanNick(b.nick), cc = country(req);
        const old = await env.DB.prepare("SELECT score, ts FROM scores WHERE day=? AND pid=?").bind(day, b.pid).first();
        if (old && now - old.ts < 8000) return J({ error: "too_fast" }, 429);
        await env.DB.prepare("INSERT INTO scores (day,week,pid,nick,score,ok,combo,ts,cc) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(day,pid) DO UPDATE SET nick=excluded.nick, ts=excluded.ts, cc=excluded.cc, score=MAX(score,excluded.score), ok=CASE WHEN excluded.score>score THEN excluded.ok ELSE ok END, combo=CASE WHEN excluded.score>score THEN excluded.combo ELSE combo END")
          .bind(day, weekOf(day), b.pid, nick, score, ok, combo, now, cc).run();
        return J({ cc, day: await dayStats(env.DB, day, b.pid), week: await scoped(env.DB, "week", weekOf(day), b.pid, "") });
      }
      if (u.pathname === "/api/board" && req.method === "GET") {
        const pid = u.searchParams.get("pid") || "", day = today(), week = weekOf(day), mode = u.searchParams.get("mode") === "week" ? "week" : "day";
        const myCc = country(req), cc = u.searchParams.get("scope") === "cc" ? myCc : "";
        if (u.searchParams.get("scope") === "cc" && !cc) return J({ mode, day, cc: "", top: [], me: null });
        const w = cc ? " AND cc=?" : "", args = cc ? [cc] : [];
        const rows = mode === "day"
          ? (await env.DB.prepare(`SELECT nick, score, pid, cc FROM scores WHERE day=?${w} ORDER BY score DESC, ts ASC LIMIT 50`).bind(day, ...args).all()).results
          : (await env.DB.prepare(`SELECT MAX(nick) nick, SUM(score) score, pid, MAX(cc) cc FROM scores WHERE week=?${w} GROUP BY pid ORDER BY score DESC LIMIT 50`).bind(week, ...args).all()).results;
        const me = PID.test(pid) ? await scoped(env.DB, mode, mode === "day" ? day : week, pid, cc) : null;
        return J({ mode, day, cc: myCc, top: rows.map((r) => ({ nick: r.nick, score: r.score, cc: r.cc || "", me: r.pid === pid })), me });
      }
      if (u.pathname.startsWith("/api/")) return J({ error: "not_found" }, 404);
    } catch (e) {
      return J({ error: "server_error" }, 500);
    }
    return env.ASSETS.fetch(req);
  },
};
