(function () {
  'use strict';

  var COPPER_REF = 254.5;
  var COPPER_COEF = 234.5;
  var FT_TO_M = 0.3048;
  var IN_TO_M = 0.0254;

  var WIRE_TYPE_LABEL = '';

  var WIRES = [
    { label: '24', ohm1000ft: 34.96055994685995, freeAirA: 16 },
    { label: '22', ohm1000ft: 17.92223997275819, freeAirA: 21 },
    { label: '20', ohm1000ft: 9.99743998480389, freeAirA: 28 },
    { label: '18', ohm1000ft: 6.339839990363444, freeAirA: 38 },
    { label: '16', ohm1000ft: 4.389119993328538, freeAirA: 40 },
    { label: '14', ohm1000ft: 3.230879995089062, freeAirA: 56 },
    { label: '12', ohm1000ft: 2.0116799969422465, freeAirA: 71.5 },
    { label: '10', ohm1000ft: 1.2588239980865876, freeAirA: 99 },
    { label: '8', ohm1000ft: 0.7315199988880896, freeAirA: 160 },
    { label: '6', ohm1000ft: 0.4785359992726253, freeAirA: 215 },
    { label: '4', ohm1000ft: 0.2959607995501396, freeAirA: 295 },
    { label: '2', ohm1000ft: 0.18470879971924264, freeAirA: 400 },
    { label: '1', ohm1000ft: 0.152399999768352, freeAirA: 460 },
    { label: '0', ohm1000ft: 0.11612879982348423, freeAirA: 540 },
    { label: '00', ohm1000ft: 0.08839199986564415, freeAirA: 630 },
    { label: '000', ohm1000ft: 0.07223759989019884, freeAirA: 740 },
    { label: '0000', ohm1000ft: 0.057911999911973766, freeAirA: 920 }
  ];

  var GRID_ROWS = [
    { key: 'awg', labelB: '', labelC: 'AWG', unit: '', fmt: 'awg' },
    { key: 'L1', labelB: 'Maximum wire length (NOT DE-RATED)', labelC: 'L1', unit: 'FEET', fmt: 'num' },
    { key: 'V', labelB: 'System Voltage', labelC: 'V', unit: 'VOLTS', fmt: 'num' },
    { key: 'U', labelB: 'Allowable voltage drop', labelC: 'U', unit: 'VOLTS', fmt: 'num' },
    { key: 'I', labelB: 'Circuit current', labelC: 'I', unit: 'AMPS', fmt: 'num' },
    { key: 'Rft', labelB: 'Resistance of wire per feet @ 20\u00B0C', labelC: 'R', unit: '\u03A9/ft', fmt: 'sci' },
    { key: 'R1000', labelB: 'Resistance of wire per 1000 feet @ 20\u00B0C', labelC: '', unit: '\u03A9/1000ft', fmt: 'num' },
    { key: 'T1', labelB: 'Ambient temperature', labelC: 'T1', unit: '\u00B0C', fmt: 'num' },
    { key: 'TR', labelB: 'Conductor temperature rating', labelC: 'TR', unit: '\u00B0C', fmt: 'num' },
    { key: 'T2', labelB: 'Estimated conductor temperature', labelC: 'T2', unit: '\u00B0C', fmt: 'num' },
    { key: 'Imax', labelB: 'Maximum allowable current @ TR', labelC: 'I_max', unit: 'AMPS', fmt: 'num' },
    { key: 'IfreePct', labelB: 'Actual % of current against free air current', labelC: 'I/I_free', unit: 'RATIO', fmt: 'num' },
    { key: 'freeAir', labelB: 'Max conductor current in free air (AC 43.13 Fig 11-4a)', labelC: '', unit: 'AMPS', fmt: 'num' },
    { key: 'bundle', labelB: 'De-rating (Bundle)', labelC: '', unit: 'FACTOR', fmt: 'factor' },
    { key: 'altitude', labelB: 'De-rating (Altitude)', labelC: '', unit: 'FACTOR', fmt: 'factor' },
    { key: 'IImax', labelB: 'I/IMAX', labelC: '', unit: 'RATIO', fmt: 'num' },
    { key: 'sqrtIImax', labelB: 'SQRT I/IMAX', labelC: '', unit: '', fmt: 'num' },
    { key: 'L2ft', labelB: 'Maximum wire length (DE-RATED) (MOST SEVERE)', labelC: 'L2', unit: 'FEET', fmt: 'num' },
    { key: 'L2m', labelB: 'Maximum wire length (DE-RATED) (MOST SEVERE)', labelC: 'L2', unit: 'METRES', fmt: 'num' },
    { key: 'spacer', labelB: '', labelC: '', unit: '', fmt: 'blank' },
    { key: 'spacer2', labelB: '', labelC: '', unit: '', fmt: 'blank' },
    { key: 'Vdrop', labelB: 'Voltage drop', labelC: '', unit: 'volts drop', fmt: 'num' },
    { key: 'wireLenFt', labelB: 'Wire Length for purposes of Voltage Drop', labelC: '', unit: 'FEET', fmt: 'num' },
    { key: 'wireLenM', labelB: 'Wire Length for purposes of Voltage Drop', labelC: '', unit: 'METRES', fmt: 'num' }
  ];

  function num(val, digits) {
    if (val === null || val === undefined || val === '') return '';
    if (typeof val !== 'number' || !isFinite(val)) return '';
    return val.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: typeof digits === 'number' ? digits : 6
    });
  }

  function sci(val) {
    if (typeof val !== 'number' || !isFinite(val)) return '';
    if (val === 0) return '0';
    if (val >= 0.001) return num(val, 6);
    return val.toExponential(4);
  }

  function readParams(form) {
    function f(name) {
      return parseFloat(form.elements[name].value, 10);
    }
    var routingPct = f('routingPct');
    var wireLength = f('wireLength');
    var unit = form.elements.wireLengthUnit.value;
    var baseIn = unit === 'm' ? wireLength / IN_TO_M : wireLength;
    var totalIn = baseIn * (1 + routingPct / 100);
    var wireLengthFt = totalIn / 12;

    var generatorLineVoltage = f('generatorLineVoltage');
    var postConditioningVoltage = f('postConditioningVoltage');
    var voltageRatio = postConditioningVoltage / generatorLineVoltage;
    var regulatedPhaseCurrent = f('regulatedPhaseCurrent');
    var circuitCurrent = regulatedPhaseCurrent * voltageRatio;

    return {
      generatorLineVoltage: generatorLineVoltage,
      postConditioningVoltage: postConditioningVoltage,
      voltageRatio: voltageRatio,
      circuitCurrent: circuitCurrent,
      allowableDrop: f('allowableDrop'),
      ambientTemp: f('ambientTemp'),
      conductorTempRating: f('conductorTempRating'),
      altitudeDerating: f('altitudeDerating'),
      bundleDerating: f('bundleDerating'),
      wireLengthFt: wireLengthFt,
      wireLengthM: wireLengthFt * FT_TO_M
    };
  }

  function computeColumn(params, wire) {
    var R1000 = wire.ohm1000ft;
    var Rft = R1000 / 1000;
    var U = params.allowableDrop;
    var I = params.circuitCurrent;
    var T1 = params.ambientTemp;
    var TR = params.conductorTempRating;
    var L1 = U / (I * Rft);
    var freeAir = wire.freeAirA;
    var bundle = params.bundleDerating;
    var altitude = params.altitudeDerating;
    var Imax = freeAir * bundle * altitude;
    var IImax = I / Imax;
    var sqrtIImax = Math.sqrt(IImax);
    var T2 = T1 + (TR - T1) * sqrtIImax;
    var L2ft = (COPPER_REF * L1) / (COPPER_COEF + T2);
    var L2m = L2ft * FT_TO_M;
    var wireLenFt = params.wireLengthFt;
    var Vdrop = (I * Rft * wireLenFt) * (COPPER_COEF + T2) / COPPER_REF;

    return {
      awg: wire.label,
      L1: L1,
      V: params.generatorLineVoltage,
      U: U,
      I: I,
      Rft: Rft,
      R1000: R1000,
      T1: T1,
      TR: TR,
      T2: T2,
      Imax: Imax,
      IfreePct: I / freeAir,
      freeAir: freeAir,
      bundle: bundle,
      altitude: altitude,
      IImax: IImax,
      sqrtIImax: sqrtIImax,
      L2ft: L2ft,
      L2m: L2m,
      Vdrop: Vdrop,
      wireLenFt: wireLenFt,
      wireLenM: params.wireLengthM
    };
  }

  function formatCell(row, value) {
    if (row.fmt === 'blank') return '';
    if (row.fmt === 'awg') return value;
    if (row.fmt === 'factor') return num(value, 4);
    if (row.fmt === 'sci') return sci(value);
    return num(value, 6);
  }

  function renderGrid(params) {
    var columns = WIRES.map(function (wire) {
      return computeColumn(params, wire);
    });

    var frozenHead = document.querySelector('#pwa-grid-frozen thead');
    var frozenBody = document.querySelector('#pwa-grid-frozen tbody');
    var dataHead = document.querySelector('#pwa-grid-data thead');
    var dataBody = document.querySelector('#pwa-grid-data tbody');
    if (!frozenHead || !frozenBody || !dataHead || !dataBody) return;

    frozenHead.innerHTML =
      '<tr class="pwa-grid__head">' +
        '<th class="pwa-grid__label-b"></th>' +
        '<th class="pwa-grid__label-c">AWG</th>' +
        '<th class="pwa-grid__eq">=</th>' +
      '</tr>';

    var dataHeadHtml = '<tr class="pwa-grid__head">';
    columns.forEach(function (col) {
      dataHeadHtml += '<th class="pwa-grid__awg">' + col.awg + '</th>';
    });
    dataHeadHtml += '<th class="pwa-grid__unit"></th></tr>';
    dataHead.innerHTML = dataHeadHtml;

    var frozenHtml = '';
    var dataHtml = '';
    GRID_ROWS.forEach(function (row, idx) {
      if (row.key === 'awg') return;
      var excelRow = idx + 7;
      var rowClass = 'pwa-grid__row' + (row.fmt === 'blank' ? ' pwa-grid__row--blank' : '');

      frozenHtml +=
        '<tr class="' + rowClass + '" data-row="' + excelRow + '">' +
          '<th class="pwa-grid__label-b" scope="row">' + row.labelB + '</th>' +
          '<td class="pwa-grid__label-c">' + row.labelC + '</td>' +
          '<td class="pwa-grid__eq">=</td>' +
        '</tr>';

      dataHtml += '<tr class="' + rowClass + '" data-row="' + excelRow + '">';
      columns.forEach(function (col) {
        var val = col[row.key];
        dataHtml += '<td class="pwa-grid__val">' + formatCell(row, val) + '</td>';
      });
      dataHtml += '<td class="pwa-grid__unit">' + row.unit + '</td></tr>';
    });

    frozenBody.innerHTML = frozenHtml;
    dataBody.innerHTML = dataHtml;
    syncGridRowHeights();
  }

  function syncGridRowHeights() {
    var frozenHeadRow = document.querySelector('#pwa-grid-frozen thead tr');
    var dataHeadRow = document.querySelector('#pwa-grid-data thead tr');
    var frozenRows = document.querySelectorAll('#pwa-grid-frozen tbody tr');
    var dataRows = document.querySelectorAll('#pwa-grid-data tbody tr');

    function matchPair(a, b) {
      if (!a || !b) return;
      a.style.height = '';
      b.style.height = '';
      var height = Math.max(a.offsetHeight, b.offsetHeight);
      a.style.height = height + 'px';
      b.style.height = height + 'px';
    }

    matchPair(frozenHeadRow, dataHeadRow);
    for (var i = 0; i < frozenRows.length; i += 1) {
      matchPair(frozenRows[i], dataRows[i]);
    }
  }

  function updateDerived(params) {
    var ftEl = document.getElementById('pwa-wire-length-ft');
    var mEl = document.getElementById('pwa-wire-length-m');
    if (ftEl) ftEl.textContent = num(params.wireLengthFt, 2);
    if (mEl) mEl.textContent = num(params.wireLengthM, 3);
  }

  function recalc() {
    var form = document.getElementById('pwa-params-form');
    if (!form) return;
    var params = readParams(form);
    updateDerived(params);
    renderGrid(params);
  }

  function updateGridTitle() {
    var el = document.getElementById('pwa-grid-title');
    if (!el) return;
    el.textContent = WIRE_TYPE_LABEL
      ? WIRE_TYPE_LABEL + ' — wire analysis grid'
      : 'Wire analysis grid';
  }

  function init() {
    var form = document.getElementById('pwa-params-form');
    if (!form) return;

    updateGridTitle();

    var unitEl = form.elements.wireLengthUnit;
    var lengthEl = form.elements.wireLength;
    var lastUnit = unitEl ? unitEl.value : 'in';

    if (unitEl && lengthEl) {
      unitEl.addEventListener('change', function () {
        var val = parseFloat(lengthEl.value, 10);
        var newUnit = unitEl.value;
        if (isFinite(val) && lastUnit !== newUnit) {
          if (lastUnit === 'in' && newUnit === 'm') {
            lengthEl.value = String(Math.round(val * IN_TO_M * 10000) / 10000);
          } else if (lastUnit === 'm' && newUnit === 'in') {
            lengthEl.value = String(Math.round(val / IN_TO_M * 100) / 100);
          }
        }
        lastUnit = newUnit;
      });
    }

    form.addEventListener('input', recalc);
    form.addEventListener('change', recalc);
    window.addEventListener('resize', syncGridRowHeights);
    recalc();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
