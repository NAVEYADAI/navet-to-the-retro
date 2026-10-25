// Shared by the CLI (tasks.mjs) and the local UI (tasks-ui.mjs).
// All edits are pure functions over the file's lines, so the markdown stays the single source of truth
// and everything outside the task lines (header, legend, blank lines) is preserved byte for byte.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const dir = path.join(root, 'product-backlog');
export const TASKS_FILE = path.join(dir, 'TASKS.md');

export const SECTIONS = ['now', 'next', 'later', 'done'];
export const MAX_NOW = 2;
const SECTION_BY_WORD = { Now: 'now', Next: 'next', Later: 'later', Done: 'done' };
const ITEM = /^- \[( |x)\] ([A-Z]+)-(\d+) · (feature|bug|chore|idea)(?: ([🔴🟠🟡🟢]))? · (S|M|L|\?) · (.+)$/u;
const SIZES = ['S', 'M', 'L', '?'];

export class UserError extends Error {}

export const readLines = () => fs.readFileSync(TASKS_FILE, 'utf8').split('\n');
export const writeLines = (lines) => fs.writeFileSync(TASKS_FILE, lines.join('\n'));

/** Splits an item's free text into its three optional parts: title, link, blocked reason. */
export function splitText(text) {
  const blockAt = text.indexOf('⛔');
  const blocked = blockAt === -1 ? null : text.slice(blockAt + 1).trim() || 'חסום';
  const head = blockAt === -1 ? text : text.slice(0, blockAt);
  const link = head.match(/→\s*\[([^\]]*)\]\(\.\/([^)#]+)\)/);
  const title = head.replace(/\s*→.*$/, '').trim();
  return { title, linkLabel: link?.[1] ?? null, linkFile: link?.[2] ?? null, blocked };
}

export function parseLines(lines) {
  const items = [];
  const errors = [];
  const headings = {};
  let section = null;
  let inFence = false;
  lines.forEach((line, index) => {
    const at = `TASKS.md:${index + 1}`;
    if (line.startsWith('```')) inFence = !inFence;
    if (inFence) return;
    const heading = line.match(/^## (.+)$/);
    if (heading) {
      const word = Object.keys(SECTION_BY_WORD).find((w) => new RegExp(`\\b${w}\\b`).test(heading[1]));
      section = word ? SECTION_BY_WORD[word] : null;
      if (section) headings[section] = index;
      return;
    }
    if (!line.startsWith('- [')) return;
    const m = line.match(ITEM);
    if (!m) {
      errors.push(`${at}: שורה לא בפורמט (ר' "איך קוראים שורה"): ${line.slice(0, 70)}`);
      return;
    }
    if (!section) {
      errors.push(`${at}: משימה מחוץ לאחד הסעיפים Now/Next/Later/Done`);
      return;
    }
    const [, mark, prefix, num, type, severity, size, text] = m;
    items.push({
      at, index, section, done: mark === 'x', prefix, num: Number(num), id: `${prefix}-${num}`, type,
      severity: severity ?? null, size, text, blocked: text.includes('⛔'), link: splitText(text).linkFile ?? undefined,
    });
  });
  return { items, errors, headings };
}

const render = (it) =>
  `- [${it.done ? 'x' : ' '}] ${it.id} · ${it.type}${it.severity ? ' ' + it.severity : ''} · ${it.size} · ${it.text}`;

function find(items, id) {
  const it = items.find((t) => t.id === id);
  if (!it) throw new UserError(`אין משימה ${id}`);
  return it;
}

function assertNowLimit(lines) {
  const n = parseLines(lines).items.filter((t) => t.section === 'now').length;
  if (n > MAX_NOW) throw new UserError(`ב-Now יכולות להיות לכל היותר ${MAX_NOW} משימות. סגור או דחה אחת קודם.`);
}

/** Moves (or reorders) an item: `index` is its position among the target section's other items. */
export function moveItem(lines, id, section, index) {
  if (!SECTIONS.includes(section)) throw new UserError(`סעיף לא מוכר: ${section}`);
  const before = parseLines(lines);
  const it = find(before.items, id);
  if (section === 'done' && it.section !== 'done' && (it.prefix === 'BUG' || it.prefix === 'F')) {
    // The UI can't do the bookkeeping that closing these requires (BUGS.md entry, specs, Definition of Done).
    throw new UserError(it.prefix === 'BUG'
      ? 'באג נסגר דרך תיקון בפועל (skill fix-bug), שגם מוחק אותו מ-BUGS.md.'
      : 'פיצ\'ר נסגר אחרי שהמימוש, הבדיקות וההטמעה גמורים — בקש מ-Claude לסגור אותו (/task done).');
  }
  const next = [...lines];
  next.splice(it.index, 1);
  const moved = { ...it, section, done: section === 'done' };
  const { items, headings } = parseLines(next);
  const target = items.filter((t) => t.section === section);
  let at;
  if (index < target.length) at = target[Math.max(0, index)].index;
  else if (target.length) at = target[target.length - 1].index + 1;
  else at = headings[section] + 2;
  next.splice(at, 0, render(moved));
  assertNowLimit(next);
  return next;
}

/** patch: { size?: 'S'|'M'|'L'|'?', blocked?: string|null } — blocked null/'' clears the block. */
export function updateItem(lines, id, patch) {
  const { items } = parseLines(lines);
  const it = find(items, id);
  const next = [...lines];
  const updated = { ...it };
  if (patch.size !== undefined) {
    if (!SIZES.includes(patch.size)) throw new UserError(`גודל לא תקין: ${patch.size}`);
    updated.size = patch.size;
  }
  if (patch.blocked !== undefined) {
    const reason = (patch.blocked ?? '').replace(/[\n\r]/g, ' ').trim();
    const base = it.text.replace(/\s*⛔.*$/, '');
    updated.text = reason ? `${base} ⛔ ${reason}` : base;
  }
  next[it.index] = render(updated);
  return next;
}

export function nextId(lines, prefix) {
  const { items } = parseLines(lines);
  let max = Math.max(0, ...items.filter((t) => t.prefix === prefix).map((t) => t.num));
  if (prefix === 'F') {
    const files = fs.readdirSync(dir).filter((f) => /^\d+-.+\.md$/.test(f));
    max = Math.max(max, ...files.map((f) => Number(f.split('-')[0])));
  }
  return `${prefix}-${String(max + 1).padStart(2, '0')}`;
}

/** Adds a chore or idea. Features need a spec file and bugs need a BUGS.md entry, so those go through Claude. */
export function addItem(lines, { type, size = '?', title, section = 'next' }) {
  const prefix = { chore: 'T', idea: 'I' }[type];
  if (!prefix) throw new UserError('מהממשק אפשר להוסיף רק תחזוקה (chore) או רעיון (idea). פיצ\'ר צריך אפיון, ובאג צריך רשומה ב-BUGS.md — בקש מ-Claude.');
  if (!['now', 'next', 'later'].includes(section)) throw new UserError('משימה חדשה נכנסת ל-Now / Next / Later.');
  const clean = String(title ?? '').replace(/[\n\r]/g, ' ').trim();
  if (!clean) throw new UserError('חסרה כותרת.');
  if (!SIZES.includes(size)) throw new UserError(`גודל לא תקין: ${size}`);
  const id = nextId(lines, prefix);
  const next = [...lines];
  const { items, headings } = parseLines(next);
  const target = items.filter((t) => t.section === section);
  const at = target.length ? target[target.length - 1].index + 1 : headings[section] + 2;
  next.splice(at, 0, `- [ ] ${id} · ${type} · ${size} · ${clean}`);
  assertNowLimit(next);
  return { lines: next, id };
}

/**
 * Progress of a feature spec, read from its checklists. Counts `- [ ]` / `- [x]` under the numbered
 * sub-sections (`### N.k Title`) — Backend / Frontend / בדיקות / הטמעה / … — and ignores everything else
 * (decisions, research, "לא בטיפול"). Returns null when the spec has no checklist at all.
 */
export function parseProgress(text) {
  const sections = [];
  let current = null;
  let inFence = false;
  for (const line of text.split('\n')) {
    if (line.startsWith('```')) inFence = !inFence;
    if (inFence) continue;
    const h = line.match(/^#{2,3} (?:(\d+)\.(\d+)\s+)?(.*)$/);
    if (h && line.startsWith('##')) {
      const isNumbered = h[1] !== undefined && Number(h[2]) >= 1;
      current = isNumbered
        ? { key: `§${h[1]}.${h[2]}`, name: h[3].replace(/\s*(—|\().*$/, '').trim().slice(0, 40), done: 0, total: 0 }
        : null;
      if (current) sections.push(current);
      continue;
    }
    const box = current && line.match(/^\s*- \[( |x)\]/);
    if (box) { current.total += 1; if (box[1] === 'x') current.done += 1; }
  }
  const live = sections.filter((s) => s.total > 0);
  if (!live.length) return null;
  return { done: live.reduce((a, s) => a + s.done, 0), total: live.reduce((a, s) => a + s.total, 0), sections: live };
}
