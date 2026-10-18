// Turns the SQL Prisma WOULD run (migrate diff --script) into a reviewable plan: each statement/action is classified
// (safe | review | destructive), gets a plain-language reason and, where it helps, a suggested fix; the whole plan gets a
// stable hash so an approval can be bound to the exact SQL. Pure functions — no I/O — so it is easy to test.
const crypto = require('node:crypto');

/** Split a SQL script into statements, ignoring `--` comments and respecting quotes. */
function splitStatements(script) {
  const out = [];
  let cur = '';
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < script.length; i += 1) {
    const ch = script[i];
    if (!inSingle && !inDouble && ch === '-' && script[i + 1] === '-') {
      while (i < script.length && script[i] !== '\n') i += 1; // skip comment to end of line
      cur += '\n';
      continue;
    }
    if (ch === "'" && !inDouble) inSingle = !inSingle;
    else if (ch === '"' && !inSingle) inDouble = !inDouble;
    if (ch === ';' && !inSingle && !inDouble) {
      const s = cur.trim();
      if (s) out.push(s);
      cur = '';
    } else {
      cur += ch;
    }
  }
  const tail = cur.trim();
  if (tail) out.push(tail);
  return out;
}

/** Split `a, b(c, d), e` on top-level commas (ALTER TABLE can carry several actions). */
function splitTopLevel(text) {
  const parts = [];
  let depth = 0;
  let cur = '';
  let inSingle = false;
  let inDouble = false;
  for (const ch of text) {
    if (ch === "'" && !inDouble) inSingle = !inSingle;
    else if (ch === '"' && !inSingle) inDouble = !inDouble;
    else if (!inSingle && !inDouble) {
      if (ch === '(') depth += 1;
      else if (ch === ')') depth -= 1;
      else if (ch === ',' && depth === 0) {
        parts.push(cur.trim());
        cur = '';
        continue;
      }
    }
    cur += ch;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
}

const ident = String.raw`"([^"]+)"`;

/** Classify one action of one statement. Returns { risk, why, table?, column?, op }. */
function classifyAction(statementKind, table, action) {
  const a = action.replace(/\s+/g, ' ').trim();
  let m;

  if ((m = a.match(new RegExp(`^ADD COLUMN ${ident} (.*)$`, 'i')))) {
    const column = m[1];
    const rest = m[2];
    const notNull = /\bNOT NULL\b/i.test(rest);
    const hasDefault = /\bDEFAULT\b/i.test(rest);
    if (notNull && !hasDefault) {
      return { op: 'add-column-not-null', table, column, risk: 'review', why: `New required column "${column}" has no default — fails if "${table}" already has rows.` };
    }
    if (hasDefault) {
      return { op: 'add-column-default', table, column, risk: 'review', why: `New column "${column}" with a default — every EXISTING row of "${table}" silently receives that value (the db push default trap).` };
    }
    return { op: 'add-column', table, column, risk: 'safe', why: `New optional column "${column}" — existing rows get NULL.` };
  }
  if ((m = a.match(new RegExp(`^DROP COLUMN ${ident}`, 'i')))) {
    return { op: 'drop-column', table, column: m[1], risk: 'destructive', why: `Drops column "${m[1]}" of "${table}" — its data is lost.` };
  }
  if ((m = a.match(new RegExp(`^ALTER COLUMN ${ident} (SET DATA )?TYPE `, 'i')))) {
    return { op: 'alter-type', table, column: m[1], risk: 'destructive', why: `Changes the type of "${table}"."${m[1]}" — values are converted (or the statement fails) and precision may be lost.` };
  }
  if ((m = a.match(new RegExp(`^ALTER COLUMN ${ident} SET NOT NULL`, 'i')))) {
    return { op: 'set-not-null', table, column: m[1], risk: 'review', why: `Makes "${table}"."${m[1]}" required — fails if any row has NULL there.` };
  }
  if ((m = a.match(new RegExp(`^ALTER COLUMN ${ident} DROP NOT NULL`, 'i')))) {
    return { op: 'drop-not-null', table, column: m[1], risk: 'safe', why: `"${table}"."${m[1]}" becomes optional.` };
  }
  if ((m = a.match(new RegExp(`^ALTER COLUMN ${ident} SET DEFAULT`, 'i')))) {
    return { op: 'set-default', table, column: m[1], risk: 'safe', why: `New default for "${table}"."${m[1]}" — affects only future inserts.` };
  }
  if ((m = a.match(new RegExp(`^ALTER COLUMN ${ident} DROP DEFAULT`, 'i')))) {
    return { op: 'drop-default', table, column: m[1], risk: 'review', why: `"${table}"."${m[1]}" loses its default — inserts that relied on it will fail.` };
  }
  if (/^ADD CONSTRAINT .* FOREIGN KEY/i.test(a)) {
    return { op: 'add-fk', table, risk: 'review', why: `New foreign key on "${table}" — fails if existing rows point at missing parents.` };
  }
  if (/^ADD CONSTRAINT .* (UNIQUE|PRIMARY KEY)/i.test(a)) {
    return { op: 'add-unique', table, risk: 'review', why: `New unique/primary key on "${table}" — fails if existing rows contain duplicates.` };
  }
  if (/^DROP CONSTRAINT/i.test(a)) {
    return { op: 'drop-constraint', table, risk: 'review', why: `Removes a constraint from "${table}" — integrity it enforced is no longer checked.` };
  }
  if (/^ADD CONSTRAINT/i.test(a)) {
    return { op: 'add-constraint', table, risk: 'review', why: `New constraint on "${table}" — may fail on existing rows.` };
  }
  if (/^RENAME /i.test(a)) {
    return { op: 'rename', table, risk: 'review', why: `Renames something on "${table}" — code and clients using the old name break.` };
  }
  return { op: 'unknown', table, risk: 'review', why: `Unrecognised change to "${table}" (${a.slice(0, 60)}…) — read it carefully.` };
}

/** Classify a whole statement into one or more actions. */
function classifyStatement(sql) {
  const s = sql.replace(/\s+/g, ' ').trim();
  let m;
  if ((m = s.match(new RegExp(`^CREATE TABLE ${ident}`, 'i')))) {
    return [{ op: 'create-table', table: m[1], risk: 'safe', why: `New table "${m[1]}".` }];
  }
  if ((m = s.match(new RegExp(`^DROP TABLE (IF EXISTS )?${ident}`, 'i')))) {
    return [{ op: 'drop-table', table: m[2], risk: 'destructive', why: `Drops table "${m[2]}" with ALL its rows.` }];
  }
  if (/^CREATE TYPE /i.test(s)) return [{ op: 'create-type', risk: 'safe', why: 'New enum type.' }];
  if (/^DROP TYPE /i.test(s)) return [{ op: 'drop-type', risk: 'destructive', why: 'Drops an enum type (usually part of removing/reshaping enum values).' }];
  if (/^ALTER TYPE .* ADD VALUE/i.test(s)) return [{ op: 'enum-add-value', risk: 'safe', why: 'New enum value.' }];
  if (/^ALTER TYPE .* RENAME/i.test(s)) return [{ op: 'enum-rename', risk: 'review', why: 'Renames an enum or value.' }];
  if (/^CREATE UNIQUE INDEX/i.test(s)) {
    const t = s.match(new RegExp(`ON ${ident}`, 'i'));
    return [{ op: 'create-unique-index', table: t && t[1], risk: 'review', why: `New unique index${t ? ` on "${t[1]}"` : ''} — fails if existing rows contain duplicates.` }];
  }
  if (/^CREATE INDEX/i.test(s)) {
    const t = s.match(new RegExp(`ON ${ident}`, 'i'));
    return [{ op: 'create-index', table: t && t[1], risk: 'safe', why: `New index${t ? ` on "${t[1]}"` : ''} (briefly locks writes on a big table).` }];
  }
  if (/^DROP INDEX/i.test(s)) return [{ op: 'drop-index', risk: 'review', why: 'Drops an index — queries may get slower; a unique index also stops enforcing uniqueness.' }];
  if ((m = s.match(new RegExp(`^ALTER TABLE (ONLY )?${ident} (.*)$`, 'i')))) {
    return splitTopLevel(m[3]).map((action) => classifyAction('alter', m[2], action));
  }
  return [{ op: 'unknown', risk: 'review', why: `Unrecognised statement (${s.slice(0, 60)}…) — read it carefully.` }];
}

const RANK = { safe: 0, review: 1, destructive: 2 };

/** Suggested fixes (text + SQL drafts) — heuristics to START a decision, never applied automatically. */
function suggestFixes(items) {
  const fixes = [];
  const dropped = items.filter((i) => i.op === 'drop-column');
  const added = items.filter((i) => i.op === 'add-column' || i.op === 'add-column-default' || i.op === 'add-column-not-null');
  const renameLooking = new Set();
  for (const d of dropped) {
    const twin = added.find((a) => a.table === d.table);
    if (twin) {
      renameLooking.add(d);
      fixes.push({
        about: `${d.table}."${d.column}" → "${twin.column}"`,
        text: `Dropping "${d.column}" while adding "${twin.column}" on the same table looks like a RENAME. As planned, the data in "${d.column}" is LOST. ` +
          'If it is a rename, do it as a reviewed pre-step instead:',
        sql: `ALTER TABLE "${d.table}" RENAME COLUMN "${d.column}" TO "${twin.column}";`,
        note: 'Then the plan no longer contains the drop/add. Re-plan after applying (in dev first).',
      });
    }
  }
  for (const i of items) {
    if (i.op === 'drop-column' && !renameLooking.has(i)) {
      fixes.push({
        about: `${i.table}."${i.column}"`,
        text: `Before dropping "${i.column}": decide whether its data is needed. A copy keeps it recoverable:`,
        sql: `CREATE TABLE "_bak_${i.table}_${i.column}" AS SELECT "id", "${i.column}" FROM "${i.table}";`,
        note: 'Adjust the key column ("id") to the table\'s primary key. The backup table stays until you drop it yourself.',
      });
    }
    if (i.op === 'drop-table') {
      fixes.push({
        about: i.table,
        text: `Before dropping table "${i.table}", keep a copy (or export it with pg_dump):`,
        sql: `CREATE TABLE "_bak_${i.table}" AS TABLE "${i.table}";`,
        note: 'The backup table stays until you drop it yourself.',
      });
    }
    if (i.op === 'add-column-not-null') {
      fixes.push({
        about: `${i.table}."${i.column}"`,
        text: `A required column with no default cannot be added to a table that has rows. Safer in three steps (the first two as pre-steps, the schema stays as is):`,
        sql: `ALTER TABLE "${i.table}" ADD COLUMN "${i.column}" <type>;\nUPDATE "${i.table}" SET "${i.column}" = <value for existing rows>;`,
        note: 'After that the plan only contains SET NOT NULL, which then succeeds. Fill the <placeholders> — or give the field a @default in the schema.',
      });
    }
    if (i.op === 'add-column-default') {
      fixes.push({
        about: `${i.table}."${i.column}"`,
        text: `Existing rows of "${i.table}" will all get the default. If old rows should get a DIFFERENT value, set it right after (as a pre-step it is too early — the column does not exist yet):`,
        sql: `-- run in the same approved change, after the push, if legacy rows need a different value:\nUPDATE "${i.table}" SET "${i.column}" = <legacy value> WHERE "createdAt" < <cutoff>;`,
        note: 'If the default is right for everyone, no action is needed. See feedback: a new @default can silently misclassify old rows.',
      });
    }
    if (i.op === 'alter-type') {
      fixes.push({
        about: `${i.table}."${i.column}"`,
        text: 'A type change needs an explicit conversion, and a check that every value survives it:',
        sql: `-- find rows that would not convert, e.g.:\nSELECT "id", "${i.column}" FROM "${i.table}" WHERE "${i.column}"::text !~ '^<pattern>$';\n-- then convert with an explicit cast:\nALTER TABLE "${i.table}" ALTER COLUMN "${i.column}" TYPE <type> USING "${i.column}"::<type>;`,
        note: 'Fill the <placeholders>; try it on a copy of the data first.',
      });
    }
    if (i.op === 'set-not-null') {
      fixes.push({
        about: `${i.table}."${i.column}"`,
        text: 'Find and fill NULLs first, otherwise SET NOT NULL fails:',
        sql: `SELECT count(*) FROM "${i.table}" WHERE "${i.column}" IS NULL;\nUPDATE "${i.table}" SET "${i.column}" = <value> WHERE "${i.column}" IS NULL;`,
        note: 'Fill the <placeholder>.',
      });
    }
    if (i.op === 'create-unique-index' || i.op === 'add-unique') {
      fixes.push({
        about: i.table || 'unique index',
        text: 'Check for duplicates before adding uniqueness (and decide which row wins):',
        sql: `SELECT <column>, count(*) FROM "${i.table}" GROUP BY <column> HAVING count(*) > 1;`,
        note: 'Fill <column>; remove or merge duplicates as a pre-step.',
      });
    }
    if (i.op === 'add-fk') {
      fixes.push({
        about: i.table,
        text: 'Look for orphaned rows before adding the foreign key:',
        sql: `SELECT c.* FROM "${i.table}" c LEFT JOIN "<ParentTable>" p ON p."id" = c."<fkColumn>" WHERE c."<fkColumn>" IS NOT NULL AND p."id" IS NULL;`,
        note: 'Fill the <placeholders>; delete or repair orphans as a pre-step.',
      });
    }
  }
  return fixes;
}

/** Build the plan from a `migrate diff --script` output. `sql` is whatever Prisma printed. */
// Backup tables made by an approved fix ("_bak_<table>…") are not in the schema, so Prisma would always want to drop
// them. They are kept on purpose until a person drops them by hand — the plan never lists or runs those drops.
const BACKUP_TABLE_DROP = /^DROP TABLE (IF EXISTS )?"_bak_[^"]*"/i;

function buildPlan(script) {
  const statements = splitStatements(script || '').filter((s) => !BACKUP_TABLE_DROP.test(s.replace(/\s+/g, ' ').trim()));
  const items = [];
  statements.forEach((sql, index) => {
    for (const action of classifyStatement(sql)) items.push({ ...action, statement: index + 1 });
  });
  const risk = items.reduce((worst, i) => (RANK[i.risk] > RANK[worst] ? i.risk : worst), 'safe');
  const tables = [...new Set(items.map((i) => i.table).filter(Boolean))];
  return {
    empty: statements.length === 0,
    statements,
    items,
    risk: statements.length === 0 ? 'none' : risk,
    tables,
    fixes: suggestFixes(items),
    sql: statements.map((s) => `${s};`).join('\n\n'),
    hash: planHash(statements),
  };
}

/** Stable hash of the exact statements (whitespace-normalised) — what an approval is bound to. */
function planHash(statements) {
  const normalised = statements.map((s) => s.replace(/\s+/g, ' ').trim()).join('\n');
  return crypto.createHash('sha256').update(normalised).digest('hex');
}

const ICON = { safe: '🟢', review: '🟡', destructive: '🔴' };

/** Human-readable report. `counts` is an optional { table: rowCount } map. */
function formatPlan(plan, { label = 'target', counts = null } = {}) {
  if (plan.empty) return `✔ ${label} is in sync with the schema — nothing to apply.`;
  const lines = [];
  lines.push(`Schema plan for ${label}: ${plan.statements.length} statement(s), overall risk ${ICON[plan.risk] || ''} ${plan.risk.toUpperCase()}`);
  lines.push(`Plan id: ${plan.hash.slice(0, 12)}  (full sha256 ${plan.hash})`);
  lines.push('');
  for (const i of plan.items) {
    const n = counts && i.table && counts[i.table] != null ? `  [${counts[i.table]} row(s) in "${i.table}"]` : '';
    lines.push(`${ICON[i.risk]} #${i.statement} ${i.risk.toUpperCase()}: ${i.why}${n}`);
  }
  if (plan.fixes.length) {
    lines.push('');
    lines.push('Suggested fixes (drafts to review — nothing here is applied automatically):');
    plan.fixes.forEach((f, idx) => {
      lines.push(`  ${idx + 1}. ${f.about}`);
      lines.push(`     ${f.text}`);
      f.sql.split('\n').forEach((l) => lines.push(`       ${l}`));
      lines.push(`     (${f.note})`);
    });
  }
  lines.push('');
  lines.push('SQL that will run:');
  lines.push(plan.sql);
  return lines.join('\n');
}

module.exports = { splitStatements, splitTopLevel, classifyStatement, classifyAction, buildPlan, planHash, formatPlan, suggestFixes };
