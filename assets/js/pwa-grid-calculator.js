(function () {
  'use strict';

  var COPPER_REF = 254.5;
  var COPPER_COEF = 234.5;
  var FT_TO_M = 0.3048;
  var IN_TO_M = 0.0254;

  var WIRE_TYPE_LABEL = '';
  var lastGridColumns = [];

  // AC 43.13-1B Fig 11-5 — see pwa-bundle-derating.js
  function bundleDeratingFactor(wireCount, loadingPct) {
    if (window.PwaBundleDerating) {
      return PwaBundleDerating.bundleDeratingFactor(wireCount, loadingPct);
    }
    return 1;
  }

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

  // AC 43.13-1B Fig 11-6 — see pwa-altitude-derating.js

  var WIRES = [
    { label: '22', ohm1000ft: 17.92223997275819 },
    { label: '20', ohm1000ft: 9.99743998480389 },
    { label: '18', ohm1000ft: 6.339839990363444 },
    { label: '16', ohm1000ft: 4.389119993328538 },
    { label: '14', ohm1000ft: 3.230879995089062 },
    { label: '12', ohm1000ft: 2.0116799969422465 },
    { label: '10', ohm1000ft: 1.2588239980865876 },
    { label: '8', ohm1000ft: 0.7315199988880896 },
    { label: '6', ohm1000ft: 0.4785359992726253 },
    { label: '4', ohm1000ft: 0.2959607995501396 },
    { label: '2', ohm1000ft: 0.18470879971924264 },
    { label: '1', ohm1000ft: 0.152399999768352 },
    { label: '0', ohm1000ft: 0.11612879982348423 },
    { label: '00', ohm1000ft: 0.08839199986564415 },
    { label: '000', ohm1000ft: 0.07223759989019884 },
    { label: '0000', ohm1000ft: 0.057911999911973766 }
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
    { key: 't2Factor', labelB: 'I/IMAX squared', labelC: '', unit: '', fmt: 'num', digits: 3 },
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

  // AC 43.13-1B Fig 11-4a / 11-4b — see pwa-free-air.js
  function freeAirCurrent(wire, ambientTemp, conductorRating) {
    if (window.PwaFreeAir) {
      var current = PwaFreeAir.freeAirCurrent(wire.label, ambientTemp, conductorRating);
      if (current !== null) return current;
    }
    return 0;
  }

  function altitudeDeratingFactor(altitudeFt) {
    if (window.PwaAltitudeDerating) {
      return PwaAltitudeDerating.altitudeDeratingFactor(altitudeFt);
    }
    return 1;
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

  function t2FactorRowLabel(standard) {
    return standard === 'ac43' ? 'SQRT I/IMAX' : 'I/IMAX squared';
  }

  function t2FactorValue(IImax, standard) {
    return standard === 'ac43' ? Math.sqrt(IImax) : IImax * IImax;
  }

  function t2StandardNote(standard) {
    if (standard === 'ac43') {
      return 'T<sub>1</sub> + (T<sub>R</sub> &minus; T<sub>1</sub>) &times; &radic;(I/I<sub>max</sub>)';
    }
    return 'T<sub>1</sub> + (T<sub>R</sub> &minus; T<sub>1</sub>) &times; (I/I<sub>max</sub>)&sup2;';
  }

  function readConductorTempRating(form) {
    var presetEl = form.elements.conductorTempRatingPreset;
    if (presetEl && presetEl.value !== 'custom') {
      return parseFloat(presetEl.value, 10);
    }
    var customEl = form.elements.conductorTempRatingCustom;
    return customEl ? parseFloat(customEl.value, 10) : 260;
  }

  function updateConductorTempRatingCustomVisibility(form) {
    var presetEl = form.elements.conductorTempRatingPreset;
    var wrap = document.getElementById('pwa-conductor-tr-custom-wrap');
    var customEl = form.elements.conductorTempRatingCustom;
    if (!presetEl || !wrap) return;

    var isCustom = presetEl.value === 'custom';
    wrap.hidden = !isCustom;
    if (customEl) {
      customEl.required = isCustom;
    }
  }

  function initConductorTempRatingControls(form) {
    var presetEl = form.elements.conductorTempRatingPreset;
    if (!presetEl) return;

    updateConductorTempRatingCustomVisibility(form);
    presetEl.addEventListener('change', function () {
      updateConductorTempRatingCustomVisibility(form);
      recalc();
    });
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
    var bundleWireCount = parseInt(form.elements.bundleWireCount.value, 10);
    var bundleLoadingPct = parseInt(form.elements.bundleLoadingPct.value, 10);
    var bundleDerating = bundleDeratingFactor(bundleWireCount, bundleLoadingPct);
    var t2Standard = form.elements.t2Standard
      ? form.elements.t2Standard.value
      : 'arp4404';

    return {
      generatorLineVoltage: generatorLineVoltage,
      circuitCurrent: circuitCurrent,
      allowableDrop: f('allowableDrop'),
      ambientTemp: f('ambientTemp'),
      conductorTempRating: readConductorTempRating(form),
      altitudeFt: altitudeFt,
      altitudeDerating: altitudeDerating,
      bundleWireCount: bundleWireCount,
      bundleLoadingPct: bundleLoadingPct,
      bundleDerating: bundleDerating,
      t2Standard: t2Standard,
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
    var freeAir = freeAirCurrent(wire, T1, TR);
    var bundle = params.bundleDerating;
    var altitude = params.altitudeDerating;
    var Imax = freeAir * bundle * altitude;
    var IImax = I / Imax;
    var t2Factor = t2FactorValue(IImax, params.t2Standard);
    var T2 = T1 + (TR - T1) * t2Factor;
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
      t2Factor: t2Factor,
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
        return '=' + ref('T1') + '+(' + ref('TR') + '-' + ref('T1') + ')*' + ref('t2Factor');
      case 'Imax':
        return '=' + ref('freeAir') + '*' + ref('bundle') + '*' + ref('altitude');
      case 'IfreePct':
        return '=' + ref('I') + '/' + ref('freeAir') + '*100';
      case 'freeAir':
        return excelRawValue(col.freeAir);
      case 'bundle':
        return excelRawValue(params.bundleDerating);
      case 'altitude':
        return excelRawValue(params.altitudeDerating);
      case 'IImax':
        return '=' + ref('I') + '/' + ref('Imax');
      case 't2Factor':
        if (params.t2Standard === 'ac43') {
          return '=SQRT(' + ref('IImax') + ')';
        }
        return '=' + ref('IImax') + '*' + ref('IImax');
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
      text: row.key === 't2Factor' && params
        ? t2FactorRowLabel(params.t2Standard)
        : row.labelB,
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

      var rowLabelB = row.key === 't2Factor'
        ? t2FactorRowLabel(params.t2Standard)
        : row.labelB;

      frozenHtml +=
        '<tr class="' + rowClass + '" data-row="' + excelRow + '">' +
          '<th class="pwa-grid__label-b" scope="row">' + rowLabelB + '</th>' +
          '<td class="pwa-grid__label-c">' + row.labelC + '</td>' +
        '</tr>';

      dataHtml += '<tr class="' + rowClass + '" data-row="' + excelRow + '">';
      columns.forEach(function (col) {
        var val = col[row.key];
        var cellClass = 'pwa-grid__val';
        if (typeof val === 'number' && isFinite(val)) {
          if (row.key === 'Vdrop') {
            cellClass += val <= params.allowableDrop
              ? ' pwa-grid__val--pass'
              : ' pwa-grid__val--fail';
          } else if (row.key === 'T2') {
            cellClass += val <= params.conductorTempRating
              ? ' pwa-grid__val--pass'
              : ' pwa-grid__val--fail';
          }
        }
        dataHtml += '<td class="' + cellClass + '">' + formatCell(row, val) + '</td>';
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
    var bundleEl = document.getElementById('pwa-bundle-factor');
    var t2NoteEl = document.getElementById('pwa-t2-standard-note');
    if (ftEl) ftEl.textContent = num(params.wireLengthFt, 2);
    if (mEl) mEl.textContent = num(params.wireLengthM, 3);
    if (altEl) altEl.textContent = num(params.altitudeDerating, 4);
    if (bundleEl) bundleEl.textContent = num(params.bundleDerating, 4);
    if (t2NoteEl) {
      t2NoteEl.innerHTML = 'T<sub>2</sub> = ' + t2StandardNote(params.t2Standard);
    }
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
    initConductorTempRatingControls(form);
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
