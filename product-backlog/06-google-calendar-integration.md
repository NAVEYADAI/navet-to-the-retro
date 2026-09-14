## פיצ'ר 6: שילוב עם יומן Google — שלב א'

### נקודות מרכזיות (touchpoints)

- **מודלים (Prisma):** `GoogleCalendarConnection` (חדש, per-user: `userId` FK cascade, `accessToken, refreshToken, expiresAt, googleAccountEmail, calendarId, isRevoked`), `SprintGoogleEvent` (חדש: `sprintId`+`connectionId` → `googleEventId`).
- **Backend:** מודול חדש `backend/src/google-calendar/` (service+controller), `backend/src/sprints/sprints.service.ts::create`/`update` (hooks ליצירה/עדכון אירוע יומן, עטופים try/catch כמו `EmailService`).
- **Frontend:** `frontend/src/features/settings/components/google-calendar-card.tsx`, `frontend/src/features/settings/hooks/use-google-calendar.ts`, `frontend/src/app/settings.tsx`.
- **Endpoints:** `GET google-calendar/connect`, `GET google-calendar/callback`, `GET google-calendar/status`, `PATCH google-calendar/disconnect`.
- **משתני סביבה:** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` (דרך infisical + `docker-compose.yml`, לא ב-`.env` בלבד).
- **חולק Google Cloud OAuth client עם פיצ'ר 7** (אותו client id/secret, redirect URI נפרד) — שינוי בהגדרות ה-OAuth consent screen/client משפיע על שניהם.


מטרת הפיצ'ר: לסמן ביומן Google את מועדי הספרינטים הקיימים במערכת, כדי שחברי צוות יראו אותם
בלוח השנה הרגיל שלהם בלי לבדוק את האפליקציה בנפרד. הפיצ'ר מחולק לשני שלבים מפורשים: **שלב
א'** — סנכרון טווח תאריכי הספרינט (`startDate`/`endDate`) עצמו ליומן; **שלב ב' (עתידי, לא
ב-MVP)** — הוספת אירוע נפרד לתאריך שבו מתוכנן להתקיים הרטרו, נפרד מטווח הספרינט.

**עדכון (2026-09-07): החסימה הוסרה.** נוה יצר את ה-Google Cloud project + OAuth consent
screen + client ושמר `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/`GOOGLE_REDIRECT_URI`
ב-infisical. Backend של שלב א' (6.1) מומש במלואו — ר' שם לפרטים ולמה שנשאר לנוה לבצע ידנית
(`db push` אמיתי).

### 6.0 החלטות

**ברירות מחדל טכניות (לא דורשות אישור נוה):**

1. **ספריית אינטגרציה: `googleapis` (החבילה הרשמית של Google ל-Node.js), לא קריאות REST
   ידניות.** נבדק בגריפ מקיף (`google`, `oauth`, `calendar`, case-insensitive) בכל הריפו —
   ההתאמות היחידות הן אזכור לא-קשור של Google Fonts ב-`frontend/AGENTS.md`/
   `global-web-styles.ts`/`global.css`. אין שום תלות קיימת ב-`backend/package.json` או
   ב-`frontend/package.json` בשם שמכיל "google" — זו תלות חדשה לגמרי, באותה רוח שבה
   `pptxgenjs` נוספה עבור פיצ'ר 1 (ראו שם 1.0.3).
2. **אירוע יומן מסוג "כל היום" (all-day), לא אירוע עם שעה.** נבדק בקוד: שדות התאריך של
   ספרינט הם date-only הלכה למעשה — טופס העריכה (`sprint-retro-board-web.tsx` שורות 236-237)
   משתמש ב-`Field type="date"` ושומר state כ-`toISOString().slice(0,10)` (שורות 156-157),
   בלי שום קלט שעה. `Sprint.startDate/endDate` ב-`schema.prisma` הם אמנם `DateTime`, אבל
   בפועל תמיד חצות. אין הגיון להמציא שעה שלא קיימת במקור.
3. **כשלון סנכרון ליומן לא חוסם יצירה/עריכה של ספרינט.** יש כבר תקדים מדויק לזה בקוד:
   `EmailService` (`backend/src/email/email.service.ts`, שורות 37-49) עוטף כל קריאה חיצונית
   ב-try/catch, מתעד אזהרה ב-logger, ולא זורק החוצה — יצירת/עדכון צוות ממשיכים גם אם השליחה
   נכשלה. אותו דפוס בדיוק עבור קריאות ל-Google Calendar API מתוך `sprints.service.ts::create`/
   `update`.
4. **סודות OAuth (client id/secret) דרך משתני סביבה + infisical, לא hardcoded.** תקדים מדויק:
   `EmailService` קורא `process.env.RESEND_API_KEY`/`EMAIL_FROM`, מזהיר בלוג ולא שולח בפועל
   אם חסר (שורות 8-15) — **בלי** fallback קבוע בקוד (בניגוד ל-`JWT_SECRET` שכן נופל ל-secret
   קשיח, מתועד כ"Bug candidate" ב-`specs/00-shared-conventions.md` §3 — **לא** לחזור על
   האנטי-פטרן הזה עבור `GOOGLE_CLIENT_SECRET`). `npm run dev` כבר עובר דרך `infisical run`
   (`package.json` שורש) — משתנים חדשים (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
   `GOOGLE_REDIRECT_URI`) מתווספים לאותה סביבת infisical, לא לקובץ `.env` מקומי.
5. **בדיקות אוטומטיות לא קוראות ל-Google API האמיתי.** `googleapis` client ממוקק ב-Jest (כמו
   ש-`pptxgenjs`/`resend` client כבר לא נקראים באמת בטסטים רלוונטיים) — אין דרך סבירה
   להריץ OAuth אמיתי מול חשבון Google בסביבת e2e מבודדת.

**החלטות מוצריות לשלב א' (נוה, 2026-09-06):**

1. **Google Cloud project / OAuth client — טרם נוצר.** זו פעולה חיצונית לקוד (קונסולת
   Google Cloud) שנוה יבצע בהמשך ויספק client id/secret דרך infisical (ר' ברירת מחדל טכנית
   #4). **זהו החוסם היחיד לתחילת מימוש שלב א'** — שאר ההחלטות המוצריות הוכרעו.
2. **חיבור אישי לכל משתמש**, לא יומן משותף לצוות. כל חבר צוות מחבר את חשבון ה-Google
   **שלו**, והאירוע נוצר בלוח השנה האישי שלו — אם כמה חברי צוות מחוברים, אותו ספרינט יוצר
   אירוע אחד לכל חיבור פעיל. ה-FK בטבלת החיבורים החדשה הוא `userId` (לא `teamId`).
3. **מי מורשה לחבר/לנתק: כל חבר צוות**, לא רק admin/TEAM_LEADER — עקבי עם היות זה חיבור אישי
   (כל אחד מחבר/מנתק רק את שלו). **אין guard מיוחד** מעבר לחברות בצוות עצמה —
   `assertCanManageTeamContent` **לא** רלוונטי כאן (בניגוד לפיצ'רים 2/3/5).
4. **עדכון תאריכי ספרינט קיים מעדכן את האירוע הקיים ביומן** (`events.patch`), לא מחיקה
   ויצירה מחדש. עקבי עם פיצ'ר 5 (`SprintLengthChange`) — אותה נקודת-כניסה ב-
   `sprints.service.ts::update` שכבר משווה ערך-ישן-מול-חדש ויוצרת רשומת היסטוריה, מפעילה גם
   את עדכון היומן (לכל חיבור Google פעיל של כל חבר צוות).
5. **UI לחיבור/ניתוק: כרטיס חדש בהגדרות** (`frontend/src/features/settings/`, ליד
   `ProfileFormCard`/`AppearanceCard`) — נובע ישירות מהחלטה #2 (חיבור אישי, לא פאנל בתוך
   `team-card.tsx`).
6. **מחיקת ספרינט — לא רלוונטי כרגע.** מחיקת ספרינט לא קיימת במערכת בכלל (נדחה במפורש
   בפיצ'ר 4). ברירת מחדל טכנית: כשתתווסף מחיקת ספרינט בעתיד, למחוק גם את האירוע ביומן
   (`events.delete`) — לא להשאיר יתום. אין צורך בהחלטת נוה נפרדת על זה עכשיו.

**שלב ב' (תאריך רטרו נפרד) — נשאר עתידי/לא ב-MVP** לפי בחירת נוה, ולא רק בגלל חוסר החלטה:
אין כרגע מודל "רטרו" עצמאי במערכת (ר' ממצאי מחקר) שאפשר לחבר אליו תאריך, כך שכל פירוט טכני
של שלב ב' יידחה עד שהצורך בישות כזו יעלה בפני עצמו (למשל דרך `product-manager` נפרד, לא
כהמשך אוטומטי של שלב א').

### ממצאי מחקר

- **אין שום אינטגרציית Google קיימת בקוד.** גריפ מקיף (`google|oauth|calendar`,
  case-insensitive) על כל הריפו העלה רק שלוש התאמות לא-קשורות (Google *Fonts*, לא Google
  *Calendar/OAuth*): `frontend/AGENTS.md` (טעינת גופן Rubik), `frontend/src/constants/
  global-web-styles.ts`, `frontend/src/global.css`. אין `googleapis`/`google-auth-library`
  בשום `package.json` (שורש/backend/frontend).
- **`User` (schema.prisma:10-24) אין לו שום שדה אחסון טוקן OAuth/refresh token.** רק
  `id, username, email, password, firstName?, lastName?, role, createdAt` + יחסים
  (`createdTeams, pendingApprovals, members, comments, createdInvites`). כל אחסון סוד חיצוני
  בקוד היום (JWT secret, Resend API key) הוא ברמת **process.env**, לא בטבלת DB — חיבור
  Google Calendar יהיה **הפעם הראשונה** שצריך לשמור סוד per-user/per-team ב-Postgres עצמו
  (access token + refresh token), לא רק ב-env גלובלי. אין תשתית הצפנה-במנוחה (encryption at
  rest) קיימת בקוד לעמודה כזו — שווה תשומת לב נוספת בזמן המימוש, גם אם לא נשאל כשאלה פתוחה
  במפורש.
- **`Sprint` (schema.prisma:188-200 (עודכן 2026-09-14)):** `id, name, description?, startDate, endDate, teamId,
  createdAt` — בדיוק כמו שתועד כבר בממצאי מחקר פיצ'ר 5. אין שום שדה קיים לקישור לאירוע יומן
  חיצוני (`googleEventId` וכו') — יידרש שדה/טבלה חדשה.
- **תאריכי ספרינט הם date-only בפועל, לא datetime עם שעה משמעותית** — ר' ברירת מחדל טכנית
  #2 למעלה, מבוסס על `sprint-retro-board-web.tsx` שורות 156-157, 236-237.
- **אין שום מודל "רטרו" עצמאי בנתונים.** גריפ אחר `retro|Retro` ב-`schema.prisma` לא העלה
  שום תוצאה — "רטרו" קיים רק כמסך/פיצ'ר frontend (`SprintRetroBoard`,
  `frontend/src/features/retro/`) שנפתח לתוך `Sprint` קיים ומציג תגובות (`Comment`) ששייכות
  אליו; אין `Retro.date`/`Retro.scheduledAt` או כל דבר דומה. זה בדיוק מה שהופך את "שלב ב'"
  (תאריך רטרו נפרד, ר' 6.0 למעלה) לחוסם: הוא לא יכול "לסמן תאריך רטרו" בלי שקודם יוחלט
  אם/איך תאריך כזה בכלל נשמר — לכן שלב ב' נשאר עתידי/לא ב-MVP במפורש, לא רק חוסר-החלטה.
  **[הערת ביקורת 2026-09-14]:** נוסח קודם של המשפט הזה הפנה ל"שאלה פתוחה #7" שאינה קיימת
  יותר בשום מקום בקובץ (שריד מטיוטה מוקדמת לפני שההחלטות המוצריות גובשו ומוספרו) — תוקן.
- **תבנית מדויקת ל-"per-team-owned entity עם FK cascade + guard admin" — `TeamInvite`**
  (`schema.prisma:60-76` + `backend/src/invites/invites.service.ts`), **מונחית במפורש**
  ע"י `backend/AGENTS.md` §"Per-team-owned entities": "copy `invites`, not `teams`". טבלת
  חיבורי Google (הוכרע כ-per-user, ר' החלטה מוצרית #2 למעלה) צריכה לעקוב אחרי
  אותו מבנה: FK cascade לישות הבעלים, לא hard-delete אלא דגל ביטול/ניתוק.
- **guard לפעולות ניהול-תוכן-צוות כבר קיים ומוכן לשימוש חוזר:**
  `backend/src/teams/team-permissions.util.ts::assertCanManageTeamContent(prisma, teamId,
  requesterId)` — `isAdmin===true || role==='TEAM_LEADER'`, כבר משמש פיצ'רים 2, 3 ו-5.
  **לא נבחר** לחיבור/ניתוק כאן — הוכרע (החלטה מוצרית #3) שכל חבר צוות רשאי, לא רק
  admin/TEAM_LEADER.
- **דפוס טיפול-חן בכשל שירות-חיצוני-אופציונלי כבר קיים ומאומת ב-Jest:**
  `backend/src/email/email.service.spec.ts` — בודק בפירוש מה קורה כש-`RESEND_API_KEY` חסר
  (לוג בלבד, לא זריקת שגיאה). אותה גישה מדויקת מתאימה לחיבור Google Calendar (שורה 5 בברירות
  המחדל הטכניות למעלה).
- **מקום UI טבעי לחיבור "אישי" (הוכרע כך, ר' החלטה מוצרית #2/#5) כבר קיים:**
  `frontend/src/features/settings/` (`ProfileFormCard`, `AppearanceCard`, `AdminTeamsCard`,
  מוצגים דרך `frontend/src/app/settings.tsx`) — מסך "הגדרות" קיים עם דפוס card-per-concern
  מדויק, כרטיס "חיבור יומן Google" חדש ישב שם באותה רוח בלי לבנות מסך חדש מאפס. **זה אכן
  המקום שנבחר בפועל במימוש (§6.2).**

### 6.1 Backend — שלב א' (סימון תאריכי ספרינט ביומן) — מומש; `db push` רץ בהצלחה מול Neon האמיתי (2026-09-11)

- [x] התקנת `googleapis` ב-`backend/package.json` (תלות חדשה — ראו ברירת מחדל טכנית #1). בוצע
      (`npm install googleapis@178.0.0 --workspace=backend --legacy-peer-deps`, גרסה 178.0.0).
- [x] מודל Prisma חדש `GoogleCalendarConnection` ב-`backend/prisma/schema.prisma`: `userId` FK
      ל-`User` (cascade), `accessToken, refreshToken, expiresAt, googleAccountEmail,
      calendarId @default("primary"), isRevoked @default(false), createdAt` — על תבנית
      `TeamInvite` בדיוק. הוספתי גם מודל עזר `SprintGoogleEvent` (לא מפורש בבאקלוג, אך נדרש
      לוגית): ממפה `sprintId` + `connectionId` → `googleEventId`, כי חיבור אחד יכול להחזיק
      אירועים לכמה ספרינטים בו-זמנית (`@@unique([sprintId, connectionId])`, cascade על שניהם).
- [x] `npx prisma db push` — **רץ בהצלחה מול Neon האמיתי (2026-09-11)**, כחלק מדחיפת סכימה
      משולבת עם פיצ'ר 7 (אותה הרצת `db push` הביאה גם את `GoogleCalendarConnection` וגם את
      `SprintGoogleEvent` ל-production — אומת ישירות מול ה-DB: שני המודלים קיימים בפועל). רץ
      גם מול `postgres-test` בשלב מוקדם יותר, כך שה-e2e (6.3) יכול לרוץ.
- [x] מודול חדש `backend/src/google-calendar/` (`google-calendar.controller.ts` +
      `google-calendar.service.ts` + `google-calendar.module.ts`), בהשראת מבנה `invites`.
      **שינוי מהנוסח המקורי בבאקלוג (`.../google/connect`, `.../google/callback`) לפי החלטת
      ניתוב שכבר הובהרה לנוה** (ומחייבת התאמה ל-redirect URI הרשום ב-Google Cloud Console):
      prefix `google-calendar`, לא `google`. `GET google-calendar/connect` (מאומת עם
      `validateToken` כרגיל) מחזיר `{ authUrl }` כ-JSON ולא מבצע redirect בעצמו — קריאת
      דפדפן מלאה (לחיצה על כפתור) לא יכולה לשאת Authorization header, אז ה-frontend מקבל את
      ה-URL ומבצע `window.location.href` בעצמו. `state` חתום (JWT, אותו `JWT_SECRET`) נושא את
      `userId` דרך ה-redirect אל Google וחזרה. `GET google-calendar/callback` (ללא auth header
      אפשרי — Google מפנה את הדפדפן ישירות) מאמת את ה-`state`, מחליף `code` בטוקנים, שומר
      חיבור חדש, ומבצע redirect בחזרה ל-`FRONTEND_URL/settings?googleCalendar=connected|error`.
      הוספתי גם `GET google-calendar/status` (לא בנוסח המקורי, אך נדרש כדי שה-frontend יידע מה
      להציג בכרטיס ההגדרות — "מחובר כ-X" מול "לא מחובר"). משתני הסביבה
      `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/`GOOGLE_REDIRECT_URI` כבר ב-infisical (בוצע ע"י
      נוה) ונקראים דרך `process.env` בלבד — בלי fallback קשיח, כמו `EmailService`.
- [x] חיבור/ניתוק: אין guard נוסף — `validateToken` בלבד קובע את ה-`userId`, ואין שום צ'ק על
      `teamId`/`isAdmin` בשום מקום ב-`google-calendar` module (עקבי עם החלטה 6.0.3 — זה לא
      per-team, `assertCanManageTeamContent` לא רלוונטי).
- [x] `sprints.service.ts::create`: אחרי יצירת הספרינט, קריאה ל-`GoogleCalendarService
      .syncSprintCreated` עטופה ב-try/catch (דפוס `email.service.ts`) — לכל חיבור פעיל
      (`isRevoked=false`) של כל חבר בצוות, `events.insert` עם `start.date`/`end.date`
      (all-day; `end.date` בפועל exclusive לפי Google API, אז + יום אחד מ-`endDate` בפועל כדי
      שהיום האחרון של הספרינט יופיע באירוע), title=שם הספרינט, description עם שם הצוות.
      `googleEventId` שהוחזר נשמר ב-`SprintGoogleEvent` לכל חיבור. כשלון על חיבור בודד מתועד
      בלוג (`Logger.warn`) ולא זורק — לא חוסם את שאר החיבורים ולא את יצירת הספרינט.
- [x] `sprints.service.ts::update`: השוואת `startDate`/`endDate` ישן-מול-חדש מומשה **ישירות
      כאן** (לא דרך פיצ'ר 5 — `SprintLengthChange`/היסטוריית שינויים עדיין לא קיימת בקוד,
      טרם מומש שם). כשהתאריכים השתנו בפועל, `GoogleCalendarService.syncSprintUpdated` עושה
      `events.patch` לכל `SprintGoogleEvent` קיים עם חיבור פעיל. כשלון מטופל כמו ב-`create`.
- [x] Endpoint לניתוק חיבור: `PATCH google-calendar/disconnect` (ללא `:id` בנתיב — מנתק את
      החיבור הפעיל היחיד של המשתמש המחובר עצמו, לפי `userId` מהטוקן) — מסמן `isRevoked=true`,
      לא מוחק (עקבי עם `TeamInvite`).
- הערה: כיסוי Jest ל-`google-calendar.service.ts` (מוקינג מלא של `googleapis`, ללא קריאת
  רשת אמיתית) ולעדכון `sprints.service.spec.ts` נכתב כחלק מהמימוש הזה לפי הנחיית המפעיל,
  למרות שסעיף הבדיקות הפורמלי הוא 6.3 — ר' `backend/src/google-calendar/
  google-calendar.service.spec.ts` ו-`backend/src/sprints/sprints.service.spec.ts`. תרחישי
  Playwright ובחירת אסטרטגיית stub ל-e2e (6.3) נשארים לסוכן `feature-tests`.

### תיקון באג (2026-09-11): scope חסר גרם לכשלון חיבור אמיתי בכל פעם

בבדיקה ידנית ראשונה של "חבר יומן Google" (אחרי שנוה תיקן את בעיית ה-Test users הנפרדת
ב-Google Cloud), כל ניסיון חיבור נכשל עם `Error: Request is missing required authentication
credential` שזרק `oauth2.userinfo.get()` בתוך `handleCallback`
(`google-calendar.service.ts`). הסיבה: `getAuthUrl` ביקש רק scope `calendar.events`, אבל
`handleCallback` קורא גם ל-`userinfo.get()` (כדי לדעת את כתובת המייל לתצוגת "מחובר כ-X") —
endpoint שדורש scope `email` בנפרד, שמעולם לא התבקש. **תוקן**: נוסף
`https://www.googleapis.com/auth/userinfo.email` ל-scope-ים המבוקשים ב-`getAuthUrl`. טסט
`getAuthUrl` עודכן לצפות לשני ה-scope-ים. 17/17 טסטים ב-`google-calendar.service.spec.ts`
עוברים. תוקן ישירות בקוד (לא רק דווח) כי זה תיקון טכני חד-משמעי, לא החלטה מוצרית.

### תוספת (2026-09-11): יומן ייעודי לכל צוות, לא היומן הראשי

נוה, בעקבות שאלה על שם היומן: "למה זה לא פשוט קטגוריה ביומן שלי ואז אני יכול להחליט אם
להציג אותו או לא?" — זו לא הייתה החלטה מוצרית שהתקבלה במפורש, רק ברירת מחדל טכנית
(`calendarId @default("primary")`) שאף אחד לא דן בה.

**הוחלט (נוה, 2026-09-11): יומן Google משני (secondary) ייעודי, אחד **לכל צוות** (לא אחד לכל
חיבור/משתמש) — כל אירועי הספרינטים של אותו צוות נכנסים ליומן הייעודי שלו, שאפשר להציג/להסתיר
בנפרד ב-Google Calendar.**

- [x] מודל Prisma חדש `GoogleCalendarTeamCalendar` (`connectionId`+`teamId` → `calendarId`
      Google אמיתי, `@@unique([connectionId, teamId])`) — מחליף את `GoogleCalendarConnection
      .calendarId` שהוסר (היה תמיד `"primary"`, לא נעשה בו שימוש אמיתי בשום מקום אחר בקוד).
- [x] `GoogleCalendarService.getOrCreateTeamCalendar(connection, teamId, teamName)` — בדיקת
      קיום (`findUnique`), ואם לא קיים: `calendar.calendars.insert({summary: "{שם הצוות} —
      ספרינטים"})` דרך Google Calendar API, שמירת ה-id שחזר. נקרא מ-`syncSprintCreated`/
      `syncSprintUpdated` לפני יצירת/עדכון האירוע עצמו — עטוף באותו try/catch-per-connection
      הקיים, כך שכשלון ביצירת היומן לא חוסם חיבורים אחרים.
- [x] טסטים: `google-calendar.service.spec.ts` מעודכן (19/19 עוברים) — כולל טסט ייעודי
      ל"שימוש חוזר ביומן קיים, לא יצירה כפולה" וטסט ל"כשלון ביצירת היומן עצמו לא חוסם/קורס".
- [x] `db push` רץ בהצלחה מול `postgres-test`; e2e (47/47) עדיין עובר.
- [x] `db push` מול Neon האמיתי — **רץ בהצלחה (2026-09-11)**, אחרי אישור מפורש. אומת ישירות
      מול ה-DB: `GoogleCalendarTeamCalendar` קיים בפועל, `login` עדיין תקין.
- **רעיון המשך שנוה העלה (לא ליישום עכשיו):** אפשרות למשתמש לבחור אילו "קטגוריות" של
  פיצ'רים/תוכן יוצגו ביומן שלו. נשאר כרעיון עתידי — דורש אפיון נפרד (`product-manager`) כשיהיה
  רלוונטי, אין עדיין מודל "קטגוריה" שרלוונטי כאן.

### תוספת נוספת (2026-09-11): Backfill לספרינטים קיימים בזמן חיבור

נוה חיבר יומן בפועל ולא ראה ספרינט קיים: "עשיתי התחברות ליומן למה אני לא רואה את הספרינט?"
— באג אמיתי: `syncSprintCreated`/`syncSprintUpdated` רצים רק מ-`sprints.service.ts` ברגע
יצירה/עדכון בפועל; חיבור מאוחר יותר לא הפעיל שום דבר רטרואקטיבית על ספרינטים שכבר קיימים.

- [x] `GoogleCalendarService.backfillExistingSprints(connection)` — בסוף `handleCallback`
      (אחרי שהחיבור נשמר), מוצא את כל הצוותים הפעילים (`TeamMember.status='ACTIVE'`) של
      המשתמש, טוען את כל הספרינטים שלהם, ויוצר אירוע לכל אחד (דרך `createEventForConnection`
      המשותף, כולל get-or-create של יומן הצוות הייעודי מהתוספת הקודמת). עטוף try/catch —
      כשלון ב-backfill לא מפיל את זרימת החיבור עצמה (החיבור כבר נשמר קודם), וכשלון על ספרינט
      בודד לא חוסם את השאר (אותו דפוס catch-per-item כמו `syncSprintCreated`).
- [x] רפקטור: `createEventForConnection` הופרד ל-method משותף (זורק במקום לבלוע שגיאות —
      כל קורא אחראי על ה-try/catch שלו) כדי ש-`syncSprintCreated` (הרבה חיבורים/ספרינט אחד)
      ו-`backfillExistingSprints` (חיבור אחד/הרבה ספרינטים) ישתפו את אותה לוגיקה בלי כפילות.
- [x] טסטים: 3 חדשים ב-`google-calendar.service.spec.ts` (21/21 עוברים) — backfill יוצר
      אירוע לכל ספרינט קיים בכל הצוותים; כשלון ב-backfill לא מונע מהחיבור עצמו להישמר/להיווצר
      בהצלחה. אין שינוי סכימה, אין צורך ב-`db push` נוסף.

### הערת סנכרון (2026-09-13, תועד רק בצד פיצ'ר 7 עד 2026-09-14): שינוי חתימת `getAuthUrl`

`GoogleCalendarService.getAuthUrl` קיבל פרמטר שני אופציונלי `loginHintEmail?: string`
(מעביר `login_hint` ל-Google כדי שמסך ההסכמה יציע ישירות את חשבון ה-Google שתואם למייל
המשתמש במערכת, במקום לשאול "עם איזה חשבון להתחבר"). השינוי בוצע ותועד בפועל בסעיף §7.5
של `07-google-sign-in.md` (כי הוא עלה כחלק מדיווח משולב של נוה על שלוש בעיות, שתיים מהן
בפיצ'ר 7) — לא כאן. נוסף כאן רק כהפניה, כדי שסוכן שקורא את הקובץ הזה בלבד לא יפספס ששינוי
קרה.

### הערת סנכרון נוספת (2026-09-14, תועד בפועל בצד פיצ'ר 7 §7.5): שינויים ב-`google-calendar.service.ts` מ-`/code-review high`

שלושה תיקונים ל-`google-calendar.service.ts` בוצעו יחד עם ביקורת קוד רחבה יותר על מה
שמומש בסשן (לא ספציפי לפיצ'ר 6 בלבד) — תועדו במלואם בפיצ'ר 7 §7.5 כי הביקורת כיסתה את שני
הפיצ'רים יחד. **בקיצור:** (א) `state` של חיבור-יומן קיבל `purpose: 'google-calendar-connect'`
נבדק (תיקון אבטחה — היה ניתן להחלפה עם טוקני login/session אחרים ששיתפו את אותו secret);
(ב) `syncSprintCreated` מסנן עכשיו `status: 'ACTIVE'` על חברי-צוות (בהתאמה ל-
`backfillExistingSprints` שכבר סינן); (ג) `buildCalendarClient` שומר עכשיו טוקן-access
מרוענן חזרה ל-DB במקום לאבד אותו בכל קריאה. ר' `07-google-sign-in.md` לפירוט המלא.

### 6.2 Frontend — שלב א' — מומש (ר' הערות; connect/callback הספציפי של היומן לא נלחץ ידנית ב-UI עדיין)

- [x] כרטיס חדש בהגדרות: `frontend/src/features/settings/components/google-calendar-card.tsx`
      (+ `hooks/use-google-calendar.ts`), מיוצא מ-`features/settings/index.tsx` ומוצג ב-
      `frontend/src/app/settings.tsx` מיד אחרי `AppearanceCard` — אותו דפוס card-per-concern
      בדיוק כמו `ProfileFormCard`/`AppearanceCard` (קובץ יחיד, לא מפוצל web/native, כי
      `@/components/ui`+`@mui/material` כבר לא מפוצלים שם — עקבי עם ממצא קיים ב-
      `UI-MIGRATION-BACKLOG.md` §"native... MUI לא רץ ב-React Native", שלא בטיפול כאן). כפתור
      "חבר יומן Google" קורא ל-`GET google-calendar/connect` עם `Authorization: Bearer`, מקבל
      `{authUrl}`, ומבצע `window.location.href = authUrl`. סטטוס (`GET google-calendar/status`)
      נטען פעם אחת ב-mount בלבד (עקבי עם [[feedback-frontend-data-freshness]] — אין
      refetch-on-focus). מחובר: "מחובר כ-{googleAccountEmail}" + כפתור "נתק חיבור"
      (`variant="danger"`) שקורא ל-`PATCH google-calendar/disconnect`.
- [x] `trackEvent()`: `google_calendar_connect_clicked`/`_succeeded`/`_failed` ו-
      `google_calendar_disconnect_clicked`.
- [x] `Strings.settings.*` — נוספו `googleCalendarCardTitle/Subtitle`, `googleCalendarConnect/
      DisconnectButton`, `googleCalendarConnectedLabel(email)`, `googleCalendarNotConnectedText`,
      `googleCalendarConnected/DisconnectedMessage`, `googleCalendarConnect/DisconnectError`,
      `googleCalendarStatusLoading`.
- [x] טיפול ב-`?googleCalendar=connected|error` שחוזר מהבקאנד: `useLocalSearchParams` ב-
      `use-google-calendar.ts` קורא את הפרמטר פעם אחת, מציג הודעת הצלחה/שגיאה (`Alert`),
      ומרענן סטטוס בהצלחה; `router.replace('/settings')` מנקה את הפרמטר מה-URL כדי שרענון דף
      לא יציג את ההודעה שוב. כפתור "primary" יחיד נשמר במסך ההגדרות (כפתור connect הוא
      `variant="secondary"`, אותה החלטה כמו כפתור "המשך עם Google" ב-`auth-form-web.tsx`).
      **עדכון (2026-09-11): client id/secret אמיתיים כבר מוגדרים בסביבה** (נוצרו לצורך פיצ'ר 7
      ומשותפים) — אבל זרימת ה-connect/callback **הספציפית של היומן** (לא זו של login) עדיין
      לא נלחצה ידנית ב-UI האמיתי עד כה, רק צורת קריאות ה-API (`axios` + `Authorization` header)
      ו-`tsc`/Jest. Native: אין
      זרימת `WebBrowser`/deep-link ייעודית (בניגוד לפיצ'ר 7) — הוחלט להשאיר כך כי כל מסך
      ההגדרות כבר קורס ב-native היום (MUI, ר' הערה למעלה), אז OAuth ייעודי ל-native לא רלוונטי
      עד שהבעיה הזו תיפתר בנפרד.

### 6.3 בדיקות — שלב א' — מומש (`feature-tests`, 2026-09-14)

- [x] Jest ל-`google-calendar` service: אומת מול הקוד הנוכחי — 23 טסטים קיימים כבר עברו
      (`google-calendar.service.spec.ts`), כולל תיקון האבטחה `purpose` (2026-09-14) שכבר היה
      מכוסה. נמצאו שני פערי כיסוי אמיתיים ביחס לתיקוני 2026-09-14 המתועדים ב-§7.5/כאן, ותוקנו
      (לא רק תועדו): (א) הפילטר `status: 'ACTIVE'` על `teamMember.findMany` בתוך
      `syncSprintCreated` לא היה מאומת בשום `toHaveBeenCalledWith` — נוסף טסט ייעודי. (ב)
      `buildCalendarClient`'s `client.on('tokens', ...)` (שמירת access token מרוענן חזרה ל-DB)
      לא הופעל בשום טסט קיים (המוק `mockOAuth2On` היה מוצהר אך לא נבדק) — נוספו 2 טסטים
      (שמירת טוקן מרוענן; לא דורס `refreshToken` קיים כשגוגל לא מחזיר אחד חדש). סה"כ 25 טסטים
      ב-service, כולם עוברים.
- [x] Jest ל-endpoint חיבור/ניתוק: `google-calendar.controller.spec.ts` חדש (10 טסטים) —
      `connect`/`status`/`disconnect` כולם קוראים ל-`userId` מהמשתמש המאומת בלבד (אין פרמטר
      body/id בחתימת `disconnect` בכלל — לא ניתן מבנית להעביר id של משתמש אחר); טסט ייעודי
      מדגים ששתי קריאות עם שני טוקנים שונים מנתקות כל אחת רק את ה-`userId` שלה. גם `callback`
      (redirect על שגיאה/קוד־state חסר/הצלחה/כשלון בשירות) מכוסה. 219/219 טסטים עוברים ב-Jest
      backend כולל אלה; 47/47 ב-e2e (Supertest) backend ללא רגרסיה.
- [x] Playwright e2e: **אסטרטגיית ה-stub שנבחרה** — אין OAuth אמיתי מול Google בסביבת e2e
      (`GOOGLE_CLIENT_ID`/`SECRET`/`REDIRECT_URI` לא מוגדרים ב-`backend/.env.test` בכוונה תחילה),
      ואין קובץ e2e קיים לפיצ'ר 7 (Google sign-in) לשאול ממנו דפוס — §7.3 גם הוא עדיין לא הותחל.
      נבחר stub חדש: סקריפט Prisma ייעודי `backend/scripts/e2e-seed-google-connection.js` (npm
      script `e2e:seed-google-connection`, מוגן באותו guard כמו `assert-e2e-db.js` — מסרב לרוץ
      נגד כל DB חוץ מ-`postgres-test`) כותב שורת `GoogleCalendarConnection` ישירות ל-DB המבודד,
      עוקף לגמרי את חילופי הטוקן מול Google (מקביל למה שה-Jest עושה ע"י מוקינג `googleapis`,
      רק ברמת ה-DB במקום ברמת ה-service, כי ה-e2e backend רץ כתהליך נפרד אמיתי). **מגבלה
      מפורשת: זה בודק תצוגה + `PATCH disconnect` אמיתי, לא את קוד ה-`handleCallback`/
      חילופי-הטוקן עצמו** — אין דרך סבירה לכסות את זה ב-e2e מבודד. קובץ חדש
      `frontend/e2e/google-calendar.spec.ts`, 2 תרחישים: (1) חבר צוות רגיל (לא admin, בצוות עם
      admin נפרד) רואה את הכרטיס ואת מצב "לא מחובר", ולחיצה אמיתית על "חבר יומן Google" מייצרת
      500 אמיתי (לא מדומה) מהשרת הלא-מוגדר ומוצגת הודעת שגיאה נכונה; (2) משתמש עם חיבור מדומה
      (seed) רואה "מחובר כ-X", לוחץ "נתק חיבור" (endpoint אמיתי, לא מוקינג), רואה חזרה "לא
      מחובר", ומאומת גם דרך `GET status` ישיר ש-DB אכן עודכן. גבול ההרשאות האמיתי (משתמש לא
      יכול לנתק חיבור של אחר) מכוסה ב-Jest controller spec למעלה, לא כאן — אין כאן "משתמש
      שלא אמור לראות" כי החלטה 6.0.3 קובעת שכולם רואים; ה"boundary" הרלוונטי ל-e2e הוא
      ההפך: אימות שגם לא-admin רואה, לא רק admin.
- [x] בדיקת מובייל — אין project חדש נדרש: `frontend/playwright.config.ts` כבר מריץ כל
      spec תחת `Desktop Chrome` + `Mobile Chrome`; שני התרחישים למעלה רצים ועוברים בשני
      ה-projects (4/4).

### 6.4 שלב ב' (עתידי, לא ב-MVP) — תאריך רטרו נפרד ביומן

**נשאר עתידי/לא ב-MVP בהחלטת נוה (ר' 6.0) — לא לפרט checklist טכני לפני שנוצר מודל "רטרו"
עצמאי במערכת.** כרגע אין אפילו ישות "רטרו" בנתונים לחבר אליה תאריך (ר' ממצאי מחקר). קווים
כלליים בלבד, לעדכון (רצוי דרך `product-manager` נפרד) כשהצורך בישות כזו יעלה בפני עצמו:

- Backend: ככל הנראה שדה/טבלה חדשה לתאריך/שעת רטרו (על `Sprint` או על ישות "רטרו" חדשה),
  ואירוע יומן שני נפרד מאירוע טווח הספרינט, דרך אותו חיבור Google שכבר נבנה בשלב א'.
- Frontend: שדה קלט לתאריך/שעת רטרו בטופס יצירת/עריכת ספרינט (אם ידני), או תצוגה בלבד (אם
  נגזר אוטומטית).
- בדיקות: אותה גישה כמו שלב א' (mock ל-Google API, לא קריאה אמיתית).

### לא בטיפול (פיצ'ר 6)

- שילוב עם יומנים אחרים (Outlook/Apple Calendar וכו') — Google בלבד בסבב הזה.
- הזמנת (invite) משתתפים ספציפיים לאירוע היומן — רק יצירת אירוע, בלי ניהול משתתפים.
- תזכורות/notifications מותאמות על האירוע — ברירות המחדל של Google Calendar עצמו, לא נבנה
  מנגנון תזכורת נפרד באפליקציה.
