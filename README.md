# Power Tools

`https://motorhomepower.co.uk` and `https://power-tool.onrender.com` permanently redirect to the Power calculators on [Motorhome Tools](https://motorhometools.co.uk/power/).

Redirects are configured in the Render Dashboard on the **power-tool** service (**Redirects/Rewrites**, action **Redirect**). This repo does not publish HTML at those paths, so those rules return **HTTP 301**. A git deploy publishes files only. It does not apply `render.yaml` routes by itself.

| Request | Destination |
| --- | --- |
| `/` and `/index.html` | `https://motorhometools.co.uk/power/` |
| `/battery.html` | `https://motorhometools.co.uk/power/battery.html` |
| `/solar.html` | `https://motorhometools.co.uk/power/solar.html` |
| `/inverter.html` | `https://motorhometools.co.uk/power/inverter.html` |
| `/wire.html` | `https://motorhometools.co.uk/power/wire.html` |
| any other path (`/*`) | `https://motorhometools.co.uk/power/` |

Render skips a redirect when a file already exists at that path. Do not add `index.html`, the calculator HTML files, `robots.txt`, or `assets/` back into the publish root. Files that remain (`README.md`, `render.yaml`, `_redirects`, `tests/seo.test.js`) are served as files, so `/*` does not cover those exact paths.

`_redirects` repeats the same map for hosts that read it. Render does not.

The custom domain `motorhomepower.co.uk` stays attached on the Render service. This repo does not change DNS.

## Check

```bash
curl -sI https://motorhomepower.co.uk/
curl -sI https://motorhomepower.co.uk/index.html
curl -sI https://motorhomepower.co.uk/battery.html
curl -sI https://motorhomepower.co.uk/solar.html
curl -sI https://motorhomepower.co.uk/inverter.html
curl -sI https://motorhomepower.co.uk/wire.html
curl -sI https://power-tool.onrender.com/
curl -sI https://power-tool.onrender.com/does-not-exist
```

Each of those should be **301** with a `Location` header pointing at the hub URL in the table. `/` and `/index.html` go to `https://motorhometools.co.uk/power/`.

## Tests

```bash
node tests/seo.test.js
```
