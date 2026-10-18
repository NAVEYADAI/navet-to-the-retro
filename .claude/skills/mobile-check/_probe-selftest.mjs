// node .claude/skills/mobile-check/_probe-selftest.mjs   (run from the repo root, after `cd frontend && npm i` has run)
// Loads a deliberately broken page at 375px and a clean one, and asserts the probe tells them apart.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(here, '../../../frontend/package.json'));
const { chromium } = require('@playwright/test');
const probe = fs.readFileSync(path.join(here, 'probe.js'), 'utf8');

const broken = `<body style="margin:0;font:14px sans-serif">
  <div style="display:flex;gap:8px"><button style="min-width:260px">first wide button</button><button style="min-width:260px">second wide button</button></div>
  <div style="width:100px;overflow:hidden;white-space:nowrap">this sentence is far too long for its box</div>
  <button style="width:20px;height:20px">x</button>
  <p style="font-size:9px">tiny</p>
  <button style="position:absolute;left:10px;top:60px;width:80px;height:40px">A</button>
  <button style="position:absolute;left:40px;top:70px;width:80px;height:40px">B</button>
</body>`;
const clean = `<body style="margin:0;font:14px sans-serif">
  <div style="display:flex;flex-wrap:wrap;gap:8px"><button style="height:40px;min-width:80px">One</button><button style="height:40px;min-width:80px">Two</button></div>
  <div style="overflow-x:auto;white-space:nowrap"><span style="display:inline-block;width:900px">scrolls on purpose</span></div>
  <p>fine text</p>
  <span style="display:inline-block;width:1px;height:1px;overflow:hidden;white-space:nowrap">visually hidden label</span>
</body>`;

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
  const run = async (html) => {
    await page.setContent(html);
    await page.addScriptTag({ content: probe });
    return page.evaluate(() => window.__mobileProbe());
  };

  const bad = await run(broken);
  const kinds = new Set(bad.issues.map((i) => i.kind));
  for (const k of ['page-overflow-x', 'offscreen', 'text-clipped', 'small-target', 'tiny-text', 'overlap']) {
    assert.ok(kinds.has(k), `broken page should report "${k}" — got ${[...kinds].join(', ')}`);
  }

  const good = await run(clean);
  assert.deepEqual(good.issues, [], `clean page should report nothing — got ${JSON.stringify(good.issues)}`);
  console.log(`probe selftest ok (${bad.issues.length} issues on the broken page, 0 on the clean one)`);
} finally {
  await browser.close();
}
