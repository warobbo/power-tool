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
    futureSlice: { note: "keep me" },
  });
  assert.strictEqual(clean.battery.daysAutonomy, 3);
  assert.strictEqual(clean.battery.chemistry, "agm");
  assert.strictEqual(clean.solar.season, "spring-autumn");
  assert.strictEqual(clean.solar.peakSunHours, 3);
  assert.strictEqual(clean.inverter.systemVoltage, 12);
  assert.strictEqual(clean.inverter.efficiencyPct, 88);
  assert.strictEqual(clean.wiring.preset, "inverter");
  assert.strictEqual(clean.wiring.useInverterSuggestion, true);
  assert.strictEqual(clean.futureSlice.note, "keep me");
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

test("inverter continuous is enabled running watts plus margin", function () {
  var result = calc.calcInverter({
    inverter: {
      systemVoltage: 12,
      efficiencyPct: 88,
      marginPct: 20,
      loads: [
        { watts: 1200, surgeWatts: 1200, qty: 1, enabled: true },
        { watts: 65, surgeWatts: 65, qty: 1, enabled: true },
        { watts: 1600, surgeWatts: 2000, qty: 1, enabled: false },
      ],
    },
  });
  assert.strictEqual(result.continuousLoadW, 1265);
  assert.strictEqual(result.recommendedContinuousW, 1265 * 1.2);
  assert.strictEqual(result.highestSurgeW, 1200);
  assert.strictEqual(result.combinedSurgeW, 1265);
  assert.strictEqual(result.recommendedSurgeW, 1265 * 1.2);
  assert.ok(Math.abs(result.dcLoadW - 1265 / 0.88) < 0.0001);
  assert.ok(Math.abs(result.amps12 - 1265 / 0.88 / 12) < 0.0001);
  assert.ok(Math.abs(result.amps24 - 1265 / 0.88 / 24) < 0.0001);
  assert.strictEqual(result.selectedAmps, result.amps12);
});

test("inverter surge covers the highest start plus other running loads", function () {
  var result = calc.calcInverter({
    inverter: {
      systemVoltage: 12,
      efficiencyPct: 100,
      marginPct: 0,
      loads: [
        { watts: 1200, surgeWatts: 1200, qty: 1, enabled: true },
        { watts: 1600, surgeWatts: 2000, qty: 1, enabled: true },
      ],
    },
  });
  assert.strictEqual(result.continuousLoadW, 2800);
  assert.strictEqual(result.highestSurgeW, 2000);
  assert.strictEqual(result.combinedSurgeW, 3200);
  assert.strictEqual(result.recommendedContinuousW, 2800);
  assert.strictEqual(result.recommendedSurgeW, 3200);
});

test("inverter 24 V is half the DC amps of 12 V", function () {
  var result = calc.calcInverter({
    inverter: {
      systemVoltage: 24,
      efficiencyPct: 100,
      marginPct: 0,
      loads: [{ watts: 1200, surgeWatts: 1200, qty: 1, enabled: true }],
    },
  });
  assert.strictEqual(result.systemVoltage, 24);
  assert.strictEqual(result.amps12, 100);
  assert.strictEqual(result.amps24, 50);
  assert.strictEqual(result.selectedAmps, 50);
  assert.strictEqual(result.recommendedContinuousW, 1200);
});

test("missing surge watts uses running watts", function () {
  var item = calc.normaliseInverterLoad({ watts: 800, qty: 1, enabled: true });
  assert.strictEqual(item.surgeWatts, 800);
  assert.strictEqual(calc.inverterLoadSurgeW(item), 800);
  assert.strictEqual(calc.inverterLoadRunningW({ watts: 800, enabled: false }), 0);
});

test("inverter defaults and sanitise clamp bad values", function () {
  var profile = defaults.createDefaultProfile();
  assert.strictEqual(profile.inverter.systemVoltage, 12);
  assert.strictEqual(profile.inverter.efficiencyPct, 88);
  assert.strictEqual(profile.inverter.marginPct, 20);
  assert.ok(profile.inverter.loads.length >= 9);

  var kettle = profile.inverter.loads.find(function (item) {
    return item.id === "kettle";
  });
  var hob = profile.inverter.loads.find(function (item) {
    return item.id === "induction-hob";
  });
  assert.ok(kettle, "kettle is in the inverter starter list");
  assert.strictEqual(kettle.watts, 1200);
  assert.strictEqual(kettle.enabled, true);
  assert.ok(hob, "induction hob is in the inverter starter list");
  assert.strictEqual(hob.watts, 1600);
  assert.strictEqual(hob.surgeWatts, 2000);
  assert.strictEqual(hob.enabled, false);

  var inverterIds = profile.inverter.loads.map(function (item) {
    return item.id;
  });
  defaults.RETIRED_INVERTER_LOAD_IDS.forEach(function (id) {
    assert.ok(inverterIds.indexOf(id) === -1, id + " should not be an inverter starter");
  });
  var microwave = profile.inverter.loads.find(function (item) {
    return item.id === "microwave";
  });
  var hairdryer = profile.inverter.loads.find(function (item) {
    return item.id === "hairdryer";
  });
  var airFryer = profile.inverter.loads.find(function (item) {
    return item.id === "air-fryer";
  });
  var coffee = profile.inverter.loads.find(function (item) {
    return item.id === "coffee-machine";
  });
  var wonderOven = profile.inverter.loads.find(function (item) {
    return item.id === "wonder-oven";
  });
  var electricBbq = profile.inverter.loads.find(function (item) {
    return item.id === "electric-bbq";
  });
  assert.ok(microwave, "microwave is in the inverter starter list");
  assert.ok(hairdryer, "hairdryer is in the inverter starter list");
  assert.ok(airFryer, "air fryer is in the inverter starter list");
  assert.strictEqual(airFryer.name, "Air fryer");
  assert.strictEqual(airFryer.watts, 1500);
  assert.strictEqual(airFryer.surgeWatts, 1650);
  assert.strictEqual(airFryer.enabled, false);
  assert.ok(coffee, "capsule coffee machine is in the inverter starter list");
  assert.strictEqual(coffee.name, "Coffee machine (capsule)");
  assert.strictEqual(coffee.watts, 1300);
  assert.strictEqual(coffee.enabled, false);
  assert.ok(wonderOven, "Wonder Oven is in the inverter starter list");
  assert.strictEqual(wonderOven.watts, 1400);
  assert.strictEqual(wonderOven.enabled, false);
  assert.ok(electricBbq, "electric BBQ grill is in the inverter starter list");
  assert.strictEqual(electricBbq.watts, 2200);
  assert.strictEqual(electricBbq.enabled, false);

  var defaultResult = calc.calcInverter(profile);
  assert.strictEqual(defaultResult.continuousLoadW, 1200);
  assert.strictEqual(defaultResult.recommendedContinuousW, 1440);

  var clean = storage.sanitiseInverter({
    systemVoltage: 48,
    efficiencyPct: 10,
    marginPct: 80,
    loads: [{ watts: -20, surgeWatts: 90000, qty: 0, enabled: "yes" }],
  });
  assert.strictEqual(clean.systemVoltage, 12);
  assert.strictEqual(clean.efficiencyPct, 50);
  assert.strictEqual(clean.marginPct, 50);
  assert.ok(clean.loads.some(function (item) {
    return item.id === "kettle";
  }));
  var extras = clean.loads.filter(function (item) {
    return defaults.INVERTER_LOAD_IDS.indexOf(item.id) === -1;
  });
  assert.strictEqual(extras.length, 1);
  assert.strictEqual(extras[0].watts, 0);
  assert.strictEqual(extras[0].surgeWatts, 40000);
  assert.strictEqual(extras[0].qty, 1);
  assert.strictEqual(extras[0].enabled, true);
});

test("inverter merge drops retired 12 V starter loads and keeps Daily Power ones", function () {
  var daily = defaults.starterSet();
  assert.ok(daily.some(function (item) {
    return item.id === "laptop";
  }));
  assert.ok(daily.some(function (item) {
    return item.id === "tv";
  }));
  assert.ok(daily.some(function (item) {
    return item.id === "phone";
  }));

  var clean = storage.sanitiseInverter({
    systemVoltage: 12,
    efficiencyPct: 88,
    marginPct: 20,
    loads: [
      { id: "kettle", name: "Kettle", watts: 1200, surgeWatts: 1200, qty: 1, enabled: true },
      { id: "laptop", name: "Laptop charger", watts: 65, surgeWatts: 65, qty: 1, enabled: true },
      { id: "tv", name: "TV / monitor", watts: 40, surgeWatts: 40, qty: 1, enabled: true },
      { id: "phone", name: "Phone / tablet charger", watts: 18, surgeWatts: 18, qty: 1, enabled: true },
      { id: "custom-starlink", name: "Starlink", watts: 75, surgeWatts: 100, qty: 1, enabled: true, custom: true },
    ],
  });
  var byId = {};
  clean.loads.forEach(function (item) {
    byId[item.id] = item;
  });

  defaults.RETIRED_INVERTER_LOAD_IDS.forEach(function (id) {
    assert.ok(!byId[id], "retired inverter load " + id + " should be dropped");
  });
  assert.ok(byId.kettle, "kettle stays");
  assert.ok(byId.microwave, "missing 230 V starters are still merged in");
  assert.strictEqual(byId["custom-starlink"].name, "Starlink");
  assert.strictEqual(calc.calcInverter({ inverter: clean }).continuousLoadW, 1275);
});

test("inverter load merge adds missing starters without overwriting saved rows", function () {
  var clean = storage.sanitiseInverter({
    systemVoltage: 24,
    efficiencyPct: 90,
    marginPct: 10,
    loads: [
      { id: "kettle", name: "Travel kettle", watts: 900, surgeWatts: 900, qty: 1, enabled: true },
      { id: "custom-mix", name: "Blender", watts: 400, surgeWatts: 700, qty: 1, enabled: true, custom: true },
    ],
  });
  var byId = {};
  clean.loads.forEach(function (item) {
    byId[item.id] = item;
  });

  defaults.INVERTER_LOAD_IDS.forEach(function (id) {
    assert.ok(byId[id], "missing inverter starter " + id);
  });
  assert.strictEqual(byId.kettle.watts, 900);
  assert.strictEqual(byId.kettle.name, "Travel kettle");
  assert.strictEqual(byId["induction-hob"].watts, 1600);
  assert.strictEqual(byId["induction-hob"].enabled, false);
  assert.strictEqual(byId["air-fryer"].watts, 1500);
  assert.strictEqual(byId["air-fryer"].enabled, false);
  assert.strictEqual(byId["coffee-machine"].watts, 1300);
  assert.strictEqual(byId["wonder-oven"].watts, 1400);
  assert.strictEqual(byId["electric-bbq"].watts, 2200);
  assert.strictEqual(byId["electric-bbq"].enabled, false);
  assert.strictEqual(byId["custom-mix"].name, "Blender");
  assert.strictEqual(byId["custom-mix"].custom, true);
  assert.strictEqual(clean.systemVoltage, 24);
  assert.strictEqual(clean.efficiencyPct, 90);
  assert.strictEqual(clean.loads[clean.loads.length - 1].id, "custom-mix");
});

test("applying a daily-power preset keeps inverter settings", function () {
  var profile = defaults.createDefaultProfile();
  profile.inverter.systemVoltage = 24;
  profile.inverter.efficiencyPct = 90;
  profile.inverter.marginPct = 15;

  var weekend = storage.applyPreset(profile, "weekend");
  assert.strictEqual(weekend.inverter.systemVoltage, 24);
  assert.strictEqual(weekend.inverter.efficiencyPct, 90);
  assert.strictEqual(weekend.inverter.marginPct, 15);
  assert.strictEqual(weekend.dailyPower.activePreset, "weekend");
});

test("voltage drop uses twice the one-way length on copper", function () {
  var dropV = calc.cableVoltageDropV(100, 2, 25);
  assert.ok(Math.abs(dropV - (2 * 100 * 2 * calc.COPPER_RESISTIVITY) / 25) < 0.0001);
  assert.ok(Math.abs(dropV - 0.28) < 0.0001);
  assert.ok(Math.abs(calc.requiredCableMm2(100, 2, 0.36) - 19.444444) < 0.001);
});

test("wiring rounds up to the next practical UK mm²", function () {
  var result = calc.calcWiring({
    wiring: {
      systemVoltage: 12,
      inputMode: "amps",
      currentA: 100,
      oneWayLengthM: 2,
      dropPct: 3,
      useInverterSuggestion: false,
    },
  });
  assert.ok(result.requiredMm2 > 16 && result.requiredMm2 < 25);
  assert.strictEqual(result.cableMm2, 25);
  assert.strictEqual(result.roundTripLengthM, 4);
  assert.ok(Math.abs(result.dropV - 0.28) < 0.0001);
  assert.ok(Math.abs(result.estimatedDropPct - (0.28 / 12) * 100) < 0.0001);
  assert.ok(result.fuseAmps >= 100);
  assert.ok(result.fuseAmps <= result.cableAmps);
});

test("24 V needs thinner cable than 12 V for the same watts", function () {
  var at12 = calc.calcWiring({
    wiring: {
      systemVoltage: 12,
      inputMode: "watts",
      watts: 1200,
      oneWayLengthM: 3,
      dropPct: 3,
      useInverterSuggestion: false,
    },
  });
  var at24 = calc.calcWiring({
    wiring: {
      systemVoltage: 24,
      inputMode: "watts",
      watts: 1200,
      oneWayLengthM: 3,
      dropPct: 3,
      useInverterSuggestion: false,
    },
  });
  assert.strictEqual(at12.currentA, 100);
  assert.strictEqual(at24.currentA, 50);
  assert.ok(at24.cableMm2 < at12.cableMm2);
});

test("longer cable or tighter drop needs a larger mm²", function () {
  var short = calc.calcWiring({
    wiring: {
      systemVoltage: 12,
      inputMode: "amps",
      currentA: 40,
      oneWayLengthM: 1,
      dropPct: 10,
      useInverterSuggestion: false,
    },
  });
  var long = calc.calcWiring({
    wiring: {
      systemVoltage: 12,
      inputMode: "amps",
      currentA: 40,
      oneWayLengthM: 8,
      dropPct: 3,
      useInverterSuggestion: false,
    },
  });
  assert.ok(long.cableMm2 > short.cableMm2);
  assert.ok(long.requiredMm2 > short.requiredMm2);
});

test("cable is also sized so its rating covers the current", function () {
  var result = calc.calcWiring({
    wiring: {
      systemVoltage: 12,
      inputMode: "amps",
      currentA: 380,
      oneWayLengthM: 0.5,
      dropPct: 10,
      useInverterSuggestion: false,
    },
  });
  assert.ok(result.requiredMm2 < 10);
  assert.strictEqual(result.cableMm2, 70);
  assert.ok(result.cableAmps >= 380);
});

test("fuse sits above the load and within the cable rating", function () {
  assert.strictEqual(calc.recommendFuseAmps(10, 16), 15);
  assert.strictEqual(calc.recommendFuseAmps(100, 135), 125);
  assert.strictEqual(calc.recommendFuseAmps(0, 16), 0);
  var fridge = calc.calcWiring({
    wiring: {
      systemVoltage: 12,
      inputMode: "watts",
      watts: 45,
      oneWayLengthM: 3,
      dropPct: 3,
      useInverterSuggestion: false,
    },
  });
  assert.strictEqual(fridge.cableMm2, 1.5);
  assert.ok(fridge.fuseAmps > fridge.currentA);
  assert.ok(fridge.fuseAmps <= fridge.cableAmps);
});

test("zero current gives no cable or fuse", function () {
  var result = calc.calcWiring({
    wiring: {
      systemVoltage: 12,
      inputMode: "amps",
      currentA: 0,
      oneWayLengthM: 2,
      dropPct: 3,
      useInverterSuggestion: false,
    },
  });
  assert.strictEqual(result.cableMm2, 0);
  assert.strictEqual(result.fuseAmps, 0);
  assert.strictEqual(result.dropV, 0);
});

test("inverter suggestion uses recommended watts divided by voltage", function () {
  var profile = defaults.createDefaultProfile();
  var inverter = calc.calcInverter(profile);
  assert.strictEqual(inverter.recommendedContinuousW, 1440);
  var suggested12 = calc.resolveInverterSuggestedAmps(profile, 12);
  var suggested24 = calc.resolveInverterSuggestedAmps(profile, 24);
  assert.ok(Math.abs(suggested12 - 1440 / 12) < 0.0001);
  assert.ok(Math.abs(suggested24 - suggested12 / 2) < 0.0001);

  var wired = calc.calcWiring(profile);
  assert.strictEqual(wired.usedInverterSuggestion, true);
  assert.ok(Math.abs(wired.currentA - suggested12) < 0.0001);
  assert.ok(wired.cableMm2 >= 25);
});

test("wiring defaults and sanitise clamp bad values", function () {
  var profile = defaults.createDefaultProfile();
  assert.strictEqual(profile.wiring.preset, "inverter");
  assert.strictEqual(profile.wiring.systemVoltage, 12);
  assert.strictEqual(profile.wiring.oneWayLengthM, 2);
  assert.strictEqual(profile.wiring.dropPct, 3);
  assert.strictEqual(profile.wiring.useInverterSuggestion, true);

  var clean = storage.sanitiseWiring({
    preset: "mains-cu",
    systemVoltage: 48,
    inputMode: "horsepower",
    currentA: 900,
    watts: -20,
    oneWayLengthM: 0,
    dropPct: 80,
    useInverterSuggestion: "yes",
  });
  assert.strictEqual(clean.preset, "inverter");
  assert.strictEqual(clean.systemVoltage, 12);
  assert.strictEqual(clean.inputMode, "amps");
  assert.strictEqual(clean.currentA, 600);
  assert.strictEqual(clean.watts, 0);
  assert.strictEqual(clean.oneWayLengthM, 0.1);
  assert.strictEqual(clean.dropPct, 15);
  assert.strictEqual(clean.useInverterSuggestion, true);
});

test("wiring presets set length, drop and a typical current", function () {
  var profile = defaults.createDefaultProfile();
  var fridge = storage.applyWiringPreset(profile, "fridge");
  assert.strictEqual(fridge.wiring.preset, "fridge");
  assert.strictEqual(fridge.wiring.useInverterSuggestion, false);
  assert.strictEqual(fridge.wiring.watts, 45);
  assert.strictEqual(fridge.wiring.oneWayLengthM, 3);
  assert.strictEqual(fridge.wiring.dropPct, 3);

  var pump = storage.applyWiringPreset(fridge, "water-pump");
  assert.strictEqual(pump.wiring.preset, "water-pump");
  assert.strictEqual(pump.wiring.watts, 42);
  assert.strictEqual(pump.wiring.dropPct, 10);
  assert.strictEqual(pump.wiring.oneWayLengthM, 4);
  assert.strictEqual(calc.calcWiring(fridge).cableMm2, 1.5);
  assert.strictEqual(calc.calcWiring(pump).cableMm2, 1.5);

  var solar = storage.applyWiringPreset(profile, "solar-panel");
  var solarResult = calc.calcWiring(solar);
  assert.ok(solarResult.cableMm2 >= 16 && solarResult.cableMm2 <= 25);

  var inverter = storage.applyWiringPreset(pump, "inverter");
  assert.strictEqual(inverter.wiring.preset, "inverter");
  assert.strictEqual(inverter.wiring.useInverterSuggestion, true);
  assert.ok(inverter.wiring.currentA > 100);
});

test("4300 W at 12 V uses about 70 mm² on a short run, 95 mm² if longer", function () {
  var short = calc.calcWiring({
    wiring: {
      systemVoltage: 12,
      inputMode: "watts",
      watts: 4300,
      oneWayLengthM: 1.5,
      dropPct: 3,
      useInverterSuggestion: false,
    },
  });
  assert.ok(Math.abs(short.currentA - 4300 / 12) < 0.0001);
  assert.ok(short.requiredMm2 < 70);
  assert.strictEqual(short.cableMm2, 70);
  assert.ok(short.cableAmps >= short.currentA);
  assert.strictEqual(short.fuseAmps, 400);
  assert.strictEqual(short.overLimit, false);

  var mid = calc.calcWiring({
    wiring: {
      systemVoltage: 12,
      inputMode: "watts",
      watts: 4300,
      oneWayLengthM: 2.5,
      dropPct: 3,
      useInverterSuggestion: false,
    },
  });
  assert.strictEqual(mid.cableMm2, 95);
  assert.ok(mid.fuseAmps >= 400);
  assert.ok(mid.fuseAmps <= mid.cableAmps);

  var fromInverter = calc.calcWiring({
    inverter: {
      systemVoltage: 12,
      efficiencyPct: 88,
      marginPct: 0,
      loads: [{ watts: 4300, surgeWatts: 4300, qty: 1, enabled: true }],
    },
    wiring: {
      systemVoltage: 12,
      useInverterSuggestion: true,
      oneWayLengthM: 1.5,
      dropPct: 3,
    },
  });
  assert.ok(Math.abs(fromInverter.currentA - 4300 / 12) < 0.0001);
  assert.strictEqual(fromInverter.cableMm2, 70);
  assert.strictEqual(fromInverter.fuseAmps, 400);
});

test("over-limit run names the largest listed cable", function () {
  var result = calc.calcWiring({
    wiring: {
      systemVoltage: 12,
      inputMode: "amps",
      currentA: 600,
      oneWayLengthM: 20,
      dropPct: 3,
      useInverterSuggestion: false,
    },
  });
  assert.strictEqual(result.overLimit, true);
  assert.strictEqual(result.maxCableMm2, 185);
  assert.ok(result.maxCableAmps >= 600);
});

test("applying a daily-power preset keeps wiring settings", function () {
  var profile = defaults.createDefaultProfile();
  profile.wiring.preset = "fridge";
  profile.wiring.oneWayLengthM = 4;
  profile.wiring.dropPct = 10;
  profile.wiring.useInverterSuggestion = false;

  var weekend = storage.applyPreset(profile, "weekend");
  assert.strictEqual(weekend.wiring.preset, "fridge");
  assert.strictEqual(weekend.wiring.oneWayLengthM, 4);
  assert.strictEqual(weekend.wiring.dropPct, 10);
  assert.strictEqual(weekend.wiring.useInverterSuggestion, false);
  assert.strictEqual(weekend.dailyPower.activePreset, "weekend");
});

if (failed) {
  console.error("\n" + failed + " test(s) failed");
  process.exit(1);
}

console.log("\nAll tests passed");
