/**
 * Pure daily-power and battery-bank maths. Works in the browser and in Node tests.
 * Ah figures assume a simple Wh / system-voltage conversion (no Peukert).
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.PowerCalc = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var DEFAULT_INVERTER_LOSS_PCT = 12;
  var VOLTAGE_12 = 12;
  var VOLTAGE_24 = 24;
  var LIFEPO4_USABLE_PCT = 80;
  var AGM_USABLE_PCT = 50;
  var DEFAULT_DAYS_AUTONOMY = 2;
  var DEFAULT_CONTINGENCY_PCT = 10;
  var DEFAULT_CUSTOM_USABLE_PCT = 80;

  function toNumber(value, fallback) {
    var n = typeof value === "number" ? value : parseFloat(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function normaliseAppliance(raw) {
    return {
      id: raw && raw.id ? String(raw.id) : "",
      name: raw && raw.name ? String(raw.name) : "",
      watts: clamp(toNumber(raw && raw.watts, 0), 0, 20000),
      hours: clamp(toNumber(raw && raw.hours, 0), 0, 24),
      qty: clamp(Math.round(toNumber(raw && raw.qty, 1)), 1, 99),
      enabled: !!(raw && raw.enabled),
      custom: !!(raw && raw.custom),
    };
  }

  function applianceWh(appliance) {
    var item = normaliseAppliance(appliance);
    if (!item.enabled) return 0;
    return item.watts * item.hours * item.qty;
  }

  function applyInverterLoss(wh, enabled, pct) {
    if (!enabled) return wh;
    var loss = clamp(toNumber(pct, DEFAULT_INVERTER_LOSS_PCT), 0, 50);
    return wh * (1 + loss / 100);
  }

  function calcTotals(profile) {
    var appliances = (profile && profile.appliances) || [];
    var items = appliances.map(function (appliance) {
      var item = normaliseAppliance(appliance);
      return {
        id: item.id,
        name: item.name,
        enabled: item.enabled,
        custom: item.custom,
        watts: item.watts,
        hours: item.hours,
        qty: item.qty,
        wh: applianceWh(item),
      };
    });

    var loadWh = items.reduce(function (sum, item) {
      return sum + item.wh;
    }, 0);

    var inverterLossEnabled = !!(profile && profile.inverterLossEnabled);
    var inverterLossPct = toNumber(
      profile && profile.inverterLossPct,
      DEFAULT_INVERTER_LOSS_PCT
    );
    var totalWh = applyInverterLoss(loadWh, inverterLossEnabled, inverterLossPct);

    return {
      items: items,
      loadWh: loadWh,
      totalWh: totalWh,
      inverterLossEnabled: inverterLossEnabled,
      inverterLossPct: clamp(inverterLossPct, 0, 50),
      inverterLossWh: totalWh - loadWh,
      ah12: totalWh / VOLTAGE_12,
      ah24: totalWh / VOLTAGE_24,
    };
  }

  function sanitiseChemistry(value) {
    if (value === "agm" || value === "custom") return value;
    return "lifepo4";
  }

  function chemistryUsablePct(chemistry, customUsablePct) {
    var kind = sanitiseChemistry(chemistry);
    if (kind === "agm") return AGM_USABLE_PCT;
    if (kind === "custom") {
      return clamp(toNumber(customUsablePct, DEFAULT_CUSTOM_USABLE_PCT), 10, 100);
    }
    return LIFEPO4_USABLE_PCT;
  }

  function resolveDailyWh(profile) {
    var battery = profile && profile.battery;
    if (battery && battery.useManualWh) {
      return clamp(toNumber(battery.manualWh, 0), 0, 100000);
    }
    return calcTotals(profile && profile.dailyPower).totalWh;
  }

  function calcBatteryBank(profile) {
    var battery = (profile && profile.battery) || {};
    var chemistry = sanitiseChemistry(battery.chemistry);
    var daysAutonomy = clamp(toNumber(battery.daysAutonomy, DEFAULT_DAYS_AUTONOMY), 0.5, 14);
    var customUsablePct = clamp(
      toNumber(battery.customUsablePct, DEFAULT_CUSTOM_USABLE_PCT),
      10,
      100
    );
    var usablePct = chemistryUsablePct(chemistry, customUsablePct);
    var contingencyPct = clamp(
      toNumber(battery.contingencyPct, DEFAULT_CONTINGENCY_PCT),
      0,
      50
    );
    var useManualWh = !!battery.useManualWh;
    var dailyWh = resolveDailyWh(profile);
    var daysWh = dailyWh * daysAutonomy;
    var energyNeededWh = daysWh * (1 + contingencyPct / 100);
    var bankWh = usablePct > 0 ? energyNeededWh / (usablePct / 100) : 0;

    return {
      dailyWh: dailyWh,
      daysAutonomy: daysAutonomy,
      chemistry: chemistry,
      usablePct: usablePct,
      customUsablePct: customUsablePct,
      contingencyPct: contingencyPct,
      useManualWh: useManualWh,
      source: useManualWh ? "manual" : "dailyPower",
      daysWh: daysWh,
      energyNeededWh: energyNeededWh,
      contingencyWh: energyNeededWh - daysWh,
      bankWh: bankWh,
      ah12: bankWh / VOLTAGE_12,
      ah24: bankWh / VOLTAGE_24,
    };
  }

  return {
    DEFAULT_INVERTER_LOSS_PCT: DEFAULT_INVERTER_LOSS_PCT,
    VOLTAGE_12: VOLTAGE_12,
    VOLTAGE_24: VOLTAGE_24,
    LIFEPO4_USABLE_PCT: LIFEPO4_USABLE_PCT,
    AGM_USABLE_PCT: AGM_USABLE_PCT,
    DEFAULT_DAYS_AUTONOMY: DEFAULT_DAYS_AUTONOMY,
    DEFAULT_CONTINGENCY_PCT: DEFAULT_CONTINGENCY_PCT,
    DEFAULT_CUSTOM_USABLE_PCT: DEFAULT_CUSTOM_USABLE_PCT,
    toNumber: toNumber,
    clamp: clamp,
    normaliseAppliance: normaliseAppliance,
    applianceWh: applianceWh,
    applyInverterLoss: applyInverterLoss,
    calcTotals: calcTotals,
    sanitiseChemistry: sanitiseChemistry,
    chemistryUsablePct: chemistryUsablePct,
    resolveDailyWh: resolveDailyWh,
    calcBatteryBank: calcBatteryBank,
  };
});
