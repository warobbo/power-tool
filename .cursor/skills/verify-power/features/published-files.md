# Published files

A path that matches a real file is served as that file. The catch-all 301 does not apply to it.

## Sub-features

- `file-readme` serves `README.md` as 200.
- `file-blueprint` serves `render.yaml` as 200.
- `file-redirects` serves `_redirects` as 200.
- `file-test` serves `tests/seo.test.js` as 200.

## How to get to it (user POV)

- Open `/README.md`, `/render.yaml`, `/_redirects`, or `/tests/seo.test.js` on `https://motorhomepower.co.uk` or `https://power-tool.onrender.com`.
- There is no link to these from the calculator. They are what a request hits when the file is in the publish root (`staticPublishPath: .`).

## Driving it with verify-power

Preconditions:

- `doctor.js` has passed.
- Those four paths exist in the checkout and the calculator HTML files do not.

- **Files stay 200.** Run `node .cursor/skills/verify-power/helpers/drive-redirects.js`. Each of `/README.md`, `/render.yaml`, `/_redirects`, and `/tests/seo.test.js` is status 200 with an empty `Location`.
- **Live README.** `doctor.js` also requests `https://motorhomepower.co.uk/README.md` and requires 200.
- **Proof.** The 200 rows are in `evidence/<run>/redirects.json`.

## Gotchas

- Any new file committed into the publish root becomes a 200 URL after deploy, including files under `.cursor/` if the host publishes dot directories. That was not measured on the live host before this skill existed. Calculator paths are unchanged only while those HTML files stay absent.
- `render.yaml` header rules (`X-Robots-Tag`, `Cache-Control`) apply after a Blueprint sync. A live `README.md` response checked on 12 Oct 2026 did not include `X-Robots-Tag`. Do not treat the header block as proved behaviour.
- Serving the file is the bug if the path was supposed to 301. The fix is to remove the file, not to add another redirect on top of it.
