## פיצ'ר 16: משימות המשך (Action Items) — מומש (2026-10-14); `db push` רץ רק מול `postgres-test`, **טרם מול Neon**

### נקודות מרכזיות (touchpoints)

- **מודלים (Prisma):** חדשים — `ActionItem` (`id`, `teamId` FK cascade, `sprintId` — הספרינט שבו נולדה, FK cascade, `sourceCommentId Int?` FK ל-`Comment` `SetNull`, `title`, `status` enum `ActionItemStatus { OPEN DONE DROPPED }`, `dueDate DateTime?`, `createdById` FK ל-`User` `SetNull`, `createdAt`, `closedAt DateTime?`); `ActionItemAssignee` (`actionItemId` FK cascade, `userId` FK cascade, `@@unique([actionItemId, userId])`). בנוי בדפוס "ישות בבעלות צוות" (`TeamInvite`/`TeamCommentCategory`, ר' `backend/AGENTS.md`).
- **Backend:** מודול חדש `backend/src/action-items/` (service + controller + dto), `backend/src/sprints/sprint-summary.builder.ts` (שקף "משימות המשך").
- **Endpoints:** חדשים — `GET /teams/:teamId/action-items?status=`, `GET /me/action-items?status=OPEN`, `POST /sprints/:sprintId/action-items` (`{ title, sourceCommentId?, assigneeIds?, dueDate? }`), `PATCH /action-items/:id` (`{ title?, status?, assigneeIds?, dueDate? }`), `DELETE /action-items/:id`.
- **Frontend:** פאנל "משימות המשך" + פס "משימות פתוחות מרטרו קודם" בראש לוח הרטרו (`sprint-retro-board-web.tsx`/`-native.tsx`), "הפוך למשימה" על כרטיס הערה (`comment-card-web.tsx`/`renderCommentCard`), "המשימות שלי" בדשבורד (`features/dashboard/components/dashboard-web.tsx`/`-native.tsx`), `src/constants/strings.ts`.
- **נוגע בפיצ'ר 1** (שקף חדש), **13** (מחיקה רכה של הערת מקור; חלון כתיבה — ר' ברירת מחדל 5), **14** (ספרינט/צוות שנמחק), **11** (אחראי שעזב — תווית "לא בצוות"), **15** (אחראי שמחק חשבון), **17** (שלבי "סקירת משימות" ו"משימות המשך" ברטרו בלייב).

מטרת הפיצ'ר: לסגור את הלולאה של הרטרו. היום הרטרו נגמר ברשימת "שימור" ו"שיפור", ושום דבר לא
עובר לספרינט הבא. משימת המשך היא התחייבות קונקרטית, עם אחראים וסטטוס, שהצוות חוזר אליה ברטרו
הבא ובודק אם בוצעה.

### 16.0 החלטות

**החלטות מוצריות (נוה, 2026-10-13):**

1. **משימה נולדת מכל הערה** (שימור או שיפור, דרך "הפוך למשימה") **או כמשימה חופשית** מהפאנל.
2. **כל חבר צוות יכול הכל:** ליצור, לשייך אחראים, לשנות סטטוס, לערוך ולמחוק.
3. **כמה אחראים למשימה**, או בלי אחראי בכלל (מוצג "הצוות").
4. **תאריך יעד אופציונלי.**
5. **בראש לוח הרטרו מוצגות המשימות הפתוחות מרטרו קודם** ("מה בוצע?"), עם שינוי סטטוס מהיר.
6. **שלושה סטטוסים:** פתוחה / בוצעה / ירדה מהפרק.
7. **אין תזכורות בשלב הראשון.** המשימות מופיעות ב"המשימות שלי" בדשבורד ובראש הרטרו הבא.
8. **שקף אחד במצגת הסיכום:** "משימות שנוצרו ברטרו הזה" ו"משימות שנסגרו בספרינט הזה".

**ברירות מחדל טכניות (נקבעו כאן, לא לשאול את נוה עליהן):**

1. **משימה שייכת לצוות, לא לספרינט.** `sprintId` רק מתעד איפה היא נולדה. משימה פתוחה ממשיכה
   להופיע עד שהיא נסגרת, בלי "העברה" בין ספרינטים.
2. **קישור להערה הוא אופציונלי.** הערה שנמחקה (מחיקה רכה, פיצ'ר 13) לא מוחקת את המשימה, ואז
   הקישור להערה לא מוצג.
3. **אחראי חייב להיות חבר `ACTIVE` ברגע השיוך.** אם הוא עוזב (11) או מוחק חשבון (15), הוא נשאר
   משויך ומוצג עם "לא בצוות".
4. **הערה אנונימית שהופכת למשימה לא חושפת את הכותב.** המשימה מקבלת את התוכן, לא את המחבר.
5. **משימות לא כפופות לחלון הכתיבה של הלוח** (פיצ'ר 13) — אפשר לסגור משימה ישנה גם כשהלוח של
   הספרינט שבו נולדה כבר נעול.
6. **"רטרו קודם"** = כל המשימות הפתוחות של הצוות שנולדו בספרינט אחר מהספרינט הנוכחי.
7. **`closedAt`** מתמלא במעבר ל-`DONE`/`DROPPED` ומתאפס בפתיחה מחדש. הוא מה שקובע "נסגרו
   בספרינט הזה" (בין `startDate` ל-`endDate`) בשקף הסיכום.

### ממצאי מחקר (מצב הקוד היום, 2026-10-13)

- אין מושג של משימה, אחראי או מעקב במודל. הערות הן `KEEP`/`IMPROVE` עם קטגוריה, הדגשה
  ואנונימיות.
- `sprint-summary.builder.ts` בונה שקפים לפי קטגוריה ועמודה, עם `fitColumnText` לחיתוך טקסט ארוך —
  אותה תשתית מתאימה לשקף משימות.
- הרעיון "גם אני" ב-IDEAS (הצבעה על הערה) יכול לשמש בעתיד לתעדוף אילו הערות הופכות למשימות.

### 16.1 Backend

- [x] Prisma: `ActionItem`, `ActionItemAssignee`, `ActionItemStatus`. `db push`.
- [x] מודול `action-items`: CRUD לפי ה-endpoints. כל פעולה דורשת חברות `ACTIVE` בצוות.
- [x] ולידציה: `sourceCommentId` מאותו צוות; `assigneeIds` כולם חברי `ACTIVE` בצוות (400 אחרת); `title` לא ריק.
- [x] `GET /teams/:teamId/action-items`: סינון לפי סטטוס; פתוחות קודם, לפי תאריך יעד. כולל אחראים עם `isActiveMember`.
- [x] `GET /me/action-items?status=OPEN`: המשימות הפתוחות שלי בכל הצוותים (לדשבורד).
- [x] סיכום ספרינט: שקף אחד עם שתי עמודות (ברירת מחדל 7).
- [x] Unit tests: לא-חבר ✗; אחראי שאינו חבר → 400; כמה אחראים ✓; מחיקת הערת מקור לא מוחקת משימה; משימה פתוחה מופיעה ב"רטרו קודם" של הספרינט הבא; `closedAt` נכון.

### 16.2 Frontend

- [x] פאנל "משימות המשך" בלוח הרטרו: רשימה, יצירה חופשית, שינוי סטטוס, בחירת אחראים (multi-select), תאריך יעד (web+native).
- [x] פס "משימות פתוחות מרטרו קודם" בראש הלוח, עם סימון מהיר "בוצעה" / "ירדה".
- [x] "הפוך למשימה" על כרטיס הערה, עם התוכן ממולא מראש.
- [x] "המשימות שלי" בדשבורד.
- [x] `trackEvent` לכל לחיצה: `action_item_created` (`{ fromComment }`), `action_item_status_changed`, `action_item_assignees_changed`, `action_item_due_date_changed`, `action_item_deleted`, `action_items_panel_toggled`, `previous_action_items_status_changed`.
- [x] Jest web+native.

### 16.3 בדיקות

- [x] Playwright e2e (Desktop+Mobile): יצירת משימה מהערה → שיוך שני אחראים → אחד מהם רואה אותה בדשבורד → בלוח של הספרינט הבא היא מופיעה בראש → סימון "בוצעה" → היא נעלמת מ"פתוחות".

### לא בטיפול (פיצ'ר 16)

- תזכורות (מייל או טלגרם) — נדחה לשלב שני.
- סנכרון ל-Jira, Trello או לכלי משימות חיצוני.
- תתי-משימות ותלויות בין משימות.
- סטטוס "בתהליך".

### הערות מימוש (2026-10-14)

- Backend: `backend/src/action-items/` (service/controller/dto/spec), סכימה ב-`schema.prisma` (נדחפה ל-`postgres-test` בלבד), שקף "משימות המשך" ב-`sprint-summary.builder.ts` (נוצרו בספרינט לפי `sprintId`; נסגרו לפי `closedAt` בין `startDate` לסוף יום `endDate` ב-UTC). e2e: `backend/test/action-items.e2e-spec.ts`.
- `DELETE` הוא מחיקה קשיחה (ללא מחיקה רכה). `sourceCommentId` מאותו צוות אך לא חייב להיות מאותו ספרינט. `closedAt` מתעדכן גם במעבר DONE↔DROPPED.
- **מגבלה ידועה:** `sprintId` הוא FK עם cascade (כפי שנקבע), לכן מחיקה סופית (purge אחרי 30 יום) של ספרינט מוחקת גם משימות שנולדו בו — גם פתוחות. מחיקה רכה (פיצ'ר 14) לא משפיעה עליהן.
- Frontend: `frontend/src/features/action-items/` (hooks משותפים, רכיבי web+native), טופס ב-`Modal` משותף. הפאנל מציג משימות שנולדו בספרינט הנוכחי; הפס מציג פתוחות מספרינטים אחרים. "המשימות שלי" מופיע בדשבורד רק כשיש משימות. e2e: `frontend/e2e/action-items.spec.ts`.
