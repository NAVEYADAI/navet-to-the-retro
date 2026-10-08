import { SingleUseTokenRegistry } from './single-use-tokens';

describe('SingleUseTokenRegistry', () => {
  it('allows the first consume and rejects the second', () => {
    const r = new SingleUseTokenRegistry();
    const exp = Math.floor(Date.now() / 1000) + 60;
    expect(r.consume('a', exp)).toBe(true);
    expect(r.consume('a', exp)).toBe(false);
    expect(r.consume('b', exp)).toBe(true);
  });

  it('rejects a missing jti', () => {
    const r = new SingleUseTokenRegistry();
    expect(r.consume(undefined, 1)).toBe(false);
    expect(r.consume('', 1)).toBe(false);
  });

  it('purges entries after their exp so the map does not grow forever', () => {
    const r = new SingleUseTokenRegistry();
    const now = 1_000_000;
    r.consume('a', now / 1000 + 10, now);
    expect((r as any).consumed.size).toBe(1);
    r.consume('b', now / 1000 + 100, now + 20_000);
    expect((r as any).consumed.has('a')).toBe(false);
    expect((r as any).consumed.has('b')).toBe(true);
  });
});
