// static fan for graphics (same drawing as the site hero, no animation)
function fanDraw(cv, paths, o = {}) {
  const w = cv.width, h = cv.height, c = cv.getContext("2d"), K = [5, 15, 60];
  const left = o.left ?? w * .06, right = o.right ?? w * .94;
  const xs = { 0: left, 5: left + (right - left) * .3, 15: left + (right - left) * .56, 60: right };
  const top = o.top ?? 10, bottom = h - (o.bottom ?? 10), zero = top + (bottom - top) * (o.zeroAt ?? .38);
  const y = r => { r = Math.max(-100, Math.min(250, r)); return r >= 0 ? zero - Math.sqrt(r / 250) * (zero - top) : zero + Math.sqrt(-r / 100) * (bottom - zero); };
  const curve = pts => { c.moveTo(pts[0][0], pts[0][1]); for (let i = 0; i < pts.length - 1; i++) { const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2, t = .18; c.bezierCurveTo(p1[0] + (p2[0] - p0[0]) * t, p1[1] + (p2[1] - p0[1]) * t, p2[0] - (p3[0] - p1[0]) * t, p2[1] - (p3[1] - p1[1]) * t, p2[0], p2[1]); } };
  const sea = c.createLinearGradient(0, zero, 0, bottom); sea.addColorStop(0, "rgba(255,90,78,.12)"); sea.addColorStop(1, "rgba(255,90,78,0)"); c.fillStyle = sea; c.fillRect(0, zero, w, bottom - zero);
  const pass = (blur, a, lw) => { c.save(); c.globalCompositeOperation = "lighter"; if (blur) c.filter = `blur(${blur}px)`; c.lineWidth = lw;
    for (const p of paths) { const pts = [[xs[0], zero]]; let last = 0; K.forEach((k, i) => { const r = p[i + 1]; if (r !== null && r !== undefined && pts.length === i + 1) { pts.push([xs[k], y(r)]); last = r; } }); if (pts.length < 2) continue; c.strokeStyle = last > 0 ? `rgba(61,220,132,${a})` : `rgba(255,90,78,${a})`; c.beginPath(); curve(pts); c.stroke(); }
    c.restore(); };
  pass(0, .035, (o.s || 1) * 4); pass(0, .18, (o.s || 1) * 1);
  c.save(); c.shadowColor = "rgba(255,255,255,.9)"; c.shadowBlur = 14 * (o.s || 1); c.strokeStyle = "rgba(255,255,255,.85)"; c.lineWidth = 1.3 * (o.s || 1); c.beginPath(); c.moveTo(0, zero); c.lineTo(w, zero); c.stroke(); c.restore();
  const med = [[xs[0], zero]]; K.forEach((k, i) => { const v = paths.map(p => p[i + 1]).filter(x => x !== null && x !== undefined).sort((a, b) => a - b); if (v.length >= 5 && med.length === i + 1) med.push([xs[k], y(v[v.length >> 1])]); });
  if (med.length > 1) { c.save(); c.shadowColor = "rgba(255,255,255,.8)"; c.shadowBlur = 10; c.strokeStyle = "#fff"; c.lineWidth = 2.4 * (o.s || 1); c.beginPath(); curve(med); c.stroke(); c.restore(); }
  return { xs, zero, y };
}
