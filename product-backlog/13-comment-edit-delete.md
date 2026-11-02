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

- [x] Prisma: `Comment.updatedAt`, `deletedAt`, `deletedById` (+ אינדקס `[sprintId, deletedAt]`) + מודל `SprintWriteExtension`. מיגרציה `20261026024132_comment_edit_delete_write_extensions` (תוספתית בלבד; הוחלה על DB הבדיקות; **`migrate:dev` לא הורץ** — ר' דיווח). אין `@default` על שורות קיימות — אין backfill.
- [x] util חלון כתיבה: `backend/src/sprints/sprint-write-window.util.ts` — `isWithinWriteWindow` (ימים קלנדריים ב-`Asia/Jerusalem`, `WRITE_WINDOW_DAYS = 3` = `RECENT_SPRINT_DAYS`; אין גבול תחתון: לפני תחילת הספרינט פתוח), `isSprintWritable(sprint, userId, now, extensions)`, `SprintLockedException` (403 `הלוח נעול לכתיבה — הספרינט הסתיים`). שאילתת ההארכה (`comments-access.ts::isSprintWritableFor`) רצה רק כשהלוח נעול.
- [x] `create`: חסימה מחוץ לחלון (`SprintLockedException`). טלגרם: ה-`catch` ב-`createPendingComment` מזהה את החריגה, מנקה טיוטה+הקשר ושולח `SPRINT_LOCKED_MESSAGE` (`telegram-messages.ts`); הבוט מציע ממילא רק ספרינטים פתוחים-היום, כך שהענף הזה מכסה בעיקר עריכת תאריכים באמצע שיחה. התשובה כוללת `isMine/canEdit/canDelete = true`.
- [x] `getCommentsForSprint`: סינון `deletedAt: null`; `isMine`, `canEdit`, `canDelete` מחושבים מה-`authorId` האמיתי **לפני** המיסוך (`permissionsFor`), ו-`authorId` עדיין מוסר מאנונימיות (BUG-02). `canDelete` נוסף מעבר לאפיון (= `canEdit` או מנהל) כדי שה-frontend לא יגזור הרשאת מודרציה בעצמו.
- [x] `PATCH /comments/:commentId` (`CommentsService.update`): בעלות (`authorId`/`postedByAdminId`; גם מנהל/ראש צוות לא עורכים של אחר → 403), חברות `ACTIVE` (404 לזר, BUG-40), חלון כתיבה, ולידציית `content`/`type`/`categoryId` (קטגוריה של אותו צוות ופעילה; `null` מנקה; ללא שינוי בקטגוריה לא נבדק מחדש), `isAnonymous` → 400, `updatedAt` נחתם רק אם משהו באמת השתנה (גם העברת עמודה/קטגוריה, לא רק תוכן).
- [x] `DELETE /comments/:commentId` (`remove`): מחיקה רכה + `deletedById`; כותב/מפרסם בתוך החלון (או עם הארכה), **מנהל (`isAdmin` בלבד) בכל זמן ועל הערה של כל אחד**; ראש צוות לא-אדמין → 403. `setHighlighted` על הערה מחוקה → 404.
- [x] `GET /sprints/:sprintId/comments/deleted`: מנהל בלבד (403 לאחרים, 404 לזר), ממוין לפי `deletedAt` יורד, עם `deletedBy` ו-`deletedByAuthor`. הערה אנונימית נשארת ממוסכת; אם הכותב עצמו מחק אותה — `deletedBy: null` + `deletedByAuthor: true` (אחרת שם המוחק היה חושף את הכותב).
- [x] הארכות: `SprintWriteExtensionsService` — `POST /sprints/:sprintId/write-extensions` (`{ userId, expiresAt }`; תאריך בלבד = סוף היום בשעון ישראל; חייב להיות בעתיד; יעד = חבר `ACTIVE`; הארכה חדשה **מחליפה** קיימת לאותו חבר), `DELETE /sprints/:sprintId/write-extensions/:id`; מנהל בלבד. **נוספו מעבר לאפיון (נדרשים ל-frontend):** `GET /sprints/:sprintId/write-extensions` (מנהל: כל הפעילות; חבר: שלו בלבד) ו-`GET /sprints/:sprintId/write-access` → `{ canWrite, windowOpen, windowDays, extensionExpiresAt }` להצגת "הלוח נעול" / "פתוח לך עד".
- [x] סינון `deletedAt` בכל קריאת הערות: סיכום/ייצוא PPTX (`sprints.service.ts::exportSummaryPptx`), `commentCount` בכרטיס מחיקת ספרינט (`remove`/`findDeleted`), `commentCount` של קטגוריות (`team-categories`), נקודות לשיפור (פיצ'ר 20: `assertCommentsInTeam`, `listProposals`, `dismissProposals`, `propose`, `myProposedCommentIds`, מקורות ו-`_count.proposals` ב-`list`). משחק הזיכרון נשען על `GET .../comments` (אין לו endpoint משלו). **במכוון לא מסונן:** ספירת "הערה ראשונה" ב-onboarding (`first-comment`, `isGuideAutoStart`) — זה אבן דרך שהמשתמש עבר; מחיקת ההערה לא מבטלת אותה. מחיקת/עזיבת צוות/ניקוי: אין שאילתות הערות, הכול cascade.
- [x] Unit tests (`comments.service.spec.ts`, `sprint-write-extensions.service.spec.ts`, `sprint-write-window.util.spec.ts`, טלגרם, `sprints.service.spec.ts`) + backend e2e `test/comment-edit-delete.e2e-spec.ts` (22 בדיקות): כל המקרים שברשימה המקורית + חלון (יום 3 פתוח / יום 4 נעול), הארכה פעילה/שפגה/בוטלה, אנונימי, מפרסם-בשם, מחוק נעלם מהלוח/קטגוריות/הצעות, פאנל מחוקות.
- [x] תיקוני סקירה (2026-10-26, Backend): (א) **אנונימיות ונעילה** — `create` דוחה `isAnonymous:true` (403, "אי אפשר לפרסם הערה אנונימית אחרי שהלוח ננעל — …") כשהכתיבה מתאפשרת רק בזכות הארכה (מחוץ לחלון הרגיל), כי חותמת הזמן הייתה חושפת את הכותב; `GET /sprints/:id/write-access` מחזיר גם `anonymousAllowed` (false כשהלוח נעול); PATCH ממשיך לדחות כל `isAnonymous` (400). נותר סיכון: עריכה/מחיקה של הערה אנונימית קיימת בזכות הארכה מטביעה `updatedAt`/`deletedAt` מאוחרים — לא נחסם. (ב) `GET /onboarding/status` מחזיר `isAdmin` (`TeamMember.isAdmin` בצוות של `hints.teamId`) להסתרת צעדי המדריך למנהל בלבד. (ג) תקרת הארכה 30 יום (400), תקרת תוכן הערה 2000 תווים ב-`create`/`update` (400; ל-frontend אין תקרה משלו), מחיקת הארכות של חבר שהוסר/עזב (`teams.service.ts` + `comments/write-extension-cleanup.util.ts`), `israelDayAnchor` יחיד ב-`common/israel-day.ts` (טלגרם משתמש בו), `@@unique([sprintId, userId])` על `SprintWriteExtension` (מיגרציה `20261026085043_write_extension_unique_per_member`, תוספתית; `grant` ב-`upsert`).
- **השפעה על טסטים קיימים:** `create` חוסם כעת ספרינט שהסתיים לפני יותר מ-3 ימים, ולכן ב-backend e2e (`soft-delete`, `focus-points`, `onboarding`) הערות בספרינט ישן נוצרות עכשיו דרך `prisma` או בספרינט שמסתיים אתמול. **`frontend/e2e/focus-points.spec.ts` (שורה ~71: ספרינט שהסתיים לפני 15 ימים + `POST comments`) ישבר** — לטפל בשלב הבדיקות (QA).

### 13.2 Frontend

- [x] תפריט "ערוך / מחק" (`ActionMenu` "⋯", web+native) על כרטיס הערה לפי `canEdit`/`canDelete` מהשרת. `trackEvent`: `comment_edit_opened` / `comment_edited` / `comment_delete_clicked` / `comment_deleted` (+ `comment_edit_cancelled`, `comment_delete_cancelled`). Hook משותף `features/retro/hooks/use-comment-actions.ts`; הלוח מעדכן את הרשימה המקומית מתשובת ה-PATCH/DELETE (בלי refetch). ב-native הכרטיס הוצא ל-`comment-card-native.tsx`.
- [x] עריכה בתוך הכרטיס: `<Field type="textarea">` + `Segmented` להעברת עמודה (KEEP/IMPROVE) + בורר קטגוריה (הפעילות + הנוכחית של ההערה גם אם הושבתה); נשלחים רק שדות שהשתנו; אנונימיות לא ניתנת לשינוי (הערת הסבר). native: אותם שדות עם `PillPickerNative`/`LabeledInputNative`.
- [x] אישור מחיקה inline בכרטיס (`comment-delete-confirm-*`), בלי `confirm()`; מחיקת הערה של אחר (מודרציה) מציגה הערה "המחיקה נרשמת על שמך".
- [x] תווית "נערכה" (לפי `updatedAt`): כרטיס הלוח (web+native, עם tooltip של זמן העריכה ב-web) וקלף משחק הזיכרון (web+native).
- [x] לוח נעול: `GET /sprints/:id/write-access` (ב-mount + "רענן"); `canWrite=false` → "הלוח נעול לכתיבה" במקום טופס הכתיבה; הארכה פעילה אחרי נעילה → "פתוח לך עד <תאריך>" מעל הטופס. אם הקריאה נכשלת הטופס נשאר והשרת (403) הוא רשת הביטחון.
- [x] למנהל צוות (`isAdmin` בלבד, לא ראש צוות): "מחק" על כל הערה (`canDelete`); פאנל "הערות שנמחקו" (`deleted_comments_panel_opened`, נטען רק בפתיחה, מתרענן אחרי מחיקה מהלוח ובלחיצת "רענן"; אנונימי נשאר ממוסך, "נמחקה על ידי מי שכתב/ה אותה" כש-`deletedByAuthor`); פאנל "הארכת כתיבה" (בחירת חבר פעיל אמיתי — בלי פנטום/ממתין — + תאריך סיום, רשימת הארכות פעילות וביטול; `write_extension_granted` / `write_extension_revoked`, + `write_extensions_panel_opened`).
- [x] כל המחרוזות ב-`Strings` (`retroBoard.*`, `onboarding.*`). Jest web+native: כרטיס, לוח מלא (web+native), פאנלים/טופס הארכה, hooks, תווית "נערכה" (web+native), עזרים. נבדק גם בדפדפן (Playwright חד-פעמי שנמחק) ב-Desktop וב-375px: אין גלילה אופקית, זרימות עריכה/מחיקה/נעילה/הארכה/מחוקות עובדות מול backend מבודד.

### 13.3 בדיקות

- [x] Playwright e2e (Desktop+Mobile): כותב עורך הערה ומעביר לעמודה השנייה; חבר אחר לא רואה תפריט; מחיקה והיעלמות מהלוח ומהסיכום; עריכת הערה אנונימית שלי; ספרינט שהסתיים לפני 4 ימים נעול; מנהל נותן הארכה וחבר כותב; מנהל רואה הערה שנמחקה בפאנל. — `frontend/e2e/comment-edit-delete.spec.ts` (+ helpers ב-`comment-edit-ui.ts`), 8 תרחישים × 2 פרויקטים. גבולות הרשאה נבדקים גם מול ה-API (PATCH/DELETE של זר/מנהל = 403, מחוץ לצוות = 404, `/comments/deleted` ו-`write-extensions` לחבר = 403, `isAnonymous:false` = 400, נעילה = 403 עם ההודעה). בנוסף: תווית "נערכה" בלוח ובמשחק הזיכרון, מחיקה מוציאה את הקלף ממשחק הזיכרון, יום 3 אחרי הסיום עדיין פתוח, ביטול הארכה נועל שוב, אנונימי נשאר ממוסך בפאנל גם למנהל ("נמחקה על ידי מי שכתב/ה אותה").
- [x] עדכון בדיקות קיימות שנשברו מכרטיסי "מה חדש" החדשים: `backend/test/onboarding.e2e-spec.ts`, `backend/src/onboarding/onboarding.service.spec.ts` (`unseenFeatureKeys`: חבר/משתמש חדש = `['comment-edit-delete']`, מנהל = שלושה כרטיסים לפי הסדר) ו-`frontend/e2e/onboarding.spec.ts` (כרטיס אחד בכל כניסה — הבא מופיע בכניסה הבאה לדשבורד, סיור: `comment-moderation` אחרון למנהל, `comment-edit-delete` אחרון לחבר).

**החלטה מסקירת אבטחה (נוה, 2026-10-26):** כשהלוח נעול והכתיבה אפשרית רק בזכות הארכה, **אי אפשר לכתוב הערה אנונימית** — זמני `createdAt`/`updatedAt`/`deletedAt` היו מזהים את הכותב (מחזיק ההארכה היחיד). נאכף בשרת ב-`create`, ו-`GET /sprints/:id/write-access` מחזיר `anonymousAllowed`.

### 13.4 הטמעה

- **רמה: א' (זרימה בסיסית)** — הפיצ'ר משנה את כרטיס ההערה ואת טופס הכתיבה בלוח הרטרו (מסלול ראשי), ומוסיף מצב "לוח נעול". *(אושר על ידי נוה, 2026-10-26.)*
- [x] צעד/עוגן במדריך האינטראקטיבי (פיצ'ר 22, `guide-script-basic.ts`): צעד `board-edit` (עוגן `board-comment-menu` על ההערה הראשונה שהצופה רשאי לערוך/למחוק; הערה ממורכזת אם אין לו). המדריך לא מדבר על "לוח פתוח תמיד" — אין טקסט לשנות. עוגן על תפריט "ערוך / מחק" של הערה, ושינוי הטקסט אם המדריך מדבר על "הלוח פתוח תמיד".
- [x] כרטיס "מה חדש" (שני מפתחות, `since` 2026-10-26: `comment-edit-delete` ALL, `comment-moderation` MANAGEMENT; Jest parity ירוק) (`registry.ts` + `onboarding-features.ts`, אותם מפתחות וקהל): לחבר — "אפשר לערוך ולמחוק הערה, עד 3 ימים אחרי הספרינט"; להנהלה — "פאנל הערות שנמחקו והארכת כתיבה".
- [x] עוגנים (`board-write-extensions`, `board-deleted-comments`; צעדים להנהלה בלבד — ראש צוות שאינו מנהל לא רואה את הפאנלים, אצלו הצעד נהפך להערה ממורכזת) של פאנל "הארכת כתיבה" ו"הערות שנמחקו" (מנהל בלבד) במדריך ההנהלה.

### לא בטיפול (פיצ'ר 13)

- היסטוריית גרסאות של הערה (מה היה כתוב לפני העריכה).
- עריכה או מחיקה דרך הבוט בטלגרם.
- שחזור הערה שנמחקה מתוך ה-UI (אפשרי בהמשך, כי המחיקה רכה).
- **נסגר (נוה, 2026-10-26):** עריכה/מחיקה של הערה אנונימית *קיימת* אחרי שהלוח ננעל נחסמת גם היא לכותב (403; `canEdit`/`canDelete` = false), כי חותמת הזמן הייתה מזהה אותו. מנהל עדיין יכול למחוק הערה אנונימית של אחר (מודרציה).
