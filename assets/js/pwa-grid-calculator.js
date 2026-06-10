(function () {
  'use strict';

  var COPPER_REF = 254.5;
  var COPPER_COEF = 234.5;
  var FT_TO_M = 0.3048;
  var IN_TO_M = 0.0254;

  var WIRE_TYPE_LABEL = '';
  var lastGridColumns = [];

  var ALLOWABLE_DROPS = {
    continuous: [
      { nominal: 14, drop: 0.5 },
      { nominal: 28, drop: 1 },
      { nominal: 115, drop: 4 },
      { nominal: 200, drop: 7 }
    ],
    intermittent: [
      { nominal: 14, drop: 1 },
      { nominal: 28, drop: 2 },
      { nominal: 115, drop: 8 },
      { nominal: 200, drop: 14 }
    ]
  };

  // AC 43.13-1B Fig 11-6 altitude derating curve (altitude in thousands of feet).
  var ALTITUDE_CURVE = [
    { kft: 0, factor: 1.00 },
    { kft: 5, factor: 0.98 },
    { kft: 10, factor: 0.96 },
    { kft: 15, factor: 0.94 },
    { kft: 20, factor: 0.92 },
    { kft: 25, factor: 0.90 },
    { kft: 30, factor: 0.88 },
    { kft: 35, factor: 0.86 },
    { kft: 40, factor: 0.84 },
    { kft: 45, factor: 0.82 },
    { kft: 50, factor: 0.80 },
    { kft: 55, factor: 0.785 },
    { kft: 60, factor: 0.77 },
    { kft: 65, factor: 0.76 },
    { kft: 70, factor: 0.75 },
    { kft: 75, factor: 0.74 },
    { kft: 80, factor: 0.73 },
    { kft: 85, factor: 0.72 },
    { kft: 90, factor: 0.71 },
    { kft: 95, factor: 0.705 },
    { kft: 100, factor: 0.70 }
  ];

  var WIRES = [
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
    { key: 'awg', labelB: 'Cable size (AWG)', labelC: 'AWG', unit: '', fmt: 'awg' },
    { key: 'L1', labelB: 'Maximum wire length (NOT DE-RATED)', labelC: 'L1', unit: 'ft', fmt: 'num', digits: 3 },
    { key: 'V', labelB: 'System Voltage', labelC: 'V', unit: 'V', fmt: 'num', digits: 2 },
    { key: 'U', labelB: 'Allowable voltage drop', labelC: 'U', unit: 'V', fmt: 'num' },
    { key: 'I', labelB: 'Circuit current', labelC: 'I', unit: 'A', fmt: 'num', digits: 2 },
    { key: 'Rft', labelB: 'Resistance of wire per feet @ 20\u00B0C', labelC: 'R', unit: '\u03A9/ft', fmt: 'sci' },
    { key: 'R1000', labelB: 'Resistance of wire per 1000 feet @ 20\u00B0C', labelC: '', unit: '\u03A9/1000ft', fmt: 'num', digits: 3 },
    { key: 'T1', labelB: 'Ambient temperature', labelC: 'T1', unit: '\u00B0C', fmt: 'num' },
    { key: 'TR', labelB: 'Conductor temperature rating', labelC: 'TR', unit: '\u00B0C', fmt: 'num' },
    { key: 'T2', labelB: 'Estimated conductor temperature', labelC: 'T2', unit: '\u00B0C', fmt: 'num', digits: 3 },
    { key: 'Imax', labelB: 'Maximum allowable current @ TR', labelC: 'IMAX', unit: 'A', fmt: 'num', digits: 3 },
    { key: 'IfreePct', labelB: 'Actual % of current against free air current', labelC: '%', unit: '%', fmt: 'pct' },
    { key: 'freeAir', labelB: 'De-rating (Max conductor current in free air)', labelC: 'x', unit: 'A', fmt: 'num' },
    { key: 'bundle', labelB: 'De-rating (Bundle)', labelC: 'y', unit: '', fmt: 'factor', digits: 2 },
    { key: 'altitude', labelB: 'De-rating (Altitude)', labelC: 'z', unit: '', fmt: 'factor' },
    { key: 'IImax', labelB: 'I/IMAX', labelC: '', unit: '', fmt: 'num', digits: 3 },
    { key: 'sqrtIImax', labelB: 'SQRT I/IMAX', labelC: '', unit: '', fmt: 'num', digits: 3 },
    { key: 'L2in', labelB: 'Maximum wire length (DE-RATED) (MOST SEVERE) (in)', labelC: 'L2', unit: 'in', fmt: 'num', digits: 3 },
    { key: 'L2ft', labelB: 'Maximum wire length (DE-RATED) (MOST SEVERE) (ft)', labelC: 'L2', unit: 'ft', fmt: 'num', digits: 3 },
    { key: 'L2m', labelB: 'Maximum wire length (DE-RATED) (MOST SEVERE) (m)', labelC: 'L2', unit: 'm', fmt: 'num', digits: 3 },
    { key: 'Vdrop', labelB: 'Voltage drop (volts)', labelC: 'U', unit: 'V', fmt: 'num', digits: 3, section: 'vdrop' },
    { key: 'wireLenIn', labelB: 'Wire Length for purposes of Voltage Drop (in)', labelC: 'L', unit: 'in', fmt: 'num', digits: 3, section: 'vdrop' },
    { key: 'wireLenFt', labelB: 'Wire Length for purposes of Voltage Drop (ft)', labelC: 'L', unit: 'ft', fmt: 'num', digits: 3, section: 'vdrop' },
    { key: 'wireLenM', labelB: 'Wire Length for purposes of Voltage Drop (m)', labelC: 'L', unit: 'm', fmt: 'num', digits: 3, section: 'vdrop' }
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

  function altitudeDeratingFactor(altitudeFt) {
    var kft = altitudeFt / 1000;
    if (kft <= ALTITUDE_CURVE[0].kft) return ALTITUDE_CURVE[0].factor;
    if (kft >= ALTITUDE_CURVE[ALTITUDE_CURVE.length - 1].kft) {
      return ALTITUDE_CURVE[ALTITUDE_CURVE.length - 1].factor;
    }
    for (var i = 0; i < ALTITUDE_CURVE.length - 1; i += 1) {
      var start = ALTITUDE_CURVE[i];
      var end = ALTITUDE_CURVE[i + 1];
      if (kft >= start.kft && kft <= end.kft) {
        var t = (kft - start.kft) / (end.kft - start.kft);
        return start.factor + t * (end.factor - start.factor);
      }
    }
    return ALTITUDE_CURVE[ALTITUDE_CURVE.length - 1].factor;
  }

  function formatAltitudeLabel(altitudeFt) {
    return altitudeFt.toLocaleString('en-US') + ' ft';
  }

  function initAltitudeSelect(form) {
    var selectEl = form.elements.altitudeFt;
    if (!selectEl) return;

    var html = '';
    for (var altitudeFt = 0; altitudeFt <= 100000; altitudeFt += 1000) {
      var factor = altitudeDeratingFactor(altitudeFt);
      html +=
        '<option value="' + altitudeFt + '">' +
        formatAltitudeLabel(altitudeFt) + ' — ' + num(factor, 4) +
        '</option>';
    }
    selectEl.innerHTML = html;
    selectEl.value = '35000';
  }

  function getAllowableDropEntries(operationType) {
    return ALLOWABLE_DROPS[operationType] || ALLOWABLE_DROPS.continuous;
  }

  function formatAllowableDropOption(entry) {
    return entry.nominal + ' V nominal — ' + num(entry.drop, entry.drop % 1 ? 1 : 0) + ' V drop';
  }

  function getSelectedAllowableNominal(selectEl) {
    if (!selectEl || !selectEl.selectedOptions.length) return null;
    var nominal = parseInt(selectEl.selectedOptions[0].dataset.nominal, 10);
    return isFinite(nominal) ? nominal : null;
  }

  function updateAllowableDropOptions(form, preferredNominal) {
    var operationEl = form.elements.operationType;
    var selectEl = form.elements.allowableDrop;
    if (!operationEl || !selectEl) return;

    var entries = getAllowableDropEntries(operationEl.value);
    var currentNominal = preferredNominal || getSelectedAllowableNominal(selectEl);
    var html = '';

    entries.forEach(function (entry) {
      html +=
        '<option value="' + entry.drop + '" data-nominal="' + entry.nominal + '">' +
        formatAllowableDropOption(entry) +
        '</option>';
    });
    selectEl.innerHTML = html;

    var match = null;
    entries.forEach(function (entry) {
      if (entry.nominal === currentNominal) match = entry;
    });
    if (!match && currentNominal) {
      entries.forEach(function (entry) {
        if (!match || Math.abs(entry.nominal - currentNominal) < Math.abs(match.nominal - currentNominal)) {
          match = entry;
        }
      });
    }
    if (!match) {
      match = entries[entries.length - 1];
    }
    selectEl.value = String(match.drop);
  }

  function initAllowableDropControls(form) {
    updateAllowableDropOptions(form, 200);

    var operationEl = form.elements.operationType;
    if (operationEl) {
      operationEl.addEventListener('change', function () {
        updateAllowableDropOptions(form);
        recalc();
      });
    }
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
    var circuitCurrent = f('circuitCurrent');
    var altitudeFt = parseInt(form.elements.altitudeFt.value, 10);
    var altitudeDerating = altitudeDeratingFactor(altitudeFt);

    return {
      generatorLineVoltage: generatorLineVoltage,
      circuitCurrent: circuitCurrent,
      allowableDrop: f('allowableDrop'),
      ambientTemp: f('ambientTemp'),
      conductorTempRating: f('conductorTempRating'),
      altitudeFt: altitudeFt,
      altitudeDerating: altitudeDerating,
      bundleDerating: f('bundleDerating'),
      wireLengthFt: wireLengthFt,
      wireLengthIn: totalIn,
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
    var L2in = L2ft * 12;
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
      L2in: L2in,
      L2ft: L2ft,
      L2m: L2m,
      Vdrop: Vdrop,
      wireLenIn: params.wireLengthIn,
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

  function getSelectedExportSettings() {
    var awgAllEl = document.getElementById('pwa-export-awg-all');
    if (awgAllEl && awgAllEl.checked) {
      return {
        awgLabels: WIRES.map(function (wire) { return wire.label; })
      };
    }

    var awgLabels = [];
    document.querySelectorAll('input[name="exportAwg"]:checked').forEach(function (el) {
      awgLabels.push(el.value);
    });

    return { awgLabels: awgLabels };
  }

  function findWire(awgLabel) {
    for (var i = 0; i < WIRES.length; i += 1) {
      if (WIRES[i].label === awgLabel) return WIRES[i];
    }
    return null;
  }

  function excelColumnLetter(colIndex) {
    var n = colIndex + 1;
    var letters = '';
    while (n > 0) {
      var rem = (n - 1) % 26;
      letters = String.fromCharCode(65 + rem) + letters;
      n = Math.floor((n - 1) / 26);
    }
    return letters;
  }

  function excelRawValue(val) {
    if (typeof val !== 'number' || !isFinite(val)) return '';
    return String(val);
  }

  function excelCellRef(rowMap, rowKey, colIndex) {
    return excelColumnLetter(colIndex) + rowMap[rowKey];
  }

  function getExportCellContent(row, col, wire, params, rowMap, colIndex) {
    function ref(key) {
      return excelCellRef(rowMap, key, colIndex);
    }

    switch (row.key) {
      case 'L1':
        return '=' + ref('U') + '/(' + ref('I') + '*' + ref('Rft') + ')';
      case 'V':
        return excelRawValue(params.generatorLineVoltage);
      case 'U':
        return excelRawValue(params.allowableDrop);
      case 'I':
        return excelRawValue(params.circuitCurrent);
      case 'Rft':
        return '=' + ref('R1000') + '/1000';
      case 'R1000':
        return excelRawValue(wire.ohm1000ft);
      case 'T1':
        return excelRawValue(params.ambientTemp);
      case 'TR':
        return excelRawValue(params.conductorTempRating);
      case 'T2':
        return '=' + ref('T1') + '+(' + ref('TR') + '-' + ref('T1') + ')*' + ref('sqrtIImax');
      case 'Imax':
        return '=' + ref('freeAir') + '*' + ref('bundle') + '*' + ref('altitude');
      case 'IfreePct':
        return '=' + ref('I') + '/' + ref('freeAir') + '*100';
      case 'freeAir':
        return excelRawValue(wire.freeAirA);
      case 'bundle':
        return excelRawValue(params.bundleDerating);
      case 'altitude':
        return excelRawValue(params.altitudeDerating);
      case 'IImax':
        return '=' + ref('I') + '/' + ref('Imax');
      case 'sqrtIImax':
        return '=SQRT(' + ref('IImax') + ')';
      case 'L2ft':
        return '=' + COPPER_REF + '*' + ref('L1') + '/(' + COPPER_COEF + '+' + ref('T2') + ')';
      case 'L2in':
        return '=' + ref('L2ft') + '*12';
      case 'L2m':
        return '=' + ref('L2ft') + '*' + FT_TO_M;
      case 'Vdrop':
        return '=' + ref('I') + '*' + ref('Rft') + '*' + ref('wireLenFt') +
          '*(' + COPPER_COEF + '+' + ref('T2') + ')/' + COPPER_REF;
      case 'wireLenIn':
        return excelRawValue(params.wireLengthIn);
      case 'wireLenFt':
        return excelRawValue(params.wireLengthFt);
      case 'wireLenM':
        return excelRawValue(params.wireLengthM);
      default:
        return excelRawValue(col[row.key]);
    }
  }

  function filterExportColumns(gridColumns, awgLabels) {
    if (!awgLabels.length) return [];
    return gridColumns.filter(function (col) {
      return awgLabels.indexOf(col.awg) >= 0;
    });
  }

  function buildExportRowCells(row, gridColumns, settings, isAwgHeaderRow, options) {
    var cells = [];
    var exportColumns = filterExportColumns(gridColumns, settings.awgLabels);
    var useFormulas = options && options.useFormulas;
    var params = options && options.params;
    var rowMap = options && options.rowMap;

    cells.push({
      text: row.labelB,
      align: 'left'
    });
    cells.push({
      text: row.labelC,
      align: 'center'
    });
    exportColumns.forEach(function (col, awgIdx) {
      var text;
      if (isAwgHeaderRow) {
        text = col.awg;
      } else if (useFormulas && rowMap && params) {
        var wire = findWire(col.awg);
        text = wire
          ? getExportCellContent(row, col, wire, params, rowMap, 2 + awgIdx)
          : formatCell(row, col[row.key]);
      } else {
        text = formatCell(row, col[row.key]);
      }
      cells.push({ text: text, align: 'center' });
    });
    cells.push({
      text: isAwgHeaderRow ? '' : row.unit,
      align: 'center'
    });

    return cells;
  }

  function buildExportRows(settings, gridColumns, options) {
    options = options || {};
    var rows = [];
    var rowMap = {};
    var excelRow = 2;
    var dividerShown = false;
    var bodyEntries = [];

    GRID_ROWS.forEach(function (row) {
      if (row.key === 'awg') return;

      if (row.section === 'vdrop' && !dividerShown) {
        dividerShown = true;
        bodyEntries.push({ divider: true });
        excelRow += 1;
      }

      rowMap[row.key] = excelRow;
      bodyEntries.push({ row: row });
      excelRow += 1;
    });

    if (options.useFormulas) {
      options.rowMap = rowMap;
    }

    rows.push({
      cells: buildExportRowCells(GRID_ROWS[0], gridColumns, settings, true, options),
      isHeader: true
    });

    bodyEntries.forEach(function (entry) {
      if (entry.divider) {
        rows.push({ divider: true });
        return;
      }
      rows.push({
        cells: buildExportRowCells(entry.row, gridColumns, settings, false, options),
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

  function copyTableToClipboard(useFormulas) {
    var settings = getSelectedExportSettings();
    var statusEl = document.getElementById('pwa-copy-status');
    var form = document.getElementById('pwa-params-form');

    function setStatus(message, kind) {
      if (!statusEl) return;
      statusEl.textContent = message;
      statusEl.className = 'pwa-export__status' + (kind ? ' pwa-export__status--' + kind : '');
    }

    if (!settings.awgLabels.length) {
      setStatus('Select at least one AWG column to copy.', 'error');
      return;
    }
    if (!lastGridColumns.length) {
      setStatus('Grid is not ready yet. Try again in a moment.', 'error');
      return;
    }

    var exportOptions = {
      useFormulas: useFormulas,
      params: form ? readParams(form) : null
    };
    var rows = buildExportRows(settings, lastGridColumns, exportOptions);
    rows.forEach(function (row) {
      if (row.divider) {
        row.colspan = rows[0] && rows[0].cells ? rows[0].cells.length : 1;
      }
    });

    var plainText = buildExportPlainText(rows);

    function onSuccess(message) {
      setStatus(message, 'ok');
    }

    function onFailure() {
      setStatus('Copy failed. Select the grid manually or try another browser.', 'error');
    }

    if (useFormulas) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(plainText).then(function () {
          onSuccess('Copied with formulas — paste into Excel with Ctrl+V.');
        }).catch(onFailure);
        return;
      }
      onFailure();
      return;
    }

    var tableHtml = buildExportHtml(rows);
    var wordHtml = buildWordClipboardHtml(tableHtml);

    if (navigator.clipboard && window.ClipboardItem) {
      navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([wordHtml], { type: 'text/html' }),
          'text/plain': new Blob([plainText], { type: 'text/plain' })
        })
      ]).then(function () {
        onSuccess('Copied — paste into Word or Excel with Ctrl+V.');
      }).catch(function () {
        copyHtmlFallback(tableHtml, plainText).then(function () {
          onSuccess('Copied — paste into Word or Excel with Ctrl+V.');
        }).catch(onFailure);
      });
      return;
    }

    copyHtmlFallback(tableHtml, plainText).then(function () {
      onSuccess('Copied — paste into Word or Excel with Ctrl+V.');
    }).catch(onFailure);
  }

  function syncExportAwgAllCheckbox() {
    var awgAllEl = document.getElementById('pwa-export-awg-all');
    if (!awgAllEl) return;
    var awgBoxes = document.querySelectorAll('input[name="exportAwg"]');
    var checkedCount = 0;
    awgBoxes.forEach(function (box) {
      if (box.checked) checkedCount += 1;
    });
    awgAllEl.checked = awgBoxes.length > 0 && checkedCount === awgBoxes.length;
  }

  function setAllExportAwgColumns(checked) {
    document.querySelectorAll('input[name="exportAwg"]').forEach(function (box) {
      box.checked = checked;
    });
  }

  function initExportAwgChecks() {
    var container = document.getElementById('pwa-export-awg-checks');
    if (!container) return;

    var html = '';
    WIRES.forEach(function (wire) {
      html +=
        '<label class="pwa-export__check pwa-export__check--awg">' +
          '<input type="checkbox" name="exportAwg" value="' + escapeHtml(wire.label) + '" checked>' +
          'AWG ' + escapeHtml(wire.label) +
        '</label>';
    });
    container.innerHTML = html;
  }

  function initExportControls() {
    var copyTableBtn = document.getElementById('pwa-copy-table');
    var copyFormulasBtn = document.getElementById('pwa-copy-table-formulas');
    var awgAllEl = document.getElementById('pwa-export-awg-all');

    initExportAwgChecks();

    if (copyTableBtn) {
      copyTableBtn.addEventListener('click', function () {
        copyTableToClipboard(false);
      });
    }

    if (copyFormulasBtn) {
      copyFormulasBtn.addEventListener('click', function () {
        copyTableToClipboard(true);
      });
    }

    if (awgAllEl) {
      awgAllEl.addEventListener('change', function () {
        setAllExportAwgColumns(awgAllEl.checked);
      });
    }

    document.querySelectorAll('input[name="exportAwg"]').forEach(function (box) {
      box.addEventListener('change', syncExportAwgAllCheckbox);
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
        '<th class="pwa-grid__label-b">Cable size (AWG)</th>' +
        '<th class="pwa-grid__label-c">AWG</th>' +
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
            '<th colspan="2"></th>' +
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
    var altEl = document.getElementById('pwa-altitude-factor');
    if (ftEl) ftEl.textContent = num(params.wireLengthFt, 2);
    if (mEl) mEl.textContent = num(params.wireLengthM, 3);
    if (altEl) altEl.textContent = num(params.altitudeDerating, 4);
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
    initAllowableDropControls(form);
    initAltitudeSelect(form);

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
