// node render.js [stills t1,t2,...]  -> renders grafik/launch.mp4 (17 s, 1920x1080, 30 fps) from video.html with real lab data
const http = require("http"), fs = require("fs"), path = require("path"), { spawn } = require("child_process");
const puppeteer = require("/home/claude/tools/node_modules/puppeteer-core");
const ROOT = "/home/claude/refuted", HERE = __dirname, OUT = path.join(ROOT, "grafik");
const lab = JSON.parse(fs.readFileSync("/home/claude/labdata/lab.json"));
const pick = ["S-01", "S-04", "S-02", "S-05", "S-03"];
const rows = pick.map(id => lab.strategies.find(s => s.id === id)).map(s => ({ id: s.id, name: s.name, rule: s.rule, wall: (s.wall || []).map(w => w[0]).slice(-30) }));
const wall = (lab.paths || []).filter(p => p[3] !== null && p[3] !== undefined).map(p => p[3]);
const CFG = { rows, wall, totals: lab.totals, pulse: lab.pulse };
const SCENES = [[0, 2.8], [2.8, 7.0], [7.0, 10.45], [10.45, 13.6], [13.6, 17.0]], FPS = 30;
const srv = http.createServer((req, res) => { const u = new URL(req.url, "http://x");
  const p = u.pathname.startsWith("/fonts/") ? path.join(ROOT, u.pathname) : path.join(HERE, u.pathname);
  if (!fs.existsSync(p)) { res.writeHead(404); return res.end(); } res.writeHead(200); res.end(fs.readFileSync(p)); });
const ff = (args, input) => new Promise((ok, no) => { const pr = spawn("ffmpeg", args, { stdio: [input ? "pipe" : "ignore", "ignore", "pipe"] }); let err = ""; pr.stderr.on("data", d => err += d);
  pr.on("close", c => c === 0 ? ok() : no(new Error(err.slice(-800)))); if (input) input(pr.stdin); });
(async () => {
  await new Promise(r => srv.listen(0, r)); const b = await puppeteer.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox"] });
  try {
    const pg = await b.newPage(); await pg.setViewport({ width: 1920, height: 1080 }); const errs = []; pg.on("pageerror", e => errs.push(String(e)));
    await pg.evaluateOnNewDocument(c => { window.CFG = c; }, CFG);
    await pg.goto(`http://localhost:${srv.address().port}/video.html`); await pg.waitForSelector("body[data-ready]");
    const grab = t => pg.evaluate(t => { frame(t); return document.getElementById("c").toDataURL("image/jpeg", .92).split(",")[1]; }, t);
    if (process.argv[2] === "stills") { for (const t of process.argv[3].split(",").map(Number)) fs.writeFileSync(`/home/claude/shots/v_${t}.jpg`, Buffer.from(await grab(t), "base64")); console.log("stills", errs); return; }
    const parts = [];
    for (const [i, [a, z]] of SCENES.entries()) {
      const tmp = path.join(HERE, `scene${i}.tmp.mp4`), fin = path.join(HERE, `scene${i}.mp4`), n = Math.round((z - a) * FPS), f0 = Math.round(a * FPS);
      await ff(["-y", "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "mjpeg", "-i", "-", "-c:v", "libx264", "-crf", "18", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-r", String(FPS), tmp],
        async stdin => { for (let k = 0; k < n; k++) { const buf = Buffer.from(await grab((f0 + k) / FPS), "base64"); if (!stdin.write(buf)) await new Promise(r => stdin.once("drain", r)); } stdin.end(); });
      fs.renameSync(tmp, fin); parts.push(fin); console.log("scene", i, n, "frames");
    }
    const list = path.join(HERE, "list.txt"); fs.writeFileSync(list, parts.map(p => `file '${p}'`).join("\n"));
    const tmp = path.join(OUT, "launch.tmp.mp4"); await ff(["-y", "-f", "concat", "-safe", "0", "-i", list, "-c", "copy", "-movflags", "+faststart", tmp]);
    fs.renameSync(tmp, path.join(OUT, "launch.mp4")); parts.forEach(p => fs.unlinkSync(p)); fs.unlinkSync(list); console.log("done", errs);
  } finally { await b.close(); srv.close(); }
})();
