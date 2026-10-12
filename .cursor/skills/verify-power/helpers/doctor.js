#!/usr/bin/env node
"use strict";

const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const lib = require("./lib");

const writeEvidence = process.argv.indexOf("--evidence") !== -1;
const lines = [];

function say(line) {
  lines.push(line);
  console.log(line);
}

function fail(line) {
  say("FAIL " + line);
  return false;
}

async function main() {
  let ok = true;
  const instance = lib.requireInstance();
  say("instance " + instance.baseUrl + " pid=" + instance.pid + " run=" + instance.runId);
  if (instance.baseUrl.indexOf("http://127.0.0.1:") !== 0) {
    ok = fail("base URL is not a loopback verify server") && ok;
  }

  const rootProbe = await lib.requestOnce(instance.baseUrl + "/");
  if (rootProbe.verify !== "local-redirect") {
    ok = fail("missing X-Power-Verify on " + instance.baseUrl) && ok;
  } else {
    say("ok  local server identifies itself");
  }

  const stubs = ["index.html", "battery.html", "solar.html", "inverter.html", "wire.html", "robots.txt", "assets"];
  let stubsClear = true;
  stubs.forEach(function (name) {
    if (fs.existsSync(path.join(lib.REPO_ROOT, name))) {
      stubsClear = false;
      ok = fail(name + " is in the publish root and would skip the 301") && ok;
    }
  });
  if (stubsClear) say("ok  calculator HTML is not in this checkout");

  const seo = spawnSync(process.execPath, ["tests/seo.test.js"], {
    cwd: lib.REPO_ROOT,
    encoding: "utf8",
  });
  if (seo.status !== 0) {
    ok = fail("node tests/seo.test.js exited " + seo.status) && ok;
    say(seo.stdout || "");
    say(seo.stderr || "");
  } else {
    say("ok  node tests/seo.test.js");
  }

  const redirects = lib.loadRedirects();
  const yaml = fs.readFileSync(path.join(lib.REPO_ROOT, "render.yaml"), "utf8");
  const yamlRoutes = lib.routesFromRenderYaml(yaml);
  let routesMatch = true;
  redirects.forEach(function (rule) {
    const found = yamlRoutes.some(function (route) {
      return route.source === rule.source && route.destination === rule.destination;
    });
    if (!found || rule.status !== 301) {
      routesMatch = false;
      ok = fail("_redirects and render.yaml disagree on " + rule.source) && ok;
    }
  });
  yamlRoutes.forEach(function (route) {
    const found = redirects.some(function (rule) {
      return rule.source === route.source && rule.destination === route.destination && rule.status === 301;
    });
    if (!found) {
      routesMatch = false;
      ok = fail("render.yaml route " + route.source + " is not a 301 in _redirects") && ok;
    }
  });
  if (routesMatch) say("ok  _redirects matches render.yaml destinations");

  for (const item of lib.REDIRECT_CASES) {
    const response = await lib.requestOnce(instance.baseUrl + item.path);
    if (response.status !== 301 || response.location !== item.location) {
      ok =
        fail(item.path + " -> " + response.status + " " + response.location + " (wanted 301 " + item.location + ")") &&
        ok;
    } else {
      say("ok  301 " + item.path);
    }
  }

  for (const filePath of lib.FILE_CASES) {
    const response = await lib.requestOnce(instance.baseUrl + filePath);
    if (response.status !== 200) {
      ok = fail(filePath + " status " + response.status + " (a real file must stay 200)") && ok;
    } else {
      say("ok  200 " + filePath);
    }
  }

  say("--- live hosts (not this process) ---");
  const liveBases = ["https://motorhomepower.co.uk", "https://power-tool.onrender.com"];
  for (const base of liveBases) {
    for (const item of lib.REDIRECT_CASES) {
      if (item.path === "/battery.html/" || item.path === "/battery.html?x=1") continue;
      try {
        const response = await lib.requestOnce(base + item.path);
        if (response.status !== 301 || response.location !== item.location) {
          ok =
            fail(
              base + item.path + " -> " + response.status + " " + response.location + " (wanted 301 " + item.location + ")"
            ) && ok;
        } else {
          say("ok  live 301 " + base + item.path);
        }
      } catch (err) {
        ok = fail("live " + base + item.path + " " + err.message) && ok;
      }
    }
  }

  try {
    const query = await lib.requestOnce("https://motorhomepower.co.uk/battery.html?x=1");
    if (query.status === 301 && query.location === "https://motorhometools.co.uk/power/battery.html?x=1") {
      say("ok  live query string kept on /battery.html");
    } else {
      ok = fail("live query redirect " + query.status + " " + query.location) && ok;
    }
  } catch (err) {
    ok = fail("live query redirect " + err.message) && ok;
  }

  try {
    const readme = await lib.requestOnce("https://motorhomepower.co.uk/README.md");
    if (readme.status === 200) say("ok  live README.md stays 200");
    else ok = fail("live README.md status " + readme.status) && ok;
  } catch (err) {
    ok = fail("live README.md " + err.message) && ok;
  }

  try {
    const www = await lib.requestOnce("https://www.motorhomepower.co.uk/");
    say(
      "edge www " +
        www.status +
        " " +
        www.location +
        " (first hop is the host edge, then the apex 301s to the hub)"
    );
  } catch (err) {
    say("edge www UNMEASURED " + err.message);
  }

  try {
    const plain = await lib.requestOnce("http://motorhomepower.co.uk/");
    say("edge http " + plain.status + " " + plain.location + " (TLS hop, then the app 301)");
  } catch (err) {
    say("edge http UNMEASURED " + err.message);
  }

  if (writeEvidence) {
    const evidence = lib.evidenceDir(instance.runId);
    fs.mkdirSync(evidence, { recursive: true });
    fs.writeFileSync(path.join(evidence, "doctor.txt"), lines.join("\n") + "\n");
    say("evidence " + path.join(evidence, "doctor.txt"));
  }

  if (!ok) process.exit(1);
  say("doctor ok");
}

main().catch(function (err) {
  console.error(err.message || err);
  process.exit(1);
});
