// GET /api/lab?f=lab.json | s/S-01.json  ->  the lab record from the `lab-data` branch.
// Cached at Vercel's edge for 30 s so visitors never hit GitHub directly.
const REPO = process.env.LAB_REPO || "buzzlightyear163/refuted";
const BRANCH = process.env.LAB_BRANCH || "lab-data";
const OK = /^(lab\.json|s\/S-\d{2,4}\.json)$/;
const mem = {};

module.exports = async (req, res) => {
  const f = String((req.query && req.query.f) || "lab.json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (!OK.test(f)) { res.status(400).json({ error: "unknown file" }); return; }
  const now = Date.now(), c = mem[f];
  try {
    if (!c || now - c.t > 20000) {
      const r = await fetch(`https://raw.githubusercontent.com/${REPO}/${BRANCH}/${f}?t=${Math.floor(now / 20000)}`, { cache: "no-store" });
      if (!r.ok) throw new Error("github " + r.status);
      mem[f] = { t: now, body: await r.text() };
    }
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "public, s-maxage=30, stale-while-revalidate=300");
    res.status(200).send(mem[f].body);
  } catch (e) {
    if (c) { res.setHeader("Content-Type", "application/json; charset=utf-8"); res.setHeader("Cache-Control", "public, s-maxage=10"); res.status(200).send(c.body); return; }
    res.setHeader("Cache-Control", "no-store");
    res.status(502).json({ error: String((e && e.message) || e) });
  }
};
