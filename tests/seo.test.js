#!/usr/bin/env node
"use strict";

var assert = require("assert");
var fs = require("fs");
var path = require("path");

var failed = 0;
var root = path.join(__dirname, "..");
var pages = ["index.html", "battery.html", "solar.html", "inverter.html", "wire.html"];
var MAX_META = 160;

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

pages.forEach(function (file) {
  var html = load(file);

  test(file + " meta description is present and ≤" + MAX_META + " chars", function () {
    var desc = attr(html, "meta", "description");
    assert.ok(desc, "missing name=description");
    assert.ok(desc.length > 80, "description too short (" + desc.length + ")");
    assert.ok(
      desc.length <= MAX_META,
      "description is " + desc.length + " chars: " + desc
    );
  });

  test(file + " og:description is present and ≤" + MAX_META + " chars", function () {
    var desc = attr(html, "meta", "og:description");
    assert.ok(desc, "missing og:description");
    assert.ok(desc.length > 80, "og:description too short (" + desc.length + ")");
    assert.ok(
      desc.length <= MAX_META,
      "og:description is " + desc.length + " chars: " + desc
    );
  });

  test(file + " og:title is present", function () {
    var title = attr(html, "meta", "og:title");
    assert.ok(title, "missing og:title");
    assert.ok(title.length >= 10, "og:title too short");
  });
});

test("homepage canonical and og:url are https://motorhomepower.co.uk/", function () {
  var html = load("index.html");
  assert.strictEqual(attr(html, "link", "canonical"), "https://motorhomepower.co.uk/");
  assert.strictEqual(attr(html, "meta", "og:url"), "https://motorhomepower.co.uk/");
});

test("homepage og:image uses the public icon PNG", function () {
  var html = load("index.html");
  assert.strictEqual(
    attr(html, "meta", "og:image"),
    "https://motorhomepower.co.uk/assets/icon-512.png"
  );
  assert.ok(fs.existsSync(path.join(root, "assets", "icon-512.png")));
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

pages.forEach(function (file) {
  var html = load(file);
  test(file + " icon and logo links are cache-busted", function () {
    assert.ok(
      /assets\/favicon\.svg\?v=/.test(html),
      "missing favicon.svg?v="
    );
    assert.ok(
      /assets\/logo\.svg\?v=/.test(html),
      "missing logo.svg?v="
    );
    assert.ok(
      /assets\/icon-512\.png\?v=/.test(html),
      "missing icon-512.png?v="
    );
    assert.ok(!/\?v=20260911[ab]/.test(html), "stale 20260911 icon cache-bust");
    assert.ok(
      /assets\/styles\.css\?v=/.test(html),
      "missing styles.css?v="
    );
    assert.ok(
      /assets\/glyph-daily\.svg\?v=/.test(html),
      "missing glyph-daily.svg?v="
    );
  });

  test(file + " Power Tools nav has glyphs before each label", function () {
    var nav = html.match(/<nav class="tool-nav no-print" aria-label="Power Tools">[\s\S]*?<\/nav>/);
    assert.ok(nav, "missing Power Tools nav");
    assert.ok(/glyph-daily\.svg/.test(nav[0]), "Daily Power missing glyph");
    assert.ok(/glyph-battery\.svg/.test(nav[0]), "Battery missing glyph");
    assert.ok(/glyph-solar\.svg/.test(nav[0]), "Solar missing glyph");
    assert.ok(/glyph-inverter\.svg/.test(nav[0]), "Inverter missing glyph");
    assert.ok(/glyph-wire\.svg/.test(nav[0]), "Wire missing glyph");
    assert.ok(
      /<img class="tool-glyph"[^>]*width="24"[^>]*height="24"/.test(nav[0]),
      "nav glyphs should be 24px"
    );
  });
});

test("homepage og:title and og:description are sensible", function () {
  var html = load("index.html");
  var title = attr(html, "meta", "og:title");
  var desc = attr(html, "meta", "og:description");
  assert.ok(/Daily Power|watt-hours|Wh/i.test(title), "og:title should name the calculator");
  assert.ok(/watt-hours|amp-hours|12V/i.test(desc), "og:description should mention Wh/Ah");
  assert.ok(!/aggregateRating|★★★/i.test(html), "must not invent ratings");
});

if (failed) {
  console.error("\n" + failed + " test(s) failed");
  process.exit(1);
}

console.log("\nAll tests passed");
