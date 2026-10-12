---
name: verify-power
description: Drive the power-tool repo the way a visitor does. This checkout is a redirect host, not the live Power calculator. Launch the local 301 server, health-check it, follow a redirect onto https://motorhometools.co.uk/power, and prove a calculator. Use before review, after redirect edits, or when a change touches pages or tools.
---

# Verify Power

This repo does **not** serve the Power calculator. Commit `cc6d72a` removed the HTML and `assets/` so Render can apply dashboard 301s. A git deploy publishes files only. It does not apply `render.yaml` routes by itself.

What a visitor gets today:

| Host | What this repo does |
| --- | --- |
| `https://motorhomepower.co.uk` | App 301s. `/`, `/index.html`, and any path with no file go to `https://motorhometools.co.uk/power/`. `/battery.html`, `/solar.html`, `/inverter.html`, and `/wire.html` go to the same path under `/power/`. |
| `https://power-tool.onrender.com` | Same 301 map. The Render service is `power-tool`. `render.yaml` still says `name: power-tools`. Do not rename it here. |
| `https://motorhometools.co.uk/power` | The live calculators. Source is `warobbo/motorhometools` `power/`, not this checkout. |

`www.motorhomepower.co.uk` first 301s to the apex. Plain `http://` first 301s to `https://`. Those hops are the host edge, not `_redirects`.

Files that exist in the publish root stay **200** and skip the catch-all. Today that includes `README.md`, `render.yaml`, `_redirects`, `tests/seo.test.js`, `.gitignore`, and the files under `.cursor/skills/verify-power/` (dot paths are published). Adding `index.html`, a calculator page, `robots.txt`, or `assets/` back would hide the 301.

The maths is not in this repo. `helpers/drive-calculator.js` loads the `calc.js` the live page actually requested and recomputes. If that script disagrees with the formula in the feature file, the drive fails. Do not type in a Wh, Ah, watt, or mm² figure from memory.

Update this feature map in the same pull request whenever a build changes pages or tools. A weekly maintain pass also runs on Mondays, as part of Freddie the Font2's routine. That pass edits only this verify folder, opens at most one pull request through the review loop, and stays quiet unless it is blocked.

Two runs can proceed at once. Give each its own `POWER_VERIFY_RUN`. They bind different ports and do not share a Chrome profile. Do not drive a server this run did not start.

## Launch

From the repo root, in its own terminal:

```bash
POWER_VERIFY_RUN=local node .cursor/skills/verify-power/helpers/serve.js
```

Ready signal: a line `ready http://127.0.0.1:<port> run=local`. The process stays in the foreground. It listens on `127.0.0.1` only and writes `/tmp/verify-power/local/instance.json`.

The server reads `_redirects`. If a real file exists at the path, it returns 200. Otherwise it returns the file's 301 and keeps the query string. A trailing slash is stripped before the match, so `/battery.html/` follows `/battery.html`. Response header `X-Power-Verify: local-redirect` marks the process.

Stop that process with Cleanup. Do not start a second server with the same `POWER_VERIFY_RUN` while the pid is alive.

## Doctor

```bash
POWER_VERIFY_RUN=local node .cursor/skills/verify-power/helpers/doctor.js --evidence
```

Read-only. Exit 0 means the local server is worth driving: the pid is the `serve.js` this run started, `/` answers on loopback with `X-Power-Verify`, calculator HTML is absent, `node tests/seo.test.js` passes, `_redirects` matches `render.yaml`, and the local 301/200 table matches the feature map.

The same command then checks the live https hosts. A wrong live 301 fails the doctor. `www` and plain `http` are printed as edge hops. If plain `http` cannot be measured, the line says `UNMEASURED` and does not by itself fail a good https map.

Run doctor again after a failed drive before driving anything else.

## Drive

Harness name: `verify-power`. Prefer ids, labels, and `data-*` attributes over coordinates.

Redirect map, no browser:

```bash
POWER_VERIFY_RUN=local node .cursor/skills/verify-power/helpers/drive-redirects.js
```

One calculator. The browser starts at the local 301, follows it, and only then types. Chrome uses a fresh user-data directory for that run, 1280×900, so the phone landscape gate stays hidden.

```bash
POWER_VERIFY_RUN=local node .cursor/skills/verify-power/helpers/drive-calculator.js daily
POWER_VERIFY_RUN=local node .cursor/skills/verify-power/helpers/drive-calculator.js battery
POWER_VERIFY_RUN=local node .cursor/skills/verify-power/helpers/drive-calculator.js solar
POWER_VERIFY_RUN=local node .cursor/skills/verify-power/helpers/drive-calculator.js inverter
POWER_VERIFY_RUN=local node .cursor/skills/verify-power/helpers/drive-calculator.js wire
```

`helpers/browser.js` and `helpers/lib.js` are required by those commands. Do not run them on their own.

The feature map lists every entry point. Driving one calculator does not cover the others.

## Evidence

Proof goes to `.cursor/skills/verify-power/evidence/<POWER_VERIFY_RUN>/`. Cleanup does not delete that directory.

| File | What it proves |
| --- | --- |
| `doctor.txt` | Local health check and live 301 sample |
| `redirects.json` | Status and `Location` for each mapped path |
| `<tool>.json` | Redirect followed, `calc.js` URL and sha256, INPUT, formula result, EXPECTED display text, ACTUAL display text, and `stored` (the saved `powertools.systemProfile` row) |
| `<tool>.png` | Full page after the inputs were typed |

A proof shows the action and the result. For a calculator, the JSON must contain the typed input and the totals, and the saved `powertools.systemProfile` row when that tool writes one. A screenshot of the finished page with no record of what was typed is not enough.

The drive uses the public calculator. It does not post a form, send email, or call a payment endpoint. The only write is `localStorage` inside the throwaway Chrome profile, which Cleanup deletes.

## Cleanup

```bash
POWER_VERIFY_RUN=local node .cursor/skills/verify-power/helpers/cleanup.js
```

This sends `SIGTERM` only to the recorded `serve.js` pid, and to a Chrome pid recorded for that same run whose command line contains `/tmp/verify-power/local`. It then removes `/tmp/verify-power/local`. It does not kill by process name. Evidence under `.cursor/skills/verify-power/evidence/local/` stays.

If a drive crashes, run Cleanup before starting another attempt with the same run id. `drive-calculator.js` closes its own Chrome when it finishes, including when the assertion fails.

## Helpers

| Command | Role |
| --- | --- |
| `node .cursor/skills/verify-power/helpers/serve.js` | Start the local 301 server |
| `node .cursor/skills/verify-power/helpers/doctor.js --evidence` | Decide whether that server is worth driving |
| `node .cursor/skills/verify-power/helpers/drive-redirects.js` | Check every redirect and published-file path |
| `node .cursor/skills/verify-power/helpers/drive-calculator.js <daily\|battery\|solar\|inverter\|wire>` | Follow one 301 and run that calculator case |
| `node .cursor/skills/verify-power/helpers/cleanup.js` | Stop the recorded processes and keep the evidence |

Set `POWER_VERIFY_RUN` on every command. `CHROME_PATH` overrides the Chrome binary. The default is `google-chrome`.
