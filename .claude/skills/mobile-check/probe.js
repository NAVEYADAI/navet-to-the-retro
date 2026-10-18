// Injected into the page by the mobile-check template (page.addScriptTag). Defines window.__mobileProbe().
// Pure DOM inspection — no network, no mutation. Returns { viewport, issues: [{ kind, severity, where, detail }] }.
(() => {
  const MIN_TARGET = 32; // our own <Button> is 36px tall by design (minTouchTarget 44 − 8); below 32 is a real problem
  const MIN_FONT = 11; // smallest step in the type scale (overline)

  const describe = (el) => {
    const tag = el.tagName.toLowerCase();
    const label = el.getAttribute('aria-label') || el.getAttribute('placeholder') || (el.textContent || '').trim().replace(/\s+/g, ' ');
    const text = label ? ` “${label.slice(0, 40)}”` : '';
    const testId = el.getAttribute('data-testid') ? `[data-testid=${el.getAttribute('data-testid')}]` : '';
    return `${tag}${testId}${text}`;
  };

  const isVisible = (el) => {
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };

  // An element inside a horizontally scrollable region (carousel, table wrapper) may legitimately extend past the edge.
  const insideHScroll = (el) => {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const s = getComputedStyle(p);
      if ((s.overflowX === 'auto' || s.overflowX === 'scroll') && p.scrollWidth > p.clientWidth + 1) return true;
    }
    return false;
  };

  const insideFixedOrPortal = (el) => {
    for (let p = el; p && p !== document.body; p = p.parentElement) {
      if (getComputedStyle(p).position === 'fixed') return true;
    }
    return false;
  };

  window.__mobileProbe = () => {
    const vw = document.documentElement.clientWidth;
    const issues = [];
    const add = (kind, severity, el, detail) => issues.push({ kind, severity, where: el ? describe(el) : 'page', detail });

    // 1. the page itself scrolls sideways
    const docWidth = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
    if (docWidth > vw + 1) add('page-overflow-x', 'high', null, `content is ${docWidth}px wide in a ${vw}px viewport`);

    const all = Array.from(document.body.querySelectorAll('*')).filter(isVisible);
    let offscreen = 0;
    for (const el of all) {
      const r = el.getBoundingClientRect();

      // 2. something sticks out of the viewport
      if ((r.right > vw + 1 || r.left < -1) && !insideHScroll(el) && !insideFixedOrPortal(el)) {
        offscreen += 1;
        if (offscreen <= 8) add('offscreen', 'high', el, `spans ${Math.round(r.left)}→${Math.round(r.right)}px in a ${vw}px viewport`);
      }

      const s = getComputedStyle(el);

      // 3. text silently clipped (overflow hidden, no ellipsis)
      const hasOwnText = Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim());
      // (a box ≤ 8px wide is the "visually hidden" pattern — e.g. the navbar hides its labels on phones on purpose)
      if (hasOwnText && el.clientWidth > 8 && (s.overflowX === 'hidden' || s.overflow === 'hidden') && el.scrollWidth > el.clientWidth + 1 && s.textOverflow !== 'ellipsis') {
        add('text-clipped', 'high', el, `text is ${el.scrollWidth}px in a ${el.clientWidth}px box, no ellipsis`);
      }

      // 4. tiny text
      if (hasOwnText && parseFloat(s.fontSize) < MIN_FONT) add('tiny-text', 'medium', el, `font-size ${s.fontSize}`);
    }
    if (offscreen > 8) add('offscreen', 'high', null, `…and ${offscreen - 8} more elements outside the viewport`);

    // 5. touch targets
    const interactive = Array.from(document.body.querySelectorAll('button, a[href], [role="button"], input:not([type=hidden]), select, textarea, [role="switch"], [role="checkbox"]')).filter(isVisible);
    for (const el of interactive) {
      const r = el.getBoundingClientRect();
      if (r.width < MIN_TARGET || r.height < MIN_TARGET) add('small-target', 'medium', el, `${Math.round(r.width)}×${Math.round(r.height)}px (min ${MIN_TARGET})`);
    }

    // 6. interactive elements that sit on top of each other (a wrapped row that collapsed badly)
    const rects = interactive.map((el) => ({ el, r: el.getBoundingClientRect() }));
    let overlaps = 0;
    for (let i = 0; i < rects.length && overlaps < 5; i += 1) {
      for (let j = i + 1; j < rects.length && overlaps < 5; j += 1) {
        const a = rects[i];
        const b = rects[j];
        if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
        const w = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
        const h = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
        if (w > 4 && h > 4) {
          overlaps += 1;
          add('overlap', 'high', a.el, `overlaps ${describe(b.el)} by ${Math.round(w)}×${Math.round(h)}px`);
        }
      }
    }

    return { viewport: { width: vw, height: document.documentElement.clientHeight }, issues };
  };
})();
