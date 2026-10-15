// Demo data for looking at feature 20 (נקודות לשיפור) in the browser — against the ISOLATED e2e
// stack only (backend :5006 on the postgres-test Docker service, frontend :8086). Refuses to run
// anywhere else, so it can never touch the real dev/prod database.
//
//   npm run start:e2e --prefix backend     (terminal 1)
//   npm run web:e2e --prefix frontend      (terminal 2)
//   node backend/scripts/seed-focus-points-demo.js
//   open http://localhost:8086 and sign in with one of the accounts below.
//
// Test-only accounts for the isolated database (they exist nowhere else):
const PASSWORD = 'demo-pass-123';
const ACCOUNTS = {
  leader: { username: 'demo_leader', email: 'demo_leader@example.com', note: 'ראש צוות + מנהל — רואה את מרחב הניהול' },
  m1: { username: 'demo_member1', email: 'demo_member1@example.com', note: 'חבר צוות רגיל' },
  m2: { username: 'demo_member2', email: 'demo_member2@example.com', note: 'חבר צוות רגיל' },
  m3: { username: 'demo_member3', email: 'demo_member3@example.com', note: 'חבר צוות רגיל' },
};
const APPROVER = { username: 'demo_approver', email: 'naveyadai@gmail.com' }; // allowlisted approver (teams.service.ts)

const BASE = 'http://localhost:5006';
if (process.env.BACKEND_URL && process.env.BACKEND_URL !== BASE) {
  console.error(`Refusing to seed ${process.env.BACKEND_URL}: this script only seeds ${BASE} (the isolated e2e backend).`);
  process.exit(1);
}

const DAY = 24 * 60 * 60 * 1000;
const day = (offset) => new Date(Date.now() + offset * DAY).toISOString().slice(0, 10);

async function call(method, path, token, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${text}`);
  return data;
}

async function login(username, email) {
  try {
    const r = await call('POST', '/auth/register', null, { username, email, password: PASSWORD });
    return { token: r.accessToken, id: r.user.id };
  } catch {
    const r = await call('POST', '/auth/login', null, { username: email, password: PASSWORD });
    return { token: r.accessToken, id: r.user.id };
  }
}

(async () => {
  await fetch(BASE).catch(() => { throw new Error(`The e2e backend is not running on ${BASE}`); });
  const approver = await login(APPROVER.username, APPROVER.email);
  const u = {};
  for (const [k, a] of Object.entries(ACCOUNTS)) u[k] = await login(a.username, a.email);

  const name = `צוות הדגמה ${new Date().toISOString().slice(11, 19)}`;
  const team = await call('POST', '/teams', u.leader.token, { name, approverEmail: APPROVER.email });
  await call('POST', `/teams/${team.id}/approve`, approver.token, {});
  for (const k of ['m1', 'm2', 'm3']) {
    const m = await call('POST', `/teams/${team.id}/members`, u.leader.token, { username: ACCOUNTS[k].username, role: 'DEVELOPER' });
    await call('POST', `/teams/${team.id}/members/${m.id}/accept`, u[k].token, {});
  }

  const past = await call('POST', `/teams/${team.id}/sprints`, u.leader.token, { name: 'ספרינט 41 (הסתיים)', startDate: day(-28), endDate: day(-15) });
  const current = await call('POST', `/teams/${team.id}/sprints`, u.leader.token, { name: 'ספרינט 42 (פעיל)', startDate: day(-14), endDate: day(14) });

  const say = (sprint, who, content, type, isAnonymous = false) =>
    call('POST', `/sprints/${sprint.id}/comments`, u[who].token, { content, type, isAnonymous });
  const slow = await say(past, 'm1', 'הבדיקות האוטומטיות רצות יותר מ-20 דקות ומעכבות כל מיזוג', 'IMPROVE');
  const deploy = await say(past, 'm2', 'תהליך הפריסה לא מתועד ואף אחד לא זוכר את כל השלבים', 'IMPROVE', true);
  const alerts = await say(past, 'm3', 'אין התראה כשהעלאת קובץ נכשלת', 'IMPROVE');
  await say(past, 'm1', 'הדמו השבועי עובד מצוין ומחזק את הצוות', 'KEEP');
  await say(current, 'm2', 'סביבת הבדיקות לא יציבה', 'IMPROVE');

  // Proposals from the team (the leader sees only HOW MANY proposed, never who).
  await call('POST', `/comments/${deploy.id}/propose`, u.m1.token);
  await call('POST', `/comments/${deploy.id}/propose`, u.m3.token);
  await call('POST', `/comments/${alerts.id}/propose`, u.m2.token);

  // A point already created from a comment and chosen for the finished sprint (its rating window is open),
  // a keep-point, and a task under the point.
  const point = await call('POST', `/teams/${team.id}/focus-points`, u.leader.token, {
    kind: 'IMPROVE', text: 'לזרז את הרצת הבדיקות האוטומטיות', initialScore: 2, sourceCommentIds: [slow.id],
  });
  await call('POST', `/teams/${team.id}/focus-points`, u.leader.token, { kind: 'KEEP', text: 'הדמו השבועי' });
  await call('PUT', `/sprints/${past.id}/focus-points/${point.id}/select`, u.leader.token);
  await call('POST', `/focus-points/${point.id}/tasks`, u.leader.token, {
    title: 'להריץ את הבדיקות במקביל ב-CI', assigneeId: u.m1.id, dueDate: day(10),
  });

  console.log(`\nנוצר צוות "${name}" בסביבת הבדיקה המבודדת.`);
  console.log('פתחו http://localhost:8086 והתחברו עם אחד מהחשבונות (הסיסמה בראש הקובץ הזה):');
  for (const a of Object.values(ACCOUNTS)) console.log(`  ${a.username.padEnd(14)} — ${a.note}`);
})().catch((e) => { console.error(e.message); process.exit(1); });
