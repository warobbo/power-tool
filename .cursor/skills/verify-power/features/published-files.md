# Published files

A path in `scripts/published-files.txt` is copied into `public/` and served as that file. The catch-all 301 does not apply to it.

`README.md` and `render.yaml` stay in the git checkout. They are not on the allowlist, so `/README.md` and `/render.yaml` are not files on the publish host and follow the catch-all 301 to `https://motorhometools.co.uk/power/`. A query string is kept. Serving either path as 200 publishes the checkout notes.

Dotfiles and `.cursor/` are not on the allowlist either. `/.gitignore` and `/.cursor/skills/verify-power/SKILL.md` follow the same catch-all 301. Serving either path as 200 is an exposure.

## Sub-features

- `file-redirects` serves `_redirects` as 200.
- `file-test` serves `tests/seo.test.js` as 200.
- `withheld-readme` does not serve `README.md`. Status is 301 to the hub, not 200.
- `withheld-blueprint` does not serve `render.yaml`. Status is 301 to the hub, not 200.
- `hidden-gitignore` does not serve `.gitignore`. Status is 301 to the hub, not 200.
- `hidden-skill` does not serve `.cursor/skills/verify-power/SKILL.md`. Status is 301 to the hub, not 200. That path stands in for the rest of `.cursor/`.

## How to get to it (user POV)

- Open `/_redirects` or `/tests/seo.test.js` on `https://motorhomepower.co.uk` or `https://power-tool.onrender.com`.
- There is no link to these from the calculator. They are the allowlist copied into the publish directory (`staticPublishPath: public`).
- `/README.md` and `/render.yaml` are the same kind of request as an unknown path. They 301 to the hub.
- `/.gitignore` and `/.cursor/skills/verify-power/SKILL.md` 301 to the hub.

## Driving it with verify-power

Preconditions:

- `doctor.js` has passed.
- `_redirects` and `tests/seo.test.js` exist in the checkout. `README.md` and `render.yaml` may exist in the checkout; they are still not published. The calculator HTML files do not. `.gitignore` and `.cursor/` may exist in the checkout; they are still not published.

- **Files stay 200.** Run `node .cursor/skills/verify-power/helpers/drive-redirects.js`. `/_redirects` and `/tests/seo.test.js` are status 200 with an empty `Location`.
- **Withheld docs are not 200.** The same command checks `/README.md`, `/render.yaml`, and `/README.md?x=1`. Each is 301 to the hub. The query string is kept on the last one.
- **Hidden paths are not 200.** The same command checks `/.gitignore`, `/.cursor/skills/verify-power/SKILL.md`, and `/.gitignore?x=1`. Each is 301 to the hub. The query string is kept on the last one.
- **Live files.** `doctor.js` requests the allowlist paths on `https://motorhomepower.co.uk` and `https://power-tool.onrender.com` and requires 200. It requires 301, not 200, for the withheld docs and the hidden paths on both hosts. It reads each allowlist body, local and live, and fails if an owner name or an email address is present.
- **Proof.** The 200 rows, the withheld 301 rows, and the hidden 301 rows are in `evidence/<run>/redirects.json`.

## Gotchas

- Render skips a redirect when a file exists at that path. A redirect rule cannot hide `README.md`, `render.yaml`, `.gitignore`, or `.cursor/` while those files are in the publish directory. The fix is to leave them out of `public/`.
- `scripts/publish-public.sh` is the only writer of `public/`. The live **power-tool** service has to run that build and publish `public`. A git push does not change the service's saved build command or publish directory by itself.
- Any new file added to `scripts/published-files.txt` becomes a 200 URL after that publish directory is what the service deploys. Calculator paths are unchanged only while those HTML files stay off the list.
- `render.yaml` header rules (`X-Robots-Tag`, `Cache-Control`) apply after a Blueprint sync. Do not treat the header block as proved behaviour.
- Serving the file is the bug if the path was supposed to 301. The fix is to remove the file from the publish directory, not to add another redirect on top of it.
