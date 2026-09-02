import JSZip from 'jszip';
import {
  buildExportFileName,
  buildSprintSummaryPptx,
  resolveTemplateId,
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

describe('buildExportFileName', () => {
  it('combines the sprint name with today\'s date, in he-IL format', () => {
    const expectedDate = new Date().toLocaleDateString('he-IL');

    expect(buildExportFileName('ספרינט 5')).toBe(`ספרינט 5 - ${expectedDate}.pptx`);
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
