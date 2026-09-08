(function () {
  "use strict";

  var calc = window.PowerCalc;
  var defaults = window.PowerDefaults;
  var storage = window.PowerStorage;

  var profile = storage.loadProfile();
  var lastSaved = "";

  var els = {
    arrayWatts: document.getElementById("array-watts"),
    panels100: document.getElementById("panels-100"),
    panels200: document.getElementById("panels-200"),
    panels400: document.getElementById("panels-400"),
    arrayNote: document.getElementById("array-note"),
    breakdownList: document.getElementById("breakdown-list"),
    saveState: document.getElementById("save-state"),
    dailySource: document.getElementById("daily-source"),
    dailyActions: document.getElementById("daily-actions"),
    manualWh: document.getElementById("manual-wh"),
    manualWhWrap: document.getElementById("manual-wh-wrap"),
    seasons: document.getElementById("seasons"),
    seasonHint: document.getElementById("season-hint"),
    peakSunHours: document.getElementById("peak-sun-hours"),
    lossPct: document.getElementById("loss-pct"),
    marginPct: document.getElementById("margin-pct"),
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

  function formatWatts(value) {
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

  function seasonMeta(id) {
    return defaults.SEASONS[id] || defaults.SEASONS["spring-autumn"];
  }

  function seasonHint(season) {
    if (season === "summer") {
      return "Longer, higher sun. A typical southern-UK May to August planning figure.";
    }
    if (season === "winter") {
      return "Short, weak sun. UK November to February is often around one peak sun hour. Further north is lower still.";
    }
    if (season === "custom") {
      return "You typed the peak sun hours. The season buttons will put a typical UK figure back.";
    }
    return "A typical UK day for planning. A good default if you travel from spring through autumn.";
  }

  function renderSeasonButtons() {
    if (!els.seasons) return;
    els.seasons.innerHTML = defaults.SEASON_ORDER.map(function (id) {
      var item = defaults.SEASONS[id];
      var fullLabel = item.sublabel ? item.label + " (" + item.sublabel + ")" : item.label;
      var inner = '<span class="preset-label">' + escapeHtml(item.label) + "</span>";
      if (item.sublabel) {
        inner += '<span class="preset-sublabel">' + escapeHtml(item.sublabel) + "</span>";
      }
      return (
        '<button type="button" data-season="' +
        escapeHtml(id) +
        '" aria-pressed="false" aria-label="' +
        escapeHtml(fullLabel) +
        '">' +
        inner +
        "</button>"
      );
    }).join("");
    syncSeasonSelection();
  }

  function syncSeasonSelection() {
    if (!els.seasons) return;
    var active = profile.solar.season;
    els.seasons.querySelectorAll("[data-season]").forEach(function (button) {
      var selected = button.getAttribute("data-season") === active;
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-pressed", selected ? "true" : "false");
    });
  }

  function renderDailySource(result) {
    var dailyFromPower = calc.calcTotals(profile.dailyPower).totalWh;
    var usingManual = !!profile.solar.useManualWh;
    var hasSavedDaily = dailyFromPower > 0;

    if (els.manualWhWrap) els.manualWhWrap.hidden = !usingManual;
    if (els.manualWh) els.manualWh.value = profile.solar.manualWh;

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

  function panelCount(result, watts) {
    var found = result.panels.find(function (panel) {
      return panel.watts === watts;
    });
    return found ? found.count : 0;
  }

  function renderBreakdown(result) {
    if (result.dailyWh <= 0) {
      els.breakdownList.innerHTML =
        '<li class="breakdown-empty">Add a daily watt-hour figure to see the steps.</li>';
      return;
    }

    var seasonLabel =
      result.season === "custom" ? "Hours you typed" : seasonMeta(result.season).label + " sun";

    var steps = [
      {
        label: result.useManualWh ? "Daily use you typed" : "Daily use from Daily Power",
        value: formatWh(result.dailyWh) + " Wh",
      },
    ];

    if (result.marginPct > 0) {
      steps.push({
        label: "Plus " + formatNumber(result.marginPct, 0) + "% extra margin",
        value: formatWh(result.energyNeededWh) + " Wh to cover",
      });
    } else {
      steps.push({
        label: "No extra margin",
        value: formatWh(result.energyNeededWh) + " Wh to cover",
      });
    }

    steps.push({
      label:
        seasonLabel +
        " · " +
        formatNumber(result.peakSunHours, 1) +
        " peak sun hours",
      value: formatNumber(result.effectiveHours, 1) + " hours after losses",
    });
    steps.push({
      label: formatNumber(result.lossPct, 0) + "% real-world losses",
      value: formatWatts(result.arrayWatts) + " W of panels",
    });
    steps.push({
      label: "This array can support",
      value: formatWh(result.supportedWh) + " Wh / day",
    });
    steps.push({
      label: "Example panels (planning only)",
      value:
        panelCount(result, 100) +
        " × 100 W · " +
        panelCount(result, 200) +
        " × 200 W · " +
        panelCount(result, 400) +
        " × 400 W",
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
    var result = calc.calcSolarArray(profile);
    els.arrayWatts.textContent = formatWatts(result.arrayWatts);
    els.panels100.textContent = String(panelCount(result, 100));
    els.panels200.textContent = String(panelCount(result, 200));
    els.panels400.textContent = String(panelCount(result, 400));
    els.arrayNote.textContent =
      result.dailyWh > 0
        ? "Can support about " +
          formatWh(result.supportedWh) +
          " Wh/day at " +
          formatNumber(result.peakSunHours, 1) +
          " peak sun hours"
        : "Add daily watt-hours to get a size";

    renderDailySource(result);
    renderBreakdown(result);
    return result;
  }

  function syncInputs() {
    var solar = profile.solar;
    els.peakSunHours.value = solar.peakSunHours;
    els.lossPct.value = solar.lossPct;
    els.marginPct.value = solar.marginPct;
    if (els.seasonHint) els.seasonHint.textContent = seasonHint(solar.season);
    syncSeasonSelection();
  }

  function render() {
    syncInputs();
    renderTotals();
  }

  function onPeakSunHoursInput() {
    profile.solar.peakSunHours = calc.clamp(
      calc.toNumber(els.peakSunHours.value, calc.DEFAULT_PEAK_SUN_HOURS),
      calc.MIN_PEAK_SUN_HOURS,
      calc.MAX_PEAK_SUN_HOURS
    );
    profile.solar.season = calc.matchSeasonForHours(profile.solar.peakSunHours);
    persist();
    syncSeasonSelection();
    if (els.seasonHint) els.seasonHint.textContent = seasonHint(profile.solar.season);
    renderTotals();
  }

  function onLossInput() {
    profile.solar.lossPct = calc.clamp(calc.toNumber(els.lossPct.value, 25), 0, 70);
    persist();
    renderTotals();
  }

  function onMarginInput() {
    profile.solar.marginPct = calc.clamp(calc.toNumber(els.marginPct.value, 0), 0, 50);
    persist();
    renderTotals();
  }

  function onManualWhInput() {
    profile.solar.manualWh = calc.clamp(calc.toNumber(els.manualWh.value, 0), 0, 100000);
    persist();
    renderTotals();
  }

  function setSeason(id) {
    var season = calc.sanitiseSeason(id);
    if (season === "custom") return;
    profile.solar.season = season;
    profile.solar.peakSunHours = calc.seasonPeakSunHours(season);
    persist();
    render();
  }

  function useManual() {
    var current = calc.calcTotals(profile.dailyPower).totalWh;
    if (!profile.solar.manualWh && current > 0) {
      profile.solar.manualWh = Math.round(current);
    }
    profile.solar.useManualWh = true;
    persist();
    render();
    if (els.manualWh) els.manualWh.focus();
  }

  function useSaved() {
    profile.solar.useManualWh = false;
    persist();
    render();
  }

  els.peakSunHours.addEventListener("input", onPeakSunHoursInput);
  els.peakSunHours.addEventListener("change", onPeakSunHoursInput);
  els.lossPct.addEventListener("input", onLossInput);
  els.lossPct.addEventListener("change", onLossInput);
  els.marginPct.addEventListener("input", onMarginInput);
  els.marginPct.addEventListener("change", onMarginInput);
  els.manualWh.addEventListener("input", onManualWhInput);
  els.manualWh.addEventListener("change", onManualWhInput);

  els.seasons.addEventListener("click", function (event) {
    var button = event.target.closest("[data-season]");
    if (!button) return;
    setSeason(button.getAttribute("data-season"));
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

  renderSeasonButtons();
  render();
  persist();
  if (window.PowerUI) window.PowerUI.setupRotateGate();
})();
