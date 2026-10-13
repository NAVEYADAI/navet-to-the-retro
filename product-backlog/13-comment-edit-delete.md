## פיצ'ר 13: עריכה ומחיקה של הערות + חלון כתיבה לספרינט — מאופיין, מוכן למימוש (כל ההחלטות נסגרו 2026-10-13)

### נקודות מרכזיות (touchpoints)

- **מודלים (Prisma):** `Comment` — שדות חדשים `updatedAt DateTime?` (מתי נערכה), `deletedAt DateTime?` + `deletedById Int?` (FK ל-`User`, `SetNull`) למחיקה רכה. מודל חדש `SprintWriteExtension` (`sprintId` FK cascade, `userId` FK cascade, `grantedById` FK ל-`User` `SetNull`, `expiresAt`, `createdAt`) — הארכת חלון כתיבה למשתמש ספציפי.
- **Backend:** `backend/src/comments/comments.service.ts` (`update`, `remove` חדשים; `create` — בדיקת חלון כתיבה; `getCommentsForSprint` — סינון מחוקות + `isMine` + `canEdit`), `backend/src/comments/comments.controller.ts`, `backend/src/comments/dto/`, util חדש לחלון הכתיבה (למשל `backend/src/sprints/sprint-write-window.util.ts`), `backend/src/sprints/sprint-summary.builder.ts` (בלי מחוקות), `backend/src/telegram/telegram-conversation.service.ts` (אותו חלון כתיבה).
- **Endpoints:** חדשים — `PATCH /comments/:commentId` (`{ content?, type?, categoryId? }`), `DELETE /comments/:commentId`, `GET /sprints/:sprintId/comments/deleted` (מנהל בלבד), `POST /sprints/:sprintId/write-extensions` (`{ userId, expiresAt }`, מנהל בלבד), `DELETE /sprints/:sprintId/write-extensions/:id`.
- **Frontend:** `features/retro/components/comment-card-web.tsx` + `renderCommentCard` ב-`sprint-retro-board-native.tsx` (תפריט ערוך/מחק), `memory-card-web.tsx`/`-native.tsx` (תווית "נערכה"), `features/retro/comment-display.ts`, `sprint-retro-board-web.tsx`/`-native.tsx` (מצב לוח נעול, פאנל הארכות ופאנל "הערות שנמחקו" למנהל), `src/constants/strings.ts`.
- **נוגע ב-`Comment`** — כמו פיצ'רים 1, 2, 3, 8, 9, 10, 11, 16. מחיקה רכה מחייבת שכל קריאה של תגובות תסנן `deletedAt`. **נוגע במיסוך האנונימי** (`maskIfAnonymous`, BUG-02). **נוגע ב-`RECENT_SPRINT_DAYS`** (`frontend/src/features/sprints/sprint-lifecycle.ts`) — חלון הכתיבה מבוסס על אותו מספר ימים.

מטרת הפיצ'ר: לאפשר למי שכתב הערה לתקן אותה (טעות, עמודה לא נכונה, קטגוריה) או למחוק אותה;
לאפשר למנהל להסיר הערה בעייתית; ולקבוע עד מתי אפשר בכלל לכתוב בלוח של ספרינט.

### 13.0 החלטות

**החלטות מוצריות (נוה, 2026-10-13):**

1. **חלון כתיבה אחד לכל הפעולות** — כתיבה, עריכה ומחיקה של הערה מותרות כל עוד הספרינט "פתוח":
   לפני שהתחיל, בזמן שהוא פעיל, ועד 3 ימים אחרי תאריך הסיום. זה בדיוק הזמן שבו הספרינט מוצג
   ברשימה הראשית (`active`/`upcoming`/`recent`, `RECENT_SPRINT_DAYS = 3`). אחרי זה הלוח נעול.
2. **מנהל יכול לפתוח חלון הארכה למשתמשים ספציפיים**, לזמן מוגדר (למשל "דנה יכולה לכתוב בספרינט 12
   עד יום חמישי"). ההארכה פותחת למשתמש הזה כתיבה, עריכה ומחיקה של ההערות שלו.
3. **מחיקה רכה.** ההערה נעלמת מהלוח, מהסיכום וממשחק הזיכרון, אבל נשמרת ב-DB.
4. **הערה שפורסמה בשם מישהו (פיצ'ר 9):** גם מי שפרסם (`postedByAdminId`) וגם מי שבשמו פורסמה
   (`authorId`) יכולים לערוך ולמחוק אותה.
5. **מנהל (בלבד, לא ראש צוות) יכול למחוק הערה של כל אחד**, ורק מנהלים רואים פאנל "הערות שנמחקו".
   זה מממש את הרעיון שהיה רשום ב-IDEAS.

**ברירות מחדל טכניות (נקבעו כאן, לא לשאול את נוה עליהן):**

1. **השרת מחזיר `isMine` ו-`canEdit` לכל תגובה, גם לאנונימית.** המיסוך מסתיר את `authorId` מכולם,
   כולל מהכותב, כך שה-frontend לא יכול לדעת לבד איזו הערה שלו. `isMine` חושף רק לכותב עצמו, ולכן
   לא שובר את BUG-02. `canEdit` כבר כולל את חלון הכתיבה וההארכות.
2. **חלון הכתיבה מחושב בשרת**, לפי ימים קלנדריים ב-`Asia/Jerusalem` (כמו `formatDate` בסיכום),
   ובאותו מספר ימים כמו `RECENT_SPRINT_DAYS`. נבדק ב-`create`, `update`, `remove` ובזרימת הטלגרם.
3. **אנונימיות לא ניתנת לשינוי בעריכה**, כי מעבר מאנונימי לגלוי אחרי שאנשים ראו את ההערה עלול
   לחשוף את הכותב. עורכים רק תוכן, עמודה (`type`) וקטגוריה.
4. **הדגשה נשמרת בעריכה.** אם התוכן השתנה, מוצג "נערכה".
5. **מחיקה ע"י מנהל (מודרציה) לא כפופה לחלון הכתיבה** — אפשר להסיר הערה פוגענית גם מספרינט ישן.
6. **בפאנל "הערות שנמחקו" הערה אנונימית נשארת ממוסכת**, ומוצג מי מחק אותה ומתי.
7. **ההארכה היא למשתמש ולספרינט**, עם `expiresAt` חובה. מנהל יכול לבטל אותה לפני הזמן.

### ממצאי מחקר (מצב הקוד היום, 2026-10-13)

- `comments.controller.ts` מכיל שלושה endpoints בלבד: `GET`/`POST /sprints/:sprintId/comments`
  ו-`PATCH /comments/:commentId/highlight`. אין עריכה ואין מחיקה.
- `maskIfAnonymous` (`comments.service.ts:206`) מחליף את `author` ב-"Anonymous" ומסיר את `authorId`
  **לכולם, כולל מנהלים וכולל הכותב** (BUG-02).
- `Comment` לא כולל `updatedAt`.
- `create` לא בודק את תאריכי הספרינט. גם טלגרם (פיצ'ר 10) יוצר הערות באותה דרך.
- `sprint-lifecycle.ts` מגדיר `RECENT_SPRINT_DAYS = 3` ואת ה-buckets
  `active`/`upcoming`/`recent`/`expired`, אבל רק בצד ה-frontend ולפי שעון מקומי.

### 13.1 Backend

- [ ] Prisma: `Comment.updatedAt`, `deletedAt`, `deletedById` + מודל `SprintWriteExtension`. `db push`.
- [ ] util חלון כתיבה: `isSprintWritable(sprint, userId, now)` = בתוך החלון, או הארכה פעילה למשתמש.
- [ ] `create`: חסימה מחוץ לחלון (403 עם הודעה בעברית). אותה בדיקה בזרימת הטלגרם, עם הודעה מתאימה בבוט.
- [ ] `getCommentsForSprint`: סינון `deletedAt`; `isMine`, `canEdit` (מחושבים לפני המיסוך).
- [ ] `PATCH /comments/:commentId`: הרשאה (`authorId` או `postedByAdminId` = המבקש), חברות `ACTIVE`, חלון כתיבה, ולידציית `type`/`categoryId` (קטגוריה פעילה של אותו צוות), דחיית `isAnonymous`, עדכון `updatedAt`.
- [ ] `DELETE /comments/:commentId`: כותב/מפרסם בתוך החלון, או מנהל בכל זמן. מחיקה רכה + `deletedById`.
- [ ] `GET /sprints/:sprintId/comments/deleted`: מנהל בלבד, עם מיסוך אנונימיות.
- [ ] הארכות: `POST`/`DELETE` write-extensions, מנהל בלבד. היעד חבר `ACTIVE` בצוות.
- [ ] `sprint-summary.builder.ts` ומשחק הזיכרון: בלי מחוקות.
- [ ] Unit tests: כותב עורך ✓ / אחר ✗ / מפרסם-בשם ✓ / מי שבשמו פורסמה ✓; עריכת אנונימית שלי בלי חשיפת `authorId`; שינוי `isAnonymous` נדחה; מחוץ לחלון ✗ / עם הארכה ✓ / הארכה שפגה ✗; מנהל מוחק הערה של אחר מספרינט ישן ✓; ראש צוות מוחק הערה של אחר ✗.

### 13.2 Frontend

- [ ] תפריט "ערוך / מחק" על כרטיס הערה כש-`canEdit` (web+native). `trackEvent('comment_edit_opened' / 'comment_edited' / 'comment_delete_clicked' / 'comment_deleted')`.
- [ ] עריכה בתוך הכרטיס (אותו `<Field>` של כתיבת הערה), כולל העברה לעמודה השנייה ובחירת קטגוריה.
- [ ] אישור לפני מחיקה (inline, לא `confirm()` של הדפדפן).
- [ ] תווית "נערכה" (לוח, משחק זיכרון).
- [ ] לוח נעול: הודעה "הלוח נעול לכתיבה" במקום טופס הכתיבה. אם יש למשתמש הארכה: "פתוח לך עד <תאריך>".
- [ ] למנהל: "מחק" על כל הערה (מודרציה); פאנל "הערות שנמחקו" (`deleted_comments_panel_opened`); פאנל "הארכת כתיבה" — בחירת חבר ותאריך סיום, ביטול (`write_extension_granted` / `write_extension_revoked`).
- [ ] כל המחרוזות ב-`Strings`. Jest web+native.

### 13.3 בדיקות

- [ ] Playwright e2e (Desktop+Mobile): כותב עורך הערה ומעביר לעמודה השנייה; חבר אחר לא רואה תפריט; מחיקה והיעלמות מהלוח ומהסיכום; עריכת הערה אנונימית שלי; ספרינט שהסתיים לפני 4 ימים נעול; מנהל נותן הארכה וחבר כותב; מנהל רואה הערה שנמחקה בפאנל.

### לא בטיפול (פיצ'ר 13)

- היסטוריית גרסאות של הערה (מה היה כתוב לפני העריכה).
- עריכה או מחיקה דרך הבוט בטלגרם.
- שחזור הערה שנמחקה מתוך ה-UI (אפשרי בהמשך, כי המחיקה רכה).
