## פיצ'ר 5: תיעוד היסטוריית שינויי אורך ספרינט (Audit Log)

### נקודות מרכזיות (touchpoints)

- **מודלים (Prisma):** `SprintLengthChange` (חדש) — `id, sprintId (FK cascade), changedById (FK ל-User, cascade), previousStartDate?, previousEndDate?, newStartDate, newEndDate, reason?, createdAt`. Append-only.
- **Backend:** `backend/src/sprints/sprints.service.ts::update`+`create` (כתיבה בתוך `$transaction` עם השינוי/היצירה עצמם), `UpdateSprintDto.reason` (שדה חדש), endpoint קריאה חדש, guard **`assertCanManageTeamContent`** (שונה מ-guard הכתיבה של פיצ'ר 4 שהוא `isAdmin` בלבד — כאן זו הרשאת *צפייה*, `isAdmin || TEAM_LEADER`).
- **Frontend:** פאנל מתקפל חדש בלוח הרטרו (על תבנית `invite-links-panel.tsx`), `sprint-retro-board-web.tsx`/`-native.tsx` (שדה "סיבה לשינוי" בטופס העריכה הקיים מפיצ'ר 4).
- **Endpoints:** `GET /teams/:teamId/sprints/:sprintId/length-history`.
- **תלוי בפיצ'ר 4:** נכתב כתופעת-לוואי אוטומטית בתוך `sprints.service.ts::update`/`create` הקיימים — אין guard/החלטת הרשאה חדשה על ה-*כתיבה* עצמה.


מטרת הפיצ'ר: כל שינוי בתאריכי ההתחלה/סיום של ספרינט קיים (מהם נגזר "אורך" הספרינט) יתועד
אוטומטית — מתי בוצע השינוי, מה היה האורך הישן, מה האורך החדש, ומי ביצע אותו — ותהיה בממשק
נקודת צפייה בהיסטוריה הזו. זהו בדיוק הפריט שנוה כבר סימן כעתידי ב"לא בטיפול" של פיצ'ר 4
(ר' שם), עכשיו ממוקד ספציפית לשינויי אורך/תאריכים.

**ממצא מחקר קריטי לפני כל החלטה אחרת:** "אורך ספרינט" **אינו שדה קיים בשום מקום בקוד**.
`Sprint` (`backend/prisma/schema.prisma:188-200 (עודכן 2026-09-14)`) מכיל רק `name, description, startDate,
endDate` — אין `Team.sprintLengthDays` ואין `Sprint.length`/`Sprint.durationDays`. "אורך"
הוא ולהיה תמיד ערך **נגזר** (`endDate - startDate`), בדיוק כמו ש"ספרינט סגור" נגזר בצד
הלקוח ולא נשמר כשדה (`getSprintState()`, מתועד כבר בממצאי מחקר פיצ'ר 1). היכולת הקיימת
"לשנות אורך ספרינט" שהוזכרה בבקשה = עריכת `startDate`/`endDate` של ספרינט קיים, שנוספה
בפיצ'ר 4 (`PATCH /teams/:teamId/sprints/:sprintId`, `UpdateSprintDto`,
`sprints.service.ts::update`) — **אין שדה נפרד "אורך" שנערך ישירות**. כל הסעיף הזה ממשיך
לפעול על ההנחה הזו: "שינוי אורך" = שינוי בפועל של `startDate` ו/או `endDate` של ספרינט קיים
דרך אותו PATCH.

### 5.0 החלטות

**ברירות מחדל טכניות (לא דורשות אישור נוה):**

1. **מקור האמת לאורך — נגזר, לא מאוחסן.** רשומת ההיסטוריה תשמור את התאריכים הישנים
   והחדשים בפועל (`previousStartDate/previousEndDate/newStartDate/newEndDate`), לא מספר
   ימים מחושב ומאוחסן בנפרד — עקבי עם הדפוס הקיים בקוד (אורך/מצב ספרינט תמיד נגזרים, לא
   persisted). מספר הימים (`length = endDate - startDate`) מחושב בזמן תצוגה, גם ב-API
   response (שדה נוסף מחושב, לא עמודת DB) וגם ב-UI, כדי לא ליצור מקור-אמת כפול שעלול
   להתבדות מהתאריכים עצמם.
2. **תבנית הטבלה — להעתיק את `TeamInvite`, לא להמציא מבנה חדש** (כפי שגם `backend/AGENTS.md`
   §"Per-team-owned entities" מנחה במפורש): טבלה נפרדת `SprintLengthChange` עם `sprintId`
   FK (cascade), `changedById` FK ל-`User` (cascade — **עקבי** עם `TeamInvite.createdBy` ו-
   `Comment.author`, שתיהן כבר cascade על מחיקת המשתמש; לא סטייה חדשה), `createdAt
   @default(now())`. רשומות **append-only** — אין endpoint לעדכון/מחיקה של רשומת היסטוריה
   אף פעם (אחרת זה לא audit log אמיתי).
3. **מי כותב ללוג (permission על ה-write path) — לא שאלה פתוחה.** הכתיבה קורית כתופעת-לוואי
   אוטומטית בתוך `sprints.service.ts::update` הקיים, שכבר בדוק ב-guard
   `requesterMembership.isAdmin` (זהה ל-create, ר' פיצ'ר 4) — **אין החלטת הרשאה חדשה כאן**,
   רק תיעוד של מי שכבר הורשה לערוך.
4. **טווח: רק שינוי בתאריכים נכנס ללוג הזה**, לא כל PATCH. אם ה-PATCH משנה רק `name`/
   `description` בלי לגעת ב-`startDate`/`endDate` בפועל (השוואת ערך-ישן מול ערך-חדש, לא רק
   "השדה נשלח בבקשה") — לא נוצרת רשומת היסטוריה. זה תואם את שם הפיצ'ר ("שינויי אורך
   ספרינט"), לא "כל עריכת ספרינט" (זה scope רחב יותר, שכבר תועד כאופציה נפרדת ב"לא בטיפול"
   של פיצ'ר 4 — "מי ערך אילו שדות").
5. **אין מחיקה/retention אוטומטי כרגע** — לתמיד, עד שיוחלט אחרת. אין שום מנגנון ניקוי/TTL
   דומה בפרויקט הזה היום שאפשר להעתיק ממנו.

**החלטות מוצריות (נוה, 2026-09-06):**

1. **מיקום ב-UI: פאנל מתקפל בלוח הרטרו**, על דפוס `InviteLinksPanel`
   (`frontend/src/features/teams/components/team-list-web/invite-links-panel.tsx` —
   `isExpanded` + `useEffect` ששולף רק בפתיחה, לא ב-mount; מקבילת native קיימת גם היא).
   ה-endpoint הוא **per-sprint** (לא ברמת-צוות) — `GET
   /teams/:teamId/sprints/:sprintId/length-history`.
2. **הרשאת צפייה: admin או ראש-צוות (TEAM_LEADER)**, לא כל חבר צוות. יש כבר תבנית מדויקת
   לזה בקוד — `assertCanManageTeamContent` (`backend/src/teams/team-permissions.util.ts`),
   שכבר משמשת שני פיצ'רים אחרים ("מנהלי צוות וראשי צוותים") ומיישמת בדיוק
   `isAdmin || role === 'TEAM_LEADER'`. **להשתמש בפונקציה הקיימת, לא לכתוב guard חדש.**
   (שים לב: זו הרשאת *צפייה* — הרשאת *כתיבה*/עריכה נשארת admin-בלבד, ר' ברירת מחדל 3 למעלה,
   שונה במכוון מהצפייה.)
3. **Scope: רק שינויי תאריך** (לא כל עריכת ספרינט) — מאשר את ברירת המחדל הטכנית 5.0.4.
   מבנה הטבלה נשאר עם עמודות תאריך ספציפיות, לא `changedFields JSON` גנרי.
4. **Baseline: כן** — יצירת ספרינט (`sprints.service.ts::create`) יוצרת גם היא רשומת
   `SprintLengthChange` ראשונה, כך שההיסטוריה תמיד מתחילה מ"שורה ראשונה" עם התאריכים
   המקוריים ומי יצר, לא ריקה עד לשינוי הראשון.
5. **שדה "סיבה לשינוי" (reason): כן, אופציונלי.** טקסט חופשי בטופס העריכה, נשמר על
   `SprintLengthChange.reason` ומוצג בהיסטוריה. לא רלוונטי/ריק ברשומת ה-baseline (אין
   "שינוי" ביצירה עצמה).
6. **טווח שמירה: לתמיד** — מאשר את ברירת המחדל הטכנית 5.0.5, אין צורך במדיניות מחיקה.

### ממצאי מחקר

- **אין "אורך ספרינט" כשדה עצמאי בשום מקום** — ר' "ממצא מחקר קריטי" למעלה. גרפ מקיף
  (`sprintLength`, `SprintLength`, `duration`, `days`) לא העלה שום זכר לקונספט הזה לא
  ב-backend ולא ב-frontend, לא ב-`schema.prisma`, לא ב-`sprints.dto.ts`.
- **נקודת הכתיבה היחידה שרלוונטית: `sprints.service.ts::update`**
  (`backend/src/sprints/sprints.service.ts:70-126`, **עודכן 2026-09-14** — המספרים המקוריים
  כאן [47-79/56-61/63-67] הזיזו יעד אחרי שפיצ'ר 6 הוסיף קוד ל-`create`/`update` שקדם לפיצ'ר
  הזה) — כבר קיימת ומיושמת (פיצ'ר 4), כולל ה-guard (`requesterMembership.isAdmin`, שורות
  79-84) וטעינת הספרינט הקיים לפני העדכון (שורה 87, `const sprint = await
  this.prisma.sprint.findFirst(...)`) — **הערכים הישנים כבר נטענים בקוד לפני שהם נדרסים**,
  כך שהשוואת ישן/חדש לצורך יצירת רשומת היסטוריה היא תוספת ישירה בתוך הפונקציה הזו, לא צריך
  שאילתה נוספת.
- **חשוב למימוש (נמצא בביקורת חוצה-פיצ'רים, 2026-09-14): פיצ'ר 6 כבר מחשב השוואת
  ישן/חדש דומה באותה הפונקציה בדיוק.** אחרי ה-`prisma.sprint.update` (שורה 93), פיצ'ר 6
  כבר מחשב `datesChanged = updated.startDate.getTime() !== sprint.startDate.getTime() || ...`
  (שורות 106-108) כדי להחליט אם לסנכרן ליומן Google (`try/catch` לא-בתוך-טרנזקציה, כי זו
  קריאת HTTP חיצונית — שורות 110-123). כשמממשים את הסעיף הזה: **(א)** להשתמש ב-`datesChanged`
  הקיים במקום לחשב שוב השוואה זהה; **(ב)** ה-`prisma.$transaction` החדש (שינוי + יצירת
  `SprintLengthChange`) צריך לעטוף רק כתיבות DB — **לא** את קריאת ה-Google Calendar API
  שממשיכה לרוץ אחרי ה-commit, אחרת טרנזקציה תישאר פתוחה בזמן קריאת רשת חיצונית.
- **`UpdateSprintDto`** (`backend/src/sprints/dto/sprints.dto.ts:8-13`): `name?, description?,
  startDate?, endDate?` — כל השדות אופציונליים (עדכון חלקי). ה-DTO לא מבחין בין "לא נשלח"
  ל"נשלח אבל זהה לישן" — ההשוואה לצורך הלוג חייבת להיות מול הערך **בפועל** (`sprint.startDate`
  הישן מול `dto.startDate` החדש), לא מול "האם השדה קיים ב-body".
- **התבנית להעתקה — `TeamInvite`** (`schema.prisma:60-76` + `backend/src/invites/
  invites.service.ts`): טבלה נפרדת עם `teamId`/FK-מקביל cascade, `createdById` FK ל-User,
  ובלי mutation על רשומות קיימות (רק `isRevoked` toggle, לא מחיקה/עריכה של תוכן ההזמנה עצמה)
  — בדיוק אותו רוח append-only שדרוש כאן. גם `backend/AGENTS.md` §"Per-team-owned entities"
  מפנה במפורש ל-`invites` כתבנית לכל משאב פר-צוות חדש.
- **דפוס UI לפאנל-נפרד-שנשלף-בפתיחה — `InviteLinksPanel`**
  (`frontend/src/features/teams/components/team-list-web/invite-links-panel.tsx:29-55`,
  עודכן 2026-09-14): `isExpanded` state + `useEffect(() => { if (isExpanded) fetchInvites();
  }, [isExpanded])` — נתונים נשלפים רק כשהפאנל נפתח, לא ב-mount. **זה הדפוס שנבחר בפועל**
  (החלטה מוצרית #1 למעלה — "פאנל מתקפל", לא מוטבע), להעתיק ישירות (יש גם מקבילת native:
  `frontend/src/features/teams/components/team-list-native/invite-links-panel.tsx`).
- **טופס העריכה הקיים** (רלוונטי כרפרנס בלבד — האופציה "מוטבע" **לא** נבחרה, ר' לעיל):
  `sprint-retro-board-web.tsx` — `isEditingSprint` state (שורה 34, עודכן 2026-09-14 —
  המספרים המקוריים כאן הזיזו יעד אחרי שפיצ'ר 8 הוסיף קוד שקדם לזה), `canEditSprint =
  !!myMembership?.isAdmin` (שורה 153), טופס מוטבע (לא modal) עם `Field type="date"` לכל
  אחד מ-`editStartDate`/`editEndDate` (שורות 251-252), שולח PATCH (שורה 174). מקבילת
  native קיימת (`sprint-retro-board-native.tsx`) באותה רוח.
- **הרשאת עריכה (write path) כבר קיימת ומיושמת** — `canEditSprint`/guard ה-backend זהים,
  `isAdmin` בלבד (לא `creatorId`, לא `TEAM_LEADER` — שונה במפורש מפיצ'רים 1-3, ר' הסבר
  בפיצ'ר 4 למעלה: "כדי שלא ייווצר מצב שמישהו יכול לערוך ספרינט שהוא לא יכול היה ליצור").
  אין החלטה חדשה נדרשת כאן לכתיבה — ר' ברירת מחדל 5.0.3.
- **track events (PostHog) הם נפרדים לחלוטין מהצורך הזה, לא תחליף.**
  `frontend/src/lib/analytics.ts::trackEvent` שולח ל-PostHog (שירות אנליטיקס חיצוני) —
  fire-and-forget, בלי טבלה בבסיס הנתונים של האפליקציה, בלי אפשרות query-back מובנית
  בממשק שלנו, ובלי קשר בין "מי" ל"איזה שינוי בדיוק בוצע" ברמת דיוק שדורש audit log אמיתי.
  כשמוסיפים UI חדש לפיצ'ר הזה (למשל כפתור/טאב "היסטוריה") — עדיין נדרש `trackEvent()` על
  הפתיחה שלו, לפי הכלל הקבוע בפרויקט, אבל זה **בנוסף** ל-`SprintLengthChange` ולא במקומו.

### 5.1 Backend

- [x] מודל Prisma חדש `SprintLengthChange`: `id, sprintId (FK ל-Sprint, cascade),
      changedById (FK ל-User, cascade — עקבי עם TeamInvite.createdBy/Comment.author),
      previousStartDate DateTime?, previousEndDate DateTime?, newStartDate DateTime, newEndDate
      DateTime, reason String?, createdAt DateTime @default(now())`. `previous*` הן nullable
      כדי לתמוך ברשומת ה-baseline (יצירת ספרינט — אין "קודם"); ברשומות עדכון רגילות שתיהן
      תמיד ממולאות. (`backend/prisma/schema.prisma` — מודל חדש + `Sprint.lengthChanges` /
      `User.sprintLengthChanges` relations.)
- [x] `npx prisma db push` מול `postgres-test` (בטוח לביצוע ישיר) — **לא** מול Neon
      dev/prod בלי אישור מפורש של נוה קודם (ר' `backend/AGENTS.md` §Database). **בוצע מול
      postgres-test בלבד** (localhost:5433) — **לא** רץ מול Neon dev/prod, נדרש אישור נוה
      מפורש לפני שמריצים שם.
- [x] `sprints.service.ts::update`: לפני העדכון בפועל, להשוות
      `sprint.startDate`/`sprint.endDate` (הערכים הישנים, כבר נטענים בקוד הקיים שורה 64) מול
      `dto.startDate`/`dto.endDate` שסופקו בפועל — אם יש שינוי אמיתי באחד מהם, ליצור רשומת
      `SprintLengthChange` (`previousStartDate/previousEndDate` = הערכים הישנים,
      `newStartDate/newEndDate` = הערכים אחרי העדכון, `reason` = `dto.reason` אם סופק) בתוך
      `prisma.$transaction` יחד עם ה-`update` עצמו, כדי שלא תיווצר רשומת היסטוריה בלי שהעדכון
      עצמו הצליח או להפך. מומש: ה-`$transaction` מחזיר `{ updated, datesChanged }` — אותו
      `datesChanged` שכבר קיים מפיצ'ר 6 (לא מחושב פעמיים), משמש גם להחלטה על רשומת ההיסטוריה
      וגם (אחרי ה-commit) להחלטה על סנכרון Google Calendar, שנשאר **מחוץ** לטרנזקציה.
- [x] `sprints.service.ts::create`: לאחר יצירת הספרינט, ליצור גם רשומת `SprintLengthChange`
      ראשונה (baseline) — `previousStartDate/previousEndDate = null`,
      `newStartDate/newEndDate` = ערכי היצירה, `changedById = requesterId`, `reason = null`.
      גם זה בתוך אותה `$transaction` שיוצרת את הספרינט.
- [x] הוספת `reason String?` ל-`UpdateSprintDto` (`backend/src/sprints/dto/sprints.dto.ts`).
- [x] `GET /teams/:teamId/sprints/:sprintId/length-history` — endpoint חדש ב-
      `sprints.controller.ts`/`sprints.service.ts`. Guard: **`assertCanManageTeamContent`**
      (`backend/src/teams/team-permissions.util.ts`, ייבוא ישיר — לא guard חדש) — admin או
      TEAM_LEADER בלבד. מחזיר רשימה ממוינת `createdAt desc`, כולל שם/שם-משתמש של `changedBy`
      (לא רק `changedById`, `include: { changedBy: true }`) — **לא** לשמור/להחזיר מספר ימים
      כעמודת DB, האורך מחושב בזמן תצוגה בצד הלקוח (ר' ברירת מחדל 5.0.1). מומש: `password`
      של `changedBy` נשלף ידנית (אין `@Exclude` בפרויקט, ר' `backend/AGENTS.md`
      §"Passwords & JWT"); 404 אם הספרינט לא שייך לצוות נבדק **לפני** בדיקת ה-permission
      (עקבי עם דפוס `comments.service.ts`).

Jest ב-`sprints.service.spec.ts` שמכסים את כל הפריטים למעלה (baseline ב-`create`, רשומה עם
ערכים נכונים + `reason` ב-`update` ששינה תאריכים, אין רשומה בשינוי `name`/`description` בלבד,
אין רשומה כשתאריך נשלח אבל זהה לישן, `getLengthHistory` — 404 לספרינט לא קיים, 403 לחבר צוות
רגיל, מותר ל-admin/TEAM_LEADER, מיון `createdAt desc`, `password` לא מודלף) נכתבו כחלק מהריצה
הזו (חלק מ-§5.3, לא כפילות — לא נמצאו טסטים קיימים לתחום הזה). Playwright e2e (§5.3) לא נכתב
כאן — מחוץ לסקופ של סוכן ה-backend.

### 5.2 Frontend

- [x] פאנל מתקפל בלוח הרטרו, בהעתקה ישירה של מבנה `invite-links-panel.tsx`
      (`isExpanded` state + `useEffect(() => { if (isExpanded) fetch...() }, [isExpanded])` —
      נשלף רק בפתיחה, לא ב-mount). מומש כקומפוננטות חדשות
      `frontend/src/features/retro/components/sprint-length-history-panel-web.tsx`
      ו-`sprint-length-history-panel-native.tsx` (ליד לוח הרטרו עצמו, לא תחת
      `team-list-web`/`team-list-native` — אלה רק מיקום דפוס-הייחוס `InviteLinksPanel`
      שהועתק, הפאנל החדש הוא per-sprint ושייך ל-`features/retro`, לא ל-`features/teams`),
      מורכבות ב-`sprint-retro-board-web.tsx`/`-native.tsx` מיד אחרי בלוק פרטי הספרינט.
- [x] הצגת כל רשומה: תאריך/שעת השינוי (`createdAt`), שם מבצע השינוי (`changedBy`, דרך
      `formatUserDisplayName` המשותפת מ-`comment-display.ts`, יוצאה עכשיו גם היא), אורך ישן
      → אורך חדש בימים (מחושב בצד הלקוח מהתאריכים שחוזרים מה-API — `previousStartDate` null
      ברשומת ה-baseline מוצג כ"נוצר לראשונה" ולא כ"שינוי מ-X ל-Y"), תאריכי ההתחלה/סיום
      הישנים והחדשים בפועל, וה-`reason` אם קיים.
- [x] הפאנל (וכפתור הפתיחה שלו) מוצגים רק כש-`canViewLengthHistory` אמת — אותו תנאי בדיוק
      כמו `canHighlight` הקיים (`isAdmin || role === 'TEAM_LEADER'`), שכבר תואם
      ל-`assertCanManageTeamContent` בצד השרת; חבר צוות רגיל לא רואה את כפתור/פאנל ההיסטוריה
      בכלל (web + native).
- [x] `Field` טקסט חופשי אופציונלי "סיבה לשינוי" בטופס עריכת הספרינט הקיים
      (`sprint-retro-board-web.tsx`: `<Field>`; `-native.tsx`: `TextInput` עם `editFieldStyle`
      הקיים, עקבי עם שאר שדות הטופס באותו קובץ), ליד `editStartDate`/`editEndDate`, נשלח
      כ-`reason` ב-PATCH (מתאפס לריק בכל פתיחת עריכה מחדש).
- [x] כפתור פתיחת הפאנל שולח `trackEvent('sprint_length_history_opened', { sprintId })` בכל
      פתיחה (web + native) — בנוסף לרשומות ה-audit log ב-DB, לא תחליף.
- [x] `Strings.retroBoard.*` — מחרוזות עבריות חדשות: `lengthHistoryShowButton`/
      `lengthHistoryHideButton`, `lengthHistoryTitle`, `lengthHistoryCreatedInitiallyText`
      ("נוצר לראשונה"), `lengthHistoryPreviousLengthLabel`/`lengthHistoryNewLengthLabel`
      ("אורך קודם"/"אורך חדש"), `lengthHistoryDaysLabel`, `lengthHistoryDatesLabel`,
      `lengthHistoryReasonLabel`, `lengthHistoryEmptyText`/`lengthHistoryLoadingText`/
      `lengthHistoryErrorText`, ו-`editReasonLabel`/`editReasonPlaceholder` לשדה הטופס.
      אייקון חדש `history` נוסף ל-`IconName`/`REGISTRY` (web + native), שימוש אמיתי בלבד
      (כפתור פתיחת הפאנל).

### 5.3 בדיקות

- [x] Jest ב-`sprints.service.spec.ts` (מורחב): `create` יוצר גם רשומת `SprintLengthChange`
      baseline אחת (`previousStartDate/previousEndDate = null`); PATCH ששינה תאריכים בפועל
      יוצר רשומה נוספת עם הערכים הישנים/חדשים הנכונים ו-`reason` אם סופק; PATCH ששינה רק
      `name`/`description` **לא** יוצר רשומה (ר' 5.0.4); PATCH עם תאריך זהה לישן (נשלח אבל
      לא השתנה בפועל) גם לא יוצר רשומה. **אומת** — הטסטים כבר נכתבו כחלק מריצת ה-backend
      (`describe('create')`: `'creates a baseline SprintLengthChange row alongside the sprint,
      inside the same transaction'`; `describe('update')`: `'creates a SprintLengthChange row
      with the old/new values and reason when dates actually change'`,
      `'does not create a SprintLengthChange row when only name/description change'`,
      `'does not create a SprintLengthChange row when a date is sent but is identical to the
      existing one'`), ורצו ירוק (`NODE_OPTIONS=--experimental-vm-modules jest
      src/sprints.service.spec.ts` — 34/34 עברו).
- [x] Jest ל-endpoint הקריאה החדש: `assertCanManageTeamContent` חוסם חבר-צוות רגיל
      (403), מאפשר admin ו-TEAM_LEADER; מיון `createdAt desc`; כולל baseline + כל העדכונים.
      **אומת** — `describe('getLengthHistory')` ב-`sprints.service.spec.ts` מכסה 404 לספרינט
      לא-שייך, 403 לחבר רגיל, הצלחה ל-admin ול-TEAM_LEADER, ומיון+תוכן+`password` לא מודלף —
      ירוק.
- [x] Playwright e2e (`frontend/e2e/sprint-length-audit-log.spec.ts`): admin יוצר ספרינט
      (baseline, אורך 14 ימים) ואז עורך את תאריכיו פעמיים ברצף — פעם ראשונה עם `reason` (אורך
      14→21), פעם שנייה בלי `reason` (אורך 21→28, ומוודא ששדה הסיבה התאפס לריק בפתיחה
      מחדש) → פותח את פאנל ההיסטוריה → מוודא 3 רשומות עם שם המבצע, ערכי אורך ישן/חדש נכונים,
      וסדר כרונולוגי הפוך (לפי `boundingBox().y` של סמנים ייחודיים לכל רשומה — לא רק ספירה);
      חבר-צוות רגיל (role `DEVELOPER`, לא admin ולא TEAM_LEADER) נכנס לאותו ספרינט ומוודא
      שכפתורי הפתיחה/סגירה וכותרת הפאנל **נעדרים לגמרי מה-DOM** (`toHaveCount(0)`), לא רק
      מוסתרים. ירוק.
- [x] בדיקת מובייל — אותו e2e תחת `Mobile Chrome` project (עקבי עם כל שאר הפיצ'רים בבאקלוג
      הזה) — ירוק, גם ברצף אחרי ריצת Desktop Chrome (suffix ייחודי per-run מונע התנגשות DB).
