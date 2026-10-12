#!/usr/bin/env node
"use strict";

var assert = require("assert");
var fs = require("fs");
var path = require("path");

var failed = 0;
var root = path.join(__dirname, "..");
var pages = [
  {
    sources: ["/", "/index.html"],
    dest: "https://motorhometools.co.uk/power/",
  },
  {
    sources: ["/battery.html"],
    dest: "https://motorhometools.co.uk/power/battery.html",
  },
  {
    sources: ["/solar.html"],
    dest: "https://motorhometools.co.uk/power/solar.html",
  },
  {
    sources: ["/inverter.html"],
    dest: "https://motorhometools.co.uk/power/inverter.html",
  },
  {
    sources: ["/wire.html"],
    dest: "https://motorhometools.co.uk/power/wire.html",
  },
];

var publishedStubs = [
  "index.html",
  "battery.html",
  "solar.html",
  "inverter.html",
  "wire.html",
  "robots.txt",
  "sitemap.xml",
  "_headers",
];

function test(name, fn) {
  try {
    fn();
    console.log("ok  - " + name);
  } catch (err) {
    failed += 1;
    console.error("fail - " + name);
    console.error("      " + err.message);
  }
}

function load(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

var yaml = load("render.yaml");
var redirectsFile = load("_redirects");

test("no HTML or other stub files are published over the 301s", function () {
  publishedStubs.forEach(function (file) {
    assert.ok(
      !fs.existsSync(path.join(root, file)),
      file + " would return 200 and skip the dashboard redirect"
    );
  });
  var html = fs.readdirSync(root).filter(function (name) {
    return name.slice(-5) === ".html";
  });
  assert.deepStrictEqual(html, []);
});

test("calculator assets are not published", function () {
  assert.ok(
    !fs.existsSync(path.join(root, "assets")),
    "assets/ would be served as 200 and skip the /* redirect"
  );
});

pages.forEach(function (page) {
  page.sources.forEach(function (source) {
    test("render.yaml 301 " + source + " → " + page.dest, function () {
      var block = "source: " + source + "\n        destination: " + page.dest;
      assert.ok(yaml.indexOf(block) !== -1, "missing route\n" + block);
    });

    test("_redirects 301 " + source + " → " + page.dest, function () {
      var line = source + "  " + page.dest + "  301";
      assert.ok(redirectsFile.indexOf(line) !== -1, "missing " + line);
    });
  });
});

test("render.yaml catch-all 301s unknown paths to the hub Power page", function () {
  assert.ok(
    yaml.indexOf("source: /*\n        destination: https://motorhometools.co.uk/power/") !== -1,
    "missing /* redirect"
  );
  assert.ok(
    redirectsFile.indexOf("/*  https://motorhometools.co.uk/power/  301") !== -1,
    "missing _redirects catch-all"
  );
});

test("specific paths are listed before the catch-all", function () {
  var catchAll = yaml.indexOf("source: /*");
  ["/", "/index.html", "/battery.html", "/solar.html", "/inverter.html", "/wire.html"].forEach(function (source) {
    var at = yaml.indexOf("source: " + source + "\n");
    assert.ok(at !== -1 && at < catchAll, source + " must come before /*");
  });
});

test("service identity stays power-tools and publish dir is the public allowlist", function () {
  assert.ok(yaml.indexOf("name: power-tools") !== -1, "service name changed");
  assert.ok(yaml.indexOf("runtime: static") !== -1, "runtime changed");
  assert.ok(yaml.indexOf("staticPublishPath: public") !== -1, "publish path must be public");
  assert.ok(
    yaml.indexOf("buildCommand: bash scripts/publish-public.sh") !== -1,
    "build command must assemble public/"
  );
});

test("publish script copies only the allowlist and no hidden paths", function () {
  var spawn = require("child_process").spawnSync;
  var pub = path.join(root, "public");
  fs.rmSync(pub, { recursive: true, force: true });
  var result = spawn("bash", ["scripts/publish-public.sh"], { cwd: root, encoding: "utf8" });
  assert.strictEqual(result.status, 0, (result.stderr || "") + (result.stdout || ""));
  var list = fs
    .readFileSync(path.join(root, "scripts", "published-files.txt"), "utf8")
    .split(/\n/)
    .map(function (line) {
      return line.trim();
    })
    .filter(function (line) {
      return line && line.charAt(0) !== "#";
    });
  function walk(dir, acc) {
    fs.readdirSync(dir).forEach(function (name) {
      assert.ok(name.charAt(0) !== ".", "hidden path in publish tree: " + name);
      var full = path.join(dir, name);
      if (fs.statSync(full).isDirectory()) walk(full, acc);
      else acc.push(path.relative(pub, full).split(path.sep).join("/"));
    });
  }
  var found = [];
  walk(pub, found);
  found.sort();
  var expect = list.slice().sort();
  assert.deepStrictEqual(found, expect);
  list.forEach(function (rel) {
    assert.ok(
      fs.readFileSync(path.join(pub, rel)).equals(fs.readFileSync(path.join(root, rel))),
      rel + " in public/ does not match the source"
    );
  });
  assert.ok(!fs.existsSync(path.join(pub, ".gitignore")), ".gitignore was published");
  assert.ok(!fs.existsSync(path.join(pub, ".cursor")), ".cursor was published");
  fs.rmSync(pub, { recursive: true, force: true });
});

if (failed) {
  console.error("\n" + failed + " test(s) failed");
  process.exit(1);
}

console.log("\nAll tests passed");
