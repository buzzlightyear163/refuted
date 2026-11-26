/* REFUTED — the strategies on trial.
   Each strategy is one plain rule. `when(f)` gets a feature snapshot of a coin (see core.js `features`)
   and returns true the first time the coin qualifies. One paper trade per coin per strategy.

   SEED = the 12 strategies the lab opens with.
   POOL = what the agent fleet proposes next, in order, each time a strategy dies.
   After the pool runs out, FAMILIES generate fresh variants so the board never empties. */

const AGENTS = [
  { id: "VEX-7", style: "Momentum", motto: "Speed is the signal." },
  { id: "TELLER", style: "Graduations", motto: "Buys the bell." },
  { id: "MARA", style: "Contrarian", motto: "Buys blood." },
  { id: "QUILL", style: "On-chain hygiene", motto: "Clean books or no trade." },
  { id: "OSSIAN", style: "Crowd & socials", motto: "Follows the room." },
  { id: "PIKE", style: "Tape reader", motto: "Reads the flow." },
];

const pre = f => !f.grad; // still on the bonding curve

const SEED = [
  { id: "S-01", name: "Fast Fifty", agent: "VEX-7", myth: "If it's at 50% in five minutes, it's sending.",
    rule: "Buy any coin that hits 50% bonding in under 5 minutes.", when: f => pre(f) && f.age <= 300 && f.bc >= 50 },
  { id: "S-02", name: "Final Stretch", agent: "TELLER", myth: "Nothing dies at 90%.",
    rule: "Buy every coin the moment it crosses 90% bonding.", when: f => pre(f) && f.bc >= 90 && f.bc < 100 },
  { id: "S-03", name: "Graduation Chase", agent: "TELLER", myth: "Migration is the real launch.",
    rule: "Buy in the first 90 seconds after a coin migrates.", anytime: true, when: f => f.grad && f.gradAge !== null && f.gradAge <= 90 },
  { id: "S-04", name: "Fat Dev Bag", agent: "MARA", myth: "A dev who buys big believes.",
    rule: "Buy at launch when the dev takes 5% or more of the supply.", when: f => pre(f) && f.age <= 120 && f.devFirst !== null && f.devFirst >= 5 },
  { id: "S-05", name: "Holder Rush", agent: "OSSIAN", myth: "A hundred holders in ten minutes can't be faked.",
    rule: "Buy when a coin passes 100 holders in its first 10 minutes.", when: f => pre(f) && f.age <= 600 && f.holders >= 100 },
  { id: "S-06", name: "Clean Top 10", agent: "QUILL", myth: "Good distribution always runs.",
    rule: "Buy at 40% bonding if the top 10 wallets hold under 20%.", when: f => pre(f) && f.bc >= 40 && f.top10 !== null && f.top10 < 20 },
  { id: "S-07", name: "Full Socials", agent: "OSSIAN", myth: "Real teams launch with X, site and Telegram.",
    rule: "Buy at 25% bonding if the coin launched with X, a website and Telegram.", when: f => pre(f) && f.tw && f.web && f.tg && f.bc >= 25 },
  { id: "S-08", name: "First Dip", agent: "MARA", myth: "Always buy the first dip.",
    rule: "After a coin touches 40% bonding, buy its first 30% drop from the high.", when: f => pre(f) && f.age <= 3600 && f.peakBc >= 40 && f.dd !== null && f.dd <= -30 },
  { id: "S-09", name: "Short Ticker", agent: "PIKE", myth: "Short tickers run harder.",
    rule: "Buy tickers of 4 letters or fewer that reach 25% within 10 minutes.", when: f => pre(f) && f.symLen <= 4 && f.age <= 600 && f.bc >= 25 },
  { id: "S-10", name: "Volume Over Cap", agent: "VEX-7", myth: "When volume beats market cap, it's early.",
    rule: "Buy when 5-minute volume is bigger than the market cap, under 30 minutes old.", when: f => pre(f) && f.age <= 1800 && f.bc >= 10 && f.mcap > 0 && f.vol5 > f.mcap },
  { id: "S-11", name: "Buyers Two to One", agent: "PIKE", myth: "Twice the buys means it's going up.",
    rule: "Buy at 30% bonding when buys beat sells 2 to 1 over 5 minutes (20+ buys).", when: f => pre(f) && f.bc >= 30 && f.b5 >= 20 && f.b5 >= 2 * Math.max(1, f.s5) },
  { id: "S-12", name: "Slow Burn", agent: "QUILL", myth: "Slow coins are organic coins.",
    rule: "Buy coins that take 30 minutes or more to reach 50% bonding.", when: f => pre(f) && f.bc >= 50 && f.t50 !== null && f.t50 >= 1800 },
];

const POOL = [
  { name: "Fast Seventy", agent: "VEX-7", myth: "Seventy in ten is a runner.",
    rule: "Buy any coin that hits 70% bonding in under 10 minutes.", when: f => pre(f) && f.age <= 600 && f.bc >= 70 },
  { name: "Sniper Free", agent: "QUILL", myth: "No snipers, no dump.",
    rule: "Buy at 30% bonding if snipers hold under 3%.", when: f => pre(f) && f.bc >= 30 && f.sniper !== null && f.sniper < 3 },
  { name: "Second Wind", agent: "MARA", myth: "Coins that come back are the real ones.",
    rule: "Buy when a coin that hit 50% and fell under 30% climbs back over 50%.", when: f => pre(f) && f.bc >= 50 && f.fellAfter50 },
  { name: "Quick Grad", agent: "TELLER", myth: "Fast graduations keep running.",
    rule: "Buy right after migration if the coin graduated within 15 minutes of launch.", anytime: true, when: f => f.grad && f.gradAge !== null && f.gradAge <= 120 && f.gradAtAge !== null && f.gradAtAge <= 900 },
  { name: "Ghost Launch", agent: "MARA", myth: "No socials means no team to rug you.",
    rule: "Buy at 40% bonding if the coin has no X, no website and no Telegram.", when: f => pre(f) && f.bc >= 40 && !f.tw && !f.web && !f.tg },
  { name: "Dev Still In", agent: "QUILL", myth: "If the dev hasn't sold, neither should you.",
    rule: "Buy at 60% bonding if the dev still holds 3% or more.", when: f => pre(f) && f.bc >= 60 && f.dev !== null && f.dev >= 3 },
  { name: "Organic Sixty", agent: "OSSIAN", myth: "High organic score means real buyers.",
    rule: "Buy at 30% bonding when Jupiter's organic score is 60 or higher.", when: f => pre(f) && f.bc >= 30 && f.org !== null && f.org >= 60 },
  { name: "Sub-Minute Ten", agent: "PIKE", myth: "The first minute tells you everything.",
    rule: "Buy any coin that reaches 10% bonding within 60 seconds.", when: f => pre(f) && f.age <= 60 && f.bc >= 10 },
  { name: "Insider Light", agent: "QUILL", myth: "Low insiders, clean pump.",
    rule: "Buy at 50% bonding if insiders hold under 5%.", when: f => pre(f) && f.bc >= 50 && f.insider !== null && f.insider < 5 },
  { name: "Holder Velocity", agent: "OSSIAN", myth: "Holders up 50% in five minutes is a breakout.",
    rule: "Buy at 20% bonding when holders grew 50% or more in the last 5 minutes.", when: f => pre(f) && f.bc >= 20 && f.hc5 !== null && f.hc5 >= 50 },
  { name: "Retrace to Sixty", agent: "MARA", myth: "Buy the retrace from the edge of migration.",
    rule: "After a coin reaches 85% bonding, buy if it falls back to 60%.", when: f => pre(f) && f.peakBc >= 85 && f.bc <= 60 },
  { name: "X Only", agent: "OSSIAN", myth: "An X account is all a real coin needs.",
    rule: "Buy at 30% bonding if the coin has an X link but no website.", when: f => pre(f) && f.bc >= 30 && f.tw && !f.web },
  { name: "Dev Out", agent: "MARA", myth: "Once the dev sells, the bottom is in.",
    rule: "Buy at 50% bonding if the dev holds nothing anymore.", when: f => pre(f) && f.bc >= 50 && f.devFirst !== null && f.devFirst > 0 && f.dev !== null && f.dev === 0 },
  { name: "Late Grad", agent: "TELLER", myth: "Coins that take hours to graduate are survivors.",
    rule: "Buy right after migration if the coin took 2 hours or more to graduate.", anytime: true, when: f => f.grad && f.gradAge !== null && f.gradAge <= 120 && f.gradAtAge !== null && f.gradAtAge >= 7200 },
  { name: "Thin Top, Fast Curve", agent: "VEX-7", myth: "Speed plus distribution is the combo.",
    rule: "Buy at 50% bonding under 10 minutes old if the top 10 hold under 25%.", when: f => pre(f) && f.age <= 600 && f.bc >= 50 && f.top10 !== null && f.top10 < 25 },
  { name: "Net Buyers", agent: "PIKE", myth: "Thirty net buyers in five minutes is demand.",
    rule: "Buy at 25% bonding when 30 or more wallets were net buyers in 5 minutes.", when: f => pre(f) && f.bc >= 25 && f.nb5 !== null && f.nb5 >= 30 },
];

// Parametric families: once POOL is used up, the fleet keeps proposing variants (round-robin across families).
// every (x, y) pair, in a fixed shuffled order so consecutive proposals differ
const grid = (xs, ys, skip = []) => { const out = []; for (const x of xs) for (const y of ys) if (!skip.includes(x + ":" + y)) out.push([x, y]); let r = 7; for (let i = out.length - 1; i > 0; i--) { r = (r * 16807) % 2147483647; const j = r % (i + 1); [out[i], out[j]] = [out[j], out[i]]; } return out; };
const FAMILIES = [
  { agent: "VEX-7", make: (bc, min) => ({ name: `Fast ${bc} in ${min}`, myth: `${bc}% in ${min} minutes is a runner.`,
      rule: `Buy any coin that hits ${bc}% bonding in under ${min} minutes.`, when: f => pre(f) && f.age <= min * 60 && f.bc >= bc }),
    params: grid([40, 60, 80, 30, 65, 55, 75, 45, 85, 35], [3, 8, 15, 2, 6, 4, 12, 20], ["50:5", "70:10"]) },
  { agent: "OSSIAN", make: (h, min) => ({ name: `${h} Holders in ${min}`, myth: `${h} holders in ${min} minutes can't be faked.`,
      rule: `Buy when a coin passes ${h} holders in its first ${min} minutes.`, when: f => pre(f) && f.age <= min * 60 && f.holders >= h }),
    params: grid([150, 60, 250, 80, 200, 120, 300, 50], [15, 5, 30, 8, 20, 12], ["100:10"]) },
  { agent: "MARA", make: (peak, drop) => ({ name: `Dip ${drop} after ${peak}`, myth: `A ${drop}% dip after ${peak}% is a gift.`,
      rule: `After a coin touches ${peak}% bonding, buy its first ${drop}% drop from the high.`, when: f => pre(f) && f.age <= 3600 && f.peakBc >= peak && f.dd !== null && f.dd <= -drop }),
    params: grid([60, 30, 75, 50, 20, 85, 45], [40, 25, 35, 50, 20, 45], ["40:30"]) },
  { agent: "QUILL", make: (bc, top) => ({ name: `Top 10 Under ${top} at ${bc}`, myth: `Under ${top}% in the top 10 is a clean coin.`,
      rule: `Buy at ${bc}% bonding if the top 10 wallets hold under ${top}%.`, when: f => pre(f) && f.bc >= bc && f.top10 !== null && f.top10 < top }),
    params: grid([30, 60, 20, 50, 70, 80], [15, 25, 30, 18, 22], ["40:20"]) },
  { agent: "PIKE", make: (bc, buys) => ({ name: `${buys} Buys at ${bc}`, myth: `${buys} buys in five minutes is real demand.`,
      rule: `Buy at ${bc}% bonding when there were ${buys} or more buys in the last 5 minutes.`, when: f => pre(f) && f.bc >= bc && f.b5 >= buys }),
    params: grid([20, 40, 60, 30, 50], [50, 100, 150, 75, 200]) },
];

module.exports = { AGENTS, SEED, POOL, FAMILIES };
