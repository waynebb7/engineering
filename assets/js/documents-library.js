(function () {
  'use strict';

  var TYPE_LABELS = {
    pdf: 'PDF',
    docx: 'Word',
    xlsx: 'Excel'
  };

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function typeLabel(type) {
    return TYPE_LABELS[type] || String(type || 'File').toUpperCase();
  }

  function renderDocument(doc) {
    var href = doc.file;
    var meta = [];
    if (doc.standard) meta.push(escapeHtml(doc.standard));
    if (doc.revision) meta.push(escapeHtml(doc.revision));
    if (doc.issued) meta.push('Issued ' + escapeHtml(doc.issued));
    var sections = (doc.sections || []).map(function (s) {
      return '<li>' + escapeHtml(s) + '</li>';
    }).join('');
    var tags = (doc.tags || []).map(function (t) {
      return '<span class="documents-tag">' + escapeHtml(t) + '</span>';
    }).join('');

    return (
      '<article class="documents-card">' +
        '<div class="documents-card__head">' +
          '<span class="documents-type documents-type--' + escapeHtml(doc.type || 'file') + '">' +
            escapeHtml(typeLabel(doc.type)) +
          '</span>' +
          (meta.length ? '<p class="documents-card__meta">' + meta.join(' · ') + '</p>' : '') +
        '</div>' +
        '<h2 class="documents-card__title">' +
          '<a href="' + escapeHtml(href) + '" target="_blank" rel="noopener">' +
            escapeHtml(doc.title) +
          '</a>' +
        '</h2>' +
        (doc.summary ? '<p class="documents-card__summary">' + escapeHtml(doc.summary) + '</p>' : '') +
        (sections ? '<ul class="documents-card__sections">' + sections + '</ul>' : '') +
        (tags ? '<div class="documents-card__tags">' + tags + '</div>' : '') +
        '<p class="documents-card__action">' +
          '<a class="btn btn--small" href="' + escapeHtml(href) + '" target="_blank" rel="noopener">Open document</a>' +
        '</p>' +
      '</article>'
    );
  }

  function renderList(docs) {
    if (!docs.length) {
      return '<p class="text-muted">No documents registered yet. Add entries to <code>manifest.json</code>.</p>';
    }
    return docs.map(renderDocument).join('');
  }

  function showCatalogue(mount, data) {
    mount.innerHTML = renderList((data && data.documents) || []);
  }

  function showError(mount) {
    mount.innerHTML =
      '<p class="calc-error">Could not load the document catalogue. ' +
      'Run <code>python scripts/build-documents-manifest.py</code> after updating the manifest.</p>';
  }

  function loadCatalogue() {
    if (window.DocumentManifest && window.DocumentManifest.documents) {
      return Promise.resolve(window.DocumentManifest);
    }

    return fetch('manifest.json')
      .then(function (res) {
        if (!res.ok) throw new Error('manifest.json returned ' + res.status);
        return res.json();
      });
  }

  function init() {
    var mount = document.getElementById('documents-list');
    if (!mount) return;

    loadCatalogue()
      .then(function (data) {
        showCatalogue(mount, data);
      })
      .catch(function (err) {
        showError(mount);
        if (window.console && console.warn) {
          console.warn('Document library load failed:', err);
        }
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
