(function () {
  'use strict';

  function getBasePath() {
    var el = document.querySelector('script[src*="site-layout.js"]');
    if (!el) return '';
    var src = el.getAttribute('src') || '';
    return src.replace(/js\/site-layout\.js(\?.*)?$/, '');
  }

  var path = window.location.pathname.replace(/\\/g, '/');
  var parts = path.split('/').filter(Boolean);
  var file = parts[parts.length - 1] || 'index.html';
  if (!file.endsWith('.html')) file = 'index.html';
  var base = getBasePath();

  var navItems = [
    { href: 'index.html', label: 'Home' },
    { href: 'electrical_equations.html', label: 'Reference' },
    { href: 'dc_power_calculator.html', label: 'Calculators' },
    { href: 'pure_math_subjects.html', label: 'Mathematics' },
    { href: 'physics_subjects.html', label: 'Physics' },
    { href: 'quantum_subjects.html', label: 'Quantum' },
    { href: 'logic_and_digital_math/boolean-algebra.html', label: 'Digital Logic' },
    { href: 'progress.html', label: 'Progress' },
    { href: 'feedback.html', label: 'Feedback' }
  ];

  function isActive(href) {
    if (href === 'index.html') {
      return file === 'index.html';
    }
    if (href.indexOf('/') !== -1) {
      return path.indexOf(href.split('/')[0]) !== -1;
    }
    if (href === 'dc_power_calculator.html') {
      return file.indexOf('calculator') !== -1 ||
        file.indexOf('converter') !== -1 ||
        file.indexOf('power') !== -1 ||
        file.indexOf('degrees') !== -1 ||
        file.indexOf('radians') !== -1 ||
        file.indexOf('efficiency') !== -1 ||
        file === 'logic_truth_table.html';
    }
    if (href === 'electrical_equations.html') {
      return file.indexOf('electrical') !== -1 && file.indexOf('calculator') === -1;
    }
    if (href === 'pure_math_subjects.html') {
      return path.indexOf('/math/') !== -1 ||
        file.indexOf('math') !== -1 ||
        file.indexOf('calculus') !== -1 ||
        file.indexOf('differentiation') !== -1 ||
        file.indexOf('integration') !== -1 ||
        file.indexOf('eigen') !== -1 ||
        file.indexOf('divergence') !== -1;
    }
    if (href === 'physics_subjects.html') {
      var physicsQuantumFile = /^(quantum-mechanics|quantum-physics|quantum-field|quantum-gravity|quantum-optics|quantum-information|loop-quantum)/.test(file);
      return (path.indexOf('physics') !== -1 || path.indexOf('basic_physics') !== -1 || physicsQuantumFile) &&
        path.indexOf('/quantum/') === -1 && file !== 'quantum_subjects.html';
    }
    if (href === 'quantum_subjects.html') {
      return file === 'quantum_subjects.html' || path.indexOf('/quantum/') !== -1;
    }
    if (href === 'progress.html') {
      return file === 'progress.html';
    }
    return file === href;
  }

  var navHtml = navItems.map(function (item) {
    var cls = isActive(item.href) ? ' class="active"' : '';
    return '<a href="' + base + item.href + '"' + cls + '>' + item.label + '</a>';
  }).join('');

  var header = document.createElement('header');
  header.className = 'site-header';
  header.innerHTML =
    '<div class="site-header__inner">' +
      '<a href="' + base + 'index.html" class="site-brand">' +
        '<span class="site-brand__mark">EK</span>' +
        '<span class="site-brand__text">' +
          '<span class="site-brand__name">Engineering Knowledge</span>' +
          '<span class="site-brand__tagline">Technical Reference &amp; Tools</span>' +
        '</span>' +
      '</a>' +
      '<nav class="site-nav" aria-label="Main navigation">' + navHtml + '</nav>' +
    '</div>';

  var footer = document.createElement('footer');
  footer.className = 'site-footer';
  footer.innerHTML =
    '<div class="site-footer__inner">' +
      '<p>&copy; ' + new Date().getFullYear() + ' Engineering Knowledge Hub &middot; ' +
      '<a href="' + base + 'feedback.html">Feedback</a> &middot; MIT License</p>' +
    '</div>';

  var body = document.body;
  var children = Array.prototype.slice.call(body.childNodes);
  var wrapper = document.createElement('main');
  wrapper.className = 'site-main';

  children.forEach(function (node) {
    if (node.nodeType === 1 && node.tagName === 'SCRIPT' && !node.src) {
      return;
    }
    wrapper.appendChild(node);
  });

  body.classList.add('has-site-chrome');
  body.insertBefore(header, body.firstChild);
  body.appendChild(wrapper);

  children.forEach(function (node) {
    if (node.nodeType === 1 && node.tagName === 'SCRIPT' && !node.src) {
      body.appendChild(node);
    }
  });

  body.appendChild(footer);

  if (body.classList.contains('content-page')) {
    var topicProgressScript = document.createElement('script');
    topicProgressScript.src = base + 'js/topic-progress.js';
    document.head.appendChild(topicProgressScript);
  }

  if (body.classList.contains('calculator-page') && body.hasAttribute('data-calc')) {
    var registryScript = document.createElement('script');
    registryScript.src = base + 'js/calculator-registry.js';
    document.head.appendChild(registryScript);

    var coreScript = document.createElement('script');
    coreScript.src = base + 'js/calculator-core.js';
    coreScript.defer = true;
    document.head.appendChild(coreScript);
  }
})();
