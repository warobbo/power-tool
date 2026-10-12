"use strict";

const fs = require("fs");
const http = require("http");
const https = require("https");
const path = require("path");

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..", "..");
const SKILL_ROOT = path.join(REPO_ROOT, ".cursor", "skills", "verify-power");
const TMP_ROOT = "/tmp/verify-power";

const REDIRECT_CASES = [
  { path: "/", location: "https://motorhometools.co.uk/power/" },
  { path: "/index.html", location: "https://motorhometools.co.uk/power/" },
  { path: "/battery.html", location: "https://motorhometools.co.uk/power/battery.html" },
  { path: "/solar.html", location: "https://motorhometools.co.uk/power/solar.html" },
  { path: "/inverter.html", location: "https://motorhometools.co.uk/power/inverter.html" },
  { path: "/wire.html", location: "https://motorhometools.co.uk/power/wire.html" },
  { path: "/does-not-exist", location: "https://motorhometools.co.uk/power/" },
  { path: "/battery.html?x=1", location: "https://motorhometools.co.uk/power/battery.html?x=1" },
  { path: "/battery.html/", location: "https://motorhometools.co.uk/power/battery.html" },
];

const FILE_CASES = [
  "/README.md",
  "/render.yaml",
  "/_redirects",
  "/tests/seo.test.js",
  "/.gitignore",
  "/.cursor/skills/verify-power/SKILL.md",
];

function runId() {
  return process.env.POWER_VERIFY_RUN || "local";
}

function runDir(id) {
  return path.join(TMP_ROOT, id || runId());
}

function evidenceDir(id) {
  return path.join(SKILL_ROOT, "evidence", id || runId());
}

function instancePath(id) {
  return path.join(runDir(id), "instance.json");
}

function parseRedirects(text) {
  return text
    .split(/\r?\n/)
    .map(function (line) {
      return line.trim();
    })
    .filter(function (line) {
      return line && line.charAt(0) !== "#";
    })
    .map(function (line) {
      const parts = line.split(/\s+/);
      if (parts.length < 3) {
        throw new Error("Bad _redirects line: " + line);
      }
      return { source: parts[0], destination: parts[1], status: Number(parts[2]) };
    });
}

function loadRedirects() {
  return parseRedirects(fs.readFileSync(path.join(REPO_ROOT, "_redirects"), "utf8"));
}

function routesFromRenderYaml(text) {
  const routes = [];
  const re = /source:\s*(\S+)\n\s*destination:\s*(\S+)/g;
  let match;
  while ((match = re.exec(text))) {
    routes.push({ source: match[1], destination: match[2] });
  }
  return routes;
}

function pidAlive(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return false;
  }
}

function cmdline(pid) {
  try {
    return fs.readFileSync("/proc/" + pid + "/cmdline", "utf8");
  } catch (err) {
    return "";
  }
}

function readInstance(id) {
  const file = instancePath(id);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function listLiveInstances() {
  if (!fs.existsSync(TMP_ROOT)) return [];
  return fs
    .readdirSync(TMP_ROOT)
    .map(function (name) {
      return readInstance(name);
    })
    .filter(function (instance) {
      return instance && pidAlive(instance.pid) && cmdline(instance.pid).indexOf("serve.js") !== -1;
    });
}

function requireInstance() {
  const id = process.env.POWER_VERIFY_RUN;
  if (id) {
    const instance = readInstance(id);
    if (!instance) {
      throw new Error("No instance for POWER_VERIFY_RUN=" + id + ". Start serve.js first.");
    }
    if (!pidAlive(instance.pid) || cmdline(instance.pid).indexOf("serve.js") === -1) {
      throw new Error("Instance " + id + " is not running (pid " + instance.pid + ").");
    }
    return instance;
  }
  const live = listLiveInstances();
  if (live.length === 1) return live[0];
  if (live.length === 0) {
    throw new Error("No verify-power server is running. Start helpers/serve.js first.");
  }
  throw new Error(
    "More than one verify-power server is running. Set POWER_VERIFY_RUN to one of: " +
      live
        .map(function (item) {
          return item.runId;
        })
        .join(", ")
  );
}

function requestOnce(urlString) {
  const url = new URL(urlString);
  const lib = url.protocol === "https:" ? https : http;
  return new Promise(function (resolve, reject) {
    const req = lib.request(
      url,
      { method: "GET", headers: { "User-Agent": "verify-power" } },
      function (res) {
        res.resume();
        res.on("end", function () {
          resolve({
            status: res.statusCode,
            location: res.headers.location || "",
            verify: res.headers["x-power-verify"] || "",
            contentType: res.headers["content-type"] || "",
          });
        });
      }
    );
    req.setTimeout(20000, function () {
      req.destroy(new Error("timeout " + urlString));
    });
    req.on("error", reject);
    req.end();
  });
}

function normalisePath(urlPath) {
  const hash = urlPath.indexOf("#");
  const withoutHash = hash === -1 ? urlPath : urlPath.slice(0, hash);
  const q = withoutHash.indexOf("?");
  const pathname = q === -1 ? withoutHash : withoutHash.slice(0, q);
  const search = q === -1 ? "" : withoutHash.slice(q);
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch (err) {
    return null;
  }
  if (decoded.indexOf("\0") !== -1) return null;
  let stripped = decoded;
  if (stripped.length > 1 && stripped.endsWith("/")) stripped = stripped.slice(0, -1);
  return { pathname: stripped, search: search };
}

function publishedFile(pathname) {
  const rel = pathname.replace(/^\/+/, "");
  if (!rel) return null;
  const parts = rel.split("/");
  if (
    parts.some(function (part) {
      return !part || part === "." || part === ".." || part === ".git";
    })
  ) {
    return null;
  }
  const full = path.resolve(REPO_ROOT, rel);
  if (full !== REPO_ROOT && !full.startsWith(REPO_ROOT + path.sep)) return null;
  if (!fs.existsSync(full) || !fs.statSync(full).isFile()) return null;
  return full;
}

function contentType(file) {
  const ext = path.extname(file);
  const types = {
    ".md": "text/markdown; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".yaml": "text/yaml; charset=utf-8",
    ".yml": "text/yaml; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".txt": "text/plain; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".css": "text/css; charset=utf-8",
  };
  return types[ext] || "application/octet-stream";
}

function matchRedirect(pathname, rules) {
  for (let i = 0; i < rules.length; i += 1) {
    const rule = rules[i];
    if (rule.source === "/*") return rule;
    if (rule.source === pathname) return rule;
  }
  return null;
}

function killIfMatches(pid, marker) {
  if (!pid || !pidAlive(pid)) return false;
  const line = cmdline(pid);
  if (line.indexOf(marker) === -1) {
    throw new Error("Refusing to kill pid " + pid + " because its command does not contain " + marker);
  }
  process.kill(pid, "SIGTERM");
  return true;
}

module.exports = {
  REPO_ROOT: REPO_ROOT,
  SKILL_ROOT: SKILL_ROOT,
  REDIRECT_CASES: REDIRECT_CASES,
  FILE_CASES: FILE_CASES,
  runId: runId,
  runDir: runDir,
  evidenceDir: evidenceDir,
  instancePath: instancePath,
  loadRedirects: loadRedirects,
  routesFromRenderYaml: routesFromRenderYaml,
  pidAlive: pidAlive,
  cmdline: cmdline,
  readInstance: readInstance,
  requireInstance: requireInstance,
  requestOnce: requestOnce,
  normalisePath: normalisePath,
  publishedFile: publishedFile,
  contentType: contentType,
  matchRedirect: matchRedirect,
  killIfMatches: killIfMatches,
};
