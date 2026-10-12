# Battery

Battery turns a daily watt-hour figure into a leisure-battery size in Ah at 12 V, plus Ah at 24 V and Wh. The page is `battery.html` on the hub.

## Sub-features

- `battery-open` opens the tool from the old URL and from the Power nav.
- `battery-manual` uses a Wh/day the visitor types, instead of the saved Daily Power total.
- `battery-chemistry` picks LiFePO4 (80% usable), AGM / lead-acid (50% usable), or a custom usable percent.
- `battery-days` and `battery-contingency` scale the bank.

## How to get to it (user POV)

- Open `https://motorhomepower.co.uk/battery.html`. It 301s to `https://motorhometools.co.uk/power/battery.html`.
- From Daily Power, choose `Battery` in the nav labelled `Power Tools` (`href="battery.html"`).
- The heading is `Battery size calculator`. The big number is Ah at 12 V (`#bank-ah12`).

## Driving it with verify-power

Preconditions:

- `doctor.js` has passed.
- Fresh Chrome profile. A saved Daily Power total would otherwise feed this page.

- **Open.** Run `node .cursor/skills/verify-power/helpers/drive-calculator.js battery`. Local path `/battery.html` 301s to the hub battery page.
- **Type a daily figure.** Click `button[data-action="use-manual"]` (`Enter a different figure`). `#manual-wh-wrap` becomes visible. Fill `#manual-wh` with `1000`, `#days-autonomy` with `2`, and `#contingency` with `10`.
- **Chemistry.** Click `button[data-chemistry="lifepo4"]`. Its accessible name is `LiFePO4 (80% usable)`.
- **Read the result.** `#bank-ah12`, `#bank-ah24`, and `#bank-wh`.

| INPUT | EXPECTED | ACTUAL |
| --- | --- | --- |
| Manual 1000 Wh/day, 2 days, LiFePO4 80% usable, contingency 10%. | bankWh = 1000 × 2 × 1.10 / 0.80 = 2750. Ah 12 V = 2750 / 12. Ah 24 V = 2750 / 24. Display `#bank-ah12` `229`, `#bank-wh` `2,750`, `#bank-ah24` `115`. | Filled by `drive-calculator.js battery` into `evidence/<run>/battery.json`. |

AGM at 50% usable and a custom usable percent are separate cases. Do not reuse 2750 for them. Recompute `bankWh = dailyWh × days × (1 + contingency/100) / (usable/100)` from the script the page loaded.

## Gotchas

- Until `Enter a different figure` is clicked, the page uses the Daily Power total in `powertools.systemProfile` when one is saved. A fresh profile has the starter total instead. Either way it is not the 1000 Wh case.
- The hero is Ah at 12 V, not Wh. `#bank-wh` is the smaller line.
- Days are clamped from 0.5 to 14. Contingency is clamped from 0 to 50.
- Do not click `#print-sheet`.
