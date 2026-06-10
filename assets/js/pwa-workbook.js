(function (global) {
  'use strict';

  var WORKBOOK_VERSION = '1.0';
  var PARAMETERS_SHEET = 'Parameters';
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
    { key: 'wireLength', label: 'Wire run length' },
    { key: 'wireLengthUnit', label: 'Wire length unit' },
    { key: 'routingPct', label: 'Routing allowance (%)' }
  ];

  function escapeXml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
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

  function sheetCellXml(col, row, value, styleId) {
    var ref = cellRef(col, row);
    var styleAttr = styleId ? ' s="' + styleId + '"' : '';
    if (typeof value === 'number' && isFinite(value)) {
      return '<c r="' + ref + '"' + styleAttr + '><v>' + value + '</v></c>';
    }
    return '<c r="' + ref + '" t="inlineStr"' + styleAttr + '><is><t>' +
      escapeXml(value == null ? '' : value) + '</t></is></c>';
  }

  function buildWorksheetXml(rows, options) {
    options = options || {};
    var xmlRows = [];
    var maxCol = 0;

    rows.forEach(function (row, rowIdx) {
      var rowNumber = rowIdx + 1;
      if (row.divider) {
        xmlRows.push('<row r="' + rowNumber + '">' +
          sheetCellXml(0, rowNumber, '') + '</row>');
        return;
      }
      var cells = row.cells || [];
      maxCol = Math.max(maxCol, cells.length);
      var cellXml = cells.map(function (cell, colIdx) {
        return sheetCellXml(colIdx, rowNumber, cell.text, row.isHeader ? 1 : 0);
      }).join('');
      xmlRows.push('<row r="' + rowNumber + '">' + cellXml + '</row>');
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

    var freezeXml = options.freezeHeader
      ? '<sheetViews><sheetView workbookViewId="0">' +
        '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>' +
        '</sheetView></sheetViews>'
      : '';

    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      freezeXml + colsXml +
      '<sheetData>' + xmlRows.join('') + '</sheetData>' +
      '</worksheet>';
  }

  function buildParametersRows(snapshot, meta) {
    var rows = [
      { cells: [{ text: 'Power Wire Analysis — Project settings' }] },
      { cells: [{ text: 'Workbook version' }, { text: WORKBOOK_VERSION }] },
      { cells: [{ text: 'Exported at' }, { text: snapshot.exportedAt || '' }] },
      { cells: [{ text: 'Grid title' }, { text: meta.gridTitle || '' }] },
      { divider: true },
      { cells: [{ text: 'Key' }, { text: 'Value' }, { text: 'Description' }], isHeader: true }
    ];

    PARAM_DEFINITIONS.forEach(function (def) {
      rows.push({
        cells: [
          { text: def.key },
          { text: snapshot[def.key] == null ? '' : String(snapshot[def.key]) },
          { text: def.label }
        ]
      });
    });

    return rows;
  }

  function buildWorkbookFiles(snapshot, tableRows, meta) {
    meta = meta || {};
    var includeParameters = meta.includeParameters !== false;
    var files = [];

    var contentTypes =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>';

    var workbookRels =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">';

    var workbookSheets = '';
    var sheetId = 1;
    var relId = 1;

    if (includeParameters) {
      var parameterRows = buildParametersRows(snapshot, meta);
      var paramXml = buildWorksheetXml(parameterRows, {
        colWidths: [28, 24, 36],
        freezeHeader: true
      });
      files.push({ name: 'xl/worksheets/sheet' + sheetId + '.xml', data: paramXml });
      contentTypes +=
        '<Override PartName="/xl/worksheets/sheet' + sheetId + '.xml" ' +
        'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>';
      workbookRels +=
        '<Relationship Id="rId' + relId + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + sheetId + '.xml"/>';
      workbookSheets +=
        '<sheet name="' + escapeXml(PARAMETERS_SHEET) + '" sheetId="' + sheetId + '" r:id="rId' + relId + '"/>';
      sheetId += 1;
      relId += 1;
    }

    var tableColWidths = [42, 8];
    if (tableRows[0] && tableRows[0].cells) {
      for (var i = 2; i < tableRows[0].cells.length; i += 1) {
        tableColWidths.push(i === tableRows[0].cells.length - 1 ? 12 : 14);
      }
    }
    var analysisXml = buildWorksheetXml(tableRows, {
      colWidths: tableColWidths,
      freezeHeader: true
    });
    files.push({ name: 'xl/worksheets/sheet' + sheetId + '.xml', data: analysisXml });
    contentTypes +=
      '<Override PartName="/xl/worksheets/sheet' + sheetId + '.xml" ' +
      'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>';
    workbookRels +=
      '<Relationship Id="rId' + relId + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + sheetId + '.xml"/>';
    workbookSheets +=
      '<sheet name="' + escapeXml(ANALYSIS_SHEET) + '" sheetId="' + sheetId + '" r:id="rId' + relId + '"/>';
    relId += 1;

    contentTypes +=
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
      '</Types>';

    workbookRels +=
      '<Relationship Id="rId' + relId + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
      '</Relationships>';

    var rels =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
      '</Relationships>';

    var workbook =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
      'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      '<sheets>' + workbookSheets + '</sheets></workbook>';

    var styles =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<fonts count="2">' +
      '<font><sz val="11"/><name val="Calibri"/></font>' +
      '<font><b/><sz val="11"/><name val="Calibri"/></font>' +
      '</fonts>' +
      '<fills count="1"><fill><patternFill patternType="none"/></fill></fills>' +
      '<borders count="1"><border/></borders>' +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      '<cellXfs count="2">' +
      '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
      '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
      '</cellXfs>' +
      '</styleSheet>';

    return [
      { name: '[Content_Types].xml', data: contentTypes },
      { name: '_rels/.rels', data: rels },
      { name: 'xl/workbook.xml', data: workbook },
      { name: 'xl/_rels/workbook.xml.rels', data: workbookRels },
      { name: 'xl/styles.xml', data: styles }
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
