# TEAM.md — navet-to-the-retro

> הקובץ ש-agents של ה-plugin `dev-team` קוראים ראשון. הוא מתאר איך הפרויקט **הזה** עובד. הידע עצמו
> (כללים מפורטים) יושב בקבצים שמצוינים כאן — הקובץ מצביע, לא משכפל. אם משהו כאן סותר את הקוד, הקוד מנצח
> ומתקנים את הקובץ.

## Project
כלי רטרוספקטיבות/ספרינטים לצוותים: יצירת צוות עם תהליך אישור דו-שלבי, ספרינטים, לוח רטרו (KEEP/IMPROVE),
נקודות לשיפור, משחק זיכרון, ייצוא ל-PPTX. מפתחים: נוה + שותף. עבודה בעברית (voice-to-text) ובבקשות קטנות
ואיטרטיביות.

## Stack & layout
| Area | Path | Tech |
|---|---|---|
| backend | `backend/` | NestJS 11 + Prisma 6 + PostgreSQL (Neon ב-dev/prod; `postgres-test` מ-`docker-compose.yml` ל-e2e) |
| frontend | `frontend/` | Expo SDK 57 (web + native), React 19, MUI (web בלבד), expo-router |
| frontend e2e | `frontend/e2e/` | Playwright — פרויקטים Desktop Chrome + Mobile Chrome (Pixel 7) |
| backend e2e | `backend/test/` | Jest + Supertest |
| specs | `specs/` | תיעוד עובדתי per-feature, נגזר מקריאת קוד |
| backlog | `product-backlog/` | קובץ לכל פיצ'ר + `README.md` (טבלת סטטוס) + `IDEAS.md` + `BUGS.md` |
| mockups | `.design/` | מוקאפים של Claude Design (מקור אמת נפרד לצבע — ר' Role notes → design) |

monorepo עם npm workspaces. פריסה: Fly.io.

## Conventions (read before working)
| Role | Files to read first |
|---|---|
| backend-developer | `backend/AGENTS.md`, `specs/00-shared-conventions.md` (+ `specs/02-teams-and-approval.md` אם נוגעים ב-teams/auth) |
| frontend-developer | `frontend/CLAUDE.md` → `frontend/AGENTS.md` → `frontend/UI-GUIDELINES.md` (חובה, כולל checklist בסעיף 7 ומובייל בסעיף 11) |
| qa-engineer | `frontend/AGENTS.md` (Testing), `backend/AGENTS.md` (Testing), `frontend/playwright.config.ts`, helpers ב-`frontend/e2e/*-ui.ts`, `specs/README.md` |
| ux-ui-designer | `frontend/UI-GUIDELINES.md`, `frontend/src/design/tokens.ts`, `frontend/src/components/ui/`, `.design/AGENTS.md`, `frontend/UI-MIGRATION-BACKLOG.md` |
| security-checker | `backend/AGENTS.md` (Auth), `specs/00-shared-conventions.md` §3, `product-backlog/BUGS.md` |
| code-reviewer | כל הנ"ל שרלוונטי לקבצים ב-diff |
| product-manager | `product-backlog/README.md`, `CLAUDE.md` (סעיף הטמעה), `product-backlog/IDEAS.md` |

## Commands
| Purpose | Command |
|---|---|
| dev (backend+frontend) | `npm run dev` (מהשורש; `infisical run` + `concurrently`) |
| כל הסוויטה | `npm test` (backend unit, backend e2e, frontend unit, frontend e2e) |
| backend unit | `npm test --prefix backend` |
| backend e2e | `npm run test:e2e --prefix backend` (דורש `postgres-test` למעלה) |
| frontend unit | `npm test --prefix frontend` |
| typecheck | `npx tsc --noEmit -p .` מתוך `frontend/` — ידועות כרגע 4 שגיאות שאינן קשורות לשינוי (`Colors` ב-`constants/theme`, טיפוסי `react-dom/client`); מה שחשוב: אפס שגיאות **חדשות** |
| frontend e2e | `npx playwright test [spec...]` מתוך `frontend/` — מרים backend מבודד על 5006 ו-web על 8086 (`reuseExistingServer:false`) |
| סכמה → DB בדיקות | `npm run schema:test:push --prefix backend` (רץ גם אוטומטית לפני `test:e2e`/`start:e2e`) |
| בדיקת סנכרון סכמה | `npm run schema:check:test --prefix backend` (בדיקות) · `npm run schema:check:prod --prefix backend` (**נוה בלבד**, קריאה בלבד מול Neon) |
| deploy | `npm run deploy` — **לא להריץ באופן אוטומטי**: מריץ הכל, ואז **שער סכמה מול production**, ורק אז `fly deploy` |

## Hard rules (never)
- **לא לגעת ב-DB האמיתי (Neon, פורט 5005):** לא curl, לא seed, לא סקריפטים. כל בדיקה ידנית/אוטומטית רצה רק על
  backend e2e מבודד (5006) מול `postgres-test`, ומנקים אחרי עצמם.
- **`npx prisma db push` מול Neon — רק באישור מפורש של נוה.** מול `postgres-test` (`.env.test`) מותר.
- שדה חדש עם `@default()` על טבלה קיימת מסווג שורות ישנות בשקט (מלכודת ה-backfill) — לתכנן backfill ולעצור.
- לא `git push`, לא deploy, לא לקרוא קבצי `.env*`.
- **הכללים האלה נאכפים ב-hook, לא רק כהוראה:** `.claude/guard.json` נקרא על ידי ה-hooks של plugin `dev-team` ומונע (deny) / מבקש אישור (ask)
  לפני פקודת shell: curl אל 5005, כל חיבור ל-`neon.tech`, `prisma db push|migrate|studio` בלי `.env.test`, קריאת `.env`, `psql`
  שאינו על 5433; ו-ask על `fly deploy`/`deploy.sh`, `schema:check:prod`, ומחיקת ה-volume של postgres-test. לעדכון כלל — לערוך את הקובץ.
  ה-hook הוא רשת ביטחון נגד תקלות, לא sandbox.
- לא להמיר מסך קיים למערכת העיצוב כתוספת אגבית למשימה אחרת — זו עבודה ממוקדת (`UI-MIGRATION-BACKLOG.md`).

## Backlog
- dir: `product-backlog/` · ideas: `IDEAS.md` · bugs: `BUGS.md`
- priority marker: `עדיפות מיידית`
- draft marker: `— טיוטה, ממתין להחלטות` (בכותרת: `## פיצ'ר N: <name> — טיוטה, ממתין להחלטות`)
- headings: Backend=`### N.1 Backend` · Frontend=`### N.2 Frontend` · Tests=`### N.3 בדיקות` ·
  Touchpoints=`### נקודות מרכזיות (touchpoints)` · Onboarding=`### N.4 הטמעה`
- status strings: specified=`מאופיין במלואו, מוכן למימוש — טרם הותחל` · draft=`טיוטה — ממתין להחלטות (X שאלות פתוחות)` ·
  backend done=`Backend מומש, Frontend/בדיקות טרם הותחלו` · backend+frontend done=`Backend+Frontend מומש, בדיקות טרם הותחלו` ·
  done=`מומש ✅`
- **`BUGS.md`:** באג שמתוקן **נמחק** מהקובץ (לא מסמנים `[x]`), ומעדכנים את טבלת הסיכום (ספירה לפי חומרה), שורת
  "הכי דחוף" וטבלת האשכולות. לא ממספרים מחדש. תיקון חלקי = הרשומה נשארת ומקוצרת. באג חדש שנחשף → נוסף עם המספר
  הבא. הכלל חל על כל סשן, גם אם לא ביקשו.

## Definition of done (extra gates)
- **הטמעה (חוסם סגירה):** כל פיצ'ר מסווג בקובץ שלו (`### N.4 הטמעה`) לרמה א'/ב'/ג' לפי "סטנדרט הטמעה" ב-
  `product-backlog/README.md`. רמה א'/ב' = רשומה ב-`frontend/src/features/onboarding/registry.ts` **וגם** ב-
  `backend/src/onboarding/onboarding-features.ts` (אותו key/audience/since), מחרוזות ב-`Strings.onboarding.features`,
  ועדכון צעד/עוגן במדריך אם הפיצ'ר משנה את המסלול הראשי. רמה ג' כותבת במפורש "אין השפעה על הטמעה" + נימוק.
- **`trackEvent()` על כל לחיץ חדש** (כפתור/toggle/filter) — כלל קבוע מ-2026-09-02.
- **כל פיצ'ר frontend מקבל spec של Playwright** (Desktop + Mobile, DB מבודד).
- כל מחרוזת משתמש ב-`Strings` (`frontend/src/constants/strings.ts`), לא inline.
- נבדק בפועל ברוחב טלפון (~375px) לפי `UI-GUIDELINES.md` §7/§11; קומפוננטה מתקרבת ל-250 שורות → מפצלים (§13).
- באג שתוקן/נמצא → עדכון `BUGS.md` לפי הכלל למעלה; התנהגות מתועדת שהשתנתה → עדכון `specs/`.

## Language & tone
- דיווחים למשתמש: **עברית**, תמציתי.
- מחרוזות UI: עברית, ב-`Strings`. הקוד, שמות קבצים ו-commit messages באנגלית.

## Role notes
### product
- כל קובץ פיצ'ר כולל `### N.4 הטמעה`: הצעת רמה (א' זרימה בסיסית / ב' גילוי / ג' בלי השפעה) + נימוק בשורה; לרמה א'/ב' —
  `key`, קהל (`MEMBER`/`MANAGEMENT`/`ALL`), `since`, וצעד/עוגן מושפע במדריך. הרמה **הצעה** שנוה מאשר עם שאר
  השאלות הפתוחות. מוסיפים גם פריט הטמעה לצ'קליסט `### N.2 Frontend`.
- `IDEAS.md` הוא שכבה מוקדמת (שורה-שתיים); רק אפיון מלא הופך לקובץ ממוספר. זה שונה מ-`UI-MIGRATION-BACKLOG.md`.

### backend
- Auth ידני: **כל** מתודת controller מוגנת קוראת `AuthService.validateToken(authHeader)` בראש הגוף. אין Guards — אין
  מנגנון שיאכוף את זה, וקל לשכוח.
- DTO בלי `class-validator` ובלי `ValidationPipe` גלובלי: שדה חסר מגיע ל-Prisma ומחזיר 500. מאמתים ידנית.
- חריגות NestJS ישירות מה-service (401/403/404/409) עם הודעה בעברית; בלי exception filter.
- משאב per-team חדש עם mutation לאדמין + soft-delete → להעתיק את `backend/src/invites/` (לא `teams`).
- הרשאת "אדמין או ראש צוות" → `assertCanManageTeamContent` (`teams/team-permissions.util.ts`), לא לגזור מחדש.
- תשובת `User` מסירה `password` ידנית. JWT: 12h, סוד מ-`getJwtSecret()`.
- גישה למשאב של צוות מחזירה 404 (לא 403) ללא-חבר, כדי שלא יהיה אפשר לנחש ids (BUG-40).
- סכימה: `prisma db push` (אין migrations). `NODE_OPTIONS=--experimental-vm-modules` חובה בסקריפטי הטסט — לא להסיר.
- אחרי שינוי סכימה מאתחלים את ה-backend בדוקר; אחרי שינוי `.env` — `--force-recreate`.

### frontend
- Platform branching: `*.web.tsx`/`*Web` (MUI) מול native (RN) — לא מערבבים בנתיב רינדור אחד; מממשים **את שניהם**.
- אין auto-refetch-on-focus: fetch ב-mount בלבד + כפתור "רענן" מפורש. אין `Grow`/`Fade`/`pulse` בטעינת מסך.
- מערכת עיצוב: `useTheme()`/`tokens.ts` בלבד; קומפוננטות מ-`@/components/ui`; `<Page>`+`<PageHeader>`+`<Grid>`; כפתור
  primary אחד למסך; `dir` בשורש, מאפיינים לוגיים בלבד; בלי אימוג'י על בקרים. RTL: `row-reverse` רק בקוד native קיים.
- Jest: `await fireEvent` (לא `act()`); אובייקטי `Error` ב-mock ש-rejected; נתיבי `@/assets/*`.
- ה-UI-GUIDELINES §7 הוא ה-checklist הרשמי; קומפוננטת web+native חייבות להישאר מסונכרנות.

### qa
- e2e: תמיד מול backend מבודד (5006) — לעולם לא 5005. helpers ב-`frontend/e2e/*-ui.ts` (למשל `sprint-actions-ui.ts`,
  `team-members-ui.ts`) — משתמשים בהם ומוסיפים שם, לא משכפלים סלקטורים.
- לחצן שנסגר מאחורי תפריט/קפל (פעולות ספרינט מאחורי "⋯", "כלי ספרינט · N" מקופל) נפתח דרך ה-helper.
- קריסת דפדפן/`session closed` בלי כשל assertion = flake תשתיתי: מריצים שוב פעם אחת ומציינים בדיווח.
- פרויקט Mobile חייב לרוץ גם הוא; מוודאים היעדר גלישה אופקית כשמשנים פריסה.

### design
- `.design/AGENTS.md` (Claude Design) ו-`frontend/UI-GUIDELINES.md` + `tokens.ts` הם **שני מקורות אמת נפרדים** לצבע —
  שינוי באחד מחייב עדכון ידני של השני.
- backlog המיגרציה (`frontend/UI-MIGRATION-BACKLOG.md`) סגור (69/69); סוכן `ui-migration` נשאר ב-`.claude/agents/`
  של הפרויקט. עיצוב בשורת פעולות: מעל 2 badge/כפתור מול תווית — שתי שורות מכוונות, לא `flexWrap` (§11).
- טעם: מוצק ומעשי, מאופק ("פחות AI"), בלי אימוג'י על בקרים, ווידג'טים מותאמים על פני ברירת-מחדל.

### security
- נקודות תורפה ידועות לבדוק בכל diff רלוונטי: (1) `validateToken` נשכח — אין Guards; (2) IDOR/חברות בצוות — לוודא
  `ACTIVE` מול הצוות של המשאב ולא רק מול ה-id ב-URL, ו-404 אחיד (BUG-40); (3) שערי תפקיד לא עקביים: `isAdmin` מול
  `role==='TEAM_LEADER'` מול `team.creatorId` (למשל סיכום ספרינט = יוצר/אדמין בלבד; נקודות לשיפור = אדמין/ראש צוות);
  (4) אין ולידציה ב-DTO — גדלים, טיפוסים, mass-assignment ל-Prisma; (5) `password` בתשובות User; (6) Google
  OAuth: קשירת `state` לדפדפן (BUG-20/21) וקישור חשבון לפי אימייל; (7) ingest של Telegram: אימות secret ומיפוי שולח;
  (8) מייל (SMTP/Resend): הזרקת headers, טקסט משתמש ב-HTML, נמענים שרירותיים; (9) ייצוא PPTX: שמות קבצים ב-
  `Content-Disposition`; (10) payload של PostHog ללא PII/טוקנים; (11) `EXPO_PUBLIC_*` ציבורי מעצם הגדרתו; (12) בחירת
  host של ה-backend בצד לקוח; (13) throttling ל-login/הרשמה/הזמנות/שליחת מייל.
- באג חדש אמיתי שלא ב-`BUGS.md` → מציעים רשומה (מספר הבא, חומרה, מיקום, שחזור) ל-session הראשי; לא עורכים בעצמכם.
