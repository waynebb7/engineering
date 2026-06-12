/**
 * Power Wire Analysis — Standards Traceability Matrix
 * Documentation-only module; does not affect calculator mathematics.
 */
(function (global) {
  'use strict';

  var INTRO_TEXT =
    'This matrix maps each major calculator function, assumption and output to the relevant aerospace ' +
    'standard, advisory document or engineering basis. It is intended to improve reviewability, auditability ' +
    'and Design Authority traceability. It does not replace the applicable certification basis or formal ' +
    'compliance documentation.';

  var LEGEND_TEXT =
    'A = Directly standards-based\n' +
    'B = Derived from recognised aerospace practice\n' +
    'C = Engineering model / physics-based estimate\n' +
    'D = Conservative assumption requiring Design Authority acceptance\n' +
    'E = Requires test, inspection or project-specific validation';

  var LEGEND_DISCLAIMER =
    'This traceability matrix supports engineering review and auditability. It is not a declaration of ' +
    'compliance unless accepted under the applicable aircraft certification basis and Design Authority process.';

  var NON_COMPLIANCE_WARNING =
    'Standards references are provided for engineering traceability. Clause applicability depends on ' +
    'aircraft category, modification status, certification basis, customer requirements and Design Authority interpretation.';

  var CLAUSE_TBC = 'Clause / paragraph to be confirmed by Design Authority';

  var standardsTraceabilityRows = [
    {
      functionName: 'Wire gauge selection',
      toolAction: 'Selects or evaluates conductor size against declared current, resistance and installation constraints.',
      primaryReference: 'SAE AS50881 / SAE ARP4404 / manufacturer wire datasheet',
      referenceType: 'Standard',
      traceabilityLevel: 'B',
      evidenceNotes: 'Final wire selection must use approved aerospace wire data and aircraft programme rules.',
      userAction: 'Confirm selected wire type and gauge against approved project wiring standard.'
    },
    {
      functionName: 'Current carrying capacity',
      toolAction: 'Assesses whether declared circuit current is within derated ampacity for the selected wire and installation environment.',
      primaryReference: 'SAE ARP4404 / SAE AS50881',
      referenceType: 'Standard',
      traceabilityLevel: 'B',
      evidenceNotes: 'Current capacity is affected by wire size, insulation temperature rating, ambient temperature, bundle loading and installation environment. ' + CLAUSE_TBC + '.',
      userAction: 'Confirm derating basis and applicable aircraft programme criteria.'
    },
    {
      functionName: 'Voltage drop calculation',
      toolAction: 'Calculates circuit voltage drop from current, conductor resistance and run length against selected allowable limit.',
      primaryReference: 'SAE ARP4404 / FAA AC 43.13-1B / project electrical design rules',
      referenceType: 'Advisory Material',
      traceabilityLevel: 'B',
      evidenceNotes: 'Voltage drop is calculated from current, conductor resistance and run length. ' + CLAUSE_TBC + '.',
      userAction: 'Confirm allowable voltage drop for the specific equipment and aircraft power quality requirement.'
    },
    {
      functionName: 'Temperature-corrected voltage drop',
      toolAction: 'Adjusts conductor resistance for operating temperature to estimate hot-condition voltage drop.',
      primaryReference: 'Conductor resistance temperature coefficient / manufacturer data / recognised electrical engineering practice',
      referenceType: 'Engineering Model',
      traceabilityLevel: 'C',
      evidenceNotes: 'Resistance increases with conductor temperature, increasing voltage drop under hot operating conditions.',
      userAction: 'Confirm material coefficient and conductor operating temperature assumption.'
    },
    {
      functionName: 'Bundle derating',
      toolAction: 'Reduces allowable current capacity based on declared bundle wire count and grouping.',
      primaryReference: 'SAE ARP4404 / SAE AS50881',
      referenceType: 'Standard',
      traceabilityLevel: 'B',
      evidenceNotes: 'Bundle grouping reduces heat dissipation and requires current derating. ' + CLAUSE_TBC + '.',
      userAction: 'Confirm actual bundle size, loaded wire count and load diversity.'
    },
    {
      functionName: 'Bundle loading percentage',
      toolAction: 'Applies declared percentage of bundle wires carrying current to derating and thermal adjacent-wire estimates.',
      primaryReference: 'Load analysis / EWIS design practice / project-specific rules',
      referenceType: 'Project Assumption',
      traceabilityLevel: 'D',
      evidenceNotes: 'Bundle loading percentage is a declared engineering assumption unless derived from a circuit load analysis.',
      userAction: 'Confirm against aircraft electrical load analysis.'
    },
    {
      functionName: 'Altitude derating',
      toolAction: 'Reduces thermal heat rejection capability using altitude-based air density correction.',
      primaryReference: 'SAE ARP4404 / International Standard Atmosphere / engineering heat-transfer practice',
      referenceType: 'Engineering Model',
      traceabilityLevel: 'C',
      evidenceNotes: 'Reduced air density at altitude reduces convective cooling.',
      userAction: 'Confirm maximum operating altitude and installation cooling assumptions.'
    },
    {
      functionName: 'Ambient temperature input',
      toolAction: 'Uses declared ambient temperature as the basis for thermal derating and heat-balance boundary conditions.',
      primaryReference: 'RTCA DO-160 / aircraft zone temperature data / project environmental specification',
      referenceType: 'Project Assumption',
      traceabilityLevel: 'D',
      evidenceNotes: 'Ambient temperature must represent the local installation environment, not generic cabin temperature unless justified.',
      userAction: 'Confirm aircraft zone maximum operating temperature.'
    },
    {
      functionName: 'Existing T₂ conductor temperature estimate',
      toolAction: 'Estimates conductor temperature using ARP4404-style derating and declared installation parameters.',
      primaryReference: 'SAE ARP4404 style derating / engineering approximation',
      referenceType: 'Engineering Model',
      traceabilityLevel: 'C',
      evidenceNotes: 'T₂ provides a standards-style temperature estimate but is not a full heat-transfer solution.',
      userAction: 'Use for screening and compare with advanced model where required.'
    },
    {
      functionName: 'Installation temperature limit',
      toolAction: 'Compares calculated conductor temperature against a user-defined installation or zone temperature limit.',
      primaryReference: 'Aircraft zone requirements / RTCA DO-160 / Design Authority rules / flammable vapour zone requirements where applicable',
      referenceType: 'Project Assumption',
      traceabilityLevel: 'D',
      evidenceNotes: 'Installation limit must be appropriate to the physical aircraft zone and nearby materials.',
      userAction: 'Confirm applicable zone limit with Design Authority or environmental specification.'
    },
    {
      functionName: 'Advanced heat-balance model',
      toolAction: 'Estimates steady-state conductor temperature by balancing I²R heat generation against convection, radiation and conduction losses.',
      primaryReference: 'Heat-transfer physics / NASA wiring thermal modelling research / manufacturer data',
      referenceType: 'Engineering Model',
      traceabilityLevel: 'C',
      evidenceNotes: 'Balances I²R heat generation against convection, radiation and conduction losses. Supplementary analysis only.',
      userAction: 'Validate assumptions, especially airflow, emissivity, geometry and installation condition.'
    },
    {
      functionName: 'Conservative authority mode',
      toolAction: 'Forces worst-case thermal assumptions in the advanced heat-balance model when installation data is unavailable.',
      primaryReference: 'Conservative engineering practice / Design Authority acceptance',
      referenceType: 'Project Assumption',
      traceabilityLevel: 'D',
      evidenceNotes: 'Applies worst-case assumptions such as no forced airflow, centre-bundle position and no beneficial heat sinking.',
      userAction: 'Confirm conservative assumptions are acceptable for the design review.'
    },
    {
      functionName: 'Transient thermal model',
      toolAction: 'Integrates lumped thermal capacitance with time-varying load profiles to predict heating and cooling versus time.',
      primaryReference: 'Lumped thermal capacitance method / heat-transfer engineering practice / NASA thermal modelling research',
      referenceType: 'Engineering Model',
      traceabilityLevel: 'C',
      evidenceNotes: 'Predicts heating and cooling versus time for intermittent or cyclic loads. Formal use may require validation.',
      userAction: 'Validate against test data or approved thermal analysis for formal certification use.'
    },
    {
      functionName: 'Duty cycle / mission profile',
      toolAction: 'Applies declared current versus time profiles including pulses, duty cycles and mission phases in transient analysis.',
      primaryReference: 'Aircraft load analysis / system operating profile / mission analysis',
      referenceType: 'Project Assumption',
      traceabilityLevel: 'D',
      evidenceNotes: 'Duty cycle must reflect real system operation.',
      userAction: 'Confirm with system design data, equipment duty cycle or aircraft mission profile.'
    },
    {
      functionName: 'Assumptions table',
      toolAction: 'Documents inputs, defaults and calculated assumptions for advanced and transient supplementary models.',
      primaryReference: 'Engineering substantiation practice / auditability requirement',
      referenceType: 'Documentation Control',
      traceabilityLevel: 'B',
      evidenceNotes: 'Assumption visibility improves reviewability and supports Design Authority assessment.',
      userAction: 'Review all assumptions before using the report.'
    },
    {
      functionName: 'Report generation',
      toolAction: 'Exports calculator inputs, analysis grid, assessment results, assumptions and reference statements to Excel or Word.',
      primaryReference: 'Engineering documentation practice / project compliance evidence',
      referenceType: 'Standard',
      traceabilityLevel: 'B',
      evidenceNotes: 'Generated report summarises inputs, outputs, assumptions and references.',
      userAction: 'Review, approve and store under project configuration control where applicable.'
    }
  ];

  var filterState = {
    level: 'all',
    referenceType: 'all',
    search: ''
  };

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function getTraceabilityBadgeClass(level) {
    var map = {
      A: 'pwa-trace-badge--level-a',
      B: 'pwa-trace-badge--level-b',
      C: 'pwa-trace-badge--level-c',
      D: 'pwa-trace-badge--level-d',
      E: 'pwa-trace-badge--level-e'
    };
    return 'pwa-trace-badge ' + (map[level] || 'pwa-trace-badge--level-b');
  }

  function getReferenceTypeBadgeClass(type) {
    var slug = String(type || '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    return 'pwa-trace-badge pwa-trace-badge--type-' + slug;
  }

  function filterStandardsTraceabilityRows(rows) {
    rows = rows || standardsTraceabilityRows;
    var search = filterState.search.trim().toLowerCase();
    return rows.filter(function (row) {
      if (filterState.level !== 'all' && row.traceabilityLevel !== filterState.level) {
        return false;
      }
      if (filterState.referenceType !== 'all' && row.referenceType !== filterState.referenceType) {
        return false;
      }
      if (!search) {
        return true;
      }
      var haystack = [
        row.functionName,
        row.toolAction,
        row.primaryReference,
        row.referenceType,
        row.traceabilityLevel,
        row.evidenceNotes,
        row.userAction
      ].join(' ').toLowerCase();
      return haystack.indexOf(search) !== -1;
    });
  }

  function updateTraceabilitySummaryCards(rows) {
    var cardsEl = document.getElementById('pwa-trace-summary-cards');
    if (!cardsEl) {
      return;
    }
    var total = rows.length;
    var standardsBased = rows.filter(function (r) { return r.traceabilityLevel === 'A'; }).length;
    var engineering = rows.filter(function (r) { return r.traceabilityLevel === 'C'; }).length;
    var assumptions = rows.filter(function (r) { return r.traceabilityLevel === 'D'; }).length;
    var validation = rows.filter(function (r) { return r.traceabilityLevel === 'E'; }).length;

    cardsEl.innerHTML =
      '<div class="pwa-trace-summary-card"><span class="pwa-trace-summary-card__value">' + total + '</span><span class="pwa-trace-summary-card__label">Total traceability items</span></div>' +
      '<div class="pwa-trace-summary-card"><span class="pwa-trace-summary-card__value">' + standardsBased + '</span><span class="pwa-trace-summary-card__label">Directly standards-based (A)</span></div>' +
      '<div class="pwa-trace-summary-card"><span class="pwa-trace-summary-card__value">' + engineering + '</span><span class="pwa-trace-summary-card__label">Engineering model (C)</span></div>' +
      '<div class="pwa-trace-summary-card"><span class="pwa-trace-summary-card__value">' + assumptions + '</span><span class="pwa-trace-summary-card__label">Assumption-driven (D)</span></div>' +
      '<div class="pwa-trace-summary-card"><span class="pwa-trace-summary-card__value">' + validation + '</span><span class="pwa-trace-summary-card__label">Test / validation required (E)</span></div>';
  }

  function renderTableRows(rows) {
    return rows.map(function (row) {
      return '<tr>' +
        '<th scope="row">' + escapeHtml(row.functionName) + '</th>' +
        '<td>' + escapeHtml(row.toolAction) + '</td>' +
        '<td>' + escapeHtml(row.primaryReference) + '</td>' +
        '<td><span class="' + getReferenceTypeBadgeClass(row.referenceType) + '">' + escapeHtml(row.referenceType) + '</span></td>' +
        '<td><span class="' + getTraceabilityBadgeClass(row.traceabilityLevel) + '">' + escapeHtml(row.traceabilityLevel) + '</span></td>' +
        '<td>' + escapeHtml(row.evidenceNotes) + '</td>' +
        '<td>' + escapeHtml(row.userAction) + '</td>' +
        '</tr>';
    }).join('');
  }

  function renderCardRows(rows) {
    return rows.map(function (row) {
      return '<article class="pwa-trace-card">' +
        '<h4 class="pwa-trace-card__title">' + escapeHtml(row.functionName) + '</h4>' +
        '<dl class="pwa-trace-card__grid">' +
        '<div><dt>What the tool does</dt><dd>' + escapeHtml(row.toolAction) + '</dd></div>' +
        '<div><dt>Primary reference</dt><dd>' + escapeHtml(row.primaryReference) + '</dd></div>' +
        '<div><dt>Reference type</dt><dd><span class="' + getReferenceTypeBadgeClass(row.referenceType) + '">' + escapeHtml(row.referenceType) + '</span></dd></div>' +
        '<div><dt>Traceability level</dt><dd><span class="' + getTraceabilityBadgeClass(row.traceabilityLevel) + '">' + escapeHtml(row.traceabilityLevel) + '</span></dd></div>' +
        '<div><dt>Evidence / notes</dt><dd>' + escapeHtml(row.evidenceNotes) + '</dd></div>' +
        '<div><dt>User action required</dt><dd>' + escapeHtml(row.userAction) + '</dd></div>' +
        '</dl></article>';
    }).join('');
  }

  function renderStandardsTraceabilityMatrix() {
    var rows = filterStandardsTraceabilityRows();
    var tableBody = document.getElementById('pwa-trace-table-body');
    var cardsEl = document.getElementById('pwa-trace-cards');
    var emptyEl = document.getElementById('pwa-trace-empty');

    updateTraceabilitySummaryCards(rows);

    if (!rows.length) {
      if (tableBody) tableBody.innerHTML = '';
      if (cardsEl) cardsEl.innerHTML = '';
      if (emptyEl) emptyEl.hidden = false;
      return;
    }

    if (emptyEl) emptyEl.hidden = true;
    if (tableBody) tableBody.innerHTML = renderTableRows(rows);
    if (cardsEl) cardsEl.innerHTML = renderCardRows(rows);
  }

  function isIncludeInReport() {
    var el = document.getElementById('pwa-trace-include-report');
    return !el || el.checked;
  }

  function buildTraceabilityReportSection() {
    if (!isIncludeInReport()) {
      return null;
    }
    return {
      title: 'Standards Traceability Matrix',
      subtitle: 'Function-to-Standard Mapping for Aerospace Wire Analysis',
      intro: INTRO_TEXT,
      warning: NON_COMPLIANCE_WARNING,
      legend: LEGEND_TEXT,
      legendDisclaimer: LEGEND_DISCLAIMER,
      rows: standardsTraceabilityRows.slice()
    };
  }

  function getExportData() {
    return buildTraceabilityReportSection();
  }

  function bindFilters() {
    var levelEl = document.getElementById('pwa-trace-filter-level');
    var typeEl = document.getElementById('pwa-trace-filter-type');
    var searchEl = document.getElementById('pwa-trace-search');
    var reportEl = document.getElementById('pwa-trace-include-report');

    if (levelEl) {
      levelEl.addEventListener('change', function () {
        filterState.level = levelEl.value;
        renderStandardsTraceabilityMatrix();
      });
    }
    if (typeEl) {
      typeEl.addEventListener('change', function () {
        filterState.referenceType = typeEl.value;
        renderStandardsTraceabilityMatrix();
      });
    }
    if (searchEl) {
      searchEl.addEventListener('input', function () {
        filterState.search = searchEl.value;
        renderStandardsTraceabilityMatrix();
      });
    }
    if (reportEl) {
      reportEl.addEventListener('change', function () {
        /* export reads checkbox state at export time */
      });
    }
  }

  function initStandardsTraceabilityMatrix() {
    bindFilters();
    renderStandardsTraceabilityMatrix();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initStandardsTraceabilityMatrix);
  } else {
    initStandardsTraceabilityMatrix();
  }

  global.PwaStandardsTraceability = {
    INTRO_TEXT: INTRO_TEXT,
    LEGEND_TEXT: LEGEND_TEXT,
    LEGEND_DISCLAIMER: LEGEND_DISCLAIMER,
    NON_COMPLIANCE_WARNING: NON_COMPLIANCE_WARNING,
    standardsTraceabilityRows: standardsTraceabilityRows,
    initStandardsTraceabilityMatrix: initStandardsTraceabilityMatrix,
    renderStandardsTraceabilityMatrix: renderStandardsTraceabilityMatrix,
    filterStandardsTraceabilityRows: filterStandardsTraceabilityRows,
    updateTraceabilitySummaryCards: updateTraceabilitySummaryCards,
    getTraceabilityBadgeClass: getTraceabilityBadgeClass,
    getReferenceTypeBadgeClass: getReferenceTypeBadgeClass,
    buildTraceabilityReportSection: buildTraceabilityReportSection,
    getExportData: getExportData,
    isIncludeInReport: isIncludeInReport
  };
})(typeof window !== 'undefined' ? window : this);
