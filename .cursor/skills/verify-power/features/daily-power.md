# Daily Power

Daily Power adds up the appliances the visitor ticks and shows watt-hours per day, plus amp-hours at 12 V and 24 V. The page is the hub at `/power/`. This repo only 301s to it.

## Sub-features

- `daily-open` opens the calculator from the old hosts and from the Power nav.
- `daily-custom` adds one appliance and turns the others off.
- `daily-loss` optionally adds 12% inverter loss.
- `daily-presets` replace the starter hours. Their totals are not listed here.
- `daily-limits` clamps watts, hours, and quantity and shows a limit message.

## How to get to it (user POV)

- Open `https://motorhomepower.co.uk/` or `/index.html`. Both 301 to `https://motorhometools.co.uk/power/`.
- On the hub, use the Power Tools nav link `Daily Power` (`href="/power/"`), or the brand image that links to `/power/`.
- The visible heading is `Daily power consumption calculator`.

## Driving it with verify-power

Preconditions:

- `doctor.js` has passed for this `POWER_VERIFY_RUN`.
- Chrome can open the hub. The helper uses a fresh profile, so `powertools.systemProfile` starts empty and the starter list is the page default.
- Viewport is 1280×900 so `#rotate-gate` stays `display: none`.

- **Open.** Run `node .cursor/skills/verify-power/helpers/drive-calculator.js daily`. The browser requests the local `/`, follows the 301, and waits until the heading reads `Daily power consumption calculator`.
- **Add a row.** The helper clicks `#add-custom` (`Add custom appliance`), then types `Verify lamp` into `#name-<id>`, `100` into `#watts-<id>`, `10` into `#hours-<id>`, and `1` into `#qty-<id>`. The row's Use checkbox (`input[data-field="enabled"][data-id="<id>"]`) stays on. The accessible name `Use` is repeated on every row, so the id is the handle.
- **Turn the starter rows off.** The helper clicks every other checked Use box. Preset buttons (`#presets button[data-preset]`) are not used for this case.
- **Leave inverter loss off.** `#inverter-loss` stays unchecked. The label starts `Add inverter loss (12%)`.
- **Read the result.** `#total-wh`, `#total-ah12`, and `#total-ah24` match the table. The same numbers are in `localStorage` key `powertools.systemProfile` under the custom appliance.

| INPUT | EXPECTED | ACTUAL |
| --- | --- | --- |
| Custom appliance 100 W, 10 h, quantity 1, enabled. Every other row off. Inverter loss off. | Wh = 100 × 10 × 1 = 1000. Ah 12 V = 1000 / 12. Ah 24 V = 1000 / 24. Displayed with en-GB grouping: `#total-wh` `1,000`, `#total-ah12` `83.3`, `#total-ah24` `41.7`. | Filled by `drive-calculator.js daily` into `evidence/<run>/daily.json`. |

| INPUT | EXPECTED | ACTUAL |
| --- | --- | --- |
| Same row, then tick `#inverter-loss` (12%). | Wh = 1000 × 1.12 = 1120. Display `#total-wh` `1,120`, `#total-ah12` `93.3`, `#total-ah24` `46.7`. | Not driven by the helper. Do not mark it passed from the first row. |

Preset totals (`Light weekend (2 people)`, `Full week — 4 people`, `Typical full-time off-grid`, `Reset to defaults`) are **Unable to independently verify from this repo**. The starter watt and hour table lives in the hub's `defaults.js`, which this checkout does not contain. Do not copy a preset total into EXPECTED.

## Gotchas

- Hours above 24 or below 0 are pulled back to the limit and a note is shown. The Wh figure uses the limit, not the number left in the field before the correction.
- Quantity is rounded to a whole number from 1 to 99.
- `#print-sheet` opens the print dialog. Do not click it during a drive.
- An old `powertools.systemProfile` value changes the starter rows. The helper avoids that with a new Chrome profile. A normal browser will not.
- Display text uses en-GB thousands separators. `1000` on screen is a failure; the node is `1,000`.
- Wave 3 share links (`?wave3=true&hours=2`) are applied by the hub after the redirect. This repo keeps the query string and has no prefill code. With other rows forced off, Wh = 640 × hours. Confirm 640 from the loaded `defaults.js` before using it. The helper does not drive that link.
