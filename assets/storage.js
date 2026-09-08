/**
 * Shared Power Tools system profile in localStorage.
 * Later slices (solar, inverter, wiring) should reuse STORAGE_KEY
 * and add sibling keys beside `dailyPower` and `battery` rather than
 * creating new keys.
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

  function sanitiseProfile(raw) {
    var profile = {
      version: PROFILE_VERSION,
      dailyPower: sanitiseDailyPower(raw && raw.dailyPower),
      battery: sanitiseBattery(raw && raw.battery),
    };

    if (raw && typeof raw === "object") {
      Object.keys(raw).forEach(function (key) {
        if (key !== "version" && key !== "dailyPower" && key !== "battery") {
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
    applyPreset: applyPreset,
  };
});
