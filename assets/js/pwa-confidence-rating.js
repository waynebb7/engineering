/**
 * Power Wire Analysis — Confidence Rating System
 * Engineering assurance layer only; does not affect calculator mathematics.
 */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'powerWireConfidenceRatings_v1';

  var INTRO_TEXT =
    'This section rates the confidence level of the calculator inputs, assumptions and outputs. ' +
    'It helps identify which results are directly supported by standards, which are derived from ' +
    'recognised engineering practice, and which require validation or Design Authority acceptance.';

  var CROSS_REF_TEXT =
    'Confidence ratings complement the Standards Traceability Matrix. The traceability matrix identifies ' +
    'the reference basis; this section identifies evidence strength and assumption quality.';

  var LEGEND_ITEMS = [
    { level: 'A', label: 'Strong Evidence', text: 'Directly standards-based, datasheet-based, or measured' },
    { level: 'B', label: 'Recognised Practice', text: 'Derived from recognised aerospace engineering practice' },
    { level: 'C', label: 'Engineering Estimate', text: 'Physics-based engineering model or calculated estimate' },
    { level: 'D', label: 'Assumption', text: 'Conservative assumption requiring Design Authority acceptance' },
    { level: 'E', label: 'Validation Required', text: 'Requires test, inspection, validation, or project-specific evidence' }
  ];

  var DISCLAIMER_TEXT =
    'Confidence ratings are an engineering aid. They do not constitute certification approval, compliance ' +
    'finding, or Design Authority acceptance. Formal use requires confirmation against the applicable ' +
    'aircraft certification basis, approved data and project procedures.';

  var EVIDENCE_SOURCES = [
    'User Estimate',
    'Conservative Default',
    'Engineering Calculation',
    'Manufacturer Datasheet',
    'Approved Load Analysis',
    'Aircraft Zone Data',
    'Test / Measured Data',
    'Design Authority Approved'
  ];

  var RATING_LABELS = {
    A: 'Strong Evidence',
    B: 'Recognised Practice',
    C: 'Engineering Estimate',
    D: 'Assumption',
    E: 'Validation Required'
  };

  var confidenceRatingRowDefs = [
    {
      id: 'wire-gauge',
      item: 'Wire Gauge / Size',
      category: 'Input',
      defaultRating: 'B',
      defaultEvidenceSource: 'Manufacturer Datasheet',
      basis: 'Selected wire gauge is valid only if matched to approved aircraft wire specification or manufacturer datasheet.',
      riskIfIncorrect: 'Incorrect conductor size may invalidate current rating, voltage drop and thermal results.',
      recommendedAction: 'Confirm wire size against approved programme wiring standard or datasheet.',
      safetyCritical: true,
      valueKey: 'wireGauge'
    },
    {
      id: 'wire-type',
      item: 'Wire Type / Insulation Type',
      category: 'Input',
      defaultRating: 'B',
      defaultEvidenceSource: 'Manufacturer Datasheet',
      basis: 'Wire insulation affects conductor rating, emissivity, thermal conductivity and environmental suitability.',
      riskIfIncorrect: 'Incorrect insulation type may invalidate temperature rating and environmental suitability.',
      recommendedAction: 'Confirm against approved wire type, e.g. AS22759 or programme-specific wire list.',
      safetyCritical: true,
      valueKey: 'wireType'
    },
    {
      id: 'circuit-current',
      item: 'Circuit Current',
      category: 'Input',
      defaultRating: 'D',
      defaultEvidenceSource: 'User Estimate',
      basis: 'Current is user-entered unless linked to an approved electrical load analysis.',
      riskIfIncorrect: 'Underestimated current causes unsafe temperature and voltage drop predictions.',
      recommendedAction: 'Confirm current from load analysis, equipment datasheet or measured value.',
      safetyCritical: true,
      valueKey: 'circuitCurrent'
    },
    {
      id: 'run-length',
      item: 'Run Length',
      category: 'Input',
      defaultRating: 'D',
      defaultEvidenceSource: 'User Estimate',
      basis: 'Run length is user-entered and depends on actual aircraft routing.',
      riskIfIncorrect: 'Incorrect length affects resistance and voltage drop.',
      recommendedAction: 'Confirm from harness drawing, installation model or measured route length.',
      safetyCritical: false,
      valueKey: 'runLength'
    },
    {
      id: 'ambient-temperature',
      item: 'Ambient Temperature',
      category: 'Input',
      defaultRating: 'D',
      defaultEvidenceSource: 'User Estimate',
      basis: 'Ambient temperature must represent the local installation zone.',
      riskIfIncorrect: 'Low ambient assumption may underpredict conductor temperature.',
      recommendedAction: 'Confirm from aircraft environmental zone data, RTCA DO-160 assumptions or Design Authority limits.',
      safetyCritical: true,
      valueKey: 'ambientTemperature'
    },
    {
      id: 'bundle-count',
      item: 'Bundle Count',
      category: 'Input',
      defaultRating: 'D',
      defaultEvidenceSource: 'User Estimate',
      basis: 'Bundle count is user-entered unless derived from harness design data.',
      riskIfIncorrect: 'Incorrect bundle size may understate thermal derating.',
      recommendedAction: 'Confirm from harness drawing or EWIS bundle definition.',
      safetyCritical: true,
      valueKey: 'bundleCount'
    },
    {
      id: 'bundle-loading',
      item: 'Bundle Loading Percentage',
      category: 'Assumption',
      defaultRating: 'D',
      defaultEvidenceSource: 'User Estimate',
      basis: 'Bundle loading depends on simultaneous circuit operation and load diversity.',
      riskIfIncorrect: 'Underestimated loading may underpredict bundle heating.',
      recommendedAction: 'Confirm against aircraft electrical load analysis.',
      safetyCritical: true,
      valueKey: 'bundleLoading'
    },
    {
      id: 'altitude',
      item: 'Altitude',
      category: 'Input',
      defaultRating: 'B',
      defaultEvidenceSource: 'Aircraft Zone Data',
      basis: 'Altitude is normally known from aircraft operating envelope, but local pressure/cooling assumptions may vary.',
      riskIfIncorrect: 'Incorrect altitude may misrepresent convective cooling.',
      recommendedAction: 'Confirm maximum operating altitude or relevant design case.',
      safetyCritical: false,
      valueKey: 'altitude'
    },
    {
      id: 't2-estimate',
      item: 'Existing T₂ Estimated Conductor Temperature',
      category: 'Calculation',
      defaultRating: 'B',
      defaultEvidenceSource: 'Engineering Calculation',
      basis: 'Standards-style screening estimate using derating assumptions, not full installation-specific heat transfer.',
      riskIfIncorrect: 'May overpredict or underpredict actual conductor temperature depending on installation.',
      recommendedAction: 'Use as baseline screening and compare with Advanced Heat-Balance Model where required.',
      safetyCritical: false,
      valueKey: 't2Estimate'
    },
    {
      id: 'voltage-drop',
      item: 'Voltage Drop',
      category: 'Calculation',
      defaultRating: 'B',
      defaultEvidenceSource: 'Engineering Calculation',
      basis: 'Based on recognised electrical resistance and current calculation.',
      riskIfIncorrect: 'Equipment may receive insufficient voltage under load.',
      recommendedAction: 'Confirm allowable voltage drop from equipment specification and aircraft power quality rules.',
      safetyCritical: false,
      valueKey: 'voltageDrop'
    },
    {
      id: 'temp-voltage-drop',
      item: 'Temperature-Corrected Voltage Drop',
      category: 'Calculation',
      defaultRating: 'C',
      defaultEvidenceSource: 'Engineering Calculation',
      basis: 'Uses conductor temperature estimate to correct resistance.',
      riskIfIncorrect: 'Voltage drop may be understated in hot installations.',
      recommendedAction: 'Compare using T₂ and Advanced Tc when available.',
      safetyCritical: false,
      valueKey: 'tempVoltageDrop'
    },
    {
      id: 'current-capacity',
      item: 'Current Carrying Capacity',
      category: 'Output',
      defaultRating: 'B',
      defaultEvidenceSource: 'Engineering Calculation',
      basis: 'Based on selected wire data and derating logic.',
      riskIfIncorrect: 'Wire may exceed permissible temperature.',
      recommendedAction: 'Confirm derating basis against approved wiring standard and programme rules.',
      safetyCritical: false,
      valueKey: 'currentCapacity'
    },
    {
      id: 'installation-limit',
      item: 'Installation Temperature Limit',
      category: 'Assumption',
      defaultRating: 'D',
      defaultEvidenceSource: 'User Estimate',
      basis: 'Installation limit must be specific to aircraft zone, adjacent materials and flammable vapour exposure.',
      riskIfIncorrect: 'Local installation may be unsafe despite conductor rating pass.',
      recommendedAction: 'Confirm with Design Authority and aircraft zone environmental limits.',
      safetyCritical: true,
      valueKey: 'installationLimit'
    },
    {
      id: 'advanced-tc',
      item: 'Advanced Heat-Balance Temperature',
      category: 'Advanced Thermal',
      defaultRating: 'C',
      defaultEvidenceSource: 'Engineering Calculation',
      basis: 'Physics-based heat-balance model using convection, radiation and conduction assumptions.',
      riskIfIncorrect: 'Incorrect heat-transfer assumptions may underpredict conductor temperature.',
      recommendedAction: 'Validate airflow, emissivity, geometry, thermal contact and bundle assumptions.',
      safetyCritical: true,
      valueKey: 'advancedTc'
    },
    {
      id: 'air-velocity',
      item: 'Air Velocity',
      category: 'Advanced Thermal',
      defaultRating: 'D',
      defaultEvidenceSource: 'Conservative Default',
      basis: 'Airflow is usually unknown unless measured or specified by aircraft zone data.',
      riskIfIncorrect: 'Overestimated airflow may significantly underpredict conductor temperature.',
      recommendedAction: 'Use 0 m/s conservative default unless forced cooling is proven.',
      safetyCritical: false,
      valueKey: 'airVelocity'
    },
    {
      id: 'surface-emissivity',
      item: 'Surface Emissivity',
      category: 'Advanced Thermal',
      defaultRating: 'D',
      defaultEvidenceSource: 'Conservative Default',
      basis: 'Emissivity depends on insulation material, colour, surface condition and ageing.',
      riskIfIncorrect: 'Radiative heat rejection may be overestimated.',
      recommendedAction: 'Use conservative default unless supported by material data.',
      safetyCritical: false,
      valueKey: 'surfaceEmissivity'
    },
    {
      id: 'thermal-contact',
      item: 'Thermal Contact to Structure',
      category: 'Advanced Thermal',
      defaultRating: 'D',
      defaultEvidenceSource: 'Conservative Default',
      basis: 'Heat sinking into structure depends on real installation contact and clamping.',
      riskIfIncorrect: 'Assumed structural cooling may be non-conservative.',
      recommendedAction: 'Default to no beneficial heat sinking unless installation evidence exists.',
      safetyCritical: false,
      valueKey: 'thermalContact'
    },
    {
      id: 'transient-model',
      item: 'Transient Thermal Model',
      category: 'Transient Thermal',
      defaultRating: 'C',
      defaultEvidenceSource: 'Engineering Calculation',
      basis: 'Lumped thermal capacitance model provides engineering estimate of heat-up and cool-down behaviour.',
      riskIfIncorrect: 'Thermal response may differ if the real harness has distributed thermal gradients.',
      recommendedAction: 'Use for sensitivity and mission profile assessment; validate for formal use.',
      safetyCritical: true,
      valueKey: 'transientModel'
    },
    {
      id: 'duty-cycle',
      item: 'Duty Cycle / Mission Profile',
      category: 'Transient Thermal',
      defaultRating: 'D',
      defaultEvidenceSource: 'User Estimate',
      basis: 'Duty cycle depends on system operation, flight phase and equipment use.',
      riskIfIncorrect: 'Incorrect duty cycle may understate peak or accumulated thermal exposure.',
      recommendedAction: 'Confirm from system design data, equipment specification or mission analysis.',
      safetyCritical: false,
      valueKey: 'dutyCycle'
    },
    {
      id: 'standards-matrix',
      item: 'Standards Traceability Matrix',
      category: 'Documentation',
      defaultRating: 'B',
      defaultEvidenceSource: 'Engineering Calculation',
      basis: 'Provides traceability mapping but does not itself prove compliance.',
      riskIfIncorrect: 'Incorrect standard mapping may mislead review or certification evidence.',
      recommendedAction: 'Review references and clause applicability with Design Authority.',
      safetyCritical: false,
      valueKey: 'standardsMatrix'
    }
  ];

  var rowState = {};
  var filterState = {
    category: 'all',
    rating: 'all',
    evidenceSource: 'all',
    search: ''
  };
  var refreshTimer = null;

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function num(value, digits) {
    if (value == null || !isFinite(value)) {
      return '—';
    }
    return Number(value).toFixed(typeof digits === 'number' ? digits : 1);
  }

  function validRating(rating) {
    return rating === 'A' || rating === 'B' || rating === 'C' || rating === 'D' || rating === 'E';
  }

  function mapEvidenceSourceToRating(source) {
    switch (source) {
      case 'User Estimate':
      case 'Conservative Default':
        return 'D';
      case 'Engineering Calculation':
        return 'C';
      case 'Manufacturer Datasheet':
      case 'Approved Load Analysis':
      case 'Test / Measured Data':
      case 'Design Authority Approved':
        return 'A';
      case 'Aircraft Zone Data':
        return 'B';
      default:
        return 'D';
    }
  }

  function getConfidenceBadgeClass(level) {
    var map = {
      A: 'pwa-trace-badge--level-a',
      B: 'pwa-trace-badge--level-b',
      C: 'pwa-trace-badge--level-c',
      D: 'pwa-trace-badge--level-d',
      E: 'pwa-trace-badge--level-e'
    };
    return 'pwa-trace-badge ' + (map[level] || 'pwa-trace-badge--level-d');
  }

  function defaultRowState(def) {
    return {
      evidenceSource: def.defaultEvidenceSource,
      confidenceRating: def.defaultRating,
      manuallyOverridden: false
    };
  }

  function loadStoredState() {
    try {
      var raw = global.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return {};
      }
      var parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (err) {
      return {};
    }
  }

  function saveStoredState() {
    try {
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify(rowState));
    } catch (err) {
      /* ignore storage failures */
    }
  }

  function initRowState() {
    var stored = loadStoredState();
    confidenceRatingRowDefs.forEach(function (def) {
      var saved = stored[def.id];
      if (saved && EVIDENCE_SOURCES.indexOf(saved.evidenceSource) !== -1 && validRating(saved.confidenceRating)) {
        rowState[def.id] = {
          evidenceSource: saved.evidenceSource,
          confidenceRating: saved.confidenceRating,
          manuallyOverridden: !!saved.manuallyOverridden
        };
      } else {
        rowState[def.id] = defaultRowState(def);
      }
    });
  }

  function resetConfidenceRatingsToDefaults() {
    confidenceRatingRowDefs.forEach(function (def) {
      rowState[def.id] = defaultRowState(def);
    });
    saveStoredState();
    renderConfidenceRatingSystem();
  }

  function handleConfidenceManualOverride(rowId, rating) {
    if (!rowState[rowId] || !validRating(rating)) {
      return;
    }
    rowState[rowId].confidenceRating = rating;
    rowState[rowId].manuallyOverridden = true;
    saveStoredState();
    updateConfidenceRatingSummary();
    updateConfidenceWarnings(getFilteredRows());
  }

  function handleEvidenceSourceChange(rowId, source) {
    if (!rowState[rowId] || EVIDENCE_SOURCES.indexOf(source) === -1) {
      return;
    }
    rowState[rowId].evidenceSource = source;
    if (!rowState[rowId].manuallyOverridden) {
      rowState[rowId].confidenceRating = mapEvidenceSourceToRating(source);
    }
    saveStoredState();
    renderConfidenceRatingSystem();
  }

  function getGridSnapshot() {
    if (global.PwaGridCalculator && typeof PwaGridCalculator.getConfidenceSnapshot === 'function') {
      return PwaGridCalculator.getConfidenceSnapshot();
    }
    return null;
  }

  function getConfidenceCurrentValues() {
    var values = {};
    var snapshot = getGridSnapshot();
    var form = document.getElementById('pwa-params-form');

    if (snapshot && snapshot.assessment) {
      values.wireGauge = 'AWG ' + snapshot.assessment.worstAwg + ' (highest T₂ in visible grid)';
    } else {
      values.wireGauge = 'Not available';
    }

    if (snapshot && snapshot.wireTypeLabel) {
      values.wireType = snapshot.wireTypeLabel;
    } else if (form && form.elements.wireType) {
      var wireOpt = form.elements.wireType.options[form.elements.wireType.selectedIndex];
      values.wireType = wireOpt ? wireOpt.text : 'Not available';
    } else {
      values.wireType = 'Not available';
    }

    if (snapshot && snapshot.params) {
      values.circuitCurrent = num(snapshot.params.circuitCurrent, 2) + ' A';
      values.ambientTemperature = num(snapshot.params.ambientTemp, 1) + ' °C';
      values.bundleCount = String(snapshot.params.bundleWireCount) + ' wires';
      values.bundleLoading = String(snapshot.params.bundleLoadingPct) + '%';
      values.altitude = snapshot.params.altitudeFt.toLocaleString('en-US') + ' ft';
      values.runLength = num(snapshot.params.wireLengthFt, 2) + ' ft (' + num(snapshot.params.wireLengthM, 2) + ' m)';

      if (snapshot.params.applyInstallationTempLimit) {
        values.installationLimit = num(snapshot.params.installationTempLimit, 0) + ' °C (enabled)';
      } else {
        values.installationLimit = 'Not applied';
      }
    } else {
      values.circuitCurrent = 'Not available';
      values.ambientTemperature = 'Not available';
      values.bundleCount = 'Not available';
      values.bundleLoading = 'Not available';
      values.altitude = 'Not available';
      values.runLength = 'Not available';
      values.installationLimit = 'Not available';
    }

    if (snapshot && snapshot.assessment) {
      values.t2Estimate = num(snapshot.assessment.calculatedT2, 1) + ' °C (AWG ' + snapshot.assessment.worstAwg + ')';
    } else {
      values.t2Estimate = 'Not available';
    }

    if (snapshot && snapshot.worstColumn) {
      values.voltageDrop = num(snapshot.worstColumn.Vdrop, 3) + ' V (AWG ' + snapshot.worstColumn.awg + ')';
      values.tempVoltageDrop = num(snapshot.worstColumn.Vdrop, 3) + ' V @ T₂ ' + num(snapshot.worstColumn.T2, 1) + ' °C';
      values.currentCapacity = num(snapshot.params.circuitCurrent, 2) + ' A / ' + num(snapshot.worstColumn.Imax, 3) + ' A max (AWG ' + snapshot.worstColumn.awg + ')';
    } else {
      values.voltageDrop = 'Not available';
      values.tempVoltageDrop = 'Not available';
      values.currentCapacity = 'Not available';
    }

    var advEnabled = document.getElementById('pwa-advanced-thermal-enable');
    var advResult = global.PwaAdvancedThermalUI && PwaAdvancedThermalUI.getExportData
      ? PwaAdvancedThermalUI.getExportData()
      : null;
    if (advEnabled && advEnabled.checked && advResult) {
      values.advancedTc = num(advResult.tcAdvanced, 2) + ' °C';
    } else if (advEnabled && advEnabled.checked) {
      values.advancedTc = 'Enabled — not calculated yet';
    } else {
      values.advancedTc = 'Not enabled';
    }

    var airEl = document.getElementById('pwa-at-air-velocity');
    values.airVelocity = airEl ? num(parseFloat(airEl.value, 10), 1) + ' m/s' : 'Not available';

    var emissivityPreset = document.getElementById('pwa-at-emissivity-preset');
    var emissivityCustom = document.getElementById('pwa-at-emissivity-custom');
    if (emissivityPreset) {
      if (emissivityPreset.value === 'custom' && emissivityCustom) {
        values.surfaceEmissivity = num(parseFloat(emissivityCustom.value, 10), 2) + ' (custom)';
      } else {
        values.surfaceEmissivity = emissivityPreset.options[emissivityPreset.selectedIndex].text;
      }
    } else {
      values.surfaceEmissivity = 'Not available';
    }

    var contactEl = document.getElementById('pwa-at-thermal-contact');
    values.thermalContact = contactEl
      ? contactEl.options[contactEl.selectedIndex].text
      : 'Not available';

    var ttEnabled = document.getElementById('pwa-transient-enable');
    var ttResult = global.PwaTransientThermalUI && PwaTransientThermalUI.getExportData
      ? PwaTransientThermalUI.getExportData()
      : null;
    if (ttEnabled && ttEnabled.checked && ttResult && ttResult.summary) {
      values.transientModel = 'Enabled — peak ' + num(ttResult.summary.peakTempC, 2) + ' °C';
    } else if (ttEnabled && ttEnabled.checked) {
      values.transientModel = 'Enabled — not calculated yet';
    } else {
      values.transientModel = 'Not enabled';
    }

    var profileEl = document.getElementById('pwa-tt-profile-type');
    values.dutyCycle = profileEl
      ? profileEl.options[profileEl.selectedIndex].text
      : 'Not available';

    values.standardsMatrix = 'Available on page (Standards Traceability Matrix section)';

    return values;
  }

  function buildConfidenceRows() {
    var currentValues = getConfidenceCurrentValues();
    return confidenceRatingRowDefs.map(function (def) {
      var state = rowState[def.id] || defaultRowState(def);
      return {
        id: def.id,
        item: def.item,
        category: def.category,
        currentValue: currentValues[def.valueKey] || 'Not available',
        confidenceRating: state.confidenceRating,
        evidenceSource: state.evidenceSource,
        basis: def.basis,
        riskIfIncorrect: def.riskIfIncorrect,
        recommendedAction: def.recommendedAction,
        safetyCritical: def.safetyCritical,
        manuallyOverridden: state.manuallyOverridden
      };
    });
  }

  function filterConfidenceRows(rows) {
    rows = rows || buildConfidenceRows();
    var search = filterState.search.trim().toLowerCase();
    return rows.filter(function (row) {
      if (filterState.category !== 'all' && row.category !== filterState.category) {
        return false;
      }
      if (filterState.rating !== 'all' && row.confidenceRating !== filterState.rating) {
        return false;
      }
      if (filterState.evidenceSource !== 'all' && row.evidenceSource !== filterState.evidenceSource) {
        return false;
      }
      if (!search) {
        return true;
      }
      var haystack = [
        row.item,
        row.category,
        row.currentValue,
        row.confidenceRating,
        row.evidenceSource,
        row.basis,
        row.riskIfIncorrect,
        row.recommendedAction
      ].join(' ').toLowerCase();
      return haystack.indexOf(search) !== -1;
    });
  }

  function getFilteredRows() {
    return filterConfidenceRows(buildConfidenceRows());
  }

  function countByRating(rows) {
    var counts = { A: 0, B: 0, C: 0, D: 0, E: 0 };
    rows.forEach(function (row) {
      if (counts[row.confidenceRating] != null) {
        counts[row.confidenceRating] += 1;
      }
    });
    return counts;
  }

  function getLowestConfidenceRating(rows) {
    var order = ['E', 'D', 'C', 'B', 'A'];
    var i;
    for (i = 0; i < order.length; i += 1) {
      if (rows.some(function (row) { return row.confidenceRating === order[i]; })) {
        return order[i];
      }
    }
    return 'A';
  }

  function getOverallConfidenceClassification(rows) {
    var hasE = rows.some(function (row) { return row.confidenceRating === 'E'; });
    var hasD = rows.some(function (row) { return row.confidenceRating === 'D'; });
    var safetyReview = rows.some(function (row) {
      return row.safetyCritical && (row.confidenceRating === 'D' || row.confidenceRating === 'E');
    });

    if (safetyReview) {
      return {
        label: 'Review Required',
        detail: 'One or more safety-critical inputs or assumptions are rated D or E.'
      };
    }
    if (hasE) {
      return {
        label: 'Low Confidence',
        detail: 'One or more items require test, inspection or project-specific validation.'
      };
    }
    if (hasD) {
      return {
        label: 'Moderate Confidence',
        detail: 'Contains assumption-driven items requiring Design Authority acceptance.'
      };
    }
    return {
      label: 'High Confidence',
      detail: 'No D- or E-rated items in the current assessment.'
    };
  }

  function evidenceOptionsHtml(selected) {
    return EVIDENCE_SOURCES.map(function (source) {
      return '<option value="' + escapeHtml(source) + '"' +
        (source === selected ? ' selected' : '') + '>' + escapeHtml(source) + '</option>';
    }).join('');
  }

  function ratingOptionsHtml(selected) {
    return ['A', 'B', 'C', 'D', 'E'].map(function (rating) {
      return '<option value="' + rating + '"' + (rating === selected ? ' selected' : '') + '>' +
        rating + ' — ' + RATING_LABELS[rating] + '</option>';
    }).join('');
  }

  function renderRatingCell(row) {
    var overrideMark = row.manuallyOverridden
      ? ' <span class="pwa-conf-override" title="Manually overridden">*</span>'
      : '';
    return '<div class="pwa-conf-controls">' +
      '<label class="pwa-conf-control">' +
      '<span class="pwa-conf-control__label">Evidence</span>' +
      '<select class="pwa-conf-evidence" data-row-id="' + escapeHtml(row.id) + '" aria-label="Evidence source for ' + escapeHtml(row.item) + '">' +
      evidenceOptionsHtml(row.evidenceSource) +
      '</select></label>' +
      '<label class="pwa-conf-control">' +
      '<span class="pwa-conf-control__label">Rating</span>' +
      '<select class="pwa-conf-rating" data-row-id="' + escapeHtml(row.id) + '" aria-label="Confidence rating for ' + escapeHtml(row.item) + '">' +
      ratingOptionsHtml(row.confidenceRating) +
      '</select>' + overrideMark + '</label>' +
      '<span class="' + getConfidenceBadgeClass(row.confidenceRating) + '" title="' + escapeHtml(RATING_LABELS[row.confidenceRating]) + '">' +
      escapeHtml(row.confidenceRating) + '</span>' +
      '</div>';
  }

  function renderTableRows(rows) {
    return rows.map(function (row) {
      return '<tr data-row-id="' + escapeHtml(row.id) + '">' +
        '<th scope="row">' + escapeHtml(row.item) + '</th>' +
        '<td>' + escapeHtml(row.category) + '</td>' +
        '<td>' + escapeHtml(row.currentValue) + '</td>' +
        '<td>' + renderRatingCell(row) + '</td>' +
        '<td>' + escapeHtml(row.basis) + '</td>' +
        '<td>' + escapeHtml(row.riskIfIncorrect) + '</td>' +
        '<td>' + escapeHtml(row.recommendedAction) + '</td>' +
        '</tr>';
    }).join('');
  }

  function renderCardRows(rows) {
    return rows.map(function (row) {
      return '<article class="pwa-conf-card" data-row-id="' + escapeHtml(row.id) + '">' +
        '<h4 class="pwa-conf-card__title">' + escapeHtml(row.item) + '</h4>' +
        '<dl class="pwa-conf-card__grid">' +
        '<div><dt>Category</dt><dd>' + escapeHtml(row.category) + '</dd></div>' +
        '<div><dt>Current value</dt><dd>' + escapeHtml(row.currentValue) + '</dd></div>' +
        '<div><dt>Confidence / evidence</dt><dd>' + renderRatingCell(row) + '</dd></div>' +
        '<div><dt>Basis</dt><dd>' + escapeHtml(row.basis) + '</dd></div>' +
        '<div><dt>Risk if incorrect</dt><dd>' + escapeHtml(row.riskIfIncorrect) + '</dd></div>' +
        '<div><dt>Recommended action</dt><dd>' + escapeHtml(row.recommendedAction) + '</dd></div>' +
        '</dl></article>';
    }).join('');
  }

  function updateConfidenceWarnings(rows) {
    var lowEl = document.getElementById('pwa-conf-warning-low');
    var safetyEl = document.getElementById('pwa-conf-warning-safety');
    if (!lowEl || !safetyEl) {
      return;
    }

    var hasLow = rows.some(function (row) {
      return row.confidenceRating === 'D' || row.confidenceRating === 'E';
    });
    var safetyCriticalLow = rows.some(function (row) {
      return row.safetyCritical && (row.confidenceRating === 'D' || row.confidenceRating === 'E');
    });

    lowEl.hidden = !hasLow;
    safetyEl.hidden = !safetyCriticalLow;
  }

  function updateConfidenceRatingSummary() {
    var rows = getFilteredRows();
    var allRows = buildConfidenceRows();
    var counts = countByRating(allRows);
    var overall = getOverallConfidenceClassification(allRows);
    var lowest = getLowestConfidenceRating(allRows);

    var summaryEl = document.getElementById('pwa-conf-summary');
    var overallEl = document.getElementById('pwa-conf-overall');
    if (summaryEl) {
      summaryEl.innerHTML =
        '<div class="pwa-conf-summary-card"><span class="pwa-conf-summary-card__value">' + allRows.length + '</span><span class="pwa-conf-summary-card__label">Total items</span></div>' +
        '<div class="pwa-conf-summary-card"><span class="pwa-conf-summary-card__value">' + counts.A + '</span><span class="pwa-conf-summary-card__label">A-rated</span></div>' +
        '<div class="pwa-conf-summary-card"><span class="pwa-conf-summary-card__value">' + counts.B + '</span><span class="pwa-conf-summary-card__label">B-rated</span></div>' +
        '<div class="pwa-conf-summary-card"><span class="pwa-conf-summary-card__value">' + counts.C + '</span><span class="pwa-conf-summary-card__label">C-rated</span></div>' +
        '<div class="pwa-conf-summary-card"><span class="pwa-conf-summary-card__value">' + counts.D + '</span><span class="pwa-conf-summary-card__label">D-rated</span></div>' +
        '<div class="pwa-conf-summary-card"><span class="pwa-conf-summary-card__value">' + counts.E + '</span><span class="pwa-conf-summary-card__label">E-rated</span></div>' +
        '<div class="pwa-conf-summary-card pwa-conf-summary-card--overall"><span class="pwa-conf-summary-card__value">' + escapeHtml(lowest) + '</span><span class="pwa-conf-summary-card__label">Lowest rating</span></div>';
    }

    if (overallEl) {
      overallEl.innerHTML =
        '<p class="pwa-conf-overall__label"><strong>Overall confidence classification:</strong> ' +
        escapeHtml(overall.label) + '</p>' +
        '<p class="pwa-conf-overall__detail">' + escapeHtml(overall.detail) + '</p>';
    }

    updateConfidenceWarnings(allRows);
  }

  function bindRowControls(container) {
    if (!container) {
      return;
    }
    container.querySelectorAll('.pwa-conf-evidence').forEach(function (el) {
      el.onchange = function () {
        handleEvidenceSourceChange(el.getAttribute('data-row-id'), el.value);
      };
    });
    container.querySelectorAll('.pwa-conf-rating').forEach(function (el) {
      el.onchange = function () {
        handleConfidenceManualOverride(el.getAttribute('data-row-id'), el.value);
        renderConfidenceRatingSystem();
      };
    });
  }

  function renderConfidenceRatingSystem() {
    var rows = getFilteredRows();
    var tableBody = document.getElementById('pwa-conf-table-body');
    var cardsEl = document.getElementById('pwa-conf-cards');
    var emptyEl = document.getElementById('pwa-conf-empty');
    var tableWrap = document.querySelector('.pwa-conf-table-wrap');

    updateConfidenceRatingSummary();

    if (!rows.length) {
      if (tableBody) tableBody.innerHTML = '';
      if (cardsEl) cardsEl.innerHTML = '';
      if (emptyEl) emptyEl.hidden = false;
      if (tableWrap) tableWrap.hidden = true;
      return;
    }

    if (emptyEl) emptyEl.hidden = true;
    if (tableWrap) tableWrap.hidden = false;
    if (tableBody) {
      tableBody.innerHTML = renderTableRows(rows);
      bindRowControls(tableBody);
    }
    if (cardsEl) {
      cardsEl.innerHTML = renderCardRows(rows);
      bindRowControls(cardsEl);
    }
  }

  function scheduleConfidenceRefresh() {
    if (refreshTimer) {
      clearTimeout(refreshTimer);
    }
    refreshTimer = setTimeout(function () {
      renderConfidenceRatingSystem();
    }, 120);
  }

  function isIncludeInReport() {
    var el = document.getElementById('pwa-conf-include-report');
    return !el || el.checked;
  }

  function buildConfidenceReportSection() {
    if (!isIncludeInReport()) {
      return null;
    }
    var rows = buildConfidenceRows();
    var counts = countByRating(rows);
    var overall = getOverallConfidenceClassification(rows);
    var warnings = [];
    if (rows.some(function (row) { return row.confidenceRating === 'D' || row.confidenceRating === 'E'; })) {
      warnings.push('Some inputs or assumptions have low confidence. Results may be suitable for preliminary assessment only until evidence is improved.');
    }
    if (rows.some(function (row) {
      return row.safetyCritical && (row.confidenceRating === 'D' || row.confidenceRating === 'E');
    })) {
      warnings.push('Safety-critical inputs or assumptions require review before formal engineering use.');
    }
    return {
      title: 'Confidence Rating System',
      subtitle: 'Evidence Strength and Assumption Quality Assessment',
      intro: INTRO_TEXT,
      crossReference: CROSS_REF_TEXT,
      legend: LEGEND_ITEMS.map(function (item) {
        return item.level + ' = ' + item.text;
      }).join('\n'),
      disclaimer: DISCLAIMER_TEXT,
      overallClassification: overall.label,
      overallDetail: overall.detail,
      lowestRating: getLowestConfidenceRating(rows),
      counts: counts,
      warnings: warnings,
      rows: rows
    };
  }

  function bindFilters() {
    var categoryEl = document.getElementById('pwa-conf-filter-category');
    var ratingEl = document.getElementById('pwa-conf-filter-rating');
    var evidenceEl = document.getElementById('pwa-conf-filter-evidence');
    var searchEl = document.getElementById('pwa-conf-search');
    var resetEl = document.getElementById('pwa-conf-reset');

    if (categoryEl) {
      categoryEl.addEventListener('change', function () {
        filterState.category = categoryEl.value;
        renderConfidenceRatingSystem();
      });
    }
    if (ratingEl) {
      ratingEl.addEventListener('change', function () {
        filterState.rating = ratingEl.value;
        renderConfidenceRatingSystem();
      });
    }
    if (evidenceEl) {
      evidenceEl.addEventListener('change', function () {
        filterState.evidenceSource = evidenceEl.value;
        renderConfidenceRatingSystem();
      });
    }
    if (searchEl) {
      searchEl.addEventListener('input', function () {
        filterState.search = searchEl.value;
        renderConfidenceRatingSystem();
      });
    }
    if (resetEl) {
      resetEl.addEventListener('click', resetConfidenceRatingsToDefaults);
    }
  }

  function bindLiveUpdates() {
    var form = document.getElementById('pwa-params-form');
    if (form) {
      form.addEventListener('input', scheduleConfidenceRefresh);
      form.addEventListener('change', scheduleConfidenceRefresh);
    }
    ['pwa-advanced-thermal-body', 'pwa-transient-body', 'pwa-advanced-thermal-enable', 'pwa-transient-enable'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', scheduleConfidenceRefresh);
        el.addEventListener('change', scheduleConfidenceRefresh);
      }
    });
  }

  function initConfidenceRatingSystem() {
    initRowState();
    bindFilters();
    bindLiveUpdates();
    renderConfidenceRatingSystem();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initConfidenceRatingSystem);
  } else {
    initConfidenceRatingSystem();
  }

  global.PwaConfidenceRating = {
    STORAGE_KEY: STORAGE_KEY,
    INTRO_TEXT: INTRO_TEXT,
    CROSS_REF_TEXT: CROSS_REF_TEXT,
    DISCLAIMER_TEXT: DISCLAIMER_TEXT,
    LEGEND_ITEMS: LEGEND_ITEMS,
    EVIDENCE_SOURCES: EVIDENCE_SOURCES,
    confidenceRatingRowDefs: confidenceRatingRowDefs,
    initConfidenceRatingSystem: initConfidenceRatingSystem,
    getConfidenceCurrentValues: getConfidenceCurrentValues,
    renderConfidenceRatingSystem: renderConfidenceRatingSystem,
    updateConfidenceRatingSummary: updateConfidenceRatingSummary,
    filterConfidenceRows: filterConfidenceRows,
    mapEvidenceSourceToRating: mapEvidenceSourceToRating,
    handleConfidenceManualOverride: handleConfidenceManualOverride,
    getConfidenceBadgeClass: getConfidenceBadgeClass,
    getOverallConfidenceClassification: getOverallConfidenceClassification,
    buildConfidenceReportSection: buildConfidenceReportSection,
    getExportData: buildConfidenceReportSection,
    isIncludeInReport: isIncludeInReport,
    resetConfidenceRatingsToDefaults: resetConfidenceRatingsToDefaults
  };
})(typeof window !== 'undefined' ? window : this);
