(() => {
  'use strict';
  console.log('[sociology-seminar] main.js v7 — Awwwards-grade motion');

  /* =========================================================
     OPENING: fonts-gated, mask-and-rise CSS timeline
     JS owns: fonts.ready gate, particle layer, skip/cleanup.
     ========================================================= */

  const OPENING_DURATION = 9800;
  const FADE_OUT_MS = 900;

  const opening = document.getElementById('opening');
  const site = document.getElementById('site');
  const skipBtn = document.getElementById('opening-skip');
  const canvas = document.getElementById('op-particles');
  let finished = false;
  let rafId = null;

  /* ---------- Pre-baked glow sprite (fast particles) ---------- */
  function makeGlowSprite(color) {
    const s = document.createElement('canvas');
    s.width = s.height = 48;
    const g = s.getContext('2d');
    const grad = g.createRadialGradient(24, 24, 0, 24, 24, 24);
    grad.addColorStop(0.0, color);
    grad.addColorStop(0.25, color.replace(/[\d.]+\)/, '0.5)'));
    grad.addColorStop(1.0, color.replace(/[\d.]+\)/, '0)'));
    g.fillStyle = grad;
    g.fillRect(0, 0, 48, 48);
    return s;
  }

  const glowGold = (typeof document !== 'undefined') ? makeGlowSprite('rgba(231, 212, 163, 0.95)') : null;
  const glowBlue = (typeof document !== 'undefined') ? makeGlowSprite('rgba(111, 169, 255, 0.95)') : null;

  const ctx = canvas ? canvas.getContext('2d', { alpha: true }) : null;
  let W = 0, H = 0, dpr = 1;
  let particles = [];

  function resizeCanvas() {
    if (!canvas || !ctx) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function seedParticles() {
    // Cap at 40 — research says 120 with shadowBlur kills frame rate
    const count = Math.min(40, Math.floor((W * H) / 38000));
    particles = [];
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * W,
        y: Math.random() * H,
        size: 14 + Math.random() * 18,   // visual size
        vx: (Math.random() - 0.5) * 0.08,
        vy: -0.08 - Math.random() * 0.14,
        life: Math.random(),
        speedLife: 0.0012 + Math.random() * 0.002,
        blue: Math.random() < 0.22,
      });
    }
  }

  function renderFrame() {
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life += p.speedLife;
      if (p.y < -30 || p.life > 1.2) {
        p.x = Math.random() * W;
        p.y = H + Math.random() * 30;
        p.life = 0;
      }
      const fade = Math.sin(p.life * Math.PI);
      if (fade <= 0) continue;
      ctx.globalAlpha = fade * (p.blue ? 0.45 : 0.75);
      const sprite = p.blue ? glowBlue : glowGold;
      const size = p.size;
      // drawImage is far cheaper than shadowBlur per frame
      ctx.drawImage(sprite, p.x - size / 2, p.y - size / 2, size, size);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    rafId = requestAnimationFrame(renderFrame);
  }

  function startParticles() {
    if (!canvas || !ctx) return;
    resizeCanvas();
    seedParticles();
    rafId = requestAnimationFrame(renderFrame);
    window.addEventListener('resize', () => { resizeCanvas(); seedParticles(); });
  }

  /* ---------- Gate on fonts ready, then arm .is-ready ---------- */
  function armOpening() {
    // Force a single paint before triggering, warms the GPU pipeline
    if (ctx) ctx.fillRect(0, 0, 1, 1);
    document.body.classList.add('is-ready');
    console.log('[sociology-seminar] opening armed');
    startParticles();
    setTimeout(() => finishOpening(FADE_OUT_MS), OPENING_DURATION + FADE_OUT_MS);
  }

  async function bootOpening() {
    try {
      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
      }
    } catch (_) { /* ignore */ }
    // Two raf cycles guarantees layout is settled
    requestAnimationFrame(() => requestAnimationFrame(armOpening));
  }

  /* ---------- Lifecycle ---------- */
  function revealSite() {
    if (!site) return;
    site.setAttribute('aria-hidden', 'false');
    requestAnimationFrame(() => site.classList.add('is-visible'));
  }

  function finishOpening(fadeMs) {
    if (finished) return;
    finished = true;
    if (opening) opening.classList.add('is-done');
    revealSite();
    // Strip will-change from type to release GPU layers
    opening && opening.querySelectorAll('.op-clip-in').forEach((el) => {
      el.style.willChange = 'auto';
    });
    setTimeout(() => {
      if (rafId) cancelAnimationFrame(rafId);
      if (opening && opening.parentNode) opening.parentNode.removeChild(opening);
    }, (fadeMs || FADE_OUT_MS) + 100);
  }

  if (skipBtn) skipBtn.addEventListener('click', () => finishOpening(400));
  document.addEventListener('keydown', (e) => {
    if (finished) return;
    if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      finishOpening(400);
    }
  });

  // Safety fallback: guarantee exit even if fonts.ready hangs
  setTimeout(() => {
    if (!document.body.classList.contains('is-ready')) {
      console.warn('[sociology-seminar] forcing is-ready (fonts hang)');
      armOpening();
    }
  }, 1500);
  setTimeout(() => { if (!finished) finishOpening(0); }, OPENING_DURATION + FADE_OUT_MS + 4000);

  /* =========================================================
     Main-site interactions
     ========================================================= */
  function setupReveal() {
    const targets = document.querySelectorAll(
      '.section, .hero__content, .book, .activity, .pillar, .about__card, .value, .section__header, .philosophy__quote, .creed__statement, .process__step, .faq__item'
    );
    targets.forEach((el) => el.setAttribute('data-reveal', ''));
    if (!('IntersectionObserver' in window)) {
      targets.forEach((el) => el.classList.add('is-in'));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });
    targets.forEach((el) => io.observe(el));
  }

  function setupSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach((a) => {
      a.addEventListener('click', (e) => {
        const id = a.getAttribute('href');
        if (!id || id === '#') return;
        const target = document.querySelector(id);
        if (!target) return;
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }

  function setupParallax() {
    const els = document.querySelectorAll('[data-parallax]');
    if (!els.length) return;
    let ticking = false;
    function update() {
      const y = window.scrollY;
      els.forEach((el) => {
        const speed = parseFloat(el.getAttribute('data-parallax') || '0.15');
        el.style.transform = `translate3d(0, ${y * speed}px, 0)`;
      });
      ticking = false;
    }
    window.addEventListener('scroll', () => {
      if (!ticking) { requestAnimationFrame(update); ticking = true; }
    }, { passive: true });
  }

  function setupNavShrink() {
    const nav = document.querySelector('.nav');
    if (!nav) return;
    const onScroll = () => nav.classList.toggle('is-scrolled', window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  function setupDotNav() {
    const dotnav = document.getElementById('dotnav');
    if (!dotnav || !('IntersectionObserver' in window)) return;
    const links = Array.from(dotnav.querySelectorAll('a'));
    const idToLink = new Map(
      links.map((l) => [l.getAttribute('href').slice(1), l])
    );
    const sectionIds = links
      .map((l) => l.getAttribute('href').slice(1))
      .filter((id) => document.getElementById(id));
    const sections = sectionIds.map((id) => document.getElementById(id));

    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const link = idToLink.get(entry.target.id);
        if (!link) return;
        if (entry.isIntersecting && entry.intersectionRatio > 0.35) {
          links.forEach((l) => l.classList.remove('is-active'));
          link.classList.add('is-active');
        }
      });
    }, { threshold: [0.35, 0.6], rootMargin: '-20% 0px -20% 0px' });

    sections.forEach((s) => io.observe(s));
  }

  function setupPageTransitions() {
    document.querySelectorAll('a[href$=".html"]').forEach((a) => {
      // Skip external, same-page, or target=_blank
      const href = a.getAttribute('href') || '';
      if (!href || href.startsWith('#') || a.target === '_blank' ||
          href.startsWith('http') || href.startsWith('//')) {
        return;
      }
      a.addEventListener('click', (e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey) return; // allow open-in-new-tab
        e.preventDefault();
        document.body.classList.add('is-leaving');
        // safety: still navigate even if animation hangs
        const go = () => { window.location.href = href; };
        setTimeout(go, 360);
      });
    });
  }

  function setupCustomCursor() {
    const cursor = document.getElementById('cursor');
    if (!cursor) return;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

    document.body.classList.add('has-cursor');
    const dot = cursor.querySelector('.cursor__dot');
    const ring = cursor.querySelector('.cursor__ring');

    let mx = window.innerWidth / 2, my = window.innerHeight / 2;
    let rx = mx, ry = my;

    document.addEventListener('mousemove', (e) => {
      mx = e.clientX; my = e.clientY;
      dot.style.transform = `translate3d(${mx}px, ${my}px, 0) translate3d(-50%, -50%, 0)`;
    }, { passive: true });

    function frame() {
      // Ring lerps for smooth trail
      rx += (mx - rx) * 0.18;
      ry += (my - ry) * 0.18;
      ring.style.transform = `translate3d(${rx}px, ${ry}px, 0) translate3d(-50%, -50%, 0)`;
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

    // Hover state on interactive elements
    const hoverSel = 'a, button, [role="button"], .voice, .theme, .activity, .book, .faq__item, .pillar, .about__card, .value, .process__step';
    document.querySelectorAll(hoverSel).forEach((el) => {
      el.addEventListener('pointerenter', () => cursor.classList.add('is-hover'));
      el.addEventListener('pointerleave', () => cursor.classList.remove('is-hover'));
    });

    document.addEventListener('mouseleave', () => cursor.classList.add('is-hidden'));
    document.addEventListener('mouseenter', () => cursor.classList.remove('is-hidden'));
  }

  function setupMobileDrawer() {
    const burger = document.getElementById('nav-burger');
    const drawer = document.getElementById('nav-drawer');
    const closeBtn = document.getElementById('nav-drawer-close');
    if (!burger || !drawer) return;

    function open() {
      drawer.classList.add('is-open');
      drawer.setAttribute('aria-hidden', 'false');
      burger.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
    }
    function close() {
      drawer.classList.remove('is-open');
      drawer.setAttribute('aria-hidden', 'true');
      burger.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    }
    burger.addEventListener('click', () => {
      drawer.classList.contains('is-open') ? close() : open();
    });
    closeBtn && closeBtn.addEventListener('click', close);
    drawer.querySelector('.nav-drawer__backdrop').addEventListener('click', close);
    drawer.querySelectorAll('a').forEach((a) => a.addEventListener('click', close));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && drawer.classList.contains('is-open')) close();
    });
  }

  function setupMagneticButtons() {
    const buttons = document.querySelectorAll('.btn');
    if (!buttons.length || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

    const STRENGTH_X = 0.14;   // gentle horizontal pull
    const STRENGTH_Y = 0.18;   // slightly stronger vertical
    const LERP = 0.18;         // settle speed (lower = smoother, slower)
    const EPSILON = 0.1;

    buttons.forEach((btn) => {
      btn.setAttribute('data-magnetic', '');
      let targetX = 0, targetY = 0;
      let curX = 0, curY = 0;
      let rafId = null;
      let active = false;

      function tick() {
        curX += (targetX - curX) * LERP;
        curY += (targetY - curY) * LERP;
        if (Math.abs(targetX - curX) < EPSILON && Math.abs(targetY - curY) < EPSILON) {
          curX = targetX; curY = targetY;
        }
        btn.style.transform = `translate3d(${curX.toFixed(2)}px, ${curY.toFixed(2)}px, 0)`;
        if (active || Math.abs(curX) > EPSILON || Math.abs(curY) > EPSILON) {
          rafId = requestAnimationFrame(tick);
        } else {
          btn.style.transform = '';
          rafId = null;
        }
      }

      function start() { if (!rafId) rafId = requestAnimationFrame(tick); }

      btn.addEventListener('pointerenter', () => {
        active = true;
        start();
      });
      btn.addEventListener('pointermove', (e) => {
        const rect = btn.getBoundingClientRect();
        targetX = (e.clientX - rect.left - rect.width / 2) * STRENGTH_X;
        targetY = (e.clientY - rect.top - rect.height / 2) * STRENGTH_Y;
      });
      btn.addEventListener('pointerleave', () => {
        active = false;
        targetX = 0; targetY = 0;
        start();
      });
    });
  }

  function setupCountUp() {
    const els = document.querySelectorAll('[data-count-to]');
    if (!els.length || !('IntersectionObserver' in window)) return;

    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        const target = parseInt(el.getAttribute('data-count-to'), 10);
        const suffix = el.getAttribute('data-count-suffix') || '';
        const duration = 1400;
        const start = performance.now();
        function frame(now) {
          const p = Math.min(1, (now - start) / duration);
          // easeOutExpo
          const eased = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
          const v = Math.round(target * eased);
          el.innerHTML = v + (suffix ? '<sup>' + suffix + '</sup>' : '');
          if (p < 1) requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
        io.unobserve(el);
      });
    }, { threshold: 0.5 });

    els.forEach((el) => io.observe(el));
  }

  function setupScrollProgress() {
    const bar = document.getElementById('scroll-progress');
    if (!bar) return;
    let ticking = false;
    function update() {
      const h = document.documentElement;
      const total = h.scrollHeight - h.clientHeight;
      const ratio = total > 0 ? (h.scrollTop || window.scrollY) / total : 0;
      bar.style.width = (Math.max(0, Math.min(1, ratio)) * 100).toFixed(2) + '%';
      ticking = false;
    }
    window.addEventListener('scroll', () => {
      if (!ticking) { requestAnimationFrame(update); ticking = true; }
    }, { passive: true });
    update();
  }

  function setYear() {
    const y = document.getElementById('year');
    if (y) y.textContent = String(new Date().getFullYear());
  }

  document.addEventListener('DOMContentLoaded', () => {
    setYear();
    setupReveal();
    setupSmoothScroll();
    setupParallax();
    setupNavShrink();
    setupScrollProgress();
    setupMobileDrawer();
    setupMagneticButtons();
    setupCountUp();
    setupCustomCursor();
    setupDotNav();
    setupPageTransitions();
    bootOpening();
  });
})();
