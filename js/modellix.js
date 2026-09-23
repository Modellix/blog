document.addEventListener('DOMContentLoaded', function () {
  var ICON_RESET_DELAY = 2000;
  var TOC_CLICK_LOCK = 800;
  var ATTRIBUTION_QUERY_KEYS = [
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_content',
    'utm_term',
    'gclid'
  ];
  var headerOffset = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--header-height')) || 72;

  function safeGetStorageItem(type, key) {
    try {
      return window[type].getItem(key);
    } catch (error) {
      return null;
    }
  }

  function safeSetStorageItem(type, key, value) {
    try {
      window[type].setItem(key, value);
    } catch (error) {
      // Attribution is best effort when browser storage is unavailable.
    }
  }

  function safeRemoveStorageItem(type, key) {
    try {
      window[type].removeItem(key);
    } catch (error) {
      // Attribution is best effort when browser storage is unavailable.
    }
  }

  function isValidHttpUrl(value) {
    if (!value) return false;

    try {
      var parsed = new URL(value);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch (error) {
      return false;
    }
  }

  function normalizeNewFirstVisitUrl(value) {
    var parsed = new URL(value);
    parsed.hash = '';
    return parsed.href;
  }

  function isHostnameOrSubdomain(hostname, rootHostname) {
    return hostname === rootHostname || hostname.slice(-(rootHostname.length + 1)) === '.' + rootHostname;
  }

  function isAllowedExternalReferer(value) {
    if (!isValidHttpUrl(value)) return false;

    var parsed = new URL(value);
    var hostname = parsed.hostname.toLowerCase();
    var excludedHost =
      isHostnameOrSubdomain(hostname, 'github.com') ||
      isHostnameOrSubdomain(hostname, 'accounts.google.com') ||
      isHostnameOrSubdomain(hostname, 'appleid.apple.com');

    return parsed.origin !== window.location.origin && !excludedHost;
  }

  function getStoredAttributionUrl(key) {
    var sessionValue = safeGetStorageItem('sessionStorage', key);
    if (isValidHttpUrl(sessionValue)) return sessionValue;

    var localValue = safeGetStorageItem('localStorage', key);
    return isValidHttpUrl(localValue) ? localValue : '';
  }

  function getAttributionQueryValue(key, firstVisit) {
    var candidates = [firstVisit, window.location.href];
    for (var index = 0; index < candidates.length; index += 1) {
      if (!isValidHttpUrl(candidates[index])) continue;
      var value = new URL(candidates[index]).searchParams.get(key);
      if (value) return value;
    }
    return '';
  }

  function isAttributionTarget(targetUrl) {
    var hostname = targetUrl.hostname.toLowerCase();
    var isDocs = hostname === 'docs.modellix.ai';
    var isConsoleHost = hostname === 'modellix.ai' || hostname === 'www.modellix.ai';
    var isConsolePath = targetUrl.pathname === '/console' || targetUrl.pathname.indexOf('/console/') === 0;
    return isDocs || (isConsoleHost && isConsolePath);
  }

  function decorateAttributionLink(event) {
    if (!(event.target instanceof Element)) return;

    var anchor = event.target.closest('a[href]');
    if (!anchor) return;

    var targetUrl;
    try {
      targetUrl = new URL(anchor.getAttribute('href'), window.location.href);
    } catch (error) {
      return;
    }
    if (!isAttributionTarget(targetUrl)) return;

    var firstVisit = getStoredAttributionUrl('first_visit_url');
    var firstReferer = getStoredAttributionUrl('first_referer_url');
    var changed = false;

    if (firstVisit && !targetUrl.searchParams.has('origin')) {
      targetUrl.searchParams.set('origin', firstVisit);
      changed = true;
    }
    if (firstReferer && !targetUrl.searchParams.has('referer')) {
      targetUrl.searchParams.set('referer', firstReferer);
      changed = true;
    }

    ATTRIBUTION_QUERY_KEYS.forEach(function (key) {
      if (targetUrl.searchParams.has(key)) return;
      var value = getAttributionQueryValue(key, firstVisit);
      if (!value) return;
      targetUrl.searchParams.set(key, value);
      changed = true;
    });

    if (changed) anchor.setAttribute('href', targetUrl.href);
  }

  function initAttributionLinkBridge() {
    document.addEventListener('pointerdown', decorateAttributionLink, true);
    document.addEventListener('click', decorateAttributionLink, true);
    document.addEventListener('auxclick', decorateAttributionLink, true);
  }

  function initClueContext() {
    var params = new URLSearchParams(window.location.search);
    var persistedLocalFirstVisit = safeGetStorageItem('localStorage', 'first_visit_url');
    var persistedLocalFirstReferer = safeGetStorageItem('localStorage', 'first_referer_url');

    if (persistedLocalFirstVisit && !isValidHttpUrl(persistedLocalFirstVisit)) {
      safeRemoveStorageItem('localStorage', 'first_visit_url');
      persistedLocalFirstVisit = null;
    }
    if (persistedLocalFirstReferer && !isAllowedExternalReferer(persistedLocalFirstReferer)) {
      safeRemoveStorageItem('localStorage', 'first_referer_url');
      persistedLocalFirstReferer = null;
    }

    var sessionFirstVisit = safeGetStorageItem('sessionStorage', 'first_visit_url');
    if (sessionFirstVisit && !isValidHttpUrl(sessionFirstVisit)) {
      safeRemoveStorageItem('sessionStorage', 'first_visit_url');
      sessionFirstVisit = null;
    }
    if (!isValidHttpUrl(sessionFirstVisit)) {
      var origin = params.get('origin');
      var firstVisit = isValidHttpUrl(persistedLocalFirstVisit)
        ? persistedLocalFirstVisit
        : normalizeNewFirstVisitUrl(isValidHttpUrl(origin) ? origin : window.location.href);

      safeSetStorageItem('sessionStorage', 'first_visit_url', firstVisit);
      if (!isValidHttpUrl(persistedLocalFirstVisit)) {
        safeSetStorageItem('localStorage', 'first_visit_url', firstVisit);
      }
    }

    var sessionFirstReferer = safeGetStorageItem('sessionStorage', 'first_referer_url');
    if (sessionFirstReferer && !isAllowedExternalReferer(sessionFirstReferer)) {
      safeRemoveStorageItem('sessionStorage', 'first_referer_url');
      sessionFirstReferer = null;
    }
    if (!isAllowedExternalReferer(sessionFirstReferer)) {
      var queryReferer = params.get('referer');
      var firstReferer = isAllowedExternalReferer(persistedLocalFirstReferer)
        ? persistedLocalFirstReferer
        : isAllowedExternalReferer(queryReferer)
          ? queryReferer
          : isAllowedExternalReferer(document.referrer)
            ? document.referrer
            : '';

      if (firstReferer) {
        safeSetStorageItem('sessionStorage', 'first_referer_url', firstReferer);
        if (!isAllowedExternalReferer(persistedLocalFirstReferer)) {
          safeSetStorageItem('localStorage', 'first_referer_url', firstReferer);
        }
      }
    }
  }

  initClueContext();
  initAttributionLinkBridge();

  function swapIcon(el, tempIcon, restoreIcon, tempClass) {
    el.innerHTML = '<i data-lucide="' + tempIcon + '"></i>';
    if (tempClass) el.classList.add(tempClass);
    lucide.createIcons({ nameAttr: 'data-lucide', attrs: {} });
    setTimeout(function () {
      el.innerHTML = '<i data-lucide="' + restoreIcon + '"></i>';
      if (tempClass) el.classList.remove(tempClass);
      lucide.createIcons({ nameAttr: 'data-lucide', attrs: {} });
    }, ICON_RESET_DELAY);
  }

  // Open outbound links in a new tab (keeps readers on the blog article).
  function openExternalLinksInNewTab(root) {
    if (!root) return;
    root.querySelectorAll('a[href]').forEach(function (anchor) {
      if (anchor.target === '_blank') return;

      var href = anchor.getAttribute('href');
      if (!href || href.charAt(0) === '#') return;
      if (href.indexOf('mailto:') === 0 || href.indexOf('tel:') === 0) return;

      var opensInNewTab = false;

      if (/^https?:\/\//i.test(href) || href.indexOf('//') === 0) {
        try {
          var url = new URL(href, window.location.href);
          var isSameBlog =
            url.origin === window.location.origin && url.pathname.indexOf('/blog/') === 0;
          opensInNewTab = !isSameBlog;
        } catch (error) {
          opensInNewTab = true;
        }
      } else if (href.indexOf('../') === 0) {
        opensInNewTab = true;
      }

      if (opensInNewTab) {
        anchor.target = '_blank';
        anchor.rel = 'noopener noreferrer';
      }
    });
  }

  document.querySelectorAll('.post-content, .post-excerpt, .post-cta, .post-sidebar').forEach(function (root) {
    openExternalLinksInNewTab(root);
  });

  // Share: copy link button (uses Font Awesome)
  var copyBtn = document.querySelector('.post-copy-link');
  if (copyBtn) {
    copyBtn.addEventListener('click', function () {
      navigator.clipboard.writeText(copyBtn.getAttribute('data-url')).then(function () {
        copyBtn.innerHTML = '<i class="fa-solid fa-check"></i>';
        setTimeout(function () {
          copyBtn.innerHTML = '<i class="fa-solid fa-link"></i>';
        }, ICON_RESET_DELAY);
      });
    });
  }

  // Code blocks: language label + copy button
  document.querySelectorAll('.post-content figure.highlight').forEach(function (fig) {
    var lang = '';
    fig.classList.forEach(function (cls) {
      if (cls !== 'highlight') lang = cls;
    });

    var toolbar = document.createElement('div');
    toolbar.className = 'code-toolbar';
    toolbar.innerHTML =
      '<span class="code-lang">' + (lang || 'code') + '</span>' +
      '<button class="code-copy-btn" aria-label="Copy code"><i data-lucide="clipboard"></i></button>';
    fig.appendChild(toolbar);

    toolbar.querySelector('.code-copy-btn').addEventListener('click', function () {
      var pre = fig.querySelector('.code pre') || fig.querySelector('pre');
      if (!pre) return;
      var btn = this;
      navigator.clipboard.writeText(pre.innerText).then(function () {
        swapIcon(btn, 'check', 'clipboard', 'is-copied');
      });
    });
  });

  // Table of contents
  var toc = document.getElementById('post-toc');
  if (toc) {
    var headings = document.querySelectorAll('.post-content h2');
    if (headings.length > 0) {
      var list = toc.querySelector('.post-toc-list');
      headings.forEach(function (h, i) {
        h.id = 'heading-' + i;
        var li = document.createElement('li');
        li.className = 'post-toc-item';
        li.innerHTML = '<a href="#heading-' + i + '" class="post-toc-link">' + h.textContent + '</a>';
        list.appendChild(li);
      });
      toc.style.display = '';

      var tocLinks = toc.querySelectorAll('.post-toc-link');
      var clickLockUntil = 0;

      function setActive(idx) {
        tocLinks.forEach(function (link, i) {
          link.classList.toggle('is-active', i === idx);
        });
      }

      tocLinks.forEach(function (link, i) {
        link.addEventListener('click', function (e) {
          e.preventDefault();
          setActive(i);
          clickLockUntil = Date.now() + TOC_CLICK_LOCK;
          var target = document.getElementById('heading-' + i);
          if (target) {
            window.scrollTo({ top: target.offsetTop - headerOffset - 20, behavior: 'smooth' });
          }
        });
      });

      window.addEventListener('scroll', function () {
        if (Date.now() < clickLockUntil) return;
        var scrollPos = window.scrollY + headerOffset + 40;
        var activeIdx = -1;
        for (var i = headings.length - 1; i >= 0; i--) {
          if (headings[i].offsetTop <= scrollPos) {
            activeIdx = i;
            break;
          }
        }
        setActive(activeIdx);
      }, { passive: true });

      setActive(-1);
    }
  }

  // Image zoom: click to enlarge images inside post content
  var postContent = document.querySelector('.post-content');
  if (postContent) {
    var zoomableImages = Array.prototype.filter.call(
      postContent.querySelectorAll('img'),
      function (img) {
        return !img.hasAttribute('data-no-zoom') && !img.closest('a, button');
      }
    );
    if (zoomableImages.length > 0) {
      var lightbox = document.createElement('div');
      lightbox.className = 'image-lightbox';
      lightbox.setAttribute('role', 'dialog');
      lightbox.setAttribute('aria-modal', 'true');
      lightbox.setAttribute('aria-label', 'Image preview');
      lightbox.innerHTML =
        '<button class="image-lightbox-close" aria-label="Close"><i data-lucide="x"></i></button>' +
        '<img class="image-lightbox-img" alt="">';
      document.body.appendChild(lightbox);

      var lightboxImg = lightbox.querySelector('.image-lightbox-img');
      var lightboxClose = lightbox.querySelector('.image-lightbox-close');

      function openLightbox(src, alt) {
        lightboxImg.src = src;
        lightboxImg.alt = alt || '';
        lightbox.classList.add('is-open');
        document.body.style.overflow = 'hidden';
        lucide.createIcons();
      }

      function closeLightbox() {
        lightbox.classList.remove('is-open');
        document.body.style.overflow = '';
        lightboxImg.src = '';
      }

      zoomableImages.forEach(function (img) {
        img.classList.add('post-img-zoomable');
        img.addEventListener('click', function () {
          openLightbox(img.currentSrc || img.src, img.alt);
        });
      });

      lightbox.addEventListener('click', function (e) {
        if (e.target === lightbox || e.target === lightboxClose) closeLightbox();
      });

      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && lightbox.classList.contains('is-open')) closeLightbox();
      });
    }
  }

  lucide.createIcons();
});

// CTA 点击上报 → GA4 事件 blog_cta_click
// 博客直连 gtag.js（G-4DECHYKQVT），页面上没有 GTM 容器，所以不能靠 GTM 触发器，
// 在这里监听所有带 data-cta 的链接。window.gtag 在 layout.ejs 的 head 里同步定义，
// gtag.js 延迟加载前的点击会先排进 dataLayer，不会丢。
// 文章是哪篇不用单独传：GA4 每个事件自动带 page_location。
(function () {
  if (window.location.hostname !== 'www.modellix.ai') return;
  document.addEventListener('click', function (e) {
    var el = e.target && e.target.closest ? e.target.closest('[data-cta]') : null;
    if (!el || typeof window.gtag !== 'function') return;
    window.gtag('event', 'blog_cta_click', {
      cta_type: el.getAttribute('data-cta') || '',
      cta_campaign: el.getAttribute('data-cta-campaign') || '',
      cta_target: el.getAttribute('data-cta-target') || '',
      link_url: el.href || '',
      transport_type: 'beacon'
    });
  }, true);
})();
