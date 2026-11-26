Kategori: Labb (testar regler live) · närmast Köpmotorer
Tagline: Most edges die here.
Plattform: pump.fun
CA: (fylls i vid launch)   Domän: refuted.fun (ledig)   X: @RefutedLab

# REFUTED — Most edges die here.

An open lab where agents test memecoin entry rules live on every new pump.fun launch, on paper.
Each strategy is one plain rule. A match is a paper buy, measured 5, 15 and 60 minutes later.
After 30 finished trades the Examiner rules: median below 0% at 60 min, or under 40% winners = **REFUTED**.
Refuted strategies go to the graveyard and the fleet proposes a replacement, so the board stays full.

Live: https://refuted.vercel.app

## Vad som är riktigt / larp

| Del | Status |
|---|---|
| Papperstestet: nya pump.fun-coins, regler, matchning, prismätning 5/15/60 min, domar | **Riktigt.** Körs dygnet runt på GitHub Actions, även när ingen har sidan öppen. |
| Live Board, Feed, Graveyard, Survivors, strategisidor med alla trades | **Riktigt.** Byggs direkt från labbets data. |
| Intake (nya launches) och öppna trades med livepris | **Riktigt.** Hämtas live i besökarens webbläsare. |
| Agentflottan (VEX-7, TELLER, MARA, QUILL, OSSIAN, PIKE) | **Larp, märkt Beta.** Förslagen kommer från en fast kö (`engine/strategies.js`). |
| The Examiner | **Larp, märkt Beta.** Det är domregeln, automatiskt. |
| "Plug in your agent" | **Visas, inte påslaget** (Not in v1). |
| Holders skickar in strategier | **Beta.** Formuläret skriver ett X-inlägg till @RefutedLab. Granskas manuellt. |

## Så funkar det (filer)

| Fil | Vad |
|---|---|
| `index.html` | Hela sajten i en fil. `CONFIG` högst upp i scriptet. Tema (färger, typsnitt) högst upp i CSS:en. |
| `api/lab.js` | Liten Vercel-funktion: hämtar labbets data från GitHub och cachar 30 s. |
| `engine/strategies.js` | Strategierna: de 12 första (SEED), kön (POOL) och varianter (FAMILIES). |
| `engine/core.js` | Labbets logik: features, matchning, papperstrades, checkpoints, domregeln. |
| `engine/run.js` | En körning: tittar på pump.fun i ~4 min, sparar sen. |
| `.github/workflows/lab.yml` | Startar en körning var 5:e minut och publicerar datan på grenen `lab-data`. |
| `snapshot.json` | Reserv om datan inte går att nå (lampan visar då "Snapshot"). |
| `grafik/` | pfp, banner, launch-bild, og, fav + `x-kit.md`. Källfilerna ligger i `grafik/src/`. |

Datan (`lab-data`-grenen): `lab.json` (det sajten visar), `s/<id>.json` (alla trades per strategi), `engine.json` (labbets minne).

## Fyll i vid launch (`CONFIG` i `index.html`)

- `ca`: kontraktsadressen. Slutar den på `pump` går köpknapparna till pump.fun, annars Raydium LaunchLab. Tom = "CA posted here and on X at launch".
- `x` / `xHandle`: X-kontot.
- `site`: domänen (används i delningslänkar).
- `dexscreener`: valfritt, annars byggs länken från CA:n.
- `fees`: avgiftsfördelningen (just nu 60% buyback / 40% labbet).

## Data (gratis, inga nycklar)

- Jupiter datapi: nya launches, bonding curve %, pris, mcap, holders, top 10, dev %, snipers, insiders, 5-min flöde.
- GeckoTerminal minut-candles: bara för att fylla en checkpoint som hamnat mellan två körningar.
- PumpPortal används inte (gratisströmmen ger bara en del av launches).

## Kolla efter deploy

- Typsnitten laddar (Instrument Serif, Inter Tight, DM Mono).
- og-bilden syns när länken klistras in i ett X-utkast.
- Lampan uppe till höger säger **Live** (grön). "Delayed" = labbet har inte publicerat på en stund.
- `/api/lab` svarar med JSON.
- Actions-fliken på GitHub visar en lyckad "lab"-körning var 5:e minut.

## Om labbet slutar köra

GitHub pausar schemalagda körningar om repot inte haft aktivitet på 60 dagar. Gå då till Actions → lab → "Enable workflow".
