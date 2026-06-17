/* ==========================================================================
   brmbh site — motion, interactivity, copy-to-clipboard, nav
   Progressive enhancement: everything works without JS; this only adds polish.
   Motion choices follow web-motion / Disney-12 principles (see comments).
   ========================================================================== */

(() => {
  'use strict';

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- comet travelling the container rails (one per section) ---------- */
  // Blue comet glides down the left rail + up the right rail of each section,
  // staggered between sections. Speed is constant (duration = height / speed).
  if (!prefersReduced) {
    const SPEED = 70; // px per second
    document.querySelectorAll('.section').forEach((sec, i) => {
      const rails = document.createElement('div');
      rails.className = 'rails';
      rails.setAttribute('aria-hidden', 'true');
      rails.innerHTML = '<span class="comet comet--down"></span><span class="comet comet--up"></span>';
      sec.prepend(rails);
      rails.style.setProperty('--delay', (-1.6 * i).toFixed(2) + 's');
      const sync = () => {
        const h = sec.clientHeight;
        rails.style.setProperty('--h', h + 'px');
        rails.style.setProperty('--dur', Math.max(4, h / SPEED).toFixed(2) + 's');
      };
      sync();
      if (window.ResizeObserver) new ResizeObserver(sync).observe(sec);
    });
  }

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
      'block.json': { role: 'agent-built', desc: "Registers the block with WordPress. The agent wrote it — standard format, nothing custom to learn." },
      'fields.php': { role: 'agent-built', desc: "The fields your editor fills in. The agent shaped these to match your design." },
      'template.php': { role: 'agent-built', desc: "The block's markup, written by the agent from your design. Plain PHP and Bootstrap — readable, and yours to tweak." },
      '_style.scss': { role: 'agent-built', desc: "The block's styling. Mostly Bootstrap utilities, scoped to this block, written for you." },
      'loader.php': { role: 'Block factory', desc: "Finds every block folder and registers it automatically — it's why a new block just works." },
      'inc/scaffold.php': { role: 'Theme setup', desc: "Sets up your starter pages and menus the first time you activate the theme." },
      'inc/block-patterns.php': { role: 'Editor', desc: "Ready-made section layouts your editors drop in — no code, no class names." },
      'inc/post-types/speaker.php': { role: 'Content type', desc: "A custom content type — speakers, projects, whatever you need — kept in one tidy file." },
      'inc/dependencies.php': { role: 'Theme setup', desc: "Checks that ACF Pro is active, and warns you clearly if it isn't." },
      'template-parts/content.php': { role: 'Partial', desc: "A reusable chunk of markup — the standard WordPress way to stay tidy." },
      'assets/src/scss/style.scss': { role: 'Styles', desc: "Where your styles start. Compiles down to a single stylesheet." },
      'assets/src/scss/_tokens.scss': { role: 'Design tokens', desc: "Your colors, spacing and radii — kept in step with Figma." },
      'AGENTS/create-block.md': { role: 'Agent skill', desc: "The playbook your AI editor follows to build a block from a design. This is the magic." },
      'AGENTS/deploy.md': { role: 'Agent skill', desc: "The playbook your AI editor follows to ship the site." },
      'tools/deploy.sh': { role: 'Ops', desc: "Ships your theme to staging or production over SSH." },
      'tools/sync-tokens.mjs': { role: 'Build tool', desc: "Pulls your Figma variables into the project — no copy-pasting hex codes." },
      'style.css': { role: 'Required by WP', desc: "Your theme's name card — title, version, author. WordPress needs it to exist." },
      'functions.php': { role: 'Theme setup', desc: "Wires everything together when the theme loads." },
      'index.php': { role: 'Template', desc: "The catch-all template WordPress falls back to." },
      'front-page.php': { role: 'Template', desc: "Your homepage — built from blocks." },
      'header.php': { role: 'Template', desc: "The top of every page — the document head and your navigation." },
      'footer.php': { role: 'Template', desc: "The bottom of every page — footer menu and closing scripts." },
      'page.php': { role: 'Template', desc: "The template behind your static pages." },
      'single.php': { role: 'Template', desc: "The template behind a single post." },
      '404.php': { role: 'Template', desc: "The friendly not-found page." },
      'theme.json': { role: 'Guardrails', desc: "Locks the editor to your design system — set widths, no rogue colors." },
      'package.json': { role: 'Build', desc: "The build setup — scripts that compile your CSS and JS." },
      'screenshot.png': { role: 'Asset', desc: "The little preview WordPress shows in the theme picker." },
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
