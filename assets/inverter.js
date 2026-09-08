(function () {
  "use strict";

  var calc = window.PowerCalc;
  var defaults = window.PowerDefaults;
  var storage = window.PowerStorage;

  var profile = storage.loadProfile();
  var lastSaved = "";

  var els = {
    continuousW: document.getElementById("inverter-continuous"),
    surgeW: document.getElementById("inverter-surge"),
    amps12: document.getElementById("inverter-amps12"),
    amps24: document.getElementById("inverter-amps24"),
    inverterNote: document.getElementById("inverter-note"),
    breakdownList: document.getElementById("breakdown-list"),
    saveState: document.getElementById("save-state"),
    voltages: document.getElementById("voltages"),
    voltageHint: document.getElementById("voltage-hint"),
    efficiencyPct: document.getElementById("efficiency-pct"),
    marginPct: document.getElementById("margin-pct"),
    loadList: document.getElementById("load-list"),
    addCustom: document.getElementById("add-custom"),
    printSheet: document.getElementById("print-sheet"),
  };

  function formatNumber(value, digits) {
    return new Intl.NumberFormat("en-GB", {
      maximumFractionDigits: digits,
      minimumFractionDigits: value < 10 && digits > 0 ? Math.min(digits, 1) : 0,
    }).format(value);
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

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function findLoad(id) {
    return profile.inverter.loads.find(function (item) {
      return item.id === id;
    });
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

  function voltageHint(voltage) {
    if (voltage === 24) {
      return "Same 230 V watts, about half the battery current. Cables and the leisure battery still have to suit 24 V.";
    }
    return "Most UK leisure systems are 12 V. The AC watt size stays the same; the battery current is higher than on 24 V.";
  }

  function renderVoltageButtons() {
    if (!els.voltages) return;
    els.voltages.innerHTML = defaults.VOLTAGE_ORDER.map(function (id) {
      var item = defaults.VOLTAGES[id];
      var fullLabel = item.sublabel ? item.label + " (" + item.sublabel + ")" : item.label;
      var inner = '<span class="preset-label">' + escapeHtml(item.label) + "</span>";
      if (item.sublabel) {
        inner += '<span class="preset-sublabel">' + escapeHtml(item.sublabel) + "</span>";
      }
      return (
        '<button type="button" data-voltage="' +
        escapeHtml(String(id)) +
        '" aria-pressed="false" aria-label="' +
        escapeHtml(fullLabel) +
        '">' +
        inner +
        "</button>"
      );
    }).join("");
    syncVoltageSelection();
  }

  function syncVoltageSelection() {
    if (!els.voltages) return;
    var active = String(profile.inverter.systemVoltage);
    els.voltages.querySelectorAll("[data-voltage]").forEach(function (button) {
      var selected = button.getAttribute("data-voltage") === active;
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-pressed", selected ? "true" : "false");
    });
  }

  function renderBreakdown(result) {
    if (result.continuousLoadW <= 0) {
      els.breakdownList.innerHTML =
        '<li class="breakdown-empty">Tick the 230 V kit you might run at the same time.</li>';
      return;
    }

    var ranked = result.items
      .filter(function (item) {
        return item.runningW > 0;
      })
      .sort(function (a, b) {
        return b.runningW - a.runningW;
      });

    var steps = ranked.map(function (item) {
      var label = item.name.trim() || "Custom load";
      var extra =
        item.surgeW > item.runningW
          ? " · " + formatWatts(item.surgeW) + " W start"
          : "";
      return {
        label: label + (item.qty > 1 ? " × " + item.qty : ""),
        value: formatWatts(item.runningW) + " W" + extra,
        bar: result.continuousLoadW > 0 ? (item.runningW / result.continuousLoadW) * 100 : 0,
      };
    });

    steps.push({
      label: "Running loads added together",
      value: formatWatts(result.continuousLoadW) + " W",
      bar: 100,
    });

    if (result.marginPct > 0) {
      steps.push({
        label: "Plus " + formatNumber(result.marginPct, 0) + "% extra margin",
        value: formatWatts(result.recommendedContinuousW) + " W continuous",
        bar: 100,
      });
    } else {
      steps.push({
        label: "No extra margin",
        value: formatWatts(result.recommendedContinuousW) + " W continuous",
        bar: 100,
      });
    }

    steps.push({
      label: "Surge to cover (highest start plus other running loads)",
      value: formatWatts(result.recommendedSurgeW) + " W",
      bar: 100,
    });
    steps.push({
      label:
        "Battery current at " +
        formatNumber(result.efficiencyPct, 0) +
        "% efficiency",
      value:
        formatAmps(result.amps12) +
        " A at 12 V · " +
        formatAmps(result.amps24) +
        " A at 24 V",
      bar: 100,
    });

    els.breakdownList.innerHTML = steps
      .map(function (step) {
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
          step.bar.toFixed(1) +
          '%"></span></div>' +
          "</li>"
        );
      })
      .join("");
  }

  function renderTotals() {
    var result = calc.calcInverter(profile);
    els.continuousW.textContent = formatWatts(result.recommendedContinuousW);
    els.surgeW.textContent = formatWatts(result.recommendedSurgeW);
    els.amps12.textContent = formatAmps(result.amps12);
    els.amps24.textContent = formatAmps(result.amps24);
    els.inverterNote.textContent =
      result.continuousLoadW > 0
        ? "Pure sine is usually needed for induction hobs, microwaves and electronics."
        : "Tick the 230 V kit you might run at the same time.";

    renderBreakdown(result);
    return result;
  }

  function field(item, key, label, suffix, min, max, step) {
    var id = key + "-" + item.id;
    return (
      '<label class="field" for="' +
      escapeHtml(id) +
      '">' +
      "<span>" +
      label +
      "</span>" +
      '<span class="field-control">' +
      '<input id="' +
      escapeHtml(id) +
      '" data-field="' +
      key +
      '" data-id="' +
      escapeHtml(item.id) +
      '" type="number" inputmode="decimal" min="' +
      min +
      '" max="' +
      max +
      '" step="' +
      step +
      '" value="' +
      item[key] +
      '">' +
      "<em>" +
      suffix +
      "</em>" +
      "</span>" +
      "</label>"
    );
  }

  function loadRow(item) {
    var runningW = calc.inverterLoadRunningW(item);
    var nameValue = escapeHtml(item.name);
    var title = item.custom
      ? '<label class="sr-only" for="name-' +
        escapeHtml(item.id) +
        '">Load name</label>' +
        '<input id="name-' +
        escapeHtml(item.id) +
        '" class="name-input" data-field="name" data-id="' +
        escapeHtml(item.id) +
        '" type="text" maxlength="48" placeholder="Custom load" value="' +
        nameValue +
        '">'
      : "<h3>" + escapeHtml(item.name) + "</h3>";

    var remove = item.custom
      ? '<button type="button" class="icon-btn" data-action="remove" data-id="' +
        escapeHtml(item.id) +
        '" aria-label="Remove custom load">Remove</button>'
      : "";

    return (
      '<article class="appliance-card' +
      (item.enabled ? "" : " is-off") +
      '" data-id="' +
      escapeHtml(item.id) +
      '">' +
      '<div class="appliance-head">' +
      '<label class="check">' +
      '<input type="checkbox" data-field="enabled" data-id="' +
      escapeHtml(item.id) +
      '"' +
      (item.enabled ? " checked" : "") +
      ">" +
      "<span>Use</span>" +
      "</label>" +
      '<div class="appliance-title">' +
      title +
      "</div>" +
      '<p class="appliance-wh"><strong>' +
      formatWatts(runningW) +
      "</strong> W</p>" +
      remove +
      "</div>" +
      '<div class="appliance-fields">' +
      field(item, "watts", "Watts", "W", 0, 20000, item.watts % 1 === 0 ? 1 : 0.1) +
      field(
        item,
        "surgeWatts",
        "Start / surge",
        "W",
        0,
        40000,
        item.surgeWatts % 1 === 0 ? 1 : 0.1
      ) +
      field(item, "qty", "Quantity", "×", 1, 99, 1) +
      "</div>" +
      "</article>"
    );
  }

  function renderLoads() {
    els.loadList.innerHTML = profile.inverter.loads.map(loadRow).join("");
  }

  function syncInputs() {
    var inverter = profile.inverter;
    els.efficiencyPct.value = inverter.efficiencyPct;
    els.marginPct.value = inverter.marginPct;
    if (els.voltageHint) els.voltageHint.textContent = voltageHint(inverter.systemVoltage);
    syncVoltageSelection();
  }

  function render() {
    syncInputs();
    renderLoads();
    renderTotals();
  }

  function refreshRowW(id) {
    var item = findLoad(id);
    var card = els.loadList.querySelector('[data-id="' + CSS.escape(id) + '"]');
    if (!item || !card) return;
    var wEl = card.querySelector(".appliance-wh strong");
    if (wEl) wEl.textContent = formatWatts(calc.inverterLoadRunningW(item));
  }

  function refreshCardState(id) {
    var item = findLoad(id);
    var card = els.loadList.querySelector('[data-id="' + CSS.escape(id) + '"]');
    if (!item || !card) return;
    card.classList.toggle("is-off", !item.enabled);
  }

  function updateField(id, fieldName, value) {
    var item = findLoad(id);
    if (!item) return;

    if (fieldName === "enabled") {
      item.enabled = !!value;
    } else if (fieldName === "name") {
      item.name = String(value).slice(0, 48);
    } else if (fieldName === "qty") {
      item.qty = calc.clamp(Math.round(calc.toNumber(value, 1)), 1, 99);
    } else if (fieldName === "watts") {
      item.watts = calc.clamp(calc.toNumber(value, 0), 0, 20000);
    } else if (fieldName === "surgeWatts") {
      item.surgeWatts = calc.clamp(calc.toNumber(value, item.watts), 0, 40000);
    }

    persist();
    renderTotals();
    refreshRowW(id);
    refreshCardState(id);
  }

  function onListInput(event) {
    var target = event.target;
    var fieldName = target.getAttribute("data-field");
    var id = target.getAttribute("data-id");
    if (!fieldName || !id) return;

    if (fieldName === "enabled") {
      updateField(id, fieldName, target.checked);
      return;
    }

    updateField(id, fieldName, target.value);
  }

  function onListClick(event) {
    var button = event.target.closest("[data-action='remove']");
    if (!button) return;
    var id = button.getAttribute("data-id");
    profile.inverter.loads = profile.inverter.loads.filter(function (item) {
      return item.id !== id;
    });
    persist();
    render();
  }

  function addCustom() {
    profile.inverter.loads.push(defaults.newCustomInverterLoad());
    persist();
    render();
    var last = els.loadList.querySelector(".appliance-card:last-child .name-input");
    if (last) last.focus();
  }

  function onEfficiencyInput() {
    profile.inverter.efficiencyPct = calc.clamp(
      calc.toNumber(els.efficiencyPct.value, calc.DEFAULT_INVERTER_EFFICIENCY_PCT),
      calc.MIN_INVERTER_EFFICIENCY_PCT,
      calc.MAX_INVERTER_EFFICIENCY_PCT
    );
    persist();
    renderTotals();
  }

  function onMarginInput() {
    profile.inverter.marginPct = calc.clamp(
      calc.toNumber(els.marginPct.value, calc.DEFAULT_INVERTER_MARGIN_PCT),
      0,
      50
    );
    persist();
    renderTotals();
  }

  function setVoltage(value) {
    profile.inverter.systemVoltage = calc.sanitiseSystemVoltage(value);
    persist();
    render();
  }

  els.efficiencyPct.addEventListener("input", onEfficiencyInput);
  els.efficiencyPct.addEventListener("change", onEfficiencyInput);
  els.marginPct.addEventListener("input", onMarginInput);
  els.marginPct.addEventListener("change", onMarginInput);

  els.voltages.addEventListener("click", function (event) {
    var button = event.target.closest("[data-voltage]");
    if (!button) return;
    setVoltage(button.getAttribute("data-voltage"));
  });

  els.loadList.addEventListener("input", onListInput);
  els.loadList.addEventListener("change", onListInput);
  els.loadList.addEventListener("click", onListClick);
  els.addCustom.addEventListener("click", addCustom);

  if (els.printSheet) {
    els.printSheet.addEventListener("click", function () {
      window.print();
    });
  }

  renderVoltageButtons();
  render();
  persist();
  if (window.PowerUI) window.PowerUI.setupRotateGate();
})();
