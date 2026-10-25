import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLines, moveItem, updateItem, addItem, splitText, parseProgress, UserError } from './tasks-lib.mjs';

const doc = () => [
  '# משימות',
  '```',
  '- [ ] X-01 · feature · M · דוגמה בתוך בלוק קוד — לא משימה',
  '```',
  '## 🔥 Now',
  '',
  '- [ ] T-01 · chore · S · אחד',
  '',
  '## ⏭ Next',
  '',
  '- [ ] T-02 · chore · M · שניים → [spec](./02-x.md)',
  '- [ ] I-01 · idea · ? · שלושה ⛔ ממתין',
  '- [ ] BUG-07 · bug 🟡 · S · באג',
  '',
  '## 🧊 Later',
  '',
  '## ✅ Done',
  '',
  '- [x] T-00 · chore · S · ישן',
];
const ids = (lines, section) => parseLines(lines).items.filter((t) => t.section === section).map((t) => t.id);

test('parse ignores fenced examples and reads severity/blocked/link', () => {
  const { items, errors } = parseLines(doc());
  assert.deepEqual(errors, []);
  assert.equal(items.length, 5);
  assert.equal(items.find((t) => t.id === 'BUG-07').severity, '🟡');
  assert.equal(items.find((t) => t.id === 'I-01').blocked, true);
  assert.deepEqual(splitText(items.find((t) => t.id === 'T-02').text), { title: 'שניים', linkLabel: 'spec', linkFile: '02-x.md', blocked: null });
});

test('reorder inside a section', () => {
  assert.deepEqual(ids(moveItem(doc(), 'BUG-07', 'next', 0), 'next'), ['BUG-07', 'T-02', 'I-01']);
  assert.deepEqual(ids(moveItem(doc(), 'T-02', 'next', 99), 'next'), ['I-01', 'BUG-07', 'T-02']);
});

test('move into an empty section keeps the blank line after the heading', () => {
  const out = moveItem(doc(), 'I-01', 'later', 0);
  assert.deepEqual(ids(out, 'later'), ['I-01']);
  const h = out.findIndex((l) => l.startsWith('## 🧊'));
  assert.equal(out[h + 1], '');
});

test('done toggles the checkbox; bugs and features cannot be closed from the UI', () => {
  const out = moveItem(doc(), 'T-02', 'done', 0);
  assert.match(out.find((l) => l.includes('T-02')), /^- \[x\]/);
  assert.throws(() => moveItem(doc(), 'BUG-07', 'done', 0), UserError);
  const back = moveItem(out, 'T-02', 'next', 0);
  assert.match(back.find((l) => l.includes('T-02')), /^- \[ \]/);
});

test('Now is capped at 2', () => {
  const two = moveItem(doc(), 'T-02', 'now', 9);
  assert.deepEqual(ids(two, 'now'), ['T-01', 'T-02']);
  assert.throws(() => moveItem(two, 'I-01', 'now', 9), /Now/);
});

test('block / unblock / size only touch their own line', () => {
  const src = doc();
  const blocked = updateItem(src, 'T-01', { blocked: 'מחכה לנוה', size: 'L' });
  assert.equal(blocked[6], '- [ ] T-01 · chore · L · אחד ⛔ מחכה לנוה');
  assert.deepEqual(updateItem(blocked, 'T-01', { blocked: null })[6], '- [ ] T-01 · chore · L · אחד');
  const out = updateItem(src, 'T-02', { blocked: 'x' });
  assert.equal(out.filter((l, i) => l !== src[i]).length, 1);
});

test('add: chores and ideas only, ids are free, header untouched', () => {
  const { lines, id } = addItem(doc(), { type: 'chore', size: 'S', title: 'חדש', section: 'next' });
  assert.equal(id, 'T-03');
  assert.deepEqual(ids(lines, 'next'), ['T-02', 'I-01', 'BUG-07', 'T-03']);
  assert.equal(addItem(doc(), { type: 'idea', title: 'ר', section: 'later' }).id, 'I-02');
  assert.throws(() => addItem(doc(), { type: 'bug', title: 'x' }), UserError);
  assert.throws(() => addItem(doc(), { type: 'chore', title: '  ' }), UserError);
});

test('parseProgress counts only numbered sub-sections and ignores fences/decisions', () => {
  const md = [
    '## פיצ\'ר 1: x', '### 1.0 החלטות', '- [ ] לא נספר', '### 1.1 Backend — done', '- [x] a', '- [x] b',
    '### 1.2 Frontend', '- [x] c', '- [ ] d', '```', '- [ ] בתוך בלוק', '```', '### לא בטיפול', '- [ ] לא נספר',
  ].join('\n');
  const p = parseProgress(md);
  assert.deepEqual(p.sections.map((s) => [s.key, s.name, s.done, s.total]), [['§1.1', 'Backend', 2, 2], ['§1.2', 'Frontend', 1, 2]]);
  assert.equal(p.done, 3); assert.equal(p.total, 4);
  assert.equal(parseProgress('# nothing'), null);
});
