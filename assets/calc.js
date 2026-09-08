/**
 * Pure daily-power maths. Works in the browser and in Node tests.
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

  return {
    DEFAULT_INVERTER_LOSS_PCT: DEFAULT_INVERTER_LOSS_PCT,
    VOLTAGE_12: VOLTAGE_12,
    VOLTAGE_24: VOLTAGE_24,
    toNumber: toNumber,
    clamp: clamp,
    normaliseAppliance: normaliseAppliance,
    applianceWh: applianceWh,
    applyInverterLoss: applyInverterLoss,
    calcTotals: calcTotals,
  };
});
