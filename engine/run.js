/* REFUTED lab runner. One run = a few minutes of watching pump.fun live, then the state is saved.
   GitHub Actions starts a run every 5 minutes (.github/workflows/lab.yml), so the lab runs around the clock.
   Data (free, no keys): Jupiter datapi (new launches, bonding curve, price, holders, audit, 5-min flow)
   and GeckoTerminal minute candles (only to fill a checkpoint that fell between two runs).
   Usage: node engine/run.js            (env: DATA_DIR=./data RUN_MS=270000) */
const fs = require("fs"), path = require("path");
const CORE = require("./core.js");

const DATA = process.env.DATA_DIR || path.join(__dirname, "..", "data");
const RUN_MS = +(process.env.RUN_MS || 270e3);
const EVERY = +(process.env.EVERY_S || 300);
const LP = ["pump.fun"];
const GEMS = "https://datapi.jup.ag/v1/pools/gems";
const SEARCH = "https://datapi.jup.ag/v1/assets/search?query=";
const GT = "https://api.geckoterminal.com/api/v2/networks/solana";
const sleep = ms => new Promise(r => setTimeout(r, ms));
const HDR = { accept: "application/json", "user-agent": "refuted-lab/1 (+https://refuted.fun)" };
let reads = 0, errors = 0;

async function getJSON(url, opt = {}, ms = 12000) {
  reads++;
  const r = await fetch(url, Object.assign({}, opt, { signal: AbortSignal.timeout(ms), headers: Object.assign({}, HDR, opt.headers || {}) }));
  if (!r.ok) { const e = new Error(r.status + " " + url.slice(0, 70)); e.status = r.status; throw e; }
  return r.json();
}
const gems = body => getJSON(GEMS, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const asAsset = p => Object.assign({}, p.baseAsset, { bondingCurve: p.bondingCurve !== undefined ? p.bondingCurve : p.baseAsset && p.baseAsset.bondingCurve });

function load() {
  try { return CORE.hydrate(JSON.parse(fs.readFileSync(path.join(DATA, "engine.json"), "utf8"))); }
  catch (e) { console.log("no saved state, opening a new lab"); return CORE.newState(Date.now()); }
}

function save(st, now, runMs) {
  fs.mkdirSync(path.join(DATA, "s"), { recursive: true });
  fs.writeFileSync(path.join(DATA, "engine.json"), JSON.stringify(st));
  const lab = CORE.buildLab(st, now, { every: EVERY, runMs, reads });
  fs.writeFileSync(path.join(DATA, "lab.json"), JSON.stringify(lab));
  for (const s of st.strategies) fs.writeFileSync(path.join(DATA, "s", s.id + ".json"), JSON.stringify(CORE.buildStrategyFile(st, s, now)));
  // this branch only holds data: tell Vercel not to deploy it
  fs.writeFileSync(path.join(DATA, "vercel.json"), JSON.stringify({ git: { deploymentEnabled: false } }));
  fs.writeFileSync(path.join(DATA, "README.md"), "# REFUTED lab data\n\nWritten by the lab every few minutes (GitHub Actions). Do not edit by hand.\n\n- `lab.json`: what the site shows\n- `s/<id>.json`: every paper trade of one strategy\n- `engine.json`: the lab's working state\n");
  return lab;
}

async function discover(st, body, now) {
  const j = await gems(body);
  let n = 0;
  for (const key of Object.keys(j)) for (const p of (j[key] && j[key].pools) || []) { if (!p.baseAsset) continue; CORE.observe(st, asAsset(p), now); n++; }
  return n;
}

async function sweep(st, sweepNo, now) {
  const list = CORE.sweepList(st, now, sweepNo).slice(0, 1400);
  let n = 0;
  for (let i = 0; i < list.length; i += 90) {
    const batch = list.slice(i, i + 90);
    try { const arr = await getJSON(SEARCH + batch.join(",")); for (const a of arr || []) { CORE.observe(st, a, Date.now()); n++; } }
    catch (e) { errors++; if (e.status === 429) await sleep(3000); }
  }
  return n;
}

// GeckoTerminal: price at an exact past minute (fills checkpoints that landed between runs)
async function geckoOne(st, now) {
  const g = st.gecko.find(x => x.tries < 3 && now - x.due > 60e3 && (!x.next || x.next <= now)); if (!g) return;
  g.tries++; g.next = now + 20e3;
  try {
    st.gtPools = st.gtPools || {};
    let pools = st.gtPools[g.m];
    if (!pools) {
      const j = await getJSON(`${GT}/tokens/${g.m}/pools?page=1`);
      pools = (j.data || []).map(p => ({ a: p.attributes.address, d: p.relationships && p.relationships.dex && p.relationships.dex.data && p.relationships.dex.data.id }));
      st.gtPools[g.m] = pools; return; // spend the next slot on the candle
    }
    const T = st.tokens[g.m];
    const after = T && T.grad && g.due >= T.grad;
    const pool = pools.find(p => after ? p.d !== "pump-fun" : p.d === "pump-fun") || pools[0];
    if (!pool) { CORE.geckoResult(st, g, null, now); st.gecko = st.gecko.filter(x => x !== g); return; }
    const sec = Math.floor(g.due / 1000);
    const j = await getJSON(`${GT}/pools/${pool.a}/ohlcv/minute?aggregate=1&before_timestamp=${sec + 60}&limit=5&currency=usd&token=base`);
    const list = (j.data && j.data.attributes && j.data.attributes.ohlcv_list) || [];
    const c = list.find(x => x[0] <= sec);
    CORE.geckoResult(st, g, c ? +c[4] : null, now);
    st.gecko = st.gecko.filter(x => x !== g);
  } catch (e) {
    errors++;
    if (g.tries >= 3) { CORE.geckoResult(st, g, null, now); st.gecko = st.gecko.filter(x => x !== g); }
  }
}

(async () => {
  const t0 = Date.now(), end = t0 + RUN_MS;
  const st = load();
  const gap = st.runs.lastEnd ? Math.round((t0 - st.runs.lastEnd) / 1000) : 0;
  st.runs.n++; st.runs.lastStart = t0;
  CORE.proposeIfNeeded(st, t0);
  let sweepNo = 0, nextRecent = 0, nextGrad = 0, nextSweep = 0, nextGecko = 0, seen = 0, read = 0;
  const before = { launches: st.launches, feed: st.feed.length };
  while (Date.now() < end) {
    const now = Date.now();
    try {
      if (now >= nextRecent) { nextRecent = now + 8000; seen += await discover(st, { recent: { timeframe: "24h", launchpads: LP } }, now); }
      if (now >= nextGrad) { nextGrad = now + 30000; seen += await discover(st, { aboutToGraduate: { timeframe: "24h", launchpads: LP }, graduated: { timeframe: "24h", launchpads: LP } }, now); }
      if (now >= nextSweep) { nextSweep = now + 15000; read += await sweep(st, sweepNo++, now); CORE.queueOverdue(st, Date.now()); }
      if (now >= nextGecko && st.gecko.length) { nextGecko = now + 3500; await geckoOne(st, now); }
    } catch (e) { errors++; console.log("tick error:", e.message); await sleep(2000); }
    await sleep(700);
  }
  const now = Date.now();
  CORE.settleOverdue(st, now);
  CORE.starve(st, now);
  CORE.prune(st, now);
  CORE.proposeIfNeeded(st, now);
  st.runs.lastEnd = now; st.runs.ms += now - t0;
  const lab = save(st, now, now - t0);
  console.log(JSON.stringify({ run: st.runs.n, gapBefore_s: gap, ms: now - t0, reads, errors, sweeps: sweepNo, observed: read + seen,
    newLaunches: st.launches - before.launches, watching: lab.totals.watching, open: lab.totals.open, done: lab.totals.done, trades: lab.totals.trades,
    testing: lab.totals.testing, surviving: lab.totals.surviving, refuted: lab.totals.refuted, gecko: st.gecko.length,
    top: lab.strategies.map(s => `${s.id}:${s.matched}/${s.done}${s.med60 === null ? "" : "@" + s.med60}`).join(" ") }));
})().catch(e => { console.error("run failed:", e); process.exit(1); });
