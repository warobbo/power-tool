#!/usr/bin/env node
"use strict";

var assert = require("assert");
var path = require("path");
var calc = require(path.join(__dirname, "..", "assets", "calc.js"));
var defaults = require(path.join(__dirname, "..", "assets", "defaults.js"));
var storage = require(path.join(__dirname, "..", "assets", "storage.js"));

var failed = 0;

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

test("disabled appliance contributes 0 Wh", function () {
  assert.strictEqual(
    calc.applianceWh({ watts: 100, hours: 5, qty: 2, enabled: false }),
    0
  );
});

test("enabled appliance is watts × hours × qty", function () {
  assert.strictEqual(
    calc.applianceWh({ watts: 45, hours: 10, qty: 1, enabled: true }),
    450
  );
  assert.strictEqual(
    calc.applianceWh({ watts: 10, hours: 2, qty: 2, enabled: true }),
    40
  );
});

test("hours are clamped to 0–24", function () {
  assert.strictEqual(calc.normaliseAppliance({ hours: 30, watts: 10, qty: 1, enabled: true }).hours, 24);
  assert.strictEqual(calc.normaliseAppliance({ hours: -2, watts: 10, qty: 1, enabled: true }).hours, 0);
});

test("default starter totals are Wh/12 and Wh/24", function () {
  var profile = defaults.createDefaultProfile();
  var totals = calc.calcTotals(profile.dailyPower);
  assert.ok(totals.totalWh > 800 && totals.totalWh < 1100);
  assert.strictEqual(totals.ah12, totals.totalWh / 12);
  assert.strictEqual(totals.ah24, totals.totalWh / 24);
  assert.strictEqual(totals.inverterLossEnabled, false);
});

test("inverter loss adds 12 percent to the total", function () {
  var totals = calc.calcTotals({
    inverterLossEnabled: true,
    inverterLossPct: 12,
    appliances: [{ watts: 100, hours: 10, qty: 1, enabled: true }],
  });
  assert.strictEqual(totals.loadWh, 1000);
  assert.strictEqual(totals.totalWh, 1120);
  assert.strictEqual(totals.ah12, 1120 / 12);
  assert.strictEqual(totals.ah24, 1120 / 24);
});

test("presets change hours and keep custom rows when asked", function () {
  var profile = defaults.createDefaultProfile();
  profile.dailyPower.appliances.push({
    id: "custom-test",
    name: "Starlink",
    watts: 50,
    hours: 8,
    qty: 1,
    enabled: true,
    custom: true,
  });

  var weekend = storage.applyPreset(profile, "weekend");
  var custom = weekend.dailyPower.appliances.filter(function (item) {
    return item.custom;
  });
  var fridge = weekend.dailyPower.appliances.find(function (item) {
    return item.id === "fridge";
  });

  assert.strictEqual(custom.length, 1);
  assert.strictEqual(custom[0].name, "Starlink");
  assert.strictEqual(fridge.hours, 8);
  assert.strictEqual(weekend.dailyPower.inverterLossEnabled, false);

  var reset = storage.applyPreset(weekend, "defaults");
  assert.strictEqual(
    reset.dailyPower.appliances.some(function (item) {
      return item.custom;
    }),
    false
  );
});

test("sanitise keeps later-slice keys on the shared profile", function () {
  var clean = storage.sanitiseProfile({
    version: 1,
    dailyPower: { appliances: [] },
    battery: { usableAh: 200 },
    solar: { arrayWatts: 400 },
  });
  assert.strictEqual(clean.battery.usableAh, 200);
  assert.strictEqual(clean.solar.arrayWatts, 400);
  assert.strictEqual(storage.STORAGE_KEY, "powertools.systemProfile");
});

test("full-time preset uses more energy than the weekend preset", function () {
  var weekend = calc.calcTotals(defaults.PRESETS.weekend);
  var fulltime = calc.calcTotals(defaults.PRESETS.fulltime);
  assert.ok(fulltime.totalWh > weekend.totalWh);
});

if (failed) {
  console.error("\n" + failed + " test(s) failed");
  process.exit(1);
}

console.log("\nAll tests passed");
