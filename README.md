# Power Tools

A small, mobile-friendly **Daily Power Consumption Calculator** for UK and EU motorhome and campervan users.

Pick appliances and hours of use to see:

- watt-hours (Wh) per day
- amp-hours (Ah) per day at 12 V
- amp-hours (Ah) per day at 24 V

This is **slice 1** of a planned Power / Solar tools hub. Battery-bank, solar, inverter sizing, and wire/fuse tools are **not** in this slice.

The site is a static front-end: no backend, no accounts, and no APIs. It is meant to deploy on Render as a static site.

## How to use

1. Open the calculator.
2. Start from a preset, or keep the defaults.
3. Tick appliances, then edit watts, hours per day, and quantity.
4. Totals update live. An optional 12% inverter-loss toggle is included.

Numbers are a **planning estimate only**.

## Run locally

No build step and no npm install.

From the repo root:

```bash
python3 -m http.server 8080
```

Then open [http://127.0.0.1:8080/](http://127.0.0.1:8080/).

You can also open `index.html` directly in a browser. A local server is the more reliable option.

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

## Persistence for later slices

All Power Tools slices should share one browser profile:

| Item | Value |
| --- | --- |
| **localStorage key** | `powertools.systemProfile` |
| **Current version** | `1` |

Slice 1 reads and writes `dailyPower`:

```json
{
  "version": 1,
  "dailyPower": {
    "inverterLossEnabled": false,
    "inverterLossPct": 12,
    "appliances": [
      {
        "id": "fridge",
        "name": "Compressor fridge",
        "watts": 45,
        "hours": 10,
        "qty": 1,
        "enabled": true,
        "custom": false
      }
    ]
  }
}
```

Later slices should add sibling keys on the **same object** (for example `battery`, `solar`, `inverter`, `wiring`) instead of creating new localStorage keys. Bump `version` only if a breaking migration is required. The loader already preserves unknown sibling keys.

## Out of scope (slice 1)

Battery bank sizing, solar yield, inverter sizing, wire/fuse calculations, payments, trip planner, Airtable, bots, DVLA lookups, and any claim of electrical compliance or certification.

## Disclaimer

This calculator is a planning estimate only. It is not an electrical design, installation guide, or certification. Check manufacturer ratings and use a qualified installer for safety-critical work.
