import PptxGenJS from 'pptxgenjs';
import { NO_CATEGORY_LABEL } from '../comments/comment-category-labels';
import { applySlideTransitions } from './pptx-post-process.util';

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

function formatDate(d: Date): string {
  return d.toLocaleDateString('he-IL');
}

// Presentation file name = sprint name + the date it was generated (not the sprint's own
// start/end dates — re-exporting the same sprint later, with more comments, should produce a
// visibly different file name). Strips characters that are invalid in file names on
// Windows/macOS so a free-text sprint name can't produce a broken download.
export function buildExportFileName(sprintName: string): string {
  const sanitized = sprintName.replace(/[\\/:*?"<>|]/g, ' ').trim() || 'ספרינט';
  const dateStr = formatDate(new Date());
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
    const bulletsFor = (items: CommentForExport[]) =>
      items.length > 0
        ? items.map(c => ({ text: c.content, options: { bullet: bulletStyle, breakLine: true, rtlMode: true, fontFace: t.fontFace } }))
        : [{ text: '—', options: { color: t.muted, rtlMode: true, fontFace: t.fontFace } }];

    slide.addText('שימור', { x: 0.4, y: 1.05, w: 4.4, h: 0.4, align: 'right', fontSize: 16, bold: true, color: t.keep, fontFace: t.fontFace });
    slide.addText(bulletsFor(keep), {
      x: 0.4, y: 1.5, w: 4.4, h: 3.7, align: 'right', fontSize: 12, color: t.heading, valign: 'top', fontFace: t.fontFace
    });

    slide.addText('שיפור', { x: 5.2, y: 1.05, w: 4.4, h: 0.4, align: 'right', fontSize: 16, bold: true, color: t.improve, fontFace: t.fontFace });
    slide.addText(bulletsFor(improve), {
      x: 5.2, y: 1.5, w: 4.4, h: 3.7, align: 'right', fontSize: 12, color: t.heading, valign: 'top', fontFace: t.fontFace
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
