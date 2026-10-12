# Solar

Solar turns daily watt-hours into an array size in watts, and into counts of 100 W, 200 W, and 400 W panels. The page is `solar.html` on the hub.

## Sub-features

- `solar-open` opens the tool from the old URL and from the Power nav.
- `solar-manual` uses a typed Wh/day.
- `solar-season` sets a UK/EU peak-sun default: summer 4.5 h, spring/autumn 3 h, winter 1.2 h.
- `solar-losses` applies the loss percent and the margin percent.

## How to get to it (user POV)

- Open `https://motorhomepower.co.uk/solar.html`. It 301s to `https://motorhometools.co.uk/power/solar.html`.
- From any Power page, choose `Solar` in the nav labelled `Power Tools`.
- The heading is `Solar panel size calculator`. The big number is `#array-watts`.

## Driving it with verify-power

Preconditions:

- `doctor.js` has passed.
- Fresh Chrome profile.

- **Open.** Run `node .cursor/skills/verify-power/helpers/drive-calculator.js solar`.
- **Type the energy.** Click `button[data-action="use-manual"]` (`Enter a different figure`). Fill `#manual-wh` with `1000`.
- **Sun and losses.** Click `button[data-season="spring-autumn"]` (accessible name starts `Spring / autumn`). Fill `#peak-sun-hours` with `3`, `#loss-pct` with `25`, and `#margin-pct` with `10`. Set the hours after the season button. The season button writes its own hour figure.
- **Read the result.** `#array-watts`, `#panels-100`, `#panels-200`, `#panels-400`.

| INPUT | EXPECTED | ACTUAL |
| --- | --- | --- |
| Manual 1000 Wh/day, 3 peak sun hours, 25% losses, 10% margin. | arrayW = 1000 × 1.10 / (3 × 0.75) = 488.888…. Display `#array-watts` `489`. Panels round up: `#panels-100` `5`, `#panels-200` `3`, `#panels-400` `2`. | Filled by `drive-calculator.js solar` into `evidence/<run>/solar.json`. |

Winter and summer change the peak-sun default. Recompute before claiming those buttons. Do not reuse 489.

## Gotchas

- Clicking a season after typing hours replaces the typed hours with 4.5, 3, or 1.2.
- Losses are clamped 0–70 and margin 0–50. Peak sun hours are clamped 0.5–12.
- The panel counts are `ceil(arrayW / size)`, not a rounded watt figure.
- A saved Daily Power total is used until the visitor clicks `Enter a different figure`.
