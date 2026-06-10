(function () {
  'use strict';

  var COPPER_REF = 254.5;
  var COPPER_COEF = 234.5;
  var FT_TO_M = 0.3048;
  var IN_TO_M = 0.0254;

  var WIRE_TYPE_LABEL = '';
  var lastGridColumns = [];

  var EXPORT_COLUMN_IDS = ['labelB', 'labelC', 'eq', 'awg', 'unit'];

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
    { key: 'L1', labelB: 'Maximum wire length (NOT DE-RATED)', labelC: 'L1', unit: 'FEET', fmt: 'num', digits: 3 },
    { key: 'V', labelB: 'System Voltage', labelC: 'V', unit: 'VOLTS', fmt: 'num', digits: 2 },
    { key: 'U', labelB: 'Allowable voltage drop', labelC: 'U', unit: 'VOLTS', fmt: 'num' },
    { key: 'I', labelB: 'Circuit current', labelC: 'I', unit: 'AMPS', fmt: 'num', digits: 2 },
    { key: 'Rft', labelB: 'Resistance of wire per feet @ 20\u00B0C', labelC: 'R', unit: '\u03A9/ft', fmt: 'sci' },
    { key: 'R1000', labelB: 'Resistance of wire per 1000 feet @ 20\u00B0C', labelC: '', unit: '\u03A9/1000ft', fmt: 'num', digits: 3 },
    { key: 'T1', labelB: 'Ambient temperature', labelC: 'T1', unit: '\u00B0C', fmt: 'num' },
    { key: 'TR', labelB: 'Conductor temperature rating', labelC: 'TR', unit: '\u00B0C', fmt: 'num' },
    { key: 'T2', labelB: 'Estimated conductor temperature', labelC: 'T2', unit: '\u00B0C', fmt: 'num', digits: 3 },
    { key: 'Imax', labelB: 'Maximum allowable current @ TR', labelC: 'IMAX', unit: 'AMPS', fmt: 'num', digits: 3 },
    { key: 'IfreePct', labelB: 'Actual % of current against free air current', labelC: '%', unit: '%', fmt: 'pct' },
    { key: 'freeAir', labelB: 'De-rating (Max conductor current in free air)', labelC: 'x', unit: 'AMPS', fmt: 'num' },
    { key: 'bundle', labelB: 'De-rating (Bundle)', labelC: 'y', unit: '', fmt: 'factor', digits: 2 },
    { key: 'altitude', labelB: 'De-rating (Altitude)', labelC: 'z', unit: '', fmt: 'factor' },
    { key: 'IImax', labelB: 'I/IMAX', labelC: '', unit: '', fmt: 'num', digits: 3 },
    { key: 'sqrtIImax', labelB: 'SQRT I/IMAX', labelC: '', unit: '', fmt: 'num', digits: 3 },
    { key: 'L2ft', labelB: 'Maximum wire length (DE-RATED) (MOST SEVERE)', labelC: 'L2', unit: 'FEET', fmt: 'num', digits: 3 },
    { key: 'L2m', labelB: 'Maximum wire length (DE-RATED) (MOST SEVERE)', labelC: 'L2', unit: 'METRES', fmt: 'num', digits: 3 },
    { key: 'Vdrop', labelB: 'Voltage drop', labelC: '', unit: 'volts drop', fmt: 'num', digits: 3, section: 'vdrop' },
    { key: 'wireLenFt', labelB: 'Wire Length for purposes of Voltage Drop', labelC: '', unit: 'FEET', fmt: 'num', digits: 3, section: 'vdrop' },
    { key: 'wireLenM', labelB: 'Wire Length for purposes of Voltage Drop', labelC: '', unit: 'METRES', fmt: 'num', digits: 3, section: 'vdrop' }
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
    var circuitCurrent = f('circuitCurrent');

    return {
      generatorLineVoltage: generatorLineVoltage,
      postConditioningVoltage: postConditioningVoltage,
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
    if (row.fmt === 'factor') {
      return num(value, typeof row.digits === 'number' ? row.digits : 4);
    }
    if (row.fmt === 'pct') {
      if (typeof value !== 'number' || !isFinite(value)) return '';
      return num(value * 100, 0) + '%';
    }
    if (row.fmt === 'sci') return sci(value);
    return num(value, typeof row.digits === 'number' ? row.digits : 6);
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function getSelectedExportColumns() {
    var allEl = document.getElementById('pwa-export-all');
    if (allEl && allEl.checked) {
      return EXPORT_COLUMN_IDS.slice();
    }
    var selected = [];
    document.querySelectorAll('input[name="exportCol"]:checked').forEach(function (el) {
      selected.push(el.value);
    });
    return selected;
  }

  function buildExportRowCells(row, gridColumns, selected, isAwgHeaderRow) {
    var cells = [];

    if (selected.indexOf('labelB') >= 0) {
      cells.push({
        text: isAwgHeaderRow ? '' : row.labelB,
        align: 'left'
      });
    }
    if (selected.indexOf('labelC') >= 0) {
      cells.push({
        text: isAwgHeaderRow ? 'AWG' : row.labelC,
        align: 'center'
      });
    }
    if (selected.indexOf('eq') >= 0) {
      cells.push({ text: '=', align: 'center' });
    }
    if (selected.indexOf('awg') >= 0) {
      gridColumns.forEach(function (col) {
        var text = isAwgHeaderRow ? col.awg : formatCell(row, col[row.key]);
        cells.push({ text: text, align: 'center' });
      });
    }
    if (selected.indexOf('unit') >= 0) {
      cells.push({
        text: isAwgHeaderRow ? '' : row.unit,
        align: 'center'
      });
    }

    return cells;
  }

  function buildExportRows(selected, gridColumns) {
    var rows = [];
    var dividerShown = false;
    var awgRow = GRID_ROWS[0];

    rows.push({
      cells: buildExportRowCells(awgRow, gridColumns, selected, true),
      isHeader: true
    });

    GRID_ROWS.forEach(function (row) {
      if (row.key === 'awg') return;

      if (row.section === 'vdrop' && !dividerShown) {
        dividerShown = true;
        rows.push({ divider: true });
      }

      rows.push({
        cells: buildExportRowCells(row, gridColumns, selected, false),
        isHeader: false
      });
    });

    return rows;
  }

  function buildExportPlainText(rows) {
    var lines = [];
    rows.forEach(function (row) {
      if (row.divider) {
        lines.push('');
        return;
      }
      lines.push(row.cells.map(function (cell) { return cell.text; }).join('\t'));
    });
    return lines.join('\n');
  }

  function buildExportHtml(rows) {
    var table =
      '<table border="1" cellspacing="0" cellpadding="4" ' +
      'style="border-collapse:collapse;font-family:Calibri,Arial,sans-serif;font-size:10pt;">';

    rows.forEach(function (row) {
      if (row.divider) {
        var colspan = row.colspan || 1;
        table +=
          '<tr><td colspan="' + colspan + '" ' +
          'style="border:1px solid #000;border-top:2px solid #000;height:6px;">&nbsp;</td></tr>';
        return;
      }

      var tag = row.isHeader ? 'th' : 'td';
      table += '<tr>';
      row.cells.forEach(function (cell) {
        table +=
          '<' + tag + ' style="border:1px solid #000;text-align:' + cell.align +
          ';vertical-align:middle;">' + escapeHtml(cell.text) + '</' + tag + '>';
      });
      table += '</tr>';
    });

    table += '</table>';
    return table;
  }

  function buildWordClipboardHtml(tableHtml) {
    return (
      '<html><head><meta charset="utf-8"></head><body>' +
      '<!--StartFragment-->' + tableHtml + '<!--EndFragment-->' +
      '</body></html>'
    );
  }

  function copyHtmlFallback(tableHtml, plainText) {
    return new Promise(function (resolve, reject) {
      var container = document.createElement('div');
      container.contentEditable = 'true';
      container.style.position = 'fixed';
      container.style.left = '-9999px';
      container.innerHTML = tableHtml;
      document.body.appendChild(container);

      var range = document.createRange();
      range.selectNodeContents(container);
      var selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);

      var copied = false;
      try {
        copied = document.execCommand('copy');
      } catch (err) {
        copied = false;
      }

      selection.removeAllRanges();
      document.body.removeChild(container);

      if (copied) {
        resolve();
        return;
      }

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(plainText).then(resolve).catch(reject);
        return;
      }

      reject(new Error('Copy not supported'));
    });
  }

  function copyGridToClipboard() {
    var selected = getSelectedExportColumns();
    var statusEl = document.getElementById('pwa-copy-status');

    function setStatus(message, kind) {
      if (!statusEl) return;
      statusEl.textContent = message;
      statusEl.className = 'pwa-export__status' + (kind ? ' pwa-export__status--' + kind : '');
    }

    if (!selected.length) {
      setStatus('Select at least one column to copy.', 'error');
      return;
    }
    if (!lastGridColumns.length) {
      setStatus('Grid is not ready yet. Try again in a moment.', 'error');
      return;
    }

    var rows = buildExportRows(selected, lastGridColumns);
    rows.forEach(function (row) {
      if (row.divider) {
        row.colspan = rows[0] && rows[0].cells ? rows[0].cells.length : 1;
      }
    });

    var tableHtml = buildExportHtml(rows);
    var plainText = buildExportPlainText(rows);
    var wordHtml = buildWordClipboardHtml(tableHtml);

    function onSuccess() {
      setStatus('Copied — paste into Word with Ctrl+V.', 'ok');
    }

    function onFailure() {
      setStatus('Copy failed. Select the grid manually or try another browser.', 'error');
    }

    if (navigator.clipboard && window.ClipboardItem) {
      navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([wordHtml], { type: 'text/html' }),
          'text/plain': new Blob([plainText], { type: 'text/plain' })
        })
      ]).then(onSuccess).catch(function () {
        copyHtmlFallback(tableHtml, plainText).then(onSuccess).catch(onFailure);
      });
      return;
    }

    copyHtmlFallback(tableHtml, plainText).then(onSuccess).catch(onFailure);
  }

  function syncExportAllCheckbox() {
    var allEl = document.getElementById('pwa-export-all');
    if (!allEl) return;
    var boxes = document.querySelectorAll('input[name="exportCol"]');
    var checkedCount = 0;
    boxes.forEach(function (box) {
      if (box.checked) checkedCount += 1;
    });
    allEl.checked = checkedCount === boxes.length;
  }

  function setAllExportColumns(checked) {
    document.querySelectorAll('input[name="exportCol"]').forEach(function (box) {
      box.checked = checked;
    });
  }

  function initExportControls() {
    var copyBtn = document.getElementById('pwa-copy-grid');
    var allEl = document.getElementById('pwa-export-all');
    var columnBoxes = document.querySelectorAll('input[name="exportCol"]');

    if (copyBtn) {
      copyBtn.addEventListener('click', copyGridToClipboard);
    }

    if (allEl) {
      allEl.addEventListener('change', function () {
        setAllExportColumns(allEl.checked);
      });
    }

    columnBoxes.forEach(function (box) {
      box.addEventListener('change', syncExportAllCheckbox);
    });
  }

  function renderGrid(params) {
    var columns = WIRES.map(function (wire) {
      return computeColumn(params, wire);
    });
    lastGridColumns = columns;

    var frozenHead = document.querySelector('#pwa-grid-frozen thead');
    var frozenBody = document.querySelector('#pwa-grid-frozen tbody');
    var dataHead = document.querySelector('#pwa-grid-data thead');
    var dataBody = document.querySelector('#pwa-grid-data tbody');
    var unitsHead = document.querySelector('#pwa-grid-units thead');
    var unitsBody = document.querySelector('#pwa-grid-units tbody');
    if (!frozenHead || !frozenBody || !dataHead || !dataBody || !unitsHead || !unitsBody) return;

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
    dataHeadHtml += '</tr>';
    dataHead.innerHTML = dataHeadHtml;

    unitsHead.innerHTML =
      '<tr class="pwa-grid__head">' +
        '<th class="pwa-grid__unit"></th>' +
      '</tr>';

    var frozenHtml = '';
    var dataHtml = '';
    var unitsHtml = '';
    var vdropDividerShown = false;
    GRID_ROWS.forEach(function (row, idx) {
      if (row.key === 'awg') return;

      if (row.section === 'vdrop' && !vdropDividerShown) {
        vdropDividerShown = true;
        frozenHtml +=
          '<tr class="pwa-grid__row pwa-grid__row--divider" aria-hidden="true">' +
            '<th colspan="3"></th>' +
          '</tr>';
        dataHtml +=
          '<tr class="pwa-grid__row pwa-grid__row--divider" aria-hidden="true">' +
            '<td colspan="' + columns.length + '"></td>' +
          '</tr>';
        unitsHtml +=
          '<tr class="pwa-grid__row pwa-grid__row--divider" aria-hidden="true">' +
            '<td></td>' +
          '</tr>';
      }

      var excelRow = idx + 7;
      var rowClass = 'pwa-grid__row';
      if (row.fmt === 'blank') rowClass += ' pwa-grid__row--blank';
      if (row.section === 'vdrop') rowClass += ' pwa-grid__row--vdrop';

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
      dataHtml += '</tr>';

      unitsHtml +=
        '<tr class="' + rowClass + '" data-row="' + excelRow + '">' +
          '<td class="pwa-grid__unit">' + row.unit + '</td>' +
        '</tr>';
    });

    frozenBody.innerHTML = frozenHtml;
    dataBody.innerHTML = dataHtml;
    unitsBody.innerHTML = unitsHtml;
    syncGridRowHeights();
  }

  function syncGridRowHeights() {
    var frozenHeadRow = document.querySelector('#pwa-grid-frozen thead tr');
    var dataHeadRow = document.querySelector('#pwa-grid-data thead tr');
    var unitsHeadRow = document.querySelector('#pwa-grid-units thead tr');
    var frozenRows = document.querySelectorAll('#pwa-grid-frozen tbody tr');
    var dataRows = document.querySelectorAll('#pwa-grid-data tbody tr');
    var unitsRows = document.querySelectorAll('#pwa-grid-units tbody tr');

    function matchRows(rows) {
      var present = rows.filter(function (row) { return row; });
      if (!present.length) return;
      present.forEach(function (row) {
        row.style.height = '';
      });
      var height = Math.max.apply(
        null,
        present.map(function (row) { return row.offsetHeight; })
      );
      present.forEach(function (row) {
        row.style.height = height + 'px';
      });
    }

    matchRows([frozenHeadRow, dataHeadRow, unitsHeadRow]);
    for (var i = 0; i < frozenRows.length; i += 1) {
      matchRows([frozenRows[i], dataRows[i], unitsRows[i]]);
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
    initExportControls();

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
