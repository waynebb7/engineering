(function (global) {
  'use strict';

  var REPORT_TITLE = 'Power Wire Analysis Report';
  var REPORT_STANDARDS =
    'Reference standards: SAE ARP4404C §9.3.4.2 (T₂, allowable voltage drop U); ' +
    'AS50881 / manufacturer wire catalog; FAA AC 43.13-1B Ch.11 (Figs 11-4–11-6 de-rating x, y, z).';

  function escapeXml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function textEncoder(str) {
    return new TextEncoder().encode(str);
  }

  function crc32(buf) {
    var table = crc32.table || (function () {
      var c;
      var tbl = new Uint32Array(256);
      var n;
      var k;
      for (n = 0; n < 256; n += 1) {
        c = n;
        for (k = 0; k < 8; k += 1) {
          c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        }
        tbl[n] = c >>> 0;
      }
      crc32.table = tbl;
      return tbl;
    })();
    var crc = 0 ^ (-1);
    var i;
    for (i = 0; i < buf.length; i += 1) {
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
      central.push({ nameBytes: nameBytes, crc: crc, size: data.length, offset: offset });
      offset += localHeader.length;
    });

    var centralStart = offset;
    central.forEach(function (entry) {
      parts.push(new Uint8Array(concatBytes([
        u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0),
        u32(entry.crc), u32(entry.size), u32(entry.size),
        u16(entry.nameBytes.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(entry.offset),
        entry.nameBytes
      ])));
    });

    parts.push(new Uint8Array(concatBytes([
      u32(0x06054b50), u16(0), u16(0), u16(central.length), u16(central.length),
      u32(offset - centralStart), u32(centralStart), u16(0)
    ])));
    return concatBytes(parts);
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

  function paragraph(text, style, opts) {
    opts = opts || {};
    var pPr = style ? '<w:pPr><w:pStyle w:val="' + style + '"/>' +
      (opts.spacing ? '<w:spacing w:after="' + opts.spacing + '"/>' : '') + '</w:pPr>' : '';
    return '<w:p>' + pPr + '<w:r><w:t xml:space="preserve">' + escapeXml(text) + '</w:t></w:r></w:p>';
  }

  function tableCell(text, opts) {
    opts = opts || {};
    var tcPr = '<w:tcPr>';
    if (opts.width) {
      tcPr += '<w:tcW w:w="' + opts.width + '" w:type="dxa"/>';
    }
    if (opts.shade) {
      tcPr += '<w:shd w:val="clear" w:color="auto" w:fill="' + opts.shade + '"/>';
    }
    if (opts.header) {
      tcPr += '<w:shd w:val="clear" w:color="auto" w:fill="0F2942"/>';
    }
    tcPr += '</w:tcPr>';
    var runProps = opts.header
      ? '<w:rPr><w:b/><w:color w:val="FFFFFF"/></w:rPr>'
      : (opts.bold ? '<w:rPr><w:b/></w:rPr>' : '');
    return '<w:tc>' + tcPr + '<w:p><w:r>' + runProps +
      '<w:t xml:space="preserve">' + escapeXml(text == null ? '' : text) + '</w:t></w:r></w:p></w:tc>';
  }

  function tableRow(cells, isHeader) {
    return '<w:tr>' + cells.map(function (text) {
      return tableCell(text, { header: isHeader, bold: isHeader });
    }).join('') + '</w:tr>';
  }

  function buildTable(rows, colWidths) {
    var grid = colWidths.map(function (w) {
      return '<w:gridCol w:w="' + w + '"/>';
    }).join('');
    var body = rows.map(function (row, idx) {
      return tableRow(row, idx === 0);
    }).join('');
    return '<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:tblBorders>' +
      '<w:top w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>' +
      '<w:left w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>' +
      '<w:bottom w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>' +
      '<w:right w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>' +
      '<w:insideH w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>' +
      '<w:insideV w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>' +
      '</w:tblBorders></w:tblPr><w:tblGrid>' + grid + '</w:tblGrid>' + body + '</w:tbl>';
  }

  function buildAnalysisTable(tableRows) {
    if (!tableRows || !tableRows.length) {
      return '';
    }
    var header = tableRows[0];
    if (!header || !header.cells) {
      return '';
    }
    var colCount = header.cells.length;
    var dataCols = Math.max(colCount - 3, 1);
    var dataWidth = Math.max(500, Math.floor(7800 / dataCols));
    var widths = [3400, 900];
    var i;
    for (i = 0; i < dataCols; i += 1) {
      widths.push(dataWidth);
    }
    widths.push(900);

    var rows = [header.cells.map(function (cell) { return cell.text; })];
    tableRows.slice(1).forEach(function (row) {
      if (row.divider) {
        return;
      }
      rows.push(row.cells.map(function (cell, colIdx) {
        if (colIdx >= 2 && colIdx < row.cells.length - 1 && cell.styleKey === 'pass') {
          return cell.text + ' (PASS)';
        }
        if (colIdx >= 2 && colIdx < row.cells.length - 1 && cell.styleKey === 'fail') {
          return cell.text + ' (FAIL)';
        }
        return cell.text;
      }));
    });
    return buildTable(rows, widths);
  }

  function buildParameterTable(snapshot) {
    var defs = global.PwaWorkbook && PwaWorkbook.PARAM_DEFINITIONS
      ? PwaWorkbook.PARAM_DEFINITIONS
      : [];
    var rows = [['Parameter', 'Value']];
    defs.forEach(function (def) {
      var val = snapshot[def.key];
      rows.push([def.label, val == null ? '' : String(val)]);
    });
    return buildTable(rows, [4200, 4800]);
  }

  function buildSectionBody(section, meta) {
    var snapshot = section.snapshot || {};
    var projectNumber = snapshot.projectNumber || meta.projectNumber || '';
    var project = snapshot.projectName || meta.projectName || 'Unnamed project / system';
    var wireId = section.wireId || meta.wireId || snapshot.wireNumber || '';
    var dateStr = formatReportDate(snapshot.exportedAt || meta.exportedAt);
    var parts = [];

    if (section.sectionTitle) {
      parts.push(paragraph(section.sectionTitle, 'Heading1'));
    }
    if (projectNumber) {
      parts.push(paragraph('Project number: ' + projectNumber, 'BodyText'));
    }
    parts.push(paragraph('Project / system: ' + project, 'BodyText'));
    if (wireId) {
      parts.push(paragraph('Wire identifier: ' + wireId, 'BodyText'));
    }
    if (section.filename) {
      parts.push(paragraph('Source file: ' + section.filename, 'BodyText'));
    }
    parts.push(paragraph('Generated: ' + dateStr, 'BodyText'));
    parts.push(paragraph(REPORT_STANDARDS, 'BodyText', { spacing: '120' }));
    parts.push(paragraph('1. Input parameters', 'Heading2'));
    parts.push(buildParameterTable(snapshot));
    parts.push(paragraph('2. AWG analysis grid', 'Heading2', { spacing: '120' }));
    parts.push(buildAnalysisTable(section.tableRows));
    parts.push(paragraph(
      'Pass/fail: values marked (PASS) meet T₂ ≤ T_R or V_drop ≤ U; (FAIL) exceeds the limit.',
      'BodyText',
      { spacing: '120' }
    ));
    return parts.join('');
  }

  function buildDocumentXml(sections, meta) {
    meta = meta || {};
    var body = [];
    body.push(paragraph(REPORT_TITLE, 'Title'));
    body.push(paragraph(
      meta.projectTitle || buildDocumentSubtitle(meta, sections),
      'Subtitle'
    ));
    body.push(paragraph('Document generated: ' + formatReportDate(meta.exportedAt), 'BodyText'));
    body.push(paragraph(REPORT_STANDARDS, 'BodyText', { spacing: '160' }));

    sections.forEach(function (section, idx) {
      if (sections.length > 1) {
        section.sectionTitle = section.sectionTitle ||
          ('Wire ' + (section.wireId || String(idx + 1)));
      }
      body.push(buildSectionBody(section, meta));
      if (idx < sections.length - 1) {
        body.push('<w:p><w:r><w:br w:type="page"/></w:r></w:p>');
      }
    });

    body.push(paragraph(
      'Disclaimer: This report was generated by the Power Wire Analysis calculator for engineering review. ' +
      'Verify results against applicable airworthiness requirements and approved data before certification submission.',
      'Disclaimer'
    ));
    body.push('<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>' +
      '<w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr>');

    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
      '<w:body>' + body.join('') + '</w:body></w:document>';
  }

  function buildDocumentSubtitle(meta, sections) {
    var snapshot = sections && sections[0] ? sections[0].snapshot : {};
    var parts = [];
    var projectNumber = meta.projectNumber || (snapshot && snapshot.projectNumber);
    var projectName = meta.projectName || (snapshot && snapshot.projectName);
    if (projectNumber) {
      parts.push('Project ' + projectNumber);
    }
    if (projectName) {
      parts.push(projectName);
    }
    return parts.length ? parts.join(' — ') : 'Power wire analysis';
  }

  function buildStylesXml() {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
      '<w:style w:type="paragraph" w:styleId="Title" w:default="0">' +
      '<w:name w:val="Title"/><w:basedOn w:val="Normal"/>' +
      '<w:rPr><w:b/><w:sz w:val="48"/><w:color w:val="0F2942"/></w:rPr>' +
      '<w:pPr><w:spacing w:after="200"/></w:pPr></w:style>' +
      '<w:style w:type="paragraph" w:styleId="Subtitle" w:default="0">' +
      '<w:name w:val="Subtitle"/>' +
      '<w:rPr><w:b/><w:sz w:val="28"/><w:color w:val="1E5A8A"/></w:rPr>' +
      '<w:pPr><w:spacing w:after="160"/></w:pPr></w:style>' +
      '<w:style w:type="paragraph" w:styleId="Heading1" w:default="0">' +
      '<w:name w:val="heading 1"/>' +
      '<w:rPr><w:b/><w:sz w:val="32"/><w:color w:val="0F2942"/></w:rPr>' +
      '<w:pPr><w:spacing w:before="240" w:after="120"/></w:pPr></w:style>' +
      '<w:style w:type="paragraph" w:styleId="Heading2" w:default="0">' +
      '<w:name w:val="heading 2"/>' +
      '<w:rPr><w:b/><w:sz w:val="26"/><w:color w:val="0F2942"/></w:rPr>' +
      '<w:pPr><w:spacing w:before="240" w:after="120"/></w:pPr></w:style>' +
      '<w:style w:type="paragraph" w:styleId="BodyText" w:default="0">' +
      '<w:name w:val="Body Text"/>' +
      '<w:rPr><w:sz w:val="22"/><w:color w:val="334155"/></w:rPr>' +
      '<w:pPr><w:spacing w:after="80"/></w:pPr></w:style>' +
      '<w:style w:type="paragraph" w:styleId="Disclaimer" w:default="0">' +
      '<w:name w:val="Disclaimer"/>' +
      '<w:rPr><w:i/><w:sz w:val="20"/><w:color w:val="64748B"/></w:rPr>' +
      '<w:pPr><w:spacing w:before="240"/></w:pPr></w:style>' +
      '<w:style w:type="paragraph" w:styleId="Normal" w:default="1">' +
      '<w:name w:val="Normal"/>' +
      '<w:rPr><w:sz w:val="22"/></w:rPr></w:style>' +
      '</w:styles>';
  }

  function buildDocxFiles(sections, meta) {
    var documentXml = buildDocumentXml(sections, meta);
    var created = meta.exportedAt || new Date().toISOString();
    var title = REPORT_TITLE + ' — ' + (meta.projectName || 'Power Wire Analysis');
    return [
      { name: '[Content_Types].xml', data:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
        '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
        '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
        '</Types>' },
      { name: '_rels/.rels', data:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>' +
        '</Relationships>' },
      { name: 'docProps/core.xml', data:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" ' +
        'xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" ' +
        'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
        '<dc:title>' + escapeXml(title) + '</dc:title>' +
        '<dc:subject>' + escapeXml(REPORT_STANDARDS) + '</dc:subject>' +
        '<dc:creator>Power Wire Analysis Calculator</dc:creator>' +
        '<dcterms:created xsi:type="dcterms:W3CDTF">' + escapeXml(created) + '</dcterms:created>' +
        '</cp:coreProperties>' },
      { name: 'word/_rels/document.xml.rels', data:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
        '</Relationships>' },
      { name: 'word/document.xml', data: documentXml },
      { name: 'word/styles.xml', data: buildStylesXml() }
    ];
  }

  function sanitizeFilename(name) {
    var base = String(name || 'power-wire-analysis')
      .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    return base || 'power-wire-analysis';
  }

  function defaultFilename(snapshot, meta) {
    meta = meta || {};
    if (typeof meta === 'string') {
      meta = { extension: meta.replace(/^[-.]/, '').replace(/^report\.docx$/, 'docx') };
    }
    if (global.PwaWorkbook && PwaWorkbook.buildExportFilename) {
      return PwaWorkbook.buildExportFilename(snapshot, Object.assign({ extension: 'docx' }, meta));
    }
    var date = new Date().toISOString().slice(0, 10);
    return sanitizeFilename(snapshot.projectName) + '-PWA-' + date + '.docx';
  }

  function resolveReportFilename(sections, meta) {
    meta = meta || {};
    if (meta.filename) {
      return meta.filename;
    }
    if (global.PwaWorkbook) {
      if (sections.length > 1 && PwaWorkbook.buildProjectReportFilename) {
        return PwaWorkbook.buildProjectReportFilename(sections[0] && sections[0].snapshot, meta);
      }
      if (PwaWorkbook.buildExportFilename) {
        return PwaWorkbook.buildExportFilename(sections[0] && sections[0].snapshot, {
          wireNumber: meta.wireNumber,
          projectNumber: meta.projectNumber,
          projectName: meta.projectName,
          awgLabels: meta.awgLabels,
          exportedAt: meta.exportedAt,
          extension: 'docx'
        });
      }
    }
    return defaultFilename(sections[0] && sections[0].snapshot, meta);
  }

  function buildReportBlob(sections, meta) {
    meta = meta || {};
    var zip = buildZip(buildDocxFiles(sections, meta));
    return {
      blob: new Blob([zip], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      }),
      filename: resolveReportFilename(sections, meta)
    };
  }

  function downloadBlob(blob, filename) {
    if (global.PwaWorkbook && PwaWorkbook.downloadBlob) {
      PwaWorkbook.downloadBlob(blob, filename);
      return;
    }
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function exportReport(snapshot, tableRows, meta) {
    var out = buildReportBlob([{
      snapshot: snapshot,
      tableRows: tableRows,
      wireId: meta.wireId,
      filename: meta.sourceFilename
    }], meta);
    downloadBlob(out.blob, out.filename);
    return out;
  }

  function exportProjectReport(sections, meta) {
    var out = buildReportBlob(sections, meta);
    downloadBlob(out.blob, out.filename);
    return out;
  }

  global.PwaWordReport = {
    exportReport: exportReport,
    exportProjectReport: exportProjectReport,
    buildReportBlob: buildReportBlob,
    defaultFilename: defaultFilename
  };
})(typeof window !== 'undefined' ? window : this);
