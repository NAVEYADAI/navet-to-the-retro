import { chromium } from '@playwright/test';

// Expo's Metro web server compiles the JS bundle lazily on first request — the very first page
// load after webServer startup can take 20-30s, long enough to blow past a single test's 30s
// timeout (this is what caused retro-comment-filters.spec.ts to time out and its Chrome tab to
// drop its CDP session on a cold run, while the identical Mobile Chrome run right after — bundle
// already warm — finished in 7s). Load the page once here, outside any test's clock, so Metro
// finishes compiling before the timed tests start.
async function globalSetup() {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto('http://localhost:8086', { waitUntil: 'networkidle', timeout: 90_000 });
  } finally {
    await browser.close();
  }
}

export default globalSetup;
