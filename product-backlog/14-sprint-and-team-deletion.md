## פיצ'ר 14: מחיקת ספרינט ומחיקת צוות פעיל (מחיקה רכה + שחזור) — מומש (2026-10-14) — Backend+Frontend+בדיקות ירוקים; `db push` מול Neon טרם הורץ

### נקודות מרכזיות (touchpoints)

- **מודלים (Prisma):** `Sprint.deletedAt DateTime?` + `deletedById Int?`; `Team.deletedAt DateTime?` + `deletedById Int?` (FK ל-`User`, `SetNull`). אחרי 30 יום — מחיקה קשה דרך השרשור הקיים (Sprint → `Comment`, `SprintGoogleEvent`, `SprintLengthChange`; Team → `TeamMember`, `Sprint`, `Comment`, `TeamInvite`, `TeamCommentCategory`, `GoogleCalendarTeamCalendar`).
- **Backend:** `backend/src/sprints/sprints.service.ts` (`remove`, `restore`, `findDeleted`), `backend/src/teams/teams.service.ts` (`deleteTeam`, `restoreTeam`, `findDeletedTeams`), סינון `deletedAt` בכל שאילתה על `Sprint`/`Team` (teams, sprints, comments, invites, team-categories, google-calendar, telegram), `backend/src/google-calendar/google-calendar.service.ts` (`syncSprintDeleted`, `syncTeamDeleted`, ושימוש חוזר ב-sync הקיים בשחזור), `backend/src/telegram/*` (איפוס `activeTeamId`/`activeSprintId`, שהם `Int?` בלי FK), מנגנון purge ל-30 יום.
- **Endpoints:** חדשים — `DELETE /teams/:teamId/sprints/:sprintId`, `POST /teams/:teamId/sprints/:sprintId/restore`, `GET /teams/:teamId/sprints/deleted`, `DELETE /teams/:teamId` (גוף `{ confirmName }`), `POST /teams/:teamId/restore`, `GET /teams/deleted` (צוותים שנמחקו שאני מנהל בהם).
- **Frontend:** `sprint-retro-board-web.tsx`/`-native.tsx` ("מחק ספרינט" ליד "ערוך ספרינט"), רשימת "ספרינטים שנמחקו" ברשימת הספרינטים (`sprint-list-*`), `team-settings-panel.tsx` (web+native — "אזור מסוכן": מחיקת צוות), "צוותים שנמחקו" במסך ההגדרות, `src/constants/strings.ts`.
- **תלוי לו:** פיצ'ר 11 (החבר האמיתי האחרון → מחיקת צוות) ופיצ'ר 15 (מחיקת חשבון → מחיקת צוות שהוא החבר האמיתי היחיד בו). נוגע בפיצ'רים 1, 5, 6, 8, 10, 13, 16 דרך הסינון והשרשור.

מטרת הפיצ'ר: לאפשר למנהל למחוק ספרינט שנוצר בטעות ולמחוק צוות שכבר לא בשימוש, עם אפשרות שחזור
ל-30 יום. היום שניהם נשארים לתמיד, ואירועי הספרינט נשארים ביומני Google של כל חברי הצוות.

### 14.0 החלטות

**החלטות מוצריות (נוה, 2026-10-13):**

1. **מחיקה רכה עם שחזור ל-30 יום.** כל מנהל של הצוות יכול לשחזר. אחרי 30 יום — מחיקה סופית.
2. **מחיקת ספרינט: מנהל בלבד** (אותה הרשאה כמו יצירה ועריכה, פיצ'ר 4).
3. **ספרינט עם הערות נמחק תמיד, עם אזהרה** ("X הערות יימחקו יחד איתו"). בשחזור, ההערות חוזרות.
4. **מחיקת צוות: כל מנהל של הצוות הספציפי**, עם הקלדת שם הצוות לאישור.
5. **אין מייל לחברי הצוות** כשצוות נמחק. הצוות פשוט נעלם להם מהרשימה.
6. **אין הצעה לייצא סיכומים לפני מחיקה** — יש 30 יום לשחזר ולייצא משם.

**ברירות מחדל טכניות (נקבעו כאן, לא לשאול את נוה עליהן):**

1. **ספרינט או צוות שנמחק לא קיים מבחינת כל שאר המערכת:** 404 בכל endpoint, לא מופיע ברשימות,
   לא בבוט הטלגרם ולא בסנכרון היומן. קישורי הזמנה לצוות שנמחק לא תקפים.
2. **יומן Google מתנקה ברגע המחיקה הרכה** (מחיקת אירועים; במחיקת צוות גם `calendars.delete` של
   יומן הצוות המשני), best-effort. בשחזור — סנכרון מחדש דרך ה-sync הקיים (`syncSprintCreated` /
   `getOrCreateTeamCalendar` + backfill).
3. **הקשר טלגרם מתאפס** ברגע המחיקה, לכל `UserMessagingLink` שמצביע על מה שנמחק.
4. **Purge אחרי 30 יום:** אין באפליקציה scheduler, ומכונת ה-backend ב-Fly נכבית כשאין תנועה
   (`auto_stop_machines = 'suspend'`). לכן ה-purge רץ בעליית השרת וגם לפני כל שאילתת "נמחקו"
   (מחיקה קשה של כל מה ש-`deletedAt` שלו ישן מ-30 יום). זה זול ולא דורש תשתית.
5. **ספרינט שנמחק לא נספר בבדיקות חפיפה או סדר** (BUG-12, פיצ'ר 16 "הספרינט הבא").
6. **שחזור צוות** מחזיר אותו עם כל החברים, הספרינטים וההערות כפי שהיו. שחזור ספרינט של צוות
   שנמחק לא אפשרי עד ששוחזר הצוות.
7. **"צוותים שנמחקו"** מוצג למי שהיה מנהל `ACTIVE` בצוות ברגע המחיקה (שורות ה-`TeamMember` לא
   נמחקות במחיקה רכה).

### ממצאי מחקר (מצב הקוד היום, 2026-10-13)

- `sprints.controller.ts` כולל `GET`, `POST`, `PATCH` לספרינט, ואין `DELETE`. בפיצ'ר 4 נכתב
  במפורש שמחיקה נדחתה לסבב נפרד.
- `teams.service.ts::decline` מוחק צוות רק כשהוא `PENDING_APPROVAL`. לצוות `ACTIVE` מוחזר 409.
- `google-calendar.service.ts` כולל `syncSprintCreated`, `syncSprintUpdated`, `syncTeamRenamed`,
  `removeMemberFromTeam` (`events.delete`) ו-`backfillExistingSprints`. אין סנכרון למחיקה.
- `UserMessagingLink.activeTeamId`/`activeSprintId` הם `Int?` בלי relation, ולא מתאפסים לבד.
- אין scheduler (`@nestjs/schedule` לא מותקן), וה-backend ב-Fly רץ עם `min_machines_running = 0`.

### 14.1 Backend

- [x] Prisma: `deletedAt` + `deletedById` ל-`Sprint` ול-`Team`. `db push`. **`db push` נדחף ל-`postgres-test` בלבד; מול Neon — ממתין לאישור מפורש של נוה.**
- [x] סינון `deletedAt: null` בכל שאילתה נבנה עם `common/soft-delete.ts` (`isDeleted`, `LIVE_SPRINT`, `LIVE_TEAM`) — כל בדיקת קיום-צוות בכל השירותים (teams, invites, team-categories, team-logo, sprints) וכל חיפוש ספרינט (sprints, comments, telegram, google-calendar backfill). על `Sprint`/`Team` במודולים: teams, sprints, comments, invites, team-categories, google-calendar, telegram (רשימה מלאה תיבנה ב-PR עם grep על `prisma.sprint.`/`prisma.team.`).
- [x] `DELETE /teams/:teamId/sprints/:sprintId` (מנהל): `syncSprintDeleted` → איפוס טלגרם → `deletedAt`.
- [x] `DELETE /teams/:teamId` (מנהל, `confirmName` תואם): `syncTeamDeleted` → איפוס טלגרם → `deletedAt`.
- [x] `restore` לשניהם (מנהל, בתוך 30 יום) + סנכרון יומן מחדש.
- [x] `GET` רשימות "נמחקו" + purge (ברירת מחדל 4). ה-purge: `common/soft-delete-purge.ts` (צוותים לפני ספרינטים) + `SoftDeletePurgeBootstrap` בעליית השרת (מדלג תחת `NODE_ENV=test`) + לפני כל רשימת "נמחקו".
- [x] Unit tests: הרשאות; `confirmName` שגוי → 400; Google נכשל → המחיקה עדיין מצליחה; ספרינט שנמחק מחזיר 404 בהערות; שחזור מחזיר הערות; purge מוחק רק מה שישן מ-30 יום; הקשר טלגרם מתאפס.

### 14.2 Frontend

- [x] "מחק ספרינט" ליד "ערוך ספרינט" כפתור האישור נקרא "כן, מחק את הספרינט" (שונה מכפתור הכותרת כי שניהם על המסך יחד). (מנהל), עם אזהרת מספר ההערות. אחרי המחיקה — חזרה לרשימת הספרינטים. `trackEvent('sprint_delete_clicked' / 'sprint_deleted' / 'sprint_delete_cancelled')`.
- [x] "ספרינטים שנמחקו" (למנהל) בתחתית רשימת הספרינטים, עם "שחזר" וימים שנותרו. `sprint_restored`.
- [x] "אזור מסוכן" בהגדרות הצוות כל מנהל של הצוות; באנונימיות הצוות נשאר קישור ההזמנה פסול (404).: מחיקה עם הקלדת שם. אחרי המחיקה — חזרה לדשבורד. `team_delete_clicked` / `team_deleted`.
- [x] "צוותים שנמחקו" במסך ההגדרות, עם "שחזר". `team_restored`.
- [x] Jest web+native.

### 14.3 בדיקות

- [x] Playwright e2e (Desktop+Mobile): מנהל מוחק ספרינט ומשחזר אותו (ההערות חזרו); חבר רגיל לא רואה "מחק"; מחיקת צוות עם שם שגוי נחסמת ועם שם נכון מצליחה; הצוות נעלם לחבר אחר; מנהל משחזר.
- [x] Backend e2e: purge אחרי 30 יום מוחק בשרשור ספרינטים, הערות, הזמנות וקטגוריות.

### לא בטיפול (פיצ'ר 14)

- ארכוב צוות ("קפוא" — רואים, לא כותבים) כחלופה למחיקה.
- מחיקת הערה בודדת — פיצ'ר 13.

### פריטים שנגזרו מהמימוש

- [x] פיצ'ר 11 (§11.0 החלטה 8): החבר האמיתי האחרון, אם הוא מנהל, רואה "מחק את הצוות" במקום ההסבר — הכפתור פותח את "אזור מסוכן" בהגדרות.
- [x] פיצ'ר 19 (§19.0 החלטה #13): כל ה-endpoints של הלוגו (כולל `GET /invites/:token/logo`) מחזירים 404 לצוות שנמחק רכות; `TeamLogo` נוסף לרשימת ה-Cascade של ה-purge.
- [ ] בדיקה ידנית מול Google Calendar אמיתי: מחיקת ספרינט/צוות מנקה את האירועים/היומן, ושחזור יוצר אותם מחדש (ה-sync נבדק רק עם `googleapis` ממוקם).
