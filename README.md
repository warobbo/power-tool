# Power Tools

A small, mobile-friendly hub of **campervan power calculators** for UK and EU motorhome users.

## Daily Power

Pick appliances and hours of use to see:

- watt-hours (Wh) per day
- amp-hours (Ah) per day at 12 V
- amp-hours (Ah) per day at 24 V

## Battery (slice 2)

Turn daily watt-hours into a recommended leisure-battery size using:

- saved Daily Power total (or a figure you type)
- days without charging (default 2)
- chemistry: LiFePO4 (80% usable), AGM / lead-acid (50% usable), or a custom percentage
- an optional extra margin

Results lead with the 12 V Ah size to buy (how UK leisure batteries are sold), plus 24 V Ah and the Wh total.

## Solar (slice 3)

Turn daily watt-hours into a recommended solar-panel size using:

- saved Daily Power total (or a figure you type)
- UK / EU season presets: summer (4.5 h), spring / autumn (3 h, default), winter (1.2 h)
- editable peak sun hours
- real-world losses (default 25% for dirt, angle, controller, and cable)
- an optional extra margin

Results lead with array watts (how panels are sold), plus example 100 W / 200 W / 400 W panel counts and the watt-hours per day that array can support.

Inverter sizing and wire/fuse tools are **not** in this slice.

The site is a static front-end: no backend, no accounts, and no APIs. It is meant to deploy on Render as a static site.

## How to use

1. Open Daily Power and set your appliances, or keep the defaults.
2. Open Battery. Daily watt-hours are filled in from what you just saved.
3. Choose days without charging and LiFePO4 or AGM. Sizes update live.
4. Open Solar. The same daily watt-hours are filled in. Pick a season or type peak sun hours. Watts update live.

Numbers are a **planning estimate only**.

On a phone, hold the screen upright. A sideways phone shows a rotate message instead of a landscape layout.

## Run locally

No build step and no npm install.

From the repo root:

```bash
python3 -m http.server 8080
```

Then open [http://127.0.0.1:8080/](http://127.0.0.1:8080/), [http://127.0.0.1:8080/battery.html](http://127.0.0.1:8080/battery.html), and [http://127.0.0.1:8080/solar.html](http://127.0.0.1:8080/solar.html).

You can also open the HTML files directly in a browser. A local server is the more reliable option.

To check the energy maths:

```bash
node tests/calc.test.js
```

## Deploy on Render (static site)

1. Push this repository to GitHub.
2. In the Render dashboard, choose **New → Static Site**.
3. Connect the repo and branch (`main` once merged).
4. Settings:
   - **Build Command:** leave empty
   - **Publish Directory:** `.`
5. Optional environment variable: `SKIP_INSTALL_DEPS=true` (there are no Node dependencies to install).
6. Deploy.

A `render.yaml` Blueprint is included with the same static publish path. After you have a live domain, add that host to `sitemap.xml` (`<loc>`) and optionally a `Sitemap:` line in `robots.txt`. Do not use a placeholder domain.

## Persistence

All Power Tools slices share one browser profile:

| Item | Value |
| --- | --- |
| **localStorage key** | `powertools.systemProfile` |
| **Current version** | `1` |

Daily Power reads and writes `dailyPower`. Battery and Solar read that total and write `battery` and `solar` on the same object:

```json
{
  "version": 1,
  "dailyPower": {
    "inverterLossEnabled": false,
    "inverterLossPct": 12,
    "appliances": []
  },
  "battery": {
    "daysAutonomy": 2,
    "chemistry": "lifepo4",
    "customUsablePct": 80,
    "contingencyPct": 10,
    "useManualWh": false,
    "manualWh": 0
  },
  "solar": {
    "season": "spring-autumn",
    "peakSunHours": 3,
    "lossPct": 25,
    "marginPct": 10,
    "useManualWh": false,
    "manualWh": 0
  }
}
```

Later slices should add sibling keys on the **same object** (for example `inverter`, `wiring`) instead of creating new localStorage keys. Bump `version` only if a breaking migration is required. The loader already preserves unknown sibling keys.

## Out of scope

Inverter sizing, wire/fuse calculations, shade modelling, payments, trip planner, Airtable, bots, DVLA lookups, and any claim of electrical compliance or certification.

## Disclaimer

These calculators are a planning estimate only. They are not an electrical design, installation guide, or certification. Check manufacturer ratings and use a qualified installer for safety-critical work.
