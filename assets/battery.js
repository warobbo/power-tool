(function () {
  "use strict";

  var calc = window.PowerCalc;
  var defaults = window.PowerDefaults;
  var storage = window.PowerStorage;

  var profile = storage.loadProfile();
  var lastSaved = "";

  var els = {
    bankWh: document.getElementById("bank-wh"),
    bankAh12: document.getElementById("bank-ah12"),
    bankAh24: document.getElementById("bank-ah24"),
    bankNote: document.getElementById("bank-note"),
    breakdownList: document.getElementById("breakdown-list"),
    saveState: document.getElementById("save-state"),
    dailySource: document.getElementById("daily-source"),
    dailyActions: document.getElementById("daily-actions"),
    manualWh: document.getElementById("manual-wh"),
    manualWhWrap: document.getElementById("manual-wh-wrap"),
    daysAutonomy: document.getElementById("days-autonomy"),
    chemistry: document.getElementById("chemistry"),
    chemistryHint: document.getElementById("chemistry-hint"),
    customUsable: document.getElementById("custom-usable"),
    customUsableWrap: document.getElementById("custom-usable-wrap"),
    contingency: document.getElementById("contingency"),
    printSheet: document.getElementById("print-sheet"),
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

  function chemistryMeta(id) {
    return defaults.CHEMISTRY[id] || defaults.CHEMISTRY.lifepo4;
  }

  function chemistryHint(chemistry) {
    if (chemistry === "agm") {
      return "Lead-acid batteries last longer if you only use about half the rated size.";
    }
    if (chemistry === "custom") {
      return "Type the usable percentage from the battery maker, or the figure you want to plan with.";
    }
    return "LiFePO4 is planned at 80% usable so a little stays in reserve and the battery lasts longer.";
  }

  function renderChemistryButtons() {
    if (!els.chemistry) return;
    els.chemistry.innerHTML = defaults.CHEMISTRY_ORDER.map(function (id) {
      var item = defaults.CHEMISTRY[id];
      var fullLabel = item.sublabel ? item.label + " (" + item.sublabel + ")" : item.label;
      var inner = '<span class="preset-label">' + escapeHtml(item.label) + "</span>";
      if (item.sublabel) {
        inner += '<span class="preset-sublabel">' + escapeHtml(item.sublabel) + "</span>";
      }
      return (
        '<button type="button" data-chemistry="' +
        escapeHtml(id) +
        '" aria-pressed="false" aria-label="' +
        escapeHtml(fullLabel) +
        '">' +
        inner +
        "</button>"
      );
    }).join("");
    syncChemistrySelection();
  }

  function syncChemistrySelection() {
    if (!els.chemistry) return;
    var active = profile.battery.chemistry;
    els.chemistry.querySelectorAll("[data-chemistry]").forEach(function (button) {
      var selected = button.getAttribute("data-chemistry") === active;
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-pressed", selected ? "true" : "false");
    });
  }

  function renderDailySource(result) {
    var dailyFromPower = calc.calcTotals(profile.dailyPower).totalWh;
    var usingManual = !!profile.battery.useManualWh;
    var hasSavedDaily = dailyFromPower > 0;

    if (els.manualWhWrap) els.manualWhWrap.hidden = !usingManual;
    if (els.manualWh) els.manualWh.value = profile.battery.manualWh;

    if (usingManual) {
      els.dailySource.textContent = hasSavedDaily
        ? "You typed this figure. Daily Power still has " +
          formatWh(dailyFromPower) +
          " Wh saved if you want it back."
        : "You typed this figure. It is saved on this device.";
    } else if (hasSavedDaily) {
      els.dailySource.textContent =
        "Using " + formatWh(result.dailyWh) + " Wh from Daily Power.";
    } else {
      els.dailySource.textContent =
        "No daily use saved yet. Enter a figure or open Daily Power.";
    }

    var actions = [];
    if (usingManual) {
      if (hasSavedDaily) {
        actions.push(
          '<button type="button" class="text-btn" data-action="use-saved">Use Daily Power total</button>'
        );
      }
    } else {
      actions.push(
        '<button type="button" class="text-btn" data-action="use-manual">Enter a different figure</button>'
      );
    }
    actions.push('<a class="text-btn" href="index.html">Open Daily Power</a>');
    els.dailyActions.innerHTML = actions.join("");
  }

  function renderBreakdown(result) {
    var chem = chemistryMeta(result.chemistry);
    var chemLabel = result.chemistry === "custom" ? "Custom chemistry" : chem.label;

    if (result.dailyWh <= 0) {
      els.breakdownList.innerHTML =
        '<li class="breakdown-empty">Add a daily watt-hour figure to see the steps.</li>';
      return;
    }

    var steps = [
      {
        label: result.useManualWh ? "Daily use you typed" : "Daily use from Daily Power",
        value: formatWh(result.dailyWh) + " Wh",
      },
      {
        label:
          formatNumber(result.daysAutonomy, 1) +
          (result.daysAutonomy === 1 ? " day" : " days") +
          " without charging",
        value: formatWh(result.daysWh) + " Wh",
      },
    ];

    if (result.contingencyPct > 0) {
      steps.push({
        label: "Plus " + formatNumber(result.contingencyPct, 0) + "% extra margin",
        value: formatWh(result.energyNeededWh) + " Wh to use",
      });
    } else {
      steps.push({
        label: "No extra margin",
        value: formatWh(result.energyNeededWh) + " Wh to use",
      });
    }

    steps.push({
      label: chemLabel + " planned at " + formatNumber(result.usablePct, 0) + "% usable",
      value: formatWh(result.bankWh) + " Wh to buy",
    });
    steps.push({
      label: "Amp-hours",
      value: formatAh(result.ah12) + " Ah at 12 V · " + formatAh(result.ah24) + " Ah at 24 V",
    });

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
    var result = calc.calcBatteryBank(profile);
    els.bankWh.textContent = formatWh(result.bankWh);
    els.bankAh12.textContent = formatAh(result.ah12);
    els.bankAh24.textContent = formatAh(result.ah24);
    els.bankNote.textContent =
      result.dailyWh > 0
        ? "Size to buy at " +
          formatNumber(result.usablePct, 0) +
          "% usable · " +
          formatNumber(result.daysAutonomy, 1) +
          (result.daysAutonomy === 1 ? " day" : " days")
        : "Add daily watt-hours to get a size";

    renderDailySource(result);
    renderBreakdown(result);
    return result;
  }

  function syncInputs() {
    var battery = profile.battery;
    els.daysAutonomy.value = battery.daysAutonomy;
    els.contingency.value = battery.contingencyPct;
    els.customUsable.value = battery.customUsablePct;
    els.customUsableWrap.hidden = battery.chemistry !== "custom";
    if (els.chemistryHint) els.chemistryHint.textContent = chemistryHint(battery.chemistry);
    syncChemistrySelection();
  }

  function render() {
    syncInputs();
    renderTotals();
  }

  function onDaysInput() {
    profile.battery.daysAutonomy = calc.clamp(calc.toNumber(els.daysAutonomy.value, 2), 0.5, 14);
    persist();
    renderTotals();
  }

  function onContingencyInput() {
    profile.battery.contingencyPct = calc.clamp(calc.toNumber(els.contingency.value, 0), 0, 50);
    persist();
    renderTotals();
  }

  function onCustomUsableInput() {
    profile.battery.customUsablePct = calc.clamp(calc.toNumber(els.customUsable.value, 80), 10, 100);
    persist();
    renderTotals();
  }

  function onManualWhInput() {
    profile.battery.manualWh = calc.clamp(calc.toNumber(els.manualWh.value, 0), 0, 100000);
    persist();
    renderTotals();
  }

  function setChemistry(id) {
    profile.battery.chemistry = calc.sanitiseChemistry(id);
    persist();
    render();
  }

  function useManual() {
    var current = calc.calcTotals(profile.dailyPower).totalWh;
    if (!profile.battery.manualWh && current > 0) {
      profile.battery.manualWh = Math.round(current);
    }
    profile.battery.useManualWh = true;
    persist();
    render();
    if (els.manualWh) els.manualWh.focus();
  }

  function useSaved() {
    profile.battery.useManualWh = false;
    persist();
    render();
  }

  els.daysAutonomy.addEventListener("input", onDaysInput);
  els.daysAutonomy.addEventListener("change", onDaysInput);
  els.contingency.addEventListener("input", onContingencyInput);
  els.contingency.addEventListener("change", onContingencyInput);
  els.customUsable.addEventListener("input", onCustomUsableInput);
  els.customUsable.addEventListener("change", onCustomUsableInput);
  els.manualWh.addEventListener("input", onManualWhInput);
  els.manualWh.addEventListener("change", onManualWhInput);

  els.chemistry.addEventListener("click", function (event) {
    var button = event.target.closest("[data-chemistry]");
    if (!button) return;
    setChemistry(button.getAttribute("data-chemistry"));
  });

  els.dailyActions.addEventListener("click", function (event) {
    var button = event.target.closest("[data-action]");
    if (!button) return;
    var action = button.getAttribute("data-action");
    if (action === "use-manual") useManual();
    if (action === "use-saved") useSaved();
  });

  if (els.printSheet) {
    els.printSheet.addEventListener("click", function () {
      window.print();
    });
  }

  renderChemistryButtons();
  render();
  persist();
  if (window.PowerUI) window.PowerUI.setupRotateGate();
})();
