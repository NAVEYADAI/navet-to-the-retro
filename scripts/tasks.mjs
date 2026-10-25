#!/usr/bin/env node
// Reads product-backlog/TASKS.md. No dependencies.
//   npm run tasks               -> what is in progress + the next unblocked task
//   npm run tasks -- list       -> every open task, by section
//   npm run tasks -- id T       -> next free id for a prefix (F / BUG / T / I)
//   npm run tasks:check         -> consistency check (exit 1 on errors)
import fs from 'node:fs';
import path from 'node:path';
import { dir, readLines, parseLines, nextId as nextIdFor, MAX_NOW } from './tasks-lib.mjs';

const read = (f) => fs.readFileSync(path.join(dir, f), 'utf8');
const parseTasks = () => parseLines(readLines());

const title = (t) => t.replace(/\s*→.*$/, '').replace(/\s*⛔.*$/, '');
const fmt = (t) =>
  `${t.id} · ${t.type}${t.severity ? ' ' + t.severity : ''} · ${t.size} · ${title(t.text)}` +
  (t.blocked ? `  ${t.text.slice(t.text.indexOf('⛔'))}` : '');

function check() {
  const { items, errors } = parseTasks();

  const seen = new Set();
  for (const t of items) {
    if (seen.has(t.id)) errors.push(`${t.at}: מזהה כפול ${t.id}`);
    seen.add(t.id);
    if (t.section === 'done' && !t.done) errors.push(`${t.at}: ${t.id} ב-Done אבל לא מסומן [x]`);
    if (t.section !== 'done' && t.done) errors.push(`${t.at}: ${t.id} מסומן [x] אבל לא ב-Done`);
    if (t.link && !fs.existsSync(path.join(dir, t.link))) errors.push(`${t.at}: ${t.id} מקשר לקובץ שלא קיים: ${t.link}`);
  }

  const now = items.filter((t) => t.section === 'now');
  if (now.length > MAX_NOW) errors.push(`Now מכיל ${now.length} משימות (מקסימום ${MAX_NOW})`);

  // Every feature file has exactly one F-NN item, and F-NN items point at their own file.
  const featureFiles = fs.readdirSync(dir).filter((f) => /^\d+-.+\.md$/.test(f));
  for (const f of featureFiles) {
    const n = Number(f.split('-')[0]);
    if (!items.some((t) => t.prefix === 'F' && t.num === n)) errors.push(`לקובץ הפיצ'ר ${f} אין שורה F-${String(n).padStart(2, '0')} ב-TASKS.md`);
  }
  for (const t of items.filter((x) => x.prefix === 'F')) {
    if (!featureFiles.some((f) => Number(f.split('-')[0]) === t.num)) errors.push(`${t.at}: ${t.id} בלי קובץ פיצ'ר מתאים`);
    if (t.link && Number(t.link.split('-')[0]) !== t.num) errors.push(`${t.at}: ${t.id} מקשר לקובץ של פיצ'ר אחר (${t.link})`);
  }

  // Open bugs: BUGS.md <-> open BUG items in TASKS.md (both directions).
  const bugsMd = read('BUGS.md');
  const openBugs = new Set(
    [...bugsMd.matchAll(/^- \[ \] \*\*BUG-(\d+)|^\| \[ \] \| BUG-(\d+) \|/gm)].map((m) => Number(m[1] || m[2])),
  );
  const taskBugs = items.filter((t) => t.prefix === 'BUG' && !t.done);
  for (const n of openBugs) if (!taskBugs.some((t) => t.num === n)) errors.push(`BUG-${n} פתוח ב-BUGS.md אבל אין לו שורה ב-TASKS.md`);
  for (const t of taskBugs) if (!openBugs.has(t.num)) errors.push(`${t.at}: ${t.id} פתוח ב-TASKS.md אבל לא ב-BUGS.md (תוקן? העבר ל-Done או מחק)`);

  if (errors.length) {
    console.error(errors.map((e) => `✗ ${e}`).join('\n'));
    console.error(`\n${errors.length} בעיות.`);
    process.exit(1);
  }
  const open = items.filter((t) => !t.done).length;
  console.log(`✓ TASKS.md תקין — ${open} פתוחות (Now ${now.length}, Next ${items.filter((t) => t.section === 'next').length}, Later ${items.filter((t) => t.section === 'later').length}), ${items.length - open} ב-Done.`);
}

function show() {
  const { items } = parseTasks();
  const now = items.filter((t) => t.section === 'now');
  const next = items.find((t) => t.section === 'next' && !t.blocked);
  console.log('🔥 Now');
  console.log(now.length ? now.map((t) => `  ${fmt(t)}`).join('\n') : '  (ריק)');
  console.log('\n⏭ הבאה בתור');
  console.log(next ? `  ${fmt(next)}${next.link ? `\n  → product-backlog/${next.link}` : ''}` : '  (אין משימה לא-חסומה ב-Next)');
}

function list() {
  const { items } = parseTasks();
  for (const [name, key] of [['🔥 Now', 'now'], ['⏭ Next', 'next'], ['🧊 Later', 'later']]) {
    const group = items.filter((t) => t.section === key);
    console.log(`\n${name} (${group.length})`);
    group.forEach((t) => console.log(`  ${t.blocked ? '⛔' : '  '} ${fmt(t).replace(/\s+⛔.*$/, '')}`));
  }
}

function nextId(prefix) {
  if (!prefix) throw new Error('usage: tasks id <F|BUG|T|I>');
  console.log(nextIdFor(readLines(), prefix));
  if (prefix === 'BUG') console.log('(באגים נמחקים מ-BUGS.md — המספר הנכון = הגבוה אי פעם + 1, ר\' הפקודה ב-skill fix-bug)');
}

const [cmd, arg] = process.argv.slice(2);
switch (cmd) {
  case 'check': check(); break;
  case 'list': list(); break;
  case 'id': nextId(arg); break;
  case undefined: case 'next': show(); break;
  default: console.error(`פקודה לא מוכרת: ${cmd}. אפשרויות: next | list | id <PREFIX> | check`); process.exit(2);
}
