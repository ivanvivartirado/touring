(function () {
  'use strict';
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Carpeta de la web (o del tema de WordPress), sacada de la ruta de este script
  var BASE = ((document.currentScript && document.currentScript.src) || '').replace(/js\/main\.js.*$/, '');

  /* ---------- Menú desplegable ---------- */
  (function () {
    var menu = $('#menu'), openBtn = $('#menu-open'), closeBtn = $('#menu-close');
    if (!menu || !openBtn || !closeBtn) return;
    function setOpen(open, teclado) {
      menu.hidden = !open;
      openBtn.setAttribute('aria-expanded', String(open));
      document.body.classList.toggle('is-locked', open);
      if (teclado) (open ? closeBtn : openBtn).focus();   // con el dedo o el raton no se deja el foco marcado
      else if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    }
    // e.detail === 0: el "clic" viene del teclado (Enter/Espacio)
    openBtn.addEventListener('click', function (e) { setOpen(true, e.detail === 0); });
    closeBtn.addEventListener('click', function (e) { setOpen(false, e.detail === 0); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !menu.hidden) setOpen(false, true); });
    // En escritorio el menu es un panel: un clic fuera lo cierra
    document.addEventListener('click', function (e) {
      if (!menu.hidden && !menu.contains(e.target) && !openBtn.contains(e.target)) setOpen(false);
    });
    menu.addEventListener('click', function (e) {
      var a = e.target.closest('a[href]');
      if (a) {
        menu.hidden = true; openBtn.setAttribute('aria-expanded', 'false'); document.body.classList.remove('is-locked');
      }
    });
  })();

  /* ---------- Portada: fotos que van cambiando ---------- */
  (function () {
    var root = $('[data-hero]'); if (!root) return;
    var slides = $$('.hero__slide', root); if (slides.length < 2 || reduce) return;
    var i = 0;
    setInterval(function () {
      if (document.hidden) return;
      var next = (i + 1) % slides.length, img = slides[next];
      if (!img.complete) { img.loading = 'eager'; return; }   // espera a que este cargada
      slides[i].classList.remove('is-active'); img.classList.add('is-active'); i = next;
    }, 5000);
    // cargar el resto de fotos cuando la pagina ya esta lista
    window.addEventListener('load', function () { slides.forEach(function (s) { s.loading = 'eager'; }); });
  })();

  /* ---------- Reseñas (carrusel) ---------- */
  (function () {
    var root = $('[data-reviews]'); if (!root) return;
    var track = $('.rev-track', root), slides = $$('.rev', track);
    var prev = $('.rev-btn--prev', root), next = $('.rev-btn--next', root);
    if (!slides.length) return;
    var idx = 0, timer = null, paused = false, inView = false, delay = 6000, st;
    function w() { return track.clientWidth || 1; }
    function go(i, smooth) {
      idx = (i + slides.length) % slides.length;
      track.scrollTo({ left: idx * w(), behavior: (smooth && !reduce) ? 'smooth' : 'auto' });
    }
    function stop() { if (timer) { clearInterval(timer); timer = null; } }
    function start() { stop(); if (reduce || paused || !inView || document.hidden) return; timer = setInterval(function () { go(idx + 1, true); }, delay); }
    function manual(d) { go(idx + d, true); start(); }
    next.addEventListener('click', function () { manual(1); });
    prev.addEventListener('click', function () { manual(-1); });
    root.addEventListener('keydown', function (e) { if (e.key === 'ArrowRight') manual(1); else if (e.key === 'ArrowLeft') manual(-1); });
    track.addEventListener('scroll', function () { clearTimeout(st); st = setTimeout(function () { idx = Math.round(track.scrollLeft / w()) || 0; }, 80); }, { passive: true });
    root.addEventListener('mouseenter', function () { paused = true; stop(); });
    root.addEventListener('mouseleave', function () { paused = false; start(); });
    root.addEventListener('focusin', function () { paused = true; stop(); });
    root.addEventListener('focusout', function () { paused = false; start(); });
    root.addEventListener('touchstart', function () { paused = true; stop(); }, { passive: true });
    root.addEventListener('touchend', function () { paused = false; start(); }, { passive: true });
    document.addEventListener('visibilitychange', start);
    window.addEventListener('resize', function () { go(idx, false); checkClamp(); });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (en) { inView = en[0].isIntersecting; start(); }, { threshold: 0.3 }).observe(root);
    } else { inView = true; start(); }
    // "Leer más" solo si el texto no cabe
    function checkClamp() {
      slides.forEach(function (s) {
        var t = $('.rev__text', s), b = $('.rev__more', s); if (!t || !b) return;
        if (s.classList.contains('is-open')) { b.hidden = false; return; }
        b.hidden = !(t.scrollHeight > t.clientHeight + 1);
      });
    }
    root.addEventListener('click', function (e) {
      var b = e.target.closest('.rev__more'); if (!b) return;
      var s = b.closest('.rev'), open = s.classList.toggle('is-open');
      b.textContent = open ? 'Ocultar' : 'Leer más'; b.setAttribute('aria-expanded', String(open));
    });
    // Fotos de perfil de Google: si alguna deja de cargar, se pone la inicial
    $$('img.rev__av[data-ini]', root).forEach(function (img) {
      function ini() { var s = document.createElement('span'); s.className = 'rev__ini'; s.setAttribute('aria-hidden', 'true'); s.textContent = img.getAttribute('data-ini'); img.replaceWith(s); }
      if (img.complete && !img.naturalWidth) ini(); else img.addEventListener('error', ini);
    });
    // Fotos adjuntas a las resenas: se esconden si fallan y se amplian al pulsarlas
    $$('.rev__photos img', root).forEach(function (img) {
      function quitar() { var a = img.parentNode, box = a.parentNode; a.remove(); if (!box.children.length) box.remove(); }
      if (img.complete && !img.naturalWidth) quitar(); else img.addEventListener('error', quitar);
    });
    var lb = null;
    root.addEventListener('click', function (e) {
      var a = e.target.closest('.rev__photos a'); if (!a || typeof HTMLDialogElement !== 'function') return;
      e.preventDefault();
      if (!lb) {
        lb = document.createElement('dialog'); lb.className = 'lightbox';
        lb.innerHTML = '<img alt=""><button type="button" aria-label="Cerrar">×</button>';
        lb.addEventListener('click', function (ev) { if (ev.target === lb || ev.target.tagName === 'BUTTON') lb.close(); });
        document.body.appendChild(lb);
      }
      var im = lb.querySelector('img'); im.referrerPolicy = 'no-referrer'; im.src = a.href; im.alt = a.querySelector('img').alt;
      lb.showModal();
    });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(checkClamp);
    window.addEventListener('load', checkClamp); checkClamp();
  })();

  /* ---------- Imágenes con cadena de reserva (local -> web real -> recorte) ---------- */
  $$('img[data-fallbacks]').forEach(function (img) {
    var list = img.getAttribute('data-fallbacks').split('|').filter(Boolean), i = 0;
    img.addEventListener('error', function () { if (i < list.length) { img.src = list[i++]; } });
    if (img.complete && img.naturalWidth === 0 && i < list.length) { img.src = list[i++]; }
  });

  /* ---------- Feed de Instagram (Behold) ---------- */
  (function () {
    var root = $('#tg-instagram'); if (!root) return;
    // Ultimas publicaciones: tools/actualizar-instagram.py deja las fotos en assets/instagram/ y su texto en posts.json
    fetch(BASE + 'assets/instagram/posts.json', { cache: 'no-store' }).then(function (r) { if (!r.ok) throw 0; return r.json(); })
      .then(function (posts) {
        $$('.ig__grid a', root).forEach(function (a, i) {
          var p = posts[i], im = $('img', a); if (!p || !im) return;
          im.src = BASE + p.img + '?v=' + p.v; im.alt = p.alt;
          a.setAttribute('aria-label', 'Ver Instagram de Touring: ' + p.alt);
        });
      }).catch(function () { /* se quedan las fotos que haya */ });
    var url = (root.getAttribute('data-feed-url') || '').trim(); if (!url) return embed();
    var grid = $('.ig__grid', root); if (!grid) return;
    fetch(url, { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (d) {
        var posts = ((d && d.posts) || []).filter(function (p) { return p && p.permalink; }).slice(0, 6), frag = document.createDocumentFragment();
        posts.forEach(function (p) {
          var s = p.sizes || {};
          var src = (s.medium && s.medium.mediaUrl) || (s.large && s.large.mediaUrl) || (s.small && s.small.mediaUrl) || p.thumbnailUrl || (p.mediaType !== 'VIDEO' ? p.mediaUrl : '');
          if (!src) return;
          var a = document.createElement('a'); a.href = p.permalink; a.target = '_blank'; a.rel = 'noopener';
          var im = document.createElement('img'); im.src = src; im.loading = 'lazy'; im.alt = (p.caption || 'Publicació d\u2019Instagram').replace(/\s+/g, ' ').slice(0, 110);
          a.appendChild(im); frag.appendChild(a);
        });
        if (frag.childNodes.length) { grid.innerHTML = ''; grid.appendChild(frag); var n = $('.ig__note', root); if (n) n.hidden = true; }
      }).catch(function () { /* se quedan las fotos de muestra */ });

    // Sin Behold: embed publico del perfil (ultimas 6 publicaciones, sin cuentas ni claves).
    // Instagram avisa con postMessage: "MOUNTED" al cargar y "MEASURE" con su altura. Si no responde, se quedan las fotos de muestra.
    function embed() {
      var src = root.getAttribute('data-embed'), box = $('.ig__embed', root), card = $('.ig__card', root);
      if (!src || !box) return;
      var frame = null, ok = false;
      function load() {
        frame = document.createElement('iframe');
        frame.src = src; frame.title = 'Últimas publicaciones de Instagram de Touring Autoescola';
        frame.setAttribute('scrolling', 'no'); frame.setAttribute('allowtransparency', 'true');
        box.appendChild(frame);
        setTimeout(function () { if (!ok) box.parentNode.removeChild(box); }, 15000);
      }
      window.addEventListener('message', function (e) {
        if (!frame || e.source !== frame.contentWindow || !/^https:\/\/www\.instagram\.com$/.test(e.origin)) return;
        var d = e.data; if (typeof d === 'string') { try { d = JSON.parse(d); } catch (x) { return; } }
        if (!d || !d.type) return;
        if (d.type === 'MOUNTED' && !ok) {   // ya hay perfil: se muestra con una altura provisional
          ok = true; box.classList.remove('is-loading'); if (card) card.hidden = true;
          frame.style.height = Math.round(box.clientWidth * 2 / 3 + 175) + 'px';
        }
        var h = d.type === 'MEASURE' && d.details && d.details.height;
        if (ok && h > 200) frame.style.height = Math.ceil(h) + 'px';
      });
      if ('IntersectionObserver' in window) {
        var io = new IntersectionObserver(function (en) { if (en[0].isIntersecting) { io.disconnect(); load(); } }, { rootMargin: '800px 0px' });
        io.observe(root);
      } else load();
    }
  })();

  /* ---------- Galería ---------- */
  (function () {
    var root = $('[data-gallery]'); if (!root) return;
    var st = $('.gallery__stage', root), stage = $('img', st), thumbs = $('.gallery__thumbs', root);
    var N = 18, V = '?v=3';   // fotos en assets/gallery/1.jpg ... 18.jpg (V: subirlo si se cambian las fotos)
    var local = [], fb = [], i;
    for (i = 1; i <= N; i++) local.push({ src: BASE + 'assets/gallery/' + i + '.jpg' + V, alt: 'Galería de Touring, foto ' + i });
    for (i = 1; i <= 4; i++) fb.push({ src: BASE + 'assets/gallery/fallback-' + i + '.jpg', alt: 'Touring, foto ' + i });
    var items = [], cur = 0, timer = null;
    function probe(src, cb) { var im = new Image(); im.onload = function () { cb(true); }; im.onerror = function () { cb(false); }; im.src = src; }
    function pick(lists, k) {
      if (k >= lists.length) return init(fb);
      probe(lists[k][0].src, function (ok) { if (ok) init(lists[k]); else pick(lists, k + 1); });
    }
    function show(n, smooth) {
      cur = (n + items.length) % items.length;
      stage.src = items[cur].src; stage.alt = items[cur].alt;
      st.style.setProperty('--foto', 'url("' + items[cur].src + '")');   // fondo desenfocado
      $$('button', thumbs).forEach(function (b, j) {
        b.setAttribute('aria-current', String(j === cur));
        if (j === cur) { try { thumbs.scrollTo({ left: b.offsetLeft - thumbs.clientWidth / 2 + b.clientWidth / 2, behavior: (smooth && !reduce) ? 'smooth' : 'auto' }); } catch (e) {} }
      });
    }
    function init(list) {
      items = list; thumbs.innerHTML = '';
      list.forEach(function (it, j) {
        var li = document.createElement('li'), b = document.createElement('button'), im = document.createElement('img');
        b.type = 'button'; b.setAttribute('aria-label', 'Ver foto ' + (j + 1)); im.src = it.src; im.alt = ''; im.loading = 'lazy';
        b.appendChild(im); li.appendChild(b); thumbs.appendChild(li);
        b.addEventListener('click', function () { show(j, true); });
      });
      show(0, false);
    }
    root.addEventListener('keydown', function (e) { if (e.key === 'ArrowRight') show(cur + 1, true); else if (e.key === 'ArrowLeft') show(cur - 1, true); });
    // Foto grande: arrastrar/deslizar (raton y dedo) o pulsar en un lado
    var sx = null;
    st.addEventListener('pointerdown', function (e) { sx = e.clientX; st.classList.add('is-dragging'); });
    st.addEventListener('pointerup', function (e) {
      if (sx === null) return;
      var dx = e.clientX - sx, r = st.getBoundingClientRect(); sx = null; st.classList.remove('is-dragging');
      if (Math.abs(dx) > 40) show(cur + (dx < 0 ? 1 : -1), true);                 // arrastre
      else show(cur + (e.clientX > r.left + r.width / 2 ? 1 : -1), true);         // clic o toque en un lado
    });
    // Botones pequenos (solo se ven con raton): no cuentan como clic en la foto
    $$('.gallery__nav', st).forEach(function (b) {
      b.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
      b.addEventListener('pointerup', function (e) { e.stopPropagation(); });
      b.addEventListener('click', function () { show(cur + (b.classList.contains('gallery__nav--next') ? 1 : -1), true); });
    });
    st.addEventListener('pointercancel', function () { sx = null; st.classList.remove('is-dragging'); });
    st.addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse') return;
      var r = st.getBoundingClientRect(), der = e.clientX > r.left + r.width / 2;
      st.classList.toggle('is-right', der); st.classList.toggle('is-left', !der);
    });
    // Miniaturas: con el raton se arrastran (sin barra de desplazamiento)
    var tx = null, tl = 0, movido = false;
    thumbs.addEventListener('pointerdown', function (e) { if (e.pointerType !== 'mouse') return; tx = e.clientX; tl = thumbs.scrollLeft; movido = false; });
    window.addEventListener('pointermove', function (e) {
      if (tx === null) return;
      var dx = e.clientX - tx; if (Math.abs(dx) > 5) { movido = true; thumbs.classList.add('is-dragging'); }
      thumbs.scrollLeft = tl - dx;
    });
    window.addEventListener('pointerup', function () { tx = null; thumbs.classList.remove('is-dragging'); });
    thumbs.addEventListener('click', function (e) { if (movido) { e.stopPropagation(); e.preventDefault(); movido = false; } }, true);
    pick([local], 0);
  })();

  /* ---------- Formulario ---------- */
  (function () {
    var form = $('#form-contacto'); if (!form) return;
    // desplegables con opciones tipo radio
    $$('.dd', form).forEach(function (dd) {
      var val = $('.dd__value', dd), ph = val.getAttribute('data-ph') || '';
      dd.addEventListener('change', function (e) {
        if (e.target.type === 'radio') { val.textContent = e.target.value; dd.open = false; }
      });
      document.addEventListener('click', function (e) { if (dd.open && !dd.contains(e.target)) dd.open = false; });
      val.textContent = ph;
    });
    var err = $('.form__err', form), btn = $('.btn-send', form), thanks = $('#gracias'), endpoint = (form.getAttribute('data-endpoint') || '').trim();
    function done() {
      form.hidden = true; $('.form-intro') && ($('.form-intro').hidden = true);
      thanks.hidden = false; var demo = $('.thanks__demo', thanks); if (demo) demo.hidden = !!endpoint;
      thanks.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    }
    form.addEventListener('submit', function (e) {
      e.preventDefault(); err.hidden = true;
      if ($('.hp input', form).value) return; // anti-spam
      if (!endpoint) { done(); return; }
      btn.disabled = true;
      fetch(endpoint, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } })
        .then(function (r) { if (!r.ok) throw new Error(r.status); done(); })
        .catch(function () { err.textContent = 'No hemos podido enviar el formulario. Prueba otra vez o escríbenos por WhatsApp.'; err.hidden = false; })
        .then(function () { btn.disabled = false; });
    });
  })();
})();
