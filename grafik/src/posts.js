// node posts.js -> renders grafik/post1.png, post2.png, post3.png (3200x1800) from posts.html with the latest lab data
const http = require("http"), fs = require("fs"), path = require("path"), puppeteer = require("/home/claude/tools/node_modules/puppeteer-core");
const ROOT = "/home/claude/refuted", out = path.join(ROOT, "grafik");
const lab = JSON.parse(fs.readFileSync("/home/claude/labdata/lab.json"));
const s03 = JSON.parse(fs.readFileSync("/home/claude/labdata/s/S-03.json"));
const v30 = s03.trades.filter(t => t.closed && t.ck[60] && t.ck[60].src !== "miss" && t.ck[60].r !== undefined && t.ck[60].r !== null).sort((a, b) => a.at - b.at).slice(0, 30).map(t => t.ck[60].r);
const CFG = { v30, totals: lab.totals, pulse: lab.pulse, strategies: lab.strategies.map(s => ({ id: s.id, name: s.name, status: s.status, done: s.done, open: s.open, med60: s.med60, hit: s.hit, myth: s.myth, rule: s.rule, wall: s.wall, causeShort: s.causeShort, best: s.best, worst: s.worst })) };
const srv = http.createServer((req, res) => { const u = new URL(req.url, "http://x");
  const p = u.pathname.startsWith("/fonts/") ? path.join(ROOT, u.pathname) : path.join(__dirname, u.pathname);
  if (!fs.existsSync(p)) { res.writeHead(404); return res.end(); } res.writeHead(200); res.end(fs.readFileSync(p)); });
(async () => { await new Promise(r => srv.listen(0, r)); const b = await puppeteer.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox"] });
  try { const pg = await b.newPage(); await pg.setViewport({ width: 1700, height: 1000, deviceScaleFactor: 2 }); const errs = []; pg.on("pageerror", e => errs.push(String(e)));
    await pg.evaluateOnNewDocument(c => { window.CFG = c; }, CFG);
    await pg.goto(`http://localhost:${srv.address().port}/posts.html`); await pg.waitForSelector("body[data-ready]"); await new Promise(r => setTimeout(r, 300));
    for (const id of ["p1", "p2", "p3"]) await (await pg.$("#" + id)).screenshot({ path: path.join(out, id.replace("p", "post") + ".png") });
    console.log("ok", errs);
  } finally { await b.close(); srv.close(); } })();
