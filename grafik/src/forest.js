// draws an illustrative "Fig. 1 — The trial" forest plot into #forest (no numbers on dots)
function forest(el, rows, opt = {}) {
  const LO = -80, HI = 80, X = v => (v - LO) / (HI - LO) * 100;
  let h = `<div class="fa"><span></span><div class="tk">${[-80, -40, 0, 40, 80].map(t => `<span style="left:${X(t)}%">${t > 0 ? "+" : t < 0 ? "−" : ""}${Math.abs(t)}%</span>`).join("")}</div><span></span></div>`;
  for (const [id, name, med, q1, q3, st] of rows) {
    const col = st === "t" ? "var(--test)" : med < 0 ? "var(--down)" : "var(--up)";
    h += `<div class="fr"><div class="nm"><i>${id}</i>${name}</div><div class="tr">${[-80, -40, 40, 80].map(t => `<b style="left:${X(t)}%"></b>`).join("")}<b class="z" style="left:${X(0)}%"></b>
      <em style="left:${X(q1)}%;width:${X(q3) - X(q1)}%;background:${col}"></em><u style="left:${X(med)}%;${st === "t" ? `background:var(--card);border:2.5px solid ${col}` : `background:${col}`}"></u></div><div class="st ${st}">${st === "t" ? "TESTING" : st === "d" ? "REFUTED" : "SURVIVING"}</div></div>`;
  }
  el.innerHTML = h;
}
