#!/usr/bin/env node
"use strict";

var assert = require("assert");
var fs = require("fs");
var path = require("path");

var failed = 0;
var root = path.join(__dirname, "..");
var pages = [
  {
    file: "index.html",
    dest: "https://motorhometools.co.uk/power/",
    sources: ["/", "/index.html"],
  },
  {
    file: "battery.html",
    dest: "https://motorhometools.co.uk/power/battery.html",
    sources: ["/battery.html"],
  },
  {
    file: "solar.html",
    dest: "https://motorhometools.co.uk/power/solar.html",
    sources: ["/solar.html"],
  },
  {
    file: "inverter.html",
    dest: "https://motorhometools.co.uk/power/inverter.html",
    sources: ["/inverter.html"],
  },
  {
    file: "wire.html",
    dest: "https://motorhometools.co.uk/power/wire.html",
    sources: ["/wire.html"],
  },
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

function decode(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"');
}

function attr(html, tag, name) {
  var escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  var re = new RegExp("<" + tag + "\\b[^>]*\\s(?:name|property|rel|href)=[\"']" + escaped + "[\"'][^>]*>", "i");
  var tagMatch = html.match(re);
  if (!tagMatch) {
    re = new RegExp("<" + tag + "\\b[^>]*\\s(?:name|property|rel)=[\"']" + escaped + "[\"'][^>]*>", "i");
    tagMatch = html.match(re);
  }
  if (!tagMatch) return null;
  var content = tagMatch[0].match(/\s(?:content|href)=["']([^"']*)["']/i);
  return content ? decode(content[1]) : null;
}

function load(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

var yaml = load("render.yaml");
var redirectsFile = load("_redirects");

pages.forEach(function (page) {
  test(page.file + " is a noindex client redirect to the hub", function () {
    var html = load(page.file);
    assert.strictEqual(attr(html, "meta", "robots"), "noindex");
    assert.strictEqual(attr(html, "link", "canonical"), page.dest);
    assert.ok(
      html.indexOf('http-equiv="refresh" content="0;url=' + page.dest + '"') !== -1,
      "missing meta refresh to " + page.dest
    );
    assert.ok(
      html.indexOf('location.replace("' + page.dest + '" + location.search + location.hash)') !== -1,
      "missing location.replace that keeps search and hash"
    );
    assert.ok(
      html.indexOf('href="' + page.dest + '"') !== -1,
      "missing fallback link"
    );
    assert.ok(!/content=["']index,follow["']/i.test(html), "page must not ask to be indexed");
  });

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

test("HTML stubs and robots.txt must revalidate instead of s-maxage", function () {
  var headersFile = load("_headers");
  ["/*.html", "/", "/index.html", "/robots.txt"].forEach(function (pathRule) {
    assert.ok(
      headersFile.indexOf(pathRule + "\n  Cache-Control: public, max-age=0, must-revalidate") !== -1,
      "missing _headers rule for " + pathRule
    );
    assert.ok(
      yaml.indexOf("path: " + pathRule + "\n        name: Cache-Control\n        value: public, max-age=0, must-revalidate") !== -1,
      "missing render.yaml Cache-Control for " + pathRule
    );
  });
  assert.ok(load("battery.html").indexOf("<!-- cache-bust 2026-09-23b -->") !== -1);
});

test("robots.txt asks crawlers to stay off the old host", function () {
  var robots = load("robots.txt");
  assert.ok(/Disallow:\s*\//.test(robots), "missing Disallow: /");
  assert.ok(!/Sitemap:/i.test(robots), "sitemap line would keep advertising the old host");
  assert.ok(!/motorhomepower\.co\.uk/.test(load("sitemap.xml")), "sitemap still lists the old host");
});

test("logo and favicon SVG use pine #1e4f43, not the old green", function () {
  var logo = load("assets/logo.svg");
  var favicon = load("assets/favicon.svg");
  assert.ok(/#1e4f43/i.test(logo), "logo.svg should use pine #1e4f43");
  assert.ok(/#1e4f43/i.test(favicon), "favicon.svg should use pine #1e4f43");
  assert.ok(!/#2f5d46/i.test(logo + favicon), "must not keep old green #2f5d46");
});

test("nav glyphs exist and use pine #1e4f43", function () {
  ["daily", "battery", "solar", "inverter", "wire"].forEach(function (name) {
    var file = "assets/glyph-" + name + ".svg";
    assert.ok(fs.existsSync(path.join(root, file)), "missing " + file);
    var svg = load(file);
    assert.ok(/#1e4f43/i.test(svg), file + " should use pine #1e4f43");
    assert.ok(/#fff|#ffffff/i.test(svg), file + " should include a white glyph");
  });
});

test("redirect stubs do not point canonical URLs at motorhomepower.co.uk", function () {
  pages.forEach(function (page) {
    var html = load(page.file);
    assert.ok(html.indexOf("https://motorhomepower.co.uk") === -1, page.file);
  });
});

if (failed) {
  console.error("\n" + failed + " test(s) failed");
  process.exit(1);
}

console.log("\nAll tests passed");
