/**
 * Shared Power Tools system profile in localStorage.
 * Later slices should reuse STORAGE_KEY
 * and add sibling keys beside `dailyPower`, `battery`, `solar`, `inverter`, and `wiring`
 * rather than creating new keys.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./calc.js"), require("./defaults.js"));
  } else {
    root.PowerStorage = factory(root.PowerCalc, root.PowerDefaults);
  }
})(typeof self !== "undefined" ? self : this, function (PowerCalc, PowerDefaults) {
  "use strict";

  var STORAGE_KEY = "powertools.systemProfile";
  var PROFILE_VERSION = 1;

  function emptyDailyPower() {
    return PowerDefaults.createDefaultProfile().dailyPower;
  }

  function sanitiseActivePreset(value) {
    return value && PowerDefaults.PRESETS[value] ? value : "";
  }

  function mergeStarterAppliances(saved) {
    var starters = PowerDefaults.starterSet();
    var starterIndex = {};
    var savedById = {};
    var extras = [];
    var customs = [];

    starters.forEach(function (item, index) {
      starterIndex[item.id] = index;
    });

    saved.forEach(function (item) {
      if (item.custom) {
        customs.push(item);
        return;
      }
      if (Object.prototype.hasOwnProperty.call(starterIndex, item.id)) {
        savedById[item.id] = item;
        return;
      }
      extras.push(item);
    });

    var merged = starters.map(function (starter) {
      var existing = savedById[starter.id];
      return existing || PowerCalc.normaliseAppliance(starter);
    });

    return merged.concat(extras, customs);
  }

  function sanitiseDailyPower(raw) {
    var fallback = emptyDailyPower();
    var source = raw && typeof raw === "object" ? raw : {};
    var appliances = Array.isArray(source.appliances) ? source.appliances : fallback.appliances;
    var normalised = appliances.map(function (item, index) {
      var next = PowerCalc.normaliseAppliance(item);
      if (!next.id) {
        next.id = "item-" + index;
      }
      if (item && item.custom) {
        next.custom = true;
      }
      return next;
    });

    return {
      inverterLossEnabled: !!source.inverterLossEnabled,
      inverterLossPct: PowerCalc.clamp(
        PowerCalc.toNumber(source.inverterLossPct, fallback.inverterLossPct),
        0,
        50
      ),
      activePreset: sanitiseActivePreset(source.activePreset),
      appliances: mergeStarterAppliances(normalised),
    };
  }

  function sanitiseBattery(raw) {
    var fallback = PowerDefaults.createDefaultBattery();
    var source = raw && typeof raw === "object" ? raw : {};
    var chemistry = PowerCalc.sanitiseChemistry(source.chemistry || fallback.chemistry);
    var customUsablePct = PowerCalc.clamp(
      PowerCalc.toNumber(source.customUsablePct, fallback.customUsablePct),
      10,
      100
    );

    return {
      daysAutonomy: PowerCalc.clamp(
        PowerCalc.toNumber(source.daysAutonomy, fallback.daysAutonomy),
        0.5,
        14
      ),
      chemistry: chemistry,
      customUsablePct: customUsablePct,
      contingencyPct: PowerCalc.clamp(
        PowerCalc.toNumber(source.contingencyPct, fallback.contingencyPct),
        0,
        50
      ),
      useManualWh: !!source.useManualWh,
      manualWh: PowerCalc.clamp(PowerCalc.toNumber(source.manualWh, fallback.manualWh), 0, 100000),
    };
  }

  function sanitiseSolar(raw) {
    var fallback = PowerDefaults.createDefaultSolar();
    var source = raw && typeof raw === "object" ? raw : {};
    var season = PowerCalc.sanitiseSeason(source.season || fallback.season);
    var defaultHours = PowerCalc.seasonPeakSunHours(season);

    return {
      season: season,
      peakSunHours: PowerCalc.clamp(
        PowerCalc.toNumber(source.peakSunHours, defaultHours),
        PowerCalc.MIN_PEAK_SUN_HOURS,
        PowerCalc.MAX_PEAK_SUN_HOURS
      ),
      lossPct: PowerCalc.clamp(
        PowerCalc.toNumber(source.lossPct, fallback.lossPct),
        0,
        70
      ),
      marginPct: PowerCalc.clamp(
        PowerCalc.toNumber(source.marginPct, fallback.marginPct),
        0,
        50
      ),
      useManualWh: !!source.useManualWh,
      manualWh: PowerCalc.clamp(PowerCalc.toNumber(source.manualWh, fallback.manualWh), 0, 100000),
    };
  }

  function mergeStarterInverterLoads(saved) {
    var starters = PowerDefaults.inverterStarterSet();
    var starterIndex = {};
    var savedById = {};
    var extras = [];
    var customs = [];

    starters.forEach(function (item, index) {
      starterIndex[item.id] = index;
    });

    saved.forEach(function (item) {
      if (item.custom) {
        customs.push(item);
        return;
      }
      if (Object.prototype.hasOwnProperty.call(starterIndex, item.id)) {
        savedById[item.id] = item;
        return;
      }
      if (PowerDefaults.RETIRED_INVERTER_LOAD_IDS.indexOf(item.id) !== -1) {
        return;
      }
      extras.push(item);
    });

    var merged = starters.map(function (starter) {
      var existing = savedById[starter.id];
      return existing || PowerCalc.normaliseInverterLoad(starter);
    });

    return merged.concat(extras, customs);
  }

  function sanitiseInverter(raw) {
    var fallback = PowerDefaults.createDefaultInverter();
    var source = raw && typeof raw === "object" ? raw : {};
    var loads = Array.isArray(source.loads) ? source.loads : fallback.loads;
    var normalised = loads.map(function (item, index) {
      var next = PowerCalc.normaliseInverterLoad(item);
      if (!next.id) {
        next.id = "inverter-item-" + index;
      }
      if (item && item.custom) {
        next.custom = true;
      }
      return next;
    });

    return {
      systemVoltage: PowerCalc.sanitiseSystemVoltage(
        source.systemVoltage != null ? source.systemVoltage : fallback.systemVoltage
      ),
      efficiencyPct: PowerCalc.clamp(
        PowerCalc.toNumber(source.efficiencyPct, fallback.efficiencyPct),
        PowerCalc.MIN_INVERTER_EFFICIENCY_PCT,
        PowerCalc.MAX_INVERTER_EFFICIENCY_PCT
      ),
      marginPct: PowerCalc.clamp(
        PowerCalc.toNumber(source.marginPct, fallback.marginPct),
        0,
        50
      ),
      loads: mergeStarterInverterLoads(normalised),
    };
  }

  function sanitiseWiring(raw) {
    var fallback = PowerDefaults.createDefaultWiring();
    var source = raw && typeof raw === "object" ? raw : {};
    var preset = PowerCalc.sanitiseWiringPreset(source.preset || fallback.preset);
    var systemVoltage = PowerCalc.sanitiseSystemVoltage(
      source.systemVoltage != null ? source.systemVoltage : fallback.systemVoltage
    );
    var inputMode = PowerCalc.sanitiseWiringInputMode(source.inputMode || fallback.inputMode);
    var currentA = PowerCalc.clamp(
      PowerCalc.toNumber(source.currentA, fallback.currentA),
      0,
      PowerCalc.MAX_WIRING_AMPS
    );
    var watts = PowerCalc.clamp(
      PowerCalc.toNumber(source.watts, fallback.watts),
      0,
      PowerCalc.MAX_WIRING_WATTS
    );

    return {
      preset: preset,
      systemVoltage: systemVoltage,
      inputMode: inputMode,
      currentA: currentA,
      watts: watts,
      oneWayLengthM: PowerCalc.clamp(
        PowerCalc.toNumber(source.oneWayLengthM, fallback.oneWayLengthM),
        PowerCalc.MIN_WIRING_LENGTH_M,
        PowerCalc.MAX_WIRING_LENGTH_M
      ),
      dropPct: PowerCalc.sanitiseDropPct(
        source.dropPct != null ? source.dropPct : fallback.dropPct
      ),
      useInverterSuggestion: source.useInverterSuggestion != null
        ? !!source.useInverterSuggestion
        : fallback.useInverterSuggestion,
    };
  }

  function applyWiringPreset(profile, presetId) {
    var preset = PowerDefaults.WIRING_PRESETS[presetId];
    if (!preset) return profile;

    var next = sanitiseProfile(profile);
    next.wiring.preset = preset.id;
    next.wiring.oneWayLengthM = preset.oneWayLengthM;
    next.wiring.dropPct = preset.dropPct;
    next.wiring.inputMode = preset.inputMode || "amps";
    next.wiring.useInverterSuggestion = !!preset.useInverterSuggestion;

    if (preset.useInverterSuggestion) {
      next.wiring.systemVoltage = next.inverter.systemVoltage;
      var suggested = PowerCalc.resolveInverterSuggestedAmps(next, next.wiring.systemVoltage);
      if (suggested > 0) {
        next.wiring.currentA = suggested;
        next.wiring.watts = PowerCalc.wattsFromCurrent(suggested, next.wiring.systemVoltage);
      }
      return next;
    }

    if (preset.typicalWatts != null) {
      next.wiring.watts = preset.typicalWatts;
      next.wiring.currentA = PowerCalc.currentFromWatts(preset.typicalWatts, next.wiring.systemVoltage);
      next.wiring.inputMode = "watts";
    }
    if (preset.typicalAmps != null) {
      next.wiring.currentA = preset.typicalAmps;
      next.wiring.watts = PowerCalc.wattsFromCurrent(preset.typicalAmps, next.wiring.systemVoltage);
      next.wiring.inputMode = "amps";
    }
    return next;
  }

  function sanitiseProfile(raw) {
    var profile = {
      version: PROFILE_VERSION,
      dailyPower: sanitiseDailyPower(raw && raw.dailyPower),
      battery: sanitiseBattery(raw && raw.battery),
      solar: sanitiseSolar(raw && raw.solar),
      inverter: sanitiseInverter(raw && raw.inverter),
      wiring: sanitiseWiring(raw && raw.wiring),
    };

    if (raw && typeof raw === "object") {
      Object.keys(raw).forEach(function (key) {
        if (
          key !== "version" &&
          key !== "dailyPower" &&
          key !== "battery" &&
          key !== "solar" &&
          key !== "inverter" &&
          key !== "wiring"
        ) {
          profile[key] = raw[key];
        }
      });
    }

    return profile;
  }

  function loadProfile() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return PowerDefaults.createDefaultProfile();
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") {
        return PowerDefaults.createDefaultProfile();
      }
      return sanitiseProfile(parsed);
    } catch (err) {
      return PowerDefaults.createDefaultProfile();
    }
  }

  function saveProfile(profile) {
    var clean = sanitiseProfile(profile);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
    return clean;
  }

  function applyPreset(profile, presetId) {
    var preset = PowerDefaults.PRESETS[presetId];
    if (!preset) return profile;

    var next = sanitiseProfile(profile);
    var customRows = preset.keepCustom
      ? next.dailyPower.appliances.filter(function (item) {
          return item.custom;
        })
      : [];

    next.dailyPower = {
      inverterLossEnabled: !!preset.inverterLossEnabled,
      inverterLossPct: preset.inverterLossPct,
      activePreset: presetId,
      appliances: preset.appliances.map(PowerCalc.normaliseAppliance).concat(customRows),
    };

    return next;
  }

  return {
    STORAGE_KEY: STORAGE_KEY,
    PROFILE_VERSION: PROFILE_VERSION,
    loadProfile: loadProfile,
    saveProfile: saveProfile,
    sanitiseProfile: sanitiseProfile,
    sanitiseDailyPower: sanitiseDailyPower,
    sanitiseBattery: sanitiseBattery,
    sanitiseSolar: sanitiseSolar,
    sanitiseInverter: sanitiseInverter,
    sanitiseWiring: sanitiseWiring,
    applyPreset: applyPreset,
    applyWiringPreset: applyWiringPreset,
  };
});
