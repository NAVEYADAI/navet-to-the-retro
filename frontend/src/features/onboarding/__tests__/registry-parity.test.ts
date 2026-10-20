import fs from 'node:fs';
import path from 'node:path';
import { Strings } from '@/constants/strings';
import { FEATURE_REGISTRY } from '../registry';

// Implementation standard (product-backlog/README.md): the frontend registry and the backend's
// (backend/src/onboarding/onboarding-features.ts) must list the same keys, audiences and dates, and
// every entry needs its texts — otherwise a feature would be announced without a title, or never.
const backendSource = fs.readFileSync(path.resolve(__dirname, '../../../../../backend/src/onboarding/onboarding-features.ts'), 'utf8');
const backend = Array.from(backendSource.matchAll(/\{ key: '([^']+)', audience: '([^']+)', since: '([^']+)' \}/g))
  .map((m) => ({ key: m[1], audience: m[2], since: m[3] }));

describe('feature registry parity (frontend vs backend)', () => {
  it('reads the backend registry (guards the regex against silently matching nothing)', () => {
    expect(backend.length).toBeGreaterThanOrEqual(7);
  });

  it('has the same keys, audiences and dates, in the same order', () => {
    expect(FEATURE_REGISTRY.map(({ key, audience, since }) => ({ key, audience, since }))).toEqual(backend);
  });

  it('every entry has its texts in Strings.onboarding.features', () => {
    const texts = Strings.onboarding.features as Record<string, { title: string; description: string }>;
    for (const f of FEATURE_REGISTRY) {
      expect(texts[f.key]?.title).toBeTruthy();
      expect(texts[f.key]?.description).toBeTruthy();
    }
  });
});
