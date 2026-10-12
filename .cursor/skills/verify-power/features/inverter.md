# Inverter

Inverter sizes a 230 V inverter from the loads that are ticked: continuous watts with a margin, surge watts, and the DC amps that running load draws at 12 V and 24 V. The page is `inverter.html` on the hub.

## Sub-features

- `inverter-open` opens the tool from the old URL and from the Power nav.
- `inverter-custom` adds one 230 V load and turns the others off.
- `inverter-margin` adds the margin percent to the continuous watts shown.
- `inverter-amps` shows DC amps from running watts, efficiency, and voltage, without that margin.

## How to get to it (user POV)

- Open `https://motorhomepower.co.uk/inverter.html`. It 301s to `https://motorhometools.co.uk/power/inverter.html`.
- Choose `Inverter` in the nav labelled `Power Tools`.
- The heading is `Inverter size calculator`. The big number is `#inverter-continuous`.

## Driving it with verify-power

Preconditions:

- `doctor.js` has passed.
- Fresh Chrome profile.

- **Open.** Run `node .cursor/skills/verify-power/helpers/drive-calculator.js inverter`.
- **Add a load.** Click `#add-custom` (`Add custom load`). Type `Verify kettle` into the name field, `1000` into `#watts-<id>` (label `Watts`), `2000` into `#surgeWatts-<id>` (label `Start / surge`), and `1` into `#qty-<id>`.
- **Turn other loads off.** Click every other checked `input[data-field="enabled"]`. The name `Use` is repeated, so use `data-id`.
- **Settings.** Fill `#efficiency-pct` with `88` and `#margin-pct` with `20`. Click `button[data-voltage="12"]` (accessible name starts `12 V`).
- **Read the result.** `#inverter-continuous`, `#inverter-surge`, `#inverter-amps12`, `#inverter-amps24`.

| INPUT | EXPECTED | ACTUAL |
| --- | --- | --- |
| One load, 1000 W running, 2000 W surge, quantity 1. Other loads off. Efficiency 88%, margin 20%, 12 V. | Shown continuous = 1000 × 1.20 = 1200 W. Shown surge = max(2000, 1200) = 2000 W. Amps use running watts, not the margin: 1000 / 0.88 / 12 and 1000 / 0.88 / 24. Display `#inverter-continuous` `1,200`, `#inverter-surge` `2,000`, `#inverter-amps12` `94.7`, `#inverter-amps24` `47.3`. | Filled by `drive-calculator.js inverter` into `evidence/<run>/inverter.json`. |

## Gotchas

- The hero watts include the margin. The amp lines do not. 1000 W on the hero, or amps based on 1200 W, means the wrong field was read.
- A surge below the margined continuous watts is raised to that continuous figure.
- Efficiency is clamped from 50 to 100. Margin is clamped from 0 to 50.
- Do not click `#print-sheet`.
