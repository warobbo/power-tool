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

test("starter list includes kettle and 1-ring induction hob", function () {
  var appliances = defaults.starterSet();
  var kettle = appliances.find(function (item) {
    return item.id === "kettle";
  });
  var hob = appliances.find(function (item) {
    return item.id === "induction-hob";
  });

  assert.ok(kettle, "kettle is in the starter list");
  assert.strictEqual(kettle.name, "Kettle");
  assert.strictEqual(kettle.watts, 1200);
  assert.strictEqual(kettle.hours, 0.15);
  assert.strictEqual(kettle.qty, 1);
  assert.strictEqual(kettle.enabled, false);

  assert.ok(hob, "1-ring induction hob is in the starter list");
  assert.strictEqual(hob.name, "1-ring induction hob");
  assert.strictEqual(hob.watts, 1600);
  assert.strictEqual(hob.hours, 0.4);
  assert.strictEqual(hob.qty, 1);
  assert.strictEqual(hob.enabled, false);

  assert.ok(defaults.STARTER_IDS.indexOf("kettle") !== -1);
  assert.ok(defaults.STARTER_IDS.indexOf("induction-hob") !== -1);
});

test("weekend leaves kettle and hob off; full-time uses them", function () {
  var weekendKettle = defaults.PRESETS.weekend.appliances.find(function (item) {
    return item.id === "kettle";
  });
  var weekendHob = defaults.PRESETS.weekend.appliances.find(function (item) {
    return item.id === "induction-hob";
  });
  var fullKettle = defaults.PRESETS.fulltime.appliances.find(function (item) {
    return item.id === "kettle";
  });
  var fullHob = defaults.PRESETS.fulltime.appliances.find(function (item) {
    return item.id === "induction-hob";
  });

  assert.strictEqual(weekendKettle.enabled, false);
  assert.strictEqual(weekendHob.enabled, false);
  assert.strictEqual(fullKettle.enabled, true);
  assert.strictEqual(fullHob.enabled, true);
  assert.ok(fullKettle.hours > 0);
  assert.ok(fullHob.hours > 0);
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
  assert.strictEqual(weekend.dailyPower.activePreset, "weekend");
  assert.strictEqual(reset.dailyPower.activePreset, "defaults");
});

test("sanitise keeps later-slice keys on the shared profile", function () {
  var clean = storage.sanitiseProfile({
    version: 1,
    dailyPower: { appliances: [] },
    battery: { daysAutonomy: 3, chemistry: "agm" },
    inverter: { continuousWatts: 1500 },
  });
  assert.strictEqual(clean.battery.daysAutonomy, 3);
  assert.strictEqual(clean.battery.chemistry, "agm");
  assert.strictEqual(clean.solar.season, "spring-autumn");
  assert.strictEqual(clean.solar.peakSunHours, 3);
  assert.strictEqual(clean.inverter.continuousWatts, 1500);
  assert.strictEqual(storage.STORAGE_KEY, "powertools.systemProfile");
});

test("battery bank is daily Wh × days ÷ usable fraction", function () {
  var profile = {
    dailyPower: {
      inverterLossEnabled: false,
      appliances: [{ watts: 100, hours: 10, qty: 1, enabled: true }],
    },
    battery: {
      daysAutonomy: 2,
      chemistry: "lifepo4",
      contingencyPct: 0,
      useManualWh: false,
    },
  };
  var result = calc.calcBatteryBank(profile);
  assert.strictEqual(result.dailyWh, 1000);
  assert.strictEqual(result.daysWh, 2000);
  assert.strictEqual(result.usablePct, 80);
  assert.strictEqual(result.bankWh, 2500);
  assert.strictEqual(result.ah12, 2500 / 12);
  assert.strictEqual(result.ah24, 2500 / 24);
  assert.strictEqual(result.source, "dailyPower");
});

test("battery bank adds optional contingency then applies chemistry", function () {
  var profile = {
    dailyPower: {
      appliances: [{ watts: 100, hours: 10, qty: 1, enabled: true }],
    },
    battery: {
      daysAutonomy: 2,
      chemistry: "lifepo4",
      contingencyPct: 10,
      useManualWh: false,
    },
  };
  var result = calc.calcBatteryBank(profile);
  assert.strictEqual(result.energyNeededWh, 2200);
  assert.strictEqual(result.bankWh, 2750);
  assert.strictEqual(result.ah12, 2750 / 12);
  assert.strictEqual(result.ah24, 2750 / 24);
});

test("AGM usable 50% needs a larger bank than LiFePO4", function () {
  var daily = {
    appliances: [{ watts: 100, hours: 10, qty: 1, enabled: true }],
  };
  var lithium = calc.calcBatteryBank({
    dailyPower: daily,
    battery: { daysAutonomy: 2, chemistry: "lifepo4", contingencyPct: 0 },
  });
  var agm = calc.calcBatteryBank({
    dailyPower: daily,
    battery: { daysAutonomy: 2, chemistry: "agm", contingencyPct: 0 },
  });
  assert.strictEqual(lithium.usablePct, 80);
  assert.strictEqual(agm.usablePct, 50);
  assert.strictEqual(agm.bankWh, 4000);
  assert.ok(agm.bankWh > lithium.bankWh);
});

test("custom usable percentage and manual daily Wh", function () {
  var result = calc.calcBatteryBank({
    dailyPower: {
      appliances: [{ watts: 100, hours: 10, qty: 1, enabled: true }],
    },
    battery: {
      daysAutonomy: 2,
      chemistry: "custom",
      customUsablePct: 90,
      contingencyPct: 0,
      useManualWh: true,
      manualWh: 800,
    },
  });
  assert.strictEqual(result.source, "manual");
  assert.strictEqual(result.dailyWh, 800);
  assert.strictEqual(result.usablePct, 90);
  assert.strictEqual(result.bankWh, 800 * 2 / 0.9);
});

test("battery defaults and sanitise clamp bad values", function () {
  var profile = defaults.createDefaultProfile();
  assert.strictEqual(profile.battery.daysAutonomy, 2);
  assert.strictEqual(profile.battery.chemistry, "lifepo4");
  assert.strictEqual(profile.battery.contingencyPct, 10);
  assert.strictEqual(profile.battery.useManualWh, false);

  var clean = storage.sanitiseBattery({
    daysAutonomy: 99,
    chemistry: "nickel",
    customUsablePct: 3,
    contingencyPct: -8,
    useManualWh: "yes",
    manualWh: -20,
  });
  assert.strictEqual(clean.daysAutonomy, 14);
  assert.strictEqual(clean.chemistry, "lifepo4");
  assert.strictEqual(clean.customUsablePct, 10);
  assert.strictEqual(clean.contingencyPct, 0);
  assert.strictEqual(clean.useManualWh, true);
  assert.strictEqual(clean.manualWh, 0);
});

test("applying a daily-power preset keeps battery settings", function () {
  var profile = defaults.createDefaultProfile();
  profile.battery.daysAutonomy = 3;
  profile.battery.chemistry = "agm";
  profile.battery.contingencyPct = 5;

  var weekend = storage.applyPreset(profile, "weekend");
  assert.strictEqual(weekend.battery.daysAutonomy, 3);
  assert.strictEqual(weekend.battery.chemistry, "agm");
  assert.strictEqual(weekend.battery.contingencyPct, 5);
  assert.strictEqual(weekend.dailyPower.activePreset, "weekend");
});

test("full-time preset uses more energy than the weekend preset", function () {
  var weekend = calc.calcTotals(defaults.PRESETS.weekend);
  var fulltime = calc.calcTotals(defaults.PRESETS.fulltime);
  assert.ok(fulltime.totalWh > weekend.totalWh);
});

test("family week preset is heavier than a light weekend", function () {
  var family = defaults.PRESETS.family;
  var phone = family.appliances.find(function (item) {
    return item.id === "phone";
  });
  var kettle = family.appliances.find(function (item) {
    return item.id === "kettle";
  });
  var hob = family.appliances.find(function (item) {
    return item.id === "induction-hob";
  });
  var fridge = family.appliances.find(function (item) {
    return item.id === "fridge";
  });
  var weekendFridge = defaults.PRESETS.weekend.appliances.find(function (item) {
    return item.id === "fridge";
  });

  assert.ok(family, "family week preset exists");
  assert.strictEqual(family.label, "Full week — 4 people");
  assert.strictEqual(family.sublabel, "2 adults + 2 children");
  assert.strictEqual(family.inverterLossEnabled, true);
  assert.strictEqual(phone.qty, 4);
  assert.strictEqual(kettle.enabled, true);
  assert.ok(kettle.hours > 0);
  assert.strictEqual(hob.enabled, true);
  assert.ok(hob.hours > 0);
  assert.ok(fridge.hours > weekendFridge.hours);
  assert.ok(defaults.PRESET_ORDER.indexOf("family") !== -1);

  var weekendTotals = calc.calcTotals(defaults.PRESETS.weekend);
  var familyTotals = calc.calcTotals(family);
  assert.ok(familyTotals.totalWh > weekendTotals.totalWh);
});

test("load merge adds missing starter appliances without overwriting saved rows", function () {
  var oldProfile = {
    version: 1,
    dailyPower: {
      inverterLossEnabled: true,
      inverterLossPct: 12,
      appliances: [
        { id: "fridge", name: "Compressor fridge", watts: 55, hours: 14, qty: 1, enabled: true },
        { id: "lights", name: "LED lights", watts: 8, hours: 4, qty: 1, enabled: true },
        { id: "pump", name: "Water pump", watts: 42, hours: 0.25, qty: 1, enabled: true },
        { id: "heater", name: "Diesel heater / fan (low draw)", watts: 18, hours: 4, qty: 1, enabled: true },
        { id: "phone", name: "Phone / tablet charge", watts: 10, hours: 2, qty: 2, enabled: true },
        { id: "laptop", name: "Laptop", watts: 60, hours: 2, qty: 1, enabled: true },
        { id: "fan", name: "MaxxFan / roof fan", watts: 24, hours: 3, qty: 1, enabled: true },
        { id: "water-heater", name: "Water heater (electric when used)", watts: 1000, hours: 0.25, qty: 1, enabled: false },
        { id: "tv", name: "TV / monitor", watts: 28, hours: 2, qty: 1, enabled: true },
        { id: "inverter-idle", name: "Inverter idle / phantom load", watts: 8, hours: 8, qty: 1, enabled: true },
        { id: "custom-test", name: "Starlink", watts: 50, hours: 8, qty: 1, enabled: true, custom: true },
      ],
    },
  };

  var clean = storage.sanitiseProfile(oldProfile);
  var appliances = clean.dailyPower.appliances;
  var byId = {};
  appliances.forEach(function (item) {
    byId[item.id] = item;
  });

  defaults.STARTER_IDS.forEach(function (id) {
    assert.ok(byId[id], "missing starter " + id);
  });

  assert.strictEqual(byId.fridge.watts, 55);
  assert.strictEqual(byId.fridge.hours, 14);
  assert.strictEqual(byId.fridge.enabled, true);
  assert.strictEqual(byId.kettle.watts, 1200);
  assert.strictEqual(byId.kettle.hours, 0.15);
  assert.strictEqual(byId.kettle.enabled, false);
  assert.strictEqual(byId["induction-hob"].watts, 1600);
  assert.strictEqual(byId["induction-hob"].hours, 0.4);
  assert.strictEqual(byId["induction-hob"].enabled, false);
  assert.strictEqual(byId["custom-test"].name, "Starlink");
  assert.strictEqual(byId["custom-test"].custom, true);
  assert.strictEqual(clean.dailyPower.activePreset, "");

  defaults.STARTER_IDS.forEach(function (id, index) {
    assert.strictEqual(appliances[index].id, id);
  });
  assert.strictEqual(appliances[appliances.length - 1].id, "custom-test");
});

test("solar array is daily Wh ÷ (peak sun hours × efficiency)", function () {
  var result = calc.calcSolarArray({
    dailyPower: {
      inverterLossEnabled: false,
      appliances: [{ watts: 100, hours: 10, qty: 1, enabled: true }],
    },
    solar: {
      season: "spring-autumn",
      peakSunHours: 3,
      lossPct: 25,
      marginPct: 0,
      useManualWh: false,
    },
  });
  assert.strictEqual(result.dailyWh, 1000);
  assert.strictEqual(result.peakSunHours, 3);
  assert.strictEqual(result.effectiveHours, 2.25);
  assert.strictEqual(result.arrayWatts, 1000 / 2.25);
  assert.strictEqual(result.supportedWh, 1000);
  assert.strictEqual(result.source, "dailyPower");
  assert.strictEqual(result.panels[0].watts, 100);
  assert.strictEqual(result.panels[0].count, 5);
  assert.strictEqual(result.panels[1].count, 3);
  assert.strictEqual(result.panels[2].count, 2);
});

test("solar array adds optional margin then applies losses", function () {
  var result = calc.calcSolarArray({
    dailyPower: {
      appliances: [{ watts: 100, hours: 10, qty: 1, enabled: true }],
    },
    solar: {
      season: "spring-autumn",
      peakSunHours: 3,
      lossPct: 25,
      marginPct: 10,
      useManualWh: false,
    },
  });
  assert.strictEqual(result.energyNeededWh, 1100);
  assert.strictEqual(result.arrayWatts, 1100 / 2.25);
  assert.strictEqual(result.supportedWh, 1100);
});

test("winter sun hours need a larger array than summer", function () {
  var daily = {
    appliances: [{ watts: 100, hours: 10, qty: 1, enabled: true }],
  };
  var summer = calc.calcSolarArray({
    dailyPower: daily,
    solar: { season: "summer", peakSunHours: 4.5, lossPct: 25, marginPct: 0 },
  });
  var winter = calc.calcSolarArray({
    dailyPower: daily,
    solar: { season: "winter", peakSunHours: 1.2, lossPct: 25, marginPct: 0 },
  });
  assert.strictEqual(summer.peakSunHours, 4.5);
  assert.strictEqual(winter.peakSunHours, 1.2);
  assert.ok(winter.arrayWatts > summer.arrayWatts);
  assert.ok(Math.abs(summer.arrayWatts - 1000 / 3.375) < 0.0001);
  assert.ok(Math.abs(winter.arrayWatts - 1000 / 0.9) < 0.0001);
});

test("solar can use a typed daily Wh without changing battery override", function () {
  var result = calc.calcSolarArray({
    dailyPower: {
      appliances: [{ watts: 100, hours: 10, qty: 1, enabled: true }],
    },
    battery: {
      useManualWh: true,
      manualWh: 2000,
    },
    solar: {
      season: "spring-autumn",
      peakSunHours: 3,
      lossPct: 25,
      marginPct: 0,
      useManualWh: true,
      manualWh: 800,
    },
  });
  assert.strictEqual(result.source, "manual");
  assert.strictEqual(result.dailyWh, 800);
  assert.strictEqual(calc.resolveDailyWh({
    dailyPower: {
      appliances: [{ watts: 100, hours: 10, qty: 1, enabled: true }],
    },
    battery: { useManualWh: true, manualWh: 2000 },
  }), 2000);
});

test("solar defaults and sanitise clamp bad values", function () {
  var profile = defaults.createDefaultProfile();
  assert.strictEqual(profile.solar.season, "spring-autumn");
  assert.strictEqual(profile.solar.peakSunHours, 3);
  assert.strictEqual(profile.solar.lossPct, 25);
  assert.strictEqual(profile.solar.marginPct, 10);
  assert.strictEqual(profile.solar.useManualWh, false);

  var clean = storage.sanitiseSolar({
    season: "monsoon",
    peakSunHours: 40,
    lossPct: -5,
    marginPct: 99,
    useManualWh: "yes",
    manualWh: -20,
  });
  assert.strictEqual(clean.season, "spring-autumn");
  assert.strictEqual(clean.peakSunHours, 12);
  assert.strictEqual(clean.lossPct, 0);
  assert.strictEqual(clean.marginPct, 50);
  assert.strictEqual(clean.useManualWh, true);
  assert.strictEqual(clean.manualWh, 0);
});

test("typed peak sun hours match a season or become custom", function () {
  assert.strictEqual(calc.matchSeasonForHours(4.5), "summer");
  assert.strictEqual(calc.matchSeasonForHours(3), "spring-autumn");
  assert.strictEqual(calc.matchSeasonForHours(1.2), "winter");
  assert.strictEqual(calc.matchSeasonForHours(2.4), "custom");
});

test("applying a daily-power preset keeps solar settings", function () {
  var profile = defaults.createDefaultProfile();
  profile.solar.season = "winter";
  profile.solar.peakSunHours = 1.2;
  profile.solar.lossPct = 30;
  profile.solar.marginPct = 5;

  var weekend = storage.applyPreset(profile, "weekend");
  assert.strictEqual(weekend.solar.season, "winter");
  assert.strictEqual(weekend.solar.peakSunHours, 1.2);
  assert.strictEqual(weekend.solar.lossPct, 30);
  assert.strictEqual(weekend.solar.marginPct, 5);
  assert.strictEqual(weekend.dailyPower.activePreset, "weekend");
});

if (failed) {
  console.error("\n" + failed + " test(s) failed");
  process.exit(1);
}

console.log("\nAll tests passed");
