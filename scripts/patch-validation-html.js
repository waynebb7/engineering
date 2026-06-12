'use strict';

var fs = require('fs');
var path = require('path');

var htmlPath = path.join(__dirname, '../calculators/aerospace-electrical-design/power-wire-analysis.html');
var sectionPath = path.join(__dirname, 'validation-section.fragment.html');
var jsonPath = path.join(__dirname, 'validation-json.fragment.html');
var tbodyPath = path.join(__dirname, 'validation-static-tbody.fragment.html');

var html = fs.readFileSync(htmlPath, 'utf8');
var section = fs.readFileSync(sectionPath, 'utf8');
var json = fs.readFileSync(jsonPath, 'utf8');
var tbody = fs.readFileSync(tbodyPath, 'utf8');

section = section.replace('<!-- STATIC_TBODY -->', tbody);

var jsonBlock =
  '        <!-- Static validation templates sync with assets/js/pwa-validation-library-data.json -->\n' +
  '        <script type="application/json" id="pwa-validation-library-data">\n' +
  json + '\n' +
  '        </script>\n\n';

if (html.indexOf('id="pwa-validation-library"') === -1) {
  html = html.replace(
    '        <details class="pwa-advanced-thermal" id="pwa-advanced-thermal">',
    jsonBlock + section + '\n        <details class="pwa-advanced-thermal" id="pwa-advanced-thermal">'
  );
} else {
  html = html.replace(
    /<!-- Static validation templates sync with assets\/js\/pwa-validation-library-data\.json -->\s*<script type="application\/json" id="pwa-validation-library-data">[\s\S]*?<\/script>\s*/,
    jsonBlock
  );
  html = html.replace(
    /<tbody id="pwa-val-static-templates-body">[\s\S]*?<\/tbody>/,
    '<tbody id="pwa-val-static-templates-body">\n' + tbody + '\n                  </tbody>'
  );
}

html = html.replace(
  /pwa-validation-library\.js\?v=[\d.]+/,
  'pwa-validation-library.js?v=1.0.0'
);

if (html.indexOf('pwa-validation-library.js') === -1) {
  html = html.replace(
    '  <script src="../../assets/js/pwa-confidence-rating.js?v=1.0.1" defer></script>',
    '  <script src="../../assets/js/pwa-confidence-rating.js?v=1.0.1" defer></script>\n' +
    '  <script src="../../assets/js/pwa-validation-library.js?v=1.0.0" defer></script>'
  );
}

html = html.replace(
  /pwa-grid-calculator\.js\?v=[\d.]+/,
  'pwa-grid-calculator.js?v=2.0.6'
);
html = html.replace(
  /pwa-workbook\.js\?v=[\d.]+/,
  'pwa-workbook.js?v=2.0.6'
);
html = html.replace(
  /pwa-word-report\.js\?v=[\d.]+/,
  'pwa-word-report.js?v=2.0.6'
);
html = html.replace(
  /pwa-confidence-rating\.js\?v=[\d.]+/,
  'pwa-confidence-rating.js?v=1.0.2'
);

fs.writeFileSync(htmlPath, html);
console.log('Patched', htmlPath);
