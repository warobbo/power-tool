# Power verification map

This directory is the list of what to drive. Read it before driving, then open the feature file. One convenient URL is not coverage when this index lists others.

This checkout is a **redirect host**. It does not contain the calculator pages or `assets/calc.js` (removed in `cc6d72a`). The live tools are on [https://motorhometools.co.uk/power](https://motorhometools.co.uk/power). Old hosts `https://motorhomepower.co.uk` and `https://power-tool.onrender.com` 301 there.

Update this feature map in the same pull request whenever a build changes pages or tools. A weekly maintain pass also runs on Mondays, as part of Freddie the Font2's routine. That pass edits only this verify folder, opens at most one pull request through the review loop, and stays quiet unless it is blocked.

## Baseline

- Start `serve.js` and require `doctor.js` to pass before the first drive.
- Set `POWER_VERIFY_RUN` so this run does not share a port or Chrome profile with another.
- Calculator drives use a new Chrome profile. Saved `powertools.systemProfile` data from a normal browser is out of scope and will make totals look wrong.
- Desktop viewport for drives is 1280×900. The portrait gate covers the page only for a short landscape phone (`orientation: landscape`, `max-height: 540px`, `max-width: 1000px`).
- EXPECTED figures in calculator files were derived from the live page's `calc.js` functions, checked against `warobbo/motorhometools` `power/assets/calc.js` at `44433573` on 12 Oct 2026. They are not stored in this repo. The drive recomputes from the script the page loaded and fails if the result changed.

## Features

- [Redirects](./redirects.md) — old Power URLs 301 onto the hub.
- [Published files](./published-files.md) — allowlist paths stay 200. Dotfiles and `.cursor/` 301.
- [Daily Power](./daily-power.md) — Wh/day and Ah at 12 V and 24 V.
- [Battery](./battery.md) — leisure-battery Ah from daily Wh, days, chemistry, and contingency.
- [Solar](./solar.md) — array watts from daily Wh, peak sun, losses, and margin.
- [Inverter](./inverter.md) — continuous watts, surge watts, and DC amps.
- [Wire and fuse](./wire.md) — cable mm² and fuse amps from current, length, and voltage drop.
