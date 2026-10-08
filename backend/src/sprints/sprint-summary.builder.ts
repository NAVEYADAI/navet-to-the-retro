import PptxGenJS from 'pptxgenjs';
import { NO_CATEGORY_LABEL } from '../comments/comment-category-labels';
import { applySlideTransitions } from './pptx-post-process.util';
import { ISRAEL_TIME_ZONE } from '../common/validation';

type CommentForExport = {
  content: string;
  type: 'KEEP' | 'IMPROVE';
  // Feature 3 (team comment categories, product-backlog/03-team-comment-categories.md): this is
  // now the category's actual per-team `label` (joined by the caller, sprints.service.ts), not an
  // enum key to look up — `Comment.category` (the old enum) no longer exists.
  category: string | null;
};

// `layout` drives which decorative shapes each slide gets (see decorateTitleSlide/
// decorateCategorySlide below) — a real per-template visual difference, not just color.
// `transitionXml` is raw OOXML injected post-hoc by applySlideTransitions(); pptxgenjs itself
// has no API for slide transitions at all.
export const SPRINT_SUMMARY_TEMPLATES = {
  classic: {
    label: 'קלאסי',
    background: 'FFFFFF',
    heading: '1A1A1A',
    muted: '666666',
    keep: '2E7D32',
    improve: 'C62828',
    tableBorder: 'D0D0D0',
    fontFace: 'Calibri',
    layout: 'plain' as const,
    transitionXml: '<p:transition spd="med"><p:fade/></p:transition>'
  },
  dark: {
    label: 'כהה',
    background: '1B1B2F',
    heading: 'F5F5F5',
    muted: 'A0A0B0',
    keep: '66BB6A',
    improve: 'EF5350',
    tableBorder: '3A3A55',
    fontFace: 'Tahoma',
    layout: 'cards' as const,
    transitionXml: '<p:transition spd="med"><p:push dir="l"/></p:transition>'
  },
  vibrant: {
    label: 'צבעוני',
    background: 'FFFFFF',
    heading: '1A237E',
    muted: '5C6BC0',
    keep: '00897B',
    improve: 'F57C00',
    tableBorder: 'C5CAE9',
    fontFace: 'Arial',
    layout: 'banner' as const,
    transitionXml: '<p:transition spd="fast"><p:wipe dir="r"/></p:transition>'
  }
} as const;

export type SprintSummaryTemplateId = keyof typeof SPRINT_SUMMARY_TEMPLATES;
type Template = (typeof SPRINT_SUMMARY_TEMPLATES)[SprintSummaryTemplateId];

export function resolveTemplateId(value: unknown): SprintSummaryTemplateId {
  return typeof value === 'string' && value in SPRINT_SUMMARY_TEMPLATES
    ? (value as SprintSummaryTemplateId)
    : 'classic';
}

interface SprintSummaryInput {
  sprintName: string;
  teamName: string;
  startDate: Date;
  endDate: Date;
  comments: CommentForExport[];
  templateId?: SprintSummaryTemplateId;
}

// BUG-13: user-supplied free text (comment content pasted from Word/PDF, sprint/team/category
// names) can contain C0 control characters (U+0000-U+0008, U+000B, U+000C, U+000E-U+001F), the
// non-characters U+FFFE/U+FFFF, or unpaired surrogates. None of these are legal in XML 1.0, and
// pptxgenjs writes text into slide XML verbatim, so a single one makes the whole slide
// unparseable in PowerPoint/Keynote. Tab/LF/CR are valid XML and are kept.
const XML_INVALID_CHARS =
  // eslint-disable-next-line no-control-regex
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

export function stripXmlInvalidChars(text: string): string {
  return text.replace(XML_INVALID_CHARS, '');
}

// BUG-46: the server runs in UTC, so a bare `toLocaleDateString('he-IL')` gave yesterday's date
// for anything between 00:00 and 03:00 Israel time. The app's single target locale is Israel, so
// every date in the export (slide text and file name) is rendered in Asia/Jerusalem.
export function formatDate(d: Date): string {
  return d.toLocaleDateString('he-IL', { timeZone: ISRAEL_TIME_ZONE });
}

// Presentation file name = sprint name + the date it was generated (not the sprint's own
// start/end dates — re-exporting the same sprint later, with more comments, should produce a
// visibly different file name). Strips characters that are invalid in file names on
// Windows/macOS so a free-text sprint name can't produce a broken download.
export function buildExportFileName(sprintName: string, now: Date = new Date()): string {
  const sanitized = sprintName.replace(/[\\/:*?"<>|]/g, ' ').trim() || 'ספרינט';
  const dateStr = formatDate(now);
  return `${sanitized} - ${dateStr}.pptx`;
}

function groupByCategory(comments: CommentForExport[]): Map<string, CommentForExport[]> {
  const groups = new Map<string, CommentForExport[]>();
  for (const comment of comments) {
    const label = comment.category ?? NO_CATEGORY_LABEL;
    const existing = groups.get(label);
    if (existing) {
      existing.push(comment);
    } else {
      groups.set(label, [comment]);
    }
  }
  return groups;
}

// BUG-45: each KEEP/IMPROVE column is a fixed 4.4in x 3.7in text box, and pptxgenjs does not
// shrink or paginate text, so a long comment (or many comments) ran off the bottom of the slide.
// We (1) cap a single comment's length, (2) estimate how many wrapped lines the column needs and
// pick the largest font size (12 down to 8pt) that fits, and (3) if even 8pt doesn't fit, drop
// the trailing comments and say how many were left out. The estimate is deliberately
// conservative (average glyph ~0.55em wide, line height 1.2em).
export const MAX_COMMENT_CHARS = 500;
const COLUMN_WIDTH_IN = 4.4;
const COLUMN_HEIGHT_IN = 3.7;
const BULLET_INDENT_IN = 0.3;
const FONT_SIZES_PT = [12, 11, 10, 9, 8];

function truncateComment(text: string): string {
  return text.length > MAX_COMMENT_CHARS ? `${text.slice(0, MAX_COMMENT_CHARS).trimEnd()}…` : text;
}

function estimateLines(texts: string[], fontSizePt: number): number {
  const charsPerLine = Math.max(1, Math.floor(((COLUMN_WIDTH_IN - BULLET_INDENT_IN) * 72) / (fontSizePt * 0.55)));
  return texts.reduce((sum, text) => {
    // A comment may contain explicit line breaks; each physical line wraps independently.
    const lines = text.split(/\r?\n/).reduce((n, line) => n + Math.max(1, Math.ceil(line.length / charsPerLine)), 0);
    return sum + lines;
  }, 0);
}

function fitsColumn(texts: string[], fontSizePt: number): boolean {
  return estimateLines(texts, fontSizePt) * fontSizePt * 1.2 / 72 <= COLUMN_HEIGHT_IN;
}

export function fitColumnText(contents: string[]): { texts: string[]; fontSize: number; omitted: number } {
  const truncated = contents.map(truncateComment);
  const minSize = FONT_SIZES_PT[FONT_SIZES_PT.length - 1];
  const fontSize = FONT_SIZES_PT.find(size => fitsColumn(truncated, size));
  if (fontSize !== undefined) {
    return { texts: truncated, fontSize, omitted: 0 };
  }
  // Doesn't fit even at the smallest size: keep as many leading comments as fit, reserving one
  // line for the "and N more" note.
  let kept = truncated.length;
  while (kept > 0 && !fitsColumn([...truncated.slice(0, kept), 'x'], minSize)) {
    kept -= 1;
  }
  return { texts: truncated.slice(0, kept), fontSize: minSize, omitted: truncated.length - kept };
}

// Adds each layout's decorative shape BEFORE any text is placed on the title slide, so the text
// draws on top of it. pptxgenjs has no per-line position API, so layout differences live at the
// panel/banner level (fixed, known coordinates) rather than per bullet — see plan notes.
function decorateTitleSlide(slide: PptxGenJS.Slide, t: Template) {
  if (t.layout === 'cards') {
    slide.addShape('rect', { x: 3, y: 3.3, w: 4, h: 0.06, fill: { color: t.heading } });
  } else if (t.layout === 'banner') {
    slide.addShape('rect', { x: 0, y: 1.5, w: 10, h: 1.8, fill: { color: t.keep } });
  }
}

function titleTextColor(t: Template): string {
  return t.layout === 'banner' ? 'FFFFFF' : t.heading;
}

function decorateCategorySlide(slide: PptxGenJS.Slide, t: Template) {
  if (t.layout === 'cards') {
    slide.addShape('roundRect', {
      x: 0.3, y: 0.95, w: 4.6, h: 4.4, rectRadius: 0.12,
      fill: { color: t.keep, transparency: 88 }, line: { color: t.keep, width: 1 }
    });
    slide.addShape('roundRect', {
      x: 5.1, y: 0.95, w: 4.6, h: 4.4, rectRadius: 0.12,
      fill: { color: t.improve, transparency: 88 }, line: { color: t.improve, width: 1 }
    });
  } else if (t.layout === 'banner') {
    slide.addShape('rect', { x: 0, y: 0, w: 10, h: 0.95, fill: { color: t.keep } });
  }
}

function categoryTitleColor(t: Template): string {
  return t.layout === 'banner' ? 'FFFFFF' : t.heading;
}

export async function buildSprintSummaryPptx(input: SprintSummaryInput): Promise<Buffer> {
  const t = SPRINT_SUMMARY_TEMPLATES[input.templateId ?? 'classic'];

  // BUG-13: sanitize every piece of user-supplied text once, up front, so no code path below can
  // forget to.
  input = {
    ...input,
    sprintName: stripXmlInvalidChars(input.sprintName),
    teamName: stripXmlInvalidChars(input.teamName),
    comments: input.comments.map(c => ({
      ...c,
      content: stripXmlInvalidChars(c.content),
      category: c.category === null ? null : stripXmlInvalidChars(c.category)
    }))
  };

  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: 'RETRO_16x9', width: 10, height: 5.63 });
  pptx.layout = 'RETRO_16x9';
  pptx.rtlMode = true;

  const titleSlide = pptx.addSlide();
  titleSlide.background = { color: t.background };
  decorateTitleSlide(titleSlide, t);
  titleSlide.addText(input.sprintName, {
    x: 0.5, y: 1.8, w: 9, h: 1, align: 'center', fontSize: 32, bold: true,
    color: titleTextColor(t), fontFace: t.fontFace
  });
  titleSlide.addText(
    `${input.teamName}  •  ${formatDate(input.startDate)} - ${formatDate(input.endDate)}`,
    {
      x: 0.5, y: 2.8, w: 9, h: 0.6, align: 'center', fontSize: 16,
      color: t.layout === 'banner' ? 'FFFFFF' : t.muted, fontFace: t.fontFace
    }
  );

  const grouped = groupByCategory(input.comments);

  if (grouped.size === 0) {
    const emptySlide = pptx.addSlide();
    emptySlide.background = { color: t.background };
    emptySlide.addText('אין עדיין תגובות בספרינט זה', {
      x: 0.5, y: 2.3, w: 9, h: 1, align: 'center', fontSize: 20, color: t.muted, fontFace: t.fontFace
    });
  }

  // `banner` gets a bolder filled-square bullet instead of the default round dot — a small
  // per-run styling difference that (unlike per-line shapes) pptxgenjs does support directly.
  const bulletStyle = t.layout === 'banner' ? { characterCode: '25A0' } : true;

  for (const [categoryLabel, categoryComments] of grouped) {
    const slide = pptx.addSlide();
    slide.background = { color: t.background };
    decorateCategorySlide(slide, t);
    slide.addText(categoryLabel, {
      x: 0.4, y: 0.3, w: 9.2, h: 0.6, align: 'right', fontSize: 24, bold: true,
      color: categoryTitleColor(t), fontFace: t.fontFace
    });

    const keep = categoryComments.filter(c => c.type === 'KEEP');
    const improve = categoryComments.filter(c => c.type === 'IMPROVE');

    // pptxgenjs's bullet hanging-indent (marL/indent) is always left-relative unless the
    // paragraph is explicitly marked `rtl="1"` — the presentation-level `pptx.rtlMode` above
    // does NOT propagate down to bulleted paragraphs, so without this the bullet glyph renders
    // stuck to the left while the Hebrew text it belongs to is right-aligned.
    const columnFor = (items: CommentForExport[]) => {
      if (items.length === 0) {
        return { fontSize: 12, runs: [{ text: '—', options: { color: t.muted, rtlMode: true, fontFace: t.fontFace } }] };
      }
      const fit = fitColumnText(items.map(c => c.content));
      const runs: PptxGenJS.TextProps[] = fit.texts.map(text => ({
        text, options: { bullet: bulletStyle, breakLine: true, rtlMode: true, fontFace: t.fontFace }
      }));
      if (fit.omitted > 0) {
        runs.push({ text: `ועוד ${fit.omitted} תגובות…`, options: { color: t.muted, rtlMode: true, fontFace: t.fontFace } });
      }
      return { fontSize: fit.fontSize, runs };
    };

    const keepColumn = columnFor(keep);
    const improveColumn = columnFor(improve);

    slide.addText('שימור', { x: 0.4, y: 1.05, w: 4.4, h: 0.4, align: 'right', fontSize: 16, bold: true, color: t.keep, fontFace: t.fontFace });
    slide.addText(keepColumn.runs, {
      x: 0.4, y: 1.5, w: 4.4, h: 3.7, align: 'right', fontSize: keepColumn.fontSize, color: t.heading, valign: 'top', fontFace: t.fontFace
    });

    slide.addText('שיפור', { x: 5.2, y: 1.05, w: 4.4, h: 0.4, align: 'right', fontSize: 16, bold: true, color: t.improve, fontFace: t.fontFace });
    slide.addText(improveColumn.runs, {
      x: 5.2, y: 1.5, w: 4.4, h: 3.7, align: 'right', fontSize: improveColumn.fontSize, color: t.heading, valign: 'top', fontFace: t.fontFace
    });
  }

  if (grouped.size > 0) {
    const summarySlide = pptx.addSlide();
    summarySlide.background = { color: t.background };
    summarySlide.addText('סיכום מספרי', {
      x: 0.4, y: 0.3, w: 9.2, h: 0.6, align: 'right', fontSize: 24, bold: true, color: t.heading, fontFace: t.fontFace
    });

    const headerRow = [
      { text: 'סה"כ', options: { bold: true, align: 'center' as const, color: t.heading, fontFace: t.fontFace } },
      { text: 'שיפור', options: { bold: true, align: 'center' as const, color: t.improve, fontFace: t.fontFace } },
      { text: 'שימור', options: { bold: true, align: 'center' as const, color: t.keep, fontFace: t.fontFace } },
      { text: 'קטגוריה', options: { bold: true, align: 'right' as const, color: t.heading, fontFace: t.fontFace } }
    ];
    const rows = [headerRow, ...Array.from(grouped.entries()).map(([label, items]) => {
      const keepCount = items.filter(c => c.type === 'KEEP').length;
      const improveCount = items.filter(c => c.type === 'IMPROVE').length;
      return [
        { text: String(items.length), options: { align: 'center' as const, color: t.heading, fontFace: t.fontFace } },
        { text: String(improveCount), options: { align: 'center' as const, color: t.heading, fontFace: t.fontFace } },
        { text: String(keepCount), options: { align: 'center' as const, color: t.heading, fontFace: t.fontFace } },
        { text: label, options: { align: 'right' as const, color: t.heading, fontFace: t.fontFace } }
      ];
    })];

    summarySlide.addTable(rows, {
      x: 0.4, y: 1.1, w: 9.2, fontSize: 13, border: { type: 'solid', color: t.tableBorder, pt: 1 },
      fill: { color: t.background }, autoPage: false
    });
  }

  const rawOutput = await pptx.write({ outputType: 'nodebuffer' });
  return applySlideTransitions(rawOutput as Buffer, t.transitionXml);
}
