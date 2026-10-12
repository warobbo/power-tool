# Redirects

Old Power URLs on this repo's hosts send the visitor to the matching page on Motorhome Tools. The calculator is not served from this checkout.

## Sub-features

- `redirect-home` sends `/` and `/index.html` to the Daily Power page.
- `redirect-tools` sends each calculator path to the same filename under `/power/`.
- `redirect-unknown` sends any other path with no file to Daily Power.
- `redirect-query` keeps the query string on the destination.
- `redirect-slash` treats `/battery.html/` like `/battery.html`.

## How to get to it (user POV)

- Open `https://motorhomepower.co.uk/` or `https://power-tool.onrender.com/`.
- Open `/index.html`, `/battery.html`, `/solar.html`, `/inverter.html`, or `/wire.html` on either host.
- Open an unknown path such as `/does-not-exist`.
- `https://www.motorhomepower.co.uk/` first lands on the apex. Plain `http://` first lands on `https://`. Those two hops are the edge, then the app 301 runs.

## Driving it with verify-power

Preconditions:

- `POWER_VERIFY_RUN` is set and `doctor.js` has passed for that run.

- **Home.** Request `/`. Run `node .cursor/skills/verify-power/helpers/drive-redirects.js`. Status 301, `Location: https://motorhometools.co.uk/power/`.
- **Index.** The same command checks `/index.html`. Same destination as `/`.
- **Tools.** The same command checks `/battery.html`, `/solar.html`, `/inverter.html`, and `/wire.html`. Each `Location` is `https://motorhometools.co.uk/power/` plus that filename.
- **Unknown.** `/does-not-exist` is 301 to `https://motorhometools.co.uk/power/`.
- **Query.** `/battery.html?x=1` is 301 to `https://motorhometools.co.uk/power/battery.html?x=1`.
- **Slash.** `/battery.html/` is 301 to the battery URL, not the catch-all home.
- **Proof.** `evidence/<run>/redirects.json` lists status, location, and pass for every row. `doctor.js` repeats the live https checks.

## Gotchas

- A 200 with an HTML body means a file is shadowing the rule. Render skips a redirect when the file exists.
- `render.yaml` routes apply only after a Blueprint sync. The live 301s are the dashboard rules. `_redirects` is the copy in git. Doctor fails if they disagree.
- The catch-all destination is the Daily Power URL. It does not append the old path. `/foo` does not become `/power/foo`.
- Do not add `index.html` or the calculator HTML back into the repo root.
