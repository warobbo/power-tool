(function () {
  "use strict";

  var calc = window.PowerCalc;
  var defaults = window.PowerDefaults;
  var storage = window.PowerStorage;

  var profile = storage.loadProfile();
  var lastSaved = "";

  var els = {
    cableMm2: document.getElementById("cable-mm2"),
    fuseAmps: document.getElementById("fuse-amps"),
    wiringAmps: document.getElementById("wiring-amps"),
    dropV: document.getElementById("drop-v"),
    dropPctOut: document.getElementById("drop-pct-out"),
    wiringNote: document.getElementById("wiring-note"),
    breakdownList: document.getElementById("breakdown-list"),
    saveState: document.getElementById("save-state"),
    presets: document.getElementById("presets"),
    voltages: document.getElementById("voltages"),
    voltageHint: document.getElementById("voltage-hint"),
    drops: document.getElementById("drops"),
    dropHint: document.getElementById("drop-hint"),
    currentA: document.getElementById("current-a"),
    watts: document.getElementById("watts"),
    oneWayLength: document.getElementById("one-way-length"),
    dropPct: document.getElementById("drop-pct"),
    sourceNote: document.getElementById("source-note"),
    sourceActions: document.getElementById("source-actions"),
    printSheet: document.getElementById("print-sheet"),
  };

  function formatNumber(value, digits) {
    return new Intl.NumberFormat("en-GB", {
      maximumFractionDigits: digits,
      minimumFractionDigits: value < 10 && digits > 0 ? Math.min(digits, 1) : 0,
    }).format(value);
  }

  function formatAmps(value) {
    if (value >= 100) return formatNumber(value, 0);
    if (value >= 10) return formatNumber(value, 1);
    return formatNumber(value, 1);
  }

  function formatWatts(value) {
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

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function persist() {
    storage.saveProfile(profile);
    lastSaved = new Date().toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });
    if (els.saveState) {
      els.saveState.textContent = "Saved on this device · " + lastSaved;
    }
  }

  function syncDerivedCurrent() {
    var voltage = profile.wiring.systemVoltage;
    if (profile.wiring.useInverterSuggestion) {
      var suggested = calc.resolveInverterSuggestedAmps(profile, voltage);
      if (suggested > 0) {
        profile.wiring.currentA = suggested;
        profile.wiring.watts = calc.wattsFromCurrent(suggested, voltage);
        return;
      }
    }
    if (profile.wiring.inputMode === "watts") {
      profile.wiring.currentA = calc.currentFromWatts(profile.wiring.watts, voltage);
    } else {
      profile.wiring.watts = calc.wattsFromCurrent(profile.wiring.currentA, voltage);
    }
  }

  function voltageHint(voltage) {
    if (voltage === 24) {
      return "24 V halves the amps for the same watts, so the cable can often be thinner. A 12 V inverter run still needs fat cable.";
    }
    return "Most UK leisure systems are 12 V. A 12 V inverter run needs fat, short cable; 24 V is about half the amps.";
  }

  function dropHint(dropPct) {
    if (Math.abs(dropPct - 10) < 0.05) {
      return "Everyday kit such as a pump or heater fan can usually live with a bit more drop.";
    }
    if (Math.abs(dropPct - 3) < 0.05) {
      return "Keep voltage close for a fridge, inverter, or anything that sulks when the volts sag.";
    }
    return "You typed the allowed drop. 3% is the usual start for important kit; 10% for everyday kit.";
  }

  function renderButtons(container, order, lookup, attr, active) {
    if (!container) return;
    container.innerHTML = order
      .map(function (id) {
        var item = lookup[id];
        var fullLabel = item.sublabel ? item.label + " (" + item.sublabel + ")" : item.label;
        var inner = '<span class="preset-label">' + escapeHtml(item.label) + "</span>";
        if (item.sublabel) {
          inner += '<span class="preset-sublabel">' + escapeHtml(item.sublabel) + "</span>";
        }
        return (
          "<button type=\"button\" data-" +
          attr +
          '="' +
          escapeHtml(String(id)) +
          '" aria-pressed="false" aria-label="' +
          escapeHtml(fullLabel) +
          '">' +
          inner +
          "</button>"
        );
      })
      .join("");
    syncButtonSelection(container, attr, active);
  }

  function syncButtonSelection(container, attr, active) {
    if (!container) return;
    container.querySelectorAll("[data-" + attr + "]").forEach(function (button) {
      var selected = button.getAttribute("data-" + attr) === String(active);
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-pressed", selected ? "true" : "false");
    });
  }

  function renderSource(result) {
    if (!els.sourceNote || !els.sourceActions) return;

    var inverter = calc.calcInverter(profile);
    var hasInverter = inverter.recommendedContinuousW > 0;
    var actions = [];

    if (result.usedInverterSuggestion) {
      els.sourceNote.textContent =
        "Using about " +
        formatAmps(result.currentA) +
        " A — " +
        formatWatts(inverter.recommendedContinuousW) +
        " W continuous ÷ " +
        formatNumber(result.systemVoltage, 0) +
        " V. That is inverter AC watts divided by battery volts, not also inverter waste. You can change it.";
      actions.push(
        '<button type="button" class="text-btn" data-action="use-manual">Enter a different current</button>'
      );
      actions.push('<a class="text-btn" href="inverter.html">Open Inverter</a>');
    } else if (profile.wiring.preset === "inverter" && hasInverter) {
      els.sourceNote.textContent =
        "You typed this figure. Inverter still has " +
        formatWatts(inverter.recommendedContinuousW) +
        " W continuous if you want that current back.";
      actions.push(
        '<button type="button" class="text-btn" data-action="use-inverter">Use Inverter figure</button>'
      );
      actions.push('<a class="text-btn" href="inverter.html">Open Inverter</a>');
    } else if (profile.wiring.preset === "inverter") {
      els.sourceNote.textContent =
        "No inverter size saved yet. Type the current or watts, or open Inverter first.";
      actions.push('<a class="text-btn" href="inverter.html">Open Inverter</a>');
    } else {
      els.sourceNote.textContent =
        "Type current in amps, or watts and we will convert. Typical figures are only a start — use the label if you have it.";
    }

    els.sourceActions.innerHTML = actions.join("");
  }

  function renderBreakdown(result) {
    if (result.currentA <= 0) {
      els.breakdownList.innerHTML =
        '<li class="breakdown-empty">Add a current or watts figure to see the cable and fuse size.</li>';
      return;
    }

    var steps = [
      {
        label: result.usedInverterSuggestion
          ? "Current from your Inverter size"
          : result.inputMode === "watts"
            ? "Current from the watts you typed"
            : "Current you typed",
        value:
          formatAmps(result.currentA) +
          " A · " +
          formatWatts(result.watts) +
          " W at " +
          formatNumber(result.systemVoltage, 0) +
          " V",
      },
      {
        label:
          formatNumber(result.oneWayLengthM, 1) +
          " m one way · " +
          formatNumber(result.roundTripLengthM, 1) +
          " m there and back",
        value: "Round trip is twice the length you type",
      },
      {
        label:
          "Allowed drop " +
          formatNumber(result.dropPct, 0) +
          "% of " +
          formatNumber(result.systemVoltage, 0) +
          " V",
        value: formatVolts(result.allowedDropV) + " V",
      },
      {
        label: "Next practical UK copper size",
        value: formatMm2(result.cableMm2) + " mm²",
      },
      {
        label: "Estimated drop on that cable",
        value:
          formatVolts(result.dropV) +
          " V · " +
          formatNumber(result.estimatedDropPct, 1) +
          "%",
      },
      {
        label: "Fuse or breaker (protects the cable)",
        value: formatAmps(result.fuseAmps) + " A",
      },
    ];

    if (result.overLimit) {
      steps.push({
        label:
          "Above the largest size we list (" +
          formatMm2(result.maxCableMm2) +
          " mm² / about " +
          formatAmps(result.maxCableAmps) +
          " A)",
        value: "Ask a qualified installer — or try 24 V",
      });
    }

    els.breakdownList.innerHTML = steps
      .map(function (step, index) {
        var pct = ((index + 1) / steps.length) * 100;
        return (
          '<li class="breakdown-row">' +
          '<div class="breakdown-meta">' +
          "<span>" +
          escapeHtml(step.label) +
          "</span>" +
          "<strong>" +
          escapeHtml(step.value) +
          "</strong>" +
          "</div>" +
          '<div class="breakdown-bar" role="presentation"><span style="width:' +
          pct.toFixed(1) +
          '%"></span></div>' +
          "</li>"
        );
      })
      .join("");
  }

  function renderTotals() {
    syncDerivedCurrent();
    var result = calc.calcWiring(profile);
    els.cableMm2.textContent = formatMm2(result.cableMm2);
    els.fuseAmps.textContent = formatAmps(result.fuseAmps);
    els.wiringAmps.textContent = formatAmps(result.currentA);
    els.dropV.textContent = formatVolts(result.dropV);
    els.dropPctOut.textContent = formatNumber(result.estimatedDropPct, 1);

    if (result.currentA <= 0) {
      els.wiringNote.textContent = "Add a current or watts figure to get a cable and fuse size.";
    } else if (result.overLimit) {
      els.wiringNote.textContent =
        "This run is above the largest size we list (" +
        formatMm2(result.maxCableMm2) +
        " mm², about " +
        formatAmps(result.maxCableAmps) +
        " A). Parallel cables or 24 V may be needed — ask a qualified installer.";
    } else if (result.preset === "inverter" || result.currentA >= 80) {
      els.wiringNote.textContent =
        "Inverter battery cable (thick flexible copper), not thin chassis cable. The fuse protects the cable.";
    } else {
      els.wiringNote.textContent =
        "The fuse protects the cable. Pick a fuse a bit above the load, and not above what that cable can take.";
    }

    renderSource(result);
    renderBreakdown(result);
    return result;
  }

  function syncInputs() {
    var wiring = profile.wiring;
    els.currentA.value = wiring.currentA ? String(Math.round(wiring.currentA * 10) / 10) : "";
    els.watts.value = wiring.watts ? String(Math.round(wiring.watts * 10) / 10) : "";
    els.oneWayLength.value = wiring.oneWayLengthM;
    els.dropPct.value = wiring.dropPct;
    if (els.voltageHint) els.voltageHint.textContent = voltageHint(wiring.systemVoltage);
    if (els.dropHint) els.dropHint.textContent = dropHint(wiring.dropPct);
    syncButtonSelection(els.presets, "preset", wiring.preset);
    syncButtonSelection(els.voltages, "voltage", wiring.systemVoltage);
    syncButtonSelection(els.drops, "drop", wiring.dropPct);
  }

  function render() {
    syncDerivedCurrent();
    syncInputs();
    renderTotals();
  }

  function onCurrentInput() {
    profile.wiring.useInverterSuggestion = false;
    profile.wiring.inputMode = "amps";
    profile.wiring.currentA = calc.clamp(
      calc.toNumber(els.currentA.value, 0),
      0,
      calc.MAX_WIRING_AMPS
    );
    profile.wiring.watts = calc.wattsFromCurrent(profile.wiring.currentA, profile.wiring.systemVoltage);
    persist();
    els.watts.value = profile.wiring.watts ? String(Math.round(profile.wiring.watts * 10) / 10) : "";
    renderTotals();
    syncButtonSelection(els.presets, "preset", profile.wiring.preset);
  }

  function onWattsInput() {
    profile.wiring.useInverterSuggestion = false;
    profile.wiring.inputMode = "watts";
    profile.wiring.watts = calc.clamp(calc.toNumber(els.watts.value, 0), 0, calc.MAX_WIRING_WATTS);
    profile.wiring.currentA = calc.currentFromWatts(profile.wiring.watts, profile.wiring.systemVoltage);
    persist();
    els.currentA.value = profile.wiring.currentA ? String(profile.wiring.currentA) : "";
    renderTotals();
    syncButtonSelection(els.presets, "preset", profile.wiring.preset);
  }

  function onLengthInput() {
    profile.wiring.oneWayLengthM = calc.clamp(
      calc.toNumber(els.oneWayLength.value, 2),
      calc.MIN_WIRING_LENGTH_M,
      calc.MAX_WIRING_LENGTH_M
    );
    persist();
    renderTotals();
  }

  function onDropInput() {
    profile.wiring.dropPct = calc.sanitiseDropPct(els.dropPct.value);
    persist();
    if (els.dropHint) els.dropHint.textContent = dropHint(profile.wiring.dropPct);
    syncButtonSelection(els.drops, "drop", profile.wiring.dropPct);
    renderTotals();
  }

  function setVoltage(value) {
    profile.wiring.systemVoltage = calc.sanitiseSystemVoltage(value);
    persist();
    render();
  }

  function setDrop(value) {
    profile.wiring.dropPct = calc.sanitiseDropPct(value);
    persist();
    render();
  }

  function setPreset(id) {
    profile = storage.applyWiringPreset(profile, id);
    persist();
    render();
  }

  function useManual() {
    syncDerivedCurrent();
    profile.wiring.useInverterSuggestion = false;
    profile.wiring.inputMode = "amps";
    persist();
    render();
    if (els.currentA) els.currentA.focus();
  }

  function useInverter() {
    profile.wiring.preset = "inverter";
    profile.wiring.useInverterSuggestion = true;
    profile.wiring.inputMode = "amps";
    persist();
    render();
  }

  els.currentA.addEventListener("input", onCurrentInput);
  els.currentA.addEventListener("change", onCurrentInput);
  els.watts.addEventListener("input", onWattsInput);
  els.watts.addEventListener("change", onWattsInput);
  els.oneWayLength.addEventListener("input", onLengthInput);
  els.oneWayLength.addEventListener("change", onLengthInput);
  els.dropPct.addEventListener("input", onDropInput);
  els.dropPct.addEventListener("change", onDropInput);

  els.presets.addEventListener("click", function (event) {
    var button = event.target.closest("[data-preset]");
    if (!button) return;
    setPreset(button.getAttribute("data-preset"));
  });

  els.voltages.addEventListener("click", function (event) {
    var button = event.target.closest("[data-voltage]");
    if (!button) return;
    setVoltage(button.getAttribute("data-voltage"));
  });

  els.drops.addEventListener("click", function (event) {
    var button = event.target.closest("[data-drop]");
    if (!button) return;
    setDrop(button.getAttribute("data-drop"));
  });

  els.sourceActions.addEventListener("click", function (event) {
    var button = event.target.closest("[data-action]");
    if (!button) return;
    var action = button.getAttribute("data-action");
    if (action === "use-manual") useManual();
    if (action === "use-inverter") useInverter();
  });

  if (els.printSheet) {
    els.printSheet.addEventListener("click", function () {
      window.print();
    });
  }

  renderButtons(els.presets, defaults.WIRING_PRESET_ORDER, defaults.WIRING_PRESETS, "preset", profile.wiring.preset);
  renderButtons(els.voltages, defaults.VOLTAGE_ORDER, defaults.VOLTAGES, "voltage", profile.wiring.systemVoltage);
  renderButtons(els.drops, defaults.DROP_ORDER, defaults.DROP_PRESETS, "drop", profile.wiring.dropPct);
  render();
  persist();
  if (window.PowerUI) window.PowerUI.setupRotateGate();
})();
