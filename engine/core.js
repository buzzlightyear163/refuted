/* REFUTED core — the lab's logic, with no network code.
   observe a coin -> features -> strategies -> paper trades -> checkpoints at 5/15/60 min -> verdicts.
   run.js feeds it real data (Jupiter) and saves the state between runs. */
const { AGENTS, SEED, POOL, FAMILIES } = require("./strategies.js");

const RULE = { minTrades: 30, med: 0, hit: 40, cost: 2, checkpoints: [5, 15, 60], active: 12 };
const LIVE_TOL = 60e3;          // a checkpoint sample must land within 60 s of its due time to count as "live"
const LATE_MAX = 10 * 60e3;     // after that we try the candle history; a sample more than 10 min late is a miss
const CONTINUOUS = 90e3;        // a coin seen again within 90 s counts as watched without a gap
const COST = RULE.cost / 100;   // 2% round trip (fees + slippage), taken off every paper trade

const num = v => (v === null || v === undefined || v === "" || !isFinite(+v)) ? null : +v;
const r1 = v => v === null || v === undefined ? null : Math.round(v * 10) / 10;
const r2 = v => v === null || v === undefined ? null : Math.round(v * 100) / 100;
const clean = s => String(s || "").replace(/^\$+/, "").replace(/\s+/g, " ").trim();

// ---------- strategies (code lookup by key, because functions can't be saved) ----------
function defFor(key) {
  if (key.startsWith("S-")) return SEED.find(s => s.id === key);
  if (key.startsWith("P:")) return POOL[+key.slice(2)];
  if (key.startsWith("F:")) { const [, fi, pi] = key.split(":").map(Number); const fam = FAMILIES[fi]; return fam && Object.assign({ agent: fam.agent }, fam.make(...fam.params[pi])); }
  return null;
}
const WHEN = {}, ANYTIME = {};
function whenFor(s) { if (!WHEN[s.key]) { const d = defFor(s.key); WHEN[s.key] = d ? d.when : () => false; ANYTIME[s.key] = !!(d && d.anytime); } return WHEN[s.key]; }

function newState(now) {
  const st = { v: 1, started: now, runs: { n: 0, lastStart: 0, lastEnd: 0, ms: 0 }, launches: 0, hourly: {}, tokens: {},
    strategies: [], nextPool: 0, nextFam: 0, nextNum: SEED.length + 1, open: [], done: {}, rets: {}, feed: [], gecko: [] };
  for (const s of SEED) addStrategy(st, s.id, s, now, "seed");
  event(st, now, { k: "boot", tx: `Lab opened with ${SEED.length} strategies on trial.` });
  return st;
}

function addStrategy(st, key, d, now, src, id) {
  const s = { id: id || d.id, key, name: d.name, agent: d.agent, myth: d.myth, rule: d.rule, born: now, status: "testing", diedAt: 0, cause: "", src, lastMatch: 0, n: 0 };
  st.strategies.push(s); st.done[s.id] = []; st.rets[s.id] = { r5: [], r15: [], r60: [] };
  return s;
}

function proposeIfNeeded(st, now) {
  const active = () => st.strategies.filter(s => s.status !== "refuted").length;
  let guard = 0;
  while (active() < RULE.active && guard++ < 6) {
    let key, d;
    if (st.nextPool < POOL.length) { key = "P:" + st.nextPool; d = POOL[st.nextPool]; st.nextPool++; }
    else {
      // walk the families round-robin: F:<family>:<param>
      let fi, pi, tries = 0;
      do { const n = st.nextFam++; fi = n % FAMILIES.length; pi = Math.floor(n / FAMILIES.length); } while (pi >= FAMILIES[fi].params.length && tries++ < 400);
      if (pi >= FAMILIES[fi].params.length) return;
      key = `F:${fi}:${pi}`; d = defFor(key);
    }
    const id = "S-" + String(st.nextNum++).padStart(2, "0");
    const s = addStrategy(st, key, d, now, key[0] === "P" ? "pool" : "family", id);
    event(st, now, { k: "propose", s: s.id, a: s.agent, tx: `${s.agent} proposed ${s.id} ${s.name}: ${s.rule}` });
  }
}

// ---------- feed ----------
const MILESTONE = { boot: 1, propose: 1, death: 1, survive: 1 };
function event(st, t, e) {
  const ev = Object.assign({ t }, e);
  st.feed.push(ev); if (st.feed.length > 600) st.feed.splice(0, st.feed.length - 600);
  if (MILESTONE[e.k]) { st.log = st.log || []; st.log.push(ev); if (st.log.length > 400) st.log.splice(0, st.log.length - 400); }
}

// ---------- coins ----------
function hourKey(t) { return Math.floor(t / 3600e3); }

function upsert(st, a, now) {
  if (!a || !a.id) return null;
  const created = Date.parse(a.createdAt) || null;
  let T = st.tokens[a.id];
  if (!T) {
    if (!created) return null;
    T = st.tokens[a.id] = { m: a.id, s: clean(a.symbol).slice(0, 16), n: clean(a.name).slice(0, 40), c: created, fs: now, tw: 0, web: 0, tg: 0, dev0: null,
      bc: null, px: null, mc: null, h: null, pkBc: 0, pkPx: 0, t50: null, below50: false, hit50: false, fell: false, grad: 0, up: 0, ok: [] };
    if (now - created < 10 * 60e3) { st.launches++; const hk = hourKey(created); st.hourly[hk] = (st.hourly[hk] || 0) + 1; }
  }
  // socials only come with the discovery feed
  if (a.twitter) T.tw = 1; if (a.website) T.web = 1; if (a.telegram) T.tg = 1;
  return T;
}

// one fresh reading of a coin (Jupiter asset). Returns trades opened.
function observe(st, a, now) {
  const T = upsert(st, a, now); if (!T) return [];
  const au = a.audit || {}, s5 = a.stats5m || {};
  const prevUp = T.up, prevOk = new Set(T.ok || []);
  const bc = num(a.bondingCurve), px = num(a.usdPrice);
  if (px === null) return [];
  T.px = px; T.mc = num(a.mcap) ?? num(a.fdv); T.liq = num(a.liquidity); T.h = num(a.holderCount);
  T.top10 = num(au.topHoldersPercentage); T.dev = num(au.devBalancePercentage); T.sn = num(au.sniperPct); T.ins = num(au.insiderPct);
  T.b5 = num(s5.numBuys) || 0; T.s5 = num(s5.numSells) || 0; T.t5 = num(s5.numTraders) || 0; T.nb5 = num(s5.numNetBuyers);
  T.v5 = (num(s5.buyVolume) || 0) + (num(s5.sellVolume) || 0); T.hc5 = num(s5.holderChange); T.org = num(a.organicScore);
  const gradAt = Date.parse(a.graduatedAt) || 0;
  if (gradAt) T.grad = gradAt;
  T.bc = T.grad ? 100 : bc;
  const age = (now - T.c) / 1000;
  if (T.dev0 === null && age <= 120 && T.dev !== null) T.dev0 = T.dev;
  if (T.bc !== null) {
    if (T.bc < 50) T.below50 = true;
    if (T.bc >= 50 && !T.hit50) { T.hit50 = true; if (T.below50 && prevUp) T.t50 = Math.round(age); }
    if (T.hit50 && T.bc < 30) T.fell = true;
    T.pkBc = Math.max(T.pkBc || 0, T.bc);
  }
  T.pkPx = Math.max(T.pkPx || 0, px);
  T.up = now;
  // checkpoints for open paper trades on this coin
  checkTrades(st, T, now);
  // strategies
  const f = features(T, now);
  const continuous = prevUp && now - prevUp <= CONTINUOUS;
  const fresh = !prevUp && age <= 120;          // first sight of a coin that just launched
  const ok = [], opened = [];
  for (const s of st.strategies) {
    if (s.status === "refuted") continue;
    let hit = false; try { hit = !!whenFor(s)(f); } catch (e) { hit = false; }
    if (!hit) continue;
    ok.push(s.id);
    const wasWatched = continuous && prevUp >= s.born;
    if (prevOk.has(s.id)) continue;               // already true last time: not a new signal
    // threshold rules need a coin we watched cross the line; time-boxed rules (anytime) can enter on first sight
    if (!(wasWatched || ((fresh || ANYTIME[s.key]) && now >= s.born))) continue;
    if (st.open.some(t => t.s === s.id && t.m === T.m) || st.done[s.id].some(t => t.m === T.m)) continue;
    opened.push(openTrade(st, s, T, f, now));
  }
  T.ok = ok;
  return opened;
}

function features(T, now) {
  const age = (now - T.c) / 1000;
  return {
    age, bc: T.bc ?? 0, grad: !!T.grad, gradAge: T.grad ? (now - T.grad) / 1000 : null, gradAtAge: T.grad ? (T.grad - T.c) / 1000 : null,
    mcap: T.mc || 0, px: T.px, holders: T.h || 0, top10: T.top10, dev: T.dev, devFirst: T.dev0, sniper: T.sn, insider: T.ins,
    b5: T.b5 || 0, s5: T.s5 || 0, t5: T.t5 || 0, nb5: T.nb5, vol5: T.v5 || 0, hc5: T.hc5, org: T.org,
    tw: !!T.tw, web: !!T.web, tg: !!T.tg, sym: T.s, symLen: (T.s || "").length, name: T.n,
    peakBc: T.pkBc || 0, dd: T.pkPx ? (T.px / T.pkPx - 1) * 100 : null, t50: T.t50, fellAfter50: !!T.fell,
  };
}

function why(s, f) {
  const p = [];
  if (f.grad) p.push("migrated " + Math.round(f.gradAge) + "s ago"); else p.push(r1(f.bc) + "% bonding");
  p.push(fmtAge(f.age) + " old");
  if (f.holders) p.push(f.holders + " holders");
  return p.join(" · ");
}
function fmtAge(sec) { sec = Math.round(sec); if (sec < 60) return sec + "s"; if (sec < 3600) return Math.floor(sec / 60) + "m " + String(sec % 60).padStart(2, "0") + "s"; return Math.floor(sec / 3600) + "h " + Math.floor((sec % 3600) / 60) + "m"; }

function openTrade(st, s, T, f, now) {
  const t = { id: s.id + ":" + T.m.slice(0, 8), s: s.id, m: T.m, y: T.s, n: T.n, at: now, px: T.px, mc: T.mc, bc: r1(f.bc), age: Math.round(f.age), h: T.h || 0, note: why(s, f), ck: {} };
  st.open.push(t); s.n++; s.lastMatch = now;
  event(st, now, { k: "match", s: s.id, m: T.m, y: T.s, tx: `${s.id} ${s.name} matched $${T.s} · ${t.note}` });
  return t;
}

const ret = (t, px) => r2(((px / t.px) * (1 - COST) - 1) * 100);

function fill(st, t, k, px, at, src, now) {
  if (t.ck[k]) return;
  const due = t.at + k * 60e3;
  if (px === null || px === undefined) { t.ck[k] = { r: null, src: "miss", lag: Math.round((now - due) / 1000) }; }
  else t.ck[k] = { r: ret(t, px), px, src, lag: Math.round((at - due) / 1000) };
  const s = st.strategies.find(x => x.id === t.s);
  const r = t.ck[k].r;
  event(st, now, { k: "check", s: t.s, m: t.m, y: t.y, c: k, r, tx: r === null ? `${t.s} · $${t.y} +${k}m: no price, trade not counted` : `${t.s} · $${t.y} +${k}m ${r >= 0 ? "+" : ""}${r}%` });
  if (k === 60) closeTrade(st, t, s, now);
}

function checkTrades(st, T, now) {
  for (const t of st.open) {
    if (t.m !== T.m) continue;
    for (const k of RULE.checkpoints) {
      if (t.ck[k]) continue;
      const due = t.at + k * 60e3;
      if (now < due) continue;
      const lag = now - due;
      if (lag <= LIVE_TOL) fill(st, t, k, T.px, now, "live", now);
      else if (!st.gecko.some(g => g.id === t.id && g.k === k)) st.gecko.push({ id: t.id, m: t.m, k, due, tries: 0, late: { px: T.px, at: now } });
    }
  }
}

// candle history fallback results come back here
function geckoResult(st, g, px, now) {
  const t = st.open.find(x => x.id === g.id); if (!t) return;
  if (px !== null) fill(st, t, g.k, px, g.due, "candle", now);
  else if (g.late && g.late.at - g.due <= LATE_MAX) fill(st, t, g.k, g.late.px, g.late.at, "late", now);
  else fill(st, t, g.k, null, now, "miss", now);
}

// open trades whose coin we can't read live anymore (or that fell in a gap between runs) go to the candle queue
function queueOverdue(st, now) {
  for (const t of st.open) for (const k of RULE.checkpoints) {
    if (t.ck[k]) continue;
    const due = t.at + k * 60e3;
    if (now - due > LIVE_TOL && !st.gecko.some(g => g.id === t.id && g.k === k)) st.gecko.push({ id: t.id, m: t.m, k, due, tries: 0, late: null });
  }
}

// called at the end of a run: anything overdue with no way to fill becomes late or miss
function settleOverdue(st, now) {
  for (const t of st.open.slice()) for (const k of RULE.checkpoints) {
    if (t.ck[k]) continue;
    const due = t.at + k * 60e3; if (now - due < LATE_MAX) continue;
    const g = st.gecko.find(x => x.id === t.id && x.k === k);
    if (g && g.tries < 2) continue;
    if (g && g.late && g.late.at - due <= LATE_MAX) fill(st, t, k, g.late.px, g.late.at, "late", now); else fill(st, t, k, null, now, "miss", now);
  }
  st.gecko = st.gecko.filter(g => st.open.some(t => t.id === g.id && !t.ck[g.k]));
}

function closeTrade(st, t, s, now) {
  st.open = st.open.filter(x => x !== t);
  t.closed = now;
  const d = st.done[t.s] || (st.done[t.s] = []);
  d.push(t); if (d.length > 600) d.splice(0, d.length - 600);
  const R = st.rets[t.s] || (st.rets[t.s] = { r5: [], r15: [], r60: [] });
  if (t.ck[60] && t.ck[60].r !== null) {
    R.r60.push(t.ck[60].r);
    if (t.ck[5] && t.ck[5].r !== null) R.r5.push(t.ck[5].r);
    if (t.ck[15] && t.ck[15].r !== null) R.r15.push(t.ck[15].r);
    if (s) judge(st, s, now);
  }
}

// ---------- statistics + the verdict ----------
function median(a) { if (!a.length) return null; const b = a.slice().sort((x, y) => x - y), m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; }
function quant(a, q) { if (!a.length) return null; const b = a.slice().sort((x, y) => x - y), p = (b.length - 1) * q, lo = Math.floor(p), hi = Math.ceil(p); return b[lo] + (b[hi] - b[lo]) * (p - lo); }
function stats(st, s) {
  const R = st.rets[s.id] || { r5: [], r15: [], r60: [] }, a = R.r60;
  const wins = a.filter(x => x > 0).length;
  // 5 and 15 min also count trades that are still open (their early checkpoints are already in)
  const openCk = k => st.open.filter(t => t.s === s.id && t.ck[k] && t.ck[k].r !== null).map(t => t.ck[k].r);
  const e5 = R.r5.concat(openCk(5)), e15 = R.r15.concat(openCk(15));
  return {
    done: a.length, open: st.open.filter(t => t.s === s.id).length,
    hit: a.length ? r1(100 * wins / a.length) : null,
    med5: r1(median(e5)), med15: r1(median(e15)), n5: e5.length, n15: e15.length, med60: r1(median(a)), mean60: a.length ? r1(a.reduce((x, y) => x + y, 0) / a.length) : null,
    q1: r1(quant(a, 0.25)), q3: r1(quant(a, 0.75)), best: a.length ? r1(Math.max(...a)) : null, worst: a.length ? r1(Math.min(...a)) : null,
  };
}

function judge(st, s, now) {
  const x = stats(st, s);
  if (x.done < RULE.minTrades || s.status === "refuted") return;
  const bleeds = x.med60 < RULE.med, flips = x.hit < RULE.hit;
  if (bleeds || flips) {
    const was = s.status;
    s.status = "refuted"; s.diedAt = now; s.diedN = x.done; s.final = x;
    s.cause = bleeds && flips ? `Bled out and lost the coin flip: median ${x.med60}% at 60 min, ${x.hit}% winners.`
      : bleeds ? `Bled out: median ${x.med60}% at 60 min.` : `Lost the coin flip: only ${x.hit}% winners.`;
    s.causeShort = bleeds && flips ? "Bled out + coin flip" : bleeds ? "Bled out" : "Coin flip";
    event(st, now, { k: "death", s: s.id, a: "EXAMINER", r: x.med60, tx: `THE EXAMINER refuted ${s.id} ${s.name} after ${x.done} trades${was === "surviving" ? " (it had been surviving)" : ""}. ${s.cause}` });
  } else {
    if (s.status !== "surviving") {
      s.status = "surviving"; s.survivedAt = now;
      event(st, now, { k: "survive", s: s.id, a: "EXAMINER", r: x.med60, tx: `THE EXAMINER: ${s.id} ${s.name} survives its first verdict. Median ${x.med60 >= 0 ? "+" : ""}${x.med60}% at 60 min, ${x.hit}% winners. Testing continues.` });
    }
  }
}

// a strategy whose setup almost never happens is not an edge: after 24 h with under 5 finished trades it is retired
function starve(st, now) {
  for (const s of st.strategies) {
    if (s.status !== "testing" || now - s.born < 24 * 3600e3) continue;
    const x = stats(st, s);
    if (x.done >= 5 || x.open > 0) continue;
    s.status = "refuted"; s.diedAt = now; s.diedN = x.done; s.final = x;
    s.cause = `Starved: only ${s.n} ${s.n === 1 ? "match" : "matches"} in 24 hours. The setup barely exists on pump.fun.`; s.causeShort = "Starved";
    event(st, now, { k: "death", s: s.id, a: "EXAMINER", tx: `THE EXAMINER retired ${s.id} ${s.name}: starved. ${s.n} ${s.n === 1 ? "match" : "matches"} in 24 hours.` });
  }
}

// ---------- which coins to read this sweep ----------
function sweepList(st, now, sweepNo) {
  const openM = new Set(st.open.map(t => t.m)), out = [];
  for (const T of Object.values(st.tokens)) {
    const age = now - T.c;
    let every = 0; // 1 = every sweep, n = every nth sweep, 0 = skip
    if (openM.has(T.m)) every = 1;
    else if (age < 15 * 60e3) every = 1;
    else if (age < 75 * 60e3) every = (T.bc || 0) >= 8 ? 2 : 4;
    else if ((T.bc || 0) >= 35 || (T.grad && now - T.grad < 2 * 3600e3)) every = 4;
    if (every && (sweepNo % every === 0 || now - (T.up || 0) > every * 30e3)) out.push(T.m);
  }
  // open trades and young coins first
  out.sort((a, b) => (openM.has(b) - openM.has(a)) || (st.tokens[b].c - st.tokens[a].c));
  return out;
}

function prune(st, now) {
  const openM = new Set(st.open.map(t => t.m));
  for (const [m, T] of Object.entries(st.tokens)) {
    if (openM.has(m)) continue;
    const age = now - T.c;
    if ((age > 75 * 60e3 && (T.bc || 0) < 15 && !T.grad) || age > 10 * 3600e3 || (T.grad && now - T.grad > 3 * 3600e3)) delete st.tokens[m];
  }
  for (const k of Object.keys(st.hourly)) if (+k < hourKey(now) - 48) delete st.hourly[k];
}

// ---------- what the site reads ----------
function publicStrategy(st, s) {
  const x = s.status === "refuted" && s.final ? Object.assign({}, stats(st, s), s.final, { open: stats(st, s).open }) : stats(st, s);
  const last = (st.rets[s.id] ? st.rets[s.id].r60.slice(-30) : []);
  // the evidence wall: the latest 30 trades, finished or open, as [result %, checkpoint it comes from (60/15/5, 0 = none yet)]
  const latest = t => t.ck[60] ? [t.ck[60].r, 60] : t.ck[15] && t.ck[15].r !== null ? [t.ck[15].r, 15] : t.ck[5] && t.ck[5].r !== null ? [t.ck[5].r, 5] : [null, 0];
  const pool = (st.done[s.id] || []).concat(st.open.filter(t => t.s === s.id)).sort((a, b) => a.at - b.at).slice(-30);
  const wall = pool.map(t => { const [r, k] = latest(t); return [r === null ? null : Math.round(r), k, t.y]; });
  return { id: s.id, name: s.name, agent: s.agent, myth: s.myth, rule: s.rule, born: s.born, status: s.status, diedAt: s.diedAt || 0, survivedAt: s.survivedAt || 0,
    cause: s.cause || "", causeShort: s.causeShort || "", matched: s.n, lastMatch: s.lastMatch || 0, ...x, last, wall };
}

function buildLab(st, now, meta) {
  const strategies = st.strategies.map(s => publicStrategy(st, s));
  const h24 = Object.entries(st.hourly).filter(([k]) => +k > hourKey(now) - 24).reduce((a, [, v]) => a + v, 0);
  const allDone = Object.values(st.done).reduce((a, d) => a + d.length, 0);
  const agents = AGENTS.map(a => ({ ...a, proposed: st.strategies.filter(s => s.agent === a.id).length, alive: st.strategies.filter(s => s.agent === a.id && s.status !== "refuted").length, dead: st.strategies.filter(s => s.agent === a.id && s.status === "refuted").length }));
  const recent = [].concat(...Object.values(st.done)).sort((a, b) => b.closed - a.closed).slice(0, 40).map(slimTrade);
  const intake = Object.values(st.tokens).sort((a, b) => b.c - a.c).slice(0, 14).map(T => ({ m: T.m, y: T.s, n: T.n, c: T.c, bc: r1(T.bc), h: T.h || 0 }));
  // the lab's pulse: every checkpoint reading across all strategies
  const all = { 5: [], 15: [], 60: [] };
  for (const t of st.open.concat(...Object.values(st.done))) for (const k of RULE.checkpoints) if (t.ck[k] && t.ck[k].r !== null) all[k].push(t.ck[k].r);
  const pulse = {};
  for (const k of RULE.checkpoints) pulse["m" + k] = { med: r1(median(all[k])), n: all[k].length, down: all[k].length ? r1(100 * all[k].filter(x => x <= 0).length / all[k].length) : null };
  // trade paths for the hero chart: [strategy index, +5m, +15m, +60m] for the most recent 600 trades
  const sIdx = Object.fromEntries(st.strategies.map((x, i) => [x.id, i]));
  const rr = (t, k) => t.ck[k] && t.ck[k].r !== null ? Math.round(t.ck[k].r * 10) / 10 : null;
  const paths = st.open.concat(...Object.values(st.done)).sort((a, b) => b.at - a.at).slice(0, 600)
    .map(t => [sIdx[t.s] ?? -1, rr(t, 5), rr(t, 15), rr(t, 60), Math.round((now - t.at) / 1000)]);
  return {
    v: 1, updatedAt: now, startedAt: st.started, pulse, paths,
    sync: { every: meta.every || 300, runs: st.runs.n, lastRunMs: meta.runMs || 0, reads: meta.reads || 0, source: "jupiter" },
    rule: RULE,
    totals: { launches: st.launches, launches24h: h24, watching: Object.keys(st.tokens).length, trades: strategies.reduce((a, s) => a + s.matched, 0), open: st.open.length, done: allDone,
      testing: strategies.filter(s => s.status === "testing").length, surviving: strategies.filter(s => s.status === "surviving").length, refuted: strategies.filter(s => s.status === "refuted").length },
    agents, strategies,
    bench: st.open.slice().sort((a, b) => b.at - a.at).slice(0, 60).map(slimTrade),
    recent, intake,
    feed: st.feed.slice(-260),
    log: (st.log || []).slice(-150),
  };
}
function slimTrade(t) {
  const ck = {}; for (const k of RULE.checkpoints) if (t.ck[k]) ck[k] = { r: t.ck[k].r, src: t.ck[k].src };
  return { id: t.id, s: t.s, m: t.m, y: t.y, n: t.n, at: t.at, px: t.px, mc: t.mc ? Math.round(t.mc) : null, bc: t.bc, age: t.age, h: t.h, note: t.note, ck, closed: t.closed || 0 };
}
function buildStrategyFile(st, s, now) {
  const trades = st.open.filter(t => t.s === s.id).sort((a, b) => b.at - a.at).concat((st.done[s.id] || []).slice().reverse()).map(slimTrade);
  return { v: 1, updatedAt: now, strategy: publicStrategy(st, s), rets: st.rets[s.id] || { r5: [], r15: [], r60: [] }, trades };
}

function hydrate(st) { for (const s of st.strategies) if (!s.key) s.key = s.id; return st; }

module.exports = { RULE, newState, hydrate, proposeIfNeeded, upsert, observe, features, sweepList, geckoResult, queueOverdue, settleOverdue, starve, prune, buildLab, buildStrategyFile, stats, judge, event, median, fmtAge };
