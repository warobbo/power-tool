/**
 * Starter appliances and named presets for UK/EU campervan use.
 * Watts are typical nameplate / running draws — users should edit them.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.PowerDefaults = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var STARTER_IDS = [
    "fridge",
    "lights",
    "pump",
    "heater",
    "phone",
    "laptop",
    "fan",
    "water-heater",
    "kettle",
    "induction-hob",
    "tv",
    "inverter-idle",
  ];

  function appliance(id, name, watts, hours, qty, enabled) {
    return {
      id: id,
      name: name,
      watts: watts,
      hours: hours,
      qty: qty,
      enabled: enabled,
      custom: false,
    };
  }

  function starterSet(overrides) {
    var base = [
      appliance("fridge", "Compressor fridge", 45, 10, 1, true),
      appliance("lights", "LED lights", 8, 4, 1, true),
      appliance("pump", "Water pump", 42, 0.25, 1, true),
      appliance("heater", "Diesel heater / fan (low draw)", 18, 4, 1, true),
      appliance("phone", "Phone / tablet charge", 10, 2, 2, true),
      appliance("laptop", "Laptop", 60, 2, 1, true),
      appliance("fan", "MaxxFan / roof fan", 24, 3, 1, true),
      appliance("water-heater", "Water heater (electric when used)", 1000, 0.25, 1, false),
      appliance("kettle", "Kettle", 1200, 0.15, 1, false),
      appliance("induction-hob", "1-ring induction hob", 1600, 0.4, 1, false),
      appliance("tv", "TV / monitor", 28, 2, 1, true),
      appliance("inverter-idle", "Inverter idle / phantom load", 8, 8, 1, true),
    ];

    if (!overrides) return base;

    return base.map(function (item) {
      var extra = overrides[item.id];
      if (!extra) return item;
      return Object.assign({}, item, extra);
    });
  }

  var PRESET_ORDER = ["weekend", "family", "fulltime", "defaults"];

  var PRESETS = {
    defaults: {
      label: "Reset to defaults",
      inverterLossEnabled: false,
      inverterLossPct: 12,
      appliances: starterSet(),
      keepCustom: false,
    },
    weekend: {
      label: "Light weekend (2 people)",
      inverterLossEnabled: false,
      inverterLossPct: 12,
      keepCustom: true,
      appliances: starterSet({
        fridge: { watts: 45, hours: 8, qty: 1, enabled: true },
        lights: { watts: 8, hours: 3, qty: 1, enabled: true },
        pump: { watts: 42, hours: 0.2, qty: 1, enabled: true },
        heater: { watts: 18, hours: 2, qty: 1, enabled: true },
        phone: { watts: 10, hours: 2, qty: 2, enabled: true },
        laptop: { watts: 60, hours: 1, qty: 1, enabled: true },
        fan: { watts: 24, hours: 2, qty: 1, enabled: true },
        "water-heater": { watts: 1000, hours: 0, qty: 1, enabled: false },
        kettle: { watts: 1200, hours: 0.1, qty: 1, enabled: false },
        "induction-hob": { watts: 1600, hours: 0, qty: 1, enabled: false },
        tv: { watts: 28, hours: 1.5, qty: 1, enabled: true },
        "inverter-idle": { watts: 8, hours: 6, qty: 1, enabled: true },
      }),
    },
    family: {
      label: "Full week — 4 people",
      sublabel: "2 adults + 2 children",
      inverterLossEnabled: true,
      inverterLossPct: 12,
      keepCustom: true,
      appliances: starterSet({
        fridge: { watts: 45, hours: 11, qty: 1, enabled: true },
        lights: { watts: 10, hours: 5, qty: 1, enabled: true },
        pump: { watts: 42, hours: 0.4, qty: 1, enabled: true },
        heater: { watts: 18, hours: 3, qty: 1, enabled: true },
        phone: { watts: 10, hours: 2.5, qty: 4, enabled: true },
        laptop: { watts: 60, hours: 1.5, qty: 1, enabled: true },
        fan: { watts: 24, hours: 3, qty: 1, enabled: true },
        "water-heater": { watts: 1000, hours: 0.15, qty: 1, enabled: false },
        kettle: { watts: 1200, hours: 0.25, qty: 1, enabled: true },
        "induction-hob": { watts: 1600, hours: 0.5, qty: 1, enabled: true },
        tv: { watts: 28, hours: 2.5, qty: 1, enabled: true },
        "inverter-idle": { watts: 8, hours: 10, qty: 1, enabled: true },
      }),
    },
    fulltime: {
      label: "Typical full-time off-grid",
      inverterLossEnabled: true,
      inverterLossPct: 12,
      keepCustom: true,
      appliances: starterSet({
        fridge: { watts: 50, hours: 12, qty: 1, enabled: true },
        lights: { watts: 10, hours: 5, qty: 1, enabled: true },
        pump: { watts: 42, hours: 0.4, qty: 1, enabled: true },
        heater: { watts: 22, hours: 8, qty: 1, enabled: true },
        phone: { watts: 12, hours: 3, qty: 2, enabled: true },
        laptop: { watts: 65, hours: 4, qty: 1, enabled: true },
        fan: { watts: 28, hours: 8, qty: 1, enabled: true },
        "water-heater": { watts: 1000, hours: 0.3, qty: 1, enabled: true },
        kettle: { watts: 1200, hours: 0.2, qty: 1, enabled: true },
        "induction-hob": { watts: 1600, hours: 0.4, qty: 1, enabled: true },
        tv: { watts: 32, hours: 2, qty: 1, enabled: true },
        "inverter-idle": { watts: 10, hours: 16, qty: 1, enabled: true },
      }),
    },
  };

  var CHEMISTRY_ORDER = ["lifepo4", "agm", "custom"];

  var CHEMISTRY = {
    lifepo4: {
      id: "lifepo4",
      label: "LiFePO4",
      sublabel: "80% usable",
      usablePct: 80,
    },
    agm: {
      id: "agm",
      label: "AGM / lead-acid",
      sublabel: "50% usable",
      usablePct: 50,
    },
    custom: {
      id: "custom",
      label: "Custom usable %",
      sublabel: "You choose",
      usablePct: null,
    },
  };

  var SEASON_ORDER = ["summer", "spring-autumn", "winter"];

  var SEASONS = {
    summer: {
      id: "summer",
      label: "Summer",
      sublabel: "4.5 hours",
      peakSunHours: 4.5,
    },
    "spring-autumn": {
      id: "spring-autumn",
      label: "Spring / autumn",
      sublabel: "3 hours · UK default",
      peakSunHours: 3,
    },
    winter: {
      id: "winter",
      label: "Winter",
      sublabel: "1.2 hours",
      peakSunHours: 1.2,
    },
  };

  function createDefaultBattery() {
    return {
      daysAutonomy: 2,
      chemistry: "lifepo4",
      customUsablePct: 80,
      contingencyPct: 10,
      useManualWh: false,
      manualWh: 0,
    };
  }

  function createDefaultSolar() {
    return {
      season: "spring-autumn",
      peakSunHours: 3,
      lossPct: 25,
      marginPct: 10,
      useManualWh: false,
      manualWh: 0,
    };
  }

  function createDefaultProfile() {
    return {
      version: 1,
      dailyPower: {
        inverterLossEnabled: false,
        inverterLossPct: 12,
        activePreset: "defaults",
        appliances: starterSet(),
      },
      battery: createDefaultBattery(),
      solar: createDefaultSolar(),
    };
  }

  function newCustomAppliance() {
    return {
      id: "custom-" + Date.now().toString(36) + "-" + Math.floor(Math.random() * 1000),
      name: "",
      watts: 50,
      hours: 1,
      qty: 1,
      enabled: true,
      custom: true,
    };
  }

  return {
    STARTER_IDS: STARTER_IDS,
    PRESET_ORDER: PRESET_ORDER,
    PRESETS: PRESETS,
    CHEMISTRY_ORDER: CHEMISTRY_ORDER,
    CHEMISTRY: CHEMISTRY,
    SEASON_ORDER: SEASON_ORDER,
    SEASONS: SEASONS,
    starterSet: starterSet,
    createDefaultBattery: createDefaultBattery,
    createDefaultSolar: createDefaultSolar,
    createDefaultProfile: createDefaultProfile,
    newCustomAppliance: newCustomAppliance,
  };
});
