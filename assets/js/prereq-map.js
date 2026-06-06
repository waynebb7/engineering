(function () {
  'use strict';

  var STORAGE_KEY = 'ek-topic-progress';

  function parseJsonScript(id) {
    var el = document.getElementById(id);
    if (!el || !el.textContent.trim()) return null;
    return JSON.parse(el.textContent);
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function loadProgress() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function pageHref(href) {
    return '../' + href.replace(/^\//, '');
  }

  function nodeProgress(pages, progress) {
    if (!pages || !pages.length) return { state: 'no-lesson', label: 'No lesson page' };
    var read = 0;
    var weak = 0;
    var strong = 0;
    pages.forEach(function (p) {
      var entry = progress[p] || { read: false, comprehension: '' };
      if (!entry.read) return;
      read += 1;
      if (entry.comprehension === 'review' || entry.comprehension === 'partial') weak += 1;
      else if (entry.comprehension === 'understood' || entry.comprehension === 'mastered') strong += 1;
    });
    if (read === 0) return { state: 'todo', label: 'Not started' };
    if (read < pages.length) return { state: 'partial', label: 'In progress' };
    if (weak > 0) return { state: 'weak', label: 'Needs review' };
    if (strong > 0) return { state: 'done', label: 'Completed' };
    return { state: 'read', label: 'Read' };
  }

  function shortestPath(startId, goalId, edgesTo) {
    if (startId === goalId) return [goalId];
    var queue = [[goalId]];
    var seen = new Set([goalId]);
    while (queue.length) {
      var path = queue.shift();
      var node = path[0];
      var prereqs = (edgesTo.get(node) || []).map(function (e) { return e.from; });
      for (var i = 0; i < prereqs.length; i += 1) {
        var prev = prereqs[i];
        if (seen.has(prev)) continue;
        seen.add(prev);
        var nextPath = [prev].concat(path);
        if (prev === startId) return nextPath;
        queue.push(nextPath);
      }
    }
    return null;
  }

  function initMap() {
    var body = document.body;
    var config = parseJsonScript('prereq-map-config') || {};
    var graph = parseJsonScript('prereq-graph-data');
    var nodePages = parseJsonScript('prereq-node-pages') || {};

    if (!graph) {
      console.error('Prerequisite map: missing graph data');
      return;
    }

    var LEVELS = config.levels || graph.meta.levels || [];
    var NODES = graph.nodes || [];
    var EDGES = (graph.edges || []).concat(graph.cross_edges || []);
    var hasEdgeTypes = !!config.hasEdgeTypes;
    var hasDomains = !!config.hasDomains;
    var defaultFocus = config.defaultFocus || null;
    var catalogHref = config.catalogHref || null;

    var byId = new Map();
    var edgesFrom = new Map();
    var edgesTo = new Map();
    var nodeEls = new Map();
    var selectedId = null;
    var progress = loadProgress();

    var viewport = document.getElementById('viewport');
    var stage = document.getElementById('stage');
    var svg = document.getElementById('links');
    var searchEl = document.getElementById('search');
    var focusSelect = document.getElementById('focusSelect');
    var goalSelect = document.getElementById('goalSelect');
    var resetBtn = document.getElementById('resetBtn');
    var domainFilter = document.getElementById('domainFilter');
    var lessonsOnly = document.getElementById('lessonsOnly');
    var levelFilters = Array.prototype.slice.call(document.querySelectorAll('.level-filter'));

    var detailPanel = document.getElementById('detailPanel');
    var panelTitle = document.getElementById('panelTitle');
    var panelMeta = document.getElementById('panelMeta');
    var panelLessons = document.getElementById('panelLessons');
    var panelPath = document.getElementById('panelPath');
    var panelReq = document.getElementById('panelReq');
    var panelReqAll = document.getElementById('panelReqAll');
    var panelDep = document.getElementById('panelDep');
    var panelGaps = document.getElementById('panelGaps');

    function indexGraph() {
      byId = new Map(NODES.map(function (n) { return [n.id, n]; }));
      edgesFrom = new Map();
      edgesTo = new Map();
      EDGES.forEach(function (e) {
        if (!edgesFrom.has(e.from)) edgesFrom.set(e.from, []);
        if (!edgesTo.has(e.to)) edgesTo.set(e.to, []);
        edgesFrom.get(e.from).push(e);
        edgesTo.get(e.to).push(e);
      });
    }

    function pagesFor(id) {
      return nodePages[id] || [];
    }

    function getAllPrereqs(startId) {
      var seen = new Set();
      var stack = (edgesTo.get(startId) || []).map(function (e) { return e.from; });
      while (stack.length) {
        var id = stack.pop();
        if (seen.has(id)) continue;
        seen.add(id);
        (edgesTo.get(id) || []).forEach(function (e) { stack.push(e.from); });
      }
      return seen;
    }

    function getAllDependents(startId) {
      var seen = new Set();
      var stack = (edgesFrom.get(startId) || []).map(function (e) { return e.to; });
      while (stack.length) {
        var id = stack.pop();
        if (seen.has(id)) continue;
        seen.add(id);
        (edgesFrom.get(id) || []).forEach(function (e) { stack.push(e.to); });
      }
      return seen;
    }

    function missingPrereqs(id) {
      var prereqs = getAllPrereqs(id);
      var missing = [];
      prereqs.forEach(function (pid) {
        var pages = pagesFor(pid);
        if (!pages.length) return;
        var st = nodeProgress(pages, progress);
        if (st.state === 'todo' || st.state === 'weak' || st.state === 'partial') {
          missing.push(pid);
        }
      });
      return missing;
    }

    function createLevelColumn(level) {
      var col = document.createElement('div');
      col.className = 'level';
      col.dataset.level = level;
      col.innerHTML = '<h2>' + escapeHtml(level) + '</h2>';
      return col;
    }

    function progressBadge(id) {
      var st = nodeProgress(pagesFor(id), progress);
      return '<span class="pill progress-pill progress-pill--' + st.state + '">' + escapeHtml(st.label) + '</span>';
    }

    function renderColumns() {
      stage.innerHTML = '';
      nodeEls.clear();
      var columns = new Map();
      LEVELS.forEach(function (level) {
        var col = createLevelColumn(level);
        columns.set(level, col);
        stage.appendChild(col);
      });

      NODES.forEach(function (node) {
        var col = columns.get(node.level);
        if (!col) return;
        var el = document.createElement('div');
        var subject = node.subject || config.id || 'topic';
        el.className = 'node' + (subject !== config.id && subject !== 'quantum' && subject !== 'physics' ? ' node--external' : '');
        if (node.subject === 'math') el.classList.add('node--math');
        el.id = 'node_' + node.id;
        el.dataset.id = node.id;

        var prereqCount = (edgesTo.get(node.id) || []).length;
        var depCount = (edgesFrom.get(node.id) || []).length;
        var domainPill = hasDomains && node.domain
          ? '<span class="pill">' + escapeHtml(node.domain) + '</span>'
          : '';
        var subjectPill = node.subject && node.subject !== config.id
          ? '<span class="pill pill--subject">' + escapeHtml(node.subject) + '</span>'
          : '';

        el.innerHTML =
          '<div class="title">' + escapeHtml(node.title) + '</div>' +
          '<div class="meta">' +
            '<span class="pill">Prereqs: ' + prereqCount + '</span>' +
            '<span class="pill">Dependents: ' + depCount + '</span>' +
            progressBadge(node.id) +
            domainPill + subjectPill +
          '</div>';

        el.addEventListener('click', function () { select(node.id); });
        col.appendChild(el);
        nodeEls.set(node.id, el);
      });
    }

    function buildSelects() {
      var sorted = NODES.slice().sort(function (a, b) { return a.title.localeCompare(b.title); });
      var opts = ['<option value="">Focus topic (jump)</option>']
        .concat(sorted.map(function (n) {
          return '<option value="' + escapeHtml(n.id) + '">' + escapeHtml(n.title) + '</option>';
        }));
      focusSelect.innerHTML = opts.join('');
      goalSelect.innerHTML = ['<option value="">Goal topic (show path)</option>']
        .concat(sorted.map(function (n) {
          return '<option value="' + escapeHtml(n.id) + '">' + escapeHtml(n.title) + '</option>';
        })).join('');

      if (hasDomains) {
        var domains = Array.from(new Set(NODES.map(function (n) { return n.domain; }).filter(Boolean))).sort();
        domainFilter.innerHTML = ['<option value="">All domains</option>']
          .concat(domains.map(function (d) {
            return '<option value="' + escapeHtml(d) + '">' + escapeHtml(d) + '</option>';
          })).join('');
      } else if (domainFilter) {
        domainFilter.closest('.toolbar-group').style.display = 'none';
      }
    }

    function jumpTo(id) {
      var el = nodeEls.get(id);
      if (!el) return;
      var vpRect = viewport.getBoundingClientRect();
      var elRect = el.getBoundingClientRect();
      var target = viewport.scrollLeft + (elRect.left - vpRect.left) + (elRect.width / 2) - (vpRect.width / 2);
      viewport.scrollLeft = Math.max(0, target);
    }

    function clearList(ul) {
      while (ul.firstChild) ul.removeChild(ul.firstChild);
    }

    function addMapListItem(ul, id) {
      var n = byId.get(id);
      var li = document.createElement('li');
      if (!n) { li.textContent = id; ul.appendChild(li); return; }
      var a = document.createElement('a');
      a.href = '#';
      a.textContent = n.title;
      a.addEventListener('click', function (ev) {
        ev.preventDefault();
        select(n.id);
        jumpTo(n.id);
      });
      li.appendChild(a);
      ul.appendChild(li);
    }

    function addLessonList(ul, pages) {
      pages.forEach(function (href) {
        var li = document.createElement('li');
        var a = document.createElement('a');
        a.href = pageHref(href);
        a.textContent = href.split('/').pop().replace('.html', '').replace(/-/g, ' ');
        var st = nodeProgress([href], progress);
        var badge = document.createElement('span');
        badge.className = 'lesson-status lesson-status--' + st.state;
        badge.textContent = st.label;
        li.appendChild(a);
        li.appendChild(document.createTextNode(' '));
        li.appendChild(badge);
        ul.appendChild(li);
      });
    }

    function renderPanel(id) {
      var n = byId.get(id);
      if (!n) return;
      detailPanel.style.display = 'block';
      panelTitle.textContent = n.title;

      var directReq = (edgesTo.get(id) || []).map(function (e) { return byId.get(e.from); }).filter(Boolean);
      var directDep = (edgesFrom.get(id) || []).map(function (e) { return byId.get(e.to); }).filter(Boolean);
      var allReq = Array.from(getAllPrereqs(id)).map(function (x) { return byId.get(x); }).filter(Boolean);
      var gaps = missingPrereqs(id);
      var pages = pagesFor(id);

      panelMeta.textContent =
        'Level: ' + n.level +
        (n.domain ? ' | Domain: ' + n.domain : '') +
        (n.subject && n.subject !== config.id ? ' | Subject: ' + n.subject : '') +
        ' | Direct prerequisites: ' + directReq.length +
        ' | Direct dependents: ' + directDep.length;

      clearList(panelLessons);
      if (pages.length) {
        addLessonList(panelLessons, pages);
      } else {
        var li = document.createElement('li');
        li.textContent = 'No linked lesson page yet.';
        panelLessons.appendChild(li);
      }

      clearList(panelPath);
      var goalId = goalSelect.value || id;
      var roots = NODES.filter(function (node) { return (edgesTo.get(node.id) || []).length === 0; });
      var bestPath = null;
      roots.forEach(function (root) {
        var path = shortestPath(root.id, goalId, edgesTo);
        if (path && (!bestPath || path.length < bestPath.length)) bestPath = path;
      });
      if (bestPath && bestPath.length > 1) {
        bestPath.forEach(function (pid, idx) {
          var item = byId.get(pid);
          var li = document.createElement('li');
          if (idx > 0) li.className = 'path-step';
          if (item) {
            var a = document.createElement('a');
            a.href = '#';
            a.textContent = (idx + 1) + '. ' + item.title;
            a.addEventListener('click', function (ev) {
              ev.preventDefault();
              select(item.id);
              jumpTo(item.id);
            });
            li.appendChild(a);
          } else {
            li.textContent = pid;
          }
          panelPath.appendChild(li);
        });
      } else {
        var empty = document.createElement('li');
        empty.textContent = 'Already at a foundation topic or no chain found.';
        panelPath.appendChild(empty);
      }

      clearList(panelGaps);
      if (gaps.length) {
        gaps.sort(function (a, b) {
          return (byId.get(a).title || a).localeCompare(byId.get(b).title || b);
        }).forEach(function (gid) { addMapListItem(panelGaps, gid); });
      } else {
        var ok = document.createElement('li');
        ok.textContent = 'All linked prerequisites are started or complete.';
        panelGaps.appendChild(ok);
      }

      clearList(panelReq);
      clearList(panelReqAll);
      clearList(panelDep);
      directReq.sort(function (a, b) { return a.title.localeCompare(b.title); }).forEach(function (x) { addMapListItem(panelReq, x.id); });
      allReq.sort(function (a, b) { return a.title.localeCompare(b.title); }).forEach(function (x) { addMapListItem(panelReqAll, x.id); });
      directDep.sort(function (a, b) { return a.title.localeCompare(b.title); }).forEach(function (x) { addMapListItem(panelDep, x.id); });
    }

    function getFilterContext() {
      var visible = new Set();
      var q = searchEl.value.trim().toLowerCase();
      var domain = domainFilter ? domainFilter.value : '';
      var onlyLessons = lessonsOnly && lessonsOnly.checked;
      var enabledLevels = new Set(
        levelFilters.filter(function (cb) { return cb.checked; }).map(function (cb) { return cb.value; })
      );

      NODES.forEach(function (n) {
        var hitSearch = !q || n.title.toLowerCase().includes(q) || (n.domain || '').toLowerCase().includes(q);
        var hitDomain = !domain || n.domain === domain;
        var hitLevel = enabledLevels.has(n.level);
        var hitLessons = !onlyLessons || pagesFor(n.id).length > 0;
        if (hitSearch && hitDomain && hitLevel && hitLessons) visible.add(n.id);
      });
      return visible;
    }

    function applyFilters() {
      var visible = getFilterContext();
      nodeEls.forEach(function (el, id) {
        el.style.display = visible.has(id) ? '' : 'none';
      });
      var ctx = selectedId
        ? { focusId: selectedId, prereqs: getAllPrereqs(selectedId), deps: getAllDependents(selectedId), visible: visible }
        : { visible: visible };
      redrawLines(ctx);
    }

    function applyHighlight(id) {
      nodeEls.forEach(function (el) {
        el.classList.remove('selected', 'dim', 'upstream', 'downstream', 'gap');
      });
      if (!id) {
        redrawLines({ visible: getFilterContext() });
        detailPanel.style.display = 'none';
        return;
      }
      var prereqs = getAllPrereqs(id);
      var deps = getAllDependents(id);
      var gaps = new Set(missingPrereqs(id));
      nodeEls.forEach(function (el, nid) {
        var selected = nid === id;
        var up = prereqs.has(nid);
        var down = deps.has(nid);
        if (selected) el.classList.add('selected');
        if (up) el.classList.add('upstream');
        if (down) el.classList.add('downstream');
        if (gaps.has(nid)) el.classList.add('gap');
        if (!(selected || up || down)) el.classList.add('dim');
      });
      redrawLines({ focusId: id, prereqs: prereqs, deps: deps, visible: getFilterContext() });
    }

    function select(id) {
      selectedId = id;
      focusSelect.value = id;
      renderPanel(id);
      applyHighlight(id);
    }

    function svgClear() {
      while (svg.firstChild) svg.removeChild(svg.firstChild);
    }

    function getElBoxInViewportSpace(el) {
      var vpRect = viewport.getBoundingClientRect();
      var r = el.getBoundingClientRect();
      return {
        x: (r.left - vpRect.left) + viewport.scrollLeft,
        y: (r.top - vpRect.top) + viewport.scrollTop,
        w: r.width,
        h: r.height
      };
    }

    function redrawLines(context) {
      var contentWidth = stage.scrollWidth + 32;
      var contentHeight = Math.max(stage.scrollHeight + 32, viewport.clientHeight);
      svg.setAttribute('width', String(contentWidth));
      svg.setAttribute('height', String(contentHeight));
      svg.style.width = contentWidth + 'px';
      svg.style.height = contentHeight + 'px';
      svgClear();

      var defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
      var marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
      marker.setAttribute('id', 'arrow');
      marker.setAttribute('viewBox', '0 0 10 10');
      marker.setAttribute('refX', '9');
      marker.setAttribute('refY', '5');
      marker.setAttribute('markerWidth', '7');
      marker.setAttribute('markerHeight', '7');
      marker.setAttribute('orient', 'auto-start-reverse');
      var arrowPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      arrowPath.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
      arrowPath.setAttribute('fill', 'var(--line)');
      marker.appendChild(arrowPath);
      defs.appendChild(marker);
      svg.appendChild(defs);

      var visibleSet = context && context.visible instanceof Set ? context.visible : null;
      EDGES.forEach(function (e) {
        var fromEl = nodeEls.get(e.from);
        var toEl = nodeEls.get(e.to);
        if (!fromEl || !toEl) return;
        if (fromEl.style.display === 'none' || toEl.style.display === 'none') return;
        if (visibleSet && (!visibleSet.has(e.from) || !visibleSet.has(e.to))) return;

        var a = getElBoxInViewportSpace(fromEl);
        var b = getElBoxInViewportSpace(toEl);
        var x1 = a.x + a.w;
        var y1 = a.y + (a.h / 2);
        var x2 = b.x;
        var y2 = b.y + (b.h / 2);
        var dx = Math.max(60, (x2 - x1) * 0.45);

        var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', 'M ' + x1 + ' ' + y1 + ' C ' + (x1 + dx) + ' ' + y1 + ', ' + (x2 - dx) + ' ' + y2 + ', ' + x2 + ' ' + y2);
        path.setAttribute('fill', 'none');

        var width = 1.4;
        var opacity = 0.65;
        var dash = '';
        var stroke = 'var(--line)';
        if (hasEdgeTypes && e.type === 'required') {
          stroke = 'var(--req)';
          width = 2.2;
          opacity = 0.85;
        } else if (hasEdgeTypes && e.type === 'recommended') {
          stroke = 'var(--rec)';
          width = 1.8;
          dash = '6 4';
        }
        if (e.subject === 'math') {
          stroke = 'var(--math-line)';
          dash = dash || '4 3';
        }
        if (context && context.focusId) {
          var onBand =
            e.to === context.focusId ||
            (context.prereqs && context.prereqs.has(e.to) && (context.prereqs.has(e.from) || e.from === context.focusId)) ||
            (context.deps && context.deps.has(e.from) && (context.deps.has(e.to) || e.to === context.focusId));
          opacity = onBand ? Math.max(opacity, 0.92) : 0.12;
        }
        path.setAttribute('stroke', stroke);
        path.setAttribute('stroke-width', String(width));
        path.setAttribute('opacity', String(opacity));
        if (dash) path.setAttribute('stroke-dasharray', dash);
        path.setAttribute('marker-end', 'url(#arrow)');
        svg.appendChild(path);
      });
    }

    function resetView() {
      selectedId = null;
      focusSelect.value = '';
      goalSelect.value = '';
      searchEl.value = '';
      if (domainFilter) domainFilter.value = '';
      if (lessonsOnly) lessonsOnly.checked = false;
      levelFilters.forEach(function (cb) { cb.checked = true; });
      nodeEls.forEach(function (el) { el.style.display = ''; });
      applyHighlight(null);
      redrawLines(null);
    }

    function scheduleRedraw() {
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          var ctx = selectedId
            ? { focusId: selectedId, prereqs: getAllPrereqs(selectedId), deps: getAllDependents(selectedId), visible: getFilterContext() }
            : { visible: getFilterContext() };
          redrawLines(ctx);
        });
      });
    }

    indexGraph();
    renderColumns();
    buildSelects();
    scheduleRedraw();

    viewport.addEventListener('scroll', scheduleRedraw);
    window.addEventListener('resize', scheduleRedraw);
    searchEl.addEventListener('input', applyFilters);
    if (domainFilter) domainFilter.addEventListener('change', applyFilters);
    if (lessonsOnly) lessonsOnly.addEventListener('change', applyFilters);
    levelFilters.forEach(function (cb) { cb.addEventListener('change', applyFilters); });

    focusSelect.addEventListener('change', function () {
      if (!focusSelect.value) return;
      select(focusSelect.value);
      jumpTo(focusSelect.value);
    });
    goalSelect.addEventListener('change', function () {
      if (!goalSelect.value) return;
      select(goalSelect.value);
      jumpTo(goalSelect.value);
    });
    resetBtn.addEventListener('click', resetView);

    window.addEventListener('ek-progress-updated', function () {
      progress = loadProgress();
      renderColumns();
      if (selectedId) {
        renderPanel(selectedId);
        applyHighlight(selectedId);
      }
      scheduleRedraw();
    });

    if (defaultFocus && byId.has(defaultFocus)) {
      select(defaultFocus);
      jumpTo(defaultFocus);
    }

    if (catalogHref) {
      var link = document.getElementById('catalogLink');
      if (link) link.setAttribute('href', pageHref(catalogHref));
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMap);
  } else {
    initMap();
  }
})();
