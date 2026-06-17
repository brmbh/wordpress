/* ==========================================================================
   brmbh site — motion, copy-to-clipboard, nav, docs scrollspy
   Progressive enhancement: everything works without JS; this only adds polish.
   ========================================================================== */

(() => {
  'use strict';

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- mobile nav toggle ------------------------------------------------ */
  const toggle = document.querySelector('[data-nav-toggle]');
  const nav = document.querySelector('[data-nav]');
  if (toggle && nav) {
    toggle.addEventListener('click', () => nav.classList.toggle('open'));
    nav.addEventListener('click', (e) => {
      if (e.target.tagName === 'A') nav.classList.remove('open');
    });
  }

  /* ---- copy-to-clipboard ------------------------------------------------ */
  // Buttons inside [data-copy] containers, or <pre data-copy> blocks.
  function wireCopy() {
    // explicit .cmd / button pairs
    document.querySelectorAll('[data-copy]').forEach((host) => {
      let btn = host.querySelector('.copy');
      // inject a copy button into <pre data-copy> blocks
      if (!btn && host.tagName === 'PRE') {
        btn = document.createElement('button');
        btn.className = 'copy';
        btn.type = 'button';
        btn.textContent = 'Copy';
        host.appendChild(btn);
      }
      if (!btn) return;
      btn.addEventListener('click', async () => {
        const text = host.getAttribute('data-copy');
        try {
          await navigator.clipboard.writeText(text);
          const prev = btn.textContent;
          btn.textContent = 'Copied';
          btn.classList.add('copied');
          setTimeout(() => {
            btn.textContent = prev;
            btn.classList.remove('copied');
          }, 1400);
        } catch {
          btn.textContent = 'Press ⌘C';
        }
      });
    });
  }
  wireCopy();

  /* ---- reveal-on-scroll ------------------------------------------------- */
  const reveals = document.querySelectorAll('[data-reveal]');
  document.documentElement.classList.add('reveal-ready');

  if (prefersReduced || !reveals.length) {
    reveals.forEach((el) => el.classList.add('is-in'));
  } else if (window.gsap) {
    // GSAP path: subtle staggered entrance, grouped by nearest section
    const gsap = window.gsap;
    if (window.ScrollTrigger) gsap.registerPlugin(window.ScrollTrigger);
    reveals.forEach((el) => {
      gsap.to(el, {
        opacity: 1,
        y: 0,
        duration: 0.7,
        ease: 'power3.out',
        scrollTrigger: window.ScrollTrigger ? { trigger: el, start: 'top 88%', once: true } : undefined,
      });
    });
  } else {
    // no GSAP (offline / CDN blocked): IntersectionObserver fallback
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('is-in');
            io.unobserve(e.target);
          }
        });
      },
      { rootMargin: '0px 0px -10% 0px' },
    );
    reveals.forEach((el) => io.observe(el));
  }

  /* ---- docs scrollspy --------------------------------------------------- */
  const sideLinks = Array.from(document.querySelectorAll('.docs-side a[href^="#"]'));
  if (sideLinks.length) {
    const map = new Map();
    sideLinks.forEach((a) => {
      const id = a.getAttribute('href').slice(1);
      const target = document.getElementById(id);
      if (target) map.set(target, a);
    });
    const spy = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            sideLinks.forEach((a) => a.classList.remove('active'));
            const link = map.get(entry.target);
            if (link) link.classList.add('active');
          }
        });
      },
      { rootMargin: '-10% 0px -75% 0px', threshold: 0 },
    );
    map.forEach((_link, target) => spy.observe(target));
  }
})();
