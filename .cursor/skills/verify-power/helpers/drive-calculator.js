#!/usr/bin/env node
"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const lib = require("./lib");
const { launchChrome } = require("./browser");

const TOOLS = {
  daily: {
    title: "Daily power consumption calculator",
    localPath: "/",
    finalPath: "/power/",
  },
  battery: {
    title: "Battery size calculator",
    localPath: "/battery.html",
    finalPath: "/power/battery.html",
  },
  solar: {
    title: "Solar panel size calculator",
    localPath: "/solar.html",
    finalPath: "/power/solar.html",
  },
  inverter: {
    title: "Inverter size calculator",
    localPath: "/inverter.html",
    finalPath: "/power/inverter.html",
  },
  wire: {
    title: "Wire & fuse size calculator",
    localPath: "/wire.html",
    finalPath: "/power/wire.html",
  },
};

function formatNumber(value, digits) {
  return new Intl.NumberFormat("en-GB", {
    maximumFractionDigits: digits,
    minimumFractionDigits: value < 10 && digits > 0 ? Math.min(digits, 1) : 0,
  }).format(value);
}

function formatWh(value) {
  if (value >= 100) return formatNumber(value, 0);
  if (value >= 10) return formatNumber(value, 1);
  return formatNumber(value, 1);
}

function formatAh(value) {
  if (value >= 100) return formatNumber(value, 0);
  return formatNumber(value, 1);
}

function formatWatts(value) {
  if (value >= 100) return formatNumber(value, 0);
  if (value >= 10) return formatNumber(value, 1);
  return formatNumber(value, 1);
}

function formatAmps(value) {
  if (value >= 100) return formatNumber(value, 0);
  if (value >= 10) return formatNumber(value, 1);
  return formatNumber(value, 1);
}

function formatMm2(value) {
  if (!value) return "0";
  return formatNumber(value, value % 1 === 0 ? 0 : 1);
}

function formatVolts(value) {
  if (value >= 10) return formatNumber(value, 1);
  return formatNumber(value, 2);
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(label + " ACTUAL " + JSON.stringify(actual) + " EXPECTED " + JSON.stringify(expected));
  }
}

async function openTool(page, instance, tool) {
  const localUrl = instance.baseUrl + tool.localPath;
  const redirect = await lib.requestOnce(localUrl);
  await page.navigate(localUrl);
  const landed = await page.waitFor(
    "(document.querySelector('h1') && document.querySelector('h1').textContent) || ''"
  );
  assertEqual(landed, tool.title, "h1");
  const href = await page.evaluate("location.href");
  const finalUrl = new URL(href);
  if (finalUrl.origin !== "https://motorhometools.co.uk" || finalUrl.pathname !== tool.finalPath) {
    throw new Error("Landed on " + href + ", wanted https://motorhometools.co.uk" + tool.finalPath);
  }
  const gate = await page.evaluate(
    "getComputedStyle(document.getElementById('rotate-gate')).display"
  );
  assertEqual(gate, "none", "portrait gate");
  return { localUrl: localUrl, redirect: redirect, href: href };
}

async function turnOffOthers(page, customId) {
  const ids = await page.evaluate(
    "[...document.querySelectorAll('input[data-field=\"enabled\"]:checked')].map(function (el) { return el.getAttribute('data-id'); })"
  );
  for (const id of ids) {
    if (id === customId) continue;
    await page.click('input[data-field="enabled"][data-id="' + id + '"]');
  }
}

async function customId(page) {
  await page.waitFor("!!document.querySelector('.name-input')");
  return page.evaluate("document.querySelector('.name-input').getAttribute('data-id')");
}

async function loadCalc(page, scratchDir) {
  const src = await page.evaluate(
    "[...document.scripts].map(function (script) { return script.src; }).find(function (src) { return src.indexOf('calc.js') !== -1; }) || ''"
  );
  if (!src) throw new Error("Page did not load calc.js");
  const response = await fetch(src);
  if (!response.ok) throw new Error("GET " + src + " " + response.status);
  const text = await response.text();
  const file = path.join(scratchDir, "calc.live.js");
  fs.writeFileSync(file, text);
  const calc = require(file);
  return {
    src: src,
    sha256: crypto.createHash("sha256").update(text).digest("hex"),
    calc: calc,
  };
}

async function driveDaily(page, calc) {
  await page.click("#add-custom");
  const id = await customId(page);
  await page.fill("#name-" + id, "Verify lamp");
  await page.fill("#watts-" + id, "100");
  await page.fill("#hours-" + id, "10");
  await page.fill("#qty-" + id, "1");
  await turnOffOthers(page, id);
  const loss = await page.evaluate("document.getElementById('inverter-loss').checked");
  assertEqual(loss, false, "inverter loss checkbox");
  const totals = calc.calcTotals({
    inverterLossEnabled: false,
    appliances: [{ watts: 100, hours: 10, qty: 1, enabled: true }],
  });
  assertEqual(totals.totalWh, 100 * 10 * 1, "formula totalWh");
  assertEqual(totals.ah12, totals.totalWh / 12, "formula ah12");
  assertEqual(totals.ah24, totals.totalWh / 24, "formula ah24");
  const actual = {
    totalWh: await page.evaluate("document.getElementById('total-wh').textContent"),
    ah12: await page.evaluate("document.getElementById('total-ah12').textContent"),
    ah24: await page.evaluate("document.getElementById('total-ah24').textContent"),
  };
  const expected = {
    totalWh: formatWh(totals.totalWh),
    ah12: formatAh(totals.ah12),
    ah24: formatAh(totals.ah24),
  };
  assertEqual(actual.totalWh, expected.totalWh, "#total-wh");
  assertEqual(actual.ah12, expected.ah12, "#total-ah12");
  assertEqual(actual.ah24, expected.ah24, "#total-ah24");
  const stored = await page.evaluate(
    "JSON.parse(localStorage.getItem('powertools.systemProfile')).dailyPower"
  );
  const row = stored.appliances.find(function (item) {
    return item.id === id;
  });
  if (!row || row.watts !== 100 || row.hours !== 10 || row.qty !== 1 || row.enabled !== true) {
    throw new Error("Saved profile does not contain the Verify lamp row");
  }
  const othersOn = stored.appliances.some(function (item) {
    return item.id !== id && item.enabled;
  });
  if (othersOn) throw new Error("Another appliance stayed on");
  return {
    input: "One custom row, Verify lamp, 100 W, 10 hours, quantity 1, other rows off, inverter loss off",
    formula: "Wh = watts × hours × qty. Ah at 12 V = Wh / 12. Ah at 24 V = Wh / 24. No inverter loss.",
    raw: { totalWh: totals.totalWh, ah12: totals.ah12, ah24: totals.ah24 },
    expected: expected,
    actual: actual,
    storageKey: "powertools.systemProfile",
  };
}

async function driveBattery(page, calc) {
  await page.click('button[data-action="use-manual"]');
  await page.waitFor("!document.getElementById('manual-wh-wrap').hidden");
  await page.fill("#manual-wh", "1000");
  await page.fill("#days-autonomy", "2");
  await page.fill("#contingency", "10");
  await page.click('button[data-chemistry="lifepo4"]');
  const result = calc.calcBatteryBank({
    dailyPower: { appliances: [] },
    battery: {
      useManualWh: true,
      manualWh: 1000,
      daysAutonomy: 2,
      chemistry: "lifepo4",
      contingencyPct: 10,
    },
  });
  assertEqual(result.bankWh, (1000 * 2 * 1.1) / 0.8, "formula bankWh");
  const actual = {
    ah12: await page.evaluate("document.getElementById('bank-ah12').textContent"),
    ah24: await page.evaluate("document.getElementById('bank-ah24').textContent"),
    wh: await page.evaluate("document.getElementById('bank-wh').textContent"),
  };
  const expected = {
    ah12: formatAh(result.ah12),
    ah24: formatAh(result.ah24),
    wh: formatWh(result.bankWh),
  };
  assertEqual(actual.ah12, expected.ah12, "#bank-ah12");
  assertEqual(actual.ah24, expected.ah24, "#bank-ah24");
  assertEqual(actual.wh, expected.wh, "#bank-wh");
  return {
    input: "Manual 1000 Wh/day, 2 days, LiFePO4 80% usable, 10% contingency",
    formula: "bankWh = dailyWh × days × (1 + contingency/100) / (usable/100). Ah = bankWh / voltage.",
    raw: { bankWh: result.bankWh, ah12: result.ah12, ah24: result.ah24, usablePct: result.usablePct },
    expected: expected,
    actual: actual,
  };
}

async function driveSolar(page, calc) {
  await page.click('button[data-action="use-manual"]');
  await page.waitFor("!document.getElementById('manual-wh-wrap').hidden");
  await page.fill("#manual-wh", "1000");
  await page.click('button[data-season="spring-autumn"]');
  await page.fill("#peak-sun-hours", "3");
  await page.fill("#loss-pct", "25");
  await page.fill("#margin-pct", "10");
  const result = calc.calcSolarArray({
    dailyPower: { appliances: [] },
    solar: {
      useManualWh: true,
      manualWh: 1000,
      season: "spring-autumn",
      peakSunHours: 3,
      lossPct: 25,
      marginPct: 10,
    },
  });
  const expectedWatts = (1000 * 1.1) / (3 * (1 - 0.25));
  assertEqual(result.arrayWatts, expectedWatts, "formula arrayWatts");
  const actual = {
    arrayWatts: await page.evaluate("document.getElementById('array-watts').textContent"),
    panels100: await page.evaluate("document.getElementById('panels-100').textContent"),
    panels200: await page.evaluate("document.getElementById('panels-200').textContent"),
    panels400: await page.evaluate("document.getElementById('panels-400').textContent"),
  };
  const expected = {
    arrayWatts: formatWatts(result.arrayWatts),
    panels100: "5",
    panels200: "3",
    panels400: "2",
  };
  assertEqual(actual.arrayWatts, expected.arrayWatts, "#array-watts");
  assertEqual(actual.panels100, expected.panels100, "#panels-100");
  assertEqual(actual.panels200, expected.panels200, "#panels-200");
  assertEqual(actual.panels400, expected.panels400, "#panels-400");
  return {
    input: "Manual 1000 Wh/day, 3 peak sun hours, 25% losses, 10% margin",
    formula: "arrayW = dailyWh × (1 + margin/100) / (peakSunHours × (1 - loss/100)). Panel counts round up.",
    raw: { arrayWatts: result.arrayWatts, panels: result.panels },
    expected: expected,
    actual: actual,
  };
}

async function driveInverter(page, calc) {
  await page.click("#add-custom");
  const id = await customId(page);
  await page.fill("#name-" + id, "Verify kettle");
  await page.fill("#watts-" + id, "1000");
  await page.fill("#surgeWatts-" + id, "2000");
  await page.fill("#qty-" + id, "1");
  await turnOffOthers(page, id);
  await page.fill("#efficiency-pct", "88");
  await page.fill("#margin-pct", "20");
  await page.click('button[data-voltage="12"]');
  const result = calc.calcInverter({
    inverter: {
      efficiencyPct: 88,
      marginPct: 20,
      systemVoltage: 12,
      loads: [{ watts: 1000, surgeWatts: 2000, qty: 1, enabled: true }],
    },
  });
  assertEqual(result.recommendedContinuousW, 1000 * 1.2, "formula continuous");
  assertEqual(result.recommendedSurgeW, 2000, "formula surge");
  assertEqual(result.amps12, 1000 / 0.88 / 12, "formula amps12");
  const actual = {
    continuous: await page.evaluate("document.getElementById('inverter-continuous').textContent"),
    surge: await page.evaluate("document.getElementById('inverter-surge').textContent"),
    amps12: await page.evaluate("document.getElementById('inverter-amps12').textContent"),
    amps24: await page.evaluate("document.getElementById('inverter-amps24').textContent"),
  };
  const expected = {
    continuous: formatWatts(result.recommendedContinuousW),
    surge: formatWatts(result.recommendedSurgeW),
    amps12: formatAmps(result.amps12),
    amps24: formatAmps(result.amps24),
  };
  assertEqual(actual.continuous, expected.continuous, "#inverter-continuous");
  assertEqual(actual.surge, expected.surge, "#inverter-surge");
  assertEqual(actual.amps12, expected.amps12, "#inverter-amps12");
  assertEqual(actual.amps24, expected.amps24, "#inverter-amps24");
  return {
    input: "One 230 V load, 1000 W running, 2000 W surge, quantity 1. Efficiency 88%, margin 20%, 12 V selected. Other loads off.",
    formula:
      "Shown continuous W = running W × (1 + margin/100). Shown surge W = max(surge, continuous). Shown amps = running W / efficiency / voltage, without the margin.",
    raw: {
      recommendedContinuousW: result.recommendedContinuousW,
      recommendedSurgeW: result.recommendedSurgeW,
      amps12: result.amps12,
      amps24: result.amps24,
    },
    expected: expected,
    actual: actual,
  };
}

async function driveWire(page, calc) {
  await page.click('button[data-voltage="12"]');
  const manual = await page.evaluate("!!document.querySelector('button[data-action=\"use-manual\"]')");
  if (manual) await page.click('button[data-action="use-manual"]');
  await page.fill("#current-a", "20");
  await page.fill("#one-way-length", "2");
  await page.fill("#drop-pct", "3");
  const result = calc.calcWiring({
    inverter: { loads: [] },
    wiring: {
      systemVoltage: 12,
      useInverterSuggestion: false,
      inputMode: "amps",
      currentA: 20,
      oneWayLengthM: 2,
      dropPct: 3,
      preset: "custom",
    },
  });
  const required = (2 * 20 * 2 * 0.0175) / (12 * 0.03);
  if (Math.abs(result.requiredMm2 - required) > 1e-9) {
    throw new Error("required mm² " + result.requiredMm2 + " != " + required);
  }
  assertEqual(result.cableMm2, 4, "formula cable step");
  assertEqual(result.fuseAmps, 25, "formula fuse");
  const actual = {
    cableMm2: await page.evaluate("document.getElementById('cable-mm2').textContent"),
    fuseAmps: await page.evaluate("document.getElementById('fuse-amps').textContent"),
    amps: await page.evaluate("document.getElementById('wiring-amps').textContent"),
    dropV: await page.evaluate("document.getElementById('drop-v').textContent"),
    dropPct: await page.evaluate("document.getElementById('drop-pct-out').textContent"),
  };
  const expected = {
    cableMm2: formatMm2(result.cableMm2),
    fuseAmps: formatAmps(result.fuseAmps),
    amps: formatAmps(result.currentA),
    dropV: formatVolts(result.dropV),
    dropPct: formatNumber(result.estimatedDropPct, 1),
  };
  assertEqual(actual.cableMm2, expected.cableMm2, "#cable-mm2");
  assertEqual(actual.fuseAmps, expected.fuseAmps, "#fuse-amps");
  assertEqual(actual.amps, expected.amps, "#wiring-amps");
  assertEqual(actual.dropV, expected.dropV, "#drop-v");
  assertEqual(actual.dropPct, expected.dropPct, "#drop-pct-out");
  return {
    input: "12 V, 20 A typed (not the inverter suggestion), 2 m one way, 3% allowed drop",
    formula:
      "required mm² = (2 × amps × one-way metres × 0.0175) / allowed volts. Allowed volts = voltage × drop% / 100. Next cable step that also covers the amps. Fuse is the step at or above 1.1 × amps that still fits the cable rating.",
    raw: {
      requiredMm2: result.requiredMm2,
      cableMm2: result.cableMm2,
      fuseAmps: result.fuseAmps,
      dropV: result.dropV,
      estimatedDropPct: result.estimatedDropPct,
    },
    expected: expected,
    actual: actual,
  };
}

const DRIVERS = {
  daily: driveDaily,
  battery: driveBattery,
  solar: driveSolar,
  inverter: driveInverter,
  wire: driveWire,
};

async function main() {
  const name = process.argv[2];
  const tool = TOOLS[name];
  if (!tool) {
    console.error("Usage: node helpers/drive-calculator.js <daily|battery|solar|inverter|wire>");
    process.exit(2);
  }
  const instance = lib.requireInstance();
  const scratch = lib.runDir(instance.runId);
  fs.mkdirSync(scratch, { recursive: true });
  const userData = path.join(scratch, "chrome-" + name);
  const chrome = await launchChrome(userData);
  fs.writeFileSync(path.join(scratch, "chrome.pid"), String(chrome.pid));
  try {
    const opened = await openTool(chrome.page, instance, tool);
    const loaded = await loadCalc(chrome.page, scratch);
    const result = await DRIVERS[name](chrome.page, loaded.calc);
    const evidence = lib.evidenceDir(instance.runId);
    fs.mkdirSync(evidence, { recursive: true });
    const png = path.join(evidence, name + ".png");
    await chrome.page.screenshot(png);
    const report = {
      tool: name,
      runId: instance.runId,
      checkedAt: new Date().toISOString(),
      localUrl: opened.localUrl,
      redirectStatus: opened.redirect.status,
      redirectLocation: opened.redirect.location,
      landed: opened.href,
      calcScript: loaded.src,
      calcSha256: loaded.sha256,
      pass: true,
      input: result.input,
      formula: result.formula,
      raw: result.raw,
      expected: result.expected,
      actual: result.actual,
      screenshot: png,
    };
    const json = path.join(evidence, name + ".json");
    fs.writeFileSync(json, JSON.stringify(report, null, 2));
    console.log("ok  " + name);
    console.log(JSON.stringify({ expected: result.expected, actual: result.actual }));
    console.log("evidence " + json);
    console.log("evidence " + png);
  } finally {
    await chrome.close();
    const pidFile = path.join(scratch, "chrome.pid");
    if (fs.existsSync(pidFile)) fs.rmSync(pidFile);
  }
}

main().catch(function (err) {
  console.error(err.stack || err.message || err);
  process.exit(1);
});
