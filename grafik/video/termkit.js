/* termkit.js: pixel objects, long shadow, LED text. Shared by graphics.html and the site. */
const TK = (() => {
  const THEMES = {
    paper: { bg:"#f0e7d8", shadow:"#dcd2bf", ink:"#2b2a26", muted:"#8b8474", accent:"#2f9e4f", red:"#c9452e", card:"#f8f3ea", line:"#3a372f",
      outline:"#2e2a23", body:"#ece2c9", hi:"#faf5e8", shade:"#cdbf9f", dark:"#a39372", screen:"#16211a", glare:"#24372b", glow:"#45e07f", led:"#45e07f", slot:"#4a4337", engr:"#4a4337", glowBlur:0 },
    phosphor: { bg:"#050806", shadow:"#020302", ink:"#d6ffe2", muted:"#5d8a6b", accent:"#4cf28d", red:"#ff3b30", card:"#0b120d", line:"#1f3b29",
      outline:"#0d0f0c", body:"#e6dcc0", hi:"#f6f0de", shade:"#c4b693", dark:"#9a8a68", screen:"#0b1a10", glare:"#173323", glow:"#5cff9a", led:"#5cff9a", slot:"#3b352a", engr:"#3b352a", glowBlur:.9 },
    graphite: { bg:"#131210", shadow:"#0a0908", ink:"#efe7d8", muted:"#6f6a60", accent:"#efe7d8", red:"#e0533d", card:"#1a1916", line:"#33302a",
      outline:"#0a0908", body:"#ece4d3", hi:"#faf6ec", shade:"#c9bfa9", dark:"#9d927b", screen:"#1b1a17", glare:"#2b2925", glow:"#efe7d8", led:"#7fe0a0", slot:"#3d3a33", engr:"#3d3a33", glowBlur:.5 },
    // REFUTED: ash stone, marble object, stamp red. Green only means "surviving".
    stone: { bg:"#e1dfd9", shadow:"#cfccc4", ink:"#171614", muted:"#75716a", accent:"#d63a26", red:"#d63a26", up:"#23854c", card:"#ebe9e3", line:"#2b2926",
      outline:"#24221f", body:"#f1efe9", hi:"#fdfcf8", shade:"#cfcbc2", dark:"#a6a298", screen:"#2a2825", glare:"#3a3834", glow:"#d63a26", led:"#23854c", slot:"#4a4741", engr:"#4b4842", glowBlur:0 },
  };

  // 3x5 pixel font (M, N, W wider). Rows top to bottom.
  const FONT = {
    A:["010","101","111","101","101"],B:["110","101","110","101","110"],C:["011","100","100","100","011"],D:["110","101","101","101","110"],
    E:["111","100","110","100","111"],F:["111","100","110","100","100"],G:["011","100","101","101","011"],H:["101","101","111","101","101"],
    I:["111","010","010","010","111"],J:["001","001","001","101","010"],K:["101","101","110","101","101"],L:["100","100","100","100","111"],
    M:["10001","11011","10101","10001","10001"],N:["1001","1101","1011","1001","1001"],O:["010","101","101","101","010"],P:["110","101","110","100","100"],
    Q:["010","101","101","110","011"],R:["110","101","110","101","101"],S:["011","100","010","001","110"],T:["111","010","010","010","010"],
    U:["101","101","101","101","111"],V:["101","101","101","101","010"],W:["10001","10001","10101","11011","10001"],X:["101","101","010","101","101"],
    Y:["101","101","010","010","010"],Z:["111","001","010","100","111"],
    0:["111","101","101","101","111"],1:["010","110","010","010","111"],2:["110","001","010","100","111"],3:["110","001","010","001","110"],
    4:["101","101","111","001","001"],5:["111","100","110","001","110"],6:["011","100","111","101","111"],7:["111","001","010","010","010"],
    8:["111","101","111","101","111"],9:["111","101","111","001","110"]," ":["0","0","0","0","0"],"-":["000","000","111","000","000"],
    ".":["0","0","0","0","1"],"+":["000","010","111","010","000"],"%":["101","001","010","100","101"],">":["100","010","001","010","100"],"_":["000","000","000","000","111"],
  };
  const glyph = ch => FONT[ch.toUpperCase()] || FONT[" "];
  const textWidth = (s, k = 1) => [...s].reduce((w, ch, i) => w + glyph(ch)[0].length * k + (i ? k : 0), 0);

  function Grid(w, h) {
    const c = new Array(w * h).fill(null);
    return {
      w, h, c,
      get(x, y) { return x < 0 || y < 0 || x >= w || y >= h ? null : c[y * w + x]; },
      set(x, y, v) { if (x >= 0 && y >= 0 && x < w && y < h) c[y * w + x] = v; },
      rect(x, y, rw, rh, v) { for (let j = 0; j < rh; j++) for (let i = 0; i < rw; i++) this.set(x + i, y + j, v); },
      text(s, x, y, v, k = 1) {
        let cx = x;
        for (const ch of s) { const g = glyph(ch);
          g.forEach((row, j) => [...row].forEach((b, i) => { if (b === "1") this.rect(cx + i * k, y + j * k, k, k, v); }));
          cx += g[0].length * k + k; }
      },
      outline(v = "outline") { // 1-cell outline around everything that is filled
        const add = [];
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++)
          if (!this.get(x, y) && (this.get(x - 1, y) || this.get(x + 1, y) || this.get(x, y - 1) || this.get(x, y + 1))) add.push([x, y]);
        add.forEach(([x, y]) => this.set(x, y, v));
      },
    };
  }

  // ---------- Objects. Each returns a Grid of palette keys. Build inside a 1-cell margin, then outline. ----------
  const OBJECTS = {
    // REFUTED: a headstone. The face carries the latest death: "RIP", the strategy id and its median 60m return.
    tomb({ top = "RIP", id = "EDGE", pct = "-60%" } = {}) {
      const W = 48, H = 51, g = Grid(W, H);
      const x0 = 5, w = 38, y0 = 2, h = 42, ry = 10, cx = x0 + w / 2 - .5, cy = y0 + ry;
      for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
        if (y < cy) { const dx = (x - cx) / (w / 2), dy = (y - cy) / ry; if (dx * dx + dy * dy > 1.02) continue; }
        g.set(x, y, "body");
      }
      // light from top-left: hi on the upper/left rim, shade on the right/lower rim (two cells deep on the right)
      const isB = (x, y) => g.get(x, y) === "body";
      const rim = [];
      for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (g.get(x, y)) {
        const L = !g.get(x - 1, y), T = !g.get(x, y - 1), R = !g.get(x + 1, y), R2 = !g.get(x + 2, y);
        if (R) rim.push([x, y, "shade"]); else if (R2) rim.push([x, y, "shade"]); else if (L || T) rim.push([x, y, "hi"]);
      }
      rim.forEach(([x, y, v]) => g.set(x, y, v));
      g.rect(x0 + 1, y0 + h - 1, w - 2, 1, "shade");
      // engraving
      const mid = s => Math.round(cx + .5 - textWidth(s) / 2);
      const T1 = String(top).toUpperCase(), I1 = String(id).toUpperCase(), P = String(pct).toUpperCase();
      g.text(T1, mid(T1), y0 + 4, "engr");
      g.rect(x0 + 7, y0 + 12, w - 14, 1, "dark");
      g.text(I1, mid(I1), y0 + 15, "engr");
      const k = textWidth(P, 2) <= w - 8 ? 2 : 1;
      g.text(P, Math.round(cx + .5 - textWidth(P, k) / 2), y0 + 23 + (k === 1 ? 2 : 0), "red", k);
      // a small chart, bleeding out
      const cy0 = y0 + 35, pts = [0, 0, 1, 0, 1, 2, 1, 3, 4, 3, 5, 6, 6, 7];
      pts.forEach((d, i) => g.set(Math.round(cx) - 7 + i, cy0 + Math.min(4, Math.round(d * .6)), "engr"));
      // plinth
      const px = 2, pw = W - 4, py = y0 + h, ph = 5;
      g.rect(px, py, pw, ph, "body"); g.rect(px + 1, py, pw - 2, 1, "hi"); g.rect(px, py, 1, ph, "hi");
      g.rect(px + pw - 2, py, 2, ph, "shade"); g.rect(px, py + ph - 1, pw, 1, "shade");
      g.rect(px + 2, py + 2, pw - 6, 1, "dark");
      g.outline();
      return g;
    },

    // ---- REFUTED logo candidates ----
    // A: the Examiner's loupe. Dark lens, red cross.
    loupe() {
      const W = 46, H = 46, g = Grid(W, H), cx = 17.5, cy = 17.5;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const d = Math.hypot(x - cx, y - cy);
        if (d <= 10.2) g.set(x, y, "screen");
        else if (d <= 14.6) g.set(x, y, (x - cx) + (y - cy) < -4 ? "hi" : (x - cx) + (y - cy) > 6 ? "shade" : "body"); }
      for (let t = 0; t <= 9; t++) { g.rect(13 + t, 13 + t, 2, 2, "red"); g.rect(22 - t, 13 + t, 2, 2, "red"); }
      g.set(11, 11, "glare"); g.set(12, 10, "glare"); g.set(10, 12, "glare"); g.set(13, 9, "glare"); g.set(9, 13, "glare");
      for (let t = 0; t < 4; t++) g.rect(27 + t, 27 + t, 5, 5, "dark");
      for (let t = 4; t < 15; t++) { g.rect(28 + t, 28 + t, 5, 5, "screen"); g.set(28 + t, 28 + t + 1, "glare"); }
      g.outline(); return g;
    },
    // B: falsum seal. The logic symbol for "false" on a medallion with a red stamp ring.
    seal() {
      const W = 46, H = 46, g = Grid(W, H), c = 22.5;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const d = Math.hypot(x - c, y - c);
        if (d <= 20.6) g.set(x, y, d > 18.8 ? ((x - c) + (y - c) < 0 ? "hi" : "shade") : "body");
        if (d >= 14.6 && d <= 16.8) g.set(x, y, "red"); }
      g.rect(21, 12, 4, 17, "screen"); g.rect(14, 28, 18, 4, "screen");
      g.outline(); return g;
    },
    // C: the lab flask (REFUTED's mark). fill = share of the body that is red. bubbles=false leaves them to an animation.
    flask({ fill = .55, bubbles = true } = {}) {
      const W = 40, H = 48, g = Grid(W, H), top = 43 - Math.max(2, Math.min(25, Math.round(27 * fill)));
      g.rect(13, 2, 14, 3, "body"); g.rect(13, 2, 14, 1, "hi");
      g.rect(15, 5, 10, 11, "body"); g.rect(15, 5, 2, 11, "hi"); g.rect(23, 5, 2, 11, "shade");
      for (let y = 16; y < 44; y++) { const hw = Math.min(17, 5 + Math.round((y - 16) * .62)), x0 = 20 - hw, x1 = 20 + hw;
        g.rect(x0, y, x1 - x0, 1, "body"); g.rect(x0, y, 2, 1, "hi"); g.rect(x1 - 2, y, 2, 1, "shade");
        if (y >= top && y < 43) g.rect(x0 + 2, y, x1 - x0 - 4, 1, y === top ? "hi" : "red"); }
      g.rect(3, 43, 34, 2, "shade");
      if (bubbles) [[11, 33], [14, 37], [26, 31], [24, 36], [29, 39]].forEach(([x, y]) => { if (g.get(x, y) === "red") g.set(x, y, "hi"); });
      [[18, 22], [21, 20], [19, 12], [21, 9]].forEach(([x, y]) => { if (g.get(x, y) === "body") g.set(x, y, "shade"); });
      g.outline(); return g;
    },
    // D: the verdict stamp, inked.
    stampmark() {
      const t = "REFUTED", k = 2, tw = textWidth(t, k), W = tw + 16, H = 5 * k + 16, g = Grid(W, H);
      g.rect(1, 1, W - 2, H - 2, "red"); g.rect(3, 3, W - 6, H - 6, null);
      g.rect(5, 5, W - 10, H - 10, "red"); g.rect(6, 6, W - 12, H - 12, null);
      g.text(t, 8, 8, "red", k);
      const holes = [[4, 1], [11, 1], [30, H - 2], [W - 2, 6], [1, 9], [44, 1], [52, H - 2], [9, 10], [24, 12], [40, 9], [47, 13]];
      holes.forEach(([x, y]) => g.set(x, y, null));
      return g;
    },
    computer({ ticker = "" } = {}) {
      const t = ticker.replace(/^\$/, "").toUpperCase();
      const k = t.length <= 4 ? 2 : 1;
      const tw = textWidth(t, k);
      const sw = Math.max(24, tw + 8), sh = Math.max(16, Math.round(sw * .52));
      const mw = sw + 10, mh = sh + 13;
      const W = mw + 6, H = mh + 18, g = Grid(W, H);
      const mx = 3, my = 1, sx = mx + 4, sy = my + 3;
      g.rect(mx, my, mw, mh, "body"); g.set(mx, my, null); g.set(mx + mw - 1, my, null);
      g.rect(mx + 1, my + 1, mw - 2, 1, "hi"); g.rect(mx + 1, my + 1, 1, mh - 3, "hi");
      g.rect(mx + mw - 2, my + 1, 1, mh - 2, "shade"); g.rect(mx + 1, my + mh - 2, mw - 2, 1, "shade");
      g.rect(sx - 1, sy - 1, sw + 2, sh + 2, "shade"); g.rect(sx - 1, sy - 1, sw + 2, 1, "dark"); g.rect(sx - 1, sy - 1, 1, sh + 2, "dark");
      g.rect(sx, sy, sw, sh, "screen");
      [[sx, sy], [sx + sw - 1, sy], [sx, sy + sh - 1], [sx + sw - 1, sy + sh - 1]].forEach(([x, y]) => g.set(x, y, "shade"));
      const th = 5 * k, ty = sy + Math.max(2, Math.floor((sh - th - 5) / 2));
      g.text(t, sx + Math.floor((sw - tw) / 2), ty, "glow", k);
      g.outline();
      return g;
    },
  };

  // ---------- Rendering ----------
  function draw(ctx, grid, o) {
    const th = typeof o.theme === "string" ? THEMES[o.theme] : o.theme;
    const cell = o.cell, ox = Math.round(o.x), oy = Math.round(o.y);
    if (o.shadow !== false) {
      const len = o.shadowLen ?? 2000, dir = o.shadowDir ?? [1, 1];
      const sil = document.createElement("canvas"); sil.width = grid.w * cell; sil.height = grid.h * cell;
      const s = sil.getContext("2d"); s.fillStyle = o.shadowColor || th.shadow;
      for (let y = 0; y < grid.h; y++) for (let x = 0; x < grid.w; x++) if (grid.get(x, y)) s.fillRect(x * cell, y * cell, cell, cell);
      for (let i = 1; i <= len; i++) ctx.drawImage(sil, ox + dir[0] * i, oy + dir[1] * i);
    }
    for (let y = 0; y < grid.h; y++) for (let x = 0; x < grid.w; x++) {
      const v = grid.get(x, y); if (!v) continue;
      ctx.fillStyle = th[v] || v;
      const glowing = (v === "glow" || v === "led") && th.glowBlur;
      if (glowing) { ctx.shadowColor = th[v]; ctx.shadowBlur = cell * 2.2 * th.glowBlur; } else ctx.shadowBlur = 0;
      ctx.fillRect(ox + x * cell, oy + y * cell, cell, cell);
    }
    ctx.shadowBlur = 0;
    return { w: grid.w * cell, h: grid.h * cell };
  }

  function led(ctx, s, o) {
    const k = o.cell, gap = o.gap ?? Math.max(1, Math.round(k * .18));
    let cx = o.x;
    ctx.fillStyle = o.color; ctx.shadowColor = o.color; ctx.shadowBlur = o.glow ? k * 1.4 : 0;
    for (const ch of s.toUpperCase()) { const g = glyph(ch);
      g.forEach((row, j) => [...row].forEach((b, i) => {
        const sub = o.sub ?? 2;
        if (b === "1") for (let a = 0; a < sub; a++) for (let c = 0; c < sub; c++)
          ctx.fillRect(cx + (i * sub + c) * k, o.y + (j * sub + a) * k, k - gap, k - gap);
      }));
      cx += (g[0].length + 1) * (o.sub ?? 2) * k; }
    ctx.shadowBlur = 0;
    return cx - o.x;
  }

  function canvasFor(el) {
    const c = document.createElement("canvas"), r = el.getBoundingClientRect(), d = window.devicePixelRatio || 1;
    c.width = Math.round(r.width * d); c.height = Math.round(r.height * d);
    c.style.cssText = "position:absolute;inset:0;width:100%;height:100%;image-rendering:pixelated";
    el.prepend(c); const ctx = c.getContext("2d"); ctx.scale(d, d); ctx.imageSmoothingEnabled = false; return ctx;
  }

  return { THEMES, FONT, OBJECTS, Grid, draw, led, canvasFor, textWidth };
})();
if (typeof module !== "undefined") module.exports = TK;
