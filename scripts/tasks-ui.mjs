#!/usr/bin/env node
// Local UI for product-backlog/TASKS.md:  npm run tasks:ui  ->  http://127.0.0.1:4777
// Reads and writes the markdown file directly (no database, no build step, no dependencies).
// Binds to loopback only and rejects foreign Host/Origin headers, so a web page you happen to visit can't write to it.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  dir, TASKS_FILE, readLines, writeLines, parseLines, splitText, moveItem, updateItem, addItem, parseProgress, UserError,
} from './tasks-lib.mjs';

const PORT = Number(process.env.TASKS_UI_PORT || 4777);
const HOST = '127.0.0.1';
const pageFile = path.join(path.dirname(fileURLToPath(import.meta.url)), 'tasks-ui.html');
const page = () => fs.readFileSync(pageFile, 'utf8'); // re-read per request: edit the HTML, refresh the tab

const progressOf = (file) => {
  if (!file || !/^\d+-.+\.md$/.test(file)) return null;
  try { return parseProgress(fs.readFileSync(path.join(dir, file), 'utf8')); } catch { return null; }
};

const rev = (lines) => crypto.createHash('sha1').update(lines.join('\n')).digest('hex').slice(0, 12);

function snapshot() {
  const lines = readLines();
  const { items, errors } = parseLines(lines);
  return {
    rev: rev(lines),
    errors,
    items: items.map((t) => {
      const s = splitText(t.text);
      return {
        id: t.id, type: t.type, severity: t.severity, size: t.size, section: t.section, done: t.done,
        title: s.title, linkFile: s.linkFile, linkLabel: s.linkLabel, blocked: s.blocked, progress: progressOf(s.linkFile),
      };
    }),
  };
}

const send = (res, status, body, type = 'application/json; charset=utf-8') => {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
};

const allowedHost = (h) => h === `${HOST}:${PORT}` || h === `localhost:${PORT}`;

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 20_000) reject(new UserError('בקשה גדולה מדי')); });
    req.on('end', () => { try { resolve(JSON.parse(data || '{}')); } catch { reject(new UserError('JSON לא תקין')); } });
  });
}

const actions = {
  move: (lines, b) => ({ lines: moveItem(lines, b.id, b.section, Number(b.index) || 0) }),
  update: (lines, b) => ({ lines: updateItem(lines, b.id, { size: b.size, blocked: b.blocked }) }),
  add: (lines, b) => addItem(lines, b),
};

const server = http.createServer(async (req, res) => {
  try {
    if (!allowedHost(req.headers.host)) return send(res, 403, { error: 'host' });
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === 'GET' && url.pathname === '/') return send(res, 200, page(), 'text/html; charset=utf-8');
    if (req.method === 'GET' && url.pathname === '/api/tasks') return send(res, 200, snapshot());

    if (req.method === 'GET' && url.pathname.startsWith('/doc/')) {
      const name = decodeURIComponent(url.pathname.slice(5));
      if (!/^[\w.\-]+\.md$/.test(name) || !fs.existsSync(path.join(dir, name))) return send(res, 404, { error: 'not found' });
      return send(res, 200, fs.readFileSync(path.join(dir, name), 'utf8'), 'text/plain; charset=utf-8');
    }

    const action = req.method === 'POST' && url.pathname.startsWith('/api/') && actions[url.pathname.slice(5)];
    if (action) {
      if (req.headers.origin !== `http://${req.headers.host}`) return send(res, 403, { error: 'origin' });
      const body = await readBody(req);
      const lines = readLines();
      if (body.rev !== rev(lines)) return send(res, 409, { error: 'הקובץ השתנה (Claude או עריכה ידנית). מרענן…', ...snapshot() });
      const out = action(lines, body);
      writeLines(out.lines);
      return send(res, 200, { ...snapshot(), id: out.id });
    }
    send(res, 404, { error: 'not found' });
  } catch (e) {
    if (e instanceof UserError) return send(res, 400, { error: e.message });
    console.error(e);
    send(res, 500, { error: 'שגיאת שרת' });
  }
});

server.listen(PORT, HOST, () => console.log(`משימות: http://${HOST}:${PORT}   (קובץ: ${path.relative(process.cwd(), TASKS_FILE)})`));
