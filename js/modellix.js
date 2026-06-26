document.addEventListener('DOMContentLoaded', function () {
  var ICON_RESET_DELAY = 2000;
  var TOC_CLICK_LOCK = 800;
  var headerOffset = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--header-height')) || 72;

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

  lucide.createIcons();
});
