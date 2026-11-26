// node gfx.js outdir -> renders pfp, banner, launch (2x) and og, fav (1x) from grafik/src/gfx.html with real lab trades in the banner
const http = require("http"), fs = require("fs"), path = require("path"), puppeteer = require("puppeteer-core");
const ROOT = "/home/claude/refuted", out = process.argv[2] || "/home/claude/refuted/grafik";
const lab = JSON.parse(fs.readFileSync("/home/claude/labdata/lab.json"));
const wall = (lab.paths || []).filter(p => p[3] !== null && p[3] !== undefined).map(p => p[3]);
const srv = http.createServer((req, res) => { const u = new URL(req.url, "http://x");
  let p = u.pathname.startsWith("/fonts/") ? path.join(ROOT, u.pathname) : path.join(ROOT, "grafik/src", u.pathname);
  if (!fs.existsSync(p)) { res.writeHead(404); return res.end(); } res.writeHead(200); res.end(fs.readFileSync(p)); });
(async () => { await new Promise(r => srv.listen(0, r)); const b = await puppeteer.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox"] });
  try { for (const [s, ids] of [[2, ["pfp", "banner", "launch"]], [1, ["og", "fav"]]]) {
      const pg = await b.newPage(); await pg.setViewport({ width: 1800, height: 1200, deviceScaleFactor: s }); const errs = []; pg.on("pageerror", e => errs.push(String(e)));
      await pg.evaluateOnNewDocument(c => { window.CFG = c; }, { wall });
      await pg.goto(`http://localhost:${srv.address().port}/gfx.html`); await pg.waitForSelector("body[data-ready]"); await new Promise(r => setTimeout(r, 300));
      for (const id of ids) { const el = await pg.$("#" + id); await el.screenshot({ path: path.join(out, id + ".png") }); }
      if (errs.length) console.log("errors", errs); await pg.close(); }
  } finally { await b.close(); srv.close(); } console.log("ok", wall.length, "trades in the wall"); })();
