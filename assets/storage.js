/**
 * Shared Power Tools system profile in localStorage.
 * Later slices (battery, solar, inverter, wiring) should reuse STORAGE_KEY
 * and add sibling keys beside `dailyPower` rather than creating new keys.
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

  function sanitiseDailyPower(raw) {
    var fallback = emptyDailyPower();
    var source = raw && typeof raw === "object" ? raw : {};
    var appliances = Array.isArray(source.appliances) ? source.appliances : fallback.appliances;

    return {
      inverterLossEnabled: !!source.inverterLossEnabled,
      inverterLossPct: PowerCalc.clamp(
        PowerCalc.toNumber(source.inverterLossPct, fallback.inverterLossPct),
        0,
        50
      ),
      appliances: appliances.map(function (item, index) {
        var normalised = PowerCalc.normaliseAppliance(item);
        if (!normalised.id) {
          normalised.id = "item-" + index;
        }
        if (item && item.custom) {
          normalised.custom = true;
        }
        return normalised;
      }),
    };
  }

  function sanitiseProfile(raw) {
    var profile = {
      version: PROFILE_VERSION,
      dailyPower: sanitiseDailyPower(raw && raw.dailyPower),
    };

    if (raw && typeof raw === "object") {
      Object.keys(raw).forEach(function (key) {
        if (key !== "version" && key !== "dailyPower") {
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
    applyPreset: applyPreset,
  };
});
