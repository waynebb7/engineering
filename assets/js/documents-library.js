(function () {
  'use strict';

  var TYPE_LABELS = {
    pdf: 'PDF',
    docx: 'Word',
    xlsx: 'Excel'
  };

  var DEFAULT_GROUPS = [
    { id: 'ungrouped', title: 'Documents' }
  ];

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

  function getVersions(doc) {
    if (doc.versions && doc.versions.length) {
      return doc.versions;
    }
    if (doc.file) {
      return [{
        id: doc.id,
        label: doc.standard || doc.title,
        revision: doc.revision || '',
        file: doc.file
      }];
    }
    return [];
  }

  function renderMeta(doc, versions) {
    var meta = [];
    if (doc.standard) meta.push(escapeHtml(doc.standard));
    if (versions.length > 1) {
      meta.push(versions.length + ' items');
    } else if (doc.revision) {
      meta.push(escapeHtml(doc.revision));
    }
    if (doc.issued) meta.push('Issued ' + escapeHtml(doc.issued));
    return meta.length ? '<p class="documents-card__meta">' + meta.join(' · ') + '</p>' : '';
  }

  function renderTitle(doc, versions) {
    if (versions.length > 1) {
      return '<h2 class="documents-card__title">' + escapeHtml(doc.title) + '</h2>';
    }
    return (
      '<h2 class="documents-card__title">' +
        '<a href="' + escapeHtml(versions[0].file) + '" target="_blank" rel="noopener">' +
          escapeHtml(doc.title) +
        '</a>' +
      '</h2>'
    );
  }

  function renderVersionPicker(doc, versions) {
    if (versions.length <= 1) {
      return '';
    }

    var pickerWord = doc.pickerLabel || 'version';
    var items = versions.map(function (version) {
      var label = version.label || version.revision || 'Version';
      var detail = version.revision && version.label !== version.revision
        ? '<span class="documents-version__detail">' + escapeHtml(version.revision) + '</span>'
        : '';
      return (
        '<li class="documents-version__item">' +
          '<a href="' + escapeHtml(version.file) + '" target="_blank" rel="noopener">' +
            escapeHtml(label) +
          '</a>' +
          detail +
        '</li>'
      );
    }).join('');

    return (
      '<details class="documents-versions">' +
        '<summary class="documents-versions__toggle">' +
          '<span class="documents-versions__toggle-show">Choose ' + escapeHtml(pickerWord) + ' (' + versions.length + ')</span>' +
          '<span class="documents-versions__toggle-hide">Hide list</span>' +
        '</summary>' +
        '<ul class="documents-versions__list">' + items + '</ul>' +
      '</details>'
    );
  }

  function renderDocument(doc) {
    var versions = getVersions(doc);
    var sections = (doc.sections || []).map(function (s) {
      return '<li>' + escapeHtml(s) + '</li>';
    }).join('');
    var tags = (doc.tags || []).map(function (t) {
      return '<span class="documents-tag">' + escapeHtml(t) + '</span>';
    }).join('');

    return (
      '<article class="documents-card' + (versions.length > 1 ? ' documents-card--multi' : '') + '">' +
        '<div class="documents-card__head">' +
          '<span class="documents-type documents-type--' + escapeHtml(doc.type || 'file') + '">' +
            escapeHtml(typeLabel(doc.type)) +
          '</span>' +
          renderMeta(doc, versions) +
        '</div>' +
        renderTitle(doc, versions) +
        (doc.summary ? '<p class="documents-card__summary">' + escapeHtml(doc.summary) + '</p>' : '') +
        (sections ? '<ul class="documents-card__sections">' + sections + '</ul>' : '') +
        (tags ? '<div class="documents-card__tags">' + tags + '</div>' : '') +
        renderVersionPicker(doc, versions) +
      '</article>'
    );
  }

  function groupDocuments(docs, groups) {
    var groupMap = {};
    var order = [];

    (groups || DEFAULT_GROUPS).forEach(function (group) {
      groupMap[group.id] = { title: group.title, docs: [] };
      order.push(group.id);
    });

    if (!groupMap.ungrouped) {
      groupMap.ungrouped = { title: 'Documents', docs: [] };
      order.push('ungrouped');
    }

    docs.forEach(function (doc) {
      var id = doc.group && groupMap[doc.group] ? doc.group : 'ungrouped';
      groupMap[id].docs.push(doc);
    });

    return order
      .map(function (id) { return groupMap[id]; })
      .filter(function (section) { return section.docs.length > 0; });
  }

  function renderList(data) {
    var docs = (data && data.documents) || [];
    if (!docs.length) {
      return '<p class="text-muted">No documents registered yet. Add entries to <code>manifest.json</code>.</p>';
    }

    var sections = groupDocuments(docs, data.groups);
    return sections.map(function (section) {
      return (
        '<section class="documents-section">' +
          '<h2 class="documents-section__title">' + escapeHtml(section.title) + '</h2>' +
          '<div class="documents-grid">' +
            section.docs.map(renderDocument).join('') +
          '</div>' +
        '</section>'
      );
    }).join('');
  }

  function showCatalogue(mount, data) {
    mount.innerHTML = renderList(data);
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
