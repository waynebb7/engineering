'use strict';

var fs = require('fs');
var path = require('path');

var rows = require('../assets/js/pwa-validation-library-data.json');

function esc(t) {
  return String(t)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

var staticList = rows.map(function (r) {
  return '                  <tr>' +
    '<th scope="row">' + esc(r.caseName) + '</th>' +
    '<td>' + esc(r.caseType) + '</td>' +
    '<td><span class="pwa-trace-badge pwa-trace-badge--level-' + String(r.evidenceQuality).toLowerCase() + '">' + esc(r.evidenceQuality) + '</span></td>' +
    '<td>' + esc(r.designAuthorityStatus) + '</td>' +
    '<td>' + esc(r.notes) + '</td>' +
    '</tr>';
}).join('\n');

var outDir = path.join(__dirname);
fs.writeFileSync(path.join(outDir, 'validation-json.fragment.html'), JSON.stringify(rows, null, 2));
fs.writeFileSync(path.join(outDir, 'validation-static-tbody.fragment.html'), staticList);

require('./patch-validation-html.js');
