# BatterLens

BatterLens is a cricket scouting dashboard for ODI player-pool projection and all-format batting
weakness analysis with a focus on the 2027 ICC Men's Cricket World Cup in South Africa, Zimbabwe,
and Namibia.

Built by **Rushinandan Reddy**.

It does **not** pretend that 2027 squads are already known. Instead, it builds realistic country
player pools from recent men's ODI appearances, then uses Tests, ODIs, and T20Is to find broader
weakness conclusions by bowler type, bowler arm, phase, matchup, and host-country conditions.

## Data Coverage

- Match data source: [Cricsheet men's international JSON archives](https://cricsheet.org/downloads/)
- CWC qualification/host source: [ICC pathway announcement](https://www.icc-cricket.com/media-releases/hosts-of-u19-icc-global-events-until-2027-announced)
- Recent ODI form window: **1 January 2023 onward**
- Active player-pool cutoff: **players active from 1 January 2024 onward**
- All-format weakness window: **1 January 2021 onward**
- Host-condition model window: **1 January 2020 onward**
- Host countries modeled: **South Africa, Zimbabwe, Namibia**
- Current generated dataset: **406 projected ODI players across 19 countries**
- Recent men's ODI deliveries processed: **225,155**
- All-format deliveries processed for projected players: **634,823**
- All-format matches processed: **3,360**
- Host-condition matches processed: **135**

Cricsheet currently withholds Afghanistan men's matches, so Afghanistan player projections are not
included in this real-data build.


## Run The App

Easiest option: double-click this file in Finder:

```text
Open BatterLens.html
```

This opens the app directly in your browser without starting a local server.

On macOS, you can double-click:

```text
Start BatterLens.command
```

That starts the local server and opens `http://127.0.0.1:4173/`. Keep the Terminal window open
while using the app.

From this folder:

```bash
python3 -m http.server 4173
```

Then open `http://localhost:4173`.

If you have `npm` installed, you can also use:

```bash
npm start
```

To run the lightweight logic tests:

```bash
node app.test.js
```

Or, with `npm`:

```bash
npm test
```

## Refresh The Data

Fetch the latest Cricsheet international archives and rebuild the browser asset:

```bash
node scripts/build-cwc-all-format-data.mjs data/cwc-2027-odi.js
```

You can also pass local Cricsheet zip files:

```bash
node scripts/build-cwc-all-format-data.mjs data/cwc-2027-odi.js /path/to/odis_json.zip /path/to/tests_json.zip /path/to/t20s_json.zip
```

## What It Shows

- Recent ODI runs, balls, strike rate, dot-ball rate, dismissals, boundaries, and matches.
- All-format Test/ODI/T20I weakness conclusions.
- Format buttons for switching the weakness view between all formats, ODI, Test, and T20I.
- Dismissal-probability model for next over, 18-ball spell, and 30-ball stay.
- AI-style match report generated locally from the player's real scorecard aggregates.
- Player-vs-player comparison across recent ODI form, selected-format evidence, host fit, and role impact.
- Win-readiness probability model based on projected batting role, host fit, and team player-pool strength.
- Bowler-type trouble: right-arm pace, left-arm pace, off spin, leg spin, left-arm orthodox, and wrist spin where known.
- Projected country player pools split into core candidates and extended watchlists.
- CWC 2027 host-country fit for South Africa, Zimbabwe, and Namibia.
- All-factor pitch behavior for host venues using run rate, dot rate, wicket rate, boundary rate,
  innings phase, bowler type, bowling arm, and dismissal mode.
- Shot heatmap proxy that shows scoring clusters by match phase and bowler type. True shot direction
  is not shown because Cricsheet does not include wagon-wheel coordinates.
- Weakness signals by innings phase, opposition, bowler matchup, host country, and host venue.
- Dismissal-mode patterns and phase-by-phase scoring splits.
- Evidence summaries that clearly separate real data from projection.

## Line And Length Note

Cricsheet scorecards do not include true line, length, release speed, swing, seam movement, or
ball-tracking coordinates. BatterLens therefore does **not** guess line/length. It uses real
outcome patterns by bowler style, bowler arm, phase, format, and matchup. If a verified tracking
feed is added later, the app can add true line/length panels on top of this structure.

## Why This Works As An SWE Project

BatterLens is more than a static mockup:

- It has a reproducible data-ingestion pipeline.
- It transforms ball-by-ball international data into player-level scouting features.
- It has a browser UI with filters, ranked signals, and condition summaries.
- It includes automated tests for the generated data contract and core app behavior.
- It includes a GitHub Actions workflow that runs tests on every push or pull request.

## Publish On GitHub

Create an empty repository on GitHub, then run these commands from this project folder:

```bash
git add .
git commit -m "Build CWC 2027 ODI scouting dashboard"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/batterlens.git
git push -u origin main
```

Replace `YOUR_USERNAME` with your GitHub username. Since this is a static HTML/CSS/JavaScript app,
you can host it with GitHub Pages. In the GitHub repo, open Settings -> Pages, choose
"Deploy from a branch", select `main`, and use the repository root.

## Pressure Score

The score combines:

- Dot-ball rate, as an indicator of scoring pressure.
- Dismissal rate, weighted heavily.
- Strike-rate suppression below an ODI batting baseline.
- A confidence adjustment based on balls faced in that split.

This identifies recorded outcome patterns to investigate. It does not replace video analysis,
ball-tracking, or official squad announcements.
