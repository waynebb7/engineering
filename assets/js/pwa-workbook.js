(function (global) {
  'use strict';

  var WORKBOOK_VERSION = '1.3.1';
  var REPORT_TITLE = 'Power Wire Analysis Report';
  var REPORT_STANDARDS =
    'Reference standards: SAE ARP4404C §9.3.4.2 (T₂, allowable voltage drop U) · ' +
    'AS50881 / manufacturer wire catalog · FAA AC 43.13-1B Ch.11 (Figs 11-4–11-6 de-rating x, y, z)';

  var STYLE = {
    default: 0,
    reportTitle: 1,
    reportSubtitle: 2,
    reportMeta: 3,
    sectionHeader: 4,
    tableHeader: 5,
    tableLabel: 6,
    tableSymbol: 7,
    tableData: 8,
    tableNum6: 9,
    tableNum3: 10,
    tableNum2: 11,
    tableUnit: 12,
    pass: 13,
    fail: 14,
    paramHeader: 15,
    paramKey: 16,
    paramValue: 17,
    paramDesc: 18,
    paramNotes: 19,
    sectionDivider: 20,
    footerNote: 21
  };
  var PARAMETERS_SHEET = 'Parameters';
  var OPTIONS_SHEET = 'Parameter options';
  var ANALYSIS_SHEET = 'Analysis';
  var META_KEYS = ['pwa_workbook_version', 'pwa_exported_at', 'pwa_grid_title'];

  var PARAM_DEFINITIONS = [
    { key: 'projectName', label: 'Project / circuit name' },
    { key: 'wireType', label: 'Wire type' },
    { key: 'generatorLineVoltagePreset', label: 'Voltage preset' },
    { key: 'generatorLineVoltageCustom', label: 'Custom voltage (V)' },
    { key: 'circuitCurrent', label: 'Circuit current (A)' },
    { key: 'operationType', label: 'Operation basis' },
    { key: 'allowableDrop', label: 'Allowable drop U (V)' },
    { key: 'ambientTemp', label: 'Ambient temperature T1 (°C)' },
    { key: 'conductorTempRatingPreset', label: 'Conductor rating TR preset' },
    { key: 'conductorTempRatingCustom', label: 'Custom TR (°C)' },
    { key: 't2Standard', label: 'T2 calculation standard' },
    { key: 'altitudeFt', label: 'Altitude (ft)' },
    { key: 'bundleWireCount', label: 'Wires in bundle' },
    { key: 'bundleLoadingPct', label: 'Bundle loading (%)' },
    { key: 'wireLength', label: 'Voltage drop — run length (one-way)' },
    { key: 'wireLengthUnit', label: 'Voltage drop — run length unit' },
    { key: 'routingPct', label: 'Routing allowance (%)' }
  ];

  function escapeXml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function escapeFormula(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function colName(index) {
    var n = index + 1;
    var letters = '';
    while (n > 0) {
      var rem = (n - 1) % 26;
      letters = String.fromCharCode(65 + rem) + letters;
      n = Math.floor((n - 1) / 26);
    }
    return letters;
  }

  function cellRef(col, row) {
    return colName(col) + String(row);
  }

  function crc32(buf) {
    var table = crc32.table || (function () {
      var c;
      var tbl = new Uint32Array(256);
      for (var n = 0; n < 256; n += 1) {
        c = n;
        for (var k = 0; k < 8; k += 1) {
          c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        }
        tbl[n] = c >>> 0;
      }
      crc32.table = tbl;
      return tbl;
    })();
    var crc = 0 ^ (-1);
    for (var i = 0; i < buf.length; i += 1) {
      crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xFF];
    }
    return (crc ^ (-1)) >>> 0;
  }

  function u16(n) {
    return [n & 0xFF, (n >>> 8) & 0xFF];
  }

  function u32(n) {
    return [n & 0xFF, (n >>> 8) & 0xFF, (n >>> 16) & 0xFF, (n >>> 24) & 0xFF];
  }

  function concatBytes(chunks) {
    var total = 0;
    chunks.forEach(function (chunk) { total += chunk.length; });
    var out = new Uint8Array(total);
    var offset = 0;
    chunks.forEach(function (chunk) {
      out.set(chunk, offset);
      offset += chunk.length;
    });
    return out;
  }

  function textEncoder(str) {
    return new TextEncoder().encode(str);
  }

  function buildZip(files) {
    var parts = [];
    var central = [];
    var offset = 0;

    files.forEach(function (file) {
      var nameBytes = textEncoder(file.name);
      var data = file.data instanceof Uint8Array ? file.data : textEncoder(file.data);
      var crc = crc32(data);
      var localHeader = concatBytes([
        new Uint8Array(u32(0x04034b50)),
        new Uint8Array(u16(20)),
        new Uint8Array(u16(0)),
        new Uint8Array(u16(0)),
        new Uint8Array(u16(0)),
        new Uint8Array(u16(0)),
        new Uint8Array(u32(crc)),
        new Uint8Array(u32(data.length)),
        new Uint8Array(u32(data.length)),
        new Uint8Array(u16(nameBytes.length)),
        new Uint8Array(u16(0)),
        nameBytes,
        data
      ]);

      parts.push(localHeader);
      central.push({
        nameBytes: nameBytes,
        crc: crc,
        size: data.length,
        offset: offset
      });
      offset += localHeader.length;
    });

    var centralStart = offset;
    central.forEach(function (entry) {
      var chunk = concatBytes([
        new Uint8Array(u32(0x02014b50)),
        new Uint8Array(u16(20)),
        new Uint8Array(u16(20)),
        new Uint8Array(u16(0)),
        new Uint8Array(u16(0)),
        new Uint8Array(u16(0)),
        new Uint8Array(u16(0)),
        new Uint8Array(u32(entry.crc)),
        new Uint8Array(u32(entry.size)),
        new Uint8Array(u32(entry.size)),
        new Uint8Array(u16(entry.nameBytes.length)),
        new Uint8Array(u16(0)),
        new Uint8Array(u16(0)),
        new Uint8Array(u16(0)),
        new Uint8Array(u16(0)),
        new Uint8Array(u32(0)),
        new Uint8Array(u32(entry.offset)),
        entry.nameBytes
      ]);
      parts.push(chunk);
      offset += chunk.length;
    });

    parts.push(new Uint8Array(concatBytes([
      u32(0x06054b50),
      u16(0),
      u16(0),
      u16(central.length),
      u16(central.length),
      u32(offset - centralStart),
      u32(centralStart),
      u16(0)
    ])));

    return concatBytes(parts);
  }

  function readUint32(view, offset) {
    return view.getUint32(offset, true);
  }

  function readUint16(view, offset) {
    return view.getUint16(offset, true);
  }

  async function readFileArrayBuffer(file) {
    function viaFileReader() {
      return new Promise(function (resolve, reject) {
        var reader = new FileReader();
        reader.onload = function () {
          resolve(reader.result);
        };
        reader.onerror = function () {
          reject(new Error('Could not read the selected file.'));
        };
        reader.readAsArrayBuffer(file);
      });
    }

    if (!file || typeof file.arrayBuffer !== 'function') {
      return viaFileReader();
    }

    try {
      return await file.arrayBuffer();
    } catch (err) {
      return viaFileReader();
    }
  }

  async function inflateZipEntry(data) {
    if (typeof DecompressionStream === 'undefined') {
      throw new Error('This browser cannot decompress Excel files. Try Chrome or Edge.');
    }

    var formats = ['deflate-raw', 'deflate'];
    var lastError = null;

    for (var i = 0; i < formats.length; i += 1) {
      try {
        var stream = new Blob([data]).stream().pipeThrough(new DecompressionStream(formats[i]));
        var buffer = await new Response(stream).arrayBuffer();
        return new Uint8Array(buffer);
      } catch (err) {
        lastError = err;
      }
    }

    throw new Error(
      lastError && lastError.message && lastError.message.indexOf('fetch') === -1
        ? lastError.message
        : 'Could not decompress the Excel file. Re-export from this calculator and try again.'
    );
  }

  async function extractZipEntries(buffer) {
    var view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    var eocd = -1;
    for (var i = buffer.length - 22; i >= 0; i -= 1) {
      if (readUint32(view, i) === 0x06054b50) {
        eocd = i;
        break;
      }
    }
    if (eocd < 0) throw new Error('Invalid Excel file (zip archive missing).');

    var centralOffset = readUint32(view, eocd + 16);
    var totalEntries = readUint16(view, eocd + 10);
    var files = {};
    var ptr = centralOffset;

    for (var n = 0; n < totalEntries; n += 1) {
      if (readUint32(view, ptr) !== 0x02014b50) break;
      var compression = readUint16(view, ptr + 10);
      var compSize = readUint32(view, ptr + 20);
      var nameLen = readUint16(view, ptr + 28);
      var extraLen = readUint16(view, ptr + 30);
      var commentLen = readUint16(view, ptr + 32);
      var localOffset = readUint32(view, ptr + 42);
      var name = new TextDecoder().decode(buffer.subarray(ptr + 46, ptr + 46 + nameLen));
      ptr += 46 + nameLen + extraLen + commentLen;

      var localNameLen = readUint16(view, localOffset + 26);
      var localExtraLen = readUint16(view, localOffset + 28);
      var localCompression = readUint16(view, localOffset + 8);
      var localCompSize = readUint32(view, localOffset + 18);
      var dataStart = localOffset + 30 + localNameLen + localExtraLen;
      var size = localCompSize || compSize;
      var raw = buffer.subarray(dataStart, dataStart + size);
      var method = localCompression || compression;
      if (method === 0) {
        files[name] = raw;
      } else if (method === 8) {
        files[name] = await inflateZipEntry(raw);
      } else {
        throw new Error('Unsupported Excel compression in file.');
      }
    }

    return files;
  }

  function resolveStyle(styleKey, fallback) {
    if (styleKey && STYLE[styleKey] != null) {
      return STYLE[styleKey];
    }
    if (fallback && STYLE[fallback] != null) {
      return STYLE[fallback];
    }
    return STYLE.default;
  }

  function normalizeCell(cell, fallbackStyleKey) {
    if (cell != null && typeof cell === 'object' &&
        ('text' in cell || 'value' in cell || 'formula' in cell || 'span' in cell)) {
      return {
        text: cell.text,
        value: cell.value,
        formula: cell.formula,
        span: cell.span,
        styleKey: cell.styleKey,
        style: cell.style != null
          ? cell.style
          : resolveStyle(cell.styleKey, fallbackStyleKey)
      };
    }
    return {
      text: cell,
      style: resolveStyle(fallbackStyleKey, STYLE.default)
    };
  }

  function sheetCellXml(col, row, cell, fallbackStyleKey) {
    var ref = cellRef(col, row);
    var data = normalizeCell(cell, fallbackStyleKey);
    var styleAttr = data.style != null ? ' s="' + Number(data.style) + '"' : '';

    if (data.formula) {
      return '<c r="' + ref + '"' + styleAttr + '><f>' + escapeXml(data.formula) + '</f></c>';
    }
    if (typeof data.value === 'number' && isFinite(data.value)) {
      return '<c r="' + ref + '"' + styleAttr + '><v>' + data.value + '</v></c>';
    }
    return '<c r="' + ref + '" t="inlineStr"' + styleAttr + '><is><t>' +
      escapeXml(data.text == null ? '' : data.text) + '</t></is></c>';
  }

  function buildMergeCellsXml(rows) {
    var merges = [];
    rows.forEach(function (row, rowIdx) {
      var rowNumber = rowIdx + 1;
      (row.cells || []).forEach(function (cell, colIdx) {
        var span = cell && cell.span;
        if (span && span > 1) {
          merges.push(cellRef(colIdx, rowNumber) + ':' + cellRef(colIdx + span - 1, rowNumber));
        }
      });
    });
    if (!merges.length) {
      return '';
    }
    return '<mergeCells count="' + merges.length + '">' +
      merges.map(function (ref) { return '<mergeCell ref="' + ref + '"/>'; }).join('') +
      '</mergeCells>';
  }

  function buildSheetDimension(rows) {
    var maxRow = rows.length;
    var maxCol = 1;
    rows.forEach(function (row) {
      if (row.divider) {
        maxCol = Math.max(maxCol, row.colspan || 1);
        return;
      }
      (row.cells || []).forEach(function (cell, colIdx) {
        var span = cell && cell.span ? cell.span : 1;
        maxCol = Math.max(maxCol, colIdx + span);
      });
    });
    return 'A1:' + cellRef(maxCol - 1, maxRow);
  }

  function buildWorksheetXml(rows, options) {
    options = options || {};
    var xmlRows = [];
    var maxCol = 0;

    rows.forEach(function (row, rowIdx) {
      var rowNumber = rowIdx + 1;
      var rowAttrs = ' r="' + rowNumber + '"';
      if (row.height) {
        rowAttrs += ' ht="' + row.height + '" customHeight="1"';
      }

      if (row.spacer) {
        xmlRows.push('<row' + rowAttrs + '><c r="A' + rowNumber + '"/></row>');
        return;
      }

      if (row.divider) {
        var span = row.colspan || maxCol || 4;
        maxCol = Math.max(maxCol, span);
        xmlRows.push('<row' + rowAttrs + '>' +
          sheetCellXml(0, rowNumber, {
            text: row.label || '',
            span: span,
            styleKey: 'sectionDivider'
          }, 'sectionDivider') + '</row>');
        return;
      }

      var cells = row.cells || [];
      cells.forEach(function (cell, colIdx) {
        var span = cell && cell.span ? cell.span : 1;
        maxCol = Math.max(maxCol, colIdx + span);
      });
      if (!cells.length) {
        maxCol = Math.max(maxCol, 1);
      }
      var rowStyleKey = row.styleKey || (row.isHeader ? 'tableHeader' : 'default');
      var cellXml = '';

      cells.forEach(function (cell, colIdx) {
        if (cell && cell.span && cell.span > 1) {
          cellXml += sheetCellXml(colIdx, rowNumber, cell, rowStyleKey);
          return;
        }
        var fallback = rowStyleKey;
        if (!row.isHeader && colIdx === 0) {
          fallback = 'tableLabel';
        } else if (!row.isHeader && colIdx === 1) {
          fallback = 'tableSymbol';
        } else if (!row.isHeader && colIdx === cells.length - 1 && cells.length > 2) {
          fallback = 'tableUnit';
        } else if (!row.isHeader && colIdx >= 2) {
          fallback = 'tableData';
        }
        cellXml += sheetCellXml(colIdx, rowNumber, cell, fallback);
      });

      xmlRows.push('<row' + rowAttrs + '>' + cellXml + '</row>');
    });

    var colsXml = '';
    if (options.colWidths && options.colWidths.length) {
      colsXml = '<cols>';
      options.colWidths.forEach(function (width, idx) {
        colsXml += '<col min="' + (idx + 1) + '" max="' + (idx + 1) +
          '" width="' + width + '" customWidth="1"/>';
      });
      colsXml += '</cols>';
    }

    var sheetViewsXml = '';
    if (options.sheetView) {
      var sv = options.sheetView;
      sheetViewsXml =
        '<sheetViews><sheetView workbookViewId="0"' +
        (sv.showGridLines === false ? ' showGridLines="0"' : '') + '>' +
        '<pane xSplit="' + (sv.xSplit || 0) + '" ySplit="' + sv.ySplit +
        '" topLeftCell="' + sv.topLeftCell + '" activePane="' + sv.activePane +
        '" state="frozen"/></sheetView></sheetViews>';
    }

    var dataValidationsXml = '';
    if (options.dataValidations && options.dataValidations.length) {
      dataValidationsXml = '<dataValidations count="' + options.dataValidations.length + '">';
      options.dataValidations.forEach(function (dv) {
        dataValidationsXml +=
          '<dataValidation type="list" allowBlank="1" showInputMessage="1" showErrorMessage="1" ' +
          'showDropDown="0" errorStyle="stop" sqref="' + escapeXml(dv.sqref) + '">';
        if (dv.promptTitle) {
          dataValidationsXml += '<promptTitle>' + escapeXml(dv.promptTitle) + '</promptTitle>';
        }
        if (dv.prompt) {
          dataValidationsXml += '<prompt>' + escapeXml(dv.prompt) + '</prompt>';
        }
        dataValidationsXml +=
          '<formula1>' + escapeFormula(dv.formula1) + '</formula1></dataValidation>';
      });
      dataValidationsXml += '</dataValidations>';
    }

    var pageSectionXml = '';
    if (options.landscape) {
      pageSectionXml =
        '<printOptions horizontalCentered="1"/>' +
        '<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>' +
        '<pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0" paperSize="9"/>';
    }

    var sheetPrXml = options.landscape
      ? '<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>'
      : '';

    var dimensionXml = '<dimension ref="' + buildSheetDimension(rows) + '"/>';

    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      sheetPrXml + dimensionXml +
      sheetViewsXml + colsXml +
      '<sheetData>' + xmlRows.join('') + '</sheetData>' +
      buildMergeCellsXml(rows) +
      dataValidationsXml +
      pageSectionXml +
      '</worksheet>';
  }

  function buildStylesXml() {
    function xf(numFmtId, fontId, fillId, borderId, opts) {
      opts = opts || {};
      var align = opts.align ? '<alignment horizontal="' + opts.align.h + '" vertical="' +
        (opts.align.v || 'center') + '"' +
        (opts.align.wrap ? ' wrapText="1"' : '') + '/>' : '';
      return '<xf numFmtId="' + numFmtId + '" fontId="' + fontId + '" fillId="' + fillId +
        '" borderId="' + borderId + '" xfId="0"' +
        (opts.applyNumber ? ' applyNumberFormat="1"' : '') +
        (opts.applyFont ? ' applyFont="1"' : '') +
        (opts.applyFill ? ' applyFill="1"' : '') +
        (opts.applyBorder ? ' applyBorder="1"' : '') +
        (align ? ' applyAlignment="1"' : '') + '>' + align + '</xf>';
    }

    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<numFmts count="4">' +
      '<numFmt numFmtId="164" formatCode="0.000000"/>' +
      '<numFmt numFmtId="165" formatCode="0.000"/>' +
      '<numFmt numFmtId="166" formatCode="0.00"/>' +
      '<numFmt numFmtId="167" formatCode="0.0"/>' +
      '</numFmts>' +
      '<fonts count="6">' +
      '<font><sz val="11"/><color rgb="FF000000"/><name val="Calibri"/><family val="2"/></font>' +
      '<font><b/><sz val="18"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/></font>' +
      '<font><b/><sz val="12"/><color rgb="FF0F2942"/><name val="Calibri"/><family val="2"/></font>' +
      '<font><sz val="10"/><color rgb="FF475569"/><name val="Calibri"/><family val="2"/></font>' +
      '<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/></font>' +
      '<font><i/><sz val="9"/><color rgb="FF64748B"/><name val="Calibri"/><family val="2"/></font>' +
      '</fonts>' +
      '<fills count="9">' +
      '<fill><patternFill patternType="none"/></fill>' +
      '<fill><patternFill patternType="gray125"/></fill>' +
      '<fill><patternFill patternType="solid"><fgColor rgb="FF0F2942"/><bgColor indexed="64"/></patternFill></fill>' +
      '<fill><patternFill patternType="solid"><fgColor rgb="FFE8F1F8"/><bgColor indexed="64"/></patternFill></fill>' +
      '<fill><patternFill patternType="solid"><fgColor rgb="FFF8FAFC"/><bgColor indexed="64"/></patternFill></fill>' +
      '<fill><patternFill patternType="solid"><fgColor rgb="FFBBF7D0"/><bgColor indexed="64"/></patternFill></fill>' +
      '<fill><patternFill patternType="solid"><fgColor rgb="FFFECACA"/><bgColor indexed="64"/></patternFill></fill>' +
      '<fill><patternFill patternType="solid"><fgColor rgb="FFFFFBEB"/><bgColor indexed="64"/></patternFill></fill>' +
      '<fill><patternFill patternType="solid"><fgColor rgb="FFE2E8F0"/><bgColor indexed="64"/></patternFill></fill>' +
      '</fills>' +
      '<borders count="4">' +
      '<border/>' +
      '<border><left style="thin"><color rgb="FFCBD5E1"/></left><right style="thin"><color rgb="FFCBD5E1"/></right>' +
      '<top style="thin"><color rgb="FFCBD5E1"/></top><bottom style="thin"><color rgb="FFCBD5E1"/></bottom></border>' +
      '<border><bottom style="medium"><color rgb="FF1E5A8A"/></bottom></border>' +
      '<border><left style="thin"><color rgb="FFCBD5E1"/></left><right style="thin"><color rgb="FFCBD5E1"/></right>' +
      '<top style="thin"><color rgb="FFCBD5E1"/></top><bottom style="medium"><color rgb="FF0F2942"/></bottom></border>' +
      '</borders>' +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      '<cellXfs count="22">' +
      xf(0, 0, 0, 1, { applyBorder: true, align: { h: 'left', v: 'center' } }) +
      xf(0, 1, 2, 0, { applyFont: true, applyFill: true, align: { h: 'center', v: 'center' } }) +
      xf(0, 2, 3, 2, { applyFont: true, applyFill: true, applyBorder: true, align: { h: 'left', v: 'center' } }) +
      xf(0, 3, 0, 0, { applyFont: true, align: { h: 'left', v: 'top', wrap: true } }) +
      xf(0, 2, 0, 2, { applyFont: true, applyBorder: true, align: { h: 'left', v: 'center' } }) +
      xf(0, 4, 2, 3, { applyFont: true, applyFill: true, applyBorder: true, align: { h: 'center', v: 'center', wrap: true } }) +
      xf(0, 0, 3, 1, { applyFill: true, applyBorder: true, align: { h: 'left', v: 'center', wrap: true } }) +
      xf(0, 0, 4, 1, { applyFill: true, applyBorder: true, align: { h: 'center', v: 'center' } }) +
      xf(0, 0, 0, 1, { applyBorder: true, align: { h: 'center', v: 'center' } }) +
      xf(164, 0, 0, 1, { applyNumber: true, applyBorder: true, align: { h: 'center', v: 'center' } }) +
      xf(165, 0, 0, 1, { applyNumber: true, applyBorder: true, align: { h: 'center', v: 'center' } }) +
      xf(166, 0, 0, 1, { applyNumber: true, applyBorder: true, align: { h: 'center', v: 'center' } }) +
      xf(0, 5, 0, 1, { applyFont: true, applyBorder: true, align: { h: 'center', v: 'center' } }) +
      xf(166, 0, 5, 1, { applyNumber: true, applyFill: true, applyBorder: true, align: { h: 'center', v: 'center' } }) +
      xf(166, 0, 6, 1, { applyNumber: true, applyFill: true, applyBorder: true, align: { h: 'center', v: 'center' } }) +
      xf(0, 4, 2, 3, { applyFont: true, applyFill: true, applyBorder: true, align: { h: 'center', v: 'center' } }) +
      xf(0, 0, 4, 1, { applyFill: true, applyBorder: true, align: { h: 'left', v: 'center' } }) +
      xf(0, 0, 0, 1, { applyBorder: true, align: { h: 'left', v: 'center' } }) +
      xf(0, 0, 0, 1, { applyBorder: true, align: { h: 'left', v: 'center' } }) +
      xf(0, 5, 0, 1, { applyFont: true, applyBorder: true, align: { h: 'left', v: 'center', wrap: true } }) +
      xf(0, 4, 8, 1, { applyFont: true, applyFill: true, applyBorder: true, align: { h: 'center', v: 'center' } }) +
      xf(0, 5, 7, 1, { applyFont: true, applyFill: true, align: { h: 'left', v: 'center', wrap: true } }) +
      '</cellXfs>' +
      '<cellStyles count="1">' +
      '<cellStyle name="Normal" xfId="0" builtinId="0"/>' +
      '</cellStyles>' +
      '</styleSheet>';
  }

  function formatReportDate(iso) {
    if (!iso) {
      return new Date().toLocaleString(undefined, { dateStyle: 'long', timeStyle: 'short' });
    }
    try {
      return new Date(iso).toLocaleString(undefined, { dateStyle: 'long', timeStyle: 'short' });
    } catch (err) {
      return String(iso);
    }
  }

  function buildDocProps(snapshot) {
    var project = snapshot && snapshot.projectName ? snapshot.projectName : 'Power Wire Analysis';
    var created = snapshot && snapshot.exportedAt ? snapshot.exportedAt : new Date().toISOString();
    return {
      core:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<cp:coreProperties ' +
        'xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" ' +
        'xmlns:dc="http://purl.org/dc/elements/1.1/" ' +
        'xmlns:dcterms="http://purl.org/dc/terms/" ' +
        'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
        '<dc:title>' + escapeXml(REPORT_TITLE + ' — ' + project) + '</dc:title>' +
        '<dc:subject>' + escapeXml(REPORT_STANDARDS) + '</dc:subject>' +
        '<dc:creator>Power Wire Analysis Calculator</dc:creator>' +
        '<cp:lastModifiedBy>Power Wire Analysis Calculator</cp:lastModifiedBy>' +
        '<dcterms:created xsi:type="dcterms:W3CDTF">' + escapeXml(created) + '</dcterms:created>' +
        '</cp:coreProperties>',
      app:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" ' +
        'xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">' +
        '<Application>Power Wire Analysis Calculator</Application>' +
        '<Company>Engineering</Company>' +
        '</Properties>'
    };
  }

  function decorateAnalysisSheet(tableRows, meta) {
    meta = meta || {};
    var colCount = (tableRows[0] && tableRows[0].cells) ? tableRows[0].cells.length : 3;
    var project = meta.projectName ||
      (meta.snapshot && meta.snapshot.projectName) || '';
    var dateStr = formatReportDate(meta.snapshot && meta.snapshot.exportedAt);
    var prefix = [
      {
        cells: [{ text: REPORT_TITLE.toUpperCase(), span: colCount }],
        styleKey: 'reportTitle',
        height: 34
      },
      {
        cells: [{
          text: project
            ? 'Project / circuit: ' + project
            : 'Wire sizing and verification worksheet',
          span: colCount
        }],
        styleKey: 'reportSubtitle',
        height: 22
      },
      {
        cells: [{
          text: (meta.gridTitle || 'AWG comparison grid') + '  |  Generated ' + dateStr +
            '  |  Workbook v' + WORKBOOK_VERSION,
          span: colCount
        }],
        styleKey: 'reportMeta',
        height: 22
      },
      {
        cells: [{ text: REPORT_STANDARDS, span: colCount }],
        styleKey: 'reportMeta',
        height: 22
      },
      {
        cells: [{
          text: 'Pass/fail: green = T₂ ≤ T_R or V_drop ≤ U; red = exceeds limit. Inputs on Parameters sheet (re-import supported).',
          span: colCount
        }],
        styleKey: 'reportMeta',
        height: 22
      },
      { spacer: true, height: 6 },
      {
        cells: [{ text: 'AWG ANALYSIS GRID', span: colCount }],
        styleKey: 'sectionHeader',
        height: 20
      }
    ];

    var body = tableRows.map(function (row) {
      if (row.divider) {
        return {
          divider: true,
          label: row.label || 'Voltage drop at entered run length',
          colspan: colCount
        };
      }

      var styledCells = (row.cells || []).map(function (cell, colIdx) {
        var out = {
          text: cell.text,
          value: cell.value,
          styleKey: cell.styleKey,
          numStyle: cell.numStyle
        };
        if (row.isHeader) {
          out.styleKey = 'tableHeader';
        } else if (colIdx === 0) {
          out.styleKey = out.styleKey || 'tableLabel';
        } else if (colIdx === 1) {
          out.styleKey = out.styleKey || 'tableSymbol';
        } else if (colIdx === row.cells.length - 1) {
          out.styleKey = out.styleKey || 'tableUnit';
        } else if (out.styleKey !== 'pass' && out.styleKey !== 'fail') {
          out.styleKey = out.styleKey || (out.value != null ? (cell.numStyle || 'tableNum3') : 'tableData');
        }
        return out;
      });

      return {
        cells: styledCells,
        isHeader: row.isHeader,
        section: row.section
      };
    });

    return prefix.concat(body);
  }

  function optionsSheetRange(col, startRow, endRow) {
    var sheetRef = OPTIONS_SHEET.replace(/'/g, "''");
    return "'" + sheetRef + "'!$" + col + '$' + startRow + ':$' + col + '$' + endRow;
  }

  function buildDropdownFormula1(options, rangeRef) {
    if (!options || !options.length) {
      return rangeRef;
    }
    var parts = options.map(function (opt) {
      return String(opt.value).replace(/"/g, '""');
    });
    var inline = '"' + parts.join(',') + '"';
    if (inline.length <= 255) {
      return inline;
    }
    return rangeRef;
  }

  function buildOptionsSheetData(parameterOptions) {
    if (!parameterOptions) {
      return null;
    }

    var columns = [];
    PARAM_DEFINITIONS.forEach(function (def) {
      var opts = parameterOptions[def.key];
      if (opts && opts.length) {
        columns.push({ key: def.key, label: def.label, options: opts });
      }
    });
    if (!columns.length) {
      return null;
    }

    var rows = [
      { cells: [{ text: 'Parameter option lists — values for Parameters sheet column B' }] },
      {
        cells: [{
          text: 'Each column lists allowed values for one parameter key. Use the Value rows when editing Parameters; labels below are for reference only.'
        }]
      },
      { divider: true },
      {
        cells: columns.map(function (col) {
          return { text: col.key };
        }),
        isHeader: true
      },
      {
        cells: columns.map(function (col) {
          return { text: col.label };
        })
      }
    ];

    var maxLen = 0;
    columns.forEach(function (col) {
      maxLen = Math.max(maxLen, col.options.length);
    });

    var valueStartRow = rows.length + 1;
    var ranges = {};

    for (var r = 0; r < maxLen; r += 1) {
      rows.push({
        cells: columns.map(function (col) {
          var opt = col.options[r];
          if (!opt) {
            return { text: '' };
          }
          return { text: String(opt.value) };
        })
      });
    }

    columns.forEach(function (col, colIdx) {
      if (!col.options.length) {
        return;
      }
      var startRow = valueStartRow;
      var endRow = valueStartRow + col.options.length - 1;
      ranges[col.key] = optionsSheetRange(colName(colIdx), startRow, endRow);
    });

    rows.push({ divider: true });
    rows.push({
      cells: [{ text: 'Option labels (reference only — import reads Value rows above)' }]
    });
    rows.push({
      cells: columns.map(function () {
        return { text: 'Label' };
      }),
      isHeader: true
    });

    for (var labelRow = 0; labelRow < maxLen; labelRow += 1) {
      rows.push({
        cells: columns.map(function (col) {
          var opt = col.options[labelRow];
          if (!opt) {
            return { text: '' };
          }
          return { text: opt.label || String(opt.value) };
        })
      });
    }

    var colWidths = columns.map(function (col) {
      return Math.min(32, Math.max(12, col.key.length + 6));
    });

    return { rows: rows, ranges: ranges, colWidths: colWidths };
  }

  function buildParametersRows(snapshot, meta) {
    meta = meta || {};
    var optionRanges = meta.optionRanges || {};
    var parameterOptions = meta.parameterOptions || {};
    var colCount = 4;
    var project = snapshot.projectName || 'Unnamed project / circuit';
    var dateStr = formatReportDate(snapshot.exportedAt);
    var rows = [
      {
        cells: [{ text: REPORT_TITLE.toUpperCase(), span: colCount }],
        styleKey: 'reportTitle',
        height: 34
      },
      {
        cells: [{ text: 'Project / circuit: ' + project, span: colCount }],
        styleKey: 'reportSubtitle',
        height: 22
      },
      {
        cells: [{
          text: 'Generated ' + dateStr + '  |  Workbook v' + WORKBOOK_VERSION +
            '  |  ' + (meta.gridTitle || 'Wire analysis grid'),
          span: colCount
        }],
        styleKey: 'reportMeta',
        height: 22
      },
      {
        cells: [{ text: REPORT_STANDARDS, span: colCount }],
        styleKey: 'reportMeta',
        height: 22
      },
      {
        cells: [{
          text: 'Section 1 — Input parameters. Edit column B (dropdown where provided) and re-import to restore settings in the calculator.',
          span: colCount
        }],
        styleKey: 'reportMeta',
        height: 22
      },
      { spacer: true, height: 6 },
      {
        cells: [{ text: '1. INPUT PARAMETERS', span: colCount }],
        styleKey: 'sectionHeader',
        height: 20
      },
      {
        cells: [
          { text: 'Key', styleKey: 'paramHeader' },
          { text: 'Value', styleKey: 'paramHeader' },
          { text: 'Description', styleKey: 'paramHeader' },
          { text: 'Notes', styleKey: 'paramHeader' }
        ],
        isHeader: true
      }
    ];
    var rowByKey = {};
    var dataValidations = [];

    PARAM_DEFINITIONS.forEach(function (def) {
      var excelRow = rows.length + 1;
      rowByKey[def.key] = excelRow;
      var notes = '';
      if (optionRanges[def.key]) {
        notes = 'Dropdown in column B';
      } else if (def.key === 'generatorLineVoltageCustom' || def.key === 'conductorTempRatingCustom') {
        notes = 'Numeric — only when preset is custom';
      } else {
        notes = 'Free entry (number or text)';
      }
      var rawVal = snapshot[def.key];
      var valueCell = {
        text: rawVal == null ? '' : String(rawVal),
        styleKey: 'paramValue'
      };
      if (rawVal != null && rawVal !== '' && !isNaN(parseFloat(rawVal)) &&
          def.key !== 'projectName' && def.key !== 'wireType' &&
          def.key !== 'operationType' && def.key !== 't2Standard' &&
          def.key !== 'wireLengthUnit' && def.key !== 'generatorLineVoltagePreset' &&
          def.key !== 'conductorTempRatingPreset') {
        valueCell.value = parseFloat(rawVal);
      }
      rows.push({
        cells: [
          { text: def.key, styleKey: 'paramKey' },
          valueCell,
          { text: def.label, styleKey: 'paramDesc' },
          { text: notes, styleKey: 'paramNotes' }
        ]
      });
    });

    rows.push({ spacer: true, height: 8 });
    rows.push({
      cells: [{
        text: 'Disclaimer: This report is generated by the Power Wire Analysis calculator for engineering review. ' +
          'Verify results against applicable airworthiness requirements and approved data before certification submission.',
        span: colCount,
        styleKey: 'footerNote'
      }],
      height: 36
    });

    Object.keys(optionRanges).forEach(function (key) {
      if (rowByKey[key] && optionRanges[key]) {
        dataValidations.push({
          sqref: 'B' + rowByKey[key],
          formula1: buildDropdownFormula1(parameterOptions[key], optionRanges[key]),
          promptTitle: 'Select a value',
          prompt: 'Choose from the dropdown list.'
        });
      }
    });

    return { rows: rows, dataValidations: dataValidations };
  }

  function addWorksheetFile(files, contentTypesRef, workbookRelsRef, workbookSheetsRef, ctx, xml, sheetName, hidden) {
    var sheetNum = ctx.sheetId;
    var rel = ctx.relId;
    files.push({ name: 'xl/worksheets/sheet' + sheetNum + '.xml', data: xml });
    contentTypesRef.value +=
      '<Override PartName="/xl/worksheets/sheet' + sheetNum + '.xml" ' +
      'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>';
    workbookRelsRef.value +=
      '<Relationship Id="rId' + rel + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + sheetNum + '.xml"/>';
    workbookSheetsRef.value +=
      '<sheet name="' + escapeXml(sheetName) + '" sheetId="' + sheetNum + '" r:id="rId' + rel + '"' +
      (hidden ? ' state="hidden"' : '') + '/>';
    ctx.sheetId += 1;
    ctx.relId += 1;
  }

  function buildWorkbookFiles(snapshot, tableRows, meta) {
    meta = meta || {};
    var includeParameters = meta.includeParameters !== false;
    var files = [];
    var sheetCtx = { sheetId: 1, relId: 1 };

    var contentTypes =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>';

    var workbookRels =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">';

    var ctRef = { value: contentTypes };
    var relRef = { value: workbookRels };
    var sheetsRef = { value: '' };

    var decoratedAnalysis = decorateAnalysisSheet(tableRows, {
      snapshot: snapshot,
      gridTitle: meta.gridTitle,
      projectName: snapshot.projectName
    });
    var analysisHeaderRow = 8;
    var tableColWidths = [44, 9];
    if (tableRows[0] && tableRows[0].cells) {
      for (var i = 2; i < tableRows[0].cells.length; i += 1) {
        tableColWidths.push(i === tableRows[0].cells.length - 1 ? 11 : 13);
      }
    }
    var analysisXml = buildWorksheetXml(decoratedAnalysis, {
      colWidths: tableColWidths,
      landscape: true,
      sheetView: {
        xSplit: 2,
        ySplit: analysisHeaderRow,
        topLeftCell: 'C' + (analysisHeaderRow + 1),
        activePane: 'bottomRight'
      }
    });
    addWorksheetFile(files, ctRef, relRef, sheetsRef, sheetCtx, analysisXml, ANALYSIS_SHEET, false);

    if (includeParameters) {
      var optionSheetData = meta.parameterOptions
        ? buildOptionsSheetData(meta.parameterOptions)
        : null;
      var parameterBuild = buildParametersRows(snapshot, {
        gridTitle: meta.gridTitle,
        parameterOptions: meta.parameterOptions || {},
        optionRanges: optionSheetData ? optionSheetData.ranges : {}
      });
      var paramHeaderRow = 8;
      var paramXml = buildWorksheetXml(parameterBuild.rows, {
        colWidths: [32, 26, 50, 48],
        sheetView: {
          xSplit: 0,
          ySplit: paramHeaderRow,
          topLeftCell: 'A' + (paramHeaderRow + 1),
          activePane: 'bottomLeft'
        },
        dataValidations: parameterBuild.dataValidations
      });
      addWorksheetFile(files, ctRef, relRef, sheetsRef, sheetCtx, paramXml, PARAMETERS_SHEET, false);

      if (optionSheetData) {
        var optionsXml = buildWorksheetXml(optionSheetData.rows, {
          colWidths: optionSheetData.colWidths
        });
        addWorksheetFile(files, ctRef, relRef, sheetsRef, sheetCtx, optionsXml, OPTIONS_SHEET, true);
      }
    }

    contentTypes = ctRef.value +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
      '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
      '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>' +
      '</Types>';

    workbookRels = relRef.value +
      '<Relationship Id="rId' + sheetCtx.relId + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
      '</Relationships>';

    var rels =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>' +
      '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>' +
      '</Relationships>';

    var workbook =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
      'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      '<sheets>' + sheetsRef.value + '</sheets></workbook>';

    var docProps = buildDocProps(snapshot);

    return [
      { name: '[Content_Types].xml', data: contentTypes },
      { name: '_rels/.rels', data: rels },
      { name: 'docProps/core.xml', data: docProps.core },
      { name: 'docProps/app.xml', data: docProps.app },
      { name: 'xl/workbook.xml', data: workbook },
      { name: 'xl/_rels/workbook.xml.rels', data: workbookRels },
      { name: 'xl/styles.xml', data: buildStylesXml() }
    ].concat(files);
  }

  function sanitizeFilename(name) {
    var base = String(name || 'power-wire-analysis')
      .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    return base || 'power-wire-analysis';
  }

  function defaultFilename(snapshot) {
    var date = new Date().toISOString().slice(0, 10);
    return sanitizeFilename(snapshot.projectName) + '-PWA-' + date + '.xlsx';
  }

  function downloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function exportWorkbook(snapshot, tableRows, meta) {
    meta = meta || {};
    var files = buildWorkbookFiles(snapshot, tableRows, meta);
    var zip = buildZip(files);
    var blob = new Blob([zip], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    downloadBlob(blob, meta.filename || defaultFilename(snapshot));
  }

  function findParametersSheetPath(entries) {
    var workbookXml = entries['xl/workbook.xml'];
    var relsXml = entries['xl/_rels/workbook.xml.rels'];
    if (workbookXml && relsXml) {
      var workbookText = new TextDecoder().decode(workbookXml);
      var relsText = new TextDecoder().decode(relsXml);
      var sheetMatch = workbookText.match(
        new RegExp('<sheet[^>]*name="' + PARAMETERS_SHEET.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
          '"[^>]*r:id="([^"]+)"', 'i')
      );
      if (sheetMatch) {
        var relMatch = relsText.match(
          new RegExp('<Relationship[^>]*Id="' + sheetMatch[1] + '"[^>]*Target="([^"]+)"', 'i')
        );
        if (relMatch) {
          var target = relMatch[1].replace(/^\//, '');
          if (target.indexOf('xl/') !== 0) {
            target = 'xl/' + target;
          }
          if (entries[target]) {
            return target;
          }
        }
      }
    }

    if (entries['xl/worksheets/sheet1.xml']) {
      return 'xl/worksheets/sheet1.xml';
    }

    var names = Object.keys(entries).filter(function (name) {
      return /^xl\/worksheets\/sheet\d+\.xml$/i.test(name);
    }).sort();
    return names[0] || null;
  }

  function parseSharedStrings(entries) {
    var sharedXml = entries['xl/sharedStrings.xml'];
    if (!sharedXml) {
      return null;
    }
    var text = new TextDecoder().decode(sharedXml);
    var strings = [];
    var siRegex = /<si(?:[^>]*)>([\s\S]*?)<\/si>/g;
    var match;

    while ((match = siRegex.exec(text)) !== null) {
      var content = match[1];
      var parts = [];
      var tRegex = /<t(?:[^>]*)?>([\s\S]*?)<\/t>/g;
      var tMatch;
      while ((tMatch = tRegex.exec(content)) !== null) {
        parts.push(decodeXml(tMatch[1]));
      }
      strings.push(parts.join(''));
    }
    return strings;
  }

  function parseCellValue(attrs, inner, sharedStrings) {
    var typeMatch = attrs.match(/\st="([^"]+)"/);
    var cellType = typeMatch ? typeMatch[1] : '';
    var inlineMatch = inner.match(/<is><t(?:[^>]*)?>([\s\S]*?)<\/t><\/is>/);
    if (inlineMatch) {
      return decodeXml(inlineMatch[1]);
    }
    var valueMatch = inner.match(/<v>([\s\S]*?)<\/v>/);
    if (!valueMatch) {
      return '';
    }
    var raw = valueMatch[1];
    if (cellType === 's' && sharedStrings) {
      var idx = parseInt(raw, 10);
      return sharedStrings[idx] != null ? sharedStrings[idx] : '';
    }
    return decodeXml(raw);
  }

  function parseSheetRows(sheetXml, sharedStrings) {
    var rows = [];
    var rowRegex = /<row[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g;
    var cellRegex = /<c([^>]*)>([\s\S]*?)<\/c>/g;
    var match;

    while ((match = rowRegex.exec(sheetXml)) !== null) {
      var rowNum = parseInt(match[1], 10);
      var rowContent = match[2];
      var cells = {};
      var cellMatch;
      while ((cellMatch = cellRegex.exec(rowContent)) !== null) {
        var attrs = cellMatch[1];
        var inner = cellMatch[2];
        var refMatch = attrs.match(/\sr="([A-Z]+)(\d+)"/);
        if (!refMatch) {
          continue;
        }
        cells[refMatch[1]] = parseCellValue(attrs, inner, sharedStrings);
      }
      rows[rowNum] = cells;
    }
    return rows;
  }

  function decodeXml(text) {
    return String(text)
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&');
  }

  async function importWorkbook(file) {
    var arrayBuffer = await readFileArrayBuffer(file);
    var buffer = new Uint8Array(arrayBuffer);
    var entries = await extractZipEntries(buffer);
    var sheetPath = findParametersSheetPath(entries);
    if (!sheetPath) {
      throw new Error('Parameters sheet not found. Use Export all to create an importable workbook.');
    }
    var sheetXml = new TextDecoder().decode(entries[sheetPath]);
    var sharedStrings = parseSharedStrings(entries);
    var rows = parseSheetRows(sheetXml, sharedStrings);
    var parameters = {};
    var knownKeys = {};
    var hasKeyHeader = false;

    PARAM_DEFINITIONS.forEach(function (def) {
      knownKeys[def.key] = true;
    });

    for (var r = 0; r < rows.length; r += 1) {
      var cells = rows[r];
      if (!cells) continue;
      if (cells.A === 'Key' && cells.B === 'Value') {
        hasKeyHeader = true;
      }
      if (cells.A && knownKeys[cells.A]) {
        parameters[cells.A] = cells.B == null ? '' : String(cells.B);
      }
    }

    if (!parameters.wireType) {
      if (!hasKeyHeader) {
        throw new Error(
          'This workbook does not have a Parameters sheet from the web calculator. Use Export all on the Power Wire Analysis page.'
        );
      }
      throw new Error(
        'Could not read parameter values from the Parameters sheet. Re-export from the calculator without changing the Key/Value rows.'
      );
    }
    if (global.PwaWireCatalog && !PwaWireCatalog.getWireType(parameters.wireType)) {
      throw new Error('Unknown wire type in workbook: ' + parameters.wireType);
    }

    return { parameters: parameters, version: WORKBOOK_VERSION };
  }

  global.PwaWorkbook = {
    WORKBOOK_VERSION: WORKBOOK_VERSION,
    PARAM_DEFINITIONS: PARAM_DEFINITIONS,
    exportWorkbook: exportWorkbook,
    importWorkbook: importWorkbook,
    sanitizeFilename: sanitizeFilename,
    defaultFilename: defaultFilename
  };
})(typeof window !== 'undefined' ? window : this);
