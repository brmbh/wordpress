/* ==========================================================================
   brmbh site — motion, interactivity, copy-to-clipboard, nav
   Progressive enhancement: everything works without JS; this only adds polish.
   Motion choices follow web-motion / Disney-12 principles (see comments).
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

  /* ---- file-tree sidebar: collapsible folders + per-file info ----------- */
  const ide = document.querySelector('[data-ide]');
  if (ide) {
    // What each file is — shown in the info pane on click (role + one line).
    const INFO = {
      'block.json': { role: 'ACF block', desc: "WordPress-standard block registration. Drop a folder with this in and the factory registers the block — apiVersion 2 with in-canvas editing." },
      'fields.php': { role: 'ACF block', desc: "The ACF field group, returned as an array and auto-registered on acf/init. Defines exactly what the editor fills in." },
      'template.php': { role: 'ACF block', desc: "The block's server render. Plain PHP with Bootstrap utilities and design tokens — no hardcoded colors or pixel sizes." },
      '_style.scss': { role: 'ACF block', desc: "Block-scoped styles, auto-imported via _loader.scss. Prefer Bootstrap utilities; only add what they can't express." },
      'loader.php': { role: 'Block factory', desc: "Scans my-acf-blocks/* and self-registers every folder that has a block.json. No manual wiring, ever." },
      'inc/scaffold.php': { role: 'Theme logic', desc: "Idempotent first-run setup — creates starter pages and menus on activation. Safe to re-run any time." },
      'inc/block-patterns.php': { role: 'Theme logic', desc: "Registers native Gutenberg section patterns, so editors compose layouts without typing a single Bootstrap class." },
      'inc/post-types/speaker.php': { role: 'Custom post type', desc: "One file per entity: the CPT, its ACF fields, and helpers. Blocks reference it through an ACF relationship field." },
      'inc/dependencies.php': { role: 'Theme logic', desc: "Declares the hard dependency on ACF Pro and shows an admin notice if it is missing." },
      'template-parts/content.php': { role: 'Partial', desc: "A reusable content partial, pulled in with get_template_part(). Standard WordPress composition." },
      'assets/src/scss/style.scss': { role: 'Styles', desc: "The SCSS entry point, compiled to assets/dist by the build. Imports tokens, variables, and every block's styles." },
      'assets/src/scss/_tokens.scss': { role: 'Design tokens', desc: "Design tokens as CSS custom properties, synced from Figma Variables — the single source of truth for spacing, color and radius." },
      'AGENTS/create-block.md': { role: 'Agent skill', desc: "The skill for building a block from a Figma frame or screenshot. Canonical source — Claude, Cursor and Windsurf wrappers are generated from it." },
      'AGENTS/deploy.md': { role: 'Agent skill', desc: "The skill for shipping the built theme to a remote environment over SSH." },
      'tools/deploy.sh': { role: 'Ops', desc: "Rsync deploy. Reads a per-environment env file and pushes the built theme — works even with IP-restricted hosts CI can't reach." },
      'tools/sync-tokens.mjs': { role: 'Build tool', desc: "Pulls Figma Variables into _tokens.scss through the Figma MCP. Deterministic — no LLM in this path." },
      'style.css': { role: 'Required by WP', desc: "The header comment here is the theme's identity — name, version, author, license — shown in Appearance." },
      'functions.php': { role: 'Theme setup', desc: "Theme bootstrap: registers theme supports and menus, and wires up the block factory, scaffold, and dependency checks." },
      'index.php': { role: 'Template', desc: "Required fallback in the template hierarchy. Renders the main query." },
      'front-page.php': { role: 'Template', desc: "The homepage — composed entirely from ACF blocks and native section patterns." },
      'header.php': { role: 'Template', desc: "Opening markup and wp_head(). Outputs the document head and the primary navigation." },
      'footer.php': { role: 'Template', desc: "Closing markup, the footer menu, and wp_footer()." },
      'page.php': { role: 'Template', desc: "Template for static pages, using the constrained block layout." },
      'single.php': { role: 'Template', desc: "Template for a single post." },
      '404.php': { role: 'Template', desc: "The not-found template." },
      'theme.json': { role: 'Editor config', desc: "Global editor settings — content width, and locking down custom colors and font sizes so the design system holds." },
      'package.json': { role: 'Build', desc: "The build toolchain — npm scripts that compile SCSS and bundle JS with webpack." },
      'screenshot.png': { role: 'Asset', desc: "The theme thumbnail shown in Appearance → Themes." },
    };

    const nameEl = ide.querySelector('[data-info-name]');
    const roleEl = ide.querySelector('[data-info-role]');
    const descEl = ide.querySelector('[data-info-desc]');
    const noteEl = ide.querySelector('[data-info-note]');
    const infoPane = ide.querySelector('[data-ide-info]');

    const showInfo = (row) => {
      ide.querySelectorAll('.ft-file').forEach((f) => f.classList.remove('is-active'));
      row.classList.add('is-active');
      const info = INFO[row.getAttribute('data-file')] || { role: '', desc: '' };
      nameEl.textContent = row.querySelector('.ft-name').textContent;
      roleEl.textContent = info.role;
      roleEl.hidden = !info.role;
      descEl.textContent = info.desc;
      noteEl.hidden = !row.hasAttribute('data-agent');
      if (infoPane && window.gsap && !prefersReduced) {
        window.gsap.fromTo(infoPane, { opacity: 0.35, y: 6 }, { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out' });
      }
    };

    const collapseByDefault = ['inc', 'template-parts', 'assets/src/scss', 'AGENTS', 'tools'];
    ide.querySelectorAll('.ft-folder').forEach((f) => {
      const kids = f.nextElementSibling;
      const hasKids = kids && kids.classList.contains('ft-children');
      if (hasKids && collapseByDefault.includes(f.querySelector('.ft-name').textContent)) {
        f.classList.add('is-collapsed');
        kids.classList.add('is-collapsed');
      }
      f.addEventListener('click', () => {
        if (hasKids) {
          f.classList.toggle('is-collapsed');
          kids.classList.toggle('is-collapsed');
        }
      });
    });
    ide.querySelectorAll('.ft-file').forEach((f) => f.addEventListener('click', () => showInfo(f)));

    const def = ide.querySelector('[data-file="template.php"]');
    if (def) showInfo(def);
  }

  /* ---- copy-to-clipboard ------------------------------------------------ */
  // Handles: .copy buttons inside [data-copy] hosts, <pre data-copy> blocks
  // (button injected), and inline .copycode chips (the chip itself copies).
  function flash(el, cls, ms = 1400) {
    el.classList.add(cls);
    setTimeout(() => el.classList.remove(cls), ms);
  }
  function doCopy(text) {
    return navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject();
  }
  document.querySelectorAll('[data-copy]').forEach((host) => {
    const text = host.getAttribute('data-copy');

    if (host.classList.contains('copycode')) {
      host.addEventListener('click', () => doCopy(text).then(() => flash(host, 'copied')).catch(() => {}));
      return;
    }
    let btn = host.querySelector('.copy');
    if (!btn && host.tagName === 'PRE') {
      btn = document.createElement('button');
      btn.className = 'copy';
      btn.type = 'button';
      btn.textContent = 'Copy';
      host.appendChild(btn);
    }
    if (!btn) return;
    btn.addEventListener('click', () => {
      doCopy(text)
        .then(() => {
          const prev = btn.textContent;
          btn.textContent = 'Copied';
          flash(btn, 'copied');
          setTimeout(() => (btn.textContent = prev), 1400);
        })
        .catch(() => (btn.textContent = 'Press ⌘C'));
    });
  });

  /* ---- hero typewriter (cycles example agent prompts) ------------------- */
  // Timing principle 7: type ~40ms/char, hold 1.6s, erase faster. Reduced
  // motion leaves the static first prompt in place.
  const tw = document.querySelector('[data-typewriter]');
  if (tw && !prefersReduced) {
    let items;
    try { items = JSON.parse(tw.getAttribute('data-typewriter')); } catch { items = null; }
    if (items && items.length) {
      let i = 0;
      const type = (text, done) => {
        let n = 0;
        (function step() {
          tw.textContent = text.slice(0, n);
          if (n++ <= text.length) setTimeout(step, 36 + Math.random() * 36);
          else setTimeout(done, 1700);
        })();
      };
      const erase = (text, done) => {
        let n = text.length;
        (function step() {
          tw.textContent = text.slice(0, n);
          if (n-- >= 0) setTimeout(step, 20);
          else done();
        })();
      };
      const loop = () => {
        const text = items[i % items.length];
        type(text, () => erase(text, () => { i++; loop(); }));
      };
      // start from the already-rendered first phrase: erase it, then cycle
      erase(items[0], () => { i = 1; loop(); });
    }
  }

  /* ---- interactive levels (L1/L2/L3) ----------------------------------- */
  document.querySelectorAll('[data-levels]').forEach((root) => {
    const tabs = root.querySelectorAll('.levels__tab');
    const panels = root.querySelectorAll('.levels__panel');
    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        const lvl = tab.getAttribute('data-level');
        tabs.forEach((t) => t.classList.toggle('is-active', t === tab));
        panels.forEach((p) => {
          const on = p.getAttribute('data-panel') === lvl;
          p.classList.toggle('is-active', on);
          if (on && window.gsap && !prefersReduced) {
            // secondary action (principle 6): gentle settle on switch
            window.gsap.fromTo(p, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' });
          }
        });
      });
    });
  });

  /* ---- reveal-on-scroll ------------------------------------------------- */
  const reveals = document.querySelectorAll('[data-reveal]');
  document.documentElement.classList.add('reveal-ready');

  function enableIconHover() { document.documentElement.classList.add('icons-ready'); }

  if (prefersReduced || !reveals.length) {
    reveals.forEach((el) => el.classList.add('is-in'));
    enableIconHover();
  } else if (window.gsap) {
    const gsap = window.gsap;
    if (window.ScrollTrigger) gsap.registerPlugin(window.ScrollTrigger);

    reveals.forEach((el) => {
      gsap.to(el, {
        opacity: 1,
        y: 0,
        duration: 0.7,
        ease: 'power3.out', // slow-out: decelerate into rest (principle 1)
        scrollTrigger: window.ScrollTrigger ? { trigger: el, start: 'top 88%', once: true } : undefined,
      });
    });

    /* ---- feature-grid icon motion (web-motion principles) -------------- */
    // Staging (5) + follow-through (3): staggered. Exaggeration (8) +
    // slow-out (1): back.out overshoot so each shape "pops" then settles.
    const icons = gsap.utils.toArray('.cell__icon span');
    if (icons.length) {
      gsap.set(icons, { scale: 0, rotate: -35, opacity: 0, transformOrigin: 'center' });
      gsap.to(icons, {
        scale: 1,
        rotate: 0,
        opacity: 1,
        duration: 0.7,
        ease: 'back.out(1.7)',
        stagger: { each: 0.08, from: 'start' },
        scrollTrigger: window.ScrollTrigger ? { trigger: '.grid', start: 'top 78%', once: true } : undefined,
        onComplete: () => {
          // clear inline transform so the CSS :hover transform can take over
          gsap.set(icons, { clearProps: 'transform' });
          enableIconHover();
        },
      });
      // safety: if ScrollTrigger never fires (e.g. grid above fold edge), reveal anyway
      if (!window.ScrollTrigger) enableIconHover();
    } else {
      enableIconHover();
    }
  } else {
    // no GSAP (offline / CDN blocked): IntersectionObserver fallback
    enableIconHover();
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
