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

test("service identity and publish root are unchanged", function () {
  assert.ok(yaml.indexOf("name: power-tools") !== -1, "service name changed");
  assert.ok(yaml.indexOf("runtime: static") !== -1, "runtime changed");
  assert.ok(yaml.indexOf("staticPublishPath: .") !== -1, "publish path changed");
});

if (failed) {
  console.error("\n" + failed + " test(s) failed");
  process.exit(1);
}

console.log("\nAll tests passed");
