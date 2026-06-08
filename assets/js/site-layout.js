(function () {
  'use strict';

  function getBasePath() {
    var el = document.querySelector('script[src*="site-layout.js"]');
    if (!el) return '';
    var src = el.getAttribute('src') || '';
    return src.replace(/(?:assets\/)?js\/site-layout\.js(\?.*)?$/, '');
  }

  var path = window.location.pathname.replace(/\\/g, '/');
  var parts = path.split('/').filter(Boolean);
  var file = parts[parts.length - 1] || 'index.html';
  if (!file.endsWith('.html')) file = 'index.html';
  var base = getBasePath();

  var navItems = [
    { href: 'index.html', label: 'Home' },
    { href: 'calculators/index.html', label: 'Calculators' },
    { href: 'learn/mathematics/index.html', label: 'Mathematics' },
    { href: 'learn/physics/index.html', label: 'Physics' },
    { href: 'learn/quantum/index.html', label: 'Quantum' },
    { href: 'learn/mathematics/digital-logic/boolean-algebra.html', label: 'Digital Logic' },
    { href: 'progress.html', label: 'Progress' },
    { href: 'feedback.html', label: 'Feedback' }
  ];

  function isActive(href) {
    if (href === 'index.html') {
      return file === 'index.html' && path.indexOf('/learn/') === -1 && path.indexOf('/calculators/') === -1;
    }
    if (href === 'calculators/index.html') {
      return path.indexOf('/calculators/') !== -1;
    }
    if (href === 'learn/mathematics/index.html') {
      return path.indexOf('/learn/mathematics/') !== -1;
    }
    if (href === 'learn/physics/index.html') {
      return path.indexOf('/learn/physics/') !== -1;
    }
    if (href === 'learn/quantum/index.html') {
      return path.indexOf('/learn/quantum/') !== -1;
    }
    if (href.indexOf('digital-logic/') !== -1) {
      return path.indexOf('/digital-logic/') !== -1;
    }
    if (href === 'progress.html') {
      return file === 'progress.html';
    }
    return file === href.split('/').pop();
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

  function scriptSibling(name) {
    var el = document.querySelector('script[src*="site-layout.js"]');
    if (!el) return base + name;
    var src = el.getAttribute('src') || '';
    return src.replace(/site-layout\.js(\?.*)?$/, name);
  }

  if (body.classList.contains('content-page')) {
    var topicProgressScript = document.createElement('script');
    topicProgressScript.src = scriptSibling('topic-progress.js');
    document.head.appendChild(topicProgressScript);

    var reviewKey = document.getElementById('topic-review-key');
    if (reviewKey) {
      function typesetReviewKey() {
        if (window.MathJax && MathJax.Hub) {
          MathJax.Hub.Queue(['Typeset', MathJax.Hub, reviewKey]);
        }
      }
      reviewKey.addEventListener('toggle', function () {
        if (reviewKey.open) {
          typesetReviewKey();
        }
      });
      if (reviewKey.open) {
        if (window.MathJax && MathJax.Hub) {
          MathJax.Hub.Register.StartupHook('End', function () {
            typesetReviewKey();
          });
        }
      }
    }
  }

  if (body.classList.contains('calculator-page') && body.hasAttribute('data-calc')) {
    var registryScript = document.createElement('script');
    registryScript.src = scriptSibling('calculator-registry.js');
    document.head.appendChild(registryScript);

    var coreScript = document.createElement('script');
    coreScript.src = scriptSibling('calculator-core.js');
    coreScript.defer = true;
    document.head.appendChild(coreScript);
  }
})();
