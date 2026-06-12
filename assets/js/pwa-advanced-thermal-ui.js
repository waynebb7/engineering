/**
 * Power Wire Analysis — Advanced Thermal UI controller.
 * Separate from primary calculator; no effect when disabled.
 */
(function (global) {
  'use strict';

  var lastResult = null;
  var bound = false;

  function $(id) {
    return document.getElementById(id);
  }

  function num(value, digits) {
    if (global.PwaAdvancedThermal && PwaAdvancedThermal.round) {
      return PwaAdvancedThermal.round(value, digits);
    }
    if (typeof value !== 'number' || !isFinite(value)) {
      return '—';
    }
    return String(Math.round(value * Math.pow(10, digits)) / Math.pow(10, digits));
  }

  function isEnabled() {
    var toggle = $('pwa-advanced-thermal-enable');
    return !!(toggle && toggle.checked);
  }

  function setPanelVisible(visible) {
    var body = $('pwa-advanced-thermal-body');
    if (body) {
      body.hidden = !visible;
    }
  }

  function readPresetValue(presetEl, customEl, presets, customKey) {
    if (!presetEl) {
      return null;
    }
    if (presetEl.value === customKey && customEl) {
      return parseFloat(customEl.value, 10);
    }
    var preset = presets[presetEl.value];
    return preset && preset.value != null ? preset.value : null;
  }

  function readDutyCyclePct() {
    var presetEl = $('pwa-at-duty-preset');
    var customEl = $('pwa-at-duty-custom');
    if (!presetEl) {
      return 100;
    }
    if (presetEl.value === 'custom' && customEl) {
      return parseFloat(customEl.value, 10);
    }
    var preset = PwaAdvancedThermal.DUTY_CYCLE_PRESETS[presetEl.value];
    return preset ? preset.value : 100;
  }

  function readAdjacentWires(params) {
    var overrideEl = $('pwa-at-adjacent-override');
    var manualEl = $('pwa-at-adjacent-manual');
    if (overrideEl && overrideEl.checked && manualEl) {
      return parseInt(manualEl.value, 10);
    }
    return PwaAdvancedThermal.estimateAdjacentLoadedWires(
      params.bundleWireCount,
      params.bundleLoadingPct
    );
  }

  function applyConservativeMode(force) {
    var conservativeEl = $('pwa-at-conservative');
    var noteEl = $('pwa-at-conservative-note');
    var velocityEl = $('pwa-at-air-velocity');
    var positionEl = $('pwa-at-wire-position');
    var contactEl = $('pwa-at-thermal-contact');
    var dutyEl = $('pwa-at-duty-preset');
    var adjacentOverrideEl = $('pwa-at-adjacent-override');
    var adjacentManualEl = $('pwa-at-adjacent-manual');
    var enabled = force != null ? force : (conservativeEl && conservativeEl.checked);

    var lockIds = [
      'pwa-at-air-velocity',
      'pwa-at-wire-position',
      'pwa-at-thermal-contact',
      'pwa-at-duty-preset',
      'pwa-at-adjacent-override',
      'pwa-at-adjacent-manual'
    ];
    lockIds.forEach(function (id) {
      var el = $(id);
      if (el) {
        el.disabled = enabled;
      }
    });

    if (enabled) {
      if (velocityEl) velocityEl.value = '0';
      if (positionEl) positionEl.value = 'centre';
      if (contactEl) contactEl.value = 'none';
      if (dutyEl) dutyEl.value = 'continuous';
      if (adjacentOverrideEl) adjacentOverrideEl.checked = false;
      if (adjacentManualEl) adjacentManualEl.disabled = true;
    } else if (adjacentManualEl && adjacentOverrideEl) {
      adjacentManualEl.disabled = !adjacentOverrideEl.checked;
    }

    if (noteEl) {
      noteEl.hidden = !enabled;
    }
  }

  function toggleCustomFields() {
    var pairs = [
      ['pwa-at-emissivity-preset', 'pwa-at-emissivity-custom-wrap'],
      ['pwa-at-insulation-k-preset', 'pwa-at-insulation-k-custom-wrap'],
      ['pwa-at-duty-preset', 'pwa-at-duty-custom-wrap']
    ];
    pairs.forEach(function (pair) {
      var preset = $(pair[0]);
      var wrap = $(pair[1]);
      if (preset && wrap) {
        wrap.hidden = preset.value !== 'custom';
      }
    });
    var adjacentOverride = $('pwa-at-adjacent-override');
    var adjacentManual = $('pwa-at-adjacent-manual');
    if (adjacentManual && adjacentOverride) {
      adjacentManual.disabled = !adjacentOverride.checked || ($('pwa-at-conservative') && $('pwa-at-conservative').checked);
    }
  }

  function buildAssumptions(inputs, params, wireRow) {
    return [
      { parameter: 'Circuit current I', value: num(inputs.currentA, 2) + ' A', source: 'Existing Calculator' },
      { parameter: 'Wire size (AWG)', value: inputs.awg, source: 'Existing Calculator' },
      { parameter: 'Wire type', value: inputs.wireTypeLabel, source: 'Existing Calculator' },
      { parameter: 'R20 (total run)', value: num(inputs.r20Ohms, 6) + ' Ω', source: 'Existing Calculator' },
      { parameter: 'Ambient temperature', value: num(inputs.ambientTempC, 1) + ' °C', source: 'Existing Calculator' },
      { parameter: 'Altitude', value: params.altitudeFt + ' ft', source: 'Existing Calculator' },
      { parameter: 'Bundle count / loading', value: params.bundleWireCount + ' / ' + params.bundleLoadingPct + '%', source: 'Existing Calculator' },
      { parameter: 'Run length (total)', value: num(inputs.runLengthM, 3) + ' m', source: 'Existing Calculator' },
      { parameter: 'Conductor rating T_R', value: num(inputs.conductorRatingC, 0) + ' °C', source: 'Existing Calculator' },
      {
        parameter: 'Installation limit',
        value: inputs.installationLimitC != null ? num(inputs.installationLimitC, 0) + ' °C' : '—',
        source: params.applyInstallationTempLimit ? 'Existing Calculator' : 'Not applied'
      },
      { parameter: 'Installation type', value: PwaAdvancedThermal.INSTALLATION_TYPES[inputs.installationType].label, source: inputs.conservativeMode ? 'Conservative Assumption' : 'User Input' },
      { parameter: 'Conductor material', value: inputs.material === 'aluminium' ? 'Aluminium' : 'Copper', source: 'User Input' },
      { parameter: 'Air velocity', value: num(inputs.airVelocityMs, 2) + ' m/s', source: inputs.conservativeMode ? 'Conservative Assumption' : 'User Input' },
      { parameter: 'Wire position', value: PwaAdvancedThermal.WIRE_POSITIONS[inputs.wirePosition].label, source: inputs.conservativeMode ? 'Conservative Assumption' : 'User Input' },
      { parameter: 'Adjacent loaded wires', value: String(inputs.adjacentLoadedWires), source: inputs.conservativeMode ? 'Conservative Assumption' : (inputs.adjacentManual ? 'User Input' : 'Engineering Default') },
      { parameter: 'Surface emissivity ε', value: String(inputs.emissivity), source: inputs.emissivityPreset === 'conservative' ? 'Conservative Assumption' : (inputs.emissivityPreset === 'custom' ? 'User Input' : 'Material Library') },
      { parameter: 'Insulation k', value: num(inputs.insulationK, 3) + ' W/(m·K)', source: inputs.insulationPreset === 'conservative' ? 'Engineering Default' : (inputs.insulationPreset === 'custom' ? 'User Input' : 'Material Library') },
      { parameter: 'Duty cycle', value: num(inputs.dutyCyclePct, 1) + '%', source: inputs.conservativeMode ? 'Conservative Assumption' : 'User Input' },
      { parameter: 'Hot surface temperature', value: num(inputs.hotSurfaceTempC, 1) + ' °C', source: 'User Input' },
      { parameter: 'Thermal contact', value: PwaAdvancedThermal.THERMAL_CONTACT[inputs.thermalContact].label, source: inputs.conservativeMode ? 'Conservative Assumption' : 'User Input' },
      { parameter: 'Outer diameter (avg)', value: num(inputs.odAvgMm, 2) + ' mm', source: wireRow ? 'Material Library' : 'Engineering Default' },
      { parameter: 'Existing T₂ (ARP4404)', value: num(inputs.existingT2C, 3) + ' °C', source: 'Existing Calculator' }
    ];
  }

  function pickWorstT2Column(visibleColumns) {
    var worst = null;
    var i;
    for (i = 0; i < visibleColumns.length; i += 1) {
      var col = visibleColumns[i];
      if (typeof col.T2 !== 'number' || !isFinite(col.T2)) {
        continue;
      }
      if (!worst || col.T2 > worst.T2) {
        worst = col;
      }
    }
    return worst;
  }

  function findWireRow(wireTypeId, awgLabel) {
    if (!global.PwaWireCatalog) {
      return null;
    }
    var rows = PwaWireCatalog.getWireRows(wireTypeId);
    var i;
    for (i = 0; i < rows.length; i += 1) {
      if (rows[i].label === awgLabel) {
        return rows[i];
      }
    }
    return null;
  }

  function readAdvancedInputs(params, visibleColumns) {
    var worstCol = pickWorstT2Column(visibleColumns);
    if (!worstCol) {
      return null;
    }

    var wireTypeEl = document.querySelector('#pwa-params-form [name="wireType"]');
    var wireTypeId = wireTypeEl ? wireTypeEl.value : params.wireTypeId;
    var wireRow = findWireRow(wireTypeId, worstCol.awg);
    var wireType = global.PwaWireCatalog ? PwaWireCatalog.getWireType(wireTypeId) : null;
    var odAvgMm = wireRow ? (wireRow.odMinMm + wireRow.odMaxMm) / 2 : 2.0;
    var r20Ohms = (worstCol.R1000 / 1000) * params.wireLengthFt;
    var conservativeEl = $('pwa-at-conservative');
    var conservativeMode = !!(conservativeEl && conservativeEl.checked);
    var emissivityPreset = $('pwa-at-emissivity-preset') ? $('pwa-at-emissivity-preset').value : 'conservative';
    var insulationPreset = $('pwa-at-insulation-k-preset') ? $('pwa-at-insulation-k-preset').value : 'conservative';
    var hotSurfaceEl = $('pwa-at-hot-surface');
    var hotSurfaceDefault = params.ambientTemp;
    var adjacentOverride = $('pwa-at-adjacent-override');

    applyConservativeMode(conservativeMode);

    var inputs = {
      awg: worstCol.awg,
      wireTypeLabel: wireType ? wireType.label : wireTypeId,
      currentA: params.circuitCurrent,
      r20Ohms: r20Ohms,
      ambientTempC: params.ambientTemp,
      altitudeFt: params.altitudeFt,
      runLengthM: params.wireLengthM,
      conductorRatingC: params.conductorTempRating,
      installationLimitC: params.applyInstallationTempLimit ? params.installationTempLimit : null,
      existingT2C: worstCol.T2,
      material: $('pwa-at-material') ? $('pwa-at-material').value : 'copper',
      installationType: $('pwa-at-installation-type') ? $('pwa-at-installation-type').value : 'bundledHarness',
      airVelocityMs: conservativeMode ? 0 : parseFloat($('pwa-at-air-velocity').value, 10),
      wirePosition: conservativeMode ? 'centre' : ($('pwa-at-wire-position') ? $('pwa-at-wire-position').value : 'centre'),
      adjacentLoadedWires: conservativeMode
        ? Math.max(params.bundleWireCount, PwaAdvancedThermal.estimateAdjacentLoadedWires(
          params.bundleWireCount,
          params.bundleLoadingPct
        ))
        : readAdjacentWires(params),
      adjacentManual: !!(adjacentOverride && adjacentOverride.checked),
      emissivityPreset: emissivityPreset,
      emissivity: readPresetValue(
        $('pwa-at-emissivity-preset'),
        $('pwa-at-emissivity-custom'),
        PwaAdvancedThermal.EMISSIVITY_PRESETS,
        'custom'
      ) || 0.8,
      insulationPreset: insulationPreset,
      insulationK: readPresetValue(
        $('pwa-at-insulation-k-preset'),
        $('pwa-at-insulation-k-custom'),
        PwaAdvancedThermal.INSULATION_K_PRESETS,
        'custom'
      ) || 0.2,
      dutyCyclePct: conservativeMode ? 100 : readDutyCyclePct(),
      hotSurfaceTempC: hotSurfaceEl ? parseFloat(hotSurfaceEl.value, 10) : hotSurfaceDefault,
      thermalContact: conservativeMode ? 'none' : ($('pwa-at-thermal-contact') ? $('pwa-at-thermal-contact').value : 'none'),
      odAvgMm: odAvgMm,
      conservativeMode: conservativeMode
    };

    if (!isFinite(inputs.airVelocityMs)) inputs.airVelocityMs = 0;
    if (!isFinite(inputs.hotSurfaceTempC)) inputs.hotSurfaceTempC = hotSurfaceDefault;
    inputs.assumptions = buildAssumptions(inputs, params, wireRow);
    return inputs;
  }

  function setText(id, text) {
    var el = $(id);
    if (el) {
      el.textContent = text == null ? '—' : String(text);
    }
  }

  function setHtml(id, html) {
    var el = $(id);
    if (el) {
      el.innerHTML = html;
    }
  }

  function renderWarnings(warnings) {
    var panel = $('pwa-at-warnings');
    if (!panel) {
      return;
    }
    if (!warnings || !warnings.length) {
      panel.hidden = true;
      panel.innerHTML = '';
      return;
    }
    panel.hidden = false;
    panel.innerHTML = warnings.map(function (msg) {
      return '<p class="pwa-at-warn">' + msg + '</p>';
    }).join('');
  }

  function renderAssumptionsTable(assumptions) {
    var tbody = $('pwa-at-assumptions-body');
    if (!tbody) {
      return;
    }
    tbody.innerHTML = (assumptions || []).map(function (row) {
      return '<tr><td>' + row.parameter + '</td><td>' + row.value + '</td><td>' + row.source + '</td></tr>';
    }).join('');
  }

  function renderResults(result) {
    if (!result) {
      setText('pwa-at-tc', '—');
      return;
    }

    setText('pwa-at-tc', num(result.tcAdvanced, 2));
    setText('pwa-at-tc-compare', num(result.tcAdvanced, 2));
    setText('pwa-at-rating-margin', num(result.ratingMarginC, 2));
    setText('pwa-at-install-margin', result.installMarginC != null ? num(result.installMarginC, 2) : '—');
    setText('pwa-at-utilisation', num(result.thermalUtilisationPct, 1) + '%');
    setText('pwa-at-mechanism', result.dominantMechanism);
    setText('pwa-at-qgen', num(result.heatBalance.qGenW, 4));
    setText('pwa-at-qconv', num(result.heatBalance.qConvW, 4));
    setText('pwa-at-qrad', num(result.heatBalance.qRadW, 4));
    setText('pwa-at-qcond', num(result.heatBalance.qCondW, 4));
    setText('pwa-at-residual', num(result.heatBalance.residualW, 4));
    setText('pwa-at-existing-t2', num(result.existingT2, 3));
    setText('pwa-at-diff', num(result.differenceC, 3));
    setText('pwa-at-diff-pct', result.differencePct != null ? num(result.differencePct, 2) + '%' : '—');
    setText('pwa-at-compare-status', result.comparisonStatus);
    setText('pwa-at-density', num(result.atmosphere.densityKgM3, 4));
    setText('pwa-at-pressure', num(result.atmosphere.pressureKPa, 2));
    setText('pwa-at-awg-note', 'Analysis AWG ' + result.awg + ' (highest T₂ among visible columns).');

    var passEl = $('pwa-at-passfail');
    if (passEl) {
      passEl.textContent = result.passFail;
      passEl.className = 'pwa-at-result__passfail pwa-at-result__passfail--' + result.passFail.toLowerCase();
    }

    var compareEl = $('pwa-at-compare-status');
    if (compareEl) {
      compareEl.className = 'pwa-at-compare__status pwa-at-compare__status--' +
        String(result.comparisonStatus).toLowerCase().replace(/\s+/g, '-');
    }

    renderWarnings(result.warnings);
    renderAssumptionsTable(result.assumptions);
  }

  function updateAfterRecalc(params, allColumns, visibleColumns) {
    if (!isEnabled()) {
      lastResult = null;
      return;
    }
    if (!visibleColumns || !visibleColumns.length) {
      lastResult = null;
      renderResults(null);
      setText('pwa-at-awg-note', 'Select AWG columns in the grid to run advanced thermal analysis.');
      return;
    }

    var inputs = readAdvancedInputs(params, visibleColumns);
    if (!inputs) {
      lastResult = null;
      renderResults(null);
      return;
    }

    lastResult = PwaAdvancedThermal.solveHeatBalance(inputs);
    renderResults(lastResult);
  }

  function syncHotSurfaceDefault(params) {
    var hotSurfaceEl = $('pwa-at-hot-surface');
    if (!hotSurfaceEl || hotSurfaceEl.dataset.userEdited === 'true') {
      return;
    }
    hotSurfaceEl.value = String(params.ambientTemp);
  }

  function extendSnapshot(snapshot) {
    if (!snapshot || !isEnabled()) {
      snapshot.advancedThermalEnabled = 'no';
      return snapshot;
    }
    snapshot.advancedThermalEnabled = 'yes';
    snapshot.advancedThermalConservative = $('pwa-at-conservative') && $('pwa-at-conservative').checked ? 'yes' : 'no';
    snapshot.advancedThermalInstallationType = $('pwa-at-installation-type') ? $('pwa-at-installation-type').value : '';
    snapshot.advancedThermalMaterial = $('pwa-at-material') ? $('pwa-at-material').value : '';
    return snapshot;
  }

  function getExportData() {
    if (!isEnabled() || !lastResult) {
      return null;
    }
    return lastResult;
  }

  function bindEvents() {
    if (bound) {
      return;
    }
    bound = true;

    var enableEl = $('pwa-advanced-thermal-enable');
    if (enableEl) {
      enableEl.addEventListener('change', function () {
        setPanelVisible(enableEl.checked);
        if (enableEl.checked) {
          var form = document.getElementById('pwa-params-form');
          if (form && global.PwaGridCalculator && typeof PwaGridCalculator.triggerRecalc === 'function') {
            PwaGridCalculator.triggerRecalc();
          } else if (form) {
            form.dispatchEvent(new Event('input', { bubbles: true }));
          }
        } else {
          lastResult = null;
          renderWarnings([]);
        }
      });
    }

    var panel = $('pwa-advanced-thermal-body');
    if (panel) {
      panel.addEventListener('change', function () {
        toggleCustomFields();
        applyConservativeMode();
        if (isEnabled()) {
          var form = document.getElementById('pwa-params-form');
          if (form) {
            form.dispatchEvent(new Event('input', { bubbles: true }));
          }
        }
      });
      panel.addEventListener('input', function (ev) {
        if (ev.target && ev.target.id === 'pwa-at-hot-surface') {
          ev.target.dataset.userEdited = 'true';
        }
        if (isEnabled()) {
          var form = document.getElementById('pwa-params-form');
          if (form) {
            form.dispatchEvent(new Event('input', { bubbles: true }));
          }
        }
      });
    }

    toggleCustomFields();
    applyConservativeMode();
  }

  function init() {
    if (!global.PwaAdvancedThermal) {
      return;
    }
    bindEvents();
    setPanelVisible(false);
    var hotSurfaceEl = $('pwa-at-hot-surface');
    if (hotSurfaceEl) {
      hotSurfaceEl.dataset.userEdited = 'false';
    }
  }

  global.PwaAdvancedThermalUI = {
    init: init,
    isEnabled: isEnabled,
    updateAfterRecalc: updateAfterRecalc,
    syncHotSurfaceDefault: syncHotSurfaceDefault,
    extendSnapshot: extendSnapshot,
    getExportData: getExportData
  };
})(typeof window !== 'undefined' ? window : this);
