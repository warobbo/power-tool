/**
 * Pure daily-power, battery, solar-array, and inverter maths. Works in the browser and in Node tests.
 * Ah figures assume a simple Wh / system-voltage conversion (no Peukert).
 * Inverter DC amps assume AC watts ÷ efficiency ÷ system voltage.
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
  var DEFAULT_SOLAR_LOSS_PCT = 25;
  var DEFAULT_SOLAR_MARGIN_PCT = 10;
  var DEFAULT_PEAK_SUN_HOURS = 3;
  var MIN_PEAK_SUN_HOURS = 0.5;
  var MAX_PEAK_SUN_HOURS = 12;
  var PANEL_WATTS = [100, 200, 400];
  var SEASON_HOURS = {
    summer: 4.5,
    "spring-autumn": 3,
    winter: 1.2,
  };
  var DEFAULT_INVERTER_EFFICIENCY_PCT = 88;
  var DEFAULT_INVERTER_MARGIN_PCT = 20;
  var MIN_INVERTER_EFFICIENCY_PCT = 50;
  var MAX_INVERTER_EFFICIENCY_PCT = 100;

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

  function resolveDailyWhForSlice(profile, sliceName) {
    var settings = profile && sliceName ? profile[sliceName] : null;
    if (settings && settings.useManualWh) {
      return clamp(toNumber(settings.manualWh, 0), 0, 100000);
    }
    return calcTotals(profile && profile.dailyPower).totalWh;
  }

  function resolveDailyWh(profile) {
    return resolveDailyWhForSlice(profile, "battery");
  }

  function resolveSolarDailyWh(profile) {
    return resolveDailyWhForSlice(profile, "solar");
  }

  function sanitiseSeason(value) {
    if (value === "summer" || value === "winter" || value === "custom") return value;
    return "spring-autumn";
  }

  function seasonPeakSunHours(season) {
    var hours = SEASON_HOURS[sanitiseSeason(season)];
    return hours || DEFAULT_PEAK_SUN_HOURS;
  }

  function matchSeasonForHours(hours) {
    var peak = toNumber(hours, NaN);
    var ids = Object.keys(SEASON_HOURS);
    for (var i = 0; i < ids.length; i += 1) {
      if (Math.abs(SEASON_HOURS[ids[i]] - peak) < 0.05) return ids[i];
    }
    return "custom";
  }

  function panelCounts(arrayWatts) {
    var watts = Math.max(0, toNumber(arrayWatts, 0));
    return PANEL_WATTS.map(function (size) {
      return {
        watts: size,
        count: watts > 0 ? Math.ceil(watts / size) : 0,
      };
    });
  }

  function calcSolarArray(profile) {
    var solar = (profile && profile.solar) || {};
    var season = sanitiseSeason(solar.season);
    var peakSunHours = clamp(
      toNumber(solar.peakSunHours, seasonPeakSunHours(season)),
      MIN_PEAK_SUN_HOURS,
      MAX_PEAK_SUN_HOURS
    );
    var lossPct = clamp(toNumber(solar.lossPct, DEFAULT_SOLAR_LOSS_PCT), 0, 70);
    var marginPct = clamp(toNumber(solar.marginPct, DEFAULT_SOLAR_MARGIN_PCT), 0, 50);
    var useManualWh = !!solar.useManualWh;
    var dailyWh = resolveSolarDailyWh(profile);
    var energyNeededWh = dailyWh * (1 + marginPct / 100);
    var efficiency = 1 - lossPct / 100;
    var effectiveHours = peakSunHours * efficiency;
    var arrayWatts = effectiveHours > 0 ? energyNeededWh / effectiveHours : 0;
    var supportedWh = arrayWatts * effectiveHours;

    return {
      dailyWh: dailyWh,
      season: season,
      peakSunHours: peakSunHours,
      lossPct: lossPct,
      marginPct: marginPct,
      useManualWh: useManualWh,
      source: useManualWh ? "manual" : "dailyPower",
      energyNeededWh: energyNeededWh,
      marginWh: energyNeededWh - dailyWh,
      efficiency: efficiency,
      effectiveHours: effectiveHours,
      arrayWatts: arrayWatts,
      supportedWh: supportedWh,
      panels: panelCounts(arrayWatts),
    };
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

  function sanitiseSystemVoltage(value) {
    return toNumber(value, VOLTAGE_12) === VOLTAGE_24 ? VOLTAGE_24 : VOLTAGE_12;
  }

  function normaliseInverterLoad(raw) {
    var watts = clamp(toNumber(raw && raw.watts, 0), 0, 20000);
    var surgeFallback = raw && raw.surgeWatts != null ? raw.surgeWatts : watts;
    return {
      id: raw && raw.id ? String(raw.id) : "",
      name: raw && raw.name ? String(raw.name) : "",
      watts: watts,
      surgeWatts: clamp(toNumber(surgeFallback, watts), 0, 40000),
      qty: clamp(Math.round(toNumber(raw && raw.qty, 1)), 1, 99),
      enabled: !!(raw && raw.enabled),
      custom: !!(raw && raw.custom),
    };
  }

  function inverterLoadRunningW(load) {
    var item = normaliseInverterLoad(load);
    if (!item.enabled) return 0;
    return item.watts * item.qty;
  }

  function inverterLoadSurgeW(load) {
    var item = normaliseInverterLoad(load);
    if (!item.enabled) return 0;
    return Math.max(item.surgeWatts, item.watts) * item.qty;
  }

  function calcInverter(profile) {
    var settings = (profile && profile.inverter) || {};
    var loads = Array.isArray(settings.loads) ? settings.loads : [];
    var items = loads.map(function (load) {
      var item = normaliseInverterLoad(load);
      var runningW = item.enabled ? item.watts * item.qty : 0;
      var surgeW = item.enabled ? Math.max(item.surgeWatts, item.watts) * item.qty : 0;
      return {
        id: item.id,
        name: item.name,
        enabled: item.enabled,
        custom: item.custom,
        watts: item.watts,
        surgeWatts: item.surgeWatts,
        qty: item.qty,
        runningW: runningW,
        surgeW: surgeW,
      };
    });

    var continuousLoadW = items.reduce(function (sum, item) {
      return sum + item.runningW;
    }, 0);
    var highestSurgeW = items.reduce(function (maxW, item) {
      return Math.max(maxW, item.surgeW);
    }, 0);
    var combinedSurgeW = items.reduce(function (maxW, item) {
      if (!item.enabled) return maxW;
      return Math.max(maxW, continuousLoadW - item.runningW + item.surgeW);
    }, continuousLoadW);

    var efficiencyPct = clamp(
      toNumber(settings.efficiencyPct, DEFAULT_INVERTER_EFFICIENCY_PCT),
      MIN_INVERTER_EFFICIENCY_PCT,
      MAX_INVERTER_EFFICIENCY_PCT
    );
    var marginPct = clamp(
      toNumber(settings.marginPct, DEFAULT_INVERTER_MARGIN_PCT),
      0,
      50
    );
    var systemVoltage = sanitiseSystemVoltage(settings.systemVoltage);
    var efficiency = efficiencyPct / 100;
    var recommendedContinuousW = continuousLoadW * (1 + marginPct / 100);
    var recommendedSurgeW = Math.max(combinedSurgeW, recommendedContinuousW);
    var dcLoadW = efficiency > 0 ? continuousLoadW / efficiency : 0;
    var dcRecommendedW = efficiency > 0 ? recommendedContinuousW / efficiency : 0;
    var dcSurgeW = efficiency > 0 ? recommendedSurgeW / efficiency : 0;

    return {
      items: items,
      continuousLoadW: continuousLoadW,
      highestSurgeW: highestSurgeW,
      combinedSurgeW: combinedSurgeW,
      marginPct: marginPct,
      marginW: recommendedContinuousW - continuousLoadW,
      efficiencyPct: efficiencyPct,
      systemVoltage: systemVoltage,
      recommendedContinuousW: recommendedContinuousW,
      recommendedSurgeW: recommendedSurgeW,
      dcLoadW: dcLoadW,
      dcRecommendedW: dcRecommendedW,
      dcSurgeW: dcSurgeW,
      amps12: dcLoadW / VOLTAGE_12,
      amps24: dcLoadW / VOLTAGE_24,
      surgeAmps12: dcSurgeW / VOLTAGE_12,
      surgeAmps24: dcSurgeW / VOLTAGE_24,
      selectedAmps: systemVoltage === VOLTAGE_24 ? dcLoadW / VOLTAGE_24 : dcLoadW / VOLTAGE_12,
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
    DEFAULT_SOLAR_LOSS_PCT: DEFAULT_SOLAR_LOSS_PCT,
    DEFAULT_SOLAR_MARGIN_PCT: DEFAULT_SOLAR_MARGIN_PCT,
    DEFAULT_PEAK_SUN_HOURS: DEFAULT_PEAK_SUN_HOURS,
    MIN_PEAK_SUN_HOURS: MIN_PEAK_SUN_HOURS,
    MAX_PEAK_SUN_HOURS: MAX_PEAK_SUN_HOURS,
    PANEL_WATTS: PANEL_WATTS,
    SEASON_HOURS: SEASON_HOURS,
    resolveDailyWh: resolveDailyWh,
    resolveSolarDailyWh: resolveSolarDailyWh,
    resolveDailyWhForSlice: resolveDailyWhForSlice,
    sanitiseSeason: sanitiseSeason,
    seasonPeakSunHours: seasonPeakSunHours,
    matchSeasonForHours: matchSeasonForHours,
    panelCounts: panelCounts,
    calcBatteryBank: calcBatteryBank,
    calcSolarArray: calcSolarArray,
    DEFAULT_INVERTER_EFFICIENCY_PCT: DEFAULT_INVERTER_EFFICIENCY_PCT,
    DEFAULT_INVERTER_MARGIN_PCT: DEFAULT_INVERTER_MARGIN_PCT,
    MIN_INVERTER_EFFICIENCY_PCT: MIN_INVERTER_EFFICIENCY_PCT,
    MAX_INVERTER_EFFICIENCY_PCT: MAX_INVERTER_EFFICIENCY_PCT,
    sanitiseSystemVoltage: sanitiseSystemVoltage,
    normaliseInverterLoad: normaliseInverterLoad,
    inverterLoadRunningW: inverterLoadRunningW,
    inverterLoadSurgeW: inverterLoadSurgeW,
    calcInverter: calcInverter,
  };
});
