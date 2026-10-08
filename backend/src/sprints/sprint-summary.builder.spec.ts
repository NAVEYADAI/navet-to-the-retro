import JSZip from 'jszip';
import {
  buildExportFileName,
  buildSprintSummaryPptx,
  fitColumnText,
  formatDate,
  MAX_COMMENT_CHARS,
  resolveTemplateId,
  stripXmlInvalidChars,
  SPRINT_SUMMARY_TEMPLATES,
} from './sprint-summary.builder';

describe('resolveTemplateId', () => {
  it('returns a recognized template id as-is', () => {
    expect(resolveTemplateId('dark')).toBe('dark');
    expect(resolveTemplateId('vibrant')).toBe('vibrant');
  });

  it('falls back to classic for undefined, an unrecognized string, or a non-string value', () => {
    expect(resolveTemplateId(undefined)).toBe('classic');
    expect(resolveTemplateId('not-a-real-template')).toBe('classic');
    expect(resolveTemplateId(42)).toBe('classic');
    expect(resolveTemplateId(null)).toBe('classic');
  });
});

describe('stripXmlInvalidChars (BUG-13)', () => {
  it('removes XML-invalid control characters but keeps tab/newline/CR and Hebrew text', () => {
    expect(stripXmlInvalidChars('ctrl \u0001\u0008\u000b end')).toBe('ctrl  end');
    expect(stripXmlInvalidChars('a\u0000b\u000cc\u001fd\ufffee\uffff')).toBe('abcde');
    expect(stripXmlInvalidChars('שורה\tא\nב\r')).toBe('שורה\tא\nב\r');
  });

  it('removes unpaired surrogates but keeps valid surrogate pairs (emoji)', () => {
    expect(stripXmlInvalidChars('a\ud800b\udc00c')).toBe('abc');
    expect(stripXmlInvalidChars('ok \u{1F600}')).toBe('ok \u{1F600}');
  });
});

describe('buildExportFileName', () => {
  it('combines the sprint name with today\'s date, in he-IL format (Asia/Jerusalem)', () => {
    const expectedDate = new Date().toLocaleDateString('he-IL', { timeZone: 'Asia/Jerusalem' });

    expect(buildExportFileName('ספרינט 5')).toBe(`ספרינט 5 - ${expectedDate}.pptx`);
  });

  // BUG-46: 22:30 UTC on 1 July is already 01:30 on 2 July in Israel (UTC+3 in summer).
  it('uses the Israel calendar date, not the server (UTC) date, for the file name', () => {
    expect(buildExportFileName('ספרינט 5', new Date('2026-07-01T22:30:00Z'))).toBe('ספרינט 5 - 2.7.2026.pptx');
  });

  it('uses the Israel calendar date in winter time too (UTC+2)', () => {
    expect(buildExportFileName('ספרינט 5', new Date('2026-01-14T22:30:00Z'))).toBe('ספרינט 5 - 15.1.2026.pptx');
    // ...and still the same day when UTC is early enough.
    expect(buildExportFileName('ספרינט 5', new Date('2026-01-14T10:00:00Z'))).toBe('ספרינט 5 - 14.1.2026.pptx');
  });

  it('strips characters that are invalid in file names on Windows/macOS', () => {
    const result = buildExportFileName('Sprint: "Q1"/Q2 <final>');

    expect(result).not.toMatch(/[\\/:*?"<>|]/);
  });

  it('falls back to a placeholder name when the sprint name is empty or only invalid characters', () => {
    expect(buildExportFileName('   ')).toMatch(/^ספרינט - /);
    expect(buildExportFileName(':::')).toMatch(/^ספרינט - /);
  });
});

describe('formatDate (BUG-46)', () => {
  it('renders the date in Asia/Jerusalem regardless of the server time zone', () => {
    expect(formatDate(new Date('2026-03-31T21:30:00Z'))).toBe('1.4.2026');
    expect(formatDate(new Date('2026-03-31T10:00:00Z'))).toBe('31.3.2026');
  });
});

describe('fitColumnText (BUG-45)', () => {
  it('leaves a few short comments at the default 12pt size untouched', () => {
    expect(fitColumnText(['a', 'b', 'c'])).toEqual({ texts: ['a', 'b', 'c'], fontSize: 12, omitted: 0 });
  });

  it('truncates a single huge comment to a sane length', () => {
    const result = fitColumnText(['x'.repeat(90_000)]);

    expect(result.texts).toHaveLength(1);
    expect(result.texts[0].length).toBe(MAX_COMMENT_CHARS + 1);
    expect(result.texts[0].endsWith('…')).toBe(true);
    expect(result.omitted).toBe(0);
  });

  it('shrinks the font (but keeps every comment) when the column is moderately full', () => {
    const result = fitColumnText(Array.from({ length: 3 }, () => 'y'.repeat(400)));

    expect(result.fontSize).toBeLessThan(12);
    expect(result.fontSize).toBeGreaterThanOrEqual(8);
    expect(result.texts).toHaveLength(3);
    expect(result.omitted).toBe(0);
  });

  it('drops trailing comments (and reports how many) when even the smallest font cannot fit them all', () => {
    const many = Array.from({ length: 200 }, (_, i) => `הערה מספר ${i}`);
    const result = fitColumnText(many);

    expect(result.fontSize).toBe(8);
    expect(result.omitted).toBeGreaterThan(0);
    expect(result.texts.length + result.omitted).toBe(200);
    expect(result.texts[0]).toBe('הערה מספר 0');
  });
});

describe('buildSprintSummaryPptx', () => {
  const baseInput = {
    sprintName: 'ספרינט בדיקה',
    teamName: 'צוות בדיקה',
    startDate: new Date('2026-01-01'),
    endDate: new Date('2026-01-14'),
  };

  async function slidesOf(buffer: Buffer) {
    const zip = await JSZip.loadAsync(buffer);
    const names = Object.keys(zip.files)
      .filter(name => /^ppt\/slides\/slide\d+\.xml$/.test(name))
      .sort();
    const xmls = await Promise.all(names.map(name => zip.file(name)!.async('string')));
    return xmls;
  }

  // BUG-46
  it('prints the sprint dates on the title slide in Israel time', async () => {
    const buffer = await buildSprintSummaryPptx({
      ...baseInput,
      startDate: new Date('2026-03-31T21:30:00Z'),
      endDate: new Date('2026-04-14T21:30:00Z'),
      comments: [],
    });

    const [title] = await slidesOf(buffer);
    expect(title).toContain('1.4.2026 - 15.4.2026');
  });

  // BUG-45
  it('limits an extremely long comment instead of writing all of it into the slide', async () => {
    const buffer = await buildSprintSummaryPptx({
      ...baseInput,
      comments: [{ content: 'ש'.repeat(90_000), type: 'KEEP', category: 'PLANNING' }],
    });

    const slides = await slidesOf(buffer);
    const categorySlide = slides[1];
    expect(categorySlide.length).toBeLessThan(20_000);
    expect(categorySlide).toContain('…');
  });

  it('produces a valid zip file (a real .pptx is a zip archive)', async () => {
    const buffer = await buildSprintSummaryPptx({ ...baseInput, comments: [] });

    // The zip local-file-header signature — cheap way to assert "this is actually a zip",
    // independent of pptxgenjs's/JSZip's internals.
    expect(buffer.subarray(0, 2).toString('hex')).toBe('504b');
  });

  it('renders a title slide plus one slide per category plus a summary slide', async () => {
    const buffer = await buildSprintSummaryPptx({
      ...baseInput,
      comments: [
        { content: 'a', type: 'KEEP', category: 'PLANNING' },
        { content: 'b', type: 'IMPROVE', category: 'TESTING' },
        { content: 'c', type: 'KEEP', category: null },
      ],
    });

    const slides = await slidesOf(buffer);
    // title + 3 categories (PLANNING, TESTING, "no category") + summary = 5
    expect(slides).toHaveLength(5);
  });

  // BUG-13
  it('strips XML-invalid control characters from comment/sprint/team/category text so every slide is well-formed XML', async () => {
    const buffer = await buildSprintSummaryPptx({
      ...baseInput,
      sprintName: 'ספרינט\u0001',
      teamName: 'צוות\u0008',
      comments: [
        { content: 'ctrl \u0001\u0008\u000b end', type: 'KEEP', category: 'קט\u000cגוריה' },
        { content: 'שני\u001f', type: 'IMPROVE', category: null },
      ],
    });

    const slides = await slidesOf(buffer);
    for (const xml of slides) {
      // eslint-disable-next-line no-control-regex
      expect(xml).not.toMatch(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/);
    }
    expect(slides.join('')).toContain('ctrl  end');
  });

  it('shows an empty-state slide instead of category slides when there are no comments', async () => {
    const buffer = await buildSprintSummaryPptx({ ...baseInput, comments: [] });

    const slides = await slidesOf(buffer);
    expect(slides).toHaveLength(2); // title + empty-state, no per-category slides, no summary
    expect(slides[1]).toContain('אין עדיין תגובות בספרינט זה');
  });

  it('applies the requested template\'s slide transition to every slide', async () => {
    const buffer = await buildSprintSummaryPptx({
      ...baseInput,
      templateId: 'dark',
      comments: [{ content: 'a', type: 'KEEP', category: null }],
    });

    const slides = await slidesOf(buffer);
    for (const xml of slides) {
      expect(xml).toContain(SPRINT_SUMMARY_TEMPLATES.dark.transitionXml);
    }
  });

  it('applies the requested template\'s font to the generated text', async () => {
    const buffer = await buildSprintSummaryPptx({
      ...baseInput,
      templateId: 'vibrant',
      comments: [{ content: 'a', type: 'KEEP', category: null }],
    });

    const slides = await slidesOf(buffer);
    expect(slides.some(xml => xml.includes('<a:cs typeface="Arial"'))).toBe(true);
  });

  it('gives the vibrant (banner) template a bold square bullet instead of the default dot', async () => {
    const buffer = await buildSprintSummaryPptx({
      ...baseInput,
      templateId: 'vibrant',
      comments: [{ content: 'a', type: 'KEEP', category: null }],
    });

    const slides = await slidesOf(buffer);
    expect(slides.some(xml => xml.includes('char="&#x25A0;"'))).toBe(true);
  });

  it('defaults to the classic template (plain layout, no decorative panels) when none is given', async () => {
    const buffer = await buildSprintSummaryPptx({
      ...baseInput,
      comments: [{ content: 'a', type: 'KEEP', category: null }],
    });

    const slides = await slidesOf(buffer);
    expect(slides.some(xml => xml.includes('char="&#x2022;"'))).toBe(true); // default round bullet
    expect(slides.some(xml => xml.includes('prst="roundRect"'))).toBe(false); // no "cards" panels
  });
});
