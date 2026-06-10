(function () {
  'use strict';

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function num(val, digits) {
    if (typeof val !== 'number' || !isFinite(val)) return '';
    return val.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: typeof digits === 'number' ? digits : 3
    });
  }

  function getWireIdFromQuery() {
    var params = new URLSearchParams(window.location.search);
    return params.get('wire') || 'kp260';
  }

  function renderSpecTable(rows) {
    var html =
      '<div class="pwa-wire-spec__table-wrap">' +
        '<table class="pwa-wire-spec__table">' +
          '<thead><tr>' +
            '<th scope="col">AWG</th>' +
            '<th scope="col">Strand</th>' +
            '<th scope="col">Conductor dia. (nom.)</th>' +
            '<th scope="col">Resistance @ 20 °C</th>' +
            '<th scope="col">Finished O/D (min–max)</th>' +
            '<th scope="col">Amp rating (max.)</th>' +
            '<th scope="col">Weight</th>' +
          '</tr></thead><tbody>';

    rows.forEach(function (row) {
      html +=
        '<tr>' +
          '<td>' + escapeHtml(row.label) + '</td>' +
          '<td>' + escapeHtml(row.strand) + '</td>' +
          '<td>' + num(row.conductorNomDiaMm, 2) + ' mm</td>' +
          '<td>' + num(row.ohmPerKm, 3) + ' Ω/km<br><span class="pwa-wire-spec__sub">' +
            num(row.ohm1000ft, 3) + ' Ω/1000 ft</span></td>' +
          '<td>' + num(row.odMinMm, 2) + '–' + num(row.odMaxMm, 2) + ' mm</td>' +
          '<td>' + num(row.ampRatingMax, 2) + ' A</td>' +
          '<td>' + num(row.weightKgPerKm, 0) + ' kg/km</td>' +
        '</tr>';
    });

    html += '</tbody></table></div>';
    return html;
  }

  function renderPage() {
    if (!window.PwaWireCatalog) return;

    var wireId = getWireIdFromQuery();
    var wireType = PwaWireCatalog.getWireType(wireId);
    var mount = document.getElementById('pwa-wire-spec-content');
    if (!mount) return;

    if (!wireType) {
      mount.innerHTML =
        '<p class="text-muted">Wire type not found. ' +
        '<a href="power-wire-analysis.html">Return to Power Wire Analysis</a>.</p>';
      document.title = 'Wire specification | Engineering Knowledge';
      return;
    }

    var rows = PwaWireCatalog.getWireRows(wireId);
    document.title = wireType.label + ' — Wire specification | Engineering Knowledge';

    var titleEl = document.getElementById('pwa-wire-spec-title');
    if (titleEl) titleEl.textContent = wireType.label;

    var leadEl = document.getElementById('pwa-wire-spec-lead');
    if (leadEl) {
      leadEl.textContent =
        'Manufacturer data for resistance and construction used in the Power Wire Analysis calculator.';
    }

    mount.innerHTML =
      '<dl class="pwa-wire-spec__meta">' +
        '<dt>Manufacturer</dt><dd>' + escapeHtml(wireType.manufacturer) + '</dd>' +
        '<dt>Specification</dt><dd>' + escapeHtml(wireType.brandSpec) + '</dd>' +
        '<dt>Construction</dt><dd>' + escapeHtml(wireType.construction) + '</dd>' +
        '<dt>Operating temperature</dt><dd>' + escapeHtml(wireType.operatingTemp) + '</dd>' +
        '<dt>Voltage rating</dt><dd>' + escapeHtml(wireType.voltageRating) + '</dd>' +
      '</dl>' +
      '<p class="pwa-chart-link">' +
        '<a href="' + escapeHtml(wireType.documentFile) + '" target="_blank" rel="noopener noreferrer">' +
          'Open manufacturer datasheet (PDF)' +
        '</a>' +
      '</p>' +
      '<h2>Electrical and mechanical data</h2>' +
      '<p class="text-muted">Resistance values below populate the calculator grid (Ω/1000 ft derived from Ω/km).</p>' +
      renderSpecTable(rows);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderPage);
  } else {
    renderPage();
  }
})();
