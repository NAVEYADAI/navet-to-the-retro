import { copyTextToClipboard } from '../clipboard';

const g = globalThis as any;

describe('copyTextToClipboard (BUG-58)', () => {
  const originalNavigator = g.navigator;
  const originalDocument = g.document;

  afterEach(() => {
    Object.defineProperty(g, 'navigator', { value: originalNavigator, configurable: true, writable: true });
    Object.defineProperty(g, 'document', { value: originalDocument, configurable: true, writable: true });
  });

  const setNavigator = (value: any) => Object.defineProperty(g, 'navigator', { value, configurable: true, writable: true });
  const setDocument = (value: any) => Object.defineProperty(g, 'document', { value, configurable: true, writable: true });

  const fakeDocument = (execResult: boolean | Error) => {
    const textarea: any = {
      style: {},
      parentNode: null,
      setAttribute: jest.fn(),
      focus: jest.fn(),
      select: jest.fn(),
      setSelectionRange: jest.fn(),
    };
    const body = {
      appendChild: jest.fn((el: any) => { el.parentNode = body; }),
      removeChild: jest.fn((el: any) => { el.parentNode = null; }),
    };
    const doc = {
      createElement: jest.fn(() => textarea),
      body,
      execCommand: jest.fn(() => {
        if (execResult instanceof Error) throw execResult;
        return execResult;
      }),
    };
    return { doc, textarea, body };
  };

  it('uses navigator.clipboard when available', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    setNavigator({ clipboard: { writeText } });
    expect(await copyTextToClipboard('hello')).toBe(true);
    expect(writeText).toHaveBeenCalledWith('hello');
  });

  it('falls back to execCommand("copy") when navigator.clipboard is unavailable', async () => {
    setNavigator({});
    const { doc, textarea, body } = fakeDocument(true);
    setDocument(doc);

    expect(await copyTextToClipboard('https://x/invite/abc')).toBe(true);
    expect(textarea.value).toBe('https://x/invite/abc');
    expect(doc.execCommand).toHaveBeenCalledWith('copy');
    expect(body.removeChild).toHaveBeenCalledWith(textarea);
  });

  it('falls back when navigator.clipboard.writeText rejects (e.g. permission denied)', async () => {
    setNavigator({ clipboard: { writeText: jest.fn().mockRejectedValue(new Error('denied')) } });
    const { doc } = fakeDocument(true);
    setDocument(doc);
    expect(await copyTextToClipboard('x')).toBe(true);
    expect(doc.execCommand).toHaveBeenCalledWith('copy');
  });

  it('returns false (does not throw) when both paths fail', async () => {
    setNavigator({});
    const { doc, body } = fakeDocument(new Error('nope'));
    setDocument(doc);
    expect(await copyTextToClipboard('x')).toBe(false);
    expect(body.removeChild).toHaveBeenCalled();
  });

  it('returns false when there is no DOM at all', async () => {
    setNavigator({});
    setDocument(undefined);
    expect(await copyTextToClipboard('x')).toBe(false);
  });
});
