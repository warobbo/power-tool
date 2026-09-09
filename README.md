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

## Inverter (slice 4)

Recommend an inverter size from 230 V loads using:

- an editable load list (kettle, induction hob, microwave, air fryer, capsule coffee machine, Wonder Oven, electric BBQ grill, hairdryer, water heater, plus custom rows). Laptop chargers, TVs and phone chargers stay on Daily Power as 12 V use.
- optional start / surge watts on each load
- leisure-system voltage 12 V or 24 V (changes the DC amp note, not the AC watt size)
- inverter efficiency (default 88%)
- an optional extra margin (default 20%)

Results lead with continuous watts (how inverters are sold), plus surge watts and rough DC amps at 12 V and 24 V.

## Wire & fuse (slice 5)

Recommend a copper cable size and fuse for a common van DC run using:

- typical-run presets (inverter DC feed, solar to controller, controller to battery, fridge, heater fan, water pump, leisure general, or custom)
- system voltage 12 V or 24 V
- current in amps, or watts converted with amps = watts ÷ volts
- an optional starting current from the saved Inverter recommendation (continuous AC watts ÷ battery volts — not also divided by inverter efficiency), with a manual override
- high-current sizes assume thick flexible copper battery / welding-style cable, not thin chassis cable
- one-way cable length in metres (the maths uses twice that for voltage drop)
- allowed voltage drop: 3% for important kit, 10% for everyday kit

Results lead with cable size in mm² (how UK cable is sold) and a fuse or breaker in amps, plus calculated current and estimated voltage drop.

The site is a static front-end: no backend, no accounts, and no APIs. It is meant to deploy on Render as a static site.

## How to use

1. Open Daily Power and set your appliances, or keep the defaults.
2. Open Battery. Daily watt-hours are filled in from what you just saved.
3. Choose days without charging and LiFePO4 or AGM. Sizes update live.
4. Open Solar. The same daily watt-hours are filled in. Pick a season or type peak sun hours. Watts update live.
5. Open Inverter. Tick the 230 V kit you might run at the same time. Continuous watts and surge update live.
6. Open Wire & fuse. Pick a typical run, set amps or watts and the one-way length. Cable mm² and fuse amps update live.

Numbers are a **planning estimate only**.

On a phone, hold the screen upright. A sideways phone shows a rotate message instead of a landscape layout.

## Run locally

No build step and no npm install.

From the repo root:

```bash
python3 -m http.server 8080
```

Then open [http://127.0.0.1:8080/](http://127.0.0.1:8080/), [http://127.0.0.1:8080/battery.html](http://127.0.0.1:8080/battery.html), [http://127.0.0.1:8080/solar.html](http://127.0.0.1:8080/solar.html), [http://127.0.0.1:8080/inverter.html](http://127.0.0.1:8080/inverter.html), and [http://127.0.0.1:8080/wire.html](http://127.0.0.1:8080/wire.html).

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

Daily Power reads and writes `dailyPower`. Battery and Solar read that total and write `battery` and `solar` on the same object. Inverter writes `inverter` with its own 230 V load list. Wire & fuse writes `wiring` and can read the saved inverter size:

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
  },
  "inverter": {
    "systemVoltage": 12,
    "efficiencyPct": 88,
    "marginPct": 20,
    "loads": []
  },
  "wiring": {
    "preset": "inverter",
    "systemVoltage": 12,
    "inputMode": "amps",
    "currentA": 0,
    "watts": 0,
    "oneWayLengthM": 2,
    "dropPct": 3,
    "useInverterSuggestion": true
  }
}
```

Later slices should add sibling keys on the **same object** instead of creating new localStorage keys. Bump `version` only if a breaking migration is required. The loader already preserves unknown sibling keys.

## Out of scope

AC mains consumer-unit design, full ISO / ABYC compliance claims, shade modelling, payments, trip planner, Airtable, bots, DVLA lookups, and any claim of electrical certification.

## Disclaimer

These calculators are a planning estimate only. They are not an electrical design, installation guide, or certification. Check manufacturer ratings and use a qualified installer for safety-critical work.
