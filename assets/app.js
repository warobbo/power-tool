(function () {
  "use strict";

  var calc = window.PowerCalc;
  var defaults = window.PowerDefaults;
  var storage = window.PowerStorage;

  var profile = storage.loadProfile();
  var lastSaved = "";

  var els = {
    app: document.getElementById("app"),
    applianceList: document.getElementById("appliance-list"),
    breakdownList: document.getElementById("breakdown-list"),
    totalWh: document.getElementById("total-wh"),
    totalAh12: document.getElementById("total-ah12"),
    totalAh24: document.getElementById("total-ah24"),
    lossNote: document.getElementById("loss-note"),
    inverterLoss: document.getElementById("inverter-loss"),
    saveState: document.getElementById("save-state"),
    addCustom: document.getElementById("add-custom"),
    presets: document.getElementById("presets"),
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

  function findAppliance(id) {
    return profile.dailyPower.appliances.find(function (item) {
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

  function renderTotals() {
    var totals = calc.calcTotals(profile.dailyPower);
    els.totalWh.textContent = formatWh(totals.totalWh);
    els.totalAh12.textContent = formatAh(totals.ah12);
    els.totalAh24.textContent = formatAh(totals.ah24);

    if (totals.inverterLossEnabled && totals.inverterLossWh > 0) {
      els.lossNote.hidden = false;
      els.lossNote.textContent =
        "Includes " +
        formatWh(totals.inverterLossWh) +
        " Wh inverter loss (" +
        formatNumber(totals.inverterLossPct, 0) +
        "%). Appliance loads before loss: " +
        formatWh(totals.loadWh) +
        " Wh.";
    } else {
      els.lossNote.hidden = true;
      els.lossNote.textContent = "";
    }

    var ranked = totals.items
      .filter(function (item) {
        return item.wh > 0;
      })
      .sort(function (a, b) {
        return b.wh - a.wh;
      });

    if (!ranked.length) {
      els.breakdownList.innerHTML = '<li class="breakdown-empty">No loads enabled yet.</li>';
      return;
    }

    els.breakdownList.innerHTML = ranked
      .map(function (item) {
        var pct = totals.loadWh > 0 ? (item.wh / totals.loadWh) * 100 : 0;
        var label = item.name.trim() || "Custom appliance";
        return (
          '<li class="breakdown-row">' +
          '<div class="breakdown-meta">' +
          "<span>" +
          escapeHtml(label) +
          "</span>" +
          "<strong>" +
          formatWh(item.wh) +
          " Wh</strong>" +
          "</div>" +
          '<div class="breakdown-bar" role="presentation"><span style="width:' +
          pct.toFixed(1) +
          '%"></span></div>' +
          "</li>"
        );
      })
      .join("");
  }

  function applianceRow(item) {
    var wh = calc.applianceWh(item);
    var nameValue = escapeHtml(item.name);
    var title = item.custom
      ? '<label class="sr-only" for="name-' +
        escapeHtml(item.id) +
        '">Appliance name</label>' +
        '<input id="name-' +
        escapeHtml(item.id) +
        '" class="name-input" data-field="name" data-id="' +
        escapeHtml(item.id) +
        '" type="text" maxlength="48" placeholder="Custom appliance" value="' +
        nameValue +
        '">'
      : "<h3>" + escapeHtml(item.name) + "</h3>";

    var remove = item.custom
      ? '<button type="button" class="icon-btn" data-action="remove" data-id="' +
        escapeHtml(item.id) +
        '" aria-label="Remove custom appliance">Remove</button>'
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
      formatWh(wh) +
      "</strong> Wh</p>" +
      remove +
      "</div>" +
      '<div class="appliance-fields">' +
      field(item, "watts", "Watts", "W", 0, 20000, item.watts % 1 === 0 ? 1 : 0.1) +
      field(item, "hours", "Hours / day", "h", 0, 24, 0.05) +
      field(item, "qty", "Quantity", "×", 1, 99, 1) +
      "</div>" +
      "</article>"
    );
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

  function renderAppliances() {
    els.applianceList.innerHTML = profile.dailyPower.appliances.map(applianceRow).join("");
    els.inverterLoss.checked = !!profile.dailyPower.inverterLossEnabled;
  }

  function render() {
    renderAppliances();
    renderTotals();
  }

  function updateField(id, field, value) {
    var item = findAppliance(id);
    if (!item) return;

    if (field === "enabled") {
      item.enabled = !!value;
    } else if (field === "name") {
      item.name = String(value).slice(0, 48);
    } else if (field === "qty") {
      item.qty = calc.clamp(Math.round(calc.toNumber(value, 1)), 1, 99);
    } else if (field === "hours") {
      item.hours = calc.clamp(calc.toNumber(value, 0), 0, 24);
    } else if (field === "watts") {
      item.watts = calc.clamp(calc.toNumber(value, 0), 0, 20000);
    }

    persist();
    renderTotals();
    refreshRowWh(id);
    refreshCardState(id);
  }

  function refreshRowWh(id) {
    var item = findAppliance(id);
    var card = els.applianceList.querySelector('[data-id="' + CSS.escape(id) + '"]');
    if (!item || !card) return;
    var whEl = card.querySelector(".appliance-wh strong");
    if (whEl) whEl.textContent = formatWh(calc.applianceWh(item));
  }

  function refreshCardState(id) {
    var item = findAppliance(id);
    var card = els.applianceList.querySelector('[data-id="' + CSS.escape(id) + '"]');
    if (!item || !card) return;
    card.classList.toggle("is-off", !item.enabled);
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
    profile.dailyPower.appliances = profile.dailyPower.appliances.filter(function (item) {
      return item.id !== id;
    });
    persist();
    render();
  }

  function addCustom() {
    profile.dailyPower.appliances.push(defaults.newCustomAppliance());
    persist();
    render();
    var last = els.applianceList.querySelector(".appliance-card:last-child .name-input");
    if (last) last.focus();
  }

  function applyPreset(presetId) {
    profile = storage.applyPreset(profile, presetId);
    persist();
    render();
  }

  els.applianceList.addEventListener("input", onListInput);
  els.applianceList.addEventListener("change", onListInput);
  els.applianceList.addEventListener("click", onListClick);
  els.addCustom.addEventListener("click", addCustom);
  els.inverterLoss.addEventListener("change", function () {
    profile.dailyPower.inverterLossEnabled = els.inverterLoss.checked;
    persist();
    renderTotals();
  });

  els.presets.addEventListener("click", function (event) {
    var button = event.target.closest("[data-preset]");
    if (!button) return;
    applyPreset(button.getAttribute("data-preset"));
  });

  render();
  persist();
})();
