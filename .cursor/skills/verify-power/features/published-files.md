# Published files

A path in `scripts/published-files.txt` is copied into `public/` and served as that file. The catch-all 301 does not apply to it.

Dotfiles and `.cursor/` are not in that list. `/.gitignore` and `/.cursor/skills/verify-power/SKILL.md` are not files on the publish host, so they follow the catch-all 301 to `https://motorhometools.co.uk/power/`. A query string is kept. Serving either path as 200 is an exposure.

## Sub-features

- `file-readme` serves `README.md` as 200.
- `file-blueprint` serves `render.yaml` as 200.
- `file-redirects` serves `_redirects` as 200.
- `file-test` serves `tests/seo.test.js` as 200.
- `hidden-gitignore` does not serve `.gitignore`. Status is 301 to the hub, not 200.
- `hidden-skill` does not serve `.cursor/skills/verify-power/SKILL.md`. Status is 301 to the hub, not 200. That path stands in for the rest of `.cursor/`.

## How to get to it (user POV)

- Open `/README.md`, `/render.yaml`, `/_redirects`, or `/tests/seo.test.js` on `https://motorhomepower.co.uk` or `https://power-tool.onrender.com`.
- There is no link to these from the calculator. They are the allowlist copied into the publish directory (`staticPublishPath: public`).
- `/.gitignore` and `/.cursor/skills/verify-power/SKILL.md` are the same kind of request as an unknown path. They 301 to the hub.

## Driving it with verify-power

Preconditions:

- `doctor.js` has passed.
- The four allowlist paths exist in the checkout. The calculator HTML files do not. `.gitignore` and `.cursor/` may exist in the checkout; they are still not published.

- **Files stay 200.** Run `node .cursor/skills/verify-power/helpers/drive-redirects.js`. Each of `/README.md`, `/render.yaml`, `/_redirects`, and `/tests/seo.test.js` is status 200 with an empty `Location`.
- **Hidden paths are not 200.** The same command checks `/.gitignore`, `/.cursor/skills/verify-power/SKILL.md`, and `/.gitignore?x=1`. Each is 301 to the hub. The query string is kept on the last one.
- **Live files.** `doctor.js` requests the four allowlist paths on `https://motorhomepower.co.uk` and `https://power-tool.onrender.com` and requires 200. It requires 301, not 200, for the hidden paths on both hosts.
- **Proof.** The 200 rows and the hidden 301 rows are in `evidence/<run>/redirects.json`.

## Gotchas

- Render skips a redirect when a file exists at that path. A redirect rule cannot hide `.gitignore` or `.cursor/` while those files are in the publish directory. The fix is to leave them out of `public/`.
- `scripts/publish-public.sh` is the only writer of `public/`. The live **power-tool** service has to run that build and publish `public`. A git push does not change the service's saved build command or publish directory by itself.
- Any new file added to `scripts/published-files.txt` becomes a 200 URL after that publish directory is what the service deploys. Calculator paths are unchanged only while those HTML files stay off the list.
- `render.yaml` header rules (`X-Robots-Tag`, `Cache-Control`) apply after a Blueprint sync. A live `README.md` response checked on 12 Oct 2026 did not include `X-Robots-Tag`. Do not treat the header block as proved behaviour.
- Serving the file is the bug if the path was supposed to 301. The fix is to remove the file from the publish directory, not to add another redirect on top of it.
