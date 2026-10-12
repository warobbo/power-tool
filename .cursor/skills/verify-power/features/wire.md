# Wire and fuse

Wire and fuse picks a copper cable size in mm² and a fuse or breaker rating from current, one-way length, and allowed voltage drop. The page is `wire.html` on the hub.

## Sub-features

- `wire-open` opens the tool from the old URL and from the Power nav.
- `wire-manual` uses a current the visitor types, instead of the inverter suggestion.
- `wire-drop` uses the allowed drop percent and the one-way length.
- `wire-step` rounds up to a listed cable size that can also carry the current, then picks a fuse.

## How to get to it (user POV)

- Open `https://motorhomepower.co.uk/wire.html`. It 301s to `https://motorhometools.co.uk/power/wire.html`.
- Choose `Wire & fuse` in the nav labelled `Power Tools`.
- The heading is `Wire & fuse size calculator`. The big number is `#cable-mm2`.

## Driving it with verify-power

Preconditions:

- `doctor.js` has passed.
- Fresh Chrome profile. A saved inverter result will otherwise fill the current.

- **Open.** Run `node .cursor/skills/verify-power/helpers/drive-calculator.js wire`.
- **Voltage.** Click `button[data-voltage="12"]`.
- **Type the current.** If `button[data-action="use-manual"]` (`Enter a different current`) is showing, click it. Fill `#current-a` with `20`, `#one-way-length` with `2`, and `#drop-pct` with `3`. Typing the current also leaves the inverter suggestion.
- **Read the result.** `#cable-mm2`, `#fuse-amps`, `#wiring-amps`, `#drop-v`, `#drop-pct-out`.

| INPUT | EXPECTED | ACTUAL |
| --- | --- | --- |
| 12 V, 20 A typed, 2 m one way, 3% allowed drop. Inverter suggestion off. | Allowed drop = 12 × 0.03 = 0.36 V. Required mm² = (2 × 20 × 2 × 0.0175) / 0.36 = 3.888…. Next listed size that also carries 20 A is 4 mm² (32 A step). Drop on that cable = (2 × 20 × 2 × 0.0175) / 4 = 0.35 V, which is 2.9166…% of 12 V. Fuse target = 20 × 1.1 = 22 A, so the 25 A step. Display `#cable-mm2` `4`, `#fuse-amps` `25`, `#wiring-amps` `20`, `#drop-v` `0.35`, `#drop-pct-out` `2.9`. | Filled by `drive-calculator.js wire` into `evidence/<run>/wire.json`. |

The cable steps used for that 4 mm² choice are 1.5/16 A, 2.5/21 A, 4/32 A, then 6/40 A and larger, up to 185 mm². They are in the hub `calc.js` `CABLE_STEPS` list. This repo does not contain that list. If the loaded script's steps differ, the drive's recomputed mm² wins and the helper fails the assertion.

## Gotchas

- The default source is the inverter's suggested amps when that suggestion is above 0. A drive that never types a current is not the 20 A case.
- Suggested inverter amps are AC watts ÷ battery volts. They are not also divided by inverter efficiency.
- Whole millimetre sizes are shown without a trailing `.0`. A fractional size keeps one decimal.
- Length is clamped from 0.1 m to 50 m. Drop percent is clamped from 1 to 15.
- Above the largest listed cable, the note tells the visitor to ask an installer. Do not invent a size past that step.
