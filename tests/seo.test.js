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
